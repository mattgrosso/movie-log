---
paths:
  - "src/components/Login.vue"
  - "src/assets/javascript/databaseKey.js"
  - "src/assets/javascript/authErrors.js"
  - "scripts/generate-database-rules.mjs"
  - "database.rules.json"
  - "aws-lambda/*.js"
  - "src/utils/aiRequest.js"
---

# Auth & database rules

Full narrative: `docs/history/tooling-and-auth.md`.

## The tightened database rules are DEPLOYED (2026-08-14, supervised)

Live since 2026-08-14: default-deny, per-account access only, `bugReports` write-only,
share links readable, `testing-database` restricted to the owner account, and the
`updatedAt` index (delta-sync prerequisite). Verified at deploy time: unauthenticated
REST reads denied on settings/movieLog/bugReports; Admin SDK scripts unaffected.

`yarn deploy` does **not** touch rules — `firebase deploy --only database` is separate,
deliberately, and any future rules change should still be deployed **supervised**: a bad
deploy shows live users an empty library. `LibraryAccessBanner.vue` (driven by
`state.dbReadDenied`, set by the listeners' error callbacks) is the user-facing guidance
if a device loses read access.

**The global `firebase-tools` install is broken** (upstream ESM-only `uuid` under
`universal-analytics`). Deploy with a fresh `firebase-tools@13` install carrying an npm
override `{"uuid": "8.3.2"}` — Node is pinned to 18, so firebase-tools 14 (Node 20+) is
not an option yet.

## The constraint everything follows from

**A user's entire library is keyed by their email address**, sanitized to a database key.
So any auth provider must return a stable email — which rules out anonymous sign-in and
makes Apple's "Hide My Email" fine (stable per-app relay).

- **`databaseKey.js`'s `emailToDatabaseKey` is the single source of truth.** It
  deliberately does **not** lowercase — adding `.toLowerCase()` would silently re-key
  every existing account containing an uppercase character, pointing it at an empty
  database. Case is normalized in the login form instead.
- **`databaseKeyCharacters.json`** holds the character list because the rules generator is
  a plain Node script that can't import an ES module here. Don't regex-scrape it out of
  the JS — the list contains `','`.
- Every provider funnels through **`completeLogin(user)`**, which **throws** rather than
  proceeding if no email comes back. Silently dropping someone into a wrongly-keyed empty
  database is far worse than refusing the sign-in.

## Generated rules

`database.rules.json` is **generated** — `yarn generate-db-rules`. Never hand-edit it.
The rules language has no regex, only `String.replace` (which replaces *every*
occurrence), so the email→key transform is a ~29-call chain generated from the shared
character list. `src/test/databaseRules.test.js` reads the generated file, applies the
chain in JS with `replaceAll`, and asserts byte-identical output to `emailToDatabaseKey`.

`.indexOn: ["updatedAt"]` under `$topKey/movieLog` is required for delta sync. **Without
it the query does not fail** — Firebase downloads the whole node, filters client-side, and
logs only a console warning, so the saving would be exactly zero.

## The AI lambda is authenticated

`aws-lambda/claude-ai.js` verifies a **Firebase ID token** (node `crypto`, no
`firebase-admin`). The **audience and issuer checks are load-bearing** — without them a
valid token from *any* Firebase project is accepted. CORS is not the gate; it only
constrains browsers. Client side, `src/utils/aiRequest.js` is the only place that attaches
the token, so no caller can forget.

The API Gateway `$default` stage is throttled to rate 2 / burst 10. Note the AWS account's
Lambda concurrency limit is **10**, and overflow surfaces as **503**, not 429. None of
this is a spend cap — only a limit on the Anthropic API key is.

## Verifying an authenticated write without signing in

**Dead since the 2026-08-14 rules deploy.** The old trick (set
`localStorage.databaseTopKey = 'testing-database'` in an unauthenticated session and
navigate by hash) relied on the open rules; `testing-database` now requires the owner
account's token. Live verification that mutates data now needs a real signed-in session —
i.e. Matt driving his own device with the dev-mode toggle — or the Admin SDK for
server-side checks (which bypasses rules entirely and still works for scripts).

## Admin scripts

Must live **inside the repo** — Node resolves `firebase-admin` relative to the importing
file, so a script in a scratchpad fails with `ERR_MODULE_NOT_FOUND`. Use
`scripts/loadEnvLocal.mjs`, not Node's `--env-file` (that needs Node 20.6+; this repo is
pinned to 18.18). **If an admin script hangs for minutes with no output, check the
`databaseURL` first** — a wrong one doesn't error, it retries forever. The project is
`movie-log-8c4d5`.

## Movie Hat is a second, independent sign-in — and its 401s have three causes

`movieHat.js` / `movieHatAuth.js`. Movie Hat is a **different Firebase project**, so a
Cinema Roll ID token is worthless there: Cinema Roll holds its own session in a named
Firebase app (`movieHat`) with its own Google popup. Since Movie Hat's rules went on
2026-08-17 an unauthenticated hat request is refused outright, so **never fall back to a
tokenless request** — it can only 401.

Firebase answers a rules refusal with **401 and `{"error": "Permission denied"}`**, the
same status as an unusable token. Three very different problems, one status code, and
the old code threw the body away and reported `Movie Hat responded 401` for all of them.
`MovieHatAccessError.reason` is what separates them:

- `not-connected` — no Movie Hat session on this device. Sign in.
- `token-failed` — a session exists but `getIdToken()` failed (revoked, or offline).
  Distinct from the above on purpose: telling someone they were never signed in when
  they plainly were sends them looking in the wrong place.
- `denied` — a good token the rules still refused. **Almost always the wrong Google
  account**: hat access is per member address, so being connected as a second account
  (or as `movie-hat-tester@example.com`) is indistinguishable from being signed out
  unless you name the account. `DrawFromHat` names it.

Verify with the real thing before theorising — the rules, data and membership have all
been checked correct: `yarn mint-hat-token` in the movie-hat repo, exchange it at
`identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken`, then hit the REST
API with `?auth=<idToken>`. The tester reaches Dev Hat and nothing else, which also
demonstrates the rules working.

**Read only what you need.** The hat read rule sits at `hats/$title/$hatKey`, so a child
path like `.../movies.json` needs no rule change. `ensureMovieHatContents` wants TMDB ids
only and used to call `fetchHat`, pulling whole hat nodes — history included, ~1.9MB
across Matt's six hats, one of them 882KB alone — every ten minutes, billed as egress on
Movie Hat's database. Use `fetchHatMovies`.

Note the client's `emailToMemberKey` **mirrors** `src/store/memberKey.mjs` in the
movie-hat repo, which also generates that project's rules. Change one, change both.

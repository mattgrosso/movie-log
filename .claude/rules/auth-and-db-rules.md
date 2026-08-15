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

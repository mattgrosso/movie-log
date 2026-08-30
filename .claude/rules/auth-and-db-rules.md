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

## The AI endpoint's spending caps

`aws-lambda/claude-ai.js` has two limiters, and they do different jobs.

**In-memory, per user, per minute** (`withinRateLimit`) — applies to every route. It is
per-container, so a burst spread across concurrent Lambdas slips through it and a cold
start wipes it. That is fine for what it is: a speed bump on the three routes that fire
automatically while you browse (~5k calls a day, which is why those can't carry a daily
per-person cap).

**Durable, per user AND global, per day** (`checkWatchlistQuota`) — applies to `/watchlist`
ONLY, the one route a person types into. Matt, when it was built: *"I don't wanna just
hand over my Claude prompt to just any number of users and have them abuse it... limit
usage in a way that most users won't notice, but if somebody really went crazy, they
would be held in check."*

- DynamoDB table **`cinemaroll-ai-usage`** (us-east-1, on-demand), key `pk`, TTL on
  `expiresAt`. The Lambda's role carries an inline policy `cinemaroll-ai-usage-table`
  granting only `UpdateItem`/`GetItem` on that table.
- Keys are `u#<uid>#<YYYY-MM-DD>` and `all#<YYYY-MM-DD>`. Limits: **60 per person per
  day, 800 across everyone.**
- The increment and the check are ONE conditional `UpdateItem`, which is what makes it
  safe under concurrency — two simultaneous calls cannot both see 59 and both proceed.
  A `ConditionalCheckFailedException` IS the "over limit" answer, not an error.
- It **fails open**. If DynamoDB is unreachable the request is allowed: a spending cap
  that takes the feature down when its ledger is unavailable trades a small bounded cost
  for a visible outage, which is the wrong way round. API Gateway's stage throttle is the
  backstop underneath.

**Adding a route needs THREE things, not one.** A new `route.endsWith(...)` branch in the
handler is invisible until you also add the API Gateway route and the Lambda invoke
permission — the permissions here are scoped per path (`.../*/*/watchlist`), not
wildcarded. Missing the route gives a 404 with no log line; missing the permission gives
a 500 with no log line, because the invocation never reaches the function:

```
aws apigatewayv2 create-route --api-id 2lyldox07e --route-key 'POST /watchlist' \
  --target integrations/9xdv8nl --profile personal
aws lambda add-permission --function-name cinemaroll-ai --statement-id apigw-invoke-watchlist \
  --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
  --source-arn 'arn:aws:execute-api:us-east-1:298682183644:2lyldox07e/*/*/watchlist' --profile personal
```

**Ask for structured data with a forced tool call, not with a JSON-shaped prompt.**
`/watchlist` first asked for JSON in the system prompt and prefilled the reply with
`{"movies":` to force the shape. The suggestions were good every time; reassembling the
document was what broke — the continuation sometimes re-emitted the colon
(`{"movies"::[`) and sometimes omitted the array bracket, both unparseable, and both
invisible until the raw reply was logged. `tools` + `tool_choice` has the API validate
the arguments against a schema and leaves nothing to parse. It also fixed vague prompts
("x", "one more"), which used to get a conversational reply and come back empty.

## The push Lambda (`aws-lambda/push-notify.js`, deployed as `cinemaroll-push`)

Web push notifications (2026-08-27). Same auth pattern as the AI lambda — Firebase ID
token verified with node crypto for the HTTP routes (`/push/test`, `/push/friend-logged`)
— plus a second entry mode: an EventBridge rule (`cinemaroll-push-hourly`, now
`rate(15 minutes)` — the name is historical) that runs the chore sweep with **admin**
RTDB access. Admin access
is an OAuth token minted from the service-account key (`FIREBASE_SA` env var) — no
firebase-admin dependency, the zip stays ~200KB, and the deploy needs no rules change
because everything lives under `{topKey}/push/` (owner-writable already).

**The design rule: the client computes, the server sends.** `src/assets/javascript/
pushDigest.js` publishes what's due (with FUTURE stickiness boundary timestamps so the
server counts forward in time); the Lambda only formats and sends. Never port prompt
logic into the Lambda — fix the digest instead.

**Cadence is NEWS, not STATE** (2026-08-28, Matt: notify "as the prompts come in", not
once a day). `aws-lambda/pushCadence.js` is pure, dependency-free CommonJS and owns every
send/don't-send decision; `src/test/pushCadence.test.js` imports it directly, which is
the only tested code in `aws-lambda/`. Keep it that way — the hard part of this feature
is not nagging, and it is entirely in that file.

The rule that makes frequent sweeps tolerable: a send requires something that wasn't true
last time we sent — more matured stickiness films than we've mentioned, a tiebreak where
there wasn't one, an unnamed award year. A `state/baseline` node records what's been said;
it ratchets **down** freely (so finishing chores re-arms them) and up only on a send.
Three further guards: a waking window, spacing = window / `pushesPerDay`, and **silence
while the app is open** (`digest.updatedAt` within 30 min — the prompts are already on
screen). A 24h staleness backstop re-mentions unfinished work so one ignored notification
isn't the last word. `prefs.cadence = 'daily'` restores the original single-nudge mode.

Infra (all `--profile personal`, us-east-1): Lambda `cinemaroll-push` (nodejs22.x,
role `cinemaroll-push-role`), HTTP API `8rptihkn0l` ($default → Lambda, throttle 5/10),
env vars `FIREBASE_SA`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. The
VAPID private key's only copies are the Lambda env and `.env.local`; the public half is
committed in `.env` (`VUE_APP_VAPID_PUBLIC_KEY`, with `VUE_APP_PUSH_API_URL`). Redeploy:

```
cd aws-lambda && cp push-notify.js /tmp/push/index.js   # zip index.js + web-push in node_modules
aws lambda update-function-code --function-name cinemaroll-push \
  --zip-file fileb://function.zip --profile personal --region us-east-1
```

Client pieces: `public/push-sw.js` (declarative-payload fallback renderer, pulled in via
`workboxOptions.importScripts`), `src/utils/push.js` (subscribe from a USER TAP only —
see the parallax lesson in vue-ui.md; self-heal refresh on app open), store actions
`loadPushState`/`savePushSubscription`/`savePushPrefs`/`publishPushDigest`, the
Notifications settings card in Home.vue, and the friend-log announce in RateMovie's
submit (new viewings only, never edits).

### A friend-log push and the profile publish must travel together

They are fed by different roads and only one of them is instant. The push leaves the
rater's browser the moment the save lands, reading nothing but the friend-edge graph. The
recipient's Film Club renders `social/profiles/<friend>/recent` — a **snapshot document**,
republished on `scheduleSocialPublish`'s 20-second coalescing window.

**A `setTimeout` does not survive an installed PWA being backgrounded**, and putting the
phone away is the normal end of a rating session. Seth rated Tenet at 5:21pm on
2026-08-30 and closed the app; his snapshot was last written 49 seconds *before* the
rating, Matt's phone buzzed anyway, and the Film Club had no such film — Home's six-hour
backstop (`cinemaRoll.social.lastPublish`) was the next chance, and it had just been
stamped.

So: `publishSocialProfileNow` (cancels the pending debounce, publishes, stamps) fires from
RateMovie's submit right beside `announceLoggedMovie`, and `flushSocialPublish` runs any
*pending* publish from App.vue's `pagehide` / `visibilitychange → hidden`. The flush is
deliberately a no-op when nothing is pending — backgrounding is constant, and writing a
~100KB document on every tab switch would be worse than the bug.

The invariant, guarded by `FriendLogAnnounce.test.js`: **anything that announces must also
publish.** Never notify the club about a film it cannot then show. The publish is not
awaited before `returnHome()` — the write rides across the route change, which trades one
round trip's exposure for no delay on the transition.

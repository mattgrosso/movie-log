# Tooling, Auth & Release — development history

> Archived from CLAUDE.md. Verbatim post-mortem narrative, kept for the hard-won
> detail. Durable rules extracted from this live in `.claude/rules/`.

## Tooling Health: Lint, CI, Coverage (Jun 2026)

A pass to make the green/red signal trustworthy and enforced.

- **Lint was fully broken** — `package.json` had ESLint **9** but the plugin ecosystem (`@vue/cli-plugin-eslint`, `eslint-plugin-n`, `eslint-config-standard`) is ESLint-8-era and calls removed APIs (`context.getScope`). `yarn lint` threw before linting anything. First pinned `eslint` to `^8.57.1` as a stopgap, then **completed the proper ESLint 9 flat-config migration** (see section below).
- **Fixed all 13 lint errors** surfaced once it ran (all pre-existing, none from feature work): zero-width space in a Home.vue comment; `hasOwnProperty` → `Object.prototype.hasOwnProperty.call`; **two real latent bugs** — `fetchUnratedMoviesByPerson`/`fetchUnratedMoviesByCompany` catch blocks logged undefined `director`/`company` (would throw a ReferenceError in the error path) → now log the actual params; `==`→explicit `String()===` in PersonalAwardsModal; brace-style; reserved component names (`Header`/`Footer` → `AppHeader`/`AppFooter`, updated registration + tags in `App.vue`). The 2 `Insights.vue` computed-side-effect errors (the awards-year random-default picker) are **suppressed with an inline disable + TODO**, not rewritten — that logic has a documented bug history and no coverage. ~18 unused-var **warnings** remain (non-blocking; `yarn lint` exits 0 on warnings-only).
- **CI added** (`.github/workflows/ci.yml`): runs `yarn lint` + `yarn test:run` on push to main and all PRs (Node 18, frozen lockfile). Makes green non-optional. Remote is `github.com:mattgrosso/movie-log`.
- **Coverage config fixed**: `.history/` (VS Code Local History — 1,474 snapshot files) was polluting coverage, faking an All-files number of ~1%. Added `.history/` to the vitest coverage `exclude`. Real number is **~48% stmts / 74% branch**.
- **Characterization tests added for the two biggest 0%-coverage components**:
  - `src/test/RateMovie.test.js` (13 tests, 0%→44%): weights mapping, `weightedTotal` math, rating defaults, `sortByRating`/`indexIfSortedIntoArray`/neighbors ranking, `mostRecentRating`, poster/banner URLs, viewing-tag toggle, and `returnHome`'s documented banner request.
  - `src/test/MovieDetail.test.js` (12 tests, 0%→52%): `getYear`/`prettifyRuntime`/`formattedDate`/`formatTimeDifference`, `getCrewMember` strict-vs-loose, `topStructure`, poster/backdrop custom-path selection, and the documented `goBack`/`searchFor`/`groupKeyForClickType` banner+promote behavior. **Found a latent quirk**: `formatTimeDifference`'s months branch runs to 730 days, so the `'1 year'` string is effectively unreachable (test characterizes the real output, `'13 months'` at 400 days).
- **Test setup**: `src/test/setup.js` now also stubs `window.scrollTo` (jsdom doesn't implement it; components call it in lifecycle hooks).

## ESLint 9 Flat-Config Migration (Jun 2026)

Replaced the broken ESLint-8 setup with a proper ESLint 9 flat config. **Lint no longer runs through `vue-cli-service`** (that path, via `@vue/cli-plugin-eslint`, was the thing incompatible with ESLint 9). `yarn lint` = `eslint .`, `yarn lint:fix` = `eslint . --fix`.

- **Config: `eslint.config.js`** (flat, CommonJS — the project isn't `type: module`). Composes `@eslint/js` recommended + `eslint-plugin-vue` `flat/essential` (flat configs default to Vue 3; the key is `flat/essential`, NOT `flat/vue3-essential` which is eslintrc-only) + `eslint-plugin-promise` `flat/recommended` (a single object, not an array — don't spread it). The old `eslintConfig` block in `package.json` is removed.
- **Dropped the `standard` preset** (`@vue/eslint-config-standard@8` + transitive `eslint-config-standard@17` / `eslint-plugin-n@15` — unmaintained, eslintrc-only, and the source of the original `context.getScope` crash). Also removed orphaned `@vue/cli-plugin-eslint`, `eslint-plugin-import`, `eslint-plugin-node`, and `@babel/eslint-parser` (unused — the default parsers handle all `.vue`/`.js`). Added `eslint@^9`, `@eslint/js@^9`, `globals@^15`.
- **Pinned to ESLint 9, NOT 10**: ESLint 10 / `@eslint/js@10` require Node ^20.19; the repo runs Node 18.18 (CI uses Node 18). ESLint 9 supports Node 18.18. Bumping to Node 20 later is the prerequisite for ESLint 10.
- **Zero formatting churn**: the codebase was already `standard`-compliant (the earlier repo-wide `--fix` ran under standard), so reproducing standard's *rule options* (not just severities) kept everything clean. Key gotcha: bare severities use ESLint *defaults*, which differ from standard — had to set `indent: ['warn', 2, {SwitchCase:1}]`, `padded-blocks: ['warn','never']`, `object-curly-spacing: ['warn','always']`, `brace-style: ['warn','1tbs',{allowSingleLine:true}]` to match. The carried-over rules + a few re-added correctness rules (`eqeqeq` smart, `no-var`) live in the config.
- **`aws-lambda/` is ignored** (separate deployable, 4-space style, never linted before — the old `vue-cli-service lint` only covered `src/`). Flat-config `ignores` also covers `dist`, `coverage`, `.history`, `public`, `registerServiceWorker.js`.
- **Result**: `eslint .` → **0 errors, ~40 warnings** (38 pre-existing `no-unused-vars` + 2 non-auto-fixable `prefer-const`, all `warn` severity as before). Warnings don't fail CI; `yarn lint` exits 0. 318 tests still pass.

### Test suite assessment (for future reference)
Strong, trustworthy wall around the **algorithmic core** (`searchFiltering.js` 98%, rating calc, favorites scoring, tags/keywords/awards utils 100%, Home.vue 62%). Still **0% on**: `Insights.vue` (3071 lines), `LetterboxdScrapingService.js` (817), `YearInReview`, `Outliers`, `Header`/`Footer`, `ShareDBResults`. Tests are heavily **mock-based mounts of Home/components** — the hand-rolled store mocks can drift from the real store shape (see the documented mock-fix in GroupOrdering). Next coverage targets if continuing: Insights, then the Letterboxd scraping service.

## In-App Bug Reporting (Jul 2026)

Ported the "report a bug without breaking your flow" pattern from the thunderstone/space-base repos, adapted to Cinema Roll's Vuex store and single Firebase project.

- **`src/components/BugReportButton.vue`** — a fixed circular button, bottom-right (`z-index:1200`, respects `env(safe-area-inset-bottom)`), rendered globally from `App.vue` (always visible, every screen, not gated on login state). Tap opens a small dark-themed panel: textarea + Cancel/Send. No hover state (mobile-first, `:active` only).
- **`src/utils/bugReports.js`** → `submitBugReport(store, transcript, route)` writes to Firebase RTDB at `bugReports` (top-level — this project's RTDB isn't shared with another repo, so no namespacing needed, unlike thunderstone/space-base's `spaceBaseBugReports`). No anonymous-auth dance either: `database.rules.json` is already wide open (`.read`/`.write: true`), matching the rest of the app's data. Captures transcript, `reporterEmail` (`store.state.userEmail`), URL, userAgent, screen size/DPR, and a small `appState` JSON summary (route, `dbLoaded`, movie count, current sort/search/chip state) — deliberately NOT the whole `movieLog` (privacy + RTDB payload size).
- **Triage scripts** (Firebase Admin SDK, bypasses the open client rules): `yarn fetch-bug-reports` (prints unresolved reports newest-first, `--all` for everything) / `yarn resolve-bug-report <id...>`. Both read `FIREBASE_ADMIN_KEY_PATH` from `.env.local` (gitignored) via Node's `--env-file`; the databaseURL is hardcoded to match `store/index.js` (one Firebase project, nothing to configure per environment). Needs a service-account key from Firebase Console → Project Settings → Service Accounts.
- **`firebase-admin` is pinned to `^12.7.0`**, not the latest (`^13`) — v13 pulls in `@firebase/database-compat@2.1.4`, which requires Node ≥20; this repo's CI/dev environment runs Node 18.18 (same constraint documented under the ESLint 9 migration). Revisit once the repo moves to Node 20.

Tests: `src/test/bugReports.test.js` (report shape, empty-transcript guard, reporterEmail fallback), `src/test/BugReportButton.test.js` (open/close, disabled-until-text, success/error paths).

## Semantic Versioning (Jul 2026)

`src/assets/javascript/version.js` (run via `yarn update-version`, which `yarn build`/`yarn deploy` always run first) used to ALWAYS default to a PATCH bump when run non-interactively — there's no TTY for an agent-run build to press 2/3 at, so every single agent-triggered deploy silently incremented the patch number regardless of what actually shipped, no matter how large. This went unnoticed long enough that the patch number reached 100+ under one minor version before being caught.

- **Fix**: `VERSION_BUMP=minor` (or `major`/`patch`) as an env var on the build command now skips the interactive prompt and applies that bump directly — e.g. `VERSION_BUMP=minor yarn deploy`. Omitting it preserves all prior behavior exactly (interactive TTY prompt if available, PATCH default otherwise) — the user's own local `yarn build`/`yarn deploy` runs are unaffected.
- **Going forward, apply real judgment when triggering a build/deploy**: PATCH for bug fixes/tweaks (the large majority of day-to-day work), MINOR when something shipping is a genuine new user-facing capability (a new game, a new app section, a feature like offline support or in-app bug reporting — a lot of which had been landing as silent patches before this fix), MAJOR only for an actual breaking change (rare for a personal app like this one). When in doubt between patch/minor, lean patch — the user can always request an explicit minor bump for something retroactively.

## Sign-in Beyond Google + Locked-Down Database Rules (Aug 2026)

Bug report: *"I'd like to enable sign-in by other methods. I assume I will need to enable things in firebase but can you do everything else so that folks who don't have Gmail can use the app?"* Asked which providers via `AskUserQuestion` (answer: **both** email/password and Apple) and whether to tighten the wide-open database rules at the same time (answer: **yes**), since opening sign-up more widely materially changes that risk.

### The constraint everything else follows from
**A user's entire library is keyed by their email address** — `databaseTopKey` is the email with ~30 characters replaced by `-` (`mattgrosso@gmail.com` → `mattgrosso-gmail-com`). So any new provider must return a stable email, which rules out anonymous sign-in entirely and makes Apple's "Hide My Email" fine (its relay address is stable per-app).

- **`src/assets/javascript/databaseKey.js` (new)** — `emailToDatabaseKey()`, now the single source of truth. It was previously an inline `replaceAll(...)` duplicated in the `setDatabaseTopKey` mutation AND the login action; identical then, but nothing kept them that way and the whole security model now rests on them agreeing.
- **It deliberately does NOT lowercase.** An early draft added `.toLowerCase()` — which would have silently re-keyed every existing account whose address contains an uppercase character, pointing it at an empty database. Case is normalized in the login FORM instead (`normalizedEmail`), so new sign-ups are consistent without touching existing keys. Pinned by a test.
- **`src/assets/javascript/databaseKeyCharacters.json` (new)** — the character list lives in JSON, not JS, so the rules generator (a plain Node script, which can't import an ES module in this non-`type: module` package) reads **the same bytes** rather than keeping a hand-maintained copy in step. A first attempt regex-scraped the array out of `databaseKey.js` and broke immediately: the list contains `','`, so splitting on commas destroyed it.

### Providers (`src/store/index.js`)
Every method funnels through one shared **`completeLogin(user)`** action that derives the key, persists it, boots the database, and routes home — no provider gets to do that its own way. It **throws** rather than proceeding if a provider returns no email, because silently dropping someone into an empty, wrongly-keyed database is much worse than refusing the sign-in.

- `loginWithGoogle` (`login` is kept as an alias so existing callers work), `loginWithApple` (an `OAuthProvider('apple.com')` — the `email` scope is **required**, without it no address comes back), `loginWithEmail`, `signUpWithEmail`, `sendPasswordReset`, `logout`.
- **Latent bug fixed on the way through**: the old login action called `context.dispatch('setDatabaseTopKey', ...)`, but that only ever existed as a **mutation** — so it was a silent no-op, `state.databaseTopKey` stayed null through login, and `initializeDB` (which early-returns without a key) did nothing. It only worked at all because the router guard re-read the key from localStorage on the very next navigation and committed it there. Now committed directly, so the flow is correct rather than accidentally correct. Regression-tested.
- `signUpWithEmail` also fires `sendEmailVerification` (fire-and-forget, **not enforced anywhere yet**) — groundwork for tightening later without blocking sign-ups now. What actually stops someone registering an address that's already in use is Firebase's **"one account per email address"** setting; confirm it's on.
- **`logout` is new** — there was no sign-out anywhere in the app, which was fine when it was one Google account and is not fine now that people can create accounts. Added to Home's settings panel under a new "Account" heading, with "Signed in as …". The raw email is now stored in localStorage alongside the sanitized key purely so that line survives a reload (the key can't be turned back into an address).

### Auth state actually being observed (the prerequisite for tightening rules)
Two things were true and invisible while the rules were open, and would have been hard failures the moment they weren't:

1. **`getAuth()` was only ever called inside actions.** The Realtime Database SDK picks up its auth-token provider from whatever is already registered on the app when it initialises — if Auth has never been instantiated, it just sends **unauthenticated requests**. `getAuth()` now runs at module load, before `getDatabase()`.
2. **`loggedIn()` never checked Firebase Auth at all** — it decides you're signed in synchronously from `localStorage`, and there was no `onAuthStateChanged` listener anywhere. Firebase restores a persisted session *asynchronously*, so listeners could attach before the token existed. New exported **`authReady`** promise (settled by the first `onAuthStateChanged` callback) is awaited by `initializeDB`. Deliberately not *gated* on the result — the offline IndexedDB-snapshot path has to keep working with no live session.
3. New **`verifyRestoredSession`** action (dispatched from `App.vue`'s `mounted`, fire-and-forget) reconciles the two: a stored key with no Firebase session means the session was revoked/expired/signed-out-elsewhere, so it signs out cleanly instead of showing an empty library with no explanation. Only acts when online. **Watch for**: this can produce an unexpected one-off re-login for anyone whose Firebase session was evicted (Safari ITP, etc.) while their localStorage key survived — correct behaviour, but new.

### Database rules — GENERATED, and NOT deployed by `yarn deploy`
`database.rules.json` was `{".read": true, ".write": true}` — anyone could read or write anyone's data given the key.

- **`scripts/generate-database-rules.mjs` (new, `yarn generate-db-rules`)** writes `database.rules.json`. The rules language has no regex, only `String.replace(substring, replacement)` (which replaces *every* occurrence, unlike JS's single-string `replace`), so the email→key transformation has to be a ~29-call chain. Generating that chain from the shared character list is the only way to keep it provably in step with the app.
- Grants, all narrow, on a deny-by-default root: `$topKey` read/write only when `$topKey` equals the sanitized `auth.token.email`; `$topKey/sharedDBSearches/$shareKey` publicly readable (the `/share/:userDBKey/:shareKey` route is explicitly `requiresLogin: false`) but **not** the list of which shares exist; `bugReports` write-only-by-anyone (the report button renders on the login screen, before any session) and readable by nobody (triage uses the Admin SDK, which bypasses rules); `testing-database` (the dev-mode sandbox) scoped to the owner key, matching the `isMatt` check that already hardcodes it in `Home.vue`.
- **`src/test/databaseRules.test.js` is the load-bearing test**: it reads the *generated* file, extracts the replace chain, applies it in JS (with `replaceAll` — using `replace` would let it pass against rules that are actually wrong) and asserts byte-identical output to `emailToDatabaseKey` across nine emails including apostrophes, plus-addressing, mixed case and an Apple relay address. It also asserts the chained character set exactly equals the shared list minus `-` (a provable no-op).

**DEPLOY ORDER MATTERS — do not deploy rules and app together.** `yarn deploy` does *not* touch rules (`firebase deploy --only database` is separate), and that separation is deliberate:
1. Ship the app first. It is safe under the current open rules.
2. Enable **Email/Password** in the Firebase Console (Authentication → Sign-in method). Apple additionally needs a paid Apple Developer account + a configured Service ID; until that's done, leave `VUE_APP_ENABLE_APPLE_SIGNIN` unset so the Apple button doesn't render and nobody taps a dead control (`auth/operation-not-allowed`).
3. Verify sign-in works and the library still loads (i.e. requests now carry a token).
4. **Only then** `npx firebase deploy --only database`. Deploying restrictive rules while older clients are still live — and the PWA can serve a cached build for a while, see the iOS notes above — would show those clients an empty library.

Tests: `databaseKey.test.js`, `authErrors.test.js`, `authActions.test.js`, `databaseRules.test.js`, rewritten `Login.test.js`. **`src/test/setup.js` now globally mocks `firebase/auth`** — with `getAuth()` at module load, every test file that imports the store even indirectly otherwise hits Firebase Auth's *Node* build and throws. Its `onAuthStateChanged` mock **must invoke its callback**, or `authReady` never settles and `initializeDB` hangs forever; the three test files with their own `firebase/auth` factories override the global one and each needed the same treatment.

### Onboarding flash on fresh load (Aug 2026)
Bug report right after the sign-in work shipped: *"there is a brief moment on a fresh load when it shows me the 'want help getting started?' messaging. I should never see that. That's for new users only."*

Until the library arrives, `userRatedMovieCount` is 0 — **indistinguishable from a genuinely new account** — so `isBrandNewUser` was briefly true for everyone on every load. Two of the three places that key off it (the welcome text, the 1-9-rated tap-through button) already guarded on `$store.state.dbLoaded`; the third, `shouldShowStartSuggestions` (which renders the suggestions component itself), did not. Pre-existing, but the window widened materially when `initializeDB` started awaiting `authReady`, which is why it only became visible now.

Fixed at the concept rather than by adding a third call-site guard: `isBrandNewUser` now means "the library has loaded AND it's empty." The other two guards are now redundant but harmless. Tests: a `while the library is still loading` describe block in `NewUserOnboarding.test.js` (nothing renders pre-load; both appear once `dbLoaded` flips) — verified as a genuine regression guard by reverting the fix and watching both fail. The test harness's `mountHome` gained a `{ dbLoaded }` option and now returns its mock store so a test can flip that flag the way real loading does.

## Two bug reports + a broken admin script (Aug 2026)

### The Games button did nothing — a permanently self-perpetuating dead button
Report: *"the games button isn't working. I can click on other things but the games button does nothing."*

**Root cause: `goToGames()` validated only that the stored path STARTS WITH `/games/`, never that the route still exists — and there is no catch-all route.** Confirmed live against the deployed build: navigating to `/games/rate-off` (removed in Jul 2026) changes the URL and renders **nothing** — header over a blank page, no error, no login redirect. `/games/quiz` (Taste Quiz) was deleted the same way.

**What made it nasty rather than cosmetic:** `LAST_PLAYED_KEY` is only ever overwritten by successfully visiting *another* game — which this button is the way you'd reach — and only cleared by visiting the hub, which the button also wouldn't take you to. So once it pointed at a removed game it could never heal on its own.

Fixed in two layers, deliberately both:
- **`lastPlayedGamePath(router)`** (new, in `gameData.js`, shared by `goToGames` and `gamesButtonIcon`) returns the stored path only if it still exists, and **clears a stale value on the way out** so the button self-heals. Checks `router.getRoutes()` for an exact path match rather than `router.resolve()`, which now *always* matches because of the catch-all below.
- **A catch-all route** (`/:pathMatch(.*)*` → redirect `/`). The blank-page-on-unmatched-path behaviour was never specific to games — any stale bookmark or old link hit it.

**Test-harness note:** `GamesNavigation.test.js`'s mock `$router` was `{ push }` only; it now needs a `getRoutes()` that deliberately OMITS the removed games, which is the seam the bug lived in. A mock that returns every path would pass against the broken code.

### `.end-actions` sat flush against the revealed poster
Report: *"When you win in real Wordle, we need a little bit of padding above the new game or back to games button."* The shared `.end-actions` rule (`_game-buttons.scss`) had `margin: 0 auto` — no top margin — so in Wordle it butted straight up against `.reveal-poster`. Fixed once in the shared partial (`margin: 1rem auto 0`) rather than per-game, since all 8 games use it and several others also follow it with a poster.

### `yarn fetch-bug-reports` / `yarn resolve-bug-report` were unrunnable
Both used Node's native `--env-file` flag, which needs **Node 20.6+** — but this repo is pinned to **18.18** (`.tool-versions`, and CI's `node-version: 18`, for the reasons already documented under the ESLint 9 and `firebase-admin` notes). They failed outright with `bad option: --env-file`. Replaced with **`scripts/loadEnvLocal.mjs`**, a few lines that parse `.env.local` directly (a real env var still wins, so a one-off override works). Deliberately not a `dotenv` dependency for one gitignored file read by two scripts.

**If an admin script ever hangs for minutes with no output, check the `databaseURL` first** — a wrong one (this project is `movie-log-8c4d5`, and the service-account key's `project_id` confirms it) doesn't error, it just retries the connection forever.

### Verifying an authenticated write without signing in (Aug 2026)
Automated sessions can't sign in, but they *can* run the app against `testing-database` end-to-end **while the DB rules are still open**:

1. Load the app once and let it mount.
2. `localStorage.setItem('databaseTopKey', 'testing-database')`. The router's `loggedIn()` guard reads only that key — no Firebase token is involved, and with `devMode` false the `databaseTopKey` getter returns it directly, so the whole app runs against the sandbox branch.
3. Navigate by **hash only** (`location.hash = '#/'`). Do NOT reload: `verifyRestoredSession` runs in `App.vue`'s `mounted` and correctly wipes a stored key that has no matching Firebase session, which sends you straight back to `/login`.
4. Drive the real UI, then verify **server-side** with the Firebase Admin SDK against `testing-database/...` rather than trusting the DOM.
5. Clean up: revert any sandbox mutation and clear the key.

Used this to close the one gap the unit tests couldn't: that a real whole-entry write through the live client SDK stamps `updatedAt` with a server number, advances it past the prior value, and leaves `ratings` an array / `crew` intact / no `dbKey`-`_search` junk written back.

**This stops working the moment the locked-down rules deploy** — `testing-database` then requires `auth.token.email` sanitized to equal the branch name, so it needs a real session plus the in-app dev-mode toggle. Worth doing any authenticated-write verification BEFORE that deploy.

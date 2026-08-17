# Mixed Bug-Report Rounds — development history

> Archived from CLAUDE.md. Verbatim post-mortem narrative, kept for the hard-won
> detail. Durable rules extracted from this live in `.claude/rules/`.

## Five more reports (Jul 2026): tiebreak flash, Clue Budget feedback + rating clue, daily-win checkmarks, Connections award name

### The tiebreak flash — a real regression from the offline-support extension the day before
Bug report: "After I break a tie, I get the tie break message again just for a second or two. But it's annoying because it's just long enough that I try to click on it."

**Root cause, and why it was NEW**: `writeDurably` (added the previous day, see the Offline Support Extension section) did `await enqueueWrite(...)` **before** issuing the Firebase `set()`. `enqueueWrite` opens IndexedDB, scans the WHOLE pending queue for its path-dedupe, then writes — real, variable latency. A tiebreak fires several `writeDurably` calls back to back (`settings/tieBreakTournament`, N× `movieLog/<key>` score adjustments, `settings/lastTweak`), so an early write could reach the server and bounce an `onValue` snapshot back **while a later write hadn't even been sent yet**. Both listeners commit their branch WHOLESALE (`setSettings`/`setMovieLog`), so that snapshot — which legitimately predated `lastTweak` — clobbered the already-committed local value, `Date.now() - lastTweak` went back over the quota threshold, and the "You have a tie to deal with" notice re-rendered until the real `lastTweak` write finally landed. The pre-1.25.0 `setDBValue` path never had this window because it called `set()` immediately (Firebase's own client cache then included the pending write in every subsequent snapshot it fired).

**Two-part fix**:
- **Don't serialize the network write behind IndexedDB.** `writeDurably` now kicks off `enqueueWrite` and the network write together (`const queuedPromise = enqueueWrite(...)`, awaited later) rather than awaiting the enqueue first. Durability is unchanged — the IndexedDB record still lands regardless of what happens to the network write — the network write just no longer inherits IndexedDB's latency.
- **New `state.inFlightWrites` ({path: value}) + `trackInFlightWrite`/`untrackInFlightWrite` mutations + the `reapplyInFlightWrites(state, rootKey, data)` helper.** A write is tracked from its local commit until the server settles it (success OR failure — the durable queue owns retries either way), and **both** `onValue` listeners now re-top the incoming snapshot with anything still in flight before committing it. This closes the whole CLASS of "a snapshot that predates my just-made change briefly reverts it," not just the tiebreak instance — the movieLog listener gets the same treatment since a tiebreak's score adjustments are movieLog writes. The raw server data is still what gets written to the offline IndexedDB snapshot (`saveSnapshot`), only the in-memory state is re-topped. `untrackInFlightWrite` runs in a `finally` that also covers the offline early-return, so `inFlightWrites` can't grow unboundedly across an offline session.
- Tests: `flushPendingWrites.test.js`'s new `in-flight writes are not clobbered...` describe block. The firebase mock now **captures the real `onValue` callbacks** (`fireSnapshot(branch, data)`) so the listener's own clobber-protection is genuinely exercised rather than testing the private helper directly. **Verified as a real regression guard** by temporarily reverting the listener fix and confirming the key test fails with exactly the bug's signature (`expected 100 to be 999`).

### The other four
- **Clue Budget: a wrong guess said nothing** ("if I guess wrong it should say so. There's no real feedback right now") — `submitGuess` silently did nothing on a miss, indistinguishable from a tap that didn't register. Added `lastGuessFeedback` ("Not {title}. Try again."), rendered in an always-present `.guess-feedback` element toggled by `visibility` (not `v-if`) with a reserved `min-height`, so it can't reflow the clue shop below — same anti-layout-jump convention Connections' own guess feedback uses. Cleared on the next keystroke. **Guesses remain free** — this game charges for CLUES, not guesses — and there's a test asserting the budget is untouched by a wrong guess.
- **Clue Budget: "Your Rating" is now a buyable clue** (user request). Comes in through `extras.yourRating` rather than being read off the entry, because computing a rating needs `GetRating.js` + the Vuex weight getters, which this store-free module can't reach (same reason `tagline` comes in that way). Seeded into `liveExtras` synchronously at round start, so it's offered on the very first render with no network round trip. **Flat-priced at $12, deliberately**: unlike the person/keyword/company clues there's no TMDB signal to scale against, and how identifying a given score is depends entirely on the shape of the player's own library (a 9.4 narrows hard, a 6.5 barely at all) — a fake curve would be worse than an honest fixed cost. Guarded with `Number.isFinite`, which correctly offers a legitimate `0` rating but skips an unrateable entry. **Test-fixture note**: `ClueBudgetGame.test.js` now mocks `GetRating.js` — its fixtures carry only a `calculatedTotal`, not the individual criteria the real weighted math needs, so the real `getRating` returns `NaN` for them (which the guard correctly refuses to offer). Discovered by the test failing exactly as designed.
- **GamesHub: a checkmark on each game won today** ("I don't want to limit the number of times I can play a game in one day but it would be nice to have a checkmark on the game if I've won a game of that today... then I'll be able to play each one each day and feel satisfied"). Explicitly a marker, never a gate — there's a test asserting a won game is still tappable. New `gameWinKey(routePath)` (route's last segment) + `todayStamp()` (`toDateString()`, matching `settings/dailyAwardsYearDate`'s existing convention) exported from `gameData.js` and used on BOTH sides (the game recording, the hub reading) so they can't drift. `recordGameWin()` on the mixin writes `settings/games/wins/<key>` via `writeDurably` (offline-safe) and skips a redundant write if today is already stamped. **A stamp that isn't today's simply reads as "not won today"** — nothing to expire or clear.
  - **The judgment call, documented in-code**: the five games with a discrete win state (Wordle/Connections/Six Degrees/Clue Budget/Trivia) are unambiguous, but the three endless streak games (Higher or Lower/Timeline/Tag) never "finish" — one correct answer counts there, since the point of the checkmark is "I played this today and did something," not a difficulty gate.
  - **Wiring differs by game shape**: Wordle/Connections/Six Degrees derive `status` as a COMPUTED, so there's no imperative win moment to hook — they get a `watch: { status }`. The rest call `recordGameWin()` inline at their existing win/streak-increment point.
  - `recordGameWin` derives its key from `this.$route`, which **no pre-existing game test mocks** — so it silently no-ops in all of them (nothing broke), and the new tests in `TriviaGame.test.js` add `$route` explicitly.
- **Connections: the personal-award label said "(Personal)"** — a generic internal string. Now uses the user's own award name via `awardNameWithThe` (e.g. "Won Best Picture (The Groskers)"), threaded through as `awardsData.personalAwardName`. Per the report, the setting's own instructions tell the user to pick a name that reads naturally after "the", so prefixing is safe. Note the DEFAULT is `'Oscar'` (singular) → "(The Oscar)", not "(The Oscars)" — the existing tests were updated to pass an explicit `personalAwardName` and assert the real reported behavior, with one dedicated test pinning the default fallback.

## Five reports (Aug 2026): Six Degrees follow-ups, stickiness advance, bug-button move, and a diagnostics gap

- **Six Degrees: "I still don't see a way to reveal the shortest path after I find my own path."** My own over-engineering from the day before: `canShowComparison` also required `optimalHops < hopsSoFar`, i.e. it HID the button whenever the player matched the optimum, on the reasoning that there'd be nothing "could've been" to show. Wrong on two counts — matching the shortest path is precisely when you want it confirmed, and from the player's side an absent button is indistinguishable from a broken one. Condition dropped; the button now shows after every win, and a new `comparisonLabel` computed says which case it is ("You found it — the shortest path was also N hops:" vs "The shortest path was N hops:").
- **Six Degrees: "the scrolling is better but it should scroll so that I can still see my most recent addition."** The first cut scrolled to `scrollWidth` — but the chain row does NOT end at the newest entry: the "?" placeholders and the goal poster all sit AFTER it, so scrolling fully right pushed the thing the player just added back off the left edge. `scrollChainToEnd` now finds the newest REAL entry (each interactive, non-goal, non-placeholder step carries a `data-chain-index`) and scrolls only far enough to bring its right edge into view plus a `SCROLL_MARGIN_PX` margin — and returns without scrolling at all when it's already visible, so it can't yank the row around. Falls back to the old `scrollWidth` behavior if the element can't be found.
- **Stickiness: "after each one it should just immediately take me to the next."** Two things were in the way. (1) The entire save block sat behind a **2-second `setTimeout`** — a holdover from when the write had to round-trip before local state caught up; `writeDurably` commits locally first, so that was pure dead time between every entry. Removed. (2) Advancing relied on `showStickinessInline` merely never having been set false, so anything that knocked it back (a remount, a transiently-empty list) dumped the user on the notice banner with no way forward but tapping it again. Staying on the form is now asserted explicitly (`if (resultsThatNeedStickiness.length) showStickinessInline = true`), and the panel only collapses once the queue is genuinely empty. The `dbEntry` is also now built BEFORE the dispatch, since `writeDurably`'s synchronous local commit means `firstStickinessResult` already points at the NEXT movie the moment it's called.
- **Bug button moved to the bottom LEFT** (`.bug-report-trigger`, `right: 1rem` → `left: 1rem`). The panel itself is a centered overlay with no side anchoring, so nothing else needed to move.

### The one that couldn't be reproduced — and the diagnostics fix it prompted
Report: "I just navigated from the Wordle game by clicking on the banner of the header and return to the home screen where I see the banner image but the entire list of movies is empty." **Not reproduced** despite walking the exact path live (Home → scroll → Wordle → banner → Home) — the list rendered normally.

What the investigation DID establish is a real defect in the reports themselves: `buildAppStateSummary` (`bugReports.js`) was reading `homePageSearchValue`/`homePageSearchChips`/`homePageNumberOfResults` — the **persisted navigation** fields that `Home.mounted()` explicitly CLEARS as part of its restore. So a report filed from Home will show an empty search and no chips *no matter what is actually filtering the list*, which is exactly why this one was undiagnosable: nothing in the snapshot could distinguish "no results matched the active filter" from "the list failed to render". (`numberOfResultsShown` is the one field NOT cleared, so it reflects whenever Home was last left — also misleading if read as current.)

Fix: Home now publishes a small live summary (`liveDebugState` computed → `setHomePageLiveState` via an `immediate` watcher) covering the active quick link, typed search, chips, results rendered vs matched, library size, `numberToShow`, whether the grouped view is active, and the sort. `bugReports.js` includes it as `homeLive`, with the old fields kept (and now commented) for continuity with older reports. Purely diagnostic — nothing reads it for behavior, and it's never persisted. **If this report recurs, `homeLive` should immediately say which of the two it is.**

**Fixed in a follow-up (same day):** navigating from Home directly to a game route left the game page inheriting Home's scroll position — Reel Wordle opened scrolled halfway down its own page. `GamesHub.selectGame` had worked around this with its own `window.scrollTo(0)` before pushing, which covered exactly ONE entry path (a hub tile) and missed every other way into a game: Home's Games button, `BackLink` between the hub and a game, a deep link, the header banner.

Replaced with a router-level `scrollBehavior` (`src/router/scrollBehavior.js`, wired in `router/index.js`), **deliberately scoped to `/games*` only** — it returns `{top: 0}` for game routes and `false` (leave the scroll alone) for everything else. That scoping is the whole point: the app has never had a global scrollBehavior because `Home.vue` does its own scroll restoration (returning from a movie's detail page puts you back exactly where you were in the grid), and a blanket scroll-to-top would fight it. `selectGame`'s manual `window.scrollTo` was REMOVED rather than left as belt-and-suspenders, so there's exactly one mechanism. **`behavior: 'instant'` in the returned position is REQUIRED, not cosmetic** — and a first cut of this shipped WITHOUT it and did nothing at all. The app sets `scroll-behavior: smooth` on `<html>`, and with that in effect a plain `window.scrollTo({top: 0})` is a **silent no-op in this app** (verified live: position stayed put, and a `window.scrollTo(0, 300)` didn't move either, while the identical call with `behavior: 'instant'` worked immediately). Vue Router passes whatever `scrollBehavior` returns straight through to `window.scrollTo`, so the override belongs in the returned object. The GamesHub workaround this replaced happened to pass `{top: 0, behavior: 'instant'}`, which is exactly why IT worked — worth remembering for any future programmatic document scroll in this app.

**This turned out to be a much wider latent bug, found while verifying the above.** `document.documentElement.scrollTop = 900` is ALSO swallowed by the same CSS (the `scrollTop` setter honours the element's scroll-behavior) — and that assignment form is exactly what `Home.vue` used for its scroll restoration. So Home's "returning from a movie's detail page puts you back exactly where you were in the grid" had been **silently doing nothing**, on a 1300+ movie library. Verified live: setting `scrollTop = 900` left the position at 0. Fixed by routing all four of Home's document-scroll sites through a new `src/utils/scrollWindowTo.js` (`window.scrollTo({ top, behavior: 'instant' })`), which carries the full list of what does and doesn't work as its own comment. **Rule for this codebase: every programmatic document scroll must pass an explicit `behavior`** — `'instant'`, or `'smooth'` if animation is genuinely wanted (that path works; it's only the INHERITED CSS behaviour that fails). Tests: `src/test/scrollWindowTo.test.js`.

**And behind THAT was a second, independent bug in the same feature** — found because fixing the CSS issue still didn't make restoration work. `mounted()` deferred the restore into a `$nextTick` callback that read `this.$store.state.homePageScrollPosition`, but the "clear stored state after restoring" block a few lines below sets that to `0` **synchronously** — i.e. always before the deferred callback runs. So the `> 0` guard was false every single time and the page never moved. Fixed by capturing the value into a local const before the clear. **Net: Home's "put me back where I was in the grid" had two stacked defects and has apparently never worked**; either one alone was enough to break it, which is presumably why it went unnoticed for so long. Extracted as a pure function specifically so it's unit-testable — importing the real router pulls in `store/index.js` and initialises Firebase at module load, which is why nothing else in `router/index.js` has tests. Tests: `src/test/scrollBehavior.test.js` (hub, individual games, every other route left alone, malformed input); `GamesHub.test.js`'s old "scrolls to top before navigating" test inverted to assert the component does NOT scroll itself.

Tests: `SixDegreesGame.test.js` — the scroll tests rewritten around a stub row exposing `querySelector`/`getBoundingClientRect` (asserting it scrolls just far enough, and NOT at all when the newest entry is already visible), and the old "does NOT offer it when they matched the optimum" test inverted to assert the button now shows with the "You found it" label.

## The watchlist learning loop had been dead since its first run (Aug 2026)

Spotted in the console while working on something else, then fixed on request:

```
TypeError: (t || []).map is not a function
  at reconcileWatchlistLearning
  at buildWatchlists (watchlist.js)
```

`reconcilePending` opens with `(ratedTmdbIds || []).map((id) => String(id))`. Its one
real caller, `WatchlistScreen.buildWatchlists`, builds that argument with
`discover.js`'s **`ratedTmdbIds()`, which returns a Set** — as it should, since every
other consumer (`rankWatchlistCandidates`, `moviesFromPeople`, `hiddenGems`…) wants
`.has()`. A Set has no `.map`.

**Why it survived:** every existing test in `recommendationStats.test.js` passed an
array. The module was well covered and the coverage was of a shape nothing in the app
ever passes it.

**Why it was worse than a console error.** The sequence:

1. First ever watchlist visit — `pending` is empty, so `reconcileWatchlistLearning`
   returns early at its `if (!learning?.pending) return` guard, never reaching the
   crash. `recordWatchlistSuggestions` runs and writes `pending`.
2. Every visit after — `pending` now exists, `reconcilePending` throws, `buildWatchlists`
   rejects, and because the two dispatches were bare sequential `await`s,
   **`recordWatchlistSuggestions` never ran again.**

So the loop froze after one pass: no source was ever credited with a hit, and no new
suggestion was ever recorded. The lists themselves were fine — they're assigned before
the learning block — so there was nothing user-visible but the console entry, which is
exactly why it sat there.

Two fixes, because the type error and the fragility are separate bugs:

- `Array.from(ratedTmdbIds || [], String)` in `reconcilePending` — works on a Set, an
  array, or anything iterable.
- **The two dispatches are now guarded independently** in `buildWatchlists`. This is
  best-effort bookkeeping that runs after the page is already rendered; neither step
  should be able to take the other down, or fail the screen.

Verified live: the error is gone on the fixed bundle, and the loop immediately recorded
103 pending suggestions with per-source `suggested` counts across all five sections —
data it had never managed to write. (`hits` stay empty until one of those is rated,
which is correct.)

## Film Club round, the morning Brian's interop landed (Aug 2026)

Five reports, all from one sitting on `/film-club` — Movie Log users had just started
appearing in Cinema Roll. Four fixed here; the fifth ("what sort of visualizations can we
come up with?") is a design question, not a defect.

### The feed dead-ended on anything you hadn't seen

*"Clicking a poster on the recent friends feed takes me to that movie in my db. But if I
haven't seen that movie, it should instead take me nowhere. But we should have the
universal 'add to hat' button on it."*

MovieDetail is a **pure local lookup** — deliberately, see
`.claude/rules/detail-and-insights.md` — so a friend's film you've never rated rendered
an empty page. Now the tap is gated on `ratedTmdbIds`, and anything outside your library
carries a `SendToHat` icon and a "Not in your library" label instead. A feed item is a
bare `{id,t,p}` rather than a library entry, so `hatMovieFor` maps it onto the TMDB field
names `toHatMovie` reads.

### Hat movies now say where they came from

*"We should include a note on that hat movie that explains where it came from so it could
be a friendly recommendation... use plain language to label why that movie went into the
hat."*

`toHatMovie` had accepted a `note` since the integration landed and **nothing ever passed
one**. Threaded through: `SendToHat` gained a `note` prop, `addToMovieHat` forwards it,
and every call site supplies plain language — "Worth a rewatch", "From a director you
love", "Filling out 2019", "Loved by the film club", "Brian watched this (8.3)".
`addedBy` already says who; the note says why.

### The other two

- **Feed size**: published `recent` 20 → 40, the merged feed 30 → 60, and the feed row's
  posters run larger than the other rows' (116px against 92px). Friends only get the
  longer feed once they republish.
- **Friend rows**: were a name, a title count and a chevron. Now titles, how many films
  you've both rated, how closely you agree, when they last watched something, and four
  posters of what that was. `friendSnapshot` is deliberately **not** `compareWithFriend`
  — that returns twelve-item disagreement lists, shared loves and per-criterion gaps, all
  of it discarded by a row; this walks the overlap once for the two numbers shown. It
  reuses the same alignment definition (10 − mean absolute gap) so a row and the page it
  opens can't disagree.

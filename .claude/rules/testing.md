---
paths:
  - "src/test/**"
  - "vitest.config.js"
---

# Testing rules

Run with `yarn test:run`. **Never run `yarn serve`** — see CLAUDE.md.

Coverage is strong on the algorithmic core (`searchFiltering.js` ~98%, rating calc,
favorites scoring, awards utils 100%) and absent on `Insights.vue` (3,000+ lines),
`LetterboxdScrapingService.js`, `YearInReview`, `Outliers`, `ShareDBResults`.

## Prove a test is a real regression guard

The convention here is to **temporarily revert the fix and confirm the test fails with
the bug's actual signature**, then restore. Several tests in this repo were found to pass
against broken code — most notably a Trophy Case test that asserted a name appeared in
`wrapper.text()` but never that an `<img>` rendered, so it stayed green while every image
on the row was a placeholder. Assert the thing that broke, not a proxy for it.

Where a pure function can be extracted, test it directly rather than through a mount —
`searchFiltering.js`, `tieBreakTournament.js`, `awardStats.js`, the games modules and
`scrollBehavior.js` all exist as separate modules partly for this reason.

## Mock requirements that break `mount()` if missing

- **Home.vue mounts** need the `allMoviesAsArray` getter and the `homePage*` state fields.
  `ChipFiltering`/`QuickLinksFiltering` were both broken by their absence.
- **Any file importing the store** needs a `firebase/database` mock exporting
  `serverTimestamp`, or the import fails.
- **`src/test/setup.js` globally mocks `firebase/auth`** — `getAuth()` runs at module
  load, so without it every test touching the store hits Firebase Auth's Node build and
  throws. Its `onAuthStateChanged` mock **must invoke its callback**, or `authReady` never
  settles and `initializeDB` hangs forever. The three files with their own `firebase/auth`
  factories override the global mock and each need the same treatment.
- `setup.js` also stubs `window.scrollTo` (jsdom doesn't implement it).
- Game tests: see `.claude/rules/games.md` for the `$store`/`$route`/`localStorage` traps.

## jsdom traps

- **jsdom never lays out elements** — `offsetWidth` is always 0. Stub it via
  `Object.defineProperty` on the ref.
- **Don't assert `v-show` with `isVisible()`** on a detached mount — it gave contradictory
  answers across runs for `SettingsSection`'s accordion. Assert what `v-show` actually
  writes: `wrapper.find(sel).element.style.display` is `'none'` or `''`. Also re-`find()`
  an element wrapped in `<component :is>` after every toggle; the element is swapped on
  re-render and a cached wrapper's `trigger()` silently goes nowhere.
- **`scrollIntoView` doesn't exist at all** — assign a stub before `vi.spyOn` can attach.
- A state update made inside a watcher's own nested `$nextTick` needs a **third**
  `await $nextTick()` beyond the two you'd expect.
- A **function ref** re-fires on every re-render, so a stub assigned to it gets clobbered
  mid-update.
- `App.vue` tests use `shallowMount` and stub `addEventListener` — App is the root
  component and never removes its listeners, so real mounts leak handlers across tests in
  the same file.
- Bundle-hash fixtures must be **lowercase hex**; the matcher is `[a-z0-9]+`.

## Fixture hygiene

- `new Date('YYYY-01-01')` is parsed as UTC and shifts a year/decade in this timezone —
  use mid-month dates.
- Use **relative** dates (`daysAgo`) where a window matters, so a fixture can't drift into
  or out of it as real time passes.
- `id: 0` is a legal value. Guard with `x == null`, not `!x` — this exact typo has been
  caught twice (`backfillBoxOffice.js`, Trivia's poster link).
- IndexedDB needs `fake-indexeddb`; jsdom has no implementation.
- Tests that exercise the real store (`OfflineDataFallback`, `flushPendingWrites`) import
  `store/index.js` for real and mock Firebase/axios/router/Sentry — prefer that over a
  hand-rolled mock store, which drifts from the real shape.

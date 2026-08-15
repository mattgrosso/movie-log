---
paths:
  - "src/components/Home.vue"
  - "src/assets/javascript/searchFiltering.js"
  - "src/assets/javascript/entityCounts.js"
---

# Home, search & filtering rules

Home.vue is the highest-traffic screen and the most performance-sensitive code here.
Full narrative: `docs/history/search-and-home.md`.

## Where the logic lives

Pure matching + sorting is in **`src/assets/javascript/searchFiltering.js`** — it reads
nothing from `this`; sort/rating deps are passed explicitly
(`{ sortValue, sortOrder, getRating }`). Home.vue keeps thin method wrappers of the same
names, so existing call sites and mount-based tests are unchanged. Entity count maps live
in **`entityCounts.js`**, shared with MovieDetail.

Still in Home deliberately (entangled with reactive state): `groupedByAllCategories`,
`unifiedFilteredResults`, quick-link computeds, `detectYearTypes`.

## Performance rules — these are load-bearing, not micro-optimisation

- **Use `sortResultsFast(array)`, never `.sort(sortResults)`.** Decorate-sort-undecorate;
  one `getRating` per item instead of ~3 per comparison. `sortResults` is kept only as the
  test oracle. **It returns a NEW array** — don't expect in-place mutation.
  `src/test/searchFiltering.test.js` asserts byte-identical ordering between the two, so
  **if you change sort logic, change both.**
- **`applyFilter` reads `result._search`**, precomputed once per library change by
  `buildSearchFields`. Don't re-lowercase per keystroke. `genre` and `company` are
  intentionally left reading `movie.*` directly — they do exact case-sensitive equality.
- **`groupedByAllCategories` inlines its matching** rather than calling `applyFilter` 7×
  per movie (~9,100 dispatched calls per keystroke over 1,300 movies). If you edit either,
  keep them mirrored — genre/company case-sensitive, the rest lowercased.
- Perf harness: `yarn test:run src/test/Performance.bench.test.js`, read the `[bench]`
  lines. Not a correctness gate. Baseline: general 0.6ms, grouped 2.4ms.

## Grouping and chips

**Group order is also matching priority** — via `usedMovieIds`, a movie matching several
categories lands in whichever group comes first. Order is data-driven
(`DEFAULT_GROUP_ORDER` + a `groupOrder` computed), reorderable by tapping any group
header, and persisted daily at `settings/groupOrderOverride` (reverts next day).

Multiple chips use **AND** logic. The result count badge uses `displayedResults` (what's
actually rendered), not `unifiedFilteredResults.length`.

## Year chips get a scroller, not a chip

Any active `type === 'year'` chip (not `yearRange`/decades) swaps the chip row for
`.year-scroller` — every distinct year, ascending left-to-right, full-width via
`flex: 1 1 100%; min-width: 0`. Other active chips still render as badges below it.
`selectYear` replaces only year chips, leaving everything else alone.

Note `availableYears` (newest-first, for the Add Filter `<select>`) and
`availableYearsAscending` (for the scroller) are two display orders over one source —
don't conflate them.

## Fuzzy "Did you mean?"

Scoped to the user's own library, suggests but never auto-corrects. **Build the Fuse
index once** (`fuzzyIndex` computed) — inlining `new Fuse(...)` into the suggestions
computed cost ~40ms per keystroke. Gated to the zero-results state and to
`this.searchValue` only (never a committed chip's value).

The blur guard in `convertSearchToChip()` applies **only** when
`detectFilterType(searchTerm).type === 'general'` — structured filters (year, genre,
director, …) must always commit, or a valid filter is silently thrown away.

## Diagnostics

`liveDebugState` publishes a live summary for bug reports. The persisted `homePage*`
navigation fields are **cleared by `mounted()`**, so they never reflect current state —
read `homeLive` in a report, not those.

## Entity counts

Count directors with `.filter()`, not `.find()` — `.find` credits only the first-listed
of a co-directed film. Count crew by **job**, not array position: TMDB orders crew by
department, so a composer routinely sits past index 10. All counts respect
`settings.includeShorts` (`runtime <= 40`).

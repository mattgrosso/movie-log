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
  `buildSearchFields`. Don't re-normalize per keystroke.
- **`groupedByAllCategories` inlines its matching** rather than calling `applyFilter` 7×
  per movie (~9,100 dispatched calls per keystroke over 1,300 movies). If you edit either,
  keep them mirrored — every group compares through the same normalization.

## The money sorts (2026-08-25)

`budget`, `boxOffice`, `profit`, `returnPct` — all four in `BOX_OFFICE_SORTS`. The data
is optional: TMDB's `0` means "unknown" and is indistinguishable from a genuinely free
production, so `0` and `undefined` are treated alike (as everywhere else in the app).
About 77% of a mature library has both figures.

**Films with no figures sink in BOTH directions** (`isSortValueUnknown`, checked at the
top of both comparators). Flipping to worst-on-top to find the biggest flops has to show
flops, not three hundred blanks. `profit` and `returnPct` need both numbers; `budget` and
`boxOffice` need only their own. `returnPct` guards against a zero budget — the ratio
would be `Infinity` and would sort above every real film.

This is the one place a sort key can be "unanswerable" rather than merely low, so if you
add another such key, change **both** comparators together — `searchFiltering.test.js`
runs the byte-identical oracle check over the money keys too.

## Normalization: both sides, always (2026-08-16)

`normalizeSearchText` — NFD accent strip, non-decomposing letters (ß→ss, ł→l), curly
quotes and every dash folded (dashes become **spaces**, so "Jean-Pierre" and
"Jean Pierre" reach one string), lowercase, whitespace collapsed. `looseSearchText` adds
"remove every remaining separator" and is used **only for titles**, where run-together
spellings ("spiderman") come up.

Apply it to stored text AND the query. Normalizing one side is what hid Adam's Rib from
an iPhone's curly apostrophe, and de-accenting only titles meant typing "Amélie"
correctly found nothing.

Two traps if you extend this:

- **The query is normalized once per movie**, so `normalizeSearchText` memoizes its last
  input. Keep that, or a 1,300-movie library pays NFD 1,300 times per keystroke.
- **Don't precompute a normalized copy of every searchable term for Fuse.** It's one
  extra object and string per director, actor, keyword, genre, studio and title, retained
  for a fallback that only fires on zero results; it was measurable in an unrelated
  library sort. Cast especially: `_search` is held for the whole library at once, and
  cast is deliberately untrimmed, so a second copy of every cast name is thousands of
  strings. One form per name.
- Perf harness: `yarn test:run src/test/Performance.bench.test.js`, read the `[bench]`
  lines. Not a correctness gate. Baseline: general 0.6ms, grouped 2.4ms.

## Grouping and chips

**Group order is also matching priority** — via `usedMovieIds`, a movie matching several
categories lands in whichever group comes first. Order is data-driven
(`DEFAULT_GROUP_ORDER` + a `groupOrder` computed), reorderable by tapping any group
header, and persisted daily at `settings/groupOrderOverride` (reverts next day).

Multiple chips use **AND** logic. The result count badge uses `displayedResults` (what's
actually rendered), not `unifiedFilteredResults.length`.

**Grouping RE-SEARCHES, which is why typed chips can't use it — except people.** The
free-text grouped view takes the chip's bare VALUE (type discarded) and searches it
across Title / Director / Cast / Producer / Company / Keywords. Title is always one of
those, so every typed chip leaked movies its own filter excluded — a `tag:DARK` chip
showed everything with "dark" in the title (d4580ec). Grouping is therefore off for all
typed chips.

The one exception is `person`, and it works by a different mechanism: it does not
re-search at all. `personRoleGroups.js` **partitions `unifiedFilteredResults`** by the
role that person held on each film, so a leak is structurally impossible rather than
merely guarded against. It reuses `FILTER_KINDS.person`'s exact/surname matcher — it must,
or the sections would partition a different set than the count claims. If you add
grouping for another chip type, partition; never re-search.

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

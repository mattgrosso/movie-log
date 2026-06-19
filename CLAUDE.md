# Cinema Roll - Project Summary

## Overview
Cinema Roll is a personal movie rating and tracking application built with Vue.js 3. It allows users to rate movies on multiple criteria, track their viewing history, and gain insights into their viewing patterns.

**Live URL**: [cinema-roll.surge.sh](https://cinema-roll.surge.sh/)

## Technology Stack
- **Frontend**: Vue.js 3 with Options API
- **State Management**: Vuex store
- **Routing**: Vue Router with hash-based routing
- **Styling**: Bootstrap 5 + SCSS
- **Database**: Firebase Realtime Database
- **Authentication**: Google Auth (Firebase)
- **Charts**: Chart.js via vue-chart-3
- **Calendar**: FullCalendar for date-based views
- **Testing**: Vitest with coverage
- **Error Tracking**: Sentry
- **Build Tools**: Vue CLI
- **Deployment**: AWS S3 + CloudFront

## Key Features

### Rating System
- Multi-dimensional rating system with weighted scores:
  - Love (2.8 weight)
  - Overall (2.0 weight)
  - Story (1.25 weight)
  - Direction (1.1 weight)
  - Imagery (0.9 weight)
  - Performance (0.7 weight)
  - Soundtrack (0.3 weight)
  - Stickiness (1.9 weight, divided by 2)
- Calculated total score based on weighted averages

### Data Sources
- **Movie Database**: The Movie Database (TMDb) API for movie information
- **Awards Data**: Academy Award winners integration
- **Letterboxd**: Service for scraping and importing data

### Core Components
- **Home**: Main dashboard with search, advanced filtering, and movie grid
- **RateMovie**: Rating interface with multi-criteria scoring
- **Insights**: Analytics and visualizations of viewing patterns
- **Favorites**: Lists of favorite actors, directors, etc.
- **Charts**: Various data visualizations
- **Settings**: User preferences and configuration

### Advanced Filtering System
- **Search-First Design**: Text input remains primary for adding new ratings
- **Auto-Chip Conversion**: Search terms automatically convert to chips after 2-second delay
- **Manual Chip Conversion**: Arrow button in search bar to manually convert searches
- **Quick Links**: Preserved favorites (Annual Best, Best Picture, This Year, etc.)
- **Combinable Filters**: Add additional filters on top of quick links or search
- **Filter Chips**: Visual display of active filters with easy removal
- **Filter Types**: Search, Director, Year, Genre, Production Company, Tag with searchable dropdowns
- **Mobile-Optimized**: Modal interface for adding filters
- **Intersection Logic**: Multiple chips use AND logic (not OR) for proper filtering
- **Backward Compatibility**: Maintains `this.value` for existing functionality while supporting chips

### Analytics & Insights
- Calendar heatmap of viewing activity
- Yearly averages and trends
- Streaks tracking
- Outliers identification
- Keyword cloud from movie metadata
- Charts for various metrics

### Letterboxd Integration
- **Automatic Detection**: Web scraping service to detect logged movies
- **Manual Overrides**: Subtle plus icon interface for manually marking movies as logged when auto-detection fails
- **Username Configuration**: User can set their Letterboxd username for scraping
- **Special Title Handling**: Enhanced normalization for problematic titles (F1, M, etc.)
- **Filter Integration**: Manual overrides properly excluded from "Not on Letterboxd" quick filter

## Database Structure
Firebase Realtime Database with user-specific data:
```
/{user-email-key}/
  ├── movieLog/          # User's rated movies
  ├── settings/          # User preferences and tags
  └── academyAwardWinners/  # Cached awards data
```

## File Structure
- `src/components/` - Vue components (35+ components)
- `src/store/index.js` - Vuex store with Firebase integration
- `src/router/index.js` - Vue Router configuration
- `src/services/` - Letterboxd scraping services
- `src/assets/javascript/` - Rating calculation utilities
- `src/test/` - Vitest test files including comprehensive chip filtering tests

## Development Commands
- `yarn serve` - Development server with hot reload
- `yarn build` - Production build
- `yarn test` - Run tests
- `yarn test:coverage` - Run tests with coverage
- `yarn lint` - ESLint
- `yarn deploy` - Build and deploy to AWS

## Authentication & Security
- Google OAuth via Firebase Auth
- User-specific database keys (email-based)
- Dev mode toggle for testing different user accounts

## Known Issues (from FeatureRequests.md)
- Issue with rating movies a perfect 10
- Need for database sharding as user base grows
- Missing user tutorial/onboarding

## Recent Development Focus
Based on recent commits and development:

### Chip-Based Filtering System & Search UX
- **Complete Filtering Overhaul**: Visual chip system with auto-conversion after 2-second typing pause
- **Instant Search + Chip Conversion**: Best of both worlds - real-time filtering while typing, converts to organized chips when pausing
- **Auto-Clear for Random Chips**: When random search on load creates a chip, clicking input auto-clears it so user can search immediately
- **Focus-Based Clearing**: Uses `requestAnimationFrame` for responsive auto-clearing without timing delays
- **Smart Search Value Management**: Preserves search context for "Search TMDB" button and "More from" section functionality
- **Filter Intersection Logic**: Multiple chips use AND logic for proper database-style filtering

### Random Search Toggle Feature
- **Complete Toggle Implementation**: User setting to enable/disable automatic random search on page load
- **Settings Integration**: Toggle in Home.vue settings panel with proper Firebase persistence
- **Race Condition Fix**: Resolved timing issues where random search triggered before user's setting loaded from database
- **Null-Safe Logic**: Prevents random search execution until definitive user setting is available

### Header Banner Stabilization
- **Timer-Based Caching**: Header banner images now cached for 30 seconds to prevent constant swapping
- **Filtered Results Integration**: Banner still reflects current search/filter context, just updates less frequently
- **Performance Optimization**: Reduces visual noise while maintaining relevance to user's current view

### Search & Filter Polish
- **Production Companies Integration**: Full support for filtering by production companies
- **Automated Testing**: Comprehensive test suite (99+ tests) for chip functionality to prevent regressions
- **Performance Optimizations**: Eliminated competing debounced functions that caused filtering delays
- **Mobile UX**: Proper focus handling and responsive chip conversion timing

### Recent Bug Fixes
- **Filter Intersection Bug**: Fixed critical bug where multiple chips created union instead of intersection
- **Search Value Persistence**: Fixed "Search TMDB" button losing text when chips are created
- **More From Section**: Fixed inconsistency where "Steven Spielberg" wouldn't show "More from" section but "Francis Ford Coppola" would
- **Settings Loading Race**: Eliminated race conditions in settings loading that caused random search to trigger incorrectly

## Environment Variables Required
- `VUE_APP_GOOGLE_API_KEY` - Firebase/Google API key
- `VUE_APP_TMDB_API_KEY` - The Movie Database API key

This application serves as a comprehensive personal movie tracking system with sophisticated rating algorithms and rich data visualization capabilities.

## Project Development Notes

### Testing Strategy
- Remember to keep our test suite up to date with all new changes. Whenever possible write tests first and use those to power our process. Whenever we wrap up a new feature remember to update existing test, add new ones and remove any that are no longer relevant. You can run tests with 'yarn test:run'

### Development Server Protocol
**NEVER kill or interfere with running development servers.** The user typically has `yarn serve` running in another terminal pane and relies on it for continuous development. 

- **DON'T**: Use `yarn serve`, `pkill`, or any commands that would interfere with existing processes
- **DO**: Use `yarn test:run` for quick syntax/functionality checks
- **DO**: Ask the user to test new features in their existing development server
- **DO**: Focus on code implementation and let the user handle server management

This is critical for maintaining an uninterrupted development workflow.

## Recent Changes - Awards Modal Stability Fixes (Aug 2024)

### Fixed Awards Modal Auto-Close Issue
- **Problem**: Awards modal would unexpectedly disappear when users completed categories, preventing them from continuing work
- **Root Cause #1**: `autoSave()` function automatically set completion date when all categories were filled, causing modal to be hidden by daily limit logic
- **Root Cause #2**: `showAwardsModal` computed property treated any year with awards data as "complete", ignoring partial progress
- **Root Cause #3**: `firstEligibleYear` computed property (banner display) had similar flawed logic, causing missing year in banner
- **Solution**: 
  1. Removed auto-completion behavior from `autoSave()` - users now must explicitly click "Complete Awards" button
  2. Fixed eligibility logic to keep showing modal for years with partial progress (not explicitly completed)
  3. Fixed banner year display logic to include years with partial progress

### Added Awards Resume Functionality
- **New Feature**: "Resume Awards" section in Insights page (`src/components/Insights.vue`)
- **Functionality**: Shows partially completed award years with progress bars and "Resume" buttons
- **Detection Logic**: Identifies years with partial progress (some nominees/winners but not explicitly completed)
- **Resume Method**: Sets daily awards year selection and navigates to Home to trigger modal
- **New Movies Detection**: Highlights years with new movies added since last awards session

### Key Files Modified
- `src/components/PersonalAwardsModal.vue:927-963` - Removed auto-completion from autoSave()
- `src/components/Home.vue:1796-1801` - **CRITICAL FIX**: Added partial progress check to showAwardsModal eligibility logic
- `src/components/PersonalAwardsModal.vue:376-381` - **CRITICAL FIX**: Added partial progress check to firstEligibleYear banner logic
- `src/components/Insights.vue:277-314` - Added Resume Awards section in template
- `src/components/Insights.vue:431-487` - Added partialAwardsYears computed property
- `src/components/Insights.vue:1169-1183` - Added resumeAwards() method

### Technical Details
- Awards modal no longer auto-closes when categories are completed
- Completion date only set when user explicitly clicks "Complete Awards" button
- Resume logic bypasses daily limit by setting `dailyAwardsYear` to specific year
- Progress calculation excludes explicitly completed years (via button) but includes partial work
- All existing functionality preserved, just made less fragile

This fixes the fragility issue where the modal would disappear unexpectedly and provides a reliable way to resume work on partial awards.

### Debug Logging Cleanup (Aug 2024)
- All debug logging (`🏆 AWARDS DEBUG:` messages) has been removed after successful problem resolution
- Core functionality preserved, console noise eliminated
- System now operates cleanly in production

### Awards UI Enhancement - Actor Display (Aug 2024)
- **Improvement**: Split actor nomination display from 2 lines to 3 lines for better readability
- **Before**: Name on line 1, "Movie (Role)" on line 2
- **After**: Name on line 1, Movie on line 2, Role on line 3 (italicized)
- **Files Modified**: `src/components/PersonalAwardsModal.vue` - template, methods, and CSS
- **New Methods**: `getOptionMovie()` and `getOptionRole()` for cleaner data separation
- **Styling**: Role text is smaller, italicized, and slightly more transparent for visual hierarchy

## Grouped Result Hierarchy (Jun 2026)

The grouped search view (`groupedByAllCategories` in `Home.vue`) buckets results into categories (Title, Director, Cast, Producer, Company, Keywords, plus role-detected Writer/Music/Editor/Cinematographer/Crew, and Other). **Group order is also matching priority** — via `usedMovieIds`, a movie matching multiple categories lands in whichever group comes first.

- **Order is data-driven**: `DEFAULT_GROUP_ORDER` constant + a `groupOrder` computed. Candidate matches are computed per-group first, then claimed in `groupOrder` priority.
- **Manual reorder UI**: The old (non-working) Share button was replaced by a group-order button (`bi-list-ol`) that opens a panel listing the currently-present groups with ▲/▼ controls. Moving a present group swaps it within the full master order, so absent groups keep their slots and the whole hierarchy stays intact.
- **Click-to-promote**: Clicking a typed value on a movie detail page (keyword, director, cast, etc.) promotes that group to the top. `MovieDetail.searchFor(query, type)` maps the type to a group key and sets `homePagePromoteGroup` in the store; `Home.applyPromoteGroup()` applies it on load.
- **Daily persistence**: Stored at `settings/groupOrderOverride = { order, date: toDateString() }` in Firebase (same pattern as `dailyAwardsYear`). The `groupOrder` computed ignores overrides whose `date` isn't today, so it reverts to default the next day. Clicks and manual edits share this override; clicks win.
- **Count fix**: The result count badge uses `displayedResults` (the unique movies actually rendered, summed across grouped categories) instead of `unifiedFilteredResults.length`, which previously diverged from the visible cards.
- **Keyword case fix**: `applyFilter` keyword/general matching is now case-insensitive (`flatKeywords` keep TMDb's original casing like "Star Wars" while search values are lowercased).

Tests: `src/test/GroupOrdering.test.js`. Note: the `ChipFiltering`/`QuickLinksFiltering` mocks were missing `allMoviesAsArray` getter and the `homePage*` state fields, which broke their `mount()`; both are now fixed.

## Search Recompute Performance (Jun 2026)

Profiled the per-recompute lag in the search/result chain (`getRating` call-counting + `performance.now()` probes, since removed). Findings and fixes:

- **`getRating()` (in `GetRating.js`) is uncached and moderately expensive** (8 Vuex `weight` getter calls + `Math.min/max(...allRatings)` spreads per call). The legacy `sortResults(a, b)` comparator called it ~3x per comparison → O(n log n) `getRating` calls dominated the sort cost (measured ~224ms / ~3950 calls over ~1300 movies).
- **Fix (landed): `sortResultsFast(array)`** — decorate-sort-undecorate. Computes each item's primary+secondary sort value ONCE (and reuses a single `getRating` per item for the default "rating" sort), then sorts on cached values with comparison semantics **identical** to `sortResults` (including the quirk that `===` on two Date objects is false, so date sorts skip the secondary tiebreak). Dropped to 1 `getRating`/item, ~76ms. `sortResults` is kept as the reference oracle for the equivalence test. All five `.sort(this.sortResults)` call sites now use `sortResultsFast`. **Note `sortResultsFast` returns a NEW array (does not mutate input)** — the in-place `existingCategory.movies.sort(...)` site was changed to reassign.
- **Fix (landed): single-pass grouping** — `groupedByAllCategories` Step 1 previously did ~7 full `filter()` passes over the library (one per group type + 2 for keyword/genre). Collapsed to ONE loop building all candidate buckets. Candidate SETS and order are identical (movies pushed in library order), so claiming behavior is unchanged. Modest win — the dominant grouping cost is `applyFilter` work itself, not loop overhead.
- **Equivalence is enforced by test**: `src/test/SortResultsFast.test.js` asserts `sortResultsFast` produces byte-identical ordering to `sortResults` across all sort keys × orders, including ties and non-mutation. **If you ever change sort logic, change BOTH or the test will catch the divergence.**
- **Fix (landed): collapsed cast/crew name matching in `applyFilter` `general` case** — the old code did `cast.flatMap(p => [fullNameLower, ...fullNameLower.split(' ')]).some(n => n.includes(v))` (and the same for crew), allocating two arrays per person per movie per keystroke. Every space-delimited name-part is a substring of the full name, so that `.some()` is provably equivalent to a single `fullName.toLowerCase().includes(v)`. Replaced with `cast.some(p => p.name && p.name.toLowerCase().includes(v))`. **Output is identical** (last-name/first-name/substring matches all still resolve via the full-name check); only the per-keystroke array allocation is removed. Locked in by `src/test/GeneralFilterNameMatching.test.js`.
- **Fix (landed): memoized lowercased search fields** — `applyFilter` used to re-lowercase title/cast/crew/keyword/general strings for every movie on every keystroke. New `buildSearchFields(movie)` precomputes them ONCE per library change, attached as `result._search` in `allEntriesWithFlatKeywordsAdded`. `applyFilter` reads `result._search` (with an on-the-fly fallback for quick-link-sourced entries that lack it — those lists are small). **`genre` and `company` filter types are intentionally left reading `movie.*` directly** because they do exact case-sensitive equality (not lowercased); only the lowercasing-heavy cases (`general`/`person`/`keyword`/`title`/`director`/`producer`/`cast`) use `_search`. Crew entries cache `{ name (lower), job (original), jobLower }` so director's exact `=== 'Director'` and producer's substring check both stay correct. Guarded by the existing `ChipFiltering` (decorated path) + `QuickLinksFiltering` (fallback path) + `GeneralFilterNameMatching` suites. Much of the observed ms is dev-mode inflation (unminified Vue, forced-reflow violations); production is materially faster. Next lever if needed: reduce per-call `applyFilter` cost (hoist `searchTerm.toLowerCase()`, avoid re-deriving lowercased cast/crew strings). Deferred deliberately — higher risk to the matching core.

- **Fix (landed): inlined grouped matcher** — `groupedByAllCategories` Step 1 used to call `this.applyFilter` 7×/movie (title, director, cast, producer, company, keyword, genre) ≈ 9,100 dispatched calls/keystroke over ~1,300 movies. Replaced with a single read of each movie's precomputed `_search` + inline conditions that **mirror each applyFilter case exactly** (genre/company stay case-sensitive vs the raw `searchTerm`; the rest use the lowercased term). Candidate sets are identical, so claiming is unchanged — guarded by `GroupOrdering.test.js`. Measured **4.00ms → 2.44ms** (~1.6×) on the harness below.
- **Perf harness**: `src/test/Performance.bench.test.js` mounts Home over a 1,300-movie synthetic library and prints `[bench]` timings for `applyFilter`, `sortResultsFast`, and `groupedByAllCategories` (writes via `process.stdout` to bypass vitest's console intercept). NOT a correctness gate (loose sanity asserts only) — run `yarn test:run src/test/Performance.bench.test.js` and read the `[bench]` lines when experimenting. getRating is mocked, so it measures the matching/grouping/sort JS, not Vuex weight-getter cost. Baseline after all fixes: general 0.6ms, director 0.3ms, sortResultsFast 0.6ms, grouped 2.4ms — the pure-JS hot path is fast; remaining real-world keystroke lag is dev-mode Vue reactivity + forced reflow, not this code.

## Fuzzy "Did you mean?" Search Suggestions (Jun 2026)

Typo-tolerant search suggestions powered by `fuse.js`, scoped to the user's OWN rated library (no TMDB-catalog matching). Built to **suggest, never auto-correct** — the user taps a suggestion to commit it, so a wrong guess never silently builds a chip.

- **Index** (`searchableTerms` computed in `Home.vue`): distinct typed terms reused from the existing count maps (`countDirectors`, `countCastCrew`, `countedKeywords`, `countedGenres`, `countStudios`) plus distinct titles. Each entry carries an `expectedType` string that `createFilterByType()` understands (`director`, `cast/crew`, `keyword`, `genre`, `studios`); titles use `expectedType: null` and commit as a `general` chip, matching how a typed title behaves.
- **Index build is memoized** (`fuzzyIndex` computed): the Fuse instance is built ONCE per library change, not per keystroke. The index is large (tens of thousands of terms across all cast/crew/keywords/etc.), so building it cost ~40ms; doing that on every keystroke was a measurable typing lag. `didYouMeanSuggestions` reuses `this.fuzzyIndex`. Do NOT inline `new Fuse(...)` back into `didYouMeanSuggestions`.
- **Ranking** (`didYouMeanSuggestions` computed): reuses `fuzzyIndex` (threshold 0.4, `ignoreLocation`, `minMatchCharLength: 3`) and returns up to 5 deduped suggestions. **Gated to the zero-results state**: returns `[]` unless term ≥ 3 chars AND `paginatedSortedResults.length === 0` AND no quick link active — so fuzzy work never runs on the common (has-results) path, and exact-match search (`groupedByAllCategories`/`unifiedFilteredResults`) is unchanged.
- **Important interaction**: the existing search already does substring matching, so partial spellings like "villeneuv"/"speilberg-as-substring" are found by normal search and fuzzy never fires. Fuzzy only kicks in on *genuine* typos (transpositions, wrong letters) that aren't substrings, e.g. "villenueve" → "Denis Villeneuve". Tests must use real non-substring typos.
- **UI**: rendered in the `v-else-if="$store.state.dbLoaded"` branch (`Home.vue` ~line 679) ABOVE the `NoResults`/`NewRatingSearch` component. Tap calls `applyDidYouMeanSuggestion()` → `addSearchFilter(value, false, expectedType)`. Styled with `:active` press feedback (mobile-first, no-hover).
- **Blur-guard (important)**: `convertSearchToChip()` bails when `didYouMeanSuggestions.length > 0`. Without this, blurring the input (`@blur="blurSearchBar"` → `convertSearchToChip`) auto-converted the raw typo into a dead `general` chip, which then flowed into `NewRatingSearch` and bounced through its no-results reset back to an empty input. The user is meant to tap a suggestion (committing the corrected value) rather than have the typo chipped.
- **Zero-results / TMDB**: this path renders `NewRatingSearch`, which AUTO-searches TMDB (no button) and either redirects to pick-media or shows the "doesn't exist" message. There is no manual "Search TMDB" button on the zero-local-results screen by design (the button at `Home.vue:670` only renders when ≥1 local result exists). A misspelled-but-real new movie is usually still found by TMDB's own fuzzy search and redirects. Suggestions only correct against the user's OWN rated library.

Tests: `src/test/FuzzySuggestions.test.js`.

## Important Notes for Claude
**Always keep this CLAUDE.md file updated** as you work on the project. When you make changes, add features, or learn new things about the codebase, update the relevant sections of this file to maintain an accurate project summary for future sessions.

**CRITICAL: Always check text contrast and readability!** Before implementing any UI changes, ensure text is legible against its background. This app uses dark themes and Bootstrap classes - always verify that text colors work properly against dark backgrounds. Common issues include:
- Dark text on dark backgrounds (unreadable)
- Light text on light backgrounds (unreadable) 
- Insufficient contrast ratios
- Missing Bootstrap text color classes like `text-light`, `text-white`, or `text-muted`
# Geography / Maps (built and removed) — development history

> Archived from CLAUDE.md. Verbatim post-mortem narrative, kept for the hard-won
> detail. Durable rules extracted from this live in `.claude/rules/`.

## Geography / Maps: BUILT AND REMOVED (Aug 2026)

A filming-and-story-location feature was built out over several rounds and then
**taken back out at the user's request**: *"I'm not sure we've really got it
with this location stuff. I think there's a lot of good work here, and we've got
some pieces of something that might work, but I think we should take the whole
thing out."* Do not treat any of the below as describing current code — none of
it exists. It's recorded because the research is expensive to redo and the
findings are what a second attempt should start from.

**Deleted**: `movieLocations.js`, `mapViewBox.js`, `worldMap.json`,
`WorldMap.vue`, `LocationDetailMap.vue`, `scripts/generate-world-map-data.mjs`,
the `leaflet` dependency, MovieDetail's "On The Map" section, Insights'
"Around The World" pane, and Home's locations backfill button. All recoverable
from git history (see the commits between "Add filming/story locations..." and
"Fix unclickable map dots...").

### Findings worth keeping for a second attempt
- **Reading Maps (readingmaps.com) is off limits.** Their terms explicitly
  prohibit extracting route data, waypoints, coordinates or descriptions. Their
  frontend does expose a Supabase anon key in the client bundle, so the data is
  a request away — that is not an invitation, and it was deliberately not used.
  Linking is explicitly permitted. Emailing Aires Loutsaris is the legitimate
  route.
- **Wikidata is the open answer and it works well.** CC0, joins directly via
  `P4947` (TMDB id) — **99% of the library matched**, 58% had filming locations
  (`P915`), 71% narrative (`P840`), **79% had at least one**.
- **The SPARQL query shape matters and was found by measurement.** The obvious
  `{ ?film wdt:P915 ?p } UNION { ?film wdt:P840 ?p }` **times out even at two
  ids**. Binding the predicate from a VALUES block
  (`VALUES (?prop ?type) { (wdt:P915 "filming") (wdt:P840 "narrative") }`) runs
  200 ids in ~2.4s. WDQS sends `access-control-allow-origin: *`.
- **WKT is longitude-FIRST** (`Point(-118.24 34.05)`) — reversing it puts Los
  Angeles in the Indian Ocean.
- **Coordinate precision varies and matters.** Measured across 132 real places:
  ~15% are country centroids, but **64% are precise to ~100m or better**. Any
  zoom behaviour has to key off precision, or a country centroid gets presented
  as a street address.
- **Map data resolution, measured by rendering and comparing:** Natural Earth
  110m staircases into rectangles past ~5x; 50m stays smooth to ~16x; 10m adds
  almost nothing over 50m for ~6x the bytes. Costs gzipped: 110m land 17K; 50m
  land + country borders + 1,160 city labels 318K; + state/province lines 381K.
- **Labels beat geometry.** City labels cost 13K gzipped and did more for
  legibility than 228K of finer coastline. A dot off the California coast means
  nothing; a dot beside "Los Angeles" means everything.
- **Anything drawn on an SVG map must be sized in CSS pixels, not grid units.**
  Sizing in grid units produced dots ~1.6px across on a phone — the
  zoom-compensation logic was correct, the constant it held was just far too
  small, and it looked fine only in 1000px-wide test renders.
- **OSM tiles** are usable for interactive viewing with visible attribution and
  no offline prefetching, but carry no SLA. **Carto** now restricts tile access
  to enterprise/grant licences. **Esri satellite** serves without a key and is
  the most compelling for a filming location, but its terms were never verified.
  **Stadia/MapTiler** have dark styles matching the app and domain-locked keys.

### Stored data was deliberately NOT deleted
If the backfill was ever run, entries carry `movie.locations`. That field is now
unread, and removing it would mean re-querying Wikidata for the whole library on
a second attempt. Leave it.

### What survived the removal, and why
- **Production countries** ("Made In" on MovieDetail + its backfill). Independent
  of the maps, plain text, working. Flagged to the user as kept.
- **`tmdbBackfill.js`**, the shared backfill engine — still used by box office
  and production countries.
- **The re-rate preservation fix** below, which fixed a genuine pre-existing bug
  unrelated to maps. `CARRIED_OVER_MOVIE_FIELDS` is now empty but the mechanism
  stays.
- The Letterboxd viewing-date fix and the MovieDetail section reordering.

### `tmdbBackfill.js` — shared backfill engine
The concurrency + batched-write machinery was extracted out of `backfillBoxOffice.js` into `src/assets/javascript/tmdbBackfill.js` (`runTmdbBackfill`, `hasRealTmdbId`) and is now shared with the production-countries backfill. Extracted rather than copied because that logic is subtle (worker pool, plus a flush whose grab-and-clear is deliberately synchronous so concurrent workers can't race it) and two copies would drift — the same mistake that produced the duplicated count maps later consolidated into `entityCounts.js`. `backfillBoxOffice`'s public API is unchanged and all 18 of its pre-existing tests pass untouched. **Batched writes are a bug fix, not an optimisation** — see the Jul 2026 incident where a per-movie design froze and crashed the tab on a real library. `Home.vue`'s `writeMovieFieldBatch(batch, fieldsFor)` is the one shared write path for all three backfills: leaf-path updates only (never the whole `movie` object, which could clobber siblings with a stale snapshot), one combined local commit + one combined remote multi-path update per batch.

Tests: `backfillProductionCountries.test.js` (10), plus a `Made In` describe block in `MovieDetail.test.js`. (The locations/map test files went with the feature.)

### Re-rating used to destroy locally-owned data (fixed in the same pass)
Found while wiring the above, and **wider than locations**. Saving a rating does a full `set()` of `movieLog/<key>`, and `shapeTmdbDataIntoMovie` builds a **brand new** movie object from the TMDB response — so anything not explicitly rebuilt was silently wiped:
- `movie.locations` (would have been, had this not been fixed at the same time)
- **`customPosterPath` / `customBackdropPath` — a genuine pre-existing bug.** These live at the ENTRY level, as siblings of `movie`/`ratings`, so re-rating a movie with a custom poster lost it. Confirmed by test: reverting the fix fails `keeps a custom poster across a re-rate`.

Fixed in `addMovieRating` with two deliberately different strategies:
- **Entry level — copy everything** except `movie`/`ratings` (being replaced) and `dbKey` (injected by the store's getter at read time, not real stored data). Nothing at this level comes from TMDB, so it's all worth keeping, and an allowlist would silently start dropping whatever gets added next.
- **Movie level — an explicit allowlist** (`CARRIED_OVER_MOVIE_FIELDS`, now empty since `locations` went with the maps), applied only where the fresh TMDB object doesn't define the field. A blanket merge would resurrect stale values that re-fetching exists to correct, and would keep `isPendingReconciliation: true` set on a placeholder being finalised.

Tests: the `re-rating preserves locally-owned data` block in `TMDbDataProcessing.test.js`, verified as a real guard by reverting the fix. (The locations half of that block went with the feature.)

### Two bug reports from that round that still stand (Aug 2026)

**Section order on MovieDetail** — *"we should move the awards at the cast and the keywords up above the box office."* Order is now Genres → Awards → Cast → Keywords → Box Office → Made In → Tags.

**Letterboxd log date** (reported by Natalie) — *"it should have the date automatically filled in ... Even if I didn't watch it today and also even if I have watched it multiple times."* `generateUrls` was always sending **today**. It now takes `options.viewingDate` and uses the date the movie was actually watched, falling back to today only when there isn't a usable one. Both call sites (`MovieDetail`, `DBGridLayoutSearchResult`) pass `mostRecentRating(result)?.date` — the latest viewing, which is the one being logged for a rewatch. New `toLocalISODate(value)` generalises `todayLocalISODate`, and keeps the local-components approach for the same reason: `toISOString()` is UTC and would report the previous day for an evening viewing in a western timezone.

Tests: viewing-date blocks in `LetterboxdUrlService.test.js`. (The map-zoom fix from this same round was removed along with the maps.)

---
paths:
  - "src/components/MovieDetail.vue"
  - "src/components/Insights.vue"
  - "src/components/Favorite*.vue"
  - "src/components/StickinessInline.vue"
  - "src/mixins/favoriteTuning.js"
  - "src/services/**"
---

# MovieDetail, Insights & Favorites rules

Full narrative: `docs/history/ui-and-layout.md`, `docs/history/search-and-home.md`.

## MovieDetail

- **Section order**: Genres → Awards → Cast → Keywords → Box Office → Made In → Tags.
- **It is a pure local lookup — no live TMDB fetch on view.** That's deliberate. Optional
  data (box office, production countries) is `v-if`-guarded so older library entries just
  don't render the section, and a Settings-panel backfill catches them up.
- TMDB's `0` means "not available" and is indistinguishable from a genuinely free
  production — treat `0` and `undefined` identically as unknown.
- Awards content scrolls internally (`.awards-body`, `max-height: 150px`), matching the
  `.long-list` treatment on Cast/Genres/Directors. Don't collapse it behind a toggle.
- `formatTimeDifference`'s months branch runs to 730 days, so `'1 year'` is effectively
  unreachable (400 days returns `'13 months'`). Characterized by test, not a bug to fix
  blind.

## Letterboxd

Username-only, no OAuth — setting the username *is* the login. The
`letterboxdUsername`/`letterboxdConnected` computeds need **setters**, or `v-model` writes
are silent no-ops (this dropped new users' typed usernames).

`LetterboxdUrlService.generateUrls` passes `date` and `rating` to the deep link:

- **`date` is the date the movie was actually watched** (`mostRecentRating(result)?.date`),
  not today — a rewatch logs the viewing being logged. Falls back to today only when
  there's no usable date.
- Use `toLocalISODate`, **never `toISOString()`** — that's UTC and reports the previous
  day for an evening viewing in a western timezone.
- `rating` is the normalized 0–10 score halved to 0.5–5 stars; 0/missing omits the param.

## Insights

`estimatedMoviesThisYear` blends four movies-per-day rates equally — whole-year-to-date,
recent 2 weeks, recent 2 months, plus last year's seasonal shape — projected across the
remaining days.

The seasonal signal has **three independent guards**, any one of which disqualifies it
(returns `null`, meaning "leave this signal out", not zero): `MIN_LAST_YEAR_TOTAL = 12`
(also naturally excludes anyone who wasn't a user last year), `MIN_LAST_YEAR_TO_DATE = 4`,
and a `MIN_FRACTION = 0.15` floor so one lopsided year can nudge the blend without
dominating it.

The equal weighting is a design call, not a bug — favouring recent behaviour more heavily
is defensible but shouldn't be changed unilaterally.

Note two computed-side-effect lint errors here are suppressed with an inline disable +
TODO rather than rewritten — that logic has a documented bug history and no coverage.

## Favorite sections

Eight sections share `src/mixins/favoriteTuning.js`, which holds **only** type-agnostic
plumbing (TMDB details cache, Firebase load/save of tuner values, `bayesianAverage`,
boot). Every section keeps its own `tuningDefaults`, lever values, gather logic and
scoring quirks. The mixin holds zero tuning values.

**Gather/rescore split = no re-fetch while tuning.** `buildTopTwelveList` gathers once per
data load; `rescore` scores with current levers, lazily fetching only for the eligible
set, guarded by a `rescoreSeq` token that drops superseded async passes. Dragging a slider
must never re-hit TMDB (enforced by test).

Known-for bonus intentionally differs by section — Directors/Composers blend the role
sub-score; Writers/Cinematographers/Editors/Producers use plain `calculatedTotal`. Cast
sections re-gather each pass and gender-gate via cached lookups.

## Stickiness

Build updated ratings with `.map()`. See `.claude/rules/data-writes.md` — `{ ...array }`
corrupts the shape and silently zeroes the entry's score, which puts the movie back in the
stickiness queue permanently.

After saving, stay on the form and advance to the next movie; only collapse the panel once
the queue is genuinely empty. Build the `dbEntry` *before* dispatching, since the local
commit is synchronous and `firstStickinessResult` already points at the next movie.

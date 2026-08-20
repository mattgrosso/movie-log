// Pulling the "should I watch this?" facts out of a raw TMDB payload, for
// MoviePreview (the sheet that opens when you tap an unrated poster).
//
// Pure and store-free so it can be tested directly rather than through a
// mount — the same reason searchFiltering.js, tieBreakTournament.js and the
// games modules exist as separate files.
//
// Everything here reads a FRESH TMDB response, not a stored library entry:
// the sheet is for films that aren't in your library at all, so there is no
// entry to read. That means the trimming `storedEntry.js` does hasn't
// happened and the shapes are TMDB's own.

/**
 * Every director, not just the first.
 *
 * `.filter()`, never `.find()` — a co-directed film has two, and crediting
 * only the first-listed is a mistake this repo has made before (see
 * `entityCounts.js`, and the note in `.claude/rules/home-search.md`).
 *
 * Matched on `job`, not on position: TMDB orders crew by department, so
 * nothing can be assumed about where the director sits in the array.
 */
export function directorsFrom (credits) {
  return (credits?.crew || [])
    .filter((person) => person?.job === 'Director' && person?.name)
    .map((person) => person.name);
}

/**
 * Top-billed cast, in TMDB's own billing order.
 *
 * `order` is the billing position and is what decides "top-billed" — the
 * array arrives sorted, but sorting explicitly means a payload that isn't
 * still gives the right answer rather than a quietly wrong one. Entries
 * without an `order` sort last instead of jumping to the front on an
 * undefined.
 */
export function topCastFrom (credits, { cap = 6 } = {}) {
  return [...(credits?.cast || [])]
    .filter((person) => person?.name)
    .sort((a, b) => (Number.isFinite(a.order) ? a.order : Infinity) - (Number.isFinite(b.order) ? b.order : Infinity))
    .slice(0, cap)
    .map((person) => person.name);
}

/**
 * The content rating ("PG-13"), from TMDB's per-country release dates.
 *
 * A film has several release types per country (theatrical, digital, TV) and
 * only some carry a certification, so this takes the first non-empty one for
 * the region rather than the first entry. Returns null when the region has no
 * certification at all — which is common, and must read as "unknown" rather
 * than as an empty badge.
 */
export function certificationFrom (releaseDates, region = 'US') {
  const forRegion = (releaseDates?.results || [])
    .find((entry) => entry?.iso_3166_1 === region);

  const certified = (forRegion?.release_dates || [])
    .map((release) => (release?.certification || '').trim())
    .find(Boolean);

  return certified || null;
}

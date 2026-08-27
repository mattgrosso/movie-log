// TMDB's movie genre ids, by name.
//
// /discover takes numeric genre ids, not names, so anything asking TMDB for
// "horror" has to turn that into 27 first. The chips carry the NAME (that
// is what you typed and what the chip shows), so this is the translation
// between the two.
//
// Why it exists as its own module (2026-08-18): the map used to live inside
// Home.vue's chip detection, and the id it produced was attached to the
// detected filter — but the chip that actually got pushed onto
// activeFilters copied only `type`, `value` and `display`, so the id was
// dropped on the way. Every genre chip therefore reached the fetch with
// `genreId: undefined`, axios omitted `with_genres`, and /discover happily
// returned the most popular films on TMDB under a horror heading:
// Spider-Man, Harry Potter, superheroes (Matt, 2026-08-18).
//
// Resolving by NAME at fetch time means it no longer matters which of the
// seven places built the chip, or whether it survived a round trip through
// the store.

export const TMDB_GENRE_IDS = Object.freeze({
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  'science fiction': 878,
  'sci-fi': 878,
  scifi: 878,
  thriller: 53,
  'tv movie': 10770,
  war: 10752,
  western: 37
});

/**
 * `Horror` → 27. Null for anything TMDB has no genre for, so a caller can
 * show nothing rather than quietly asking for the wrong thing — the old
 * code defaulted an unknown genre to 18 (Drama), which is its own small
 * lie.
 */
export function genreIdFor (name) {
  if (typeof name !== 'string') return null;
  const key = name.trim().toLowerCase();
  return TMDB_GENRE_IDS[key] ?? null;
}

// The other direction: 27 -> "Horror".
//
// Derived from TMDB_GENRE_IDS rather than written out again, so the two can
// never disagree. Several names map to the same id ("sci-fi", "scifi",
// "science fiction" are all 878); the FIRST one wins, which is why the map
// above lists the canonical spelling first in each of those groups.
const NAME_BY_ID = Object.freeze(
  Object.entries(TMDB_GENRE_IDS).reduce((byId, [name, id]) => {
    if (!(id in byId)) byId[id] = name.replace(/\b\w/g, (c) => c.toUpperCase());
    return byId;
  }, {})
);

/** `27` → "Horror". Null for an id TMDB has no name for here. */
export function genreNameFor (id) {
  return NAME_BY_ID[id] || null;
}

// Shared, store-free helpers for the Games section (src/components/games/).
// Kept pure/testable on purpose — see the "Search/Filter/Sort Extraction"
// precedent in CLAUDE.md: logic modules take explicit inputs, components stay
// thin wiring layers.

// A movie needs a poster (games are poster-driven), a release date (used for
// year/decade clues and sorting games), and at least one rating (nothing to
// guess/compare/rank otherwise) to be usable by any game. Also respects the
// user's "include shorts" library setting (default excluded) — same
// runtime<=40min threshold Home.vue's own filtering uses — so a short that's
// hidden everywhere else on the site doesn't still turn up in a game.
export function getEligibleEntries (allMediaAsArray, includeShorts = false) {
  return (allMediaAsArray || []).filter((entry) => {
    const isEligible = Boolean(
      entry &&
      entry.movie &&
      entry.movie.poster_path &&
      entry.movie.release_date &&
      Array.isArray(entry.ratings) &&
      entry.ratings.length > 0
    );
    if (!isEligible) return false;
    if (includeShorts) return true;
    return !(entry.movie.runtime && entry.movie.runtime <= 40);
  });
}

export function ratingFor (entry, getRatingFn) {
  if (!entry) return 0;
  const rating = getRatingFn(entry);
  return (rating && typeof rating.calculatedTotal === 'number') ? rating.calculatedTotal : 0;
}

// djb2-ish string hash -> unsigned 32-bit int. Deterministic across
// browsers/sessions, which is what lets the "daily" games pick the same
// puzzle for everyone on the same calendar day without any server.
export function hashString (str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash * 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

// mulberry32 PRNG. Small, fast, good-enough distribution for a guessing
// game (not cryptographic). Returns a function you call repeatedly for a
// stream of [0, 1) values seeded from a single integer.
export function makeSeededRng (seed) {
  let state = seed >>> 0;
  return function next () {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle (array, rng = Math.random) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function pickRandomDistinct (array, count, rng = Math.random) {
  return shuffle(array, rng).slice(0, count);
}

export function movieYear (entry) {
  if (!entry?.movie?.release_date) return null;
  const year = new Date(entry.movie.release_date).getFullYear();
  return Number.isNaN(year) ? null : year;
}

export function movieDecade (entry) {
  const year = movieYear(entry);
  return year ? Math.floor(year / 10) * 10 : null;
}

export function movieDirectors (entry) {
  const crew = entry?.movie?.crew || [];
  return crew.filter((member) => member.job === 'Director').map((member) => member.name);
}

export function movieCastNames (entry, limit = 6) {
  const cast = entry?.movie?.cast || [];
  return cast.slice(0, limit).map((member) => member.name);
}

export function movieGenreNames (entry) {
  return (entry?.movie?.genres || []).map((genre) => genre.name);
}

// Stable identity for a db entry across the games modules — prefers the
// Firebase dbKey (unique per rating entry), falling back to the TMDB movie
// id for entries that don't carry one (e.g. synthetic test fixtures).
export function entryKey (entry) {
  return entry?.dbKey || entry?.movie?.id;
}

// Compares two numbers and describes which way `guessValue` needs to move to
// reach `targetValue` — the vocabulary Wordle-style clue UIs need ("guess
// higher" / "guess lower" / exact match). Returns null direction when either
// value is missing (nothing sensible to compare).
export function compareNumber (guessValue, targetValue) {
  if (guessValue == null || targetValue == null) {
    return { value: guessValue, direction: null, match: false };
  }
  if (guessValue === targetValue) {
    return { value: guessValue, direction: 'match', match: true };
  }
  return { value: guessValue, direction: guessValue < targetValue ? 'up' : 'down', match: false };
}

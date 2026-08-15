// Pure, store-free logic for the Watchlist screen (bug-report request:
// "generate watchlists based on my ratings and also maybe a way to make a
// list of movies that I should consider rewatching").
//
// Three pieces, all fed explicit inputs (the searchFiltering.js precedent):
//   - rewatchCandidates: library movies you loved but haven't logged in a
//     long time — entirely local, no network.
//   - favoritePeople: the directors/actors your OWN ratings say you love,
//     used to seed the TMDB watchlist queries.
//   - rankWatchlistCandidates: turns those people's TMDB filmographies into
//     one deduped, unseen-only, quality-ranked list.

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

// Tolerates ms-epoch numbers and date strings; null when nothing parses.
function lastWatchedAt (entry) {
  const times = (entry?.ratings || [])
    .map((rating) => new Date(rating?.date ?? NaN).getTime())
    .filter((time) => Number.isFinite(time));
  return times.length ? Math.max(...times) : null;
}

// How-loved × long-unwatched: score = (rating's margin above the entry
// threshold) * sqrt(years). Scoring the MARGIN rather than the raw rating
// is what keeps "9.0 from 3 years ago" ahead of "7.2 from 8 years ago" —
// with raw ratings, every qualifying score is within ~30% of every other,
// so sqrt(age) dominated and the list was just "oldest first."
export function rewatchCandidates (entries, getRatingFn, now = Date.now(), { minRating = 7, minYears = 1, cap = 24 } = {}) {
  return (entries || [])
    .map((entry) => {
      const rating = getRatingFn(entry)?.calculatedTotal;
      const watchedAt = lastWatchedAt(entry);
      if (!Number.isFinite(rating) || rating < minRating || watchedAt == null) return null;
      const yearsSince = (now - watchedAt) / YEAR_MS;
      if (yearsSince < minYears) return null;
      const margin = rating - (minRating - 0.5);
      return { entry, rating, yearsSince, score: margin * Math.sqrt(yearsSince) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, cap);
}

// The people your ratings actually favor: average score of their movies in
// YOUR library, weighted by how many there are (avg * log2(count + 1)) so
// one great movie doesn't beat a consistently-loved filmography. role is
// 'director' (crew job === 'Director') or 'actor' (top-billed cast).
export function favoritePeople (entries, getRatingFn, { role = 'director', minMovies = 2, cap = 3, castDepth = 5 } = {}) {
  const byName = new Map();

  (entries || []).forEach((entry) => {
    const rating = getRatingFn(entry)?.calculatedTotal;
    if (!Number.isFinite(rating)) return;

    const names = role === 'director'
      ? (entry?.movie?.crew || []).filter((person) => person.job === 'Director').map((person) => person.name)
      : (entry?.movie?.cast || []).slice(0, castDepth).map((person) => person.name);

    new Set(names.filter(Boolean)).forEach((name) => {
      if (!byName.has(name)) byName.set(name, { name, count: 0, total: 0 });
      const record = byName.get(name);
      record.count += 1;
      record.total += rating;
    });
  });

  return [...byName.values()]
    .filter((person) => person.count >= minMovies)
    .map((person) => ({
      name: person.name,
      count: person.count,
      avgRating: person.total / person.count,
      score: (person.total / person.count) * Math.log2(person.count + 1)
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, cap);
}

// TMDB credit lists -> one watchlist. Drops movies already in the library
// (by TMDB id), unreleased/undated ones, and low-signal entries (too few
// votes to trust the score). Dedupes across people, keeping whichever copy
// arrived first. Ranked by vote_average weighted by vote volume so a 7.9
// with 12k votes beats an 8.6 with 60.
export function rankWatchlistCandidates (credits, ratedTmdbIds, now = Date.now(), { cap = 12, minVotes = 50 } = {}) {
  const rated = ratedTmdbIds instanceof Set ? ratedTmdbIds : new Set(ratedTmdbIds || []);
  const byId = new Map();

  (credits || []).forEach((movie) => {
    if (!movie || movie.id == null || rated.has(movie.id)) return;
    if (movie.adult) return;
    const released = movie.release_date && new Date(movie.release_date).getTime() <= now;
    if (!released) return;
    if ((movie.vote_count || 0) < minVotes) return;
    if (!byId.has(movie.id)) byId.set(movie.id, movie);
  });

  return [...byId.values()]
    .map((movie) => ({ movie, score: (movie.vote_average || 0) * Math.log10((movie.vote_count || 0) + 1) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, cap)
    .map(({ movie }) => movie);
}

// The movies to seed "more like this" recommendations from: your highest
// rated, one per title. Ties keep library order (stable sort).
export function topRatedSeeds (entries, getRatingFn, { cap = 5 } = {}) {
  return (entries || [])
    .filter((entry) => typeof entry?.movie?.id === 'number')
    .map((entry) => ({ entry, rating: getRatingFn(entry)?.calculatedTotal ?? 0 }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, cap)
    .map(({ entry }) => entry);
}

// Every TMDB id already in the library — the "unseen only" filter's input.
export function ratedTmdbIds (entries) {
  return new Set(
    (entries || [])
      .map((entry) => entry?.movie?.id)
      .filter((id) => typeof id === 'number')
  );
}

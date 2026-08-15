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

// Cycle-based rewatching (feedback 2026-08-15: "for my very favorite
// movies, I probably wanna watch them on a two to three year cycle at the
// very top" — the old how-loved x how-long score just reproduced the top
// shelf). Every qualifying movie gets a due CYCLE from how loved it is,
// and the list ranks by how OVERDUE it is relative to its own cycle — so
// favorites resurface often by design, an 8 from six years ago outranks a
// 9.5 from eighteen months ago, and nothing appears before its time.
const REWATCH_CYCLES = [
  { minRating: 9.5, years: 2 },
  { minRating: 9, years: 3 },
  { minRating: 8, years: 5 },
  { minRating: 7, years: 8 }
];

export function rewatchCycleYears (rating) {
  const tier = REWATCH_CYCLES.find((t) => rating >= t.minRating);
  return tier ? tier.years : null;
}

export function rewatchCandidates (entries, getRatingFn, now = Date.now(), { dueThreshold = 1, cap = 24 } = {}) {
  return (entries || [])
    .map((entry) => {
      const rating = getRatingFn(entry)?.calculatedTotal;
      const watchedAt = lastWatchedAt(entry);
      if (!Number.isFinite(rating) || watchedAt == null) return null;
      const cycle = rewatchCycleYears(rating);
      if (cycle == null) return null;
      const yearsSince = (now - watchedAt) / YEAR_MS;
      // Overdue ratio: 1 = exactly due. Capped so an ancient mid-tier
      // movie can't bury every recently-due favorite.
      const overdue = Math.min(yearsSince / cycle, 3);
      if (overdue < dueThreshold) return null;
      return { entry, rating, yearsSince, cycle, overdue, score: overdue };
    })
    .filter(Boolean)
    .sort((a, b) => (b.score - a.score) || (b.rating - a.rating))
    .slice(0, cap);
}

// "Give these another shot" (feedback 2026-08-15): movies YOU rated coolly
// that the wider world loves — ranked by the differential between TMDB's
// community average and your own score. Needs movie.vote_average /
// vote_count in the stored shape (backfilled server-side like taglines);
// entries without them are skipped, and a vote-count floor keeps
// obscure-but-inflated titles out.
export function anotherShotCandidates (entries, getRatingFn, now = Date.now(), {
  maxYourRating = 6.5,
  minCommunity = 7.4,
  minVotes = 200,
  minYears = 1,
  cap = 24
} = {}) {
  return (entries || [])
    .map((entry) => {
      const yours = getRatingFn(entry)?.calculatedTotal;
      const community = entry?.movie?.vote_average;
      const votes = entry?.movie?.vote_count;
      const watchedAt = lastWatchedAt(entry);
      if (!Number.isFinite(yours) || !Number.isFinite(community) || watchedAt == null) return null;
      if (yours > maxYourRating || community < minCommunity) return null;
      if (!Number.isFinite(votes) || votes < minVotes) return null;
      const yearsSince = (now - watchedAt) / YEAR_MS;
      if (yearsSince < minYears) return null;
      return { entry, yours, community, yearsSince, score: community - yours };
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

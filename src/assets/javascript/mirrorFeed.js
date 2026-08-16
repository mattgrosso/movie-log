// Magic Mirror feed (bug report -P-7I-bLDAUWmPJm7WtS, 2026-08-16).
//
// Matt's Magic Mirror used to read his whole movieLog over unauthenticated
// REST. The 2026-08-14 rules lockdown denies that — correctly — so instead
// of reopening the library, Cinema Roll PUBLISHES a small feed with exactly
// what the mirror renders. Same publish-don't-peek shape as the social
// profile: the private branch stays private, and a few KB of derived data
// is readable at an unguessable path.
//
// Payload is deliberately shaped like the entries the mirror's components
// already consume (`entry.movie.poster_path`), so the mirror needed almost
// no rewriting.

const DAY_MS = 1000 * 60 * 60 * 24;

function mostRecentRatingDate (entry) {
  const times = (entry?.ratings || [])
    .map((rating) => new Date(rating?.date ?? NaN).getTime())
    .filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

function compact (entry, rating, watchedAt) {
  return {
    movie: {
      id: entry.movie.id,
      title: entry.movie.title || '',
      poster_path: entry.movie.poster_path || null
    },
    rating: Number.isFinite(rating) ? Math.round(rating * 100) / 100 : null,
    watchedAt: watchedAt ?? null
  };
}

export function buildMirrorFeed (entries, getRatingFn, { now = Date.now(), recentCount = 8, monthCount = 5 } = {}) {
  const rated = [];
  const ratedIds = [];

  (entries || []).forEach((entry) => {
    const id = entry?.movie?.id;
    if (id == null) return;
    ratedIds.push(id);
    const rating = getRatingFn(entry)?.calculatedTotal;
    rated.push({ entry, rating, watchedAt: mostRecentRatingDate(entry) });
  });

  const withDates = rated.filter((row) => row.watchedAt != null);

  const recent = [...withDates]
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .slice(0, recentCount)
    .map((row) => compact(row.entry, row.rating, row.watchedAt));

  // "This month" matches the mirror's own rule: rated within the last 30
  // days, best score first.
  const topThisMonth = withDates
    .filter((row) => (now - row.watchedAt) / DAY_MS <= 30)
    .filter((row) => Number.isFinite(row.rating))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, monthCount)
    .map((row) => compact(row.entry, row.rating, row.watchedAt));

  return {
    updatedAt: now,
    recent,
    topThisMonth,
    // Lets the mirror answer "has this Movie Hat pick been rated yet?"
    // locally, without any further reads.
    ratedIds
  };
}

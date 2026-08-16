// Film Club Interchange — letting a friend on a different app appear in
// your Film Club as an ordinary friend (Matt, 2026-08-16).
//
// Cinema Roll and Brian's Movie Log descend from the same code, so they
// record the SAME eight criteria per viewing. Movie Log calls stickiness
// "impression" (Cinema Roll's own legacy name for it, still honoured in
// GetRating.js) and nests everything under movie.tmdb; otherwise the data
// lines up almost field for field.
//
// This module defines one small, versioned, NAMED format both apps can
// publish and consume, plus an adapter that reads Movie Log's raw records
// directly — so the other app doesn't have to implement anything for us to
// consume it. Everything here is pure; fetching and storage live elsewhere.

export const INTERCHANGE_FORMAT = 'film-club/1';

// Deliberately named rather than positional: an interop payload should be
// readable by a stranger without consulting our source.
export const CRITERIA_KEYS = ['love', 'overall', 'stickiness', 'story', 'direction', 'imagery', 'performance', 'soundtrack'];

// Movie Log's field name for stickiness.
const FOREIGN_STICKINESS = 'impression';

function num (value) {
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

function timestamp (value) {
  const ms = new Date(value ?? NaN).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function criteriaFrom (source, { stickinessKey = 'stickiness' } = {}) {
  if (!source) return null;
  const out = {};
  CRITERIA_KEYS.forEach((key) => {
    const raw = key === 'stickiness' ? source[stickinessKey] ?? source.stickiness : source[key];
    const value = num(raw);
    if (value !== null) out[key] = value;
  });
  return Object.keys(out).length ? out : null;
}

// ---------------------------------------------------------------------------
// PUBLISH: our library -> the interchange format.
export function toInterchange (entries, getRatingFn, { name, source = 'cinemaroll', now = Date.now() } = {}) {
  const movies = [];

  (entries || []).forEach((entry) => {
    const tmdbId = entry?.movie?.id;
    const rating = num(getRatingFn(entry)?.calculatedTotal);
    if (tmdbId == null || rating === null) return;

    const viewings = (entry.ratings || [])
      .map((row) => ({ watchedAt: timestamp(row?.date), medium: row?.medium || null }))
      .filter((viewing) => viewing.watchedAt !== null)
      .sort((a, b) => b.watchedAt - a.watchedAt)
      .map((viewing) => (viewing.medium ? viewing : { watchedAt: viewing.watchedAt }));

    const latest = [...(entry.ratings || [])]
      .sort((a, b) => (timestamp(b?.date) || 0) - (timestamp(a?.date) || 0))[0];

    const movie = {
      tmdbId: Number(tmdbId),
      title: entry.movie.title || '',
      posterPath: entry.movie.poster_path || null,
      year: new Date(entry.movie.release_date ?? NaN).getFullYear() || null,
      rating: Math.round(rating * 100) / 100
    };
    const criteria = criteriaFrom(latest);
    if (criteria) movie.criteria = criteria;
    if (viewings.length) movie.viewings = viewings;
    movies.push(movie);
  });

  return {
    format: INTERCHANGE_FORMAT,
    source,
    name: name || 'A friend',
    // Cheap change detection: a subscriber that has seen this marker can
    // stop without parsing the rest.
    marker: now,
    movieCount: movies.length,
    movies
  };
}

// ---------------------------------------------------------------------------
// CONSUME: any supported payload -> the profile shape Film Club renders
// (the same shape social.js publishes), so an external friend is
// indistinguishable from a Cinema Roll one.
export function detectFormat (payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.format === 'string' && payload.format.startsWith('film-club/')) return 'interchange';
  // Movie Log: either the raw record map/array, or an object of them.
  const sample = Array.isArray(payload) ? payload[0] : Object.values(payload)[0];
  if (sample && typeof sample === 'object' && sample.movie && Array.isArray(sample.movie.viewings)) return 'movielog';
  if (payload.movie && Array.isArray(payload.movie.viewings)) return 'movielog';
  return null;
}

function profileFromMovies (movies, { name, source, marker }) {
  const withRatings = movies.filter((movie) => Number.isFinite(movie.rating));
  const byRating = [...withRatings].sort((a, b) => b.rating - a.rating);
  const lastWatched = (movie) => movie.viewings?.[0]?.watchedAt ?? null;
  const byRecency = withRatings.filter(lastWatched).sort((a, b) => lastWatched(b) - lastWatched(a));

  const ratings = {};
  withRatings.forEach((movie) => {
    const row = {
      r: movie.rating,
      at: lastWatched(movie),
      t: movie.title,
      p: movie.posterPath || null
    };
    if (movie.criteria) row.c = CRITERIA_KEYS.map((key) => (Number.isFinite(movie.criteria[key]) ? movie.criteria[key] : -1));
    if (movie.viewings?.length) {
      row.v = movie.viewings.map((viewing) => (viewing.medium ? { at: viewing.watchedAt, m: viewing.medium } : { at: viewing.watchedAt }));
    }
    ratings[movie.tmdbId] = row;
  });

  const shelf = (movie) => ({ id: movie.tmdbId, t: movie.title, p: movie.posterPath || null, r: movie.rating });

  return {
    name: name || 'A friend',
    source: source || 'external',
    updatedAt: marker || Date.now(),
    counts: {
      titles: withRatings.length,
      viewings: withRatings.reduce((sum, movie) => sum + Math.max(1, movie.viewings?.length || 1), 0)
    },
    topShelf: byRating.slice(0, 10).map(shelf),
    recent: byRecency.slice(0, 20).map((movie) => ({
      ...shelf(movie),
      at: lastWatched(movie),
      ...(movie.viewings?.[0]?.medium ? { m: movie.viewings[0].medium } : {})
    })),
    crown: null,
    ratings
  };
}

export function fromInterchange (payload) {
  if (!payload || !Array.isArray(payload.movies)) return null;
  const movies = payload.movies
    .map((movie) => ({
      tmdbId: Number(movie?.tmdbId),
      title: movie?.title || '',
      posterPath: movie?.posterPath || null,
      rating: num(movie?.rating),
      criteria: movie?.criteria || null,
      viewings: Array.isArray(movie?.viewings)
        ? movie.viewings
          .map((viewing) => ({ watchedAt: timestamp(viewing?.watchedAt), medium: viewing?.medium || null }))
          .filter((viewing) => viewing.watchedAt !== null)
          .sort((a, b) => b.watchedAt - a.watchedAt)
        : []
    }))
    .filter((movie) => Number.isFinite(movie.tmdbId));

  return profileFromMovies(movies, { name: payload.name, source: payload.source, marker: payload.marker });
}

// Movie Log's own records, unmodified — so Brian only has to expose data,
// not transform it. Records look like:
//   { movieId, movie: { title, year, tmdb: { id, poster_path },
//                       viewings: [{ date, medium, rating, love, impression, … }] } }
export function fromMovieLog (payload, { name = 'A Movie Log friend' } = {}) {
  const records = Array.isArray(payload)
    ? payload
    : Object.values(payload || {}).filter((value) => value && typeof value === 'object');

  const movies = records.map((record) => {
    const inner = record?.movie || record;
    const tmdbId = Number(record?.movieId ?? inner?.tmdb?.id);
    if (!Number.isFinite(tmdbId)) return null;

    const viewings = (inner?.viewings || [])
      .map((viewing) => ({ watchedAt: timestamp(viewing?.date), medium: viewing?.medium || null, raw: viewing }))
      .filter((viewing) => viewing.watchedAt !== null)
      .sort((a, b) => b.watchedAt - a.watchedAt);

    const latest = viewings[0]?.raw || (inner?.viewings || [])[0] || null;
    const rating = num(latest?.rating);
    if (rating === null) return null;

    return {
      tmdbId,
      title: inner?.title || '',
      posterPath: inner?.tmdb?.poster_path || null,
      rating,
      criteria: criteriaFrom(latest, { stickinessKey: FOREIGN_STICKINESS }),
      viewings: viewings.map(({ watchedAt, medium }) => ({ watchedAt, medium }))
    };
  }).filter(Boolean);

  return profileFromMovies(movies, { name, source: 'movielog', marker: Date.now() });
}

// One entry point for a subscriber: hand it whatever a friend's feed
// returned and get a renderable profile, or null if it isn't recognisable.
export function profileFromFeed (payload, { fallbackName } = {}) {
  const format = detectFormat(payload);
  if (format === 'interchange') {
    const profile = fromInterchange(payload);
    if (profile && fallbackName && !payload.name) profile.name = fallbackName;
    return profile;
  }
  if (format === 'movielog') return fromMovieLog(payload, { name: fallbackName });
  return null;
}

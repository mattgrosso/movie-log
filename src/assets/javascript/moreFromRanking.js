// Ranking for the "More from…" row.
//
// The section's job, in Matt's words (2026-08-18): "it could see what you
// were filtering with and give movies related to that filter that you have
// not watched. It's like a little watch list with each filter."
//
// What it used to do instead: sort TMDB's results by raw popularity, then
// apply a LINEAR cutoff across the popularity range — `min + (max - min) *
// 0.4`. Popularity is heavily skewed, so a single blockbuster in the set
// dragged `max` so high that the cutoff wiped out nearly everything; the
// "if fewer than 12 survive, use the top 12 anyway" fallback then quietly
// undid it. So the three tuning numbers rarely did anything, and what you
// actually saw was "the 12 most popular", which is the one list you can get
// anywhere.
//
// A watchlist for a filter should answer "which of these is worth MY time",
// so this ranks on three things:
//
//   quality     what the crowd thinks, with small-sample scores pulled
//               toward the mean so a 9.4 from 40 votes doesn't beat an 8.4
//               from 20,000
//   affinity    how you rate this movie's genres compared to how you rate
//               everything — the part TMDB cannot know
//   reach       a little popularity, as a floor against total obscurity
//
// Everything here is pure, so the weighting can be argued with in tests
// rather than in production.

const QUALITY_WEIGHT = 0.5;
const AFFINITY_WEIGHT = 0.3;
const REACH_WEIGHT = 0.2;

// TMDB's global average sits near here; it is the value a film with no
// votes is assumed to deserve until proven otherwise.
const PRIOR_SCORE = 6.6;
const PRIOR_VOTES = 300;

// Below this many rated films in a genre, your average for it says more
// about chance than taste.
const MIN_GENRE_SAMPLE = 3;

// How far above/below your own average a genre has to sit to count as a
// full like/dislike. Two rating points is a lot on this app's 0-10 scale.
const AFFINITY_SPREAD = 2;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * A rating you can compare across sample sizes: the film's own score pulled
 * toward the crowd mean in proportion to how little is known about it.
 * (The standard weighted-rating formula.)
 */
export function weightedRating (voteAverage, voteCount, { prior = PRIOR_SCORE, priorVotes = PRIOR_VOTES } = {}) {
  const score = Number(voteAverage);
  const votes = Number(voteCount);

  if (!Number.isFinite(score) || score <= 0) return prior;
  if (!Number.isFinite(votes) || votes <= 0) return prior;

  return ((votes / (votes + priorVotes)) * score) + ((priorVotes / (votes + priorVotes)) * prior);
}

/**
 * How you feel about each genre, as a 0–1 score with 0.5 meaning "no
 * different from anything else you watch".
 *
 * @param entries   your library
 * @param getScore  entry → your rating out of 10 (null when unrated)
 */
export function genreAffinity (entries, getScore) {
  const byGenre = new Map();
  let total = 0;
  let counted = 0;

  (entries || []).forEach((entry) => {
    const score = getScore(entry);
    if (!Number.isFinite(score)) return;

    total += score;
    counted += 1;

    (entry?.movie?.genres || []).forEach((genre) => {
      const id = genre?.id;
      if (id == null) return;
      const bucket = byGenre.get(id) || { total: 0, count: 0 };
      bucket.total += score;
      bucket.count += 1;
      byGenre.set(id, bucket);
    });
  });

  if (!counted) return new Map();

  const overall = total / counted;
  const affinity = new Map();

  byGenre.forEach((bucket, id) => {
    if (bucket.count < MIN_GENRE_SAMPLE) return;
    const delta = (bucket.total / bucket.count) - overall;
    affinity.set(id, clamp(0.5 + (delta / AFFINITY_SPREAD / 2), 0, 1));
  });

  return affinity;
}

/** The average of a candidate's genre affinities; 0.5 when nothing is known. */
export function affinityFor (movie, affinity) {
  const ids = movie?.genre_ids || (movie?.genres || []).map((genre) => genre?.id);
  const known = (ids || [])
    .map((id) => affinity?.get?.(id))
    .filter((value) => Number.isFinite(value));

  if (!known.length) return 0.5;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

/**
 * One candidate's score out of 1. `popularityCeiling` is the most popular
 * thing in this batch, so reach is judged against the company it is
 * actually keeping rather than against all of cinema.
 */
export function scoreCandidate (movie, { affinity, popularityCeiling = 0 } = {}) {
  const quality = weightedRating(movie?.vote_average, movie?.vote_count) / 10;

  const popularity = Number(movie?.popularity);
  // Logarithmic: the gap between 5 and 50 matters, the gap between 500 and
  // 900 does not.
  const reach = popularityCeiling > 0 && Number.isFinite(popularity) && popularity > 0
    ? Math.log10(1 + popularity) / Math.log10(1 + popularityCeiling)
    : 0;

  return (QUALITY_WEIGHT * clamp(quality, 0, 1)) +
    (AFFINITY_WEIGHT * affinityFor(movie, affinity)) +
    (REACH_WEIGHT * clamp(reach, 0, 1));
}

/**
 * The row itself: everything you haven't seen, best first.
 *
 * `exclude` is every TMDB id already accounted for — in your library, or
 * waiting in a hat. Suggesting something you have already decided to watch
 * is the one thing a watchlist must not do.
 */
export function rankMoreFrom (candidates, { exclude, affinity, limit = 18 } = {}) {
  const excluded = exclude instanceof Set ? exclude : new Set(exclude || []);
  const seen = new Set();
  const usable = [];

  (candidates || []).forEach((movie) => {
    const id = movie?.id;
    if (id == null || !movie?.poster_path) return;
    if (excluded.has(id) || excluded.has(String(id)) || seen.has(id)) return;
    seen.add(id);
    usable.push(movie);
  });

  if (!usable.length) return [];

  const popularityCeiling = usable.reduce(
    (max, movie) => Math.max(max, Number(movie.popularity) || 0), 0
  );

  return usable
    .map((movie) => ({ movie, score: scoreCandidate(movie, { affinity, popularityCeiling }) }))
    .sort((a, b) =>
      b.score - a.score ||
      // Stable, explicable tie-breaks rather than whatever order TMDB sent.
      (Number(b.movie.vote_average) || 0) - (Number(a.movie.vote_average) || 0) ||
      String(a.movie.title || '').localeCompare(String(b.movie.title || ''))
    )
    .slice(0, limit)
    .map((entry) => entry.movie);
}

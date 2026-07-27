// Pure, store-free helper for the Settings panel's "Backfill box office
// data" action. AddRating.js now stores budget/revenue for every movie
// rated/re-rated going forward (see MovieDetail.vue's Box Office section),
// but that leaves every movie already in the library without it - "always
// work even on all the movies I've already rated" was the explicit ask, not
// "only for the next rating." This is the one-time catch-up for the
// existing library, following the same concurrency/progress-reporting shape
// offlinePosterCache.js's warmImageCache already established for the
// "Download all posters for offline" button.
import axios from 'axios';

// Movies still missing box office data: real (non-placeholder) TMDB ids
// only - an offline placeholder rating (see placeholderId.js) has no real
// TMDB id to look up yet, only becomes eligible once reconciled.
export function collectMoviesNeedingBoxOffice (movieLog) {
  return Object.keys(movieLog || {})
    .map((dbKey) => ({ dbKey, entry: movieLog[dbKey] }))
    .filter(({ entry }) => {
      const movie = entry?.movie;
      if (!movie || movie.isPendingReconciliation || movie.id == null) return false;
      return !movie.budget && !movie.revenue;
    });
}

// TMDB's /movie/{id} response includes budget/revenue directly - the same
// single endpoint AddRating.js's getTMDBData already relies on for this,
// just without the credits/keywords calls this backfill doesn't need.
export async function fetchBoxOffice (tmdbId, fetchFn = axios.get) {
  const apiKey = process.env.VUE_APP_TMDB_API_KEY;
  const response = await fetchFn(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`);
  return {
    budget: response.data.budget || 0,
    revenue: response.data.revenue || 0
  };
}

// writeFn(dbKey, boxOffice, entry) does the actual persistence + local state
// commit - injected rather than importing the store directly, so this
// module stays pure/store-free and unit-testable without mounting anything
// (same convention as searchFiltering.js/entityCounts.js/etc.).
//
// Idempotent/safe to re-run: a movie is only ever a candidate while it's
// still missing both fields, so pressing the button again after a partial
// run (or a later batch of new ratings) only fetches what's actually still
// needed - already-backfilled movies are skipped for free by
// collectMoviesNeedingBoxOffice, no separate "already tried" bookkeeping.
export async function backfillBoxOffice (movieLog, writeFn, { concurrency = 4, fetchFn = axios.get, onProgress, signal } = {}) {
  const candidates = collectMoviesNeedingBoxOffice(movieLog);
  const total = candidates.length;
  let completed = 0;
  let failed = 0;
  let nextIndex = 0;

  async function worker () {
    while (nextIndex < candidates.length) {
      if (signal?.aborted) {
        return;
      }
      const { dbKey, entry } = candidates[nextIndex];
      nextIndex += 1;

      try {
        const boxOffice = await fetchBoxOffice(entry.movie.id, fetchFn);
        await writeFn(dbKey, boxOffice, entry);
      } catch (error) {
        failed += 1;
      }

      completed += 1;
      if (onProgress) {
        onProgress({ completed, total, failed });
      }
    }
  }

  const workerCount = Math.min(concurrency, candidates.length) || 1;
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return { completed, total, failed };
}

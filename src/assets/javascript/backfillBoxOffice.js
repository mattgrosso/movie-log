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

// writeBatchFn(batch) persists a whole BATCH at once - batch is
// [{ dbKey, boxOffice, entry }, ...], up to `batchSize` long. Injected
// rather than importing the store directly, so this module stays
// pure/store-free and unit-testable without mounting anything (same
// convention as searchFiltering.js/entityCounts.js/etc.).
//
// Batched on purpose (bug fix, Jul 2026): an earlier per-item design called
// the equivalent of writeBatchFn once per movie as each one finished - for a
// real library that's hundreds of full-movieLog-copy-plus-reactivity-cascade
// events firing in rapid succession, severe enough to freeze and crash a
// real device's tab. Fetches still happen with full `concurrency` (cheap,
// no local state touched), but writes are accumulated and flushed in
// batches of `batchSize`, so the expensive part (persistence + whatever
// reactive recomputation it triggers) happens a small fraction as often.
//
// Idempotent/safe to re-run: a movie is only ever a candidate while it's
// still missing both fields, so pressing the button again after a partial
// run (or a later batch of new ratings) only fetches what's actually still
// needed - already-backfilled movies are skipped for free by
// collectMoviesNeedingBoxOffice, no separate "already tried" bookkeeping.
export async function backfillBoxOffice (movieLog, writeBatchFn, { concurrency = 4, batchSize = 20, fetchFn = axios.get, onProgress, signal } = {}) {
  const candidates = collectMoviesNeedingBoxOffice(movieLog);
  const total = candidates.length;
  let completed = 0;
  let failed = 0;
  let nextIndex = 0;
  let pending = [];

  // Grab-and-clear happens synchronously (no `await` before it), so this is
  // safe to call from multiple concurrent workers without racing each other
  // - whichever call's synchronous code runs first empties `pending`, any
  // other call in flight around the same time sees it already empty and
  // no-ops. JS's single-threaded, run-to-completion semantics guarantee
  // this without needing an explicit lock.
  async function flush (force) {
    if (!pending.length) return;
    if (!force && pending.length < batchSize) return;
    const batch = pending;
    pending = [];
    try {
      await writeBatchFn(batch);
    } catch (error) {
      failed += batch.length;
    }
  }

  async function worker () {
    while (nextIndex < candidates.length) {
      if (signal?.aborted) {
        break;
      }
      const { dbKey, entry } = candidates[nextIndex];
      nextIndex += 1;

      try {
        const boxOffice = await fetchBoxOffice(entry.movie.id, fetchFn);
        pending.push({ dbKey, boxOffice, entry });
        await flush(false);
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
  await flush(true); // whatever's left over, shorter than a full batch

  return { completed, total, failed };
}

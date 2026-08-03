// Pure, store-free helper for the Settings panel's "Backfill box office
// data" action. AddRating.js now stores budget/revenue for every movie
// rated/re-rated going forward (see MovieDetail.vue's Box Office section),
// but that leaves every movie already in the library without it - "always
// work even on all the movies I've already rated" was the explicit ask, not
// "only for the next rating." This is the one-time catch-up for the
// existing library.
//
// The concurrency/batched-write machinery lives in tmdbBackfill.js, shared
// with the production-countries backfill.
import axios from 'axios';
import { runTmdbBackfill, hasRealTmdbId } from './tmdbBackfill.js';

// Movies still missing box office data.
//
// Note this can't distinguish "TMDB has no figures for this film" from "never
// fetched", because TMDB uses 0 for both. So a genuinely figure-less film
// stays a candidate on every future run - a handful of wasted re-fetches,
// deliberately traded for not needing a separate "already checked" marker.
// (movieLocations.js can make that distinction and does.)
export function collectMoviesNeedingBoxOffice (movieLog) {
  return Object.keys(movieLog || {})
    .map((dbKey) => ({ dbKey, entry: movieLog[dbKey] }))
    .filter(({ entry }) => hasRealTmdbId(entry) && !entry.movie.budget && !entry.movie.revenue);
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
// [{ dbKey, boxOffice, entry }, ...]. Injected rather than importing the store
// directly, so this module stays pure and unit-testable without mounting
// anything (same convention as searchFiltering.js/entityCounts.js/etc.).
export async function backfillBoxOffice (movieLog, writeBatchFn, options = {}) {
  const { fetchFn = axios.get, ...rest } = options;

  return runTmdbBackfill(collectMoviesNeedingBoxOffice(movieLog), {
    ...rest,
    writeBatchFn,
    fetchOne: (entry) => fetchBoxOffice(entry.movie.id, fetchFn),
    makeItem: ({ dbKey, entry }, boxOffice) => ({ dbKey, boxOffice, entry })
  });
}

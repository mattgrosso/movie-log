// Catch-up for production countries / spoken languages on movies rated before
// AddRating.js started keeping them.
//
// These come back on the very same /movie/{id} call the app already makes —
// they were simply never stored, so the library had them for 1 movie out of
// ~1,400. Same shape and machinery as the box office backfill (see
// tmdbBackfill.js); only the "what's missing" test and the fetch differ.
import axios from 'axios';
import { runTmdbBackfill, hasRealTmdbId } from './tmdbBackfill.js';

// Unlike box office, "no data" here is genuinely representable: TMDB returns
// an empty array, and an empty array stored is meaningfully different from the
// field being absent. So a film TMDB knows nothing about is only ever fetched
// once, rather than being re-checked on every future run.
export function collectMoviesNeedingCountries (movieLog) {
  return Object.keys(movieLog || {})
    .map((dbKey) => ({ dbKey, entry: movieLog[dbKey] }))
    .filter(({ entry }) => hasRealTmdbId(entry) && entry.movie.production_countries === undefined);
}

export async function fetchProductionCountries (tmdbId, fetchFn = axios.get) {
  const apiKey = process.env.VUE_APP_TMDB_API_KEY;
  const response = await fetchFn(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`);

  return {
    production_countries: response.data.production_countries || [],
    spoken_languages: response.data.spoken_languages || []
  };
}

// writeBatchFn(batch) receives [{ dbKey, entry, countries }, ...].
export async function backfillProductionCountries (movieLog, writeBatchFn, options = {}) {
  const { fetchFn = axios.get, ...rest } = options;

  return runTmdbBackfill(collectMoviesNeedingCountries(movieLog), {
    ...rest,
    writeBatchFn,
    fetchOne: (entry) => fetchProductionCountries(entry.movie.id, fetchFn),
    makeItem: ({ dbKey, entry }, countries) => ({ dbKey, entry, countries })
  });
}

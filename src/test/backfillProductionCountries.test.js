import { describe, it, expect, vi } from 'vitest';
import {
  collectMoviesNeedingCountries,
  fetchProductionCountries,
  backfillProductionCountries
} from '@/assets/javascript/backfillProductionCountries.js';

const okResponse = (data) => Promise.resolve({ data });

describe('collectMoviesNeedingCountries', () => {
  const log = {
    never: { movie: { id: 1 } },
    hasCountries: { movie: { id: 2, production_countries: [{ name: 'France' }] } },
    checkedEmpty: { movie: { id: 3, production_countries: [] } },
    placeholder: { movie: { id: 'offline-abc', isPendingReconciliation: true } },
    noMovie: {}
  };

  it('selects only movies that have never been checked', () => {
    expect(collectMoviesNeedingCountries(log).map((c) => c.dbKey)).toEqual(['never']);
  });

  it('treats an empty array as "checked, TMDB had nothing" and does not re-fetch it', () => {
    // Unlike box office, empty is representable here, so a country-less film
    // is fetched once rather than on every future run.
    expect(collectMoviesNeedingCountries(log).map((c) => c.dbKey)).not.toContain('checkedEmpty');
  });

  it('skips offline placeholders', () => {
    expect(collectMoviesNeedingCountries(log).map((c) => c.dbKey)).not.toContain('placeholder');
  });

  it('tolerates an empty log', () => {
    expect(collectMoviesNeedingCountries(null)).toEqual([]);
  });
});

describe('fetchProductionCountries', () => {
  it('pulls both countries and languages off the one /movie call', async () => {
    const fetchFn = vi.fn(() => okResponse({
      production_countries: [{ iso_3166_1: 'FR', name: 'France' }],
      spoken_languages: [{ iso_639_1: 'fr', english_name: 'French' }]
    }));

    const result = await fetchProductionCountries(42, fetchFn);

    expect(fetchFn.mock.calls[0][0]).toContain('/movie/42');
    expect(result.production_countries).toHaveLength(1);
    expect(result.spoken_languages).toHaveLength(1);
  });

  it('normalises missing fields to empty arrays', async () => {
    const result = await fetchProductionCountries(42, () => okResponse({}));
    expect(result).toEqual({ production_countries: [], spoken_languages: [] });
  });
});

describe('backfillProductionCountries', () => {
  const makeLog = (count) => Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`key-${i}`, { movie: { id: i + 1 } }])
  );

  it('writes the fetched data in batches, not one call per movie', async () => {
    const writeBatchFn = vi.fn();
    const fetchFn = vi.fn(() => okResponse({ production_countries: [{ name: 'France' }], spoken_languages: [] }));

    const result = await backfillProductionCountries(makeLog(10), writeBatchFn, { fetchFn, batchSize: 20 });

    // Batched writes are a bug fix, not an optimisation — a per-movie design
    // previously froze the tab on a real library.
    expect(writeBatchFn).toHaveBeenCalledTimes(1);
    expect(writeBatchFn.mock.calls[0][0]).toHaveLength(10);
    expect(writeBatchFn.mock.calls[0][0][0].countries.production_countries).toHaveLength(1);
    expect(result).toMatchObject({ completed: 10, total: 10, failed: 0 });
  });

  it('records a failure without aborting the rest of the run', async () => {
    const fetchFn = vi.fn((url) => (url.includes('/movie/2')
      ? Promise.reject(new Error('boom'))
      : okResponse({ production_countries: [], spoken_languages: [] })));

    const result = await backfillProductionCountries(makeLog(3), vi.fn(), { fetchFn, concurrency: 1 });

    expect(result).toMatchObject({ completed: 3, failed: 1 });
  });

  it('does nothing when everything has already been filled in', async () => {
    const fetchFn = vi.fn();
    const log = { a: { movie: { id: 1, production_countries: [] } } };

    const result = await backfillProductionCountries(log, vi.fn(), { fetchFn });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.total).toBe(0);
  });

  it('stops early when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchFn = vi.fn();

    await backfillProductionCountries(makeLog(5), vi.fn(), { fetchFn, signal: controller.signal });

    expect(fetchFn).not.toHaveBeenCalled();
  });
});

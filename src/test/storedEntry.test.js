import { describe, it, expect, vi } from 'vitest';
import {
  isKeptCrewJob,
  trimCrew,
  entryForStorage,
  trimUpdatesFor,
  collectEntriesNeedingTrim,
  trimStoredEntries
} from '../assets/javascript/storedEntry.js';

const crew = (...jobs) => jobs.map((job, i) => ({ name: `Person ${i}`, job }));

const entry = (over = {}) => ({
  movie: {
    id: 1,
    title: 'A Movie',
    crew: crew('Director', 'Stunts', 'Writer', 'Hairstylist'),
    cast: [{ name: 'Someone', character: 'Themselves' }],
    ...over.movie
  },
  ratings: [{ calculatedTotal: 8 }],
  ...over
});

describe('isKeptCrewJob', () => {
  it('keeps the jobs the app reads or searches on', () => {
    ['Director', 'Writer', 'Original Music Composer', 'Editor', 'Director of Photography',
      'Executive Producer', 'Production Design', 'Costume Design', 'Casting']
      .forEach((job) => expect(isKeptCrewJob(job), job).toBe(true));
  });

  it('keeps Screenplay, Story and Novel', () => {
    // 754 of 1,368 movies have NO plain "Writer" credit, and FavoriteWriters
    // and Home's crew grouping both key off these titles. Dropping them would
    // break writer attribution for over half the library.
    ['Screenplay', 'Story', 'Novel'].forEach((job) => expect(isKeptCrewJob(job), job).toBe(true));
  });

  it('drops the bulk that nothing ever reads', () => {
    ['Stunts', 'Hairstylist', 'Makeup Artist', 'Set Dresser', 'Thanks',
      'Sound Re-Recording Mixer', 'Visual Effects Supervisor']
      .forEach((job) => expect(isKeptCrewJob(job), job).toBe(false));
  });

  it('tolerates a missing job', () => {
    expect(isKeptCrewJob(undefined)).toBe(false);
    expect(isKeptCrewJob(null)).toBe(false);
  });
});

describe('trimCrew', () => {
  it('keeps only the relevant people, in order', () => {
    const trimmed = trimCrew(crew('Stunts', 'Director', 'Thanks', 'Editor'));
    expect(trimmed.map((p) => p.job)).toEqual(['Director', 'Editor']);
  });

  it('leaves a non-array alone rather than inventing one', () => {
    expect(trimCrew(undefined)).toBeUndefined();
  });
});

describe('entryForStorage', () => {
  it('strips fields that are injected when reading', () => {
    // The store's getter adds dbKey and Home's search memoisation adds _search;
    // spreading a whole entry writes both straight back.
    const clean = entryForStorage({ ...entry(), dbKey: 'key-1', _search: { title: 'a movie' } });

    expect(clean.dbKey).toBeUndefined();
    expect(clean._search).toBeUndefined();
  });

  it('strips flatKeywords, which is recomputed on load anyway', () => {
    const clean = entryForStorage(entry({ movie: { flatKeywords: ['heist'] } }));
    expect(clean.movie.flatKeywords).toBeUndefined();
  });

  it('trims the crew', () => {
    expect(entryForStorage(entry()).movie.crew.map((p) => p.job)).toEqual(['Director', 'Writer']);
  });

  it('keeps everything else untouched', () => {
    const clean = entryForStorage(entry());
    expect(clean.movie.title).toBe('A Movie');
    expect(clean.movie.cast).toHaveLength(1);
    expect(clean.ratings).toHaveLength(1);
  });

  it('does not mutate the input, which is usually live store state', () => {
    const original = { ...entry(), dbKey: 'key-1' };
    const before = JSON.parse(JSON.stringify(original));
    entryForStorage(original);
    expect(original).toEqual(before);
  });

  it('tolerates junk input', () => {
    expect(entryForStorage(null)).toBeNull();
    expect(entryForStorage({})).toEqual({});
  });
});

describe('trimUpdatesFor', () => {
  it('deletes removed fields with null, which is how Firebase update() removes a path', () => {
    const updates = trimUpdatesFor('k1', { ...entry(), dbKey: 'k1', _search: {}, movie: { ...entry().movie, flatKeywords: [] } });

    expect(updates['movieLog/k1/dbKey']).toBeNull();
    expect(updates['movieLog/k1/_search']).toBeNull();
    expect(updates['movieLog/k1/movie/flatKeywords']).toBeNull();
  });

  it('writes the trimmed crew as a leaf, not the whole entry', () => {
    // Rewriting the whole entry is what put the junk there in the first place.
    const updates = trimUpdatesFor('k1', entry());
    expect(Object.keys(updates)).toEqual(['movieLog/k1/movie/crew']);
    expect(updates['movieLog/k1/movie/crew'].map((p) => p.job)).toEqual(['Director', 'Writer']);
  });

  it('returns null when there is genuinely nothing to change', () => {
    const alreadyClean = { movie: { id: 1, crew: crew('Director') }, ratings: [] };
    expect(trimUpdatesFor('k1', alreadyClean)).toBeNull();
  });

  it('does not touch crew that is already trimmed', () => {
    const updates = trimUpdatesFor('k1', { ...entry({ movie: { crew: crew('Director') } }), dbKey: 'k1' });
    expect(updates['movieLog/k1/movie/crew']).toBeUndefined();
  });
});

describe('collectEntriesNeedingTrim', () => {
  it('picks only the entries that would actually change', () => {
    const log = {
      dirty: entry(),
      clean: { movie: { id: 2, crew: crew('Director') }, ratings: [] }
    };
    expect(collectEntriesNeedingTrim(log).map((c) => c.dbKey)).toEqual(['dirty']);
  });

  it('is a no-op on an already-migrated library', () => {
    const log = { a: { movie: { id: 1, crew: crew('Writer') }, ratings: [] } };
    expect(collectEntriesNeedingTrim(log)).toEqual([]);
  });

  it('tolerates an empty log', () => {
    expect(collectEntriesNeedingTrim(null)).toEqual([]);
  });
});

describe('trimStoredEntries', () => {
  const bigLog = (count) => Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`key-${i}`, { ...entry(), dbKey: `key-${i}` }])
  );

  it('writes in batches rather than per entry', async () => {
    // Per-entry writes across a real library crash a phone's tab — see
    // tmdbBackfill.js for the incident this convention comes from.
    const writeBatchFn = vi.fn();
    const result = await trimStoredEntries(bigLog(60), writeBatchFn, { batchSize: 25 });

    expect(writeBatchFn).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ total: 60, completed: 60, failed: 0 });
  });

  it('reports progress', async () => {
    const onProgress = vi.fn();
    await trimStoredEntries(bigLog(30), vi.fn(), { batchSize: 10, onProgress });

    expect(onProgress.mock.calls.at(-1)[0]).toMatchObject({ completed: 30, total: 30 });
  });

  it('counts a failed batch without aborting the rest', async () => {
    const writeBatchFn = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);

    const result = await trimStoredEntries(bigLog(30), writeBatchFn, { batchSize: 10 });

    expect(result.failed).toBe(10);
    expect(result.completed).toBe(30);
    expect(writeBatchFn).toHaveBeenCalledTimes(3);
  });

  it('stops early when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const writeBatchFn = vi.fn();

    await trimStoredEntries(bigLog(30), writeBatchFn, { signal: controller.signal });

    expect(writeBatchFn).not.toHaveBeenCalled();
  });

  it('does nothing on an already-trimmed library', async () => {
    const writeBatchFn = vi.fn();
    const log = { a: { movie: { id: 1, crew: crew('Director') }, ratings: [] } };

    const result = await trimStoredEntries(log, writeBatchFn);

    expect(writeBatchFn).not.toHaveBeenCalled();
    expect(result.total).toBe(0);
  });
});

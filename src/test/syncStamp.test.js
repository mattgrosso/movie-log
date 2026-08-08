import { describe, it, expect } from 'vitest';
import {
  movieLogKeyForPath,
  isWholeEntryPath,
  isEntryDeletion,
  stampPlanForWrite,
  stampUpdatesForBatch,
  collectEntriesNeedingStamp,
  stampBackfillUpdates,
  DELETIONS_ROOT
} from '../assets/javascript/syncStamp.js';

const TS = { '.sv': 'timestamp' };

describe('movieLogKeyForPath', () => {
  it('finds the key for a whole entry and for a field inside one', () => {
    expect(movieLogKeyForPath('movieLog/abc')).toBe('abc');
    expect(movieLogKeyForPath('movieLog/abc/movie/budget')).toBe('abc');
  });

  it('ignores anything outside the library', () => {
    expect(movieLogKeyForPath('settings/lastTweak')).toBeNull();
    expect(movieLogKeyForPath('movieLog')).toBeNull();
    expect(movieLogKeyForPath('')).toBeNull();
    expect(movieLogKeyForPath(null)).toBeNull();
  });
});

describe('isWholeEntryPath / isEntryDeletion', () => {
  it('separates the entry itself from a field inside it', () => {
    expect(isWholeEntryPath('movieLog/abc')).toBe(true);
    expect(isWholeEntryPath('movieLog/abc/movie/budget')).toBe(false);
  });

  it('recognises deleting a movie', () => {
    // MovieDetail.deleteRating writes null here when you delete the last rating.
    expect(isEntryDeletion('movieLog/abc', null)).toBe(true);
    expect(isEntryDeletion('movieLog/abc', { ratings: [] })).toBe(false);
    expect(isEntryDeletion('movieLog/abc/movie/budget', null)).toBe(false);
  });
});

describe('stampPlanForWrite', () => {
  it('leaves settings and everything else outside the library alone', () => {
    const plan = stampPlanForWrite({ path: 'settings/lastTweak', value: 123 }, TS);
    expect(plan).toEqual({ kind: 'set', path: 'settings/lastTweak', value: 123 });
  });

  it('injects the timestamp into a whole entry and keeps it a set()', () => {
    // set()'s replace-the-whole-entry semantics are what addRating and
    // deleteRating both depend on, so this path stays a set.
    const value = { ratings: [{ calculatedTotal: 8 }], movie: { id: 1 } };
    const plan = stampPlanForWrite({ path: 'movieLog/abc', value }, TS);

    expect(plan.kind).toBe('set');
    expect(plan.value).toEqual({ ...value, updatedAt: TS });
  });

  it('does not mutate the caller\'s entry', () => {
    const value = { ratings: [] };
    stampPlanForWrite({ path: 'movieLog/abc', value }, TS);
    expect(value.updatedAt).toBeUndefined();
  });

  it('turns a field write into one atomic update carrying the timestamp', () => {
    // Stamping separately after a successful write would mean a failure
    // between the two leaves the entry changed but unstamped — invisible, and
    // it would hide the entry from every future sync.
    const plan = stampPlanForWrite({ path: 'movieLog/abc/movie/budget', value: 100 }, TS);

    expect(plan).toEqual({
      kind: 'update',
      updates: { 'movieLog/abc/movie/budget': 100, 'movieLog/abc/updatedAt': TS }
    });
  });

  it('stamps a field being deleted, since removing a field is still a change', () => {
    const plan = stampPlanForWrite({ path: 'movieLog/abc/movie/flatKeywords', value: null }, TS);
    expect(plan.updates['movieLog/abc/movie/flatKeywords']).toBeNull();
    expect(plan.updates['movieLog/abc/updatedAt']).toBe(TS);
  });

  it('writes a tombstone when a movie is deleted, atomically with the removal', () => {
    const plan = stampPlanForWrite({ path: 'movieLog/abc', value: null }, TS);

    expect(plan.kind).toBe('update');
    expect(plan.updates['movieLog/abc']).toBeNull();
    expect(plan.updates[`${DELETIONS_ROOT}/abc`]).toBe(TS);
  });

  it('never stamps updatedAt on a deletion', () => {
    // movieLog/abc and movieLog/abc/updatedAt overlap, which Firebase rejects
    // outright — and if it didn't, the entry would come back as a timestamp
    // and nothing else.
    const plan = stampPlanForWrite({ path: 'movieLog/abc', value: null }, TS);
    expect(plan.updates['movieLog/abc/updatedAt']).toBeUndefined();
  });

  it('passes a scalar replacement through rather than inventing a shape', () => {
    const plan = stampPlanForWrite({ path: 'movieLog/abc', value: 'weird' }, TS);
    expect(plan).toEqual({ kind: 'set', path: 'movieLog/abc', value: 'weird' });
  });
});

describe('stampUpdatesForBatch', () => {
  it('stamps every distinct movie a batch touches, once each', () => {
    const stamped = stampUpdatesForBatch({
      'movieLog/a/movie/budget': 1,
      'movieLog/a/movie/revenue': 2,
      'movieLog/b/movie/budget': 3
    }, TS);

    expect(stamped['movieLog/a/updatedAt']).toBe(TS);
    expect(stamped['movieLog/b/updatedAt']).toBe(TS);
    expect(Object.keys(stamped)).toHaveLength(5);
  });

  it('leaves the original field values untouched', () => {
    const stamped = stampUpdatesForBatch({ 'movieLog/a/movie/crew': [{ job: 'Director' }] }, TS);
    expect(stamped['movieLog/a/movie/crew']).toEqual([{ job: 'Director' }]);
  });

  it('passes non-library paths straight through without stamping', () => {
    const stamped = stampUpdatesForBatch({ 'settings/games/wins/trivia': '8/8/2026' }, TS);
    expect(stamped).toEqual({ 'settings/games/wins/trivia': '8/8/2026' });
  });

  it('injects into the value rather than adding an overlapping path', () => {
    // Firebase rejects an update containing both movieLog/a and
    // movieLog/a/updatedAt, so a whole-entry batch member gets the timestamp
    // inside its value instead.
    const stamped = stampUpdatesForBatch({ 'movieLog/a': { ratings: [] } }, TS);

    expect(stamped['movieLog/a']).toEqual({ ratings: [], updatedAt: TS });
    expect(stamped['movieLog/a/updatedAt']).toBeUndefined();
  });

  it('does not add an overlapping sibling even when the same movie also has field writes', () => {
    const stamped = stampUpdatesForBatch({
      'movieLog/a': { ratings: [] },
      'movieLog/a/movie/budget': 5
    }, TS);

    expect(stamped['movieLog/a/updatedAt']).toBeUndefined();
    expect(stamped['movieLog/a']).toMatchObject({ updatedAt: TS });
  });

  it('tombstones a deletion inside a batch without stamping it', () => {
    const stamped = stampUpdatesForBatch({ 'movieLog/a': null, 'movieLog/b/movie/budget': 5 }, TS);

    expect(stamped['movieLog/a']).toBeNull();
    expect(stamped[`${DELETIONS_ROOT}/a`]).toBe(TS);
    expect(stamped['movieLog/a/updatedAt']).toBeUndefined();
    expect(stamped['movieLog/b/updatedAt']).toBe(TS);
  });

  it('tolerates an empty or missing batch', () => {
    expect(stampUpdatesForBatch({}, TS)).toEqual({});
    expect(stampUpdatesForBatch(null, TS)).toEqual({});
  });
});

describe('collectEntriesNeedingStamp', () => {
  it('picks only entries with no usable timestamp yet', () => {
    const log = {
      old: { ratings: [] },
      done: { ratings: [], updatedAt: 1754600000000 },
      // The unresolved server sentinel, if a snapshot were taken mid-write.
      pending: { ratings: [], updatedAt: { '.sv': 'timestamp' } }
    };

    expect(collectEntriesNeedingStamp(log).map((c) => c.dbKey)).toEqual(['old', 'pending']);
  });

  it('is a no-op once the library is fully stamped', () => {
    expect(collectEntriesNeedingStamp({ a: { updatedAt: 1 } })).toEqual([]);
    expect(collectEntriesNeedingStamp(null)).toEqual([]);
  });
});

describe('stampBackfillUpdates', () => {
  it('names the updatedAt path for each entry', () => {
    expect(stampBackfillUpdates([{ dbKey: 'a' }, { dbKey: 'b' }])).toEqual({
      'movieLog/a/updatedAt': 0,
      'movieLog/b/updatedAt': 0
    });
  });

  it('has its placeholder value replaced by the real server timestamp', () => {
    // The placeholder must never reach the server — naming the path is only
    // what makes the batch stamper attach the real timestamp.
    const stamped = stampUpdatesForBatch(stampBackfillUpdates([{ dbKey: 'a' }]), TS);
    expect(stamped['movieLog/a/updatedAt']).toBe(TS);
  });

  it('tolerates nothing to do', () => {
    expect(stampBackfillUpdates([])).toEqual({});
    expect(stampBackfillUpdates(null)).toEqual({});
  });
});

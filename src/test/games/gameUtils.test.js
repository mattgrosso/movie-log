import { describe, it, expect } from 'vitest';
import {
  getEligibleEntries, ratingFor, hashString, makeSeededRng, shuffle, pickRandomDistinct,
  pickDailyEntry, movieYear, movieDecade, movieDirectors, movieCastNames, movieGenreNames,
  entryKey, compareNumber
} from '@/assets/javascript/games/gameUtils.js';

function entry (overrides = {}) {
  return {
    dbKey: overrides.dbKey || 'key',
    ratings: overrides.ratings || [{ calculatedTotal: 5 }],
    movie: {
      id: 1,
      title: 'Movie',
      poster_path: '/p.jpg',
      release_date: '2010-05-01',
      runtime: 120,
      crew: [{ name: 'Dir One', job: 'Director' }],
      cast: [{ name: 'Actor One' }, { name: 'Actor Two' }],
      genres: [{ name: 'Drama' }],
      ...overrides.movie
    }
  };
}

describe('getEligibleEntries', () => {
  it('keeps only entries with a poster, release date, and at least one rating', () => {
    const good = entry();
    const noPoster = entry({ movie: { poster_path: null } });
    const noDate = entry({ movie: { release_date: null } });
    const noRatings = entry({ ratings: [] });
    const missingMovie = { dbKey: 'x', ratings: [{ calculatedTotal: 1 }] };

    const result = getEligibleEntries([good, noPoster, noDate, noRatings, missingMovie, null, undefined]);
    expect(result).toEqual([good]);
  });

  it('returns an empty array for falsy input', () => {
    expect(getEligibleEntries(null)).toEqual([]);
    expect(getEligibleEntries(undefined)).toEqual([]);
  });

  describe('shorts filtering (same runtime<=40min threshold as Home.vue)', () => {
    it('excludes shorts by default', () => {
      const feature = entry();
      const short = entry({ dbKey: 'short', movie: { runtime: 30 } });
      expect(getEligibleEntries([feature, short])).toEqual([feature]);
    });

    it('includes shorts when explicitly asked to', () => {
      const feature = entry();
      const short = entry({ dbKey: 'short', movie: { runtime: 30 } });
      const result = getEligibleEntries([feature, short], true);
      expect(result.map((e) => e.dbKey)).toEqual(expect.arrayContaining(['key', 'short']));
    });

    it('does not exclude a movie with no runtime recorded (falsy runtime is not treated as a short)', () => {
      const noRuntime = entry({ movie: { runtime: null } });
      expect(getEligibleEntries([noRuntime])).toEqual([noRuntime]);
    });
  });
});

describe('ratingFor', () => {
  it('reads calculatedTotal from the injected rating function', () => {
    const getRatingFn = () => ({ calculatedTotal: 7.5 });
    expect(ratingFor(entry(), getRatingFn)).toBe(7.5);
  });

  it('defaults to 0 when the rating is missing or malformed', () => {
    expect(ratingFor(entry(), () => null)).toBe(0);
    expect(ratingFor(entry(), () => ({}))).toBe(0);
    expect(ratingFor(null, () => ({ calculatedTotal: 9 }))).toBe(0);
  });
});

describe('hashString + makeSeededRng', () => {
  it('is deterministic: same string -> same hash -> same rng sequence', () => {
    const h1 = hashString('2026-07-21');
    const h2 = hashString('2026-07-21');
    expect(h1).toBe(h2);

    const seq1 = [makeSeededRng(h1)(), makeSeededRng(h1)()];
    const seq2 = [makeSeededRng(h2)(), makeSeededRng(h2)()];
    expect(seq1).toEqual(seq2);
  });

  it('different strings produce different hashes (in the general case)', () => {
    expect(hashString('2026-07-21')).not.toBe(hashString('2026-07-22'));
  });

  it('makeSeededRng produces values in [0, 1)', () => {
    const rng = makeSeededRng(12345);
    for (let i = 0; i < 50; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('shuffle / pickRandomDistinct', () => {
  it('shuffle does not mutate the input and preserves all elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input, makeSeededRng(1));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic for a fixed rng', () => {
    const a = shuffle([1, 2, 3, 4, 5], makeSeededRng(42));
    const b = shuffle([1, 2, 3, 4, 5], makeSeededRng(42));
    expect(a).toEqual(b);
  });

  it('pickRandomDistinct returns the requested count with no duplicates', () => {
    const result = pickRandomDistinct([1, 2, 3, 4, 5], 3, makeSeededRng(7));
    expect(result.length).toBe(3);
    expect(new Set(result).size).toBe(3);
  });
});

describe('pickDailyEntry', () => {
  it('returns null for an empty pool', () => {
    expect(pickDailyEntry([], '2026-07-21')).toBeNull();
  });

  it('is deterministic for the same date string', () => {
    const pool = [entry({ dbKey: 'a' }), entry({ dbKey: 'b' }), entry({ dbKey: 'c' }), entry({ dbKey: 'd' })];
    const first = pickDailyEntry(pool, '2026-07-21');
    const second = pickDailyEntry(pool, '2026-07-21');
    expect(first).toBe(second);
  });

  it('always returns an entry from the pool', () => {
    const pool = [entry({ dbKey: 'a' }), entry({ dbKey: 'b' }), entry({ dbKey: 'c' })];
    for (const date of ['2026-01-01', '2026-06-15', '2027-12-31']) {
      expect(pool).toContain(pickDailyEntry(pool, date));
    }
  });
});

describe('movie field helpers', () => {
  it('movieYear / movieDecade read from release_date', () => {
    const e = entry({ movie: { release_date: '1994-09-23' } });
    expect(movieYear(e)).toBe(1994);
    expect(movieDecade(e)).toBe(1990);
  });

  it('movieYear / movieDecade return null when there is no release date', () => {
    const e = entry({ movie: { release_date: null } });
    expect(movieYear(e)).toBeNull();
    expect(movieDecade(e)).toBeNull();
  });

  it('movieDirectors only includes crew with job === "Director"', () => {
    const e = entry({
      movie: {
        crew: [
          { name: 'Real Director', job: 'Director' },
          { name: 'Co-Director Person', job: 'Co-Director' },
          { name: 'Writer Person', job: 'Writer' }
        ]
      }
    });
    expect(movieDirectors(e)).toEqual(['Real Director']);
  });

  it('movieCastNames respects the limit', () => {
    const e = entry({ movie: { cast: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] } });
    expect(movieCastNames(e, 2)).toEqual(['A', 'B']);
  });

  it('movieGenreNames maps genre objects to names', () => {
    const e = entry({ movie: { genres: [{ name: 'Sci-Fi' }, { name: 'Thriller' }] } });
    expect(movieGenreNames(e)).toEqual(['Sci-Fi', 'Thriller']);
  });
});

describe('entryKey', () => {
  it('prefers dbKey, falls back to movie.id', () => {
    expect(entryKey(entry({ dbKey: 'abc' }))).toBe('abc');
    expect(entryKey({ movie: { id: 99 } })).toBe(99);
  });
});

describe('compareNumber', () => {
  it('reports match when equal', () => {
    expect(compareNumber(5, 5)).toEqual({ value: 5, direction: 'match', match: true });
  });

  it('reports "up" when the guess is below target, "down" when above', () => {
    expect(compareNumber(3, 5).direction).toBe('up');
    expect(compareNumber(8, 5).direction).toBe('down');
  });

  it('returns a null direction when either value is missing', () => {
    expect(compareNumber(null, 5).direction).toBeNull();
    expect(compareNumber(5, null).direction).toBeNull();
  });
});

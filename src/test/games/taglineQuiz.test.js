import { describe, it, expect } from 'vitest';
import { buildRoundOptions } from '@/assets/javascript/games/taglineQuiz.js';

function entry (id, { keywords = [], genres = [] } = {}) {
  return {
    dbKey: `key-${id}`,
    movie: {
      id,
      title: `Movie ${id}`,
      keywords: keywords.map((name, i) => ({ id: i, name })),
      genres: genres.map((name) => ({ name }))
    }
  };
}

describe('buildRoundOptions', () => {
  it('includes the target and exactly 3 distinct decoys, 4 total', () => {
    const target = entry(0);
    const pool = [target, entry(1), entry(2), entry(3), entry(4), entry(5)];
    const options = buildRoundOptions(target, pool, Math.random);

    expect(options).toHaveLength(4);
    const keys = options.map((o) => o.movie.id);
    expect(new Set(keys).size).toBe(4);
    expect(keys).toContain(0);
  });

  it('never picks the target itself as one of the decoys', () => {
    const target = entry(0);
    const pool = [target, entry(1), entry(2), entry(3)];
    // Exactly 3 non-target entries available — deterministic regardless of rng.
    const options = buildRoundOptions(target, pool, Math.random);
    const decoyIds = options.map((o) => o.movie.id).filter((id) => id !== 0);
    expect(decoyIds.sort()).toEqual([1, 2, 3]);
  });

  it('shuffles the display order across rounds (target position varies, not fixed)', () => {
    const target = entry(0);
    const pool = [target, entry(1), entry(2), entry(3), entry(4), entry(5), entry(6)];

    const positions = new Set();
    for (let i = 0; i < 30; i++) {
      const options = buildRoundOptions(target, pool, Math.random);
      positions.add(options.findIndex((o) => o.movie.id === 0));
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it('does not mutate the input pool', () => {
    const target = entry(0);
    const pool = [target, entry(1), entry(2), entry(3), entry(4)];
    const poolCopy = [...pool];
    buildRoundOptions(target, pool, Math.random);
    expect(pool).toEqual(poolCopy);
  });

  describe('decoy selection prefers thematically similar movies (feature request: "try to find movies that sort of could have a similar tagline... a little bit more difficult... several plausible options")', () => {
    it('always picks the 3 movies sharing the most keywords/genres over unrelated ones, regardless of rng draw', () => {
      const target = entry(0, { keywords: ['heist', 'revenge'], genres: ['Crime'] });
      const similar = [
        entry(1, { keywords: ['heist'] }), // 1 shared keyword
        entry(2, { keywords: ['revenge'], genres: ['Crime'] }), // 1 keyword + 1 genre
        entry(3, { genres: ['Crime'] }) // 1 shared genre only
      ];
      const unrelated = Array.from({ length: 10 }, (_, i) => entry(10 + i, { keywords: [`unrelated-${i}`], genres: ['Comedy'] }));
      const pool = [target, ...similar, ...unrelated];

      for (let i = 0; i < 20; i++) {
        const options = buildRoundOptions(target, pool, Math.random);
        const decoyIds = options.map((o) => o.movie.id).filter((id) => id !== 0).sort((a, b) => a - b);
        expect(decoyIds).toEqual([1, 2, 3]);
      }
    });

    it('weighs a shared keyword above a shared genre', () => {
      const target = entry(0, { keywords: ['heist'], genres: ['Crime'] });
      // Only room for ONE of these two in the top-3 alongside two
      // keyword-sharing movies — the genre-only one should lose out.
      const keywordMatch = entry(1, { keywords: ['heist'] });
      const genreOnlyMatch = entry(2, { genres: ['Crime'] });
      const otherKeywordMatches = [entry(3, { keywords: ['heist'] }), entry(4, { keywords: ['heist'] })];
      const pool = [target, keywordMatch, genreOnlyMatch, ...otherKeywordMatches];

      const options = buildRoundOptions(target, pool, Math.random);
      const decoyIds = options.map((o) => o.movie.id).filter((id) => id !== 0);
      expect(decoyIds).not.toContain(2);
    });

    it('falls back to random decoys (not always the same ones) when nothing shares any keyword or genre', () => {
      const target = entry(0, { keywords: ['x'], genres: ['Drama'] });
      const pool = [target, ...Array.from({ length: 8 }, (_, i) => entry(1 + i))];

      const seenDecoySets = new Set();
      for (let i = 0; i < 30; i++) {
        const options = buildRoundOptions(target, pool, Math.random);
        const decoyIds = options.map((o) => o.movie.id).filter((id) => id !== 0).sort((a, b) => a - b);
        seenDecoySets.add(decoyIds.join(','));
      }
      expect(seenDecoySets.size).toBeGreaterThan(1);
    });
  });
});

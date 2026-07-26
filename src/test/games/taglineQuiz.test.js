import { describe, it, expect } from 'vitest';
import { buildRoundOptions } from '@/assets/javascript/games/taglineQuiz.js';

function entry (id) {
  return { dbKey: `key-${id}`, movie: { id, title: `Movie ${id}` } };
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
});

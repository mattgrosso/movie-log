import { describe, it, expect } from 'vitest';
import { pickTriviaTarget, clampRevealedCount, isNewBestScore } from '@/assets/javascript/games/trivia.js';

function entry (id) {
  return { dbKey: `key-${id}`, movie: { id, title: `Movie ${id}` } };
}

describe('pickTriviaTarget', () => {
  it('returns null for an empty pool', () => {
    expect(pickTriviaTarget([], null)).toBe(null);
    expect(pickTriviaTarget(null, null)).toBe(null);
  });

  it('picks from the pool via the supplied rng when nothing is excluded', () => {
    const pool = [entry(1), entry(2), entry(3)];
    expect(pickTriviaTarget(pool, null, () => 0)).toBe(pool[0]);
    expect(pickTriviaTarget(pool, null, () => 0.99)).toBe(pool[2]);
  });

  // Bug reports elsewhere in this codebase (Tag, Six Degrees) both traced
  // to a "pick something new" routine with no memory of what was JUST
  // shown. This is the same fix, tested from day one instead of after a
  // report.
  it('excludes the given key from the candidate pool', () => {
    const pool = [entry(1), entry(2), entry(3)];
    // rng=0 would normally pick pool[0] (key-1) - excluding it should shift
    // the pick to whatever's now first among the remaining candidates.
    const picked = pickTriviaTarget(pool, 'key-1', () => 0);
    expect(picked.dbKey).toBe('key-2');
  });

  it('falls back to the full pool when excluding the key would leave nothing', () => {
    const pool = [entry(1)];
    const picked = pickTriviaTarget(pool, 'key-1', () => 0);
    expect(picked.dbKey).toBe('key-1');
  });
});

describe('clampRevealedCount', () => {
  it('never goes below 1', () => {
    expect(clampRevealedCount(0)).toBe(1);
    expect(clampRevealedCount(-3)).toBe(1);
  });

  it('never exceeds the total fact count', () => {
    expect(clampRevealedCount(9, 5)).toBe(5);
  });

  it('passes through an in-range value unchanged', () => {
    expect(clampRevealedCount(3, 5)).toBe(3);
  });
});

describe('isNewBestScore', () => {
  it('is true when there is no previous best', () => {
    expect(isNewBestScore(4, null)).toBe(true);
    expect(isNewBestScore(4, undefined)).toBe(true);
  });

  it('is true only when strictly fewer facts were used (lower is better)', () => {
    expect(isNewBestScore(2, 3)).toBe(true);
    expect(isNewBestScore(3, 3)).toBe(false);
    expect(isNewBestScore(4, 3)).toBe(false);
  });
});

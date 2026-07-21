import { describe, it, expect } from 'vitest';
import { createBracket, pickWinner, currentPair, isComplete, roundProgress } from '@/assets/javascript/games/bracket.js';

function makeEntries (n) {
  return Array.from({ length: n }, (_, i) => ({ dbKey: `key-${i}`, movie: { id: i, title: `Movie ${i}` } }));
}

describe('createBracket', () => {
  it('trims the pool to the largest power of two at or below maxSize', () => {
    const bracket = createBracket(makeEntries(20), 16);
    expect(bracket.totalContestants).toBe(16);
    expect(bracket.pairs.length).toBe(8);
  });

  it('shrinks further when the pool itself is smaller than a full bracket', () => {
    const bracket = createBracket(makeEntries(5), 16);
    expect(bracket.totalContestants).toBe(4);
    expect(bracket.pairs.length).toBe(2);
  });

  it('starts on round 1 with no champion', () => {
    const bracket = createBracket(makeEntries(8), 8);
    expect(bracket.round).toBe(1);
    expect(bracket.champion).toBeNull();
    expect(isComplete(bracket)).toBe(false);
  });
});

describe('pickWinner', () => {
  it('advances through an 8-entry bracket to a single champion', () => {
    let state = createBracket(makeEntries(8), 8);
    expect(roundProgress(state)).toEqual({ current: 1, total: 4, round: 1 });

    // Round 1: 4 matches, always pick the first contestant.
    for (let i = 0; i < 4; i++) {
      const pair = currentPair(state);
      expect(pair).not.toBeNull();
      state = pickWinner(state, pair[0].dbKey);
    }
    expect(state.round).toBe(2);
    expect(state.pairs.length).toBe(2);
    expect(isComplete(state)).toBe(false);

    // Round 2: 2 matches.
    for (let i = 0; i < 2; i++) {
      const pair = currentPair(state);
      state = pickWinner(state, pair[0].dbKey);
    }
    expect(state.round).toBe(3);
    expect(state.pairs.length).toBe(1);

    // Final.
    const finalPair = currentPair(state);
    state = pickWinner(state, finalPair[0].dbKey);

    expect(isComplete(state)).toBe(true);
    expect(state.champion).not.toBeNull();
    expect(currentPair(state)).toBeNull();
  });

  it('the champion is always whichever entry was actually picked, not always index 0', () => {
    let state = createBracket(makeEntries(2), 2);
    const pair = currentPair(state);
    state = pickWinner(state, pair[1].dbKey);
    expect(state.champion.dbKey).toBe(pair[1].dbKey);
  });

  it('is a no-op past completion (does not throw)', () => {
    let state = createBracket(makeEntries(2), 2);
    const pair = currentPair(state);
    state = pickWinner(state, pair[0].dbKey);
    expect(isComplete(state)).toBe(true);
    const again = pickWinner(state, 'anything');
    expect(again).toBe(state);
  });
});

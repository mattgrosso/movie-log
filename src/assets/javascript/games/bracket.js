// Pure single-elimination bracket state machine for the "Rate-Off" game
// (pick your favorite of two posters, repeat until a champion remains).
// Vue-free and store-free so the tournament logic can be unit tested without
// mounting anything.

import { entryKey } from './gameUtils.js';

// Largest power of two <= n, clamped to a sane minimum of 2.
function largestPowerOfTwoAtMost (n) {
  let size = 2;
  while (size * 2 <= n) size *= 2;
  return size;
}

// Builds the first round from a pool of entries. Trims to a power-of-two
// bracket size (so every round divides evenly with no byes) capped at
// `maxSize`.
export function createBracket (entries, maxSize = 16) {
  const size = Math.min(largestPowerOfTwoAtMost(entries.length), maxSize);
  const contestants = entries.slice(0, size);
  const pairs = [];
  for (let i = 0; i < contestants.length; i += 2) {
    pairs.push([contestants[i], contestants[i + 1]]);
  }

  return {
    round: 1,
    totalContestants: size,
    pairs,
    pairIndex: 0,
    nextRoundPool: [],
    champion: null
  };
}

// Records a pick for the current pair and advances the bracket. `winnerKey`
// should match entryKey() of one of the two entries in the current pair.
export function pickWinner (state, winnerKey) {
  const currentPair = state.pairs[state.pairIndex];
  if (!currentPair) return state;

  const winner = currentPair.find((entry) => entryKey(entry) === winnerKey) || currentPair[0];
  const nextRoundPool = [...state.nextRoundPool, winner];
  const pairIndex = state.pairIndex + 1;

  if (pairIndex < state.pairs.length) {
    return { ...state, pairIndex, nextRoundPool };
  }

  // Round complete.
  if (nextRoundPool.length === 1) {
    return { ...state, pairIndex, nextRoundPool, champion: nextRoundPool[0] };
  }

  const nextPairs = [];
  for (let i = 0; i < nextRoundPool.length; i += 2) {
    nextPairs.push([nextRoundPool[i], nextRoundPool[i + 1]]);
  }

  return {
    ...state,
    round: state.round + 1,
    pairs: nextPairs,
    pairIndex: 0,
    nextRoundPool: []
  };
}

export function currentPair (state) {
  return state.pairs[state.pairIndex] || null;
}

export function isComplete (state) {
  return Boolean(state.champion);
}

// 1-indexed "match N of M this round" for a progress readout.
export function roundProgress (state) {
  return { current: state.pairIndex + 1, total: state.pairs.length, round: state.round };
}

export { entryKey };

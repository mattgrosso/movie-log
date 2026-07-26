import { entryKey, shuffle, pickRandomDistinct } from './gameUtils.js';

// Pure, store-free rules for Tagline Guess: a movie's real tagline is shown,
// the player picks which of 4 posters it belongs to. See CLAUDE.md for the
// full design writeup.

// Builds the 4 poster options for one round: the target movie (the one the
// fetched tagline actually belongs to) plus 3 random distinct decoys drawn
// from the rest of the pool, all shuffled into a random display order so
// the correct answer's position on screen isn't predictable round to round.
export function buildRoundOptions (targetEntry, pool, rng = Math.random) {
  const targetKey = entryKey(targetEntry);
  const others = (pool || []).filter((entry) => entryKey(entry) !== targetKey);
  const decoys = pickRandomDistinct(others, 3, rng);
  return shuffle([targetEntry, ...decoys], rng);
}

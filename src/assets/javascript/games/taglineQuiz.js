import { entryKey, shuffle, movieGenreNames } from './gameUtils.js';
import { computeFlatKeywords } from '../../../utils/keywords.js';

// Pure, store-free rules for Tagline Guess: a movie's real tagline is shown,
// the player picks which of 4 posters it belongs to. See CLAUDE.md for the
// full design writeup.

// Keyword overlap is a much stronger "these are thematically similar"
// signal than genre overlap, which is broad and shared by dozens of movies
// — weighted accordingly so two movies sharing a specific keyword (e.g.
// "heist") outrank two that merely share a genre (e.g. "Crime").
const KEYWORD_WEIGHT = 3;
const GENRE_WEIGHT = 1;

function keywordSet (entry) {
  return new Set(computeFlatKeywords(entry?.movie).map((keyword) => keyword.toLowerCase()));
}

function genreSet (entry) {
  return new Set(movieGenreNames(entry));
}

function sharedCount (setA, setB) {
  let count = 0;
  setA.forEach((value) => { if (setB.has(value)) count += 1; });
  return count;
}

// How "plausible" a decoy `candidate` would be for `target` — higher means
// more thematically similar (shares more keywords/genres), and so more
// likely to genuinely tempt a wrong guess instead of reading as an
// obviously-unrelated movie. Feature request: "try to find movies that
// sort of could have a similar tagline... something with keywords... a
// little bit more difficult... several plausible options."
function similarityScore (target, candidate) {
  const keywordOverlap = sharedCount(keywordSet(target), keywordSet(candidate));
  const genreOverlap = sharedCount(genreSet(target), genreSet(candidate));
  return keywordOverlap * KEYWORD_WEIGHT + genreOverlap * GENRE_WEIGHT;
}

// Builds the 4 poster options for one round: the target movie (the one the
// fetched tagline actually belongs to) plus the 3 OTHER movies in the pool
// most thematically similar to it (by shared keywords/genres), all
// shuffled into a random display order so the correct answer's position
// isn't predictable round to round.
//
// Ties are broken randomly, not by library order — `others` is shuffled
// BEFORE scoring/sorting (`Array.prototype.sort` is stable, so that
// shuffle is what actually supplies randomness among equal scores, not the
// sort itself). This matters most for the common all-zero case: a target
// that shares no keyword/genre with anything else still gets 3 genuinely
// random decoys, not always the same 3 library-order-first entries.
export function buildRoundOptions (targetEntry, pool, rng = Math.random) {
  const targetKey = entryKey(targetEntry);
  const others = (pool || []).filter((entry) => entryKey(entry) !== targetKey);

  const ranked = shuffle(others, rng)
    .map((entry) => ({ entry, score: similarityScore(targetEntry, entry) }))
    .sort((a, b) => b.score - a.score);

  const decoys = ranked.slice(0, 3).map((r) => r.entry);
  return shuffle([targetEntry, ...decoys], rng);
}

// "Stamp" — a keyword lands on screen, then you swipe through a stack of movies
// saying whether it applies. Confirms keywords that are already there and, more
// usefully, finds movies that should have had them.
//
// Works on KEYWORDS (TMDB's + the AI-generated ones), not viewing tags. Those
// are the ones nobody hand-checked and are therefore worth checking:
// *"I wanna be able to tag and remove tags that are the ones that we put on the
// movie coming from TMDB or even better, the ones that we have AI generating.
// I don't really care about the user generated ones. I assume those are all
// correct."*
//
// Named "Stamp" rather than anything with "Tag" in it because there is already
// a game displayed as "Tag" (the tagline quiz, /games/tagline) and two
// tag-something entries in the hub would be genuinely confusing.
//
// Unlike every other game here, this one WRITES to the library — the component
// owns that; this module stays pure and store-free so the selection logic can
// be unit tested without mounting anything.

import {
  entryKey,
  movieCastNames,
  movieDecade,
  movieDirectors,
  movieGenreNames,
  shuffle
} from './gameUtils.js';
import { computeFlatKeywords } from '../../../utils/keywords.js';

export const ROUND_SIZE = 20;

// A keyword needs a few examples before "what does this keyword look like?" is
// a question with an answer — one tagged movie tells the affinity scoring
// almost nothing, and the round would be pure guesswork. Measured against the
// real library, ~8,000 keywords sit on exactly one movie, so this cuts out the
// overwhelming majority of unusable ones.
export const MIN_TAGGED_TO_PLAY = 5;

// ...and past a point a keyword stops being a claim about a film and becomes a
// broad label — "friendship" is on 359 movies in the real library, "drama" on
// 214, and four of those share nothing a player can meaningfully confirm. Same
// problem, and the same fix, as Connections' genre-breadth cap.
export const MAX_TAGGED_TO_PLAY = 40;

// Roughly how a round is composed. Verification is the smaller half on purpose:
// re-confirming tags you already applied is the boring part, and discovery is
// where the value is.
export const ROUND_MIX = { verify: 6, affinity: 10, random: 4 };

// How much each shared trait says about "this movie belongs with those movies".
// A shared director is the strongest single signal — people tag by the kind of
// thing a film IS, and directors are the most reliable proxy for that in the
// data we hold. Genre and decade are weak because a huge slice of any library
// shares them (see Connections' genre-breadth cap for the same problem).
export const AFFINITY_WEIGHTS = {
  keyword: 3,
  director: 4,
  cast: 2,
  genre: 1,
  decade: 1
};

const lower = (value) => String(value || '').toLowerCase();

/**
 * The keywords currently VISIBLE on a movie — TMDB's, the AI's and any the user
 * added, minus any the user removed. Deliberately the same view the rest of the
 * app shows, so "has this keyword" means the same thing here as on the movie
 * page.
 */
export function keywordsOnEntry (entry) {
  return new Set(computeFlatKeywords(entry?.movie).map(lower));
}

export function entryHasKeyword (entry, keyword) {
  return keywordsOnEntry(entry).has(lower(keyword));
}

/**
 * Keywords worth playing: those on between `min` and `max` movies.
 *
 * `aiCount` tracks how many of those movies got it from the AI rather than
 * TMDB. The AI ones are the least-checked data in the library and the ones the
 * user specifically wanted to sweep, so pickKeyword leans on this.
 */
export function collectPlayableKeywords (entries, { min = MIN_TAGGED_TO_PLAY, max = MAX_TAGGED_TO_PLAY } = {}) {
  const counts = new Map();

  (entries || []).forEach((entry) => {
    const movie = entry?.movie || {};
    const aiKeywords = new Set((movie.chatGPTKeywords || []).map(lower));

    keywordsOnEntry(entry).forEach((key) => {
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
        if (aiKeywords.has(key)) existing.aiCount += 1;
      } else {
        counts.set(key, { keyword: key, count: 1, aiCount: aiKeywords.has(key) ? 1 : 0 });
      }
    });
  });

  return [...counts.values()]
    .filter((item) => item.count >= min && item.count <= max)
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));
}

/**
 * Choose the keyword for a round. No picker UI — *"we don't need to show a list
 * of tags to choose from. Just when the game starts, pick one."*
 *
 * Prefers keywords the AI actually generated (*"even better, the ones that we
 * have AI generating"*), falling back to the full eligible set when none
 * qualify, so a library without AI keywords still plays.
 */
export function pickKeyword (playable, rng = Math.random, excludeKeyword = null) {
  const pool = (playable || []).filter((item) => lower(item.keyword) !== lower(excludeKeyword));
  const usable = pool.length ? pool : (playable || []);
  if (!usable.length) return null;

  const aiBacked = usable.filter((item) => item.aiCount > 0);
  const from = aiBacked.length ? aiBacked : usable;
  return from[Math.floor(rng() * from.length)] || from[0];
}

/** The traits used for affinity, as lowercased Sets, computed once per movie. */
export function traitsOf (entry) {
  const movie = entry?.movie || {};
  return {
    keywords: new Set(computeFlatKeywords(movie).map(lower)),
    directors: new Set(movieDirectors(entry).map(lower)),
    cast: new Set(movieCastNames(entry, 8).map(lower)),
    genres: new Set(movieGenreNames(entry).map(lower)),
    decade: movieDecade(entry)
  };
}

const overlapCount = (a, b) => {
  let hits = 0;
  a.forEach((value) => {
    if (b.has(value)) hits += 1;
  });
  return hits;
};

/**
 * How strongly one movie resembles the set of movies that already carry a tag.
 *
 * This is the answer to the question the idea came with — *"the tricky part
 * would be choosing what movies to include that might fit the tag but don't
 * have it yet."* Rather than guessing at what a tag MEANS, treat the movies
 * already carrying it as the definition, and score everything else by how much
 * it looks like them.
 *
 * Deliberately counts DISTINCT tagged movies sharing a trait rather than raw
 * overlap: a director who appears in five tagged films is far better evidence
 * than five shared keywords with one film.
 */
export function affinityScore (candidateTraits, taggedTraitsList) {
  let score = 0;

  taggedTraitsList.forEach((tagged) => {
    score += Math.min(overlapCount(candidateTraits.keywords, tagged.keywords), 3) * AFFINITY_WEIGHTS.keyword;
    score += overlapCount(candidateTraits.directors, tagged.directors) * AFFINITY_WEIGHTS.director;
    score += Math.min(overlapCount(candidateTraits.cast, tagged.cast), 2) * AFFINITY_WEIGHTS.cast;
    score += Math.min(overlapCount(candidateTraits.genres, tagged.genres), 2) * AFFINITY_WEIGHTS.genre;
    if (candidateTraits.decade && candidateTraits.decade === tagged.decade) {
      score += AFFINITY_WEIGHTS.decade;
    }
  });

  return score;
}

/**
 * Build one round: a stack of cards for `tagTitle`, each flagged with whether
 * the movie currently carries it.
 *
 * The mix matters. All-tagged would be a pointless re-confirmation exercise;
 * all-high-affinity would only ever surface what the scoring already believes,
 * so the few random cards are a deliberate control — they're the only way a
 * movie the scoring is blind to ever gets tagged.
 */
export function buildStampRound (entries, keyword, { size = ROUND_SIZE, rng = Math.random, mix = ROUND_MIX } = {}) {
  const pool = entries || [];
  const tagged = pool.filter((entry) => entryHasKeyword(entry, keyword));
  const untagged = pool.filter((entry) => !entryHasKeyword(entry, keyword));

  if (!tagged.length) {
    return { keyword, cards: [] };
  }

  const taggedTraits = tagged.map(traitsOf);

  // Shuffled BEFORE sorting, so ties resolve differently each round instead of
  // always favouring library order. Array.prototype.sort is stable, so the
  // shuffle — not the sort — is what supplies that randomness. Same trick Tag
  // uses for decoy selection.
  const scored = shuffle(
    untagged.map((entry) => ({ entry, score: affinityScore(traitsOf(entry), taggedTraits) })),
    rng
  ).sort((a, b) => b.score - a.score);

  const verifyCards = shuffle(tagged, rng).slice(0, mix.verify);

  const affinityPicks = scored
    // A zero score means nothing at all was shared; that's a random card, not a
    // suggestion, so let the random bucket cover it honestly.
    .filter((candidate) => candidate.score > 0)
    .slice(0, mix.affinity)
    .map((candidate) => candidate.entry);

  const usedKeys = new Set([...verifyCards, ...affinityPicks].map(entryKey));
  const randomPicks = shuffle(untagged.filter((entry) => !usedKeys.has(entryKey(entry))), rng)
    .slice(0, Math.max(0, size - verifyCards.length - affinityPicks.length));

  const cards = shuffle([...verifyCards, ...affinityPicks, ...randomPicks], rng)
    .slice(0, size)
    .map((entry) => ({ entry, hasTag: entryHasKeyword(entry, keyword) }));

  return { keyword, cards };
}

/**
 * What a swipe actually means for the data.
 *
 * `keep` is the player saying the tag applies. Four outcomes, only two of which
 * are writes — most swipes on a well-built round should be no-ops, and the
 * component uses this to avoid pointless saves.
 */
export function resolveSwipe ({ hasTag, keep }) {
  if (keep && !hasTag) return 'added';
  if (!keep && hasTag) return 'removed';
  return keep ? 'confirmed' : 'skipped';
}

/**
 * The `customKeywords` / `removedKeywords` patch for adding or removing a
 * keyword, mirroring MovieDetail's own addKeyword/removeKeyword exactly.
 *
 * The asymmetry is the interesting part: a keyword the user is REMOVING may
 * have come from TMDB or the AI, so it can't simply be deleted — it goes on
 * `removedKeywords`, which computeFlatKeywords subtracts. And one being ADDED
 * back may already exist upstream, in which case dropping it from
 * `removedKeywords` is enough and pushing it to `customKeywords` too would
 * duplicate it.
 */
export function keywordChangeFor (movie, keyword, shouldHave) {
  const title = String(keyword || '').trim();
  const existingCustom = movie?.customKeywords || [];
  const existingRemoved = movie?.removedKeywords || [];
  if (!title) {
    return { customKeywords: existingCustom, removedKeywords: existingRemoved };
  }

  if (!shouldHave) {
    return {
      customKeywords: existingCustom.filter((k) => lower(k) !== lower(title)),
      removedKeywords: existingRemoved.some((k) => lower(k) === lower(title))
        ? existingRemoved
        : [...existingRemoved, title]
    };
  }

  const nextRemoved = existingRemoved.filter((k) => lower(k) !== lower(title));
  // Would it already be visible once un-removed? If so, nothing to add.
  const upstream = new Set([
    ...(movie?.keywords || []).map((k) => lower(k?.name)),
    ...(movie?.chatGPTKeywords || []).map(lower)
  ]);
  const needsCustom = !upstream.has(lower(title)) &&
    !existingCustom.some((k) => lower(k) === lower(title));

  return {
    customKeywords: needsCustom ? [...existingCustom, title] : existingCustom,
    removedKeywords: nextRemoved
  };
}

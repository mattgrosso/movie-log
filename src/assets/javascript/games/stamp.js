// "Stamp" — pick one of your own tags, then swipe through a stack of movies
// saying whether the tag applies. Confirms tags you already applied and, more
// usefully, finds movies that should have had it all along.
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
import { uniqueViewingTags } from '../../../utils/tags.js';

export const ROUND_SIZE = 20;

// A tag needs a few examples before "what does this tag look like?" is a
// question with an answer — one tagged movie tells the affinity scoring almost
// nothing, and the round would be pure guesswork.
export const MIN_TAGGED_TO_PLAY = 3;

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

/** Every viewing tag on a movie, lowercased, as a Set. */
export function tagsOnEntry (entry) {
  return new Set(uniqueViewingTags(entry?.ratings).map(lower));
}

export function entryHasTag (entry, tagTitle) {
  return tagsOnEntry(entry).has(lower(tagTitle));
}

/**
 * Tags worth playing: every tag applied to at least `minTagged` movies, with
 * how many movies carry it. Sorted commonest first.
 */
export function collectPlayableTags (entries, minTagged = MIN_TAGGED_TO_PLAY) {
  const counts = new Map();

  (entries || []).forEach((entry) => {
    // Preserve the original casing for display, but count case-insensitively.
    uniqueViewingTags(entry?.ratings).forEach((title) => {
      const key = lower(title);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { title, count: 1 });
      }
    });
  });

  return [...counts.values()]
    .filter((tag) => tag.count >= minTagged)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
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
export function buildStampRound (entries, tagTitle, { size = ROUND_SIZE, rng = Math.random, mix = ROUND_MIX } = {}) {
  const pool = entries || [];
  const tagged = pool.filter((entry) => entryHasTag(entry, tagTitle));
  const untagged = pool.filter((entry) => !entryHasTag(entry, tagTitle));

  if (!tagged.length) {
    return { tag: tagTitle, cards: [] };
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
    .map((entry) => ({ entry, hasTag: entryHasTag(entry, tagTitle) }));

  return { tag: tagTitle, cards };
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

/** Apply (or undo) a tag on a movie's MOST RECENT viewing, immutably. */
export function ratingsWithTag (ratings, tagTitle, shouldHave) {
  const list = Array.isArray(ratings) ? ratings : [];
  if (!list.length) return list;

  const title = String(tagTitle || '').trim();
  if (!title) return list;

  if (shouldHave) {
    // Add to the most recent viewing — the same one the rest of the app treats
    // as "the" rating for a movie.
    const targetIndex = list.length - 1;
    return list.map((rating, index) => {
      if (index !== targetIndex) return rating;
      const existing = rating.tags || [];
      if (existing.some((tag) => lower(tag?.title) === lower(title))) return rating;
      return { ...rating, tags: [...existing, { title }] };
    });
  }

  // Removing has to sweep EVERY viewing: the tag may have been applied to an
  // older one, and leaving it there would make the movie still count as tagged.
  return list.map((rating) => {
    const existing = rating.tags || [];
    const next = existing.filter((tag) => lower(tag?.title) !== lower(title));
    return next.length === existing.length ? rating : { ...rating, tags: next };
  });
}

import { entryKey, movieDirectors, movieGenreNames, movieDecade, movieCastNames, shuffle, pickRandomDistinct } from './gameUtils.js';
import { computeFlatKeywords } from '../../../utils/keywords.js';

const GROUP_SIZE = 4;
const CATEGORY_COUNT = 4;
// A keyword shared by a LOT of movies ("based on a novel") makes for a
// boring/obvious group — per user feedback, only keywords appearing on at
// most this many movies in the whole library count as "special" enough to
// build a category from.
const KEYWORD_MAX_MOVIE_COUNT = 10;
// Per follow-up feedback ("needs a minimum too, not just a maximum, for a
// good sweet spot") — a keyword shared by EXACTLY GROUP_SIZE (4) movies has
// zero flexibility during generation (all 4 must be claimed as-is, with no
// ability to swap one out if it overlaps a different category's pick),
// which both makes for a coincidental-feeling group and makes that category
// more likely to get skipped by the greedy no-overlap claiming step below.
// Requiring a little headroom above the bare mechanical floor fixes both.
const KEYWORD_MIN_MOVIE_COUNT = 5;

// Per user feedback ("we need some way of rating difficulty, otherwise
// they're all too hard and it's impossible") — an editorial difficulty tier
// per category KIND, NYT-Connections-style (yellow=easiest through
// purple=hardest). Decade/genre are surface-level traits you'd notice just
// glancing at a shelf of posters; director/cast require recalling a specific
// person; keyword categories are already curated to be the least obvious
// (see KEYWORD_MAX_MOVIE_COUNT above), so keyword is purple.
export const DIFFICULTY_BY_KIND = {
  decade: { tier: 1, name: 'Yellow', color: '#f4d35e' },
  genre: { tier: 2, name: 'Green', color: '#4caf50' },
  director: { tier: 3, name: 'Blue', color: '#4a90d9' },
  cast: { tier: 3, name: 'Blue', color: '#4a90d9' },
  keyword: { tier: 4, name: 'Purple', color: '#9b59b6' }
};

// The generic category kinds a puzzle can draw from — shown to the player as
// an upfront legend (see ConnectionsGame.vue) so "what kind of connection am
// I even looking for" has an answer without spoiling which 4 are actually in
// THIS puzzle.
export const CATEGORY_KIND_LABELS = [
  { kind: 'decade', label: 'Decade', ...DIFFICULTY_BY_KIND.decade },
  { kind: 'genre', label: 'Genre', ...DIFFICULTY_BY_KIND.genre },
  { kind: 'director', label: 'Director', ...DIFFICULTY_BY_KIND.director },
  { kind: 'cast', label: 'Cast', ...DIFFICULTY_BY_KIND.cast },
  { kind: 'keyword', label: 'Keyword', ...DIFFICULTY_BY_KIND.keyword }
];

function movieKeywords (entry) {
  return computeFlatKeywords(entry?.movie);
}

function groupBy (entries, extractValues, labelFor, kind) {
  const byValue = new Map();
  entries.forEach((entry) => {
    extractValues(entry).forEach((value) => {
      if (!value) return;
      if (!byValue.has(value)) byValue.set(value, []);
      byValue.get(value).push(entry);
    });
  });

  const candidates = [];
  byValue.forEach((movies, value) => {
    if (movies.length >= GROUP_SIZE) {
      candidates.push({ value, label: labelFor(value), movies, kind, difficulty: DIFFICULTY_BY_KIND[kind] });
    }
  });
  return candidates;
}

// Builds every attribute value (director/genre/decade/cast member/keyword)
// that at least GROUP_SIZE movies in the library share — these are the
// candidate "categories" a Connections puzzle can be built from. A category
// with fewer than 4 eligible movies can never fill a 4-tile group, so it's
// filtered out here rather than discovered as a dead end later.
//
// Production companies were dropped per user feedback ("too tricky" — a
// shared studio rarely feels like a meaningful connection the way a shared
// director/cast member does). Keywords were added in their place, capped to
// KEYWORD_MAX_MOVIE_COUNT so only "special"/niche keywords qualify, not
// broad ones a huge fraction of the library shares. Also floored at
// KEYWORD_MIN_MOVIE_COUNT for the same "sweet spot" reasoning (see its own
// comment) — GROUP_SIZE alone (enforced by groupBy for every kind) only
// guarantees a category is mechanically usable, not that it's a good one.
export function buildCandidateCategories (eligibleEntries) {
  const keywordCandidates = groupBy(eligibleEntries, movieKeywords, (name) => `Keyword: ${name}`, 'keyword')
    .filter((candidate) => candidate.movies.length >= KEYWORD_MIN_MOVIE_COUNT && candidate.movies.length <= KEYWORD_MAX_MOVIE_COUNT);

  return [
    ...groupBy(eligibleEntries, movieDirectors, (name) => `Directed by ${name}`, 'director'),
    ...groupBy(eligibleEntries, movieGenreNames, (name) => `Genre: ${name}`, 'genre'),
    ...groupBy(eligibleEntries, (entry) => { const d = movieDecade(entry); return d ? [`${d}s`] : []; }, (label) => `Released in the ${label}`, 'decade'),
    ...groupBy(eligibleEntries, (entry) => movieCastNames(entry, 8), (name) => `Starring ${name}`, 'cast'),
    ...keywordCandidates
  ];
}

const DIFFICULTY_TIERS = [1, 2, 3, 4];

// Greedily picks 4 categories with no movie shared between them, so every
// tile in the resulting puzzle has exactly one correct group. A movie CAN be
// individually eligible for more than one candidate category (e.g. also
// directed by someone else in the puzzle) — that's fine and matches real
// Connections' difficulty; what matters is each movie is only ASSIGNED to
// one group's answer key.
//
// Picking is done in two passes so a puzzle naturally spans a range of
// difficulties (yellow/green/blue/purple) instead of clustering on whichever
// type happens to shuffle first — per user feedback that puzzles felt
// uniformly "too hard, impossible" without any easier way in.
export function generateConnectionsPuzzle (eligibleEntries, rng = Math.random) {
  const candidates = shuffle(buildCandidateCategories(eligibleEntries), rng);
  const usedKeys = new Set();
  const chosen = [];

  const tryChoose = (category) => {
    const available = category.movies.filter((entry) => !usedKeys.has(entryKey(entry)));
    if (available.length < GROUP_SIZE) return false;
    const picked = pickRandomDistinct(available, GROUP_SIZE, rng);
    picked.forEach((entry) => usedKeys.add(entryKey(entry)));
    chosen.push({ label: category.label, movies: picked, difficulty: category.difficulty });
    return true;
  };

  // Pass 1: one category per difficulty tier, when one's available.
  for (const tier of DIFFICULTY_TIERS) {
    if (chosen.length >= CATEGORY_COUNT) break;
    for (const category of candidates) {
      if (category.difficulty?.tier !== tier) continue;
      if (tryChoose(category)) break;
    }
  }

  // Pass 2: fill any remaining slots regardless of tier (a small/homogeneous
  // library might not offer a candidate for every tier).
  if (chosen.length < CATEGORY_COUNT) {
    for (const category of candidates) {
      if (chosen.length >= CATEGORY_COUNT) break;
      tryChoose(category);
    }
  }

  if (chosen.length < CATEGORY_COUNT) return null; // library too small/homogeneous for a full puzzle

  const tiles = shuffle(
    chosen.flatMap((category) => category.movies.map((entry) => ({ key: entryKey(entry), entry, categoryLabel: category.label }))),
    rng
  );

  return {
    categories: chosen.map((category) => ({ label: category.label, keys: category.movies.map(entryKey), difficulty: category.difficulty })),
    tiles
  };
}

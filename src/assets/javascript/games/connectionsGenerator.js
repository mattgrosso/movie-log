import { entryKey, movieDirectors, movieGenreNames, movieDecade, movieCastNames, shuffle, pickRandomDistinct } from './gameUtils.js';
import { computeFlatKeywords } from '../../../utils/keywords.js';
import { awardCategoryNameMap } from '../personalAwardsCategories.js';
import { awardNameWithThe } from '../personalAwards.js';

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

// Genres had NO breadth cap at all, so "Adventure" (212 of ~1,370 films in the
// real library) or "Drama" (718) were valid categories — and four films picked
// at random from 212 share nothing a player can actually notice. Bug report:
// "you should try to avoid using genres keywords that have a lot of [entries],
// for example adventure."
//
// Expressed as a FRACTION of the library rather than an absolute count, so it
// scales with the collection instead of being tuned to one person's. At 10% the
// real library keeps Western/War/Music/Horror/Documentary/History/Animation/
// Mystery/Family/Fantasy and drops Drama, Comedy, Thriller, Romance, Action,
// Adventure, Crime and Sci-Fi — which is the intended line: a genre earns a
// group when noticing it is a real observation, not a coin flip.
//
// Decade is deliberately NOT capped this way. It's the tier-1 "easy way in",
// and "released in the 2020s" is at least a crisp fact a player can verify,
// where "these four are Dramas" is not.
const GENRE_MAX_LIBRARY_FRACTION = 0.1;

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
  // Title-text patterns (Jul 2026, user idea — "get a little weird with it...
  // number of syllables, starts with a letter, single-word titles"). Placed
  // alongside director/cast rather than at the keyword tier: unlike keyword,
  // which needs recalling a movie's THEME, a title pattern is immediately
  // verifiable just by reading the tile titles once you suspect it — the
  // hard part is thinking to look at the title text at all, not recalling
  // anything about the film itself. A genuine judgment call, not a precise
  // measurement; revisit if it plays easier/harder than director/cast in
  // practice.
  title: { tier: 3, name: 'Blue', color: '#4a90d9' },
  keyword: { tier: 4, name: 'Purple', color: '#9b59b6' },
  // Awards (Jul 2026, user idea — "movies that have all won the best actor
  // or best picture... any of the Academy Awards or really any of the
  // awards"). Placed alongside director/cast/title — recalling a specific
  // award win is roughly the same kind of specific-fact recall as a
  // director, not a surface trait (decade/genre) or a deep-cut theme
  // (keyword). A judgment call, not measured.
  awards: { tier: 3, name: 'Blue', color: '#4a90d9' }
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
  { kind: 'title', label: 'Title', ...DIFFICULTY_BY_KIND.title },
  { kind: 'keyword', label: 'Keyword', ...DIFFICULTY_BY_KIND.keyword },
  { kind: 'awards', label: 'Awards', ...DIFFICULTY_BY_KIND.awards }
];

function movieKeywords (entry) {
  return computeFlatKeywords(entry?.movie);
}

function movieTitle (entry) {
  const title = entry?.movie?.title;
  return typeof title === 'string' ? title.trim() : '';
}

// Strips a leading article before grouping by first letter, so e.g. "The
// Godfather" groups under G rather than swelling a low-quality "starts with
// T" bucket dominated by every "The ..." title in the library.
const LEADING_ARTICLE_RE = /^(the|a|an)\s+/i;

function movieFirstLetter (entry) {
  const title = movieTitle(entry).replace(LEADING_ARTICLE_RE, '');
  const first = title.charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? [first] : []; // skip titles starting with a digit/symbol
}

// Deliberately NOT implemented: syllable-count categories (also suggested
// alongside this one) - accurate English syllable counting needs a real
// dictionary/library to be reliable; a naive heuristic would misclassify
// often enough to undermine trust in the puzzle. Revisit if a small,
// dependency-free syllable counter is ever worth adding for this alone.
function movieIsSingleWordTitle (entry) {
  const title = movieTitle(entry);
  return title && !/\s/.test(title) ? ['Single-word title'] : [];
}

// Builds a { tmdbId -> Set<categoryName> } lookup ONCE from the full raw
// Academy Awards dataset (~11k win+nomination records across every category
// since the 1st ceremony — see store/index.js's allAcademyAwards), so a
// per-entry win check is an O(1) Set lookup instead of re-scanning ~11k
// records for every eligible library movie. Keyed by STRING id — `tmdb`
// comes back from the API as a numeric-looking string; comparing as
// strings (String(record.tmdb) vs String(entry.movie.id)) sidesteps any
// Number()-coercion edge case entirely, rather than assuming both sides
// are cleanly numeric.
function buildAcademyWinsByTmdbId (allAcademyAwards) {
  const byTmdbId = new Map();
  (allAcademyAwards || []).forEach((record) => {
    if (!record?.isWinner || record.tmdb == null) return;
    const tmdbId = String(record.tmdb);
    if (!byTmdbId.has(tmdbId)) byTmdbId.set(tmdbId, new Set());
    byTmdbId.get(tmdbId).add(record.category);
  });
  return byTmdbId;
}

// Every award category `entry` actually WON (nominations don't count — user
// was explicit: "let's go ahead and say it's wins only"), combining both
// award systems the app tracks — but kept as two DISTINCT category
// namespaces, not merged: "are you saying you smushed together my personal
// awards and the Academy Awards... I don't want that. They should be
// separate. So only match movies within each award." A movie that won
// "Best Picture" in both systems now produces TWO separate candidate
// categories ("Won Best Picture (Academy)" and "Won Best Picture
// (Personal)"), each only ever grouping movies that won within that SAME
// system — never mixed.
//  - Personal awards: `settings.personalAwards[year].categories[key].winner`
//    is checked for every year/category, synchronously, no fetch needed —
//    `winner.movieId` is a TMDB id, directly comparable to `entry.movie.id`.
//  - Academy Awards: now ALL categories, not just Best Picture — see
//    store/index.js's `allAcademyAwards` (the full dataset, fetched once
//    and cached locally per the user's own follow-up: "there aren't that
//    many Academy Awards... pull it down and store it locally so we can
//    use it wherever we want to"). `academyWinsByTmdbId` is the pre-built
//    lookup from that dataset (see buildAcademyWinsByTmdbId above).
//
// `awardsData` is `{ personalAwards, allAcademyAwards }` — both plain,
// pre-extracted from the Vuex store by the caller (ConnectionsGame.vue),
// since this module has no store access of its own. Either/both may be
// absent (e.g. not yet loaded on a cold direct navigation) — this function
// tolerates missing pieces rather than throwing, same as the rest of this
// pure module tolerates sparse/incomplete entry data.
function movieWonAwardCategories (entry, awardsData, academyWinsByTmdbId) {
  const movieId = entry?.movie?.id;
  if (movieId == null) return [];

  const categories = new Set();

  const academyCategories = academyWinsByTmdbId?.get(String(movieId));
  if (academyCategories) {
    academyCategories.forEach((name) => categories.add(`${name} (Academy)`));
  }

  const personalAwards = awardsData?.personalAwards;
  if (personalAwards) {
    // Bug report: this used to read "(Personal)", a generic internal label.
    // The user names their own awards in settings ("The Groskers"), and the
    // setting's own instructions tell them to pick a name that reads
    // naturally after "the" - so awardNameWithThe is safe to use directly.
    // Falls back to "The Oscars" via awardNameWithThe's own default when
    // the name hasn't been set (or awardsData predates this field).
    const personalLabel = awardNameWithThe(awardsData?.personalAwardName);
    // Includes awards the user invented — a clue reading "custom-best-needle
    // -drop (The Groskers)" would be a raw storage key on screen.
    const categoryNames = awardCategoryNameMap(personalAwards);
    Object.values(personalAwards).forEach((yearData) => {
      const yearCategories = yearData?.categories || {};
      Object.keys(yearCategories).forEach((categoryKey) => {
        const winner = yearCategories[categoryKey]?.winner;
        if (winner?.movieId === movieId) {
          const name = categoryNames[categoryKey] || categoryKey;
          categories.add(`${name} (${personalLabel})`);
        }
      });
    });
  }

  return [...categories];
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
//
// `awardsData` (optional — see movieWonAwardCategories) is the one category
// input that can't be derived from `entry.movie` alone, so it's threaded
// through as a second parameter rather than embedded per-entry like every
// other category's source data.
export function buildCandidateCategories (eligibleEntries, awardsData) {
  const keywordCandidates = groupBy(eligibleEntries, movieKeywords, (name) => `Keyword: ${name}`, 'keyword')
    .filter((candidate) => candidate.movies.length >= KEYWORD_MIN_MOVIE_COUNT && candidate.movies.length <= KEYWORD_MAX_MOVIE_COUNT);

  // Never below GROUP_SIZE, or a small library would have no genre categories
  // at all rather than merely broad ones.
  const genreMaxMovies = Math.max(GROUP_SIZE, Math.floor(eligibleEntries.length * GENRE_MAX_LIBRARY_FRACTION));
  const genreCandidates = groupBy(eligibleEntries, movieGenreNames, (name) => `Genre: ${name}`, 'genre')
    .filter((candidate) => candidate.movies.length <= genreMaxMovies);

  // Built ONCE per call (not per-entry) — see buildAcademyWinsByTmdbId.
  const academyWinsByTmdbId = buildAcademyWinsByTmdbId(awardsData?.allAcademyAwards);

  return [
    ...groupBy(eligibleEntries, movieDirectors, (name) => `Directed by ${name}`, 'director'),
    ...genreCandidates,
    ...groupBy(eligibleEntries, (entry) => { const d = movieDecade(entry); return d ? [`${d}s`] : []; }, (label) => `Released in the ${label}`, 'decade'),
    ...groupBy(eligibleEntries, (entry) => movieCastNames(entry, 8), (name) => `Starring ${name}`, 'cast'),
    ...groupBy(eligibleEntries, movieFirstLetter, (letter) => `Starts with "${letter}"`, 'title'),
    ...groupBy(eligibleEntries, movieIsSingleWordTitle, () => 'One-word titles', 'title'),
    ...keywordCandidates,
    ...groupBy(eligibleEntries, (entry) => movieWonAwardCategories(entry, awardsData, academyWinsByTmdbId), (name) => `Won ${name}`, 'awards')
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
export function generateConnectionsPuzzle (eligibleEntries, rng = Math.random, awardsData) {
  const candidates = shuffle(buildCandidateCategories(eligibleEntries, awardsData), rng);
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

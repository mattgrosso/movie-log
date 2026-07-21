import { entryKey, movieDirectors, movieGenreNames, movieDecade, movieCastNames, shuffle, pickRandomDistinct } from './gameUtils.js';

const GROUP_SIZE = 4;
const CATEGORY_COUNT = 4;

function groupBy (entries, extractValues, labelFor) {
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
      candidates.push({ value, label: labelFor(value), movies });
    }
  });
  return candidates;
}

// Builds every attribute value (director/genre/decade/cast member/studio)
// that at least GROUP_SIZE movies in the library share — these are the
// candidate "categories" a Connections puzzle can be built from. A category
// with fewer than 4 eligible movies can never fill a 4-tile group, so it's
// filtered out here rather than discovered as a dead end later.
export function buildCandidateCategories (eligibleEntries) {
  return [
    ...groupBy(eligibleEntries, movieDirectors, (name) => `Directed by ${name}`),
    ...groupBy(eligibleEntries, movieGenreNames, (name) => `Genre: ${name}`),
    ...groupBy(eligibleEntries, (entry) => { const d = movieDecade(entry); return d ? [`${d}s`] : []; }, (label) => `Released in the ${label}`),
    ...groupBy(eligibleEntries, (entry) => movieCastNames(entry, 8), (name) => `Starring ${name}`),
    ...groupBy(eligibleEntries, (entry) => (entry?.movie?.production_companies || []).map((c) => c.name), (name) => `From ${name}`)
  ];
}

// Greedily picks 4 categories with no movie shared between them, so every
// tile in the resulting puzzle has exactly one correct group. A movie CAN be
// individually eligible for more than one candidate category (e.g. also
// directed by someone else in the puzzle) — that's fine and matches real
// Connections' difficulty; what matters is each movie is only ASSIGNED to
// one group's answer key.
export function generateConnectionsPuzzle (eligibleEntries, rng = Math.random) {
  const candidates = shuffle(buildCandidateCategories(eligibleEntries), rng);
  const usedKeys = new Set();
  const chosen = [];

  for (const category of candidates) {
    if (chosen.length >= CATEGORY_COUNT) break;
    const available = category.movies.filter((entry) => !usedKeys.has(entryKey(entry)));
    if (available.length < GROUP_SIZE) continue;

    const picked = pickRandomDistinct(available, GROUP_SIZE, rng);
    picked.forEach((entry) => usedKeys.add(entryKey(entry)));
    chosen.push({ label: category.label, movies: picked });
  }

  if (chosen.length < CATEGORY_COUNT) return null; // library too small/homogeneous for a full puzzle

  const tiles = shuffle(
    chosen.flatMap((category) => category.movies.map((entry) => ({ key: entryKey(entry), entry, categoryLabel: category.label }))),
    rng
  );

  return {
    categories: chosen.map((category) => ({ label: category.label, keys: category.movies.map(entryKey) })),
    tiles
  };
}

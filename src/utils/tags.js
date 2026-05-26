// Flat, de-duped list of viewing-tag titles across all ratings of a single movie.
export function uniqueViewingTags(ratings) {
  if (!Array.isArray(ratings)) return [];
  const titles = ratings
    .flatMap((rating) => rating.tags || [])
    .map((tag) => tag && tag.title)
    .filter(Boolean);
  return [...new Set(titles)];
}

// Build a typeahead suggestion list for adding a tag to a specific viewing.
// Suggestions come from the union of (a) tags used anywhere across all movies and
// (b) the user's settings vocabulary, minus tags already on this viewing.
export function buildTagSuggestions({
  query,
  alreadyOnViewing,
  globalTagCounts,
  vocabularyTitles
}) {
  const trimmed = (query || '').trim().toLowerCase();
  if (!trimmed) return [];

  const exclude = new Set((alreadyOnViewing || []).map((t) => t.toLowerCase()));
  const counts = globalTagCounts || {};
  const vocab = vocabularyTitles || [];

  const candidates = new Map(); // lowercased -> { name, count }
  Object.keys(counts).forEach((name) => {
    candidates.set(name.toLowerCase(), { name, count: counts[name] || 0 });
  });
  vocab.forEach((name) => {
    const key = name.toLowerCase();
    if (!candidates.has(key)) {
      candidates.set(key, { name, count: 0 });
    }
  });

  return [...candidates.values()]
    .filter((c) => !exclude.has(c.name.toLowerCase()) && c.name.toLowerCase().includes(trimmed))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// Count how many viewings (ratings) each tag title has been applied to across all movies.
// Returns { [title]: count }.
export function countViewingTagUsage(movies) {
  const counts = {};
  if (!Array.isArray(movies)) return counts;
  movies.forEach((entry) => {
    const ratings = entry && entry.ratings;
    if (!Array.isArray(ratings)) return;
    ratings.forEach((rating) => {
      (rating.tags || []).forEach((tag) => {
        const title = tag && tag.title;
        if (!title) return;
        counts[title] = (counts[title] || 0) + 1;
      });
    });
  });
  return counts;
}

// Sort a vocabulary list ({ title }[]) by usage count desc, ties broken alphabetically.
export function sortVocabularyByUsage(vocabulary, counts) {
  if (!Array.isArray(vocabulary)) return [];
  const safe = counts || {};
  return [...vocabulary].sort((a, b) => {
    const ca = safe[a.title] || 0;
    const cb = safe[b.title] || 0;
    if (cb !== ca) return cb - ca;
    return a.title.localeCompare(b.title);
  });
}

// Whether the typed string would create a brand-new tag (not in vocabulary, not already on viewing).
export function canCreateNewTag({ query, alreadyOnViewing, globalTagCounts, vocabularyTitles }) {
  const trimmed = (query || '').trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  const onViewing = (alreadyOnViewing || []).some((t) => t.toLowerCase() === lower);
  if (onViewing) return false;
  const inCounts = Object.keys(globalTagCounts || {}).some((n) => n.toLowerCase() === lower);
  const inVocab = (vocabularyTitles || []).some((n) => n.toLowerCase() === lower);
  return !inCounts && !inVocab;
}

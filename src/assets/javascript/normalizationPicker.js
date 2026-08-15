// Pure math for choosing the normalization offset BY MOVIE instead of by
// number — bug report: "I find the normalization offset number a bit
// intimidating... it would be better if you could choose the movie, for
// example the last movie that deserves a 10 out of 10."
//
// GetRating.js displays: round(base + offset), where base is the movie's
// 0–10 position within [minRating, maxRating]. Picking movie M as "the last
// one that deserves a 10" means the smallest offset that still rounds M up
// to 10 — anything scoring below M then rounds to 9 or less. Store-free on
// purpose (the searchFiltering.js precedent): entries and the rating
// function come in as arguments.

// A movie's 0–10 position within the library's score range, BEFORE the
// offset is applied — must mirror GetRating.js's own normalization exactly.
export function baseNormalized (calculatedTotal, minRating, maxRating) {
  if (maxRating === minRating) return 10;
  return ((calculatedTotal - minRating) / (maxRating - minRating)) * 10;
}

// The smallest offset that makes `calculatedTotal` still display as `grade`:
// Math.round rounds .5 up, so landing exactly on (grade - 0.5) is enough.
// Rounded UP to 2 decimals — rounding down would leave the picked movie a
// hair below the boundary and showing grade-1, the exact thing picked
// against.
export function offsetForLastMovieAt (calculatedTotal, minRating, maxRating, grade = 10) {
  const raw = (grade - 0.5) - baseNormalized(calculatedTotal, minRating, maxRating);
  return Math.ceil(raw * 100) / 100;
}

// Every movie whose "make this the last 10" offset falls inside the legal
// band (the settings input allows 0–1), best score first. Each candidate
// carries the offset that picking it would store.
export function normalizationCandidates (entries, getRatingFn, { grade = 10, minOffset = 0, maxOffset = 1 } = {}) {
  const rated = (entries || [])
    .map((entry) => ({ entry, total: getRatingFn(entry)?.calculatedTotal }))
    .filter(({ total }) => Number.isFinite(total));
  if (!rated.length) return [];

  const totals = rated.map(({ total }) => total);
  const minRating = Math.min(...totals);
  const maxRating = Math.max(...totals);

  return rated
    .map(({ entry, total }) => ({
      entry,
      total,
      offset: offsetForLastMovieAt(total, minRating, maxRating, grade)
    }))
    .filter(({ offset }) => offset >= minOffset && offset <= maxOffset)
    .sort((a, b) => b.total - a.total);
}

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

// ---------------------------------------------------------------------------
// Two-anchor rating curve (2026-08-15). Feedback: "you could say, I want
// this to be a ten, and I want this to be the lowest valued five." Exactly
// two anchors on purpose — displayed ratings have 11 whole-number buckets,
// so a ceiling anchor (slope) and a mid anchor (pivot) are the only knobs
// with visible effect; more anchors would be fiddle without payoff. Movies
// are the anchors (not numbers), so the curve keeps its meaning as the
// library grows.
//
// applyNormalization is THE display step: GetRating.js hands it the movie's
// 0-10 min-max position and whatever anchors/tweak the settings hold.
//
// An anchor marks the BOTTOM of its grade bucket, so it maps to the bucket's
// rounding boundary (grade - 0.5), not the grade itself. Mapping the anchor
// to a flat 10.0 shipped first and was wrong in exactly the way the picker's
// label promises against: display rounds to the nearest whole number, so
// every movie in the top tenth of the band under the anchor ALSO rounded to
// 10 — bug report: "Coco is supposed to be the last number 10, but I'm
// seeing tens all the way down well below that." (The legacy offset picker,
// offsetForLastMovieAt above, always targeted grade - 0.5; the anchors now
// share that semantic.)
//   - ten + five anchors: piecewise linear. [fiveBase..tenBase] -> [4.5..9.5]
//     (the last-5 and last-10 boundaries), [0..fiveBase] -> [0..4.5]. The
//     anchor movie displays its grade; the next movie down displays less.
//   - ten anchor only: stretch so the anchor sits on 9.5: base * 9.5/tenBase.
//   - no anchors: the legacy constant offset (tweak), unchanged behavior.
// Always rounded to a whole number and clamped to [0, 10]; anything scoring
// above the ten-anchor clamps to 10.
/**
 * The curve's answer BEFORE rounding.
 *
 * Split out from applyNormalization (2026-08-24) so the curve preview can
 * show its working: "5.57 → 4.30 → 4" makes the rounding step visible, which
 * is the step people are actually surprised by. Feedback that prompted it:
 * "I'd like more clarity on what the results of my choices are when I make
 * them." Nothing about the curve changed — applyNormalization still rounds
 * and clamps exactly as it did.
 */
export function normalizedValue (base, { tweak = 0.25, tenBase = null, fiveBase = null } = {}) {
  const hasTen = Number.isFinite(tenBase) && tenBase > 0;
  const hasFive = Number.isFinite(fiveBase) && fiveBase >= 0;

  if (hasTen && hasFive && tenBase > fiveBase) {
    if (base >= fiveBase) {
      return 4.5 + (5 * (base - fiveBase)) / (tenBase - fiveBase);
    }
    return fiveBase === 0 ? 0 : (4.5 * base) / fiveBase;
  }
  if (hasTen) {
    return (base * 9.5) / tenBase;
  }
  return base + tweak;
}

export function applyNormalization (base, options = {}) {
  return Math.max(0, Math.min(10, Math.round(normalizedValue(base, options))));
}

// Initial window into the (rank-sorted) picker pool. The ten-picker opens
// at the top and lazy-extends rightward; the five-picker opens CENTERED on
// the rank-median — "show the middle, and then let me scroll either
// direction... until I find the one I want" (feedback) — and lazy-extends
// both ways.
export function initialPickerWindow (poolLength, { centered = false, size = 24 } = {}) {
  if (!poolLength) return { start: 0, end: 0 };
  if (!centered) return { start: 0, end: Math.min(poolLength, size) };

  const middle = Math.floor((poolLength - 1) / 2);
  const half = Math.floor(size / 2);
  const start = Math.max(0, Math.min(middle - half, poolLength - size));
  return { start, end: Math.min(poolLength, start + size) };
}

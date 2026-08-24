// "What did I just do to my library?" — the whole curve, one row per rating.
//
// Matt, 2026-08-24: "It feels like it's more skewed than I'd like it to be. I
// think what we need is more clarity on what the results of my choices are
// when I make them... show me what the lowest ten is, and then an example of
// each of the numbers, nine eight seven six five four three two one, and show
// me what their actual score is and what their normalized score is."
//
// The confusion this answers is real and specific. He asked why a 5.57 shows
// as a 4, reasoning that 5.57 looks average. Two things are true at once and
// neither is visible anywhere in the app:
//
//   1. The raw score is NOT a 0-10 quality scale. His median film scores 6.04,
//      so 5.57 sits at the 36th percentile — below average, not average.
//   2. The five-anchor does far more work than its label suggests. Naming a
//      film "my lowest 5" declares that EVERY film below it is a 4 or worse.
//      His anchor was ranked 788 of 1381, so it silently declared 43% of the
//      library sub-5.
//
// A number in a settings field can't convey either. A ladder of real films can:
// reading "the worst 8 in my library is X" is a judgement anyone can make in a
// second, and the counts beside it show the shape.
//
// Each row is anchored on the LOWEST-scoring film at that rating — the film on
// the line. That matches how the anchors themselves are phrased ("my lowest
// rated 10"), and it's the decision-relevant one: the boundary is where a
// curve feels wrong, not the middle of a band.

import { baseNormalized, normalizedValue } from './normalizationPicker.js';

/**
 * One row per rating that has films in it, 10 down to 0.
 *
 * `rated` is [{ entry, total }] — total being the raw calculatedTotal. The
 * min/max that define the curve are derived from `rated` itself, so this
 * mirrors GetRating.js rather than restating it: hand it the same library and
 * it produces the same grades the app shows.
 *
 * Anchors come in as TOTALS, not bases, deliberately. Bases are relative to
 * the library's min/max, so a caller computing them itself would have to
 * duplicate that arithmetic and could drift out of step — the exact class of
 * bug where a preview says one thing and the app does another.
 */
export function curveLadder (
  rated,
  {
    tenTotal = null, fiveTotal = null, tweak = 0.25, anchorKeys = []
  } = {}
) {
  const items = (rated || []).filter((item) => Number.isFinite(item?.total));
  if (!items.length) return [];

  const totals = items.map((item) => item.total);
  const minRating = Math.min(...totals);
  const maxRating = Math.max(...totals);

  // A library where everything scores the same has no curve to preview.
  if (minRating === maxRating) return [];

  const toBase = (total) =>
    (Number.isFinite(total) ? baseNormalized(total, minRating, maxRating) : null);
  const options = {
    tweak,
    tenBase: toBase(tenTotal),
    fiveBase: toBase(fiveTotal)
  };

  const graded = items.map((item) => {
    const value = normalizedValue(baseNormalized(item.total, minRating, maxRating), options);
    return {
      ...item,
      value,
      grade: Math.max(0, Math.min(10, Math.round(value)))
    };
  });

  const buckets = new Map();
  graded.forEach((item) => {
    const bucket = buckets.get(item.grade);
    if (bucket) bucket.push(item);
    else buckets.set(item.grade, [item]);
  });

  const rows = [];
  for (let grade = 10; grade >= 0; grade -= 1) {
    const bucket = buckets.get(grade);
    if (!bucket?.length) continue;

    // Ties on the raw score are common (the library has 1,381 films over 572
    // distinct 2-decimal scores), so the order within a tie has to be decided
    // on purpose, twice over:
    //
    // - An ANCHOR wins its tie. The real library has twelve films scoring
    //   exactly 5.7800, one of which is the five-anchor, and picking
    //   alphabetically named a different film on the very row the user chose.
    //   That silently breaks the confirmation this table exists for: you set
    //   "The Game" as your lowest 5 and the 5 row should say The Game.
    // - Otherwise by title, so the named film can't shuffle between renders
    //   with nothing having changed, which would read as a bug in the preview.
    const anchors = new Set((anchorKeys || []).filter(Boolean));
    const isAnchor = (item) => anchors.has(item.entry?.dbKey);
    const sorted = [...bucket].sort((a, b) =>
      a.total - b.total
      || (isAnchor(b) ? 1 : 0) - (isAnchor(a) ? 1 : 0)
      || String(a.entry?.movie?.title || '').localeCompare(String(b.entry?.movie?.title || ''))
    );

    rows.push({
      grade,
      count: bucket.length,
      lowest: sorted[0],
      highest: sorted[sorted.length - 1]
    });
  }

  return rows;
}

/**
 * How many movies sit at each rating — raw versus curved — for the chart.
 *
 * Matt, 2026-08-24: "The x axis should be the ratings, and I wanna see the
 * bell curve, and I wanted to compare the actual curve of my real ratings
 * versus the normalized curve that we're forcing it into."
 *
 * This is a DISTRIBUTION, not a transfer function. An earlier version plotted
 * score-in against score-out across the library and he rejected it — rightly:
 * it showed what the curve does to an individual film, when the question was
 * about the shape of the whole library. Two bells on one axis answer that
 * directly. On his real data the raw scores peak at 6-7 and the curve moves
 * the peak to 4-5, which is the "skew" he could feel but not see.
 *
 * Both series are counted into the same integer 0-10 buckets, because two
 * distributions on different axes cannot be compared by eye. `actual` rounds
 * the raw score; `adjusted` is the rating the app displays.
 */
export function curveDistribution (rated, {
  tenTotal = null, fiveTotal = null, tweak = 0.25
} = {}) {
  const items = (rated || []).filter((item) => Number.isFinite(item?.total));
  if (!items.length) return [];

  const totals = items.map((item) => item.total);
  const minRating = Math.min(...totals);
  const maxRating = Math.max(...totals);
  if (minRating === maxRating) return [];

  const toBase = (total) =>
    (Number.isFinite(total) ? baseNormalized(total, minRating, maxRating) : null);
  const options = { tweak, tenBase: toBase(tenTotal), fiveBase: toBase(fiveTotal) };
  const bucket = (value) => Math.max(0, Math.min(10, Math.round(value)));

  const rows = Array.from({ length: 11 }, (_, rating) => ({ rating, actual: 0, adjusted: 0 }));
  items.forEach((item) => {
    rows[bucket(item.total)].actual += 1;
    rows[bucket(normalizedValue(baseNormalized(item.total, minRating, maxRating), options))].adjusted += 1;
  });
  return rows;
}

/**
 * The share of the library sitting at or below `grade`, as a percentage.
 *
 * The "43% of your library is below a 5" figure, which is the sentence that
 * actually explained the surprise. Rows come from curveLadder.
 */
export function shareAtOrBelow (rows, grade) {
  const total = (rows || []).reduce((sum, row) => sum + row.count, 0);
  if (!total) return 0;
  const below = (rows || [])
    .filter((row) => row.grade <= grade)
    .reduce((sum, row) => sum + row.count, 0);
  return Math.round((below / total) * 100);
}

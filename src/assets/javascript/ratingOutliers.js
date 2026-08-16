// Reworked Outliers + Best Years (Matt, 2026-08-15: the SD-threshold
// slider was "stats homework" — replace with two fixed cards; and the
// yearly-averages bar chart wasn't readable but "what is the best year
// of movies I've ever watched" must survive — as a ranked list, by
// RELEASE year (Deep Stats' Years section is watch-year; not a dupe).

import { logScore, globalAverage } from './logScore.js';

// "You love these" / "You're hardest on these": entities whose average
// rating sits furthest from the library average, with a minimum film
// count so tiny samples can't fake significance. No slider.
export function tasteOutliers (entries, getRatingFn, { minCount = 5, cap = 8, perType = 3 } = {}) {
  const globalAvg = globalAverage(entries, getRatingFn);
  if (!Number.isFinite(globalAvg)) return { loved: [], hardest: [] };

  const buckets = new Map(); // `${type}:${name}` -> { type, name, ratings: [] }
  const add = (type, name, rating) => {
    if (!name || !Number.isFinite(rating)) return;
    const key = `${type}:${name}`;
    if (!buckets.has(key)) buckets.set(key, { type, name, ratings: [] });
    buckets.get(key).ratings.push(rating);
  };

  (entries || []).forEach((entry) => {
    const rating = getRatingFn(entry)?.calculatedTotal;
    if (!Number.isFinite(rating)) return;
    const movie = entry?.movie || {};
    (movie.genres || []).forEach((genre) => add('Genre', genre?.name, rating));
    (movie.crew || []).forEach((person) => {
      if (person?.job === 'Director') add('Director', person.name, rating);
    });
    (movie.cast || []).slice(0, 6).forEach((person) => add('Actor', person?.name, rating));
    (movie.flatKeywords || []).forEach((keyword) => add('Keyword', keyword, rating));
    (movie.production_companies || []).forEach((studio) => add('Studio', studio?.name, rating));
  });

  const qualified = [...buckets.values()]
    .filter((bucket) => bucket.ratings.length >= minCount)
    .map((bucket) => {
      const average = bucket.ratings.reduce((a, b) => a + b, 0) / bucket.ratings.length;
      return {
        type: bucket.type,
        name: bucket.name,
        count: bucket.ratings.length,
        average: Math.round(average * 100) / 100,
        deviation: Math.round((average - globalAvg) * 100) / 100
      };
    });

  // TMDB attaches dozens of keywords per film, so unfiltered these lists
  // come back nearly all keywords ("tennis", "jewelry") and bury the
  // genres/people/studios that actually read as taste. Cap per type.
  const diversify = (list) => {
    const used = {};
    const picked = [];
    list.forEach((item) => {
      if (picked.length >= cap) return;
      used[item.type] = used[item.type] || 0;
      if (used[item.type] >= perType) return;
      used[item.type] += 1;
      picked.push(item);
    });
    return picked;
  };

  return {
    loved: diversify(qualified.filter((q) => q.deviation > 0).sort((a, b) => b.deviation - a.deviation)),
    hardest: diversify(qualified.filter((q) => q.deviation < 0).sort((a, b) => a.deviation - b.deviation))
  };
}

// Release years ranked by log score (Brian's method — the house standard),
// so a year needs both quality AND depth to top the list. Ties in score
// break toward the deeper year.
export function bestReleaseYears (entries, getRatingFn, weights = {}, { minCount = 4 } = {}) {
  const globalAvg = globalAverage(entries, getRatingFn);
  const byYear = new Map();

  (entries || []).forEach((entry) => {
    const rating = getRatingFn(entry)?.calculatedTotal;
    const year = new Date(entry?.movie?.release_date ?? NaN).getFullYear();
    if (!Number.isFinite(rating) || !Number.isFinite(year)) return;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push({ entry, rating });
  });

  return [...byYear.entries()]
    .filter(([, films]) => films.length >= minCount)
    .map(([year, films]) => {
      const sorted = [...films].sort((a, b) => b.rating - a.rating);
      return {
        year,
        count: films.length,
        score: logScore(films.map((f) => f.rating), globalAvg, weights),
        average: Math.round((films.reduce((sum, f) => sum + f.rating, 0) / films.length) * 100) / 100,
        top: sorted[0]?.entry || null
      };
    })
    .filter((y) => y.score !== null)
    .sort((a, b) => (b.score - a.score) || (b.count - a.count));
}

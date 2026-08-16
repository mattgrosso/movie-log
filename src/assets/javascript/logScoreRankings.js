// Brian's ranking method, verbatim, as a standalone list builder (Matt,
// 2026-08-15: "keep my existing ranking for directors as a test case, and
// then right after it a ranking of directors using the same methods Brian
// uses"). Deliberately UNTUNED: plain composite ratings, rank weighting
// R/(R+i) best-first, Bayesian pull toward the library's global average —
// no known-for bonus, no count bonus, no direction blending, no manual
// levers. Differences from the Favorite Directors list above it are the
// whole point.

import { logScore, globalAverage } from './logScore.js';

export function rankDirectorsByLogScore (entries, getRatingFn, weights = {}) {
  const globalAvg = globalAverage(entries, getRatingFn);
  const byDirector = new Map();

  (entries || []).forEach((entry) => {
    const rating = getRatingFn(entry)?.calculatedTotal;
    if (!Number.isFinite(rating)) return;
    const credited = new Set();
    (entry?.movie?.crew || []).forEach((person) => {
      if (person?.job !== 'Director' || !person.name || credited.has(person.name)) return;
      credited.add(person.name); // TMDB sometimes lists a director twice on one film
      if (!byDirector.has(person.name)) byDirector.set(person.name, []);
      byDirector.get(person.name).push({ entry, rating });
    });
  });

  return [...byDirector.entries()]
    .map(([name, films]) => ({
      name,
      count: films.length,
      score: logScore(films.map((film) => film.rating), globalAvg, weights),
      films: [...films].sort((a, b) => b.rating - a.rating)
    }))
    .filter((director) => director.score !== null)
    .sort((a, b) => (b.score - a.score) || (b.count - a.count) || a.name.localeCompare(b.name));
}

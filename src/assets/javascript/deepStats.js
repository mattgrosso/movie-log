// Deep Stats — the engine behind /stats (adopted and adapted from Brian's
// Movie Log after a full survey of his Stats suite, 2026-08-15). Pure and
// store-free; every section returns plain data a screen can render.
// Group scoring uses the Log Score (logScore.js) throughout.

import { logScore, globalAverage } from './logScore.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365.25 * DAY_MS;

function mostRecent (entry) {
  const ratings = entry?.ratings || [];
  let best = null;
  ratings.forEach((rating) => {
    const time = new Date(rating?.date ?? NaN).getTime();
    if (!Number.isFinite(time)) return;
    if (!best || time > best.time) best = { rating, time };
  });
  return best;
}

function viewingTimes (entry) {
  return (entry?.ratings || [])
    .map((rating) => new Date(rating?.date ?? NaN).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// The Crown: walk release years oldest-first; each film that beats the
// all-time-high rating takes the crown and reigns until dethroned.
export function crownTimeline (entries, getRatingFn, now = Date.now()) {
  const dated = (entries || [])
    .map((entry) => {
      const rating = getRatingFn(entry)?.calculatedTotal;
      const year = new Date(entry?.movie?.release_date ?? NaN).getFullYear();
      if (!Number.isFinite(rating) || !Number.isFinite(year)) return null;
      return { entry, rating, year };
    })
    .filter(Boolean)
    .sort((a, b) => (a.year - b.year) || (b.rating - a.rating));

  const reigns = [];
  let high = -Infinity;
  dated.forEach(({ entry, rating, year }) => {
    if (rating > high) {
      high = rating;
      if (reigns.length) reigns[reigns.length - 1].until = year;
      reigns.push({ entry, rating, year, until: null });
    }
  });

  const nowYear = new Date(now).getFullYear();
  return reigns.map((reign, index) => ({
    ...reign,
    current: index === reigns.length - 1,
    reignYears: (reign.until ?? nowYear) - reign.year
  }));
}

// ---------------------------------------------------------------------------
// The Pantheon: every film with a perfect mark in any rating category, from
// its most recent viewing. Cinema Roll's criteria and their perfect values.
const PANTHEON_CATEGORIES = [
  { key: 'direction', label: 'Direction', perfect: 10 },
  { key: 'imagery', label: 'Imagery', perfect: 10 },
  { key: 'story', label: 'Story', perfect: 10 },
  { key: 'performance', label: 'Performance', perfect: 10 },
  { key: 'soundtrack', label: 'Soundtrack', perfect: 10 },
  { key: 'overall', label: 'Overall', perfect: 10 },
  { key: 'love', label: 'Love', perfect: 5 },
  { key: 'stickiness', label: 'Stickiness', perfect: 5 }
];

export function pantheon (entries, getRatingFn) {
  const categories = PANTHEON_CATEGORIES.map((category) => ({ ...category, films: [] }));
  const perFilmCounts = new Map();

  (entries || []).forEach((entry) => {
    const recent = mostRecent(entry);
    if (!recent) return;
    const total = getRatingFn(entry)?.calculatedTotal ?? null;
    categories.forEach((category) => {
      if (Number(recent.rating[category.key]) === category.perfect) {
        category.films.push({ entry, rating: total });
        perFilmCounts.set(entry, (perFilmCounts.get(entry) || 0) + 1);
      }
    });
  });

  categories.forEach((category) => category.films.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)));

  // Constellations: films perfect in 2+ categories, most stars first.
  const constellations = [...perFilmCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([entry, count]) => ({ entry, count }))
    .sort((a, b) => b.count - a.count);

  return {
    categories: categories.filter((category) => category.films.length),
    constellations,
    perfectFilms: perFilmCounts.size,
    totalMarks: [...perFilmCounts.values()].reduce((a, b) => a + b, 0)
  };
}

// ---------------------------------------------------------------------------
// Rewatches: return engagements and how long they take.
export function rewatchStats (entries) {
  let repeatViewings = 0;
  const revisited = [];
  const gaps = [];
  const quickest = [];
  let totalFilms = 0;

  (entries || []).forEach((entry) => {
    const times = viewingTimes(entry);
    if (!times.length) return;
    totalFilms += 1;
    if (times.length < 2) return;
    repeatViewings += times.length - 1;
    revisited.push({ entry, viewings: times.length });
    let minGap = Infinity;
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      gaps.push(gap);
      if (gap < minGap) minGap = gap;
    }
    quickest.push({ entry, gapMs: minGap, gapDays: minGap / DAY_MS });
  });

  if (!revisited.length) return null;

  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)];

  return {
    repeatViewings,
    filmsRevisited: revisited.length,
    rewatchRate: revisited.length / totalFilms,
    medianReturnYears: medianGap / YEAR_MS,
    mostRewatched: revisited.sort((a, b) => b.viewings - a.viewings).slice(0, 12),
    quickestReturns: quickest.sort((a, b) => a.gapMs - b.gapMs).slice(0, 12)
  };
}

// ---------------------------------------------------------------------------
// Marathon Club: greatest runs by day / week / month, plus lifetime totals.
function periodKeys (time) {
  const date = new Date(time);
  const day = date.toDateString();
  const oneJan = new Date(date.getFullYear(), 0, 1);
  const week = `${date.getFullYear()}-w${Math.ceil(((date - oneJan) / DAY_MS + oneJan.getDay() + 1) / 7)}`;
  const month = `${date.getFullYear()}-${date.getMonth()}`;
  return { day, week, month };
}

export function marathonStats (entries, { includeShorts = false } = {}) {
  const byDay = new Map();
  const byWeek = new Map();
  const byMonth = new Map();
  let admissions = 0;
  let screenMinutes = 0;

  (entries || []).forEach((entry) => {
    const runtime = entry?.movie?.runtime;
    if (!includeShorts && Number.isFinite(runtime) && runtime <= 40) return;
    viewingTimes(entry).forEach((time) => {
      admissions += 1;
      if (Number.isFinite(runtime) && runtime > 0) screenMinutes += runtime;
      const { day, week, month } = periodKeys(time);
      [[byDay, day], [byWeek, week], [byMonth, month]].forEach(([map, key]) => {
        const bucket = map.get(key) || { count: 0, minutes: 0, entries: [], time };
        bucket.count += 1;
        bucket.minutes += Number.isFinite(runtime) && runtime > 0 ? runtime : 0;
        bucket.entries.push(entry);
        map.set(key, bucket);
      });
    });
  });

  if (!admissions) return null;

  const recordOf = (map) => [...map.values()].sort((a, b) => (b.count - a.count) || (b.minutes - a.minutes))[0];
  const topDays = [...byDay.entries()]
    .map(([day, bucket]) => ({ day, ...bucket }))
    .sort((a, b) => (b.count - a.count) || (b.minutes - a.minutes))
    .slice(0, 8);

  return {
    admissions,
    screenMinutes,
    movieDays: byDay.size,
    activeWeeks: byWeek.size,
    activeMonths: byMonth.size,
    dayRecord: recordOf(byDay),
    weekRecord: recordOf(byWeek),
    monthRecord: recordOf(byMonth),
    topDays
  };
}

// ---------------------------------------------------------------------------
// Activity years: what you watched each calendar year, log-scored.
export function yearStats (entries, getRatingFn, weights) {
  const globalAvg = globalAverage(entries, getRatingFn);
  const byYear = new Map();

  (entries || []).forEach((entry) => {
    const recent = mostRecent(entry);
    if (!recent) return;
    const watchYear = new Date(recent.time).getFullYear();
    const releaseYear = new Date(entry?.movie?.release_date ?? NaN).getFullYear();
    const rating = getRatingFn(entry)?.calculatedTotal;
    const bucket = byYear.get(watchYear) || { watched: [], fromYear: 0 };
    bucket.watched.push({ entry, rating });
    if (releaseYear === watchYear) bucket.fromYear += 1;
    byYear.set(watchYear, bucket);
  });

  return [...byYear.entries()]
    .map(([year, bucket]) => {
      const scores = bucket.watched.map((w) => w.rating).filter(Number.isFinite);
      const top = [...bucket.watched].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
      return {
        year,
        watched: bucket.watched.length,
        fromYear: bucket.fromYear,
        score: logScore(scores, globalAvg, weights),
        top: top?.entry || null
      };
    })
    .sort((a, b) => b.year - a.year);
}

// ---------------------------------------------------------------------------
// Genres, ranked by log score.
export function genreStats (entries, getRatingFn, weights, { minCount = 3, cap = 12 } = {}) {
  const globalAvg = globalAverage(entries, getRatingFn);
  const byGenre = new Map();

  (entries || []).forEach((entry) => {
    const rating = getRatingFn(entry)?.calculatedTotal;
    if (!Number.isFinite(rating)) return;
    (entry?.movie?.genres || []).forEach((genre) => {
      if (!genre?.name) return;
      const bucket = byGenre.get(genre.name) || [];
      bucket.push({ entry, rating });
      byGenre.set(genre.name, bucket);
    });
  });

  return [...byGenre.entries()]
    .filter(([, films]) => films.length >= minCount)
    .map(([name, films]) => ({
      name,
      count: films.length,
      score: logScore(films.map((f) => f.rating), globalAvg, weights),
      top: [...films].sort((a, b) => b.rating - a.rating).slice(0, 8).map((f) => f.entry)
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, cap);
}

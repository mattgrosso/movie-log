// Film Club visualizations. Matt, 2026-08-17: "It seems like there must be
// some more fun graphs we could build around film club relationships. What
// sort of visualizations can we come up with?" — then: "be creative, make
// them fun, make them pretty."
//
// WHAT THE DATA ALLOWS, which shapes every chart here. A published friend
// profile carries `ratings: { [tmdbId]: {r, at, t, p, c?} }` — a score, when
// they watched it, a title, a poster, and the eight-criterion breakdown only
// if they opted into sharing it. There is no genre and no release date on a
// friend's rating.
//
// So anything cut by genre or decade can only be computed across the OVERLAP,
// joined to your own library for those fields. That's not a limitation worth
// fighting: every chart in here is about a relationship, and a relationship
// only exists where two libraries meet.

import { criteriaArrayFrom } from './social.js';

const PALETTE = [
  '#cd7fe8', // purple — Insights' People accent, the club's home colour
  '#4fa3e3',
  '#6fd39b',
  '#ffb347',
  '#ff8fa3',
  '#f2d857',
  '#7bd6d0',
  '#b0a0ff'
];

export const YOU_COLOR = '#f0f0f0';

/**
 * A stable colour per member, so a person is the same colour in every chart.
 * Assigned by sorted key rather than by hash: a hash gives no control over
 * whether two friends land on near-identical hues, and the club is small.
 */
export function memberColors (keys) {
  const sorted = [...new Set(keys || [])].sort();
  const colors = {};
  sorted.forEach((key, index) => { colors[key] = PALETTE[index % PALETTE.length]; });
  return colors;
}

function round1 (n) {
  return Math.round(n * 10) / 10;
}

function round2 (n) {
  return Math.round(n * 100) / 100;
}

/**
 * The join every chart below is built on: for each friend, the films you have
 * both rated, carrying both scores plus the genre/decade/date fields that
 * only your own library has.
 */
export function buildOverlaps (myEntries, getRatingFn, profiles) {
  const mine = new Map();
  (myEntries || []).forEach((entry) => {
    const rating = getRatingFn(entry)?.calculatedTotal;
    const id = entry?.movie?.id;
    if (!Number.isFinite(rating) || id == null) return;

    const year = new Date(entry.movie.release_date ?? NaN).getFullYear();
    mine.set(id, {
      id,
      score: rating,
      title: entry.movie.title,
      poster: entry.movie.poster_path || null,
      genres: (entry.movie.genres || []).map((genre) => genre?.name).filter(Boolean),
      decade: Number.isFinite(year) ? Math.floor(year / 10) * 10 : null,
      at: Number(getRatingFn(entry)?.date) || null,
      criteria: criteriaArrayFrom(getRatingFn(entry))
    });
  });

  const overlaps = Object.entries(profiles || {})
    .filter(([, profile]) => profile)
    .map(([key, profile]) => {
      const shared = [];
      let theirTotal = 0;

      Object.entries(profile.ratings || {}).forEach(([id, their]) => {
        if (!Number.isFinite(their?.r)) return;
        theirTotal += 1;
        const ours = mine.get(Number(id));
        if (!ours) return;
        shared.push({
          ...ours,
          theirs: their.r,
          theirAt: Number(their.at) || null,
          gap: round2(ours.score - their.r),
          // Only present when they opted into sharing their breakdown; the
          // radar is the one chart that needs it, and it says so when absent.
          theirCriteria: Array.isArray(their.c) ? their.c : null,
          myCriteria: ours.criteria || null
        });
      });

      return { key, name: profile.name || key, shared, theirTotal, profile };
    });

  return { mine, overlaps };
}

/**
 * THE TASTE MAP. Each friend is a point: their average across your shared
 * films against yours across the same films. The diagonal is total agreement,
 * so distance from it is who runs hotter or cooler than you — which is a
 * different question from alignment, and the one a scatter answers best.
 */
export function tasteMap (overlaps) {
  return (overlaps || [])
    .filter((friend) => friend.shared.length)
    .map((friend) => {
      const mine = friend.shared.reduce((sum, film) => sum + film.score, 0) / friend.shared.length;
      const theirs = friend.shared.reduce((sum, film) => sum + film.theirs, 0) / friend.shared.length;
      const gap = friend.shared.reduce((sum, film) => sum + Math.abs(film.gap), 0) / friend.shared.length;

      return {
        key: friend.key,
        name: friend.name,
        mine: round2(mine),
        theirs: round2(theirs),
        shared: friend.shared.length,
        alignment: round2(Math.max(0, 10 - gap)),
        // Positive: they rate the same films higher than you do.
        lean: round2(theirs - mine)
      };
    })
    .sort((a, b) => b.alignment - a.alignment);
}

/**
 * OVERLAP. How much of each library the two of you share — and how much of
 * theirs you've never touched, which is the interesting half.
 */
export function overlapBars (overlaps, myCount) {
  return (overlaps || []).map((friend) => ({
    key: friend.key,
    name: friend.name,
    shared: friend.shared.length,
    onlyThem: Math.max(0, friend.theirTotal - friend.shared.length),
    onlyYou: Math.max(0, (myCount || 0) - friend.shared.length),
    theirTotal: friend.theirTotal,
    // Of everything they've rated, the share you've also seen.
    coverage: friend.theirTotal
      ? Math.round((friend.shared.length / friend.theirTotal) * 100)
      : 0
  })).sort((a, b) => b.shared - a.shared);
}

/** Alignment sliced by a field of the shared film. */
function alignmentBy (overlaps, pick, { minFilms = 3 } = {}) {
  const buckets = new Map();

  (overlaps || []).forEach((friend) => {
    friend.shared.forEach((film) => {
      const values = pick(film);
      (Array.isArray(values) ? values : [values]).forEach((value) => {
        if (value === null || value === undefined) return;
        const bucket = buckets.get(value) || { value, byFriend: new Map(), films: 0 };
        const stat = bucket.byFriend.get(friend.key) || { key: friend.key, name: friend.name, gap: 0, films: 0 };
        stat.gap += Math.abs(film.gap);
        stat.films += 1;
        bucket.byFriend.set(friend.key, stat);
        bucket.films += 1;
        buckets.set(value, bucket);
      });
    });
  });

  return [...buckets.values()]
    .map((bucket) => ({
      value: bucket.value,
      films: bucket.films,
      friends: [...bucket.byFriend.values()]
        .filter((stat) => stat.films >= minFilms)
        .map((stat) => ({
          key: stat.key,
          name: stat.name,
          films: stat.films,
          alignment: round1(Math.max(0, 10 - stat.gap / stat.films))
        }))
    }))
    .filter((bucket) => bucket.friends.length);
}

/**
 * AGREEMENT BY DECADE — do you fall out over new releases and make peace over
 * the seventies? Release dates come from your own library, since a friend's
 * rating doesn't carry one.
 */
export function agreementByDecade (overlaps, options) {
  return alignmentBy(overlaps, (film) => film.decade, options)
    .sort((a, b) => a.value - b.value)
    .map((bucket) => ({ ...bucket, label: `${bucket.value}s` }));
}

/** AGREEMENT BY GENRE — same idea, cut the other way. */
export function agreementByGenre (overlaps, { cap = 8, ...options } = {}) {
  return alignmentBy(overlaps, (film) => film.genres, options)
    .sort((a, b) => b.films - a.films)
    .slice(0, cap)
    .map((bucket) => ({ ...bucket, label: bucket.value }));
}

/**
 * GENEROSITY. Everyone's score distribution side by side — who hands out
 * nines and who has never once been impressed. Your own curve is included so
 * there's something to be generous relative to.
 *
 * Deliberately across each member's WHOLE published library rather than the
 * overlap: this is a fact about a person, not about a relationship.
 */
export function generosityCurves (myEntries, getRatingFn, profiles) {
  const empty = () => Array.from({ length: 11 }, () => 0);

  const curveFrom = (scores) => {
    const buckets = empty();
    scores.forEach((score) => {
      buckets[Math.max(0, Math.min(10, Math.round(score)))] += 1;
    });
    const total = scores.length;
    const sorted = [...scores].sort((a, b) => a - b);
    return {
      buckets,
      total,
      peak: Math.max(...buckets),
      average: total ? round2(scores.reduce((a, b) => a + b, 0) / total) : null,
      median: total ? round2(sorted[Math.floor(total / 2)]) : null
    };
  };

  const myScores = (myEntries || [])
    .map((entry) => getRatingFn(entry)?.calculatedTotal)
    .filter(Number.isFinite);

  const curves = [{ key: 'you', name: 'You', ...curveFrom(myScores) }];

  Object.entries(profiles || {}).forEach(([key, profile]) => {
    if (!profile) return;
    const scores = Object.values(profile.ratings || {})
      .map((rating) => rating?.r)
      .filter(Number.isFinite);
    if (!scores.length) return;
    curves.push({ key, name: profile.name || key, ...curveFrom(scores) });
  });

  return curves.filter((curve) => curve.total);
}

/**
 * THE CONTRARIAN SCOREBOARD. Across every film three or more of you have
 * rated, who is furthest from the group most often? Needs three, because with
 * two everyone is equally far from the middle by definition.
 */
export function contrarians (myEntries, getRatingFn, profiles) {
  const byFilm = new Map();

  (myEntries || []).forEach((entry) => {
    const score = getRatingFn(entry)?.calculatedTotal;
    const id = entry?.movie?.id;
    if (!Number.isFinite(score) || id == null) return;
    byFilm.set(id, {
      id,
      title: entry.movie.title,
      poster: entry.movie.poster_path || null,
      scores: [{ key: 'you', name: 'You', r: score }]
    });
  });

  Object.entries(profiles || {}).forEach(([key, profile]) => {
    if (!profile) return;
    Object.entries(profile.ratings || {}).forEach(([id, their]) => {
      if (!Number.isFinite(their?.r)) return;
      const filmId = Number(id);
      const film = byFilm.get(filmId) || { id: filmId, title: their.t, poster: their.p || null, scores: [] };
      film.scores.push({ key, name: profile.name || key, r: their.r });
      byFilm.set(filmId, film);
    });
  });

  const tally = new Map();
  const moments = [];

  byFilm.forEach((film) => {
    if (film.scores.length < 3) return;
    const mean = film.scores.reduce((sum, s) => sum + s.r, 0) / film.scores.length;
    let furthest = null;

    film.scores.forEach((score) => {
      const distance = Math.abs(score.r - mean);
      if (!furthest || distance > furthest.distance) furthest = { ...score, distance };
      const stat = tally.get(score.key) || { key: score.key, name: score.name, judged: 0, furthest: 0 };
      stat.judged += 1;
      tally.set(score.key, stat);
    });

    tally.get(furthest.key).furthest += 1;
    moments.push({
      id: film.id,
      title: film.title,
      poster: film.poster,
      who: furthest.name,
      whoKey: furthest.key,
      score: furthest.r,
      groupAverage: round2(mean),
      distance: round2(furthest.distance)
    });
  });

  return {
    board: [...tally.values()]
      .filter((stat) => stat.judged)
      .map((stat) => ({
        ...stat,
        rate: Math.round((stat.furthest / stat.judged) * 100)
      }))
      .sort((a, b) => b.rate - a.rate || b.furthest - a.furthest),
    moments: moments.sort((a, b) => b.distance - a.distance).slice(0, 12)
  };
}

/**
 * BLIND SPOTS. Films several of your friends have rated and you never have,
 * most-seen first — the club's shared canon, minus you.
 */
export function blindSpots (myEntries, getRatingFn, profiles, { minFriends = 2, cap = 20 } = {}) {
  const mine = new Set();
  (myEntries || []).forEach((entry) => {
    if (entry?.movie?.id != null) mine.add(entry.movie.id);
  });

  const seen = new Map();
  Object.values(profiles || {}).forEach((profile) => {
    if (!profile) return;
    Object.entries(profile.ratings || {}).forEach(([id, their]) => {
      const filmId = Number(id);
      if (mine.has(filmId) || !Number.isFinite(their?.r)) return;
      const film = seen.get(filmId) || { id: filmId, title: their.t, poster: their.p || null, scores: [] };
      film.scores.push(their.r);
      seen.set(filmId, film);
    });
  });

  return [...seen.values()]
    .filter((film) => film.scores.length >= minFriends)
    .map((film) => ({
      id: film.id,
      title: film.title,
      poster: film.poster,
      friends: film.scores.length,
      average: round2(film.scores.reduce((a, b) => a + b, 0) / film.scores.length)
    }))
    .sort((a, b) => b.friends - a.friends || b.average - a.average)
    .slice(0, cap);
}

/**
 * SYNC MOMENTS. Films you and a friend happened to watch within days of each
 * other, without planning it. Pure fun, and it needs both `at` timestamps —
 * which is exactly why the feed carries them.
 */
export function syncMoments (overlaps, { withinDays = 7, cap = 12 } = {}) {
  const DAY = 24 * 60 * 60 * 1000;

  return (overlaps || [])
    .flatMap((friend) => friend.shared
      .filter((film) => film.at && film.theirAt)
      .map((film) => ({
        key: friend.key,
        name: friend.name,
        id: film.id,
        title: film.title,
        poster: film.poster,
        mine: film.score,
        theirs: film.theirs,
        apart: Math.round(Math.abs(film.at - film.theirAt) / DAY),
        at: Math.max(film.at, film.theirAt)
      })))
    .filter((moment) => moment.apart <= withinDays)
    .sort((a, b) => a.apart - b.apart || b.at - a.at)
    .slice(0, cap);
}

/**
 * CLUB ACTIVITY. Viewings per month per member over the last year, so you can
 * see who's been on a tear and who has gone quiet.
 */
export function clubActivity (myEntries, getRatingFn, profiles, { months = 12, now = Date.now() } = {}) {
  const end = new Date(now);
  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(end.getFullYear(), end.getMonth() - i, 1);
    keys.push({ key: `${date.getFullYear()}-${date.getMonth()}`, year: date.getFullYear(), month: date.getMonth() });
  }
  const index = new Map(keys.map((entry, position) => [entry.key, position]));

  const series = [];
  const countInto = (name, key, timestamps) => {
    const counts = keys.map(() => 0);
    timestamps.forEach((at) => {
      if (!at) return;
      const date = new Date(at);
      const position = index.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (position !== undefined) counts[position] += 1;
    });
    if (counts.some((count) => count)) series.push({ key, name, counts });
  };

  countInto('You', 'you', (myEntries || []).flatMap((entry) =>
    (entry?.ratings || []).map((rating) => Number(rating?.date) || null)
  ));

  Object.entries(profiles || {}).forEach(([key, profile]) => {
    if (!profile) return;
    countInto(
      profile.name || key,
      key,
      Object.values(profile.ratings || {}).map((rating) => Number(rating?.at) || null)
    );
  });

  const peak = series.reduce((max, row) => Math.max(max, ...row.counts), 0);
  return {
    months: keys.map(({ year, month }) => ({
      label: new Date(year, month, 1).toLocaleDateString(undefined, { month: 'short' }),
      year,
      month
    })),
    series,
    peak
  };
}

/**
 * CRITERION RADAR. Where a friend has opted into sharing their breakdown,
 * the eight axes side by side — do they mark you down on story, or are they
 * just harder about soundtracks? Returns null when nobody has opted in,
 * because an empty radar is worse than no radar.
 */
export function criterionRadar (overlaps, criteria) {
  const axes = criteria || [];
  if (!axes.length) return null;

  const rows = (overlaps || []).map((friend) => {
    const totals = axes.map(() => ({ mine: 0, theirs: 0, count: 0 }));
    let usable = 0;

    friend.shared.forEach((film) => {
      const theirs = film.theirCriteria;
      const mine = film.myCriteria;
      if (!Array.isArray(theirs) || !Array.isArray(mine)) return;
      usable += 1;
      axes.forEach((unused, axis) => {
        if (!Number.isFinite(theirs[axis]) || !Number.isFinite(mine[axis])) return;
        totals[axis].mine += mine[axis];
        totals[axis].theirs += theirs[axis];
        totals[axis].count += 1;
      });
    });

    if (!usable) return null;
    return {
      key: friend.key,
      name: friend.name,
      films: usable,
      axes: axes.map((label, axis) => ({
        label,
        mine: totals[axis].count ? round2(totals[axis].mine / totals[axis].count) : null,
        theirs: totals[axis].count ? round2(totals[axis].theirs / totals[axis].count) : null
      }))
    };
  }).filter(Boolean);

  return rows.length ? rows : null;
}

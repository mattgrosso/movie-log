// Social layer — pure logic (design session 2026-08-15). Cinema Roll users
// only; the Brian-app translation layer will publish INTO this same shape
// later. Everything privacy-relevant is opt-in by construction: nothing
// exists under social/ until a user's own app publishes it, and profiles
// are readable only when BOTH friend edges exist (enforced in the database
// rules, not app etiquette).
//
// Published profile shape (social/profiles/<userKey>):
//   { name, updatedAt, counts: {titles, viewings},
//     topShelf: [{id,t,p,r} x10], crown: {t,p,r,year}|null,
//     recent: [{id,t,p,r,at} x40],
//     ratings: { [tmdbId]: {r, at, t, p, c?} } }
// `c` is the eight-criterion breakdown as a fixed-order array (see CRITERIA)
// and is published ONLY behind its own opt-in (shareCriteria) — the default
// profile carries composite scores only.

import { logScore } from './logScore.js';

// Fixed publishing order for the compact criteria array. Index-coupled with
// anything reading `c` — append, never reorder.
export const CRITERIA = ['love', 'overall', 'stickiness', 'story', 'direction', 'imagery', 'performance', 'soundtrack'];

// Missing criteria become -1, never null — Firebase silently drops null
// array slots and returns a SPARSE array, which would shift every index in
// a fixed-order array. Readers must treat negatives as absent.
// Where and when, per viewing — Matt, 2026-08-16: club friends could see
// WHAT you rated but not that you saw it in a theatre in 2019 and on
// Blu-ray in 2024. Compact keys: at (timestamp), m (medium).
function viewingsFrom (entry) {
  return (entry?.ratings || [])
    .map((rating) => ({
      at: new Date(rating?.date ?? NaN).getTime(),
      m: rating?.medium || null
    }))
    .filter((viewing) => Number.isFinite(viewing.at))
    .sort((a, b) => b.at - a.at)
    .map((viewing) => (viewing.m ? { at: viewing.at, m: viewing.m } : { at: viewing.at }));
}

export function criteriaArrayFrom (rating) {
  if (!rating) return null;
  const values = CRITERIA.map((key) => {
    let raw = rating[key];
    // Same legacy fallback GetRating.js applies: old entries stored
    // stickiness as `impression`, sometimes on a >5 scale.
    if (key === 'stickiness' && (!raw || raw > 5) && raw !== 0) raw = rating.impression;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : -1;
  });
  return values.some((v) => v >= 0) ? values : null;
}

// ---------------------------------------------------------------------------
// Sharing defaults (Matt, 2026-08-15): ON by default, no settings trip
// required — the friendship handshake is the real consent gate, and the
// database rules make an unfriended profile unreadable regardless. The
// settings card is the opt-OUT. Only an explicit `false` turns a tier off.
//
// `realName` is what the sign-in provider calls the account holder. Bug
// report, 2026-08-20: "It would be nice if we could use someone's real name
// when we mention them in film club." Nobody had ever typed a display name,
// so every mention fell through to the email's local part — "mattgrosso"
// rather than "Matt Grosso". The real name now sits between the two: an
// explicitly-typed display name still wins, and the email is still there for
// a provider that returns no name at all.
export function socialSettingsWithDefaults (raw, userEmail, realName) {
  const social = raw || {};
  const emailName = (userEmail || '').split('@')[0];
  return {
    enabled: social.enabled !== false,
    shareRatings: social.shareRatings !== false,
    shareCriteria: social.shareCriteria !== false,
    displayName: social.displayName || (realName || '').trim() || emailName || 'A Cinema Roll user'
  };
}

// ---------------------------------------------------------------------------
// Publishing: shape a profile from the user's own library, respecting the
// share toggles. Compact keys (t/p/r/at) keep ~1,400 ratings around 100KB.
export function buildSocialProfile (entries, getRatingFn, { name, shareRatings = false, shareCriteria = false, now = Date.now() } = {}) {
  const rated = [];
  let viewings = 0;

  (entries || []).forEach((entry) => {
    const rating = getRatingFn(entry)?.calculatedTotal;
    const id = entry?.movie?.id;
    if (!Number.isFinite(rating) || id == null) return;
    const times = (entry.ratings || [])
      .map((r) => new Date(r?.date ?? NaN).getTime())
      .filter(Number.isFinite);
    viewings += Math.max(1, entry.ratings?.length || 0);
    const mostRecent = [...(entry.ratings || [])].sort((a, b) =>
      (new Date(b?.date ?? 0).getTime() || 0) - (new Date(a?.date ?? 0).getTime() || 0)
    )[0];
    rated.push({
      id,
      t: entry.movie.title || '',
      p: entry.movie.poster_path || null,
      r: Math.round(rating * 100) / 100,
      at: times.length ? Math.max(...times) : null,
      c: shareCriteria ? criteriaArrayFrom(mostRecent) : null,
      v: viewingsFrom(entry),
      releaseYear: new Date(entry.movie.release_date ?? NaN).getFullYear() || null
    });
  });

  const byRating = [...rated].sort((a, b) => b.r - a.r);
  const byRecency = [...rated].filter((m) => m.at).sort((a, b) => b.at - a.at);

  // The Crown's current holder: walking release years oldest-first, the
  // final all-time high (same rule as Deep Stats).
  let crown = null;
  let high = -Infinity;
  [...rated].filter((m) => m.releaseYear).sort((a, b) => a.releaseYear - b.releaseYear).forEach((m) => {
    if (m.r > high) {
      high = m.r;
      crown = { t: m.t, p: m.p, r: m.r, year: m.releaseYear };
    }
  });

  const profile = {
    name: name || 'A Cinema Roll user',
    updatedAt: now,
    counts: { titles: rated.length, viewings },
    topShelf: byRating.slice(0, 10).map(({ id, t, p, r }) => ({ id, t, p, r })),
    // 40, not 20: "the recent feed on my film club could be larger"
    // (2026-08-17). Each item is a handful of fields, so the profile stays a
    // few KB. Friends only get the longer feed once they republish.
    recent: byRecency.slice(0, 40).map(({ id, t, p, r, at, v }) => ({
      id, t, p, r, at, ...(v?.[0]?.m ? { m: v[0].m } : {})
    })),
    crown
  };

  if (shareRatings) {
    const ratings = {};
    rated.forEach(({ id, t, p, r, at, c, v }) => {
      ratings[id] = { r, at, t, p };
      if (shareCriteria && c) ratings[id].c = c;
      if (v?.length) ratings[id].v = v;   // where and when, per viewing
    });
    profile.ratings = ratings;
  }

  return profile;
}

// ---------------------------------------------------------------------------
// Per-friend comparison: my entries vs their PUBLISHED ratings map.
export function compareWithFriend (myEntries, getRatingFn, friendProfile, { globalAvg = null, weights = {} } = {}) {
  const theirs = friendProfile?.ratings || {};
  const mine = new Map();
  (myEntries || []).forEach((entry) => {
    const rating = getRatingFn(entry)?.calculatedTotal;
    const id = entry?.movie?.id;
    if (Number.isFinite(rating) && id != null) mine.set(id, { entry, rating });
  });

  const shared = [];
  Object.entries(theirs).forEach(([id, their]) => {
    const my = mine.get(Number(id));
    if (my && Number.isFinite(their?.r)) {
      const mostRecent = [...(my.entry.ratings || [])].sort((a, b) =>
        (new Date(b?.date ?? 0).getTime() || 0) - (new Date(a?.date ?? 0).getTime() || 0)
      )[0];
      shared.push({
        entry: my.entry,
        mine: my.rating,
        theirs: their.r,
        gap: my.rating - their.r,
        myCriteria: criteriaArrayFrom(mostRecent),
        theirCriteria: Array.isArray(their.c) ? their.c : null,
        myViewings: viewingsFrom(my.entry),
        theirViewings: Array.isArray(their.v) ? their.v : []
      });
    }
  });

  if (!shared.length) {
    return { sharedCount: 0, theyLoveUnseen: pickUnseenLoves(theirs, mine), criterionGaps: null };
  }

  const myScores = shared.map((s) => s.mine);
  const theirScores = shared.map((s) => s.theirs);
  const avgGap = shared.reduce((sum, s) => sum + Math.abs(s.gap), 0) / shared.length;

  return {
    sharedCount: shared.length,
    myAverage: round2(myScores.reduce((a, b) => a + b, 0) / shared.length),
    theirAverage: round2(theirScores.reduce((a, b) => a + b, 0) / shared.length),
    myLogScore: Number.isFinite(globalAvg) ? logScore(myScores, globalAvg, weights) : null,
    theirLogScore: Number.isFinite(globalAvg) ? logScore(theirScores, globalAvg, weights) : null,
    averageGap: round2(avgGap),
    // Honest, explainable alignment: 10 - average absolute disagreement.
    alignment: round2(Math.max(0, 10 - avgGap)),
    biggestDisagreements: [...shared].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 12),
    sharedLoves: [...shared].filter((s) => s.mine >= 8 && s.theirs >= 8).sort((a, b) => (b.mine + b.theirs) - (a.mine + a.theirs)).slice(0, 12),
    theyLoveUnseen: pickUnseenLoves(theirs, mine),
    // Per-criterion tendencies across the overlap — only meaningful when the
    // friend opted into sharing their breakdown (theirCriteria present).
    criterionGaps: criterionGapsAcross(shared)
  };
}

// For each of the eight criteria: mean(mine - theirs) over every shared movie
// where BOTH sides have that criterion. null when no movie qualifies at all.
function criterionGapsAcross (shared) {
  const withBoth = shared.filter((s) => s.myCriteria && s.theirCriteria);
  if (!withBoth.length) return null;
  const gaps = CRITERIA.map((key, i) => {
    const pairs = withBoth
      .map((s) => [s.myCriteria[i], s.theirCriteria[i]])
      .filter(([a, b]) => Number.isFinite(a) && a >= 0 && Number.isFinite(b) && b >= 0);
    if (!pairs.length) return null;
    return {
      criterion: key,
      gap: round2(pairs.reduce((sum, [a, b]) => sum + (a - b), 0) / pairs.length),
      count: pairs.length
    };
  }).filter(Boolean);
  return gaps.length ? gaps.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)) : null;
}

/**
 * What the club made of ONE film — `[{ name, rating }]`, best first.
 *
 * The counterpart to friendsLoveUnseen, which asks the same question across
 * the whole library. This is for MoviePreview: when you are deciding whether
 * to bother with a film nobody has rated for you, the people you actually
 * know having seen it is the most pertinent fact the app holds, and it costs
 * no request — the profiles are already in memory.
 *
 * Unrated-by-them is absent, not zero: a friend on the shelf-only sharing
 * tier publishes no `ratings` map at all and simply contributes nothing.
 */
export function friendRatingsFor (friendProfiles, tmdbId) {
  if (tmdbId == null) return [];
  const key = String(tmdbId);

  return Object.values(friendProfiles || {})
    .map((profile) => {
      const rating = profile?.ratings?.[key];
      if (!Number.isFinite(rating?.r)) return null;
      return { name: profile.name || 'A friend', rating: rating.r };
    })
    .filter(Boolean)
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}

// Across the whole Film Club: movies your friends rate highly that you
// have never rated. Agreement is the point — two friends at 9 is a much
// stronger recommendation than one, so consensus sorts above raw score.
// Requires friends who share their movie-by-movie scores; friends on the
// shelf-only tier simply contribute nothing here.
export function friendsLoveUnseen (myEntries, getRatingFn, friendProfiles, { minRating = 8, cap = 20 } = {}) {
  const mine = new Set();
  (myEntries || []).forEach((entry) => {
    const id = entry?.movie?.id;
    if (id != null && Number.isFinite(getRatingFn(entry)?.calculatedTotal)) mine.add(String(id));
  });

  const byMovie = new Map();
  Object.values(friendProfiles || {}).forEach((profile) => {
    if (!profile?.ratings) return;
    Object.entries(profile.ratings).forEach(([tmdbId, rating]) => {
      if (mine.has(String(tmdbId))) return;
      if (!Number.isFinite(rating?.r) || rating.r < minRating) return;
      const existing = byMovie.get(String(tmdbId)) || {
        id: Number(tmdbId),
        title: rating.t || '',
        poster_path: rating.p || null,
        fans: []
      };
      existing.fans.push({ name: profile.name || 'A friend', rating: rating.r });
      byMovie.set(String(tmdbId), existing);
    });
  });

  return [...byMovie.values()]
    .map((movie) => ({
      ...movie,
      fans: [...movie.fans].sort((a, b) => b.rating - a.rating),
      fanCount: movie.fans.length,
      average: Math.round((movie.fans.reduce((sum, fan) => sum + fan.rating, 0) / movie.fans.length) * 100) / 100
    }))
    .sort((a, b) => (b.fanCount - a.fanCount) || (b.average - a.average) || a.title.localeCompare(b.title))
    .slice(0, cap);
}

function pickUnseenLoves (theirRatings, mineMap, { minRating = 8, cap = 12 } = {}) {
  return Object.entries(theirRatings || {})
    .filter(([id, their]) => !mineMap.has(Number(id)) && Number.isFinite(their?.r) && their.r >= minRating)
    .map(([id, their]) => ({ id: Number(id), t: their.t, p: their.p, r: their.r }))
    .sort((a, b) => b.r - a.r)
    .slice(0, cap);
}

function round2 (n) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// The rainbow badge: how many friend ratings have landed since the user
// last opened the Film Club. Counts items in each friend's published
// `recent` feed newer than lastSeen.
export function countNewFriendUpdates (friendProfiles, lastSeen) {
  const since = Number(lastSeen) || 0;
  return Object.values(friendProfiles || {}).reduce((count, profile) => {
    const fresh = (profile?.recent || []).filter((item) => Number(item?.at) > since);
    return count + fresh.length;
  }, 0);
}

// ---------------------------------------------------------------------------
// The Film Club summary: every friend's profile combined.
export function filmClubSummary (myEntries, getRatingFn, friendProfiles) {
  const profiles = Object.entries(friendProfiles || {}).filter(([, p]) => p);
  if (!profiles.length) return null;

  // Merged recent-activity feed, newest first.
  const feed = profiles.flatMap(([key, profile]) =>
    (profile.recent || []).map((item) => ({ ...item, friendKey: key, friendName: profile.name }))
  ).filter((item) => item.at).sort((a, b) => b.at - a.at).slice(0, 60);

  // Club favorites: movies rated by 2+ people (me included), by average.
  const mine = new Map();
  (myEntries || []).forEach((entry) => {
    const rating = getRatingFn(entry)?.calculatedTotal;
    const id = entry?.movie?.id;
    if (Number.isFinite(rating) && id != null) {
      mine.set(id, { id, t: entry.movie.title, p: entry.movie.poster_path, scores: [{ who: 'You', r: rating }] });
    }
  });
  const pool = new Map(mine);
  profiles.forEach(([, profile]) => {
    Object.entries(profile.ratings || {}).forEach(([id, their]) => {
      if (!Number.isFinite(their?.r)) return;
      const key = Number(id);
      const existing = pool.get(key) || { id: key, t: their.t, p: their.p, scores: [] };
      existing.scores.push({ who: profile.name, r: their.r });
      pool.set(key, existing);
    });
  });

  const multi = [...pool.values()].filter((movie) => movie.scores.length >= 2)
    .map((movie) => ({
      ...movie,
      average: round2(movie.scores.reduce((sum, s) => sum + s.r, 0) / movie.scores.length),
      spread: round2(Math.max(...movie.scores.map((s) => s.r)) - Math.min(...movie.scores.map((s) => s.r)))
    }));

  return {
    friendCount: profiles.length,
    feed,
    clubFavorites: [...multi].sort((a, b) => (b.average - a.average) || (b.scores.length - a.scores.length)).slice(0, 12),
    biggestDivides: [...multi].filter((m) => m.spread >= 2).sort((a, b) => b.spread - a.spread).slice(0, 12)
  };
}

// ---------------------------------------------------------------------------
// A friend row on the Film Club screen. "The list of friends in my film club
// is a bit sparse. Can we spruce it up a bit?" (2026-08-17) — it was a name,
// a title count and a chevron.
//
// Deliberately NOT compareWithFriend: that returns twelve-item disagreement
// and shared-love lists and per-criterion gaps, all of it thrown away here.
// This walks the overlap once for the two numbers a row actually shows.
export function friendSnapshot (myRatingsById, profile, { recentCount = 4 } = {}) {
  const theirs = profile?.ratings || {};
  let shared = 0;
  let gapTotal = 0;

  Object.entries(theirs).forEach(([id, their]) => {
    const mine = myRatingsById?.get(Number(id));
    if (!Number.isFinite(mine) || !Number.isFinite(their?.r)) return;
    shared += 1;
    gapTotal += Math.abs(mine - their.r);
  });

  const recent = (profile?.recent || []).filter((item) => item?.at)
    .sort((a, b) => b.at - a.at);

  return {
    titles: profile?.counts?.titles ?? null,
    viewings: profile?.counts?.viewings ?? null,
    sharedCount: shared,
    // Same definition the comparison page uses, so a row and the page it
    // opens can't disagree: 10 minus the average absolute disagreement.
    alignment: shared ? round2(Math.max(0, 10 - gapTotal / shared)) : null,
    lastWatchedAt: recent[0]?.at ?? null,
    recent: recent.slice(0, recentCount)
  };
}

/** Ratings keyed by TMDB id, built once and shared across every friend row. */
export function myRatingsById (myEntries, getRatingFn) {
  const map = new Map();
  (myEntries || []).forEach((entry) => {
    const rating = getRatingFn(entry)?.calculatedTotal;
    const id = entry?.movie?.id;
    if (Number.isFinite(rating) && id != null) map.set(id, rating);
  });
  return map;
}

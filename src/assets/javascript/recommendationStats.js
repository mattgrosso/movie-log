// Does the watchlist actually work? (Matt, 2026-08-16.)
//
// Punts already teach the app what he DOESN'T want. The positive signal was
// being thrown away: when a suggested movie shows up in the library later,
// whichever section suggested it was right. This records which source
// suggested what, credits the source when the movie gets rated, and turns
// that history into an ordering so the sections that actually earn watches
// rise to the top.
//
// Stored under settings/watchlistLearning:
//   { pending: { <tmdbId>: { source, at } },
//     sources: { <sourceKey>: { suggested, hits } } }
//
// Deliberately cheap: one small settings node, no per-render writes beyond
// genuinely new suggestions.

const DAY_MS = 1000 * 60 * 60 * 24;

// A suggestion that never becomes a watch shouldn't count against a source
// forever — after this it's simply forgotten, neither hit nor miss.
export const PENDING_EXPIRY_DAYS = 120;

// How many suggestions a source must produce before its own record
// outweighs the neutral prior. Same Bayesian instinct as the Log Score:
// 1-for-1 shouldn't beat 12-for-30.
export const CONFIDENCE = 8;

export function pendingUpdates (existingPending, shownBySource, now = Date.now()) {
  const pending = existingPending || {};
  const updates = {};
  Object.entries(shownBySource || {}).forEach(([source, ids]) => {
    (ids || []).forEach((tmdbId) => {
      const key = String(tmdbId);
      // First source to offer it keeps the credit — including within a
      // single render, where two sections can surface the same movie.
      if (pending[key] || updates[key]) return;
      updates[key] = { source, at: now };
    });
  });
  return updates;
}

// Anything now in the library is a hit for whichever source suggested it;
// anything too old is dropped. Returns the writes to apply.
export function reconcilePending (existingPending, ratedTmdbIds, now = Date.now(), { expiryDays = PENDING_EXPIRY_DAYS } = {}) {
  const rated = new Set((ratedTmdbIds || []).map((id) => String(id)));
  const hits = {};
  const resolved = [];
  const expired = [];

  Object.entries(existingPending || {}).forEach(([tmdbId, record]) => {
    if (!record?.source) { expired.push(tmdbId); return; }
    if (rated.has(String(tmdbId))) {
      hits[record.source] = (hits[record.source] || 0) + 1;
      resolved.push(tmdbId);
      return;
    }
    const age = (now - (Number(record.at) || 0)) / DAY_MS;
    if (age > expiryDays) expired.push(tmdbId);
  });

  return { hits, resolved, expired };
}

// Hit rate pulled toward the average of all sources, so a source with two
// suggestions can't leapfrog one with a real record.
export function sourceScore (stat, globalRate, { confidence = CONFIDENCE } = {}) {
  const suggested = Number(stat?.suggested) || 0;
  const hits = Number(stat?.hits) || 0;
  const base = Number.isFinite(globalRate) ? globalRate : 0;
  if (!suggested) return base;
  const observed = hits / suggested;
  return (observed * suggested + base * confidence) / (suggested + confidence);
}

export function globalHitRate (sources) {
  const totals = Object.values(sources || {}).reduce(
    (acc, stat) => ({
      suggested: acc.suggested + (Number(stat?.suggested) || 0),
      hits: acc.hits + (Number(stat?.hits) || 0)
    }),
    { suggested: 0, hits: 0 }
  );
  return totals.suggested ? totals.hits / totals.suggested : 0;
}

// Order sections best-performing first, keeping any source with no history
// at the neutral prior so a brand-new section still gets a fair showing.
export function rankSections (sections, sources) {
  const globalRate = globalHitRate(sources);
  return [...(sections || [])]
    .map((section, index) => ({
      section,
      index,
      score: sourceScore((sources || {})[section.key], globalRate)
    }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map((row) => row.section);
}

// Human-readable record for the UI: "3 of 11 watched".
export function sourceSummary (stat) {
  const suggested = Number(stat?.suggested) || 0;
  const hits = Number(stat?.hits) || 0;
  if (!suggested) return null;
  return { suggested, hits, rate: Math.round((hits / suggested) * 100) };
}

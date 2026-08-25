// Who in your film club has seen the film you're looking at.
//
// Bug report, 2026-08-25: "It would be cool if I could see which of my friends
// had seen a movie on its detail page."
//
// The data is already published — a profile's `ratings` map is keyed by TMDB
// id (see social.js), so this is a lookup, not a fetch. Home loads friend
// profiles on mount and the detail page is reached through Home, so by the
// time anyone reads this the answer is in memory.
//
// THE THING THIS MODULE EXISTS TO GET RIGHT: there are three answers, not two.
// A friend can have seen it, not seen it, or be someone we simply cannot say
// about. That last group is real and easy to lose: sharing ratings is its own
// opt-in tier, and a "shelf only" sharer publishes topShelf and recent with no
// `ratings` map at all (clubVenn.js skips those profiles for the same reason).
// A friend who hasn't accepted yet, or hasn't published, lands here too.
//
// Folding unknown into "hasn't seen it" would have the app assert something
// nobody said — telling you Sarah missed a film she may well have loved, on
// the strength of a privacy setting. So they stay separate all the way to the
// screen, and the screen names them differently.

/** A friend's answer for one film. */
export const SEEN = 'seen';
export const NOT_SEEN = 'notSeen';
export const UNKNOWN = 'unknown';

/**
 * Does this profile tell us anything about what its owner has watched?
 *
 * An empty object is still an answer — someone who shares ratings and has
 * rated nothing genuinely hasn't seen this film. Only a MISSING map is
 * unknowable.
 */
export const sharesRatings = (profile) => Boolean(profile) && typeof profile.ratings === 'object' && profile.ratings !== null;

/**
 * One friend's relationship to one film.
 *
 * `tmdbId` is compared as a string: published maps are Firebase objects, so
 * their keys are always strings, while a movie's id arrives as a number.
 */
export function friendViewing (friend, tmdbId) {
  const id = tmdbId == null ? null : String(tmdbId);
  const base = {
    key: friend?.key ?? null,
    name: friend?.name || 'A friend',
    external: Boolean(friend?.external)
  };

  if (!id || !sharesRatings(friend?.profile)) return { ...base, status: UNKNOWN };

  const rating = friend.profile.ratings[id];
  if (!rating || !Number.isFinite(rating.r)) return { ...base, status: NOT_SEEN };

  // `v` is the per-viewing detail (when, and on what) and is its own opt-in
  // again, so treat it as a bonus rather than something to rely on.
  const viewings = Array.isArray(rating.v) ? rating.v : [];
  const mostRecent = viewings
    .filter((viewing) => Number.isFinite(viewing?.at))
    .sort((a, b) => b.at - a.at)[0] || null;

  return {
    ...base,
    status: SEEN,
    score: rating.r,
    // The map's `at` is the published watch time; fall back to the viewing
    // list when it's absent, since older profiles carry one and not the other.
    at: Number.isFinite(rating.at) ? rating.at : (mostRecent?.at ?? null),
    medium: mostRecent?.m || null,
    viewingCount: viewings.length
  };
}

// Highest score first — the interesting question on a detail page is who
// loved it, not who is alphabetically first. Ties fall back to name so the
// order is stable between renders rather than depending on object order.
const byScoreThenName = (a, b) => (b.score - a.score) || a.name.localeCompare(b.name);
const byName = (a, b) => a.name.localeCompare(b.name);

/**
 * The whole club, split three ways.
 *
 * Returns `{ seen, notSeen, unknown }`, each an array of the shape above.
 */
export function friendViewingsFor (friends, tmdbId) {
  const all = (friends || []).map((friend) => friendViewing(friend, tmdbId));
  return {
    seen: all.filter((f) => f.status === SEEN).sort(byScoreThenName),
    notSeen: all.filter((f) => f.status === NOT_SEEN).sort(byName),
    unknown: all.filter((f) => f.status === UNKNOWN).sort(byName)
  };
}

/**
 * How the club's scores compare with yours, when enough of them exist.
 *
 * `null` when nobody has seen it — an average of nothing is not zero, and a
 * screen showing "0.00" for an unwatched film would be worse than showing
 * nothing at all.
 */
export function clubAverage (seen) {
  const scores = (seen || []).map((f) => f.score).filter(Number.isFinite);
  if (!scores.length) return null;
  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

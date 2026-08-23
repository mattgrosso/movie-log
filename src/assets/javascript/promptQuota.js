// How often the home screen is allowed to ask you for something.
//
// Bug report (2026-08-22): "How often can I be prompted for doing my personal
// awards? Is it just once a day? ... maybe that's a setting we ought to be
// able to do kind of like we do for tiebreakers. Maybe we ought to go ahead
// and set that for stickiness and personal awards."
//
// Tiebreaks already had one (`settings/tieBreakTweak`, spaced by
// `oneDay / maxDailyTieBreaks` since a 2026 fix), awards were hardwired to
// one completed year per calendar day, and stickiness had no limit at all.
// Three different answers to one question, only one of which the user could
// change. This module is the single answer; Home reads all three prompts
// through it.
//
// Spacing, not a counter: "three a day" means "no sooner than eight hours
// after the last one", which is what stops a burst of prompts in one sitting.
// That is the shape the tiebreak setting already had, and Matt asked for the
// other two to work "kind of like we do for tiebreakers".

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Read a per-day allowance out of settings.
 *
 * `null` means NO LIMIT and is a real, distinct answer — not a missing value.
 * A blank input has to mean something, and for stickiness it has to mean
 * "as often as there is something to rate", because that is how stickiness
 * has always behaved and a silent new cap would be a regression dressed up
 * as a feature. `fallback` is what an unset setting means for THIS prompt.
 */
export function promptsPerDay (value, fallback = null) {
  if (value === '' || value == null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, number);
}

/**
 * Is enough time since `lastAt` for another prompt?
 *
 *   perDay === null → always (no limit)
 *   perDay <= 0     → never (the user turned this prompt off)
 *   otherwise       → once every ONE_DAY_MS / perDay
 *
 * A missing `lastAt` reads as "never prompted", which is due. Note the
 * tiebreak path deliberately defaulted `lastTweak` to `Date.now()` instead —
 * that made a brand-new account wait a day for its first tiebreak. Nothing
 * relies on that, and being asked once on day one is the friendlier read of
 * a setting that says "one a day".
 */
export function dueForPrompt ({ lastAt, perDay, now = Date.now() } = {}) {
  if (perDay === null || perDay === undefined) return true;
  if (!(perDay > 0)) return false;

  const last = Number(lastAt);
  if (!Number.isFinite(last) || last <= 0) return true;

  return now - last > ONE_DAY_MS / perDay;
}

/**
 * When the awards prompt was last satisfied.
 *
 * Awards used to record only `settings/lastAwardCompletionDate`, a
 * `toDateString()` value, and the gate was the string equality
 * `lastAwardDate === today`. Every existing account carries that and nothing
 * else, so rather than migrate, read it as a timestamp: a completion stamped
 * "today" is treated as having happened at the start of today, which is the
 * most recent moment it could be blamed on. At the old fixed one-per-day that
 * reproduces the old behaviour exactly; at a higher allowance it lets the
 * day's second prompt through once the interval has passed.
 */
export function lastAwardsPromptAt (settings, now = Date.now()) {
  const stamped = Number(settings?.lastAwardsPromptAt);
  if (Number.isFinite(stamped) && stamped > 0) return stamped;

  const legacyDate = settings?.lastAwardCompletionDate;
  if (!legacyDate) return null;

  const parsed = new Date(legacyDate);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return null;

  // toDateString() parses back to midnight local, which is what we want.
  // Guard against a future-dated value (clock changes, imported data).
  return Math.min(time, now);
}

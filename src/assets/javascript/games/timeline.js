import { movieYear, entryKey } from './gameUtils.js';

// Pure, store-free rules for the Timeline game — modeled on the board game
// of the same name: build a chronological sequence one card at a time,
// guessing where each new (year-hidden) card belongs relative to the ones
// already placed. See CLAUDE.md for the full design writeup.
//
// `timeline` is always kept in ascending-year order by the component (a
// correct placement is inserted exactly where it was guessed, which by
// definition keeps it sorted) — these functions assume that invariant
// rather than re-sorting, so callers must not hand them an unsorted array.

// Ties count as valid on either side of the boundary — the player only ever
// sees a YEAR (not an exact release date), so two movies from the same year
// placed in either relative order should both read as "correct," matching
// the physical board game's own same-year tie handling.
export function isValidPlacement (timeline, slotIndex, candidateEntry) {
  const candidateYear = movieYear(candidateEntry);
  if (candidateYear == null) return false;

  const beforeYear = slotIndex > 0 ? movieYear(timeline[slotIndex - 1]) : null;
  const afterYear = slotIndex < timeline.length ? movieYear(timeline[slotIndex]) : null;

  if (beforeYear != null && candidateYear < beforeYear) return false;
  if (afterYear != null && candidateYear > afterYear) return false;
  return true;
}

export function insertAtSlot (timeline, slotIndex, candidateEntry) {
  const next = timeline.slice();
  next.splice(slotIndex, 0, candidateEntry);
  return next;
}

// Used only on a wrong guess, to show the player where the card actually
// belonged instead of just "wrong." Returns the first slot (of possibly
// several, when a tie year makes more than one boundary valid) that would
// have been accepted.
export function correctSlotIndex (timeline, candidateEntry) {
  for (let i = 0; i <= timeline.length; i++) {
    if (isValidPlacement(timeline, i, candidateEntry)) return i;
  }
  return null;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Reads the calendar components straight out of the "YYYY-MM-DD" string
// rather than through `new Date(...)`, which parses as UTC midnight and can
// roll a day-1 date back into the PREVIOUS month/year once read back in a
// negative-UTC-offset local timezone (movieYear in gameUtils.js has this
// same latent quirk, documented there as a test-fixture pitfall — it
// matters more here, since a wrong month/day would now be directly visible
// on screen instead of just shifting a year-only value on Jan 1st).
function releaseDateParts (entry) {
  const raw = entry?.movie?.release_date;
  const match = typeof raw === 'string' && /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

// How much date precision an entry needs to display to stay unambiguous
// among its CURRENT timeline neighbors — bug report: "if you have two from
// the same year they should also include month... if two from the same
// month, also include the day." Escalates only as far as actually needed:
// a year unique among the timeline's other entries shows just the year;
// entries sharing a year escalate (BOTH of them, symmetrically, since the
// check runs per-entry against every other placed card) to month; entries
// that also share that month escalate further to day. Purely a display
// concern — isValidPlacement above still compares by year only and is
// unaffected (ties still count as valid either order, matching the
// physical board game, even once month/day are shown on screen).
export function formatTimelineDate (entry, timeline) {
  const parts = releaseDateParts(entry);
  if (!parts) return null;

  const key = entryKey(entry);
  const others = (timeline || [])
    .filter((other) => entryKey(other) !== key)
    .map(releaseDateParts)
    .filter(Boolean);

  const sameYear = others.some((other) => other.year === parts.year);
  if (!sameYear) return String(parts.year);

  const sameMonth = others.some((other) => other.year === parts.year && other.month === parts.month);
  if (!sameMonth) return `${MONTH_ABBR[parts.month - 1]} ${parts.year}`;

  return `${MONTH_ABBR[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

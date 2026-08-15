import { movieYear, entryKey } from './gameUtils.js';

// Pure, store-free rules for the Timeline game — modeled on the board game
// of the same name: build a chronological sequence one card at a time,
// guessing where each new (year-hidden) card belongs relative to the ones
// already placed. See CLAUDE.md for the full design writeup.
//
// `timeline` is always kept in ascending release-date order by the
// component (a correct placement is inserted exactly where it was guessed,
// which by definition keeps it sorted) — these functions assume that
// invariant rather than re-sorting, so callers must not hand them an
// unsorted array.

// Placement compares FULL release dates, to the precision both sides carry.
// This used to compare years only ("the player only ever sees a YEAR"), but
// formatTimelineDate below escalates the display to month/day when years
// collide — so a same-year pair placed in the wrong month order was marked
// correct while the on-screen dates plainly showed it wasn't (two separate
// bug reports: Moana placed after Rogue One, Gladiator II before Flow).
// Ties still count as valid on either side of the boundary, but only when
// the dates are equal at the precision available — matching what the
// player can actually see.
export function isValidPlacement (timeline, slotIndex, candidateEntry) {
  const candidate = comparableDate(candidateEntry);
  if (candidate == null) return false;

  const before = slotIndex > 0 ? comparableDate(timeline[slotIndex - 1]) : null;
  const after = slotIndex < timeline.length ? comparableDate(timeline[slotIndex]) : null;

  if (before != null && compareReleaseDates(candidate, before) < 0) return false;
  if (after != null && compareReleaseDates(candidate, after) > 0) return false;
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

// Full date parts where the entry carries a parseable "YYYY-MM-DD", else a
// year-only reading (some TMDB dates are bare years), else null.
function comparableDate (entry) {
  const parts = releaseDateParts(entry);
  if (parts) return parts;
  const year = movieYear(entry);
  return year == null ? null : { year, month: null, day: null };
}

// Comparator over comparableDate() values — negative/zero/positive — that
// only compares as deep as BOTH sides have precision: a year-only date ties
// with any date in that year rather than inventing an ordering.
function compareReleaseDates (a, b) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month == null || b.month == null) return 0;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day == null || b.day == null) return 0;
  return a.day - b.day;
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

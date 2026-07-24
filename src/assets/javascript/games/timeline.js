import { movieYear } from './gameUtils.js';

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

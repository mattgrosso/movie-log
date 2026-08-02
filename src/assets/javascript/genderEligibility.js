// Who may be nominated in which acting category.
//
// TMDB's `gender` field is an enum, not a boolean:
//   0 = not specified   1 = female   2 = male   3 = non-binary
// and it can also be missing entirely (a person TMDB has no record for, or
// a lookup that failed).
//
// The rule, per the user: "if you're unsure about gender go ahead and count
// them as all genders." So anything that isn't a definite female/male
// reading — missing, not-specified, or non-binary — is eligible for EVERY
// acting category rather than none. Being wrongly offered a nomination is
// harmless (the user simply doesn't pick them); being silently unnominatable
// is not, because there's no way to even notice it happened.
//
// This lives in one place because PersonalAwardsModal had two copies of the
// logic that had already drifted apart: one treated gender 0 as eligible for
// both categories, the other excluded it from both — so whether a
// "not specified" person could be nominated at all depended on which code
// path happened to load them.

export const TMDB_GENDER = {
  NOT_SPECIFIED: 0,
  FEMALE: 1,
  MALE: 2,
  NON_BINARY: 3
};

// `gender` is TMDB's raw value (or undefined/null when unknown).
// `isActress` selects the actress-side categories over the actor-side ones.
export function isEligibleForActingCategory (gender, { isActress } = {}) {
  // Number.isFinite, not `typeof === 'number'`: NaN IS a number by that
  // test, so a garbled value would have sailed past as a definite reading
  // and excluded the person from one side. Caught by its own test.
  if (!Number.isFinite(gender)) return true; // unknown → all categories
  if (gender === TMDB_GENDER.NOT_SPECIFIED || gender === TMDB_GENDER.NON_BINARY) return true;
  return isActress ? gender === TMDB_GENDER.FEMALE : gender === TMDB_GENDER.MALE;
}

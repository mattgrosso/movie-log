// Bug report (2026-08-18): "In film club when showing scores and really just
// generally speaking whenever showing a score with a decimal place anywhere in
// the app, we should always show two decimal places because that's the
// precision the app actually generates and it matters pretty often."
//
// The app's scores are weighted sums (GetRating.js), so a rating lands on
// values like 8.4372 far more often than on a round tenth. Rounding those to
// one decimal collapses genuinely different films onto the same number: 8.44
// and 8.35 both read as "8.4", which is exactly the collision Matt means by
// "it matters pretty often".
//
// Every score display goes through here so the precision is one decision in
// one place rather than thirty-odd toFixed calls that can drift apart again.
// NOT for years, days, runtimes or percentages — those aren't scores and
// aren't computed to this precision (a "1.5 years" reading as "1.50 years"
// would be worse, not better).
export const SCORE_DECIMALS = 2;

/**
 * A score as it should be displayed: always SCORE_DECIMALS places.
 *
 * `fallback` covers the unrated/unknown case, which several screens render as
 * an em dash. Anything non-numeric — null, undefined, NaN, a string that
 * doesn't parse — takes the fallback rather than printing "NaN" at people.
 */
export const formatScore = (value, fallback = '—') => {
  const numeric = typeof value === 'number' ? value : parseFloat(value);
  if (numeric == null || Number.isNaN(numeric)) return fallback;
  return numeric.toFixed(SCORE_DECIMALS);
};

/**
 * A NORMALIZED score, which is a different kind of number: `applyNormalization`
 * ends in `Math.round`, so it is always a whole 0-10. Two decimals on it were
 * always ".00" — bug report 2026-08-25: "I don't think we need to have any
 * decimals after the normalized score. Those are always gonna be full numbers."
 *
 * Rounds rather than trusting the caller, so a value that somehow arrives
 * fractional still prints as a whole number instead of exposing a half-step
 * the rest of the app doesn't believe in.
 */
export const formatNormalizedScore = (value, fallback = '—') => {
  const numeric = typeof value === 'number' ? value : parseFloat(value);
  if (numeric == null || Number.isNaN(numeric)) return fallback;
  return String(Math.round(numeric));
};

/**
 * The same, for a magnitude — a gap, spread or lean, where the sign is
 * carried by the surrounding label ("6.30 apart", "±0.45") rather than by
 * the number itself.
 */
export const formatScoreGap = (value, fallback = '—') => {
  const numeric = typeof value === 'number' ? value : parseFloat(value);
  if (numeric == null || Number.isNaN(numeric)) return fallback;
  return Math.abs(numeric).toFixed(SCORE_DECIMALS);
};

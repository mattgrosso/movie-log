// Cinema Roll's ONE canonical 0–10 → star conversion, extracted so every
// consumer (the in-app star toggle, the Letterboxd deep link, the Film Club
// feed) assigns the same stars. Stars are a PRESENTATION of the normalized
// rating — the library-relative, curve-adjusted score from GetRating.js —
// never of the raw calculatedTotal, which is on a different scale.
//
// Half-star steps, because that's the granularity every star surface uses
// (Letterboxd's rating param, Movie Log's starRating). Returns null for
// anything that isn't a real star rating (missing, non-numeric, below half
// a star) so callers omit the value instead of inventing a zero.
export function normalizedRatingToStars (normalizedRating) {
  const stars = parseFloat(normalizedRating) / 2;
  if (!isFinite(stars) || stars < 0.5) return null;
  const clamped = Math.min(5, stars);
  // Snap to the nearest valid 0.5 increment.
  return Math.round(clamped * 2) / 2;
}

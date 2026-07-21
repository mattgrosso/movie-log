// Turns a rating object (as returned by GetRating.js's getRating/mostRecentRating
// — direction/imagery/story/performance/soundtrack/stickiness/love/overall,
// each on its OWN scale) into values on a common 0–10 scale, suitable for
// plotting on a radar chart where every axis needs to mean "10 = maxed out."
// Without this, a maxed-out love score (5) or stickiness score (5) would
// visually read as "half" compared to a maxed-out direction score (10),
// even though both are actually the highest rating possible on their scale.
export const RADAR_DIMENSIONS = [
  { key: 'direction', label: 'Direction' },
  { key: 'imagery', label: 'Imagery' },
  { key: 'story', label: 'Story' },
  { key: 'performance', label: 'Performance' },
  { key: 'soundtrack', label: 'Soundtrack' },
  { key: 'stickiness', label: 'Stickiness' },
  { key: 'love', label: 'Love' },
  { key: 'overall', label: 'Overall' }
];

export const RADAR_LABELS = RADAR_DIMENSIONS.map((d) => d.label);

export function normalizedRadarValues (rating) {
  if (!rating) return RADAR_DIMENSIONS.map(() => 0);

  return RADAR_DIMENSIONS.map(({ key }) => {
    const raw = parseFloat(rating[key]);
    if (Number.isNaN(raw)) return 0;

    if (key === 'love') return raw + 5; // -5..5 -> 0..10
    // 0..5 -> 0..10. Matches the ratings-table fallback elsewhere in
    // MovieDetail.vue: a falsy/zero stickiness is treated as 1, not 0.
    if (key === 'stickiness') return (raw || 1) * 2;
    return raw; // direction/imagery/story/performance/soundtrack/overall are already 0..10
  });
}

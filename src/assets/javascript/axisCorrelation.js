// Turns the Insights scatter plot from a picture into a sentence.
//
// Matt likes the XY plot and wanted to keep it ("I really like my XY plot
// graph... but maybe you could take a look at that and see if there's
// something else you think we could do with it"). A cloud of 1,300 dots is
// genuinely hard to read, so rather than replace it, this says out loud what
// the eye is trying to work out: do these two things move together?

const STRENGTHS = [
  { floor: 0.8, label: 'almost lockstep' },
  { floor: 0.6, label: 'closely' },
  { floor: 0.4, label: 'noticeably' },
  { floor: 0.2, label: 'a little' }
];

/**
 * Pearson correlation over `[{x, y}]`. Null when it can't mean anything:
 * fewer than 3 points, or an axis where every value is identical (a flat
 * axis has no variance to correlate against, and the formula divides by it).
 */
export function correlation (points) {
  const usable = (points || []).filter(
    (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)
  );
  if (usable.length < 3) return null;

  const count = usable.length;
  const meanX = usable.reduce((sum, p) => sum + p.x, 0) / count;
  const meanY = usable.reduce((sum, p) => sum + p.y, 0) / count;

  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;

  usable.forEach((point) => {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  });

  if (varianceX === 0 || varianceY === 0) return null;

  const r = covariance / Math.sqrt(varianceX * varianceY);
  // Floating-point drift can push a perfect correlation just past 1.
  return Math.max(-1, Math.min(1, r));
}

/**
 * A plain-English reading of `r` for these two axes. Returns null when there
 * is nothing worth saying, so the caller can render nothing at all rather
 * than a hedge.
 */
export function describeCorrelation (r, xLabel, yLabel) {
  if (r == null || !xLabel || !yLabel) return null;

  const magnitude = Math.abs(r);
  if (magnitude < 0.2) {
    return `${xLabel} and ${yLabel} move independently — one tells you nothing about the other.`;
  }

  const strength = STRENGTHS.find((entry) => magnitude >= entry.floor)?.label ?? 'a little';

  return r > 0
    ? `${xLabel} and ${yLabel} rise together ${strength}.`
    : `${xLabel} and ${yLabel} pull against each other ${strength} — more of one goes with less of the other.`;
}

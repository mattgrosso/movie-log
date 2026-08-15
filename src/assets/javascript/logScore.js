// The Log Score — adopted from Brian's Movie Log (2026-08-15), to be used
// wherever the app scores a GROUP of rated movies (genres, years, lists,
// people). A personalized, weighted Bayesian average: favorites are
// rewarded through declining rank weights, and small groups are pulled
// toward the user's whole-library average so two lucky movies can't crown
// a genre.
//
//   rank weight at sorted position i (0-based):  R / (R + i)
//   weighted average = sum(score_i * w_i) / sum(w_i)
//   Log Score = globalAvg * B/(B+n)  +  weightedAvg * n/(B+n)
//
// Defaults R=7, B=7 (billing W=7 for actors) — Brian's Score Lab settings;
// all three are overridable so a future Score Lab of our own is just UI.
//
// Cinema Roll mapping: group scores are calculatedTotal (already 0-10,
// most recent rating only). People take the relevant CRITERION from each
// movie's most recent rating: actors=performance, directors=direction,
// writers=story, cinematographers=imagery, composers=soundtrack. Actor
// billing reduces the CONFIDENCE a credit provides (its share of n),
// never the rating itself.

export const LOG_SCORE_DEFAULTS = { rankWeight: 7, bayesianWeight: 7, billingWeight: 7 };

export function logScoreSettings (settings) {
  const stored = settings?.logScoreWeights || {};
  const pick = (key) => {
    const value = Number(stored[key]);
    return Number.isFinite(value) && value > 0 ? value : LOG_SCORE_DEFAULTS[key];
  };
  return { rankWeight: pick('rankWeight'), bayesianWeight: pick('bayesianWeight'), billingWeight: pick('billingWeight') };
}

// The user's whole-library average — the Bayesian anchor.
export function globalAverage (entries, getRatingFn) {
  let sum = 0;
  let count = 0;
  (entries || []).forEach((entry) => {
    const rating = getRatingFn(entry)?.calculatedTotal;
    if (Number.isFinite(rating)) {
      sum += rating;
      count += 1;
    }
  });
  return count ? sum / count : null;
}

// scores: plain numbers. effectiveN: pass to override n (actor billing);
// defaults to scores.length.
export function logScore (scores, globalAvg, { rankWeight = 7, bayesianWeight = 7, effectiveN = null } = {}) {
  const clean = (scores || []).filter(Number.isFinite);
  if (!clean.length || !Number.isFinite(globalAvg)) return null;

  const sorted = [...clean].sort((a, b) => b - a);
  let weightedSum = 0;
  let weightTotal = 0;
  sorted.forEach((score, i) => {
    const w = rankWeight / (rankWeight + i);
    weightedSum += score * w;
    weightTotal += w;
  });
  const weightedAverage = weightedSum / weightTotal;

  const n = Number.isFinite(effectiveN) ? effectiveN : sorted.length;
  const blended = globalAvg * (bayesianWeight / (bayesianWeight + n)) + weightedAverage * (n / (bayesianWeight + n));
  return Math.round(blended * 100) / 100;
}

// Actor credits: [{ score, castPosition }] (castPosition 0-based; null/
// undefined treated as lead). Billing shrinks each credit's share of n:
// W / (W + position). Returns { score, effectiveN } or null.
export function actorLogScore (credits, globalAvg, { rankWeight = 7, bayesianWeight = 7, billingWeight = 7 } = {}) {
  const clean = (credits || []).filter((c) => Number.isFinite(c?.score));
  if (!clean.length || !Number.isFinite(globalAvg)) return null;

  const effectiveN = clean.reduce((sum, credit) => {
    const position = Number.isFinite(credit.castPosition) ? credit.castPosition : 0;
    return sum + billingWeight / (billingWeight + position);
  }, 0);

  const score = logScore(clean.map((c) => c.score), globalAvg, { rankWeight, bayesianWeight, effectiveN });
  return score == null ? null : { score, effectiveN: Math.round(effectiveN * 100) / 100 };
}

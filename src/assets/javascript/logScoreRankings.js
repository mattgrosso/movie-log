// Brian's ranking method as the scorer behind every Favorite* section
// (comparison round 2026-08-15: Matt preferred it outright, so the old
// per-section scoring — known-for bonus, count bonus, criterion blends —
// was retired). Plain composite ratings, rank weighting R/(R+i)
// best-first, Bayesian pull toward the library's global average; cast
// billing shrinks CONFIDENCE (effective n), never the rating.

import { logScore, actorLogScore } from './logScore.js';

// Shared scorer for the eight Favorite* sections (Brian's-method adoption,
// Matt 2026-08-15: "use Brian's method instead of mine for all of the
// categories"). `person` is a section's gathered shape: { entries,
// billings? } — billings parallel to entries for cast sections. Crew
// (billingWeight omitted) uses the plain log score; cast routes billing
// into effective-n via actorLogScore. Returns null when nothing is rated.
export function personLogScore (person, getRatingFn, globalAvg, { rankWeight = 7, bayesianWeight = 7, billingWeight = null } = {}) {
  const entries = person?.entries || [];
  const scores = entries.map((entry) => getRatingFn(entry)?.calculatedTotal);
  if (billingWeight == null) {
    return logScore(scores.filter(Number.isFinite), globalAvg, { rankWeight, bayesianWeight });
  }
  const credits = entries.map((entry, i) => ({
    score: scores[i],
    castPosition: Number.isFinite(person?.billings?.[i]) ? person.billings[i] : 0
  })).filter((credit) => Number.isFinite(credit.score));
  return actorLogScore(credits, globalAvg, { rankWeight, bayesianWeight, billingWeight })?.score ?? null;
}

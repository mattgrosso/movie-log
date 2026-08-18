// Pure round-robin tournament state machine for resolving a group of movies
// tied on rating score. Vue-free and store-free (same pattern as
// games/bracket.js) so it's unit-testable without mounting anything, and so
// its state is plain JSON — it gets persisted directly to
// settings/tieBreakTournament in Firebase, since a tournament can span many
// days at the existing one-match-per-daily-quota-slot pace.
//
// Contestant membership is frozen at creation time (contestantIds is never
// recomputed from a fresh tie scan). That's deliberate: a movie rated later
// that happens to also match the tied score must NOT be swept into an
// already-running tournament — it waits for the next tie scan, which only
// ever runs once there is no active tournament (see TweakInline.vue).

// Finds the full contiguous run of entries sharing the same score as the
// first adjacent tie in `sortedEntries` (works regardless of best-first or
// worst-first order, since a tied group is contiguous either way).
// `getScore` extracts the comparable score from an entry.
/**
 * How many films the tiebreak prompt is actually about.
 *
 * Report -P-FN61DdMmTJ0J9XJWy (2026-08-17): "The new ties dialogue always
 * says there are two movies tied where in fact, they are often more than
 * two." The copy was a fixed "Two films"; this is the real number — the
 * frozen contestant list once a tournament exists, otherwise the tied
 * group that opening it would enter.
 */
export function tiedContestantCount (tournament, tiedGroup) {
  const frozen = tournament?.contestantIds?.length;
  if (frozen) return frozen;
  return (tiedGroup || []).length;
}

const SMALL_NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** `3` → 'Three', `14` → '14'. Keeps the prompt's written-out voice. */
export function countWord (count) {
  // Not "Zero": Number(null) is 0, and an absent count should say nothing
  // at all rather than narrate a tie between no films.
  if (count === null || count === undefined || count === '') return '';
  const number = Number(count);
  if (!Number.isFinite(number) || number < 0) return '';
  const word = SMALL_NUMBERS[number];
  if (!word) return String(number);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function findTiedGroup (sortedEntries, getScore) {
  const firstTiedIndex = sortedEntries.findIndex((entry, index) => {
    const next = sortedEntries[index + 1];
    return Boolean(next) && getScore(entry) === getScore(next);
  });

  if (firstTiedIndex === -1) return [];

  const score = getScore(sortedEntries[firstTiedIndex]);
  let start = firstTiedIndex;
  let end = firstTiedIndex + 1;

  while (start > 0 && getScore(sortedEntries[start - 1]) === score) start--;
  while (end + 1 < sortedEntries.length && getScore(sortedEntries[end + 1]) === score) end++;

  return sortedEntries.slice(start, end + 1);
}

// Every unique pair among the contestants, in stable original order (i.e.
// every one of contestant 0's matches, then every remaining one of
// contestant 1's, etc). Shuffled afterward by createRoundRobinTournament
// when an rng is supplied — kept as a separate, order-only step so a caller
// that omits rng (most of this file's own tests) still gets this exact,
// easily-asserted-on order.
function buildSchedule (contestantIds) {
  const schedule = [];
  for (let i = 0; i < contestantIds.length; i++) {
    for (let j = i + 1; j < contestantIds.length; j++) {
      schedule.push({ a: contestantIds[i], b: contestantIds[j] });
    }
  }
  return schedule;
}

// Fisher-Yates. Kept local (not imported from games/gameUtils.js) so this
// module stays fully self-contained — see its "architecturally separate
// from the Rate-Off game" framing elsewhere in the docs.
function shuffle (array, rng) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// `rng`, when supplied, randomizes match order so play doesn't run through
// every one of one contestant's matches before moving to the next (bug
// report). Defaults to `null` (schedule left in buildSchedule's stable
// order) rather than `Math.random` so existing/new callers that care about a
// deterministic order — mainly this file's own tests — don't have to fight
// randomness; TweakInline.vue's real call site passes Math.random.
export function createRoundRobinTournament (contestantIds, rng = null) {
  const wins = {};
  contestantIds.forEach((id) => { wins[id] = 0; });

  const schedule = buildSchedule(contestantIds);

  return {
    contestantIds: [...contestantIds],
    schedule: rng ? shuffle(schedule, rng) : schedule,
    nextIndex: 0,
    wins,
    startedAt: Date.now(),
    finalRanking: null,
    completedAt: null
  };
}

export function currentMatch (tournament) {
  return tournament.schedule[tournament.nextIndex] || null;
}

export function isComplete (tournament) {
  return tournament.nextIndex >= tournament.schedule.length;
}

// Ranks contestants by win count descending. Ties-within-the-tiebreak (equal
// win counts) fall back to original contestantIds order — good enough for
// "settle a group of equally-rated movies into *some* order," not a claim of
// a perfect ranking.
export function rankContestants (tournament) {
  return tournament.contestantIds
    .map((id, originalIndex) => ({ dbKey: id, wins: tournament.wins[id] || 0, originalIndex }))
    .sort((a, b) => b.wins - a.wins || a.originalIndex - b.originalIndex)
    .map(({ dbKey, wins }, index) => ({ dbKey, wins, rank: index }));
}

// Immutable — returns a NEW tournament state with the match recorded and
// nextIndex advanced. If that was the last scheduled match, also attaches
// finalRanking + completedAt.
export function recordMatchResult (tournament, winnerId) {
  const match = currentMatch(tournament);
  if (!match) return tournament;

  const wins = { ...tournament.wins, [winnerId]: (tournament.wins[winnerId] || 0) + 1 };
  const nextIndex = tournament.nextIndex + 1;
  const updated = { ...tournament, wins, nextIndex };

  if (nextIndex >= updated.schedule.length) {
    updated.finalRanking = rankContestants(updated);
    updated.completedAt = Date.now();
  }

  return updated;
}

// 1-indexed "match N of M" plus the contestant count, for a progress readout.
export function progress (tournament) {
  return {
    current: Math.min(tournament.nextIndex + 1, tournament.schedule.length),
    total: tournament.schedule.length,
    contestants: tournament.contestantIds.length
  };
}

// The score adjustment to apply once a tournament completes, generalizing
// the old one-pair-at-a-time tiebreak's flat -0.1 penalty to the loser: rank
// 0 (the top of the final standings) is untouched, each rank below loses a
// further 0.1.
/**
 * How far to nudge each contestant's `tweakValue` by finishing position.
 *
 * NOT the change to the visible score. `tweakValue` is added to `overall`,
 * which is then weighted (2) and divided by 10 — so the score moves by a
 * FIFTH of this, and `calculatedTotal` is rounded to 2dp. 0.05 is therefore
 * the smallest step that shifts the displayed score at all: exactly 0.01,
 * one slot on that grid.
 *
 * Was -0.1 (a 0.02 score step). Halved per feedback, because a tie is
 * resolved by moving losers down into whatever score sits below them, and
 * the further they travel the more they distort a rating that was genuinely
 * earned. It reduces how often a fresh tie is manufactured; it can't
 * eliminate it, since ~1,300 movies share a few hundred 0.01 slots and any
 * fixed step can land on an occupied one. Deliberately NOT hunting for a
 * free slot — ties arising from these nudges are acceptable, just rarer.
 */
export function tweakDeltaForRank (rank) {
  return -0.05 * rank;
}

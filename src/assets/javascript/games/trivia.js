import { entryKey } from './gameUtils.js';

// Pure, store-free rules for the Trivia game: Claude generates 5 real,
// hardest-to-easiest trivia facts about a random library movie
// (TriviaGame.vue fetches them via the /trivia AI lambda route — this
// module has no network code, only target selection + the score math).

export const TOTAL_FACTS = 5;

// Same "exclude whatever the previous round's target was, but fall back to
// the full pool if that would leave nothing to choose from" shape used by
// Clue Budget/Tag's own startNewRound — pulled out here as its own tested
// function specifically because two OTHER games' "keeps repeating" bug
// reports (see CLAUDE.md) both traced to this exact exclusion being
// missing or incomplete. Building it in from day one, not bolting it on
// after a report.
export function pickTriviaTarget (pool, excludeKey, rng = Math.random) {
  if (!pool || !pool.length) return null;
  const candidates = excludeKey ? pool.filter((entry) => entryKey(entry) !== excludeKey) : pool;
  const choices = candidates.length ? candidates : pool;
  return choices[Math.floor(rng() * choices.length)];
}

// Golf-style: fewer facts needed to guess correctly is a better score.
// revealedCount is always at least 1 (the first/hardest fact is shown
// immediately) and never exceeds the deck size.
export function clampRevealedCount (count, totalFacts = TOTAL_FACTS) {
  return Math.min(Math.max(count, 1), totalFacts);
}

export function isNewBestScore (factsUsed, previousBest) {
  return previousBest == null || factsUsed < previousBest;
}

import { entryKey, movieCastNames, movieYear, shuffle } from './gameUtils.js';

// Builds a bipartite movie<->cast-member graph from the library. Cast is
// capped per movie (default 10) — using the full cast for a movie with 50+
// credited actors would make almost every movie in the library "connected"
// to almost every other one in a single hop, which isn't an interesting
// puzzle. 10 keeps it to the actors actually billed prominently.
export function buildCastGraph (eligibleEntries, castLimit = 10) {
  const moviesByPerson = new Map();
  const peopleByMovie = new Map();

  eligibleEntries.forEach((entry) => {
    const key = entryKey(entry);
    const cast = movieCastNames(entry, castLimit);
    peopleByMovie.set(key, new Set(cast));

    cast.forEach((name) => {
      if (!moviesByPerson.has(name)) moviesByPerson.set(name, new Set());
      moviesByPerson.get(name).add(key);
    });
  });

  return { moviesByPerson, peopleByMovie };
}

// Breadth-first shortest path between two movies, alternating
// [movieKey, personName, movieKey, personName, ..., movieKey]. Returns null
// if unreachable within maxHops (a "hop" is one movie-person-movie step).
// Returns [] when source and target are the same movie.
export function shortestPath (graph, sourceKey, targetKey, maxHops = 6) {
  if (sourceKey === targetKey) return [];

  const queue = [[sourceKey]];
  const visited = new Set([sourceKey]);

  while (queue.length) {
    const path = queue.shift();
    const hopsSoFar = (path.length - 1) / 2;
    if (hopsSoFar >= maxHops) continue;

    const currentMovie = path[path.length - 1];
    const people = graph.peopleByMovie.get(currentMovie) || new Set();

    for (const person of people) {
      const movies = graph.moviesByPerson.get(person) || new Set();
      for (const nextMovie of movies) {
        if (visited.has(nextMovie)) continue;
        const nextPath = [...path, person, nextMovie];
        if (nextMovie === targetKey) return nextPath;
        visited.add(nextMovie);
        queue.push(nextPath);
      }
    }
  }

  return null;
}

// Per user feedback — difficulty is a WEIGHTED COMPOSITE of four signals, not
// hop count alone (the original, narrower design). In descending order of
// how much each should matter (the user's own ranking):
//   - hop count: more steps is unambiguously harder to trace/hold in mind.
//   - billing order: a connector buried deep in the credits is genuinely
//     harder to recall than a top-billed star. Directly computable - cast
//     arrays already preserve billing order.
//   - years between the two endpoint movies: "if two movies are 50 years
//     apart it's really hard to even think about them in the same thought."
//   - age of the movies: "it's safe to assume older movies will be harder"
//     (a smaller factor than the others, per the user's own framing).
// Each component is normalized to roughly 0-1 before weighting, since the
// four are on totally different natural scales (hops: ~1-6, billing index:
// ~0-9, year gap: potentially 100+, age: potentially 100+) and would
// otherwise swamp each other unpredictably. The normalization caps and tier
// cutoffs below are editorial judgment calls, not measured constants -
// retune freely if real puzzles don't feel like they match their label.
const HOPS_WEIGHT = 0.4;
const BILLING_WEIGHT = 0.4;
const YEAR_GAP_WEIGHT = 0.1;
const AGE_WEIGHT = 0.1;

const HOPS_NORMALIZATION_MAX = 6; // shortestPath's own default maxHops
const BILLING_NORMALIZATION_MAX = 9; // buildCastGraph's own default castLimit (10) minus 1
const YEAR_GAP_NORMALIZATION_MAX = 50; // the user's own "50 years apart is really hard" example
const AGE_NORMALIZATION_MAX = 60; // roughly "pre-1960s-ish" fully maxes this component out

function clamp01 (value) {
  return Math.max(0, Math.min(1, value));
}

// A person's billing position (0 = top-billed) in a specific movie's FULL
// (uncapped) cast list, or -1 if they're not credited at all. Reads
// movie.cast directly rather than movieCastNames (which truncates) since
// the exact index is the whole point here.
function billingIndexOf (entry, personName) {
  const cast = entry?.movie?.cast;
  if (!Array.isArray(cast)) return -1;
  return cast.findIndex((member) => member?.name === personName);
}

// Scores a shortestPath-shaped path ([movieKey, person, movieKey, ...]) on a
// 0 (easiest) - 1 (hardest) scale. entriesByKey resolves the keys back to
// full entries (for cast lookups and release years).
export function scorePathDifficulty (path, entriesByKey) {
  const hops = (path.length - 1) / 2;

  // For each person-step, the WORST (highest-index = least prominent) of
  // their billing across the two movies they connect - the more obscure of
  // the two appearances is the real memory bottleneck, not the average.
  let billingTotal = 0;
  let billingSteps = 0;
  for (let i = 1; i < path.length; i += 2) {
    const person = path[i];
    const before = entriesByKey.get(path[i - 1]);
    const after = entriesByKey.get(path[i + 1]);
    const idxBefore = Math.max(billingIndexOf(before, person), 0);
    const idxAfter = Math.max(billingIndexOf(after, person), 0);
    billingTotal += Math.max(idxBefore, idxAfter);
    billingSteps += 1;
  }
  const avgBilling = billingSteps ? billingTotal / billingSteps : 0;

  const sourceYear = movieYear(entriesByKey.get(path[0]));
  const targetYear = movieYear(entriesByKey.get(path[path.length - 1]));
  const yearGap = (sourceYear != null && targetYear != null) ? Math.abs(sourceYear - targetYear) : 0;
  const currentYear = new Date().getFullYear();
  const avgAge = (sourceYear != null && targetYear != null) ? currentYear - (sourceYear + targetYear) / 2 : 0;

  const hopsComponent = clamp01((hops - 1) / (HOPS_NORMALIZATION_MAX - 1));
  const billingComponent = clamp01(avgBilling / BILLING_NORMALIZATION_MAX);
  const yearGapComponent = clamp01(yearGap / YEAR_GAP_NORMALIZATION_MAX);
  const ageComponent = clamp01(avgAge / AGE_NORMALIZATION_MAX);

  return (HOPS_WEIGHT * hopsComponent) +
    (BILLING_WEIGHT * billingComponent) +
    (YEAR_GAP_WEIGHT * yearGapComponent) +
    (AGE_WEIGHT * ageComponent);
}

// Even thirds - a simple, easily-retuned starting cutoff (see the
// normalization comment above).
export function difficultyForScore (score) {
  if (score < 1 / 3) return 'easy';
  if (score < 2 / 3) return 'medium';
  return 'hard';
}

export const DIFFICULTY_LEVELS = {
  easy: { label: 'Easy' },
  medium: { label: 'Medium' },
  hard: { label: 'Hard' }
};

// Picks two movies from the library with a real (but not trivial) path
// between them. When `difficulty` is given ('easy'/'medium'/'hard'), only
// accepts a pair whose scorePathDifficulty tier matches; omitted/null
// accepts the first connected pair found regardless of difficulty (still
// scored and labeled on the way out, just not filtered on). Tries a handful
// of random source movies (each via a bounded shortestPath search against
// random candidate targets) before giving up — a sparse/small library, or
// a narrow difficulty request, may not have any matching pair at all, in
// which case this returns null and the caller should fall back to a
// friendlier message rather than an error.
export function pickConnectedPair (eligibleEntries, graph, rng = Math.random, { difficulty = null, attempts = 40 } = {}) {
  if (eligibleEntries.length < 2) return null;

  const entriesByKey = new Map(eligibleEntries.map((entry) => [entryKey(entry), entry]));
  const shuffled = shuffle(eligibleEntries, rng);

  for (let i = 0; i < Math.min(attempts, shuffled.length); i++) {
    const source = shuffled[i];
    const sourceKey = entryKey(source);
    const otherEntries = shuffle(eligibleEntries.filter((e) => entryKey(e) !== sourceKey), rng);

    for (let j = 0; j < Math.min(attempts, otherEntries.length); j++) {
      const target = otherEntries[j];
      const path = shortestPath(graph, sourceKey, entryKey(target));
      if (path && path.length > 0) {
        const score = scorePathDifficulty(path, entriesByKey);
        const tier = difficultyForScore(score);
        if (!difficulty || tier === difficulty) {
          return { source, target, optimalPath: path, optimalHops: (path.length - 1) / 2, difficultyScore: score, difficulty: tier };
        }
      }
    }
  }

  return null;
}

// Bug report: "turn the reveal shortest path button into a two segment
// button. 'Give me one' and 'Give up'" - "Give me one" reveals just the
// NEXT step rather than the whole remaining path (that's still "Give up",
// i.e. the existing reveal-everything flow). Recomputes a fresh shortest
// path from the player's CURRENT position rather than replaying the
// original optimalPath, since the player may have already taken a
// different (still valid) route than the one the puzzle was generated
// from - `graph` (capped) is what defines "shortest," matching
// difficulty/puzzle-generation semantics elsewhere in this file.
//   lastLink: { type: 'movie', key } or { type: 'person', name } - the
//     chain's current last entry.
//   usedMovieKeys: Set of movie keys already in the chain (only consulted
//     for the person branch, to avoid hinting a movie already used).
//   playGraph: the UNCAPPED graph (see buildCastGraph's castLimit) - used
//     only to enumerate a person's candidate movies, so a hint can surface
//     a real connection outside the top-10-billing cap, same reasoning the
//     in-play autocomplete already uses.
// Returns { type: 'person', name } or { type: 'movie', key }, or null if
// no continuation toward the target could be found (already at the
// target, or genuinely stuck within shortestPath's own hop ceiling).
export function nextHintStep (lastLink, usedMovieKeys, graph, playGraph, targetKey) {
  if (lastLink.type === 'movie') {
    if (lastLink.key === targetKey) return null;
    const path = shortestPath(graph, lastLink.key, targetKey);
    if (!path || path.length < 2) return null;
    return { type: 'person', name: path[1] };
  }

  const candidates = [...(playGraph.moviesByPerson.get(lastLink.name) || [])].filter((key) => !usedMovieKeys.has(key));
  let best = null;
  let bestLen = Infinity;
  for (const key of candidates) {
    if (key === targetKey) return { type: 'movie', key };
    const path = shortestPath(graph, key, targetKey);
    if (path && path.length < bestLen) {
      bestLen = path.length;
      best = key;
    }
  }
  return best ? { type: 'movie', key: best } : null;
}

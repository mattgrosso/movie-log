import { entryKey, movieCastNames, shuffle } from './gameUtils.js';

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

// Per user feedback ("we need some way of rating difficulty... it'd be cool
// to say oh this is a really hard one or easy one, and even choose an easy
// one, medium one, or a hard one") — hop count (distance between the two
// movies) is the one concrete, reliably-computable signal named, and it's
// already exactly what pickConnectedPair's minHops/maxHops select on, so
// this is a direct relabeling of the existing 2-4 default range into three
// discrete picks rather than a new mechanism. Deliberately NOT attempted:
// billing-position/cast-size-based difficulty - the user themselves was
// unsure how those would even combine into one score ("I don't know how
// else they would be"), and hop count alone already gives a real, honest
// difficulty signal without guessing at a weighting.
export const DIFFICULTY_LEVELS = {
  easy: { label: 'Easy', minHops: 2, maxHops: 2 },
  medium: { label: 'Medium', minHops: 3, maxHops: 3 },
  hard: { label: 'Hard', minHops: 4, maxHops: 4 }
};

// Labels an already-found pair's hop count using the same tiers, so a
// player can see "why" a given puzzle is rated the way it is (e.g. when
// resuming a persisted pair, or on the "Any" difficulty, which pulls from
// the full 2-4 range rather than a single tier).
export function difficultyForHops (hops) {
  if (hops <= DIFFICULTY_LEVELS.easy.maxHops) return 'easy';
  if (hops <= DIFFICULTY_LEVELS.medium.maxHops) return 'medium';
  return 'hard';
}

// Picks two movies from the library with a real (but not trivial) path
// between them: at least minHops, at most maxHops. Tries a handful of random
// source movies (each via a bounded shortestPath search against random
// candidate targets) before giving up — a sparse/small library may not have
// any pair in the desired range, in which case this returns null and the
// caller should fall back to a friendlier message rather than an error.
export function pickConnectedPair (eligibleEntries, graph, rng = Math.random, { minHops = 2, maxHops = 4, attempts = 40 } = {}) {
  if (eligibleEntries.length < 2) return null;

  const shuffled = shuffle(eligibleEntries, rng);

  for (let i = 0; i < Math.min(attempts, shuffled.length); i++) {
    const source = shuffled[i];
    const sourceKey = entryKey(source);
    const otherEntries = shuffle(eligibleEntries.filter((e) => entryKey(e) !== sourceKey), rng);

    for (let j = 0; j < Math.min(attempts, otherEntries.length); j++) {
      const target = otherEntries[j];
      const path = shortestPath(graph, sourceKey, entryKey(target), maxHops);
      if (path && path.length > 0) {
        const hops = (path.length - 1) / 2;
        if (hops >= minHops && hops <= maxHops) {
          return { source, target, optimalPath: path, optimalHops: hops };
        }
      }
    }
  }

  return null;
}

import { describe, it, expect } from 'vitest';
import { buildCastGraph, shortestPath, pickConnectedPair, scorePathDifficulty, difficultyForScore } from '@/assets/javascript/games/sixDegrees.js';
import { makeSeededRng } from '@/assets/javascript/games/gameUtils.js';

function entry (id, cast) {
  return { dbKey: `key-${id}`, movie: { id, title: `Movie ${id}`, poster_path: '/p.jpg', release_date: '2010-06-15', cast: cast.map((name) => ({ name })) } };
}

describe('buildCastGraph', () => {
  it('maps each movie to its cast and each person to the movies they appear in', () => {
    const entries = [entry(1, ['Alice', 'Bob']), entry(2, ['Bob', 'Carol'])];
    const graph = buildCastGraph(entries);

    expect(graph.peopleByMovie.get('key-1')).toEqual(new Set(['Alice', 'Bob']));
    expect(graph.moviesByPerson.get('Bob')).toEqual(new Set(['key-1', 'key-2']));
  });

  it('caps cast to castLimit per movie', () => {
    const bigCast = Array.from({ length: 20 }, (_, i) => `Actor ${i}`);
    const graph = buildCastGraph([entry(1, bigCast)], 5);
    expect(graph.peopleByMovie.get('key-1').size).toBe(5);
  });
});

describe('shortestPath', () => {
  it('returns an empty array when source and target are the same movie', () => {
    const graph = buildCastGraph([entry(1, ['Alice'])]);
    expect(shortestPath(graph, 'key-1', 'key-1')).toEqual([]);
  });

  it('finds a direct 1-hop path when two movies share a cast member', () => {
    const entries = [entry(1, ['Alice']), entry(2, ['Alice'])];
    const graph = buildCastGraph(entries);
    const path = shortestPath(graph, 'key-1', 'key-2');
    expect(path).toEqual(['key-1', 'Alice', 'key-2']);
  });

  it('finds a multi-hop path through intermediate movies/people', () => {
    // key-1 --Alice-- key-2 --Bob-- key-3
    const entries = [entry(1, ['Alice']), entry(2, ['Alice', 'Bob']), entry(3, ['Bob'])];
    const graph = buildCastGraph(entries);
    const path = shortestPath(graph, 'key-1', 'key-3');
    expect(path).toEqual(['key-1', 'Alice', 'key-2', 'Bob', 'key-3']);
  });

  it('returns the SHORTEST path when multiple paths exist', () => {
    // Direct 1-hop via Zoe, but also a longer detour via Alice/Bob.
    const entries = [
      entry(1, ['Alice', 'Zoe']),
      entry(2, ['Alice', 'Bob']),
      entry(3, ['Bob', 'Zoe'])
    ];
    const graph = buildCastGraph(entries);
    const path = shortestPath(graph, 'key-1', 'key-3');
    expect(path).toEqual(['key-1', 'Zoe', 'key-3']);
  });

  it('returns null when no path exists', () => {
    const entries = [entry(1, ['Alice']), entry(2, ['Bob'])];
    const graph = buildCastGraph(entries);
    expect(shortestPath(graph, 'key-1', 'key-2')).toBeNull();
  });

  it('returns null when the only path exceeds maxHops', () => {
    // key-1 -Alice- key-2 -Bob- key-3 -Carol- key-4 : 3 hops
    const entries = [entry(1, ['Alice']), entry(2, ['Alice', 'Bob']), entry(3, ['Bob', 'Carol']), entry(4, ['Carol'])];
    const graph = buildCastGraph(entries);
    expect(shortestPath(graph, 'key-1', 'key-4', 2)).toBeNull();
    expect(shortestPath(graph, 'key-1', 'key-4', 3)).not.toBeNull();
  });
});

describe('pickConnectedPair', () => {
  it('picks a pair whose optimal path length is within [minHops, maxHops]', () => {
    // Chain of 5 movies, each hop away from the next: 1-2-3-4-5 (up to 4 hops).
    const entries = [
      entry(1, ['A']),
      entry(2, ['A', 'B']),
      entry(3, ['B', 'C']),
      entry(4, ['C', 'D']),
      entry(5, ['D'])
    ];
    const graph = buildCastGraph(entries);
    const result = pickConnectedPair(entries, graph, makeSeededRng(1), { minHops: 2, maxHops: 4 });

    expect(result).not.toBeNull();
    expect(result.optimalHops).toBeGreaterThanOrEqual(2);
    expect(result.optimalHops).toBeLessThanOrEqual(4);
    expect(result.source.dbKey).not.toBe(result.target.dbKey);
  });

  it('returns null when the library has fewer than 2 movies', () => {
    expect(pickConnectedPair([entry(1, ['A'])], buildCastGraph([entry(1, ['A'])]))).toBeNull();
  });

  it('returns null when no pair in the library is connected at all', () => {
    const entries = [entry(1, ['Alice']), entry(2, ['Bob'])]; // disjoint casts
    const graph = buildCastGraph(entries);
    expect(pickConnectedPair(entries, graph, makeSeededRng(1))).toBeNull();
  });

  it('is deterministic for a fixed rng', () => {
    const entries = [entry(1, ['A']), entry(2, ['A', 'B']), entry(3, ['B', 'C']), entry(4, ['C'])];
    const graph = buildCastGraph(entries);
    const a = pickConnectedPair(entries, graph, makeSeededRng(5));
    const b = pickConnectedPair(entries, graph, makeSeededRng(5));
    expect(a.source.dbKey).toBe(b.source.dbKey);
    expect(a.target.dbKey).toBe(b.target.dbKey);
  });
});

// Hand-built entries for scorePathDifficulty's own tests - full control over
// year and cast-billing-order, independent of buildCastGraph/shortestPath.
function scoreEntry (id, { year = 2010, cast = [] } = {}) {
  return { dbKey: `key-${id}`, movie: { id, title: `Movie ${id}`, release_date: `${year}-06-15`, cast: cast.map((name) => ({ name })) } };
}

describe('scorePathDifficulty', () => {
  it('increases with more hops, all else held equal', () => {
    // Everyone top-billed (index 0) in every movie, same year throughout -
    // isolates the hops component.
    const m1 = scoreEntry(1, { cast: ['A'] });
    const m2 = scoreEntry(2, { cast: ['A', 'B'] });
    const m3 = scoreEntry(3, { cast: ['B', 'C'] });
    const entriesByKey = new Map([m1, m2, m3].map((e) => [e.dbKey, e]));

    const oneHop = scorePathDifficulty(['key-1', 'A', 'key-2'], entriesByKey);
    const twoHops = scorePathDifficulty(['key-1', 'A', 'key-2', 'B', 'key-3'], entriesByKey);
    expect(twoHops).toBeGreaterThan(oneHop);
  });

  it('increases as the connecting person is billed further down the cast list', () => {
    // The person must actually appear in BOTH connected movies' casts (real
    // paths only ever traverse a shared cast member) - target's billing of
    // "Connector" is held constant (index 0) across both scenarios so only
    // the OTHER movie's billing depth varies.
    const target = scoreEntry(9, { year: 2010, cast: ['Connector', 'Star'] });
    const topBilled = scoreEntry(1, { year: 2010, cast: ['Connector', 'Star'] });
    const deepBilled = scoreEntry(2, { year: 2010, cast: [...Array(8).fill(null).map((_, i) => `Extra ${i}`), 'Connector'] });
    const entriesByKey = new Map([target, topBilled, deepBilled].map((e) => [e.dbKey, e]));

    const withTopBilled = scorePathDifficulty([topBilled.dbKey, 'Connector', target.dbKey], entriesByKey);
    const withDeepBilled = scorePathDifficulty([deepBilled.dbKey, 'Connector', target.dbKey], entriesByKey);
    expect(withDeepBilled).toBeGreaterThan(withTopBilled);
  });

  it('increases with a larger year gap between the endpoints', () => {
    const person = 'Actor';
    const close = [scoreEntry(1, { year: 2010, cast: [person] }), scoreEntry(2, { year: 2012, cast: [person] })];
    const far = [scoreEntry(3, { year: 2010, cast: [person] }), scoreEntry(4, { year: 1970, cast: [person] })];
    const entriesByKey = new Map([...close, ...far].map((e) => [e.dbKey, e]));

    const closeScore = scorePathDifficulty([close[0].dbKey, person, close[1].dbKey], entriesByKey);
    const farScore = scorePathDifficulty([far[0].dbKey, person, far[1].dbKey], entriesByKey);
    expect(farScore).toBeGreaterThan(closeScore);
  });

  it('increases with older average movie age, holding year GAP constant', () => {
    const person = 'Actor';
    const modern = [scoreEntry(1, { year: 2020, cast: [person] }), scoreEntry(2, { year: 2022, cast: [person] })];
    const old = [scoreEntry(3, { year: 1950, cast: [person] }), scoreEntry(4, { year: 1952, cast: [person] })]; // same 2-year gap, much older
    const entriesByKey = new Map([...modern, ...old].map((e) => [e.dbKey, e]));

    const modernScore = scorePathDifficulty([modern[0].dbKey, person, modern[1].dbKey], entriesByKey);
    const oldScore = scorePathDifficulty([old[0].dbKey, person, old[1].dbKey], entriesByKey);
    expect(oldScore).toBeGreaterThan(modernScore);
  });

  it('weighs hops/billing more heavily than year-gap/age (per the user\'s explicit priority)', () => {
    const person = 'Actor';
    // Maxes out the year-gap component (60yr >= the 50yr normalization cap)
    // with a real (if not maximal) age contribution too, but it's a single
    // top-billed hop - per the user's own stated priority ("less impact
    // than the number of steps and billing order"), year/age alone should
    // never be enough to reach even 'medium', let alone 'hard'.
    const oldButSimple = [scoreEntry(1, { year: 1960, cast: [person] }), scoreEntry(2, { year: 2020, cast: [person] })];
    const entriesByKey = new Map(oldButSimple.map((e) => [e.dbKey, e]));
    const score = scorePathDifficulty([oldButSimple[0].dbKey, person, oldButSimple[1].dbKey], entriesByKey);

    expect(difficultyForScore(score)).toBe('easy');
  });
});

describe('difficultyForScore', () => {
  it('buckets into even thirds', () => {
    expect(difficultyForScore(0)).toBe('easy');
    expect(difficultyForScore(0.32)).toBe('easy');
    expect(difficultyForScore(0.34)).toBe('medium');
    expect(difficultyForScore(0.65)).toBe('medium');
    expect(difficultyForScore(0.67)).toBe('hard');
    expect(difficultyForScore(1)).toBe('hard');
  });
});

describe('pickConnectedPair with a difficulty filter', () => {
  // A straight chain, everyone top-billed, same year throughout - per
  // scorePathDifficulty's own tests above, this never reaches 'hard'
  // (hops alone can't cross the tier boundary without billing/year/age
  // contributing too), which is exactly what makes it useful for testing
  // the filter's null-when-nothing-matches behavior deterministically.
  function buildChainLibrary () {
    return [
      entry(1, ['A']),
      entry(2, ['A', 'B']),
      entry(3, ['B', 'C']),
      entry(4, ['C', 'D']),
      entry(5, ['D'])
    ];
  }

  it('finds a pair and tags it with a difficulty when none is requested', () => {
    const entries = buildChainLibrary();
    const graph = buildCastGraph(entries);
    const pair = pickConnectedPair(entries, graph, makeSeededRng(1));
    expect(pair).not.toBeNull();
    expect(['easy', 'medium', 'hard']).toContain(pair.difficulty);
    expect(pair.difficultyScore).toBeGreaterThanOrEqual(0);
  });

  it('finds a pair when the requested difficulty matches what the library can produce', () => {
    const entries = buildChainLibrary();
    const graph = buildCastGraph(entries);
    const pair = pickConnectedPair(entries, graph, makeSeededRng(1), { difficulty: 'easy' });
    expect(pair).not.toBeNull();
    expect(pair.difficulty).toBe('easy');
  });

  it('returns null when no pair in the library reaches the requested difficulty', () => {
    const entries = buildChainLibrary();
    const graph = buildCastGraph(entries);
    const pair = pickConnectedPair(entries, graph, makeSeededRng(1), { difficulty: 'hard' });
    expect(pair).toBeNull();
  });
});

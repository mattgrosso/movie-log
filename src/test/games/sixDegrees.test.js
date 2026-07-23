import { describe, it, expect } from 'vitest';
import { buildCastGraph, shortestPath, pickConnectedPair, DIFFICULTY_LEVELS, difficultyForHops } from '@/assets/javascript/games/sixDegrees.js';
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

describe('difficultyForHops', () => {
  it('maps hop counts onto the same tiers DIFFICULTY_LEVELS defines', () => {
    expect(difficultyForHops(1)).toBe('easy');
    expect(difficultyForHops(2)).toBe('easy');
    expect(difficultyForHops(3)).toBe('medium');
    expect(difficultyForHops(4)).toBe('hard');
    expect(difficultyForHops(5)).toBe('hard');
  });
});

describe('pickConnectedPair with a difficulty range', () => {
  // A straight chain: 1-A-2-B-3-C-4-D-5, so movie 1 is 1/2/3/4 hops from
  // movies 2/3/4/5 respectively - a clean spread across all three tiers.
  function buildChainLibrary () {
    return [
      entry(1, ['A']),
      entry(2, ['A', 'B']),
      entry(3, ['B', 'C']),
      entry(4, ['C', 'D']),
      entry(5, ['D'])
    ];
  }

  it('respects an easy (2-hop) range', () => {
    const entries = buildChainLibrary();
    const graph = buildCastGraph(entries);
    const pair = pickConnectedPair(entries, graph, makeSeededRng(1), DIFFICULTY_LEVELS.easy);
    expect(pair).not.toBeNull();
    expect(pair.optimalHops).toBe(2);
  });

  it('respects a hard (4-hop) range', () => {
    const entries = buildChainLibrary();
    const graph = buildCastGraph(entries);
    const pair = pickConnectedPair(entries, graph, makeSeededRng(1), DIFFICULTY_LEVELS.hard);
    expect(pair).not.toBeNull();
    expect(pair.optimalHops).toBe(4);
    // Only one 4-hop pair exists in this chain: movie 1 <-> movie 5.
    const keys = [pair.source.dbKey, pair.target.dbKey].sort();
    expect(keys).toEqual(['key-1', 'key-5']);
  });

  it('returns null when no pair exists in the requested range (too small/homogeneous a library for that difficulty)', () => {
    const entries = [entry(1, ['A']), entry(2, ['A', 'B']), entry(3, ['B'])]; // max possible hop count here is 2
    const graph = buildCastGraph(entries);
    const pair = pickConnectedPair(entries, graph, makeSeededRng(1), DIFFICULTY_LEVELS.hard);
    expect(pair).toBeNull();
  });
});

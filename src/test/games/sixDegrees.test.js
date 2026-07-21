import { describe, it, expect } from 'vitest';
import { buildCastGraph, shortestPath, pickConnectedPair } from '@/assets/javascript/games/sixDegrees.js';
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

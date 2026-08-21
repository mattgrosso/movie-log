import { describe, it, expect } from 'vitest';
import {
  vennPeople,
  vennRegions,
  lensArea,
  distanceForOverlap,
  subsetAt,
  vennLayout,
  regionLabel
} from '@/assets/javascript/clubVenn.js';

const getRating = (entry) => ({ calculatedTotal: entry?.score });

const NOW = new Date('2026-08-21T12:00:00Z').getTime();
const THIS_YEAR = new Date('2026-03-01T12:00:00Z').getTime();
const LAST_YEAR = new Date('2025-03-01T12:00:00Z').getTime();

function entry (id, title, score, date = '2026-03-01') {
  return { score, ratings: [{ date }], movie: { id, title, poster_path: `/${id}.jpg` } };
}

function person (key, ids, { score = 7, at = THIS_YEAR } = {}) {
  return {
    key,
    name: key,
    movies: new Map(ids.map((id) => [id, { id, t: `t${id}`, p: null, r: score, at }]))
  };
}

describe('vennPeople', () => {
  it('includes you plus only friends who publish a ratings map', () => {
    const people = vennPeople([entry(1, 'Heat', 9)], getRating, {
      seth: { name: 'Seth', ratings: { 2: { r: 8, at: THIS_YEAR, t: 'Cats', p: '/2.jpg' } } },
      shelfOnly: { name: 'Shelf', topShelf: [{ id: 3 }] }
    });

    expect(people.map((p) => p.key)).toEqual(['you', 'seth']);
    expect(people[0].movies.get(1).r).toBe(9);
    expect(people[1].movies.get(2).t).toBe('Cats');
  });
});

describe('vennRegions', () => {
  it('partitions two libraries into only-A, only-B, and both', () => {
    const result = vennRegions([person('a', [1, 2, 3]), person('b', [3, 4])]);
    const bySig = Object.fromEntries(result.regions.map((r) => [r.signature, r]));

    expect(bySig.a.movies.map((m) => m.id).sort()).toEqual([1, 2]);
    expect(bySig.b.movies.map((m) => m.id)).toEqual([4]);
    expect(bySig['a|b'].movies.map((m) => m.id)).toEqual([3]);
  });

  it('gives three people all seven regions, exclusively', () => {
    const result = vennRegions([
      person('a', [1, 12, 13, 123]),
      person('b', [2, 12, 23, 123]),
      person('c', [3, 13, 23, 123])
    ]);
    const counts = Object.fromEntries(result.regions.map((r) => [r.signature, r.count]));

    expect(counts).toEqual({ a: 1, b: 1, c: 1, 'a|b': 1, 'a|c': 1, 'b|c': 1, 'a|b|c': 1 });
  });

  it('the loved lens keeps only 8+ scores on every side, and exactly 8 counts', () => {
    const people = [
      { key: 'a', name: 'a', movies: new Map([[1, { id: 1, t: '', p: null, r: 9, at: THIS_YEAR }], [2, { id: 2, t: '', p: null, r: 5, at: THIS_YEAR }], [3, { id: 3, t: '', p: null, r: 8, at: THIS_YEAR }]]) },
      { key: 'b', name: 'b', movies: new Map([[1, { id: 1, t: '', p: null, r: 7.9, at: THIS_YEAR }]]) }
    ];
    const result = vennRegions(people, 'loved', NOW);
    const bySig = Object.fromEntries(result.regions.map((r) => [r.signature, r]));

    // b's 7.9 on movie 1 fails the lens, so 1 is only-a, not shared — and
    // a's flat 8 on movie 3 is a love, not a near miss.
    expect(bySig.a.movies.map((m) => m.id).sort()).toEqual([1, 3]);
    expect(bySig['a|b'].count).toBe(0);
    expect(result.people.find((p) => p.key === 'b').count).toBe(0);
  });

  it('the this-year lens compares calendar years of the viewing timestamp', () => {
    const people = [
      { key: 'a', name: 'a', movies: new Map([[1, { id: 1, t: '', p: null, r: 9, at: THIS_YEAR }], [2, { id: 2, t: '', p: null, r: 9, at: LAST_YEAR }], [3, { id: 3, t: '', p: null, r: 9, at: null }]]) },
      { key: 'b', name: 'b', movies: new Map() }
    ];
    const result = vennRegions(people, 'year', NOW);

    expect(result.people.find((p) => p.key === 'a').count).toBe(1);
  });

  it('sorts a region best-first by the average of its holders’ scores', () => {
    const people = [
      { key: 'a', name: 'a', movies: new Map([[1, { id: 1, t: '', p: null, r: 6, at: null }], [2, { id: 2, t: '', p: null, r: 9, at: null }]]) },
      { key: 'b', name: 'b', movies: new Map([[1, { id: 1, t: '', p: null, r: 7, at: null }], [2, { id: 2, t: '', p: null, r: 8, at: null }]]) }
    ];
    const shared = vennRegions(people).regions.find((r) => r.signature === 'a|b');

    expect(shared.movies.map((m) => m.id)).toEqual([2, 1]);
  });

  it('prefers your own title and poster for a shared film', () => {
    const people = [
      { key: 'you', name: 'You', movies: new Map([[1, { id: 1, t: 'Heat', p: '/mine.jpg', r: 9, at: null }]]) },
      { key: 'b', name: 'b', movies: new Map([[1, { id: 1, t: 'HEAT (1995)', p: '/theirs.jpg', r: 8, at: null }]]) }
    ];
    const shared = vennRegions(people).regions.find((r) => r.signature === 'you|b');

    expect(shared.movies[0].t).toBe('Heat');
    expect(shared.movies[0].p).toBe('/mine.jpg');
  });
});

describe('geometry', () => {
  it('distanceForOverlap hits the target lens area', () => {
    const r1 = Math.sqrt(100 / Math.PI);
    const r2 = Math.sqrt(60 / Math.PI);
    const d = distanceForOverlap(r1, r2, 25);

    expect(lensArea(r1, r2, d)).toBeCloseTo(25, 3);
  });

  it('disjoint sets get a visible gap, containment nests', () => {
    expect(distanceForOverlap(2, 1, 0)).toBeGreaterThan(3);
    // Full containment: the smaller circle's whole area is shared.
    expect(distanceForOverlap(2, 1, Math.PI)).toBeLessThan(1);
  });

  it('subsetAt reports exactly the circles containing the point', () => {
    const circles = [
      { key: 'a', x: 0, y: 0, r: 2 },
      { key: 'b', x: 3, y: 0, r: 2 }
    ];

    expect(subsetAt(-1, 0, circles)).toEqual(['a']);
    expect(subsetAt(1.5, 0, circles)).toEqual(['a', 'b']);
    expect(subsetAt(10, 10, circles)).toEqual([]);
  });

  it('lays out two circles so every non-empty region has an in-region anchor', () => {
    const data = vennRegions([person('a', [1, 2, 3, 4]), person('b', [3, 4, 5])]);
    const layout = vennLayout(data);

    expect(layout.circles).toHaveLength(2);
    data.regions.filter((r) => r.count).forEach((region) => {
      const anchor = layout.anchors[region.signature];
      expect(anchor).toBeTruthy();
      const subset = subsetAt(anchor.x, anchor.y, layout.circles).sort().join('|');
      expect(subset).toBe([...region.keys].sort().join('|'));
    });
  });

  it('lays out three circles inside the viewBox', () => {
    const data = vennRegions([
      person('a', [1, 2, 3, 12, 13, 123]),
      person('b', [4, 5, 12, 23, 123]),
      person('c', [6, 13, 23, 123])
    ]);
    const layout = vennLayout(data);

    expect(layout.circles).toHaveLength(3);
    layout.circles.forEach((circle) => {
      expect(circle.x - circle.r).toBeGreaterThanOrEqual(-0.01);
      expect(circle.x + circle.r).toBeLessThanOrEqual(100.01);
      expect(circle.y - circle.r).toBeGreaterThanOrEqual(-0.01);
      expect(circle.y + circle.r).toBeLessThanOrEqual(layout.height + 0.01);
    });
  });
});

describe('regionLabel', () => {
  const people = [{ key: 'you', name: 'You' }, { key: 's', name: 'Seth' }, { key: 'n', name: 'Nat' }];

  it('names regions the way a person would say them', () => {
    expect(regionLabel({ keys: ['s'] }, people, 3)).toBe('Only Seth');
    expect(regionLabel({ keys: ['you', 's'] }, people, 3)).toBe('You & Seth');
    expect(regionLabel({ keys: ['you', 's', 'n'] }, people, 3)).toBe('You, Seth & Nat');
  });
});

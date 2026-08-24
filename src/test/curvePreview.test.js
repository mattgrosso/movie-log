import { describe, it, expect } from 'vitest';
import { curveLadder, curveDistribution, shareAtOrBelow } from '@/assets/javascript/curvePreview.js';
import {
  baseNormalized, normalizedValue, applyNormalization
} from '@/assets/javascript/normalizationPicker.js';

// Matt, 2026-08-24, after asking why a 5.57 displays as a 4: "I'd like more
// clarity on what the results of my choices are when I make them... show me
// what the lowest ten is, and then an example of each of the numbers."
//
// The preview's whole job is to be TRUE — a table that disagreed with the app
// would be worse than no table, because it would be trusted. So the tests
// that matter here are the ones tying it to GetRating.js's own arithmetic.

const film = (title, total) => ({ entry: { dbKey: title, movie: { title } }, total });

// A library shaped like a real one: a bell peaking at 6-7, the way Matt's
// 1,381 films actually sit. A flat one-film-per-score fixture has no peak, so
// it cannot test a claim about the peak moving.
const bellLibrary = [
  [0, 1], [1, 2], [2, 4], [3, 8], [4, 14],
  [5, 20], [6, 30], [7, 30], [8, 10], [9, 5], [10, 2]
].flatMap(([score, count]) =>
  Array.from({ length: count }, (_, i) => film(`Film ${score}-${i}`, score))
);

// A spread wide enough to populate most ratings.
const library = [
  film('Best', 10), film('Great', 9), film('Good', 8), film('Fine', 7),
  film('OK', 6), film('Meh', 5), film('Poor', 4), film('Bad', 3),
  film('Worse', 2), film('Awful', 1), film('Worst', 0)
];

describe('normalizedValue / applyNormalization', () => {
  // The refactor that made the preview possible must not have moved the app.
  it('applyNormalization is still exactly round-then-clamp of the raw value', () => {
    const cases = [
      { base: 5.1, opts: { tenBase: 9.26, fiveBase: 5.33 } },
      { base: 9.9, opts: { tenBase: 9.26, fiveBase: 5.33 } },
      { base: 0.4, opts: { tenBase: 9.26, fiveBase: 5.33 } },
      { base: 4.0, opts: { tenBase: 8, fiveBase: null } },
      { base: 4.0, opts: { tweak: 0.25 } },
      // Above the ten-anchor. The clamp is load-bearing here, not defensive:
      // anything scoring past your "lowest 10" overshoots the top of the
      // scale, and without the clamp it would display as 16.
      { base: 10, opts: { tenBase: 6, fiveBase: 3 } },
      { base: 10, opts: { tenBase: 6, fiveBase: null } }
    ];
    cases.forEach(({ base, opts }) => {
      expect(applyNormalization(base, opts))
        .toBe(Math.max(0, Math.min(10, Math.round(normalizedValue(base, opts)))));
    });
  });

  it('clamps a film scoring above the ten-anchor to 10', () => {
    expect(normalizedValue(10, { tenBase: 6, fiveBase: 3 })).toBeGreaterThan(10);
    expect(applyNormalization(10, { tenBase: 6, fiveBase: 3 })).toBe(10);
  });

  it('exposes the pre-rounding value the table shows', () => {
    // The anchor sits on the bottom of its grade: 4.5, which rounds to 5.
    expect(normalizedValue(5.33, { tenBase: 9.26, fiveBase: 5.33 })).toBeCloseTo(4.5);
    expect(applyNormalization(5.33, { tenBase: 9.26, fiveBase: 5.33 })).toBe(5);
  });
});

describe('curveLadder', () => {
  it('gives one row per rating that has movies, highest first', () => {
    const rows = curveLadder(library, { tenTotal: 10, fiveTotal: 5 });
    expect(rows[0].grade).toBe(10);
    expect(rows.map((r) => r.grade)).toEqual([...rows.map((r) => r.grade)].sort((a, b) => b - a));
    rows.forEach((row) => expect(row.count).toBeGreaterThan(0));
  });

  // The row he asked for by name.
  it('names the LOWEST-scoring movie at each rating, not just any of them', () => {
    const rows = curveLadder(
      [film('Higher 8', 8.9), film('Lowest 8', 8.1), film('Top', 10), film('Floor', 0)],
      { tenTotal: 10, fiveTotal: 5 }
    );
    const eight = rows.find((r) => r.grade === 8);
    expect(eight.lowest.entry.movie.title).toBe('Lowest 8');
    expect(eight.highest.entry.movie.title).toBe('Higher 8');
  });

  // The property that makes the table trustworthy: it must agree with the
  // app. Deriving grades a second way here would only prove the copy matches
  // itself, so this checks against normalizationPicker directly.
  it('grades every movie exactly the way GetRating would', () => {
    const rows = curveLadder(library, { tenTotal: 10, fiveTotal: 5 });
    const totals = library.map((f) => f.total);
    const min = Math.min(...totals);
    const max = Math.max(...totals);
    const opts = {
      tweak: 0.25,
      tenBase: baseNormalized(10, min, max),
      fiveBase: baseNormalized(5, min, max)
    };

    rows.forEach((row) => {
      [row.lowest, row.highest].forEach((item) => {
        const expected = applyNormalization(baseNormalized(item.total, min, max), opts);
        expect(row.grade).toBe(expected);
      });
    });
  });

  it('accounts for every movie exactly once', () => {
    const rows = curveLadder(library, { tenTotal: 10, fiveTotal: 5 });
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(library.length);
  });

  // Moving the five-anchor down should lift the library, which is the whole
  // point of showing him the table.
  it('a lower five-anchor pushes fewer movies under a 5', () => {
    const high = curveLadder(library, { tenTotal: 10, fiveTotal: 7 });
    const low = curveLadder(library, { tenTotal: 10, fiveTotal: 3 });
    expect(shareAtOrBelow(high, 4)).toBeGreaterThan(shareAtOrBelow(low, 4));
  });

  // Ties are the common case in a real library — 1,381 films over 572
  // distinct 2-decimal scores — and a named film that shuffles between
  // renders would read as a bug in the preview.
  it('breaks a score tie by title, so the named movie is stable', () => {
    const tied = [film('Zebra', 5), film('Apple', 5), film('Top', 10), film('Floor', 0)];
    const first = curveLadder(tied, { tenTotal: 10, fiveTotal: 5 });
    const again = curveLadder([...tied].reverse(), { tenTotal: 10, fiveTotal: 5 });
    const titleAt = (rows, grade) => rows.find((r) => r.grade === grade)?.lowest.entry.movie.title;
    expect(titleAt(first, 5)).toBe('Apple');
    expect(titleAt(again, 5)).toBe('Apple');
  });

  // Found by running the ladder against the real library: twelve of his films
  // score exactly 5.7800, one being the five-anchor, and the alphabetical
  // tie-break named "American Beauty" on the row he'd set to "The Game".
  // A table that can't confirm your own choice back to you is useless for the
  // job it was asked to do.
  it('names the anchor itself on a row whose score ties it', () => {
    const tied = [
      film('American Beauty', 5), film('Zodiac', 5),
      film('The Game', 5), film('Top', 10), film('Floor', 0)
    ];
    const rows = curveLadder(tied, {
      tenTotal: 10, fiveTotal: 5, anchorKeys: ['The Game']
    });
    expect(rows.find((r) => r.grade === 5).lowest.entry.movie.title).toBe('The Game');
  });

  it('still falls back to title order when no anchor is in the tie', () => {
    const tied = [film('Zodiac', 5), film('American Beauty', 5), film('Top', 10), film('Floor', 0)];
    const rows = curveLadder(tied, { tenTotal: 10, fiveTotal: 5, anchorKeys: ['Absent'] });
    expect(rows.find((r) => r.grade === 5).lowest.entry.movie.title).toBe('American Beauty');
  });

  it('works with no anchors at all, on the legacy offset', () => {
    const rows = curveLadder(library, { tweak: 0.25 });
    expect(rows.length).toBeGreaterThan(1);
  });

  it('is safe on junk', () => {
    expect(curveLadder(null, {})).toEqual([]);
    expect(curveLadder([], {})).toEqual([]);
    expect(curveLadder([film('a', NaN)], {})).toEqual([]);
    // Nothing to preview when every movie scores the same.
    expect(curveLadder([film('a', 5), film('b', 5)], {})).toEqual([]);
  });
});

describe('curveDistribution', () => {
  // The chart he actually wanted: two bells on one axis. An earlier version
  // plotted score-in against score-out and he rejected it — "that graph's not
  // interested to me. The x axis should be the ratings, and I wanna see the
  // bell curve."
  it('gives a bucket for every rating 0-10, in order', () => {
    const rows = curveDistribution(library, { tenTotal: 10, fiveTotal: 5 });
    expect(rows).toHaveLength(11);
    expect(rows.map((r) => r.rating)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('counts the whole library into each series', () => {
    const rows = curveDistribution(library, { tenTotal: 10, fiveTotal: 5 });
    expect(rows.reduce((sum, r) => sum + r.actual, 0)).toBe(library.length);
    expect(rows.reduce((sum, r) => sum + r.adjusted, 0)).toBe(library.length);
  });

  it('buckets the raw score by rounding it', () => {
    const rows = curveDistribution(
      [film('a', 6.4), film('b', 6.6), film('top', 10), film('floor', 0)],
      { tenTotal: 10, fiveTotal: 5 }
    );
    expect(rows[6].actual).toBe(1);
    expect(rows[7].actual).toBe(1);
  });

  // The comparison the chart exists to make: a five-anchor set high in the
  // library drags the curved bell left of the real one. On his real data the
  // raw scores peak at 6-7 and the curve moves the peak to 4-5.
  it('shows the curve shifting the peak down when the five-anchor is high', () => {
    const rows = curveDistribution(bellLibrary, { tenTotal: 10, fiveTotal: 8 });
    const peak = (key) => rows.reduce((best, row) => (row[key] > best[key] ? row : best), rows[0]);

    expect(peak('actual').rating).toBe(6);
    expect(peak('adjusted').rating).toBeLessThan(peak('actual').rating);
  });

  // The other direction, so the test above isn't just measuring "any anchor
  // moves the peak": drop the five-anchor low and the curved bell stops
  // trailing the real one.
  it('a lower five-anchor pulls the two bells back together', () => {
    const spread = (fiveTotal) => {
      const rows = curveDistribution(bellLibrary, { tenTotal: 10, fiveTotal });
      return rows.reduce((sum, row) => sum + Math.abs(row.actual - row.adjusted), 0);
    };
    expect(spread(3)).toBeLessThan(spread(8));
  });

  it('is safe on junk', () => {
    expect(curveDistribution(null, {})).toEqual([]);
    expect(curveDistribution([], {})).toEqual([]);
    expect(curveDistribution([film('a', 5), film('b', 5)], {})).toEqual([]);
  });
});

describe('shareAtOrBelow', () => {
  it('reports the share of the library at or below a rating', () => {
    const rows = [
      { grade: 10, count: 1 }, { grade: 5, count: 1 },
      { grade: 4, count: 1 }, { grade: 1, count: 1 }
    ];
    expect(shareAtOrBelow(rows, 4)).toBe(50);
    expect(shareAtOrBelow(rows, 10)).toBe(100);
  });

  it('is safe on nothing', () => {
    expect(shareAtOrBelow([], 4)).toBe(0);
    expect(shareAtOrBelow(null, 4)).toBe(0);
  });
});

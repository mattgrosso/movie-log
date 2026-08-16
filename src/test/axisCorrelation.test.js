import { describe, it, expect } from 'vitest';
import { correlation, describeCorrelation } from '@/assets/javascript/axisCorrelation.js';

// The scatter plot's readout. Matt likes the XY plot and asked whether there
// was more to do with it (2026-08-16); a cloud of 1,300 dots is hard to read,
// so it now says out loud whether the two axes move together.

describe('correlation', () => {
  it('is 1 for a perfect rise and -1 for a perfect fall', () => {
    const rising = [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }, { x: 4, y: 8 }];
    const falling = [{ x: 1, y: 8 }, { x: 2, y: 6 }, { x: 3, y: 4 }, { x: 4, y: 2 }];

    expect(correlation(rising)).toBeCloseTo(1, 10);
    expect(correlation(falling)).toBeCloseTo(-1, 10);
  });

  it('never leaves [-1, 1], even when floating-point drift would', () => {
    const points = Array.from({ length: 500 }, (_, i) => ({ x: i / 3, y: i / 3 }));
    const r = correlation(points);

    expect(r).toBeLessThanOrEqual(1);
    expect(r).toBeGreaterThanOrEqual(-1);
  });

  it('finds roughly nothing in an unrelated pair', () => {
    // Symmetric about the middle: y rises then falls back, so on average it
    // goes nowhere as x increases.
    const points = [{ x: 1, y: 1 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 1 }];

    expect(correlation(points)).toBeCloseTo(0, 10);
  });

  // A flat axis has no variance, and the formula divides by it — this used to
  // be the way to produce a confident NaN.
  it('returns null rather than NaN when an axis never varies', () => {
    expect(correlation([{ x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 }])).toBeNull();
    expect(correlation([{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }])).toBeNull();
  });

  it('returns null when there is not enough to say anything', () => {
    expect(correlation([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull();
    expect(correlation([])).toBeNull();
    expect(correlation(null)).toBeNull();
  });

  it('ignores points with a missing or non-numeric coordinate', () => {
    const points = [
      { x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 },
      { x: null, y: 8 }, { x: 4, y: undefined }, { x: NaN, y: 1 }
    ];

    expect(correlation(points)).toBeCloseTo(1, 10);
  });
});

describe('describeCorrelation', () => {
  it('names the direction', () => {
    expect(describeCorrelation(0.9, 'Story', 'Direction')).toContain('rise together');
    expect(describeCorrelation(-0.9, 'Story', 'Runtime')).toContain('pull against each other');
  });

  it('scales its wording with the strength', () => {
    expect(describeCorrelation(0.85, 'A', 'B')).toContain('almost lockstep');
    expect(describeCorrelation(0.65, 'A', 'B')).toContain('closely');
    expect(describeCorrelation(0.45, 'A', 'B')).toContain('noticeably');
    expect(describeCorrelation(0.25, 'A', 'B')).toContain('a little');
  });

  it('says plainly when there is no relationship, rather than hedging', () => {
    expect(describeCorrelation(0.05, 'Runtime', 'Release Year')).toContain('move independently');
  });

  it('returns null when it has nothing to describe, so nothing renders', () => {
    expect(describeCorrelation(null, 'A', 'B')).toBeNull();
    expect(describeCorrelation(0.9, '', 'B')).toBeNull();
    expect(describeCorrelation(0.9, 'A', undefined)).toBeNull();
  });

  it('names both axes so the sentence stands alone', () => {
    expect(describeCorrelation(0.9, 'User Rating', 'Runtime (minutes)'))
      .toBe('User Rating and Runtime (minutes) rise together almost lockstep.');
  });
});

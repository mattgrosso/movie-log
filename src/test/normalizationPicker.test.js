import { describe, it, expect } from 'vitest';
import { baseNormalized, offsetForLastMovieAt, normalizationCandidates, applyNormalization } from '@/assets/javascript/normalizationPicker.js';

// Mirrors GetRating.js's display step: round(base + offset), clamped 0-10.
function displayedGrade (calculatedTotal, minRating, maxRating, offset) {
  const normalized = baseNormalized(calculatedTotal, minRating, maxRating) + offset;
  return Math.max(0, Math.min(10, Math.round(normalized)));
}

function entry (dbKey, calculatedTotal) {
  return { dbKey, movie: { title: dbKey }, ratings: [{ calculatedTotal }] };
}
const ratingOf = (e) => ({ calculatedTotal: e.ratings[0].calculatedTotal });

describe('normalizationPicker (bug report: choose the last 10/10 movie instead of a number)', () => {
  it('baseNormalized spans 0-10 across the library range', () => {
    expect(baseNormalized(2, 2, 9)).toBe(0);
    expect(baseNormalized(9, 2, 9)).toBe(10);
    expect(baseNormalized(5.5, 2, 9)).toBeCloseTo(5);
    expect(baseNormalized(7, 7, 7)).toBe(10);
  });

  it('the picked movie displays the grade, and the next movie down does not', () => {
    const min = 2;
    const max = 9;
    const picked = 8.4; // base ≈ 9.14
    const nextDown = 8.3;

    const offset = offsetForLastMovieAt(picked, min, max);

    expect(displayedGrade(picked, min, max, offset)).toBe(10);
    expect(displayedGrade(nextDown, min, max, offset)).toBeLessThanOrEqual(9);
  });

  it('rounds the offset UP to 2 decimals so the pick can never fall just short of its own grade', () => {
    const min = 0;
    const max = 10;
    const picked = 9.123; // raw offset = 9.5 - 9.123 = 0.377 -> 0.38
    const offset = offsetForLastMovieAt(picked, min, max);

    expect(offset).toBe(0.38);
    expect(displayedGrade(picked, min, max, offset)).toBe(10);
  });

  it('candidates are the movies whose offset fits the settings band, best score first, each carrying its offset', () => {
    // Range 2-9: an offset in [0, 1] needs a base position of 8.5-9.5,
    // i.e. a score between 7.95 and 8.65 — scores above that are already
    // a 10 at offset 0 (like 'top'), scores below need more than +1.
    const entries = [
      entry('top', 9), // offset would be negative (already a 10 at offset 0)
      entry('boundary-high', 8.6),
      entry('boundary-low', 8.0),
      entry('mid', 5.5), // offset would be far above 1
      entry('bottom', 2)
    ];

    const candidates = normalizationCandidates(entries, ratingOf);

    expect(candidates.map((c) => c.entry.dbKey)).toEqual(['boundary-high', 'boundary-low']);
    // Sorted best-first, and every offered offset is legal and effective.
    candidates.forEach((c) => {
      expect(c.offset).toBeGreaterThanOrEqual(0);
      expect(c.offset).toBeLessThanOrEqual(1);
      expect(displayedGrade(c.total, 2, 9, c.offset)).toBe(10);
    });
  });

  it('ignores entries with no readable score and tolerates empty input', () => {
    expect(normalizationCandidates([], ratingOf)).toEqual([]);
    expect(normalizationCandidates(null, ratingOf)).toEqual([]);
    const mixed = [entry('top', 9), entry('bottom', 2), entry('ok', 8.0), { dbKey: 'broken', ratings: [] }];
    const candidates = normalizationCandidates(mixed, (e) => ({ calculatedTotal: e.ratings[0]?.calculatedTotal }));
    expect(candidates.map((c) => c.entry.dbKey)).toEqual(['ok']);
  });
});

// Two-anchor curve (feedback: "I want this to be a ten, and I want this to
// be the lowest valued five"). Exactly two anchors: ceiling + pivot.
describe('applyNormalization', () => {
  it('legacy mode: constant offset, rounded and clamped', () => {
    expect(applyNormalization(7.2, { tweak: 0.25 })).toBe(7);
    expect(applyNormalization(9.9, { tweak: 0.25 })).toBe(10);
    expect(applyNormalization(0, { tweak: 0.25 })).toBe(0);
  });

  it('ten-anchor only: the anchor lands exactly on 10 and the scale stretches', () => {
    expect(applyNormalization(8, { tenBase: 8 })).toBe(10);
    expect(applyNormalization(4, { tenBase: 8 })).toBe(5);
    expect(applyNormalization(9.5, { tenBase: 8 })).toBe(10); // above the anchor clamps
  });

  it('both anchors: piecewise through (five -> 5) and (ten -> 10)', () => {
    const anchors = { tenBase: 9, fiveBase: 6 };
    expect(applyNormalization(9, anchors)).toBe(10);
    expect(applyNormalization(6, anchors)).toBe(5);
    expect(applyNormalization(7.5, anchors)).toBe(8); // midway in the top segment: 7.5
    expect(applyNormalization(3, anchors)).toBe(3); // bottom segment: 5 * 3/6 = 2.5 -> 3
    expect(applyNormalization(0, anchors)).toBe(0);
  });

  it('is monotonic across the pivot', () => {
    const anchors = { tenBase: 9, fiveBase: 6 };
    let previous = -1;
    for (let base = 0; base <= 10; base += 0.25) {
      const value = applyNormalization(base, anchors);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('ignores a degenerate five-anchor at or above the ten-anchor', () => {
    // Inverted anchors would flip the curve; fall back to ten-only stretch.
    expect(applyNormalization(8, { tenBase: 8, fiveBase: 9 })).toBe(10);
    expect(applyNormalization(4, { tenBase: 8, fiveBase: 8 })).toBe(5);
  });
});


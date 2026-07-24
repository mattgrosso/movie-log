import { describe, it, expect } from 'vitest';
import { isValidPlacement, insertAtSlot, correctSlotIndex } from '@/assets/javascript/games/timeline.js';

// Mid-month release dates throughout — see CLAUDE.md's documented test
// pitfall: new Date('YYYY-01-01') parses as UTC midnight and can shift to
// the previous year in this repo's negative-UTC-offset test environment.
function entry (year, dbKey = String(year)) {
  return { dbKey, movie: { release_date: `${year}-06-15` } };
}

describe('isValidPlacement', () => {
  it('accepts a slot strictly between its two neighbors', () => {
    const timeline = [entry(1990), entry(2010)];
    expect(isValidPlacement(timeline, 1, entry(2000))).toBe(true);
  });

  it('rejects a slot where the candidate is earlier than the left neighbor', () => {
    const timeline = [entry(1990), entry(2010)];
    expect(isValidPlacement(timeline, 1, entry(1980))).toBe(false);
  });

  it('rejects a slot where the candidate is later than the right neighbor', () => {
    const timeline = [entry(1990), entry(2010)];
    expect(isValidPlacement(timeline, 1, entry(2020))).toBe(false);
  });

  it('accepts the leftmost slot (no left neighbor) when the candidate is early enough', () => {
    const timeline = [entry(1990), entry(2010)];
    expect(isValidPlacement(timeline, 0, entry(1980))).toBe(true);
  });

  it('rejects the leftmost slot when the candidate is later than the first entry', () => {
    const timeline = [entry(1990), entry(2010)];
    expect(isValidPlacement(timeline, 0, entry(2000))).toBe(false);
  });

  it('accepts the rightmost slot (no right neighbor) when the candidate is late enough', () => {
    const timeline = [entry(1990), entry(2010)];
    expect(isValidPlacement(timeline, 2, entry(2020))).toBe(true);
  });

  it('treats a tie year as valid on either side of the matching boundary', () => {
    const timeline = [entry(1990), entry(2010)];
    // Same year as the right neighbor — valid whether placed just before or
    // (per the next test) effectively at that same boundary.
    expect(isValidPlacement(timeline, 1, entry(2010, 'dup-a'))).toBe(true);
    expect(isValidPlacement(timeline, 0, entry(1990, 'dup-b'))).toBe(true);
  });

  it('accepts any slot on an empty timeline', () => {
    expect(isValidPlacement([], 0, entry(2000))).toBe(true);
  });

  it('rejects a candidate with no derivable year', () => {
    const timeline = [entry(1990)];
    const noYear = { dbKey: 'x', movie: { release_date: null } };
    expect(isValidPlacement(timeline, 0, noYear)).toBe(false);
  });
});

describe('insertAtSlot', () => {
  it('inserts the candidate at the given index without mutating the input', () => {
    const timeline = [entry(1990), entry(2010)];
    const result = insertAtSlot(timeline, 1, entry(2000));
    expect(result.map((e) => e.dbKey)).toEqual(['1990', '2000', '2010']);
    expect(timeline).toHaveLength(2);
  });

  it('inserts at the front and back correctly', () => {
    const timeline = [entry(2000)];
    expect(insertAtSlot(timeline, 0, entry(1990)).map((e) => e.dbKey)).toEqual(['1990', '2000']);
    expect(insertAtSlot(timeline, 1, entry(2010)).map((e) => e.dbKey)).toEqual(['2000', '2010']);
  });
});

describe('correctSlotIndex', () => {
  it('finds the single valid slot for a candidate strictly between two entries', () => {
    const timeline = [entry(1990), entry(2010)];
    expect(correctSlotIndex(timeline, entry(2000))).toBe(1);
  });

  it('finds slot 0 when the candidate belongs before everything', () => {
    const timeline = [entry(1990), entry(2010)];
    expect(correctSlotIndex(timeline, entry(1980))).toBe(0);
  });

  it('finds the last slot when the candidate belongs after everything', () => {
    const timeline = [entry(1990), entry(2010)];
    expect(correctSlotIndex(timeline, entry(2020))).toBe(2);
  });

  it('returns null when the candidate has no derivable year', () => {
    const timeline = [entry(1990)];
    expect(correctSlotIndex(timeline, { dbKey: 'x', movie: {} })).toBeNull();
  });
});

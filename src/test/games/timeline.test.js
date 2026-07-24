import { describe, it, expect } from 'vitest';
import { isValidPlacement, insertAtSlot, correctSlotIndex, formatTimelineDate } from '@/assets/javascript/games/timeline.js';

// Mid-month release dates throughout — see CLAUDE.md's documented test
// pitfall: new Date('YYYY-01-01') parses as UTC midnight and can shift to
// the previous year in this repo's negative-UTC-offset test environment.
function entry (year, dbKey = String(year)) {
  return { dbKey, movie: { release_date: `${year}-06-15` } };
}

// formatTimelineDate parses release_date by string, not new Date(...), so
// it doesn't share entry()'s UTC-rollover pitfall — but real day-1 dates
// are exactly the case worth exercising here (see formatTimelineDate's own
// comment), so this helper allows a full explicit date, unlike entry().
function dateEntry (dbKey, releaseDate) {
  return { dbKey, movie: { release_date: releaseDate } };
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

describe('formatTimelineDate (bug report: "if you have two from the same year they should also include their month... if two from the same month, also include the day")', () => {
  it('shows just the year when it\'s unique among the timeline\'s other entries', () => {
    const a = dateEntry('a', '1994-06-15');
    const b = dateEntry('b', '2010-03-02');
    expect(formatTimelineDate(a, [a, b])).toBe('1994');
    expect(formatTimelineDate(b, [a, b])).toBe('2010');
  });

  it('escalates BOTH entries sharing a year to month precision, symmetrically', () => {
    const a = dateEntry('a', '1994-03-10');
    const b = dateEntry('b', '1994-11-02');
    expect(formatTimelineDate(a, [a, b])).toBe('Mar 1994');
    expect(formatTimelineDate(b, [a, b])).toBe('Nov 1994');
  });

  it('escalates further to day precision only for entries that ALSO share the month', () => {
    const a = dateEntry('a', '1994-03-10');
    const b = dateEntry('b', '1994-03-25');
    expect(formatTimelineDate(a, [a, b])).toBe('Mar 10, 1994');
    expect(formatTimelineDate(b, [a, b])).toBe('Mar 25, 1994');
  });

  it('a third, different-year entry in the timeline does not affect an unrelated tied pair', () => {
    const a = dateEntry('a', '1994-03-10');
    const b = dateEntry('b', '1994-11-02');
    const c = dateEntry('c', '2005-07-01');
    expect(formatTimelineDate(a, [a, b, c])).toBe('Mar 1994');
    expect(formatTimelineDate(c, [a, b, c])).toBe('2005');
  });

  it('does not compare an entry against itself', () => {
    const a = dateEntry('a', '1994-03-10');
    expect(formatTimelineDate(a, [a])).toBe('1994');
  });

  it('correctly reads a day-1 release date (the new Date(...) UTC-rollover pitfall this avoids)', () => {
    const a = dateEntry('a', '1994-01-01');
    const b = dateEntry('b', '1994-06-15');
    expect(formatTimelineDate(a, [a, b])).toBe('Jan 1994');
  });

  it('returns null for a missing or malformed release date', () => {
    expect(formatTimelineDate({ dbKey: 'x', movie: {} }, [])).toBeNull();
    expect(formatTimelineDate({ dbKey: 'x', movie: { release_date: null } }, [])).toBeNull();
  });

  it('tolerates a missing timeline argument', () => {
    const a = dateEntry('a', '1994-03-10');
    expect(formatTimelineDate(a, undefined)).toBe('1994');
  });
});

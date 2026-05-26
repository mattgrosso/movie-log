import { describe, it, expect } from 'vitest';
import { pickEligibleAwardsYear } from '@/utils/awards.js';

describe('pickEligibleAwardsYear', () => {
  const today = 'Tue May 26 2026';

  it('returns null when no incomplete years', () => {
    expect(pickEligibleAwardsYear({
      incompleteYears: [],
      personalAwards: {},
      todayString: today
    })).toBe(null);
  });

  it('returns null when incompleteYears is missing or non-array', () => {
    expect(pickEligibleAwardsYear({ incompleteYears: undefined, todayString: today })).toBe(null);
    expect(pickEligibleAwardsYear({ incompleteYears: null, todayString: today })).toBe(null);
  });

  it('returns selectedYearProp when provided, regardless of other state', () => {
    expect(pickEligibleAwardsYear({
      selectedYearProp: 1999,
      incompleteYears: [2002, 2010],
      personalAwards: {},
      dailyAwardsYear: 2010,
      dailyAwardsYearDate: today,
      todayString: today
    })).toBe(1999);
  });

  it('keeps dailyAwardsYear sticky when set today and still incomplete', () => {
    expect(pickEligibleAwardsYear({
      incompleteYears: [1989, 2002, 2010],
      personalAwards: { 2002: { completed: false, categories: {} } },
      dailyAwardsYear: 2002,
      dailyAwardsYearDate: today,
      todayString: today
    })).toBe(2002);
  });

  it('ignores stale dailyAwardsYear from a different day', () => {
    expect(pickEligibleAwardsYear({
      incompleteYears: [1989, 2002],
      personalAwards: {},
      dailyAwardsYear: 2002,
      dailyAwardsYearDate: 'Mon May 25 2026',
      todayString: today
    })).toBe(1989); // oldest incomplete
  });

  it('ignores dailyAwardsYear if that year was completed', () => {
    expect(pickEligibleAwardsYear({
      incompleteYears: [1989, 2010],
      personalAwards: { 2002: { completed: true } },
      dailyAwardsYear: 2002,
      dailyAwardsYearDate: today,
      todayString: today
    })).toBe(1989);
  });

  it('ignores dailyAwardsYear if no longer in incompleteYears (already done)', () => {
    expect(pickEligibleAwardsYear({
      incompleteYears: [1989, 2010],
      personalAwards: {},
      dailyAwardsYear: 2002,
      dailyAwardsYearDate: today,
      todayString: today
    })).toBe(1989);
  });

  it('prefers years with partial progress over fresh ones', () => {
    const personalAwards = {
      1989: { completed: false, categories: {} }, // no progress
      2002: {
        completed: false,
        categories: {
          bestPicture: { nominees: ['movie-a'] }
        }
      }
    };
    expect(pickEligibleAwardsYear({
      incompleteYears: [1989, 2002, 2010],
      personalAwards,
      todayString: today
    })).toBe(2002);
  });

  it('picks the oldest year among those with partial progress', () => {
    const personalAwards = {
      1989: { completed: false, categories: { bestPicture: { winner: 'movie-a' } } },
      2002: { completed: false, categories: { bestPicture: { nominees: ['movie-b'] } } }
    };
    expect(pickEligibleAwardsYear({
      incompleteYears: [1989, 2002, 2010],
      personalAwards,
      todayString: today
    })).toBe(1989);
  });

  it('recognizes noNominees as partial progress', () => {
    const personalAwards = {
      2002: {
        completed: false,
        categories: { bestPicture: { noNominees: true } }
      }
    };
    expect(pickEligibleAwardsYear({
      incompleteYears: [1989, 2002],
      personalAwards,
      todayString: today
    })).toBe(2002);
  });

  it('falls back to oldest incomplete year when no partial progress anywhere', () => {
    expect(pickEligibleAwardsYear({
      incompleteYears: [2002, 1989, 2010],
      personalAwards: {},
      todayString: today
    })).toBe(1989);
  });

  it('is deterministic — same inputs always produce same output', () => {
    const args = {
      incompleteYears: [2002, 1989, 2010, 1995],
      personalAwards: {
        2002: { completed: false, categories: { bestPicture: { nominees: ['x'] } } },
        1995: { completed: false, categories: { bestPicture: { nominees: ['y'] } } }
      },
      todayString: today
    };
    const first = pickEligibleAwardsYear(args);
    for (let i = 0; i < 50; i++) {
      expect(pickEligibleAwardsYear(args)).toBe(first);
    }
  });

  it('does not mutate incompleteYears input', () => {
    const incompleteYears = [2002, 1989, 2010];
    const before = [...incompleteYears];
    pickEligibleAwardsYear({ incompleteYears, personalAwards: {}, todayString: today });
    expect(incompleteYears).toEqual(before);
  });
});

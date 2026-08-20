import { describe, it, expect } from 'vitest';
import {
  customAwardKey,
  isCustomAwardKey,
  customCategoriesForYear,
  categoriesForYear,
  awardCategoryNameMap,
  PERSONAL_AWARD_CATEGORIES
} from '@/assets/javascript/personalAwardsCategories.js';

// Feature request, 2026-08-20: "It would be cool if for any given personal
// awards here, I could add custom awards. So if I wanted to, I can name an
// award whatever I want and then assign it. So I can basically hand out
// honorary awards."

describe('customAwardKey', () => {
  it('slugifies a name into a Firebase-safe key', () => {
    expect(customAwardKey('Best Needle Drop')).toBe('custom-best-needle-drop');
  });

  // Firebase forbids . $ # [ ] / in a key. Emitting only [a-z0-9-] means the
  // question never arises, whatever someone types.
  it('emits nothing Firebase forbids, however punctuated the name', () => {
    const key = customAwardKey('Best "Wait... WHAT?!" Moment #1 [2026] / 50% of it');

    expect(key).toMatch(/^custom-[a-z0-9-]+$/);
    ['.', '$', '#', '[', ']', '/'].forEach((bad) => expect(key).not.toContain(bad));
  });

  // The reason it's slug-derived rather than timestamped: reusing a name next
  // year produces the same key, so the Trophy Case can aggregate it across
  // years the way it does a standard category.
  it('gives the same name the same key every time, so years aggregate', () => {
    expect(customAwardKey('Best Needle Drop')).toBe(customAwardKey('  best   NEEDLE drop  '));
  });

  it('is null for a name with nothing sluggable in it, rather than a bare prefix', () => {
    expect(customAwardKey('!!!')).toBeNull();
    expect(customAwardKey('   ')).toBeNull();
    expect(customAwardKey('')).toBeNull();
    expect(customAwardKey(null)).toBeNull();
    expect(customAwardKey(undefined)).toBeNull();
  });

  it('never collides with a standard category key', () => {
    PERSONAL_AWARD_CATEGORIES.forEach((category) => {
      expect(isCustomAwardKey(category.key)).toBe(false);
    });
    expect(isCustomAwardKey(customAwardKey('Best Picture'))).toBe(true);
  });
});

describe('customCategoriesForYear', () => {
  const yearAwards = {
    customCategories: {
      'custom-b': { name: 'Second Added', createdAt: 200 },
      'custom-a': { name: 'First Added', createdAt: 100 }
    }
  };

  it('lists them oldest first, so the list does not reshuffle as they are added', () => {
    expect(customCategoriesForYear(yearAwards).map((c) => c.name)).toEqual(['First Added', 'Second Added']);
  });

  it('marks them as custom, movie-type — the pool is that year is films', () => {
    const [first] = customCategoriesForYear(yearAwards);

    expect(first).toMatchObject({ key: 'custom-a', name: 'First Added', type: 'movie', custom: true });
  });

  it('skips a record with no name rather than rendering a blank row', () => {
    const broken = { customCategories: { 'custom-x': { createdAt: 1 }, 'custom-y': { name: 'Fine' } } };

    expect(customCategoriesForYear(broken).map((c) => c.name)).toEqual(['Fine']);
  });

  it('falls back to a stable order when createdAt is missing on both', () => {
    const undated = { customCategories: { 'custom-z': { name: 'Zebra' }, 'custom-a': { name: 'Apple' } } };

    expect(customCategoriesForYear(undated).map((c) => c.name)).toEqual(['Apple', 'Zebra']);
  });

  it('is null-safe and empty for a year with none', () => {
    expect(customCategoriesForYear(null)).toEqual([]);
    expect(customCategoriesForYear({})).toEqual([]);
    expect(customCategoriesForYear({ categories: {} })).toEqual([]);
  });
});

describe('categoriesForYear', () => {
  it('keeps every standard category, in order, and appends the custom ones', () => {
    const list = categoriesForYear({ customCategories: { 'custom-a': { name: 'Honorary', createdAt: 1 } } });

    expect(list).toHaveLength(PERSONAL_AWARD_CATEGORIES.length + 1);
    expect(list.slice(0, PERSONAL_AWARD_CATEGORIES.length).map((c) => c.key))
      .toEqual(PERSONAL_AWARD_CATEGORIES.map((c) => c.key));
    expect(list.at(-1)).toMatchObject({ name: 'Honorary', custom: true });
  });

  it('is exactly the standard list for a year with no custom awards', () => {
    expect(categoriesForYear(null).map((c) => c.key)).toEqual(PERSONAL_AWARD_CATEGORIES.map((c) => c.key));
  });

  // Nothing downstream should have to ask "is this one of the built-ins?"
  it('tags the standard ones as not custom, so callers can branch on one field', () => {
    expect(categoriesForYear(null).every((c) => c.custom === false)).toBe(true);
  });
});

describe('awardCategoryNameMap', () => {
  const personalAwards = {
    2019: { customCategories: { 'custom-needle': { name: 'Best Needle Drop' } } },
    2026: { customCategories: { 'custom-cry': { name: 'Made Me Cry Hardest' } } }
  };

  it('resolves standard and custom names together', () => {
    const names = awardCategoryNameMap(personalAwards);

    expect(names.bestPicture).toBe('Best Picture');
    expect(names['custom-needle']).toBe('Best Needle Drop');
    expect(names['custom-cry']).toBe('Made Me Cry Hardest');
  });

  // The Trophy Case aggregates a category across years and a movie's award
  // history walks every year at once, so a 2019-only award still has to
  // render by name years later.
  it('covers every year at once, not just the one being viewed', () => {
    expect(Object.keys(awardCategoryNameMap(personalAwards))).toContain('custom-needle');
    expect(Object.keys(awardCategoryNameMap(personalAwards))).toContain('custom-cry');
  });

  it('is null-safe and still knows the standard names', () => {
    expect(awardCategoryNameMap(null).bestDirector).toBe('Best Director');
    expect(awardCategoryNameMap({}).bestDirector).toBe('Best Director');
  });
});

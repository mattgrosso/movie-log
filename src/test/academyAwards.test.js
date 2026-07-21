import { describe, it, expect } from 'vitest';
import { sortByAcademyCategoryOrder, ACADEMY_CATEGORY_ORDER } from '@/assets/javascript/academyAwards.js';

describe('sortByAcademyCategoryOrder', () => {
  it('orders known categories by ACADEMY_CATEGORY_ORDER regardless of input order', () => {
    const awards = [
      { category: 'Best Sound Mixing' },
      { category: 'Best Picture' },
      { category: 'Best Actor' }
    ];
    const sorted = sortByAcademyCategoryOrder(awards);
    expect(sorted.map((a) => a.category)).toEqual(['Best Picture', 'Best Actor', 'Best Sound Mixing']);
  });

  it('is case-insensitive', () => {
    const awards = [{ category: 'BEST PICTURE' }, { category: 'best actor' }];
    const sorted = sortByAcademyCategoryOrder(awards);
    expect(sorted[0].category).toBe('BEST PICTURE');
  });

  it('pushes unknown categories to the end without throwing', () => {
    const awards = [{ category: 'Some Made Up Category' }, { category: 'Best Picture' }];
    const sorted = sortByAcademyCategoryOrder(awards);
    expect(sorted[0].category).toBe('Best Picture');
    expect(sorted[1].category).toBe('Some Made Up Category');
  });

  it('does not mutate the input array', () => {
    const awards = [{ category: 'Best Actor' }, { category: 'Best Picture' }];
    const original = [...awards];
    sortByAcademyCategoryOrder(awards);
    expect(awards).toEqual(original);
  });

  it('includes both current and retired-era category names (real-world data spans many decades)', () => {
    expect(ACADEMY_CATEGORY_ORDER).toContain('Best International Feature Film');
    expect(ACADEMY_CATEGORY_ORDER).toContain('Best Foreign Language Film');
    expect(ACADEMY_CATEGORY_ORDER).toContain('Best Title Writing');
  });
});

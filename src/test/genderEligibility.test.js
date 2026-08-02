import { describe, it, expect } from 'vitest';
import { isEligibleForActingCategory, TMDB_GENDER } from '@/assets/javascript/genderEligibility.js';

const actress = { isActress: true };
const actor = { isActress: false };

describe('isEligibleForActingCategory', () => {
  it('matches a definite female reading to actress categories only', () => {
    expect(isEligibleForActingCategory(TMDB_GENDER.FEMALE, actress)).toBe(true);
    expect(isEligibleForActingCategory(TMDB_GENDER.FEMALE, actor)).toBe(false);
  });

  it('matches a definite male reading to actor categories only', () => {
    expect(isEligibleForActingCategory(TMDB_GENDER.MALE, actor)).toBe(true);
    expect(isEligibleForActingCategory(TMDB_GENDER.MALE, actress)).toBe(false);
  });

  // "If you're unsure about gender go ahead and count them as all genders."
  it('counts a non-binary person for every acting category', () => {
    expect(isEligibleForActingCategory(TMDB_GENDER.NON_BINARY, actress)).toBe(true);
    expect(isEligibleForActingCategory(TMDB_GENDER.NON_BINARY, actor)).toBe(true);
  });

  // The regression: TMDB gender 0 used to be excluded from BOTH categories
  // on one of the two (duplicated) code paths, making those people
  // impossible to nominate anywhere - with no way to notice it happened.
  it('counts a "not specified" person for every acting category', () => {
    expect(isEligibleForActingCategory(TMDB_GENDER.NOT_SPECIFIED, actress)).toBe(true);
    expect(isEligibleForActingCategory(TMDB_GENDER.NOT_SPECIFIED, actor)).toBe(true);
  });

  it('counts a person for every category when gender is missing entirely', () => {
    [undefined, null, 'female', NaN].forEach((value) => {
      expect(isEligibleForActingCategory(value, actress)).toBe(true);
      expect(isEligibleForActingCategory(value, actor)).toBe(true);
    });
  });

  it('defaults to the actor side when no options are passed', () => {
    expect(isEligibleForActingCategory(TMDB_GENDER.MALE)).toBe(true);
    expect(isEligibleForActingCategory(TMDB_GENDER.FEMALE)).toBe(false);
  });
});

// The kind registry: one entry per chip kind, consumed everywhere.
//
// The matcher bodies themselves are exercised exhaustively through
// applyFilter's existing suites (searchFiltering, ChipFiltering); what this
// file guards is the registry's SHAPE — that every kind declares the whole
// contract, and that the two consumers (applyFilter, partitionFilters)
// genuinely read it rather than keeping private copies of the knowledge.
import { describe, it, expect } from 'vitest';
import { FILTER_KINDS, kindFor, getListOfYearsFromRange } from '../assets/javascript/filterKinds.js';
import { applyFilter, buildSearchFields } from '../assets/javascript/searchFiltering.js';
import { partitionFilters } from '../assets/javascript/moreFromQuery.js';

const VALID_GROUPS = ['genres', 'people', 'companies', 'keywords', 'years', 'ranges', 'texts', 'local'];

describe('the registry contract', () => {
  it('every kind declares a matcher and a discover group', () => {
    Object.entries(FILTER_KINDS).forEach(([type, kind]) => {
      expect(typeof kind.matchLocal, `${type}.matchLocal`).toBe('function');
      expect(VALID_GROUPS, `${type}.discoverGroup`).toContain(kind.discoverGroup);
    });
  });

  it('covers every chip type the app creates', () => {
    // Home.vue's filterTypes list, plus the specific crew types MovieDetail
    // links create. A type missing here silently matches nothing.
    ['general', 'person', 'year', 'yearRange', 'genre', 'company', 'keyword', 'tag',
      'title', 'director', 'producer', 'cast'].forEach((type) => {
      expect(kindFor(type), type).not.toBeNull();
    });
  });

  it('returns null, not a crash, for a type nothing defines', () => {
    expect(kindFor('nonsense')).toBeNull();
    expect(kindFor(undefined)).toBeNull();
  });
});

describe('consumers read the registry', () => {
  const movie = {
    title: 'Arrival',
    release_date: '2016-11-11',
    genres: [{ name: 'Science Fiction' }],
    cast: [{ name: 'Amy Adams' }],
    crew: [{ name: 'Denis Villeneuve', job: 'Director' }],
    production_companies: [{ name: 'FilmNation Entertainment' }],
    flatKeywords: ['alien']
  };
  const result = { movie, ratings: [{ tags: [{ title: 'rewatch' }] }] };

  it('applyFilter delegates to the kind matcher', () => {
    expect(applyFilter(result, { type: 'genre', value: 'science fiction' })).toBe(true);
    expect(applyFilter(result, { type: 'tag', value: 'Rewatch' })).toBe(true);
    expect(applyFilter(result, { type: 'unknown-kind', value: 'x' })).toBe(false);
  });

  it('a registry matcher and applyFilter agree, given the same fields', () => {
    const s = buildSearchFields(movie);
    const filter = { type: 'person', value: 'Villeneuve' };

    expect(FILTER_KINDS.person.matchLocal(result, filter, s))
      .toBe(applyFilter(result, filter));
  });

  it('partitionFilters slots each chip by its declared group', () => {
    const groups = partitionFilters([
      { type: 'genre', value: 'Horror' },
      { type: 'person', value: 'Sofia Coppola' },
      { type: 'general', value: 'spiderman' },
      { type: 'tag', value: 'rewatch' },
      { type: 'producer', value: 'Kathleen Kennedy' }
    ]);

    expect(groups.genres).toHaveLength(1);
    expect(groups.people).toHaveLength(1);
    expect(groups.texts).toHaveLength(1);
    // tag AND producer are local: a producer chip filters the library by
    // crew job, which /discover's with_people cannot express faithfully.
    expect(groups.local).toHaveLength(2);
  });

  it('an unknown chip type narrows nothing remotely — conservative, never widening', () => {
    const groups = partitionFilters([{ type: 'future-kind', value: 'x' }]);
    expect(groups.local).toHaveLength(1);
  });
});

describe('getListOfYearsFromRange (moved here with the yearRange kind)', () => {
  it('lists the years inclusively', () => {
    expect(getListOfYearsFromRange({ startYear: 1994, endYear: 1996 })).toEqual(['1994', '1995', '1996']);
  });

  it('returns nothing for a malformed range', () => {
    expect(getListOfYearsFromRange(null)).toEqual([]);
    expect(getListOfYearsFromRange({ startYear: 1994 })).toEqual([]);
  });
});

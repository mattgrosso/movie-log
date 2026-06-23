import { describe, it, expect } from 'vitest';
import {
  uniqueViewingTags,
  buildTagSuggestions,
  canCreateNewTag,
  countViewingTagUsage,
  sortVocabularyByUsage
} from '@/utils/tags.js';

describe('uniqueViewingTags', () => {
  it('returns empty array for missing / non-array input', () => {
    expect(uniqueViewingTags(undefined)).toEqual([]);
    expect(uniqueViewingTags(null)).toEqual([]);
    expect(uniqueViewingTags({})).toEqual([]);
  });

  it('collects titles across multiple ratings', () => {
    const ratings = [
      { tags: [{ title: 'rewatch' }, { title: 'theater' }] },
      { tags: [{ title: 'with friends' }] }
    ];
    expect(uniqueViewingTags(ratings)).toEqual(['rewatch', 'theater', 'with friends']);
  });

  it('de-duplicates tags shared by multiple ratings', () => {
    const ratings = [
      { tags: [{ title: 'rewatch' }, { title: 'theater' }] },
      { tags: [{ title: 'rewatch' }] }
    ];
    expect(uniqueViewingTags(ratings)).toEqual(['rewatch', 'theater']);
  });

  it('skips ratings with no tags and tag entries with no title', () => {
    const ratings = [
      { tags: [] },
      {},
      { tags: [{ title: null }, { title: '' }, { title: 'kept' }] }
    ];
    expect(uniqueViewingTags(ratings)).toEqual(['kept']);
  });
});

describe('buildTagSuggestions', () => {
  const globalTagCounts = { rewatch: 12, theater: 5, 'with friends': 3, 'date night': 1 };
  const vocabularyTitles = ['rewatch', 'theater', 'with friends', 'date night', 'documentary'];

  it('returns empty array when query is empty / whitespace', () => {
    expect(buildTagSuggestions({ query: '', alreadyOnViewing: [], globalTagCounts, vocabularyTitles })).toEqual([]);
    expect(buildTagSuggestions({ query: '   ', alreadyOnViewing: [], globalTagCounts, vocabularyTitles })).toEqual([]);
  });

  it('matches case-insensitively and sorts by global count desc', () => {
    const counts = { rewatch: 12, rewatchable: 4, 'first watch': 9 };
    const results = buildTagSuggestions({
      query: 'WATCH',
      alreadyOnViewing: [],
      globalTagCounts: counts,
      vocabularyTitles: []
    });
    expect(results.map((r) => r.name)).toEqual(['rewatch', 'first watch', 'rewatchable']);
    expect(results[0].count).toBe(12);
  });

  it('excludes tags already on the current viewing', () => {
    const counts = { rewatch: 12, 'first watch': 9 };
    const results = buildTagSuggestions({
      query: 'watch',
      alreadyOnViewing: ['rewatch'],
      globalTagCounts: counts,
      vocabularyTitles: []
    });
    expect(results.map((r) => r.name)).toEqual(['first watch']);
  });

  it('includes vocabulary tags that have never been used (count 0)', () => {
    const results = buildTagSuggestions({
      query: 'doc',
      alreadyOnViewing: [],
      globalTagCounts,
      vocabularyTitles
    });
    expect(results).toEqual([{ name: 'documentary', count: 0 }]);
  });

  it('does not double-count when a tag appears in both counts and vocabulary', () => {
    const results = buildTagSuggestions({
      query: 'rewatch',
      alreadyOnViewing: [],
      globalTagCounts,
      vocabularyTitles
    });
    expect(results.length).toBe(1);
    expect(results[0]).toEqual({ name: 'rewatch', count: 12 });
  });

  it('caps results at 10', () => {
    const counts = {};
    for (let i = 0; i < 20; i++) counts[`tag${i}`] = 20 - i;
    const results = buildTagSuggestions({ query: 'tag', alreadyOnViewing: [], globalTagCounts: counts, vocabularyTitles: [] });
    expect(results.length).toBe(10);
  });
});

describe('canCreateNewTag', () => {
  const globalTagCounts = { rewatch: 12 };
  const vocabularyTitles = ['rewatch', 'documentary'];

  it('returns false for empty / whitespace input', () => {
    expect(canCreateNewTag({ query: '', alreadyOnViewing: [], globalTagCounts, vocabularyTitles })).toBe(false);
    expect(canCreateNewTag({ query: '   ', alreadyOnViewing: [], globalTagCounts, vocabularyTitles })).toBe(false);
  });

  it('returns false when input matches an existing tag (any case) in counts or vocabulary', () => {
    expect(canCreateNewTag({ query: 'rewatch', alreadyOnViewing: [], globalTagCounts, vocabularyTitles })).toBe(false);
    expect(canCreateNewTag({ query: 'Documentary', alreadyOnViewing: [], globalTagCounts, vocabularyTitles })).toBe(false);
  });

  it('returns false when tag is already on the current viewing', () => {
    expect(canCreateNewTag({ query: 'new-one', alreadyOnViewing: ['new-one'], globalTagCounts, vocabularyTitles })).toBe(false);
  });

  it('returns true for genuinely new tags', () => {
    expect(canCreateNewTag({ query: 'brand new', alreadyOnViewing: [], globalTagCounts, vocabularyTitles })).toBe(true);
  });
});

describe('countViewingTagUsage', () => {
  it('returns empty object for missing / non-array input', () => {
    expect(countViewingTagUsage(undefined)).toEqual({});
    expect(countViewingTagUsage(null)).toEqual({});
    expect(countViewingTagUsage({})).toEqual({});
  });

  it('counts each tag once per rating it appears on', () => {
    const movies = [
      { ratings: [{ tags: [{ title: 'rewatch' }, { title: 'theater' }] }] },
      { ratings: [{ tags: [{ title: 'rewatch' }] }, { tags: [{ title: 'rewatch' }] }] },
      { ratings: [{ tags: [{ title: 'with friends' }] }] }
    ];
    expect(countViewingTagUsage(movies)).toEqual({
      rewatch: 3,
      theater: 1,
      'with friends': 1
    });
  });

  it('handles ratings without tags and entries without ratings', () => {
    const movies = [
      {},
      { ratings: [] },
      { ratings: [{}, { tags: [] }, { tags: [{ title: 'kept' }] }] }
    ];
    expect(countViewingTagUsage(movies)).toEqual({ kept: 1 });
  });

  it('skips tag entries with empty / missing titles', () => {
    const movies = [
      { ratings: [{ tags: [{ title: null }, { title: '' }, {}, { title: 'real' }] }] }
    ];
    expect(countViewingTagUsage(movies)).toEqual({ real: 1 });
  });
});

describe('sortVocabularyByUsage', () => {
  it('returns empty array for non-array vocabulary', () => {
    expect(sortVocabularyByUsage(undefined, {})).toEqual([]);
    expect(sortVocabularyByUsage(null, {})).toEqual([]);
  });

  it('sorts by usage count desc', () => {
    const vocabulary = [
      { title: 'a-low' },
      { title: 'z-high' },
      { title: 'm-mid' }
    ];
    const counts = { 'a-low': 1, 'z-high': 10, 'm-mid': 5 };
    expect(sortVocabularyByUsage(vocabulary, counts).map((t) => t.title)).toEqual(['z-high', 'm-mid', 'a-low']);
  });

  it('breaks ties alphabetically', () => {
    const vocabulary = [
      { title: 'charlie' },
      { title: 'alpha' },
      { title: 'bravo' }
    ];
    const counts = { charlie: 3, alpha: 3, bravo: 3 };
    expect(sortVocabularyByUsage(vocabulary, counts).map((t) => t.title)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('puts unused tags (count 0) at the bottom, alpha-sorted', () => {
    const vocabulary = [
      { title: 'never-used-b' },
      { title: 'used' },
      { title: 'never-used-a' }
    ];
    const counts = { used: 4 };
    expect(sortVocabularyByUsage(vocabulary, counts).map((t) => t.title)).toEqual(['used', 'never-used-a', 'never-used-b']);
  });

  it('does not mutate the input array', () => {
    const vocabulary = [{ title: 'b' }, { title: 'a' }];
    const counts = { a: 2, b: 1 };
    const before = vocabulary.map((t) => t.title);
    sortVocabularyByUsage(vocabulary, counts);
    expect(vocabulary.map((t) => t.title)).toEqual(before);
  });

  it('handles missing counts object', () => {
    const vocabulary = [{ title: 'b' }, { title: 'a' }];
    expect(sortVocabularyByUsage(vocabulary, undefined).map((t) => t.title)).toEqual(['a', 'b']);
  });
});

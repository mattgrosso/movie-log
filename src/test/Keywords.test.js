import { describe, it, expect } from 'vitest';
import { computeFlatKeywords } from '@/utils/keywords.js';

describe('computeFlatKeywords', () => {
  it('returns empty array when movie is null/undefined', () => {
    expect(computeFlatKeywords(null)).toEqual([]);
    expect(computeFlatKeywords(undefined)).toEqual([]);
  });

  it('returns empty array when movie has no keyword fields', () => {
    expect(computeFlatKeywords({})).toEqual([]);
  });

  it('flattens TMDB keyword objects to names', () => {
    const movie = {
      keywords: [{ id: 1, name: 'heist' }, { id: 2, name: 'noir' }]
    };
    expect(computeFlatKeywords(movie)).toEqual(['heist', 'noir']);
  });

  it('includes chatGPTKeywords alongside TMDB keywords', () => {
    const movie = {
      keywords: [{ id: 1, name: 'heist' }],
      chatGPTKeywords: ['stylish', 'twist ending']
    };
    expect(computeFlatKeywords(movie)).toEqual(['heist', 'stylish', 'twist ending']);
  });

  it('includes customKeywords', () => {
    const movie = {
      keywords: [{ id: 1, name: 'heist' }],
      chatGPTKeywords: ['stylish'],
      customKeywords: ['rewatch-worthy']
    };
    expect(computeFlatKeywords(movie)).toEqual(['heist', 'stylish', 'rewatch-worthy']);
  });

  it('de-duplicates keywords that appear in multiple source arrays', () => {
    const movie = {
      keywords: [{ id: 1, name: 'heist' }],
      chatGPTKeywords: ['heist', 'stylish'],
      customKeywords: ['stylish', 'rewatch-worthy']
    };
    expect(computeFlatKeywords(movie)).toEqual(['heist', 'stylish', 'rewatch-worthy']);
  });

  it('filters out removedKeywords from the display list', () => {
    const movie = {
      keywords: [{ id: 1, name: 'heist' }, { id: 2, name: 'noir' }],
      chatGPTKeywords: ['stylish'],
      customKeywords: ['rewatch-worthy'],
      removedKeywords: ['noir', 'stylish']
    };
    expect(computeFlatKeywords(movie)).toEqual(['heist', 'rewatch-worthy']);
  });

  it('preserves removedKeywords even when source arrays are empty', () => {
    // Removing a keyword should be a no-op if the source data no longer surfaces it
    const movie = {
      keywords: [],
      chatGPTKeywords: [],
      customKeywords: [],
      removedKeywords: ['noir']
    };
    expect(computeFlatKeywords(movie)).toEqual([]);
  });

  it('does not mutate the source movie object', () => {
    const movie = {
      keywords: [{ id: 1, name: 'heist' }],
      chatGPTKeywords: ['stylish'],
      customKeywords: ['rewatch-worthy'],
      removedKeywords: ['stylish']
    };
    const before = JSON.stringify(movie);
    computeFlatKeywords(movie);
    expect(JSON.stringify(movie)).toBe(before);
  });

  it('handles missing keywords arrays without throwing', () => {
    expect(computeFlatKeywords({ customKeywords: ['only-custom'] })).toEqual(['only-custom']);
    expect(computeFlatKeywords({ chatGPTKeywords: ['only-ai'] })).toEqual(['only-ai']);
    expect(computeFlatKeywords({ removedKeywords: ['ignored'] })).toEqual([]);
  });
});

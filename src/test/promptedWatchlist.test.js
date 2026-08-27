import { describe, it, expect } from 'vitest';
import { tasteSummary, pickTmdbMatch, buildPromptedList } from '../assets/javascript/promptedWatchlist.js';

// The pure half of "give it a prompt, get a watchlist" (bug report
// 2026-08-27). The component does the fetching; everything worth being sure
// about is here.

const entry = (id, score, genres, year) => ({
  id,
  movie: {
    id,
    genres: genres.map((name) => ({ name })),
    release_date: `${year}-01-01`
  },
  score
});

const rate = (e) => ({ calculatedTotal: e.score });

const many = (n, score, genres, year, offset = 0) =>
  Array.from({ length: n }, (_, i) => entry(offset + i, score, genres, year));

describe('tasteSummary', () => {
  it('says nothing at all for a library too small to mean anything', () => {
    // Four ratings is noise. A confident-sounding profile built from noise
    // would steer every suggestion for no reason.
    expect(tasteSummary(many(4, 9, ['Drama'], 1999), rate)).toBe('');
    expect(tasteSummary([], rate)).toBe('');
    expect(tasteSummary(null, rate)).toBe('');
  });

  it('names the genres rated above average, and the ones below', () => {
    const library = [
      ...many(6, 9, ['Horror'], 1980, 0),
      ...many(6, 4, ['Romance'], 1980, 100),
      ...many(6, 6.5, ['Drama'], 1980, 200)
    ];
    const summary = tasteSummary(library, rate);
    expect(summary).toContain('Horror');
    expect(summary).toMatch(/cooler on .*Romance/);
  });

  it('ignores a genre with too few ratings to judge', () => {
    // One 10/10 documentary is not a passion for documentaries.
    const library = [
      ...many(10, 6, ['Drama'], 1990, 0),
      entry(999, 10, ['Documentary'], 1990)
    ];
    expect(tasteSummary(library, rate)).not.toContain('Documentary');
  });

  it('always ends with the size and average, which is the honest part', () => {
    const summary = tasteSummary(many(20, 7.25, ['Drama'], 1995), rate);
    expect(summary).toContain('20 films rated');
    expect(summary).toContain('7.3');
  });

  it('stays short enough to be worth sending', () => {
    // The whole point is that this is hundreds of characters and the library
    // is tens of thousands of tokens. If it ever grows past a line or two,
    // the reason for the feature's design has quietly gone away.
    const big = [
      ...many(40, 9, ['Horror', 'Thriller'], 1975, 0),
      ...many(40, 4, ['Romance', 'Family'], 2015, 100),
      ...many(40, 7, ['Drama', 'Crime'], 1995, 200)
    ];
    expect(tasteSummary(big, rate).length).toBeLessThan(300);
  });

  it('survives entries with no genres or no date', () => {
    const odd = [
      ...many(6, 7, ['Drama'], 1990),
      { id: 90, movie: {}, score: 8 },
      { id: 91, score: 6 }
    ];
    expect(() => tasteSummary(odd, rate)).not.toThrow();
  });
});

describe('pickTmdbMatch', () => {
  const results = [
    { id: 1, title: 'The Thing', release_date: '1982-06-25' },
    { id: 2, title: 'The Thing', release_date: '2011-10-14' },
    { id: 3, title: 'Thing', release_date: '2000-01-01' }
  ];

  it('uses the year to tell two films of the same name apart', () => {
    // The whole reason the model is asked for a year.
    expect(pickTmdbMatch({ title: 'The Thing', year: 1982 }, results).id).toBe(1);
    expect(pickTmdbMatch({ title: 'The Thing', year: 2011 }, results).id).toBe(2);
  });

  it('allows a year off by one, since release years legitimately differ', () => {
    expect(pickTmdbMatch({ title: 'The Thing', year: 1983 }, results).id).toBe(1);
  });

  it('refuses a film it cannot match by name', () => {
    // TMDB's first result for a misspelling is usually right, and "usually"
    // is not good enough to put a different film on somebody's list.
    expect(pickTmdbMatch({ title: 'Th Thng', year: 1982 }, results)).toBeNull();
  });

  it('handles nothing to match against', () => {
    expect(pickTmdbMatch({ title: 'X' }, [])).toBeNull();
    expect(pickTmdbMatch({ title: '' }, results)).toBeNull();
    expect(pickTmdbMatch(null, results)).toBeNull();
  });
});

describe('buildPromptedList', () => {
  const suggestions = [
    { title: 'A', why: 'because A' },
    { title: 'B', why: 'because B' },
    { title: 'C', why: 'because C' }
  ];

  it('drops anything already rated', () => {
    const matches = [{ id: 10 }, { id: 20 }, { id: 30 }];
    const rows = buildPromptedList(suggestions, matches, new Set([20]));
    expect(rows.map((r) => r.id)).toEqual([10, 30]);
  });

  it('drops anything that did not resolve', () => {
    const rows = buildPromptedList(suggestions, [{ id: 10 }, null, { id: 30 }], new Set());
    expect(rows.map((r) => r.id)).toEqual([10, 30]);
  });

  it('keeps the reason, which is the only thing worth showing under a poster', () => {
    const rows = buildPromptedList(suggestions, [{ id: 10 }], new Set());
    expect(rows[0].note).toBe('because A');
  });

  it('de-duplicates when two suggestions resolve to the same film', () => {
    const rows = buildPromptedList(suggestions, [{ id: 10 }, { id: 10 }, { id: 30 }], new Set());
    expect(rows.map((r) => r.id)).toEqual([10, 30]);
  });

  it('preserves the order the model chose, which is its ranking', () => {
    const matches = [{ id: 10 }, { id: 20 }, { id: 30 }];
    expect(buildPromptedList(suggestions, matches, new Set()).map((r) => r.id))
      .toEqual([10, 20, 30]);
  });
});

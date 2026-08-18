// Typeahead for the main search bar (Matt, 2026-08-18: "we've added a lot of
// type ahead and fuzzy search features to our various inputs all over the
// app. Do you think it's something we could do to our main search input?").
//
// The rules that make it worth having: it offers the DIMENSIONS of your own
// library, ranked by how much of that library each one covers, and a tap
// carries the chip type that typing the same letters would not have found.
import { describe, it, expect } from 'vitest';
import {
  rankTypeahead,
  describeSuggestion,
  TYPEAHEAD_MIN_CHARS
} from '../assets/javascript/searchSuggestions.js';
import { normalizeSearchText } from '../assets/javascript/searchFiltering.js';

// The real index is the catalog's typeahead projection (see catalog.test.js
// for its construction and dedupe rules); rankTypeahead only requires
// entries carrying a precomputed norm and a count.
const indexFrom = (sources) => {
  const seen = new Set();
  const index = [];
  sources.forEach(({ counts, expectedType, kind }) => {
    Object.keys(counts || {}).forEach((value) => {
      const norm = normalizeSearchText(value);
      if (!norm || seen.has(norm)) return;
      seen.add(norm);
      index.push({ value, norm, count: counts[value] || 0, expectedType, kind });
    });
  });
  return index;
};

const library = () => indexFrom([
  { counts: { 'Denis Villeneuve': 6, 'Steven Spielberg': 11 }, expectedType: 'director', kind: 'director' },
  { counts: { Drama: 40, Comedy: 22, 'Science Fiction': 9 }, expectedType: 'genre', kind: 'genre' },
  { counts: { 'Amblin Entertainment': 8 }, expectedType: 'studios', kind: 'studio' },
  { counts: { 'Denis Villeneuve': 6, 'Amy Adams': 4, 'Liam Neeson': 3 }, expectedType: 'cast/crew', kind: 'cast' },
  { counts: { holocaust: 2, aliens: 5 }, expectedType: 'keyword', kind: 'keyword' }
]);

describe('rankTypeahead', () => {
  it('completes a partial name into the right typed suggestion', () => {
    const [top] = rankTypeahead(library(), 'villen');
    // Typing "villen" and stopping detects as `general` — a title search for
    // the letters. This is the whole reason the row exists.
    expect(top.value).toBe('Denis Villeneuve');
    expect(top.expectedType).toBe('director');
  });

  it('matches a surname mid-string, not just the start of the term', () => {
    const values = rankTypeahead(library(), 'spielberg').map((entry) => entry.value);
    expect(values).toContain('Steven Spielberg');
  });

  it('prefers a term that starts with what you typed over one that merely contains it', () => {
    const index = indexFrom([
      { counts: { Adventure: 3, 'Amy Adams': 30 }, expectedType: 'genre', kind: 'genre' }
    ]);

    // "Amy Adams" contains " ad" and has ten times the films, but "Adventure"
    // starts with what was typed — that is the stronger signal of intent.
    expect(rankTypeahead(index, 'ad')[0].value).toBe('Adventure');
  });

  it('ranks by how much of your library the term covers', () => {
    // Both start with "am", so the tie breaks on films: Amblin (8) over
    // Amy Adams (4). The director you have eleven of is more likely to be
    // the one you meant than the one you have a single film by.
    const values = rankTypeahead(library(), 'am').map((entry) => entry.value);
    expect(values[0]).toBe('Amblin Entertainment');
  });

  it('ignores accents and case, as the rest of search does', () => {
    const index = indexFrom([
      { counts: { 'Penélope Cruz': 4 }, expectedType: 'cast/crew', kind: 'cast' }
    ]);

    expect(rankTypeahead(index, 'penel')[0].value).toBe('Penélope Cruz');
    expect(rankTypeahead(index, 'CRUZ')[0].value).toBe('Penélope Cruz');
  });

  it('says nothing about a term already typed exactly', () => {
    // An exact term detects to the right chip type on its own; offering it
    // back is a suggestion to do nothing.
    expect(rankTypeahead(library(), 'Drama')).toEqual([]);
  });

  it('says nothing about a filter already applied', () => {
    const suggestions = rankTypeahead(library(), 'com', { exclude: ['Comedy'] });
    expect(suggestions.map((entry) => entry.value)).not.toContain('Comedy');
  });

  it('stays quiet below the character floor', () => {
    expect(TYPEAHEAD_MIN_CHARS).toBe(2);
    expect(rankTypeahead(library(), 'd')).toEqual([]);
    expect(rankTypeahead(library(), '')).toEqual([]);
  });

  it('stays quiet for something that is in no way a match', () => {
    // Prefix matching, not fuzzy — a typo belongs to the zero-results
    // "Did you mean?" line, which is where Fuse still lives.
    expect(rankTypeahead(library(), 'qzxwvkj')).toEqual([]);
  });

  it('honours the limit however many terms match', () => {
    expect(rankTypeahead(library(), 'a', { limit: 2 }).length).toBeLessThanOrEqual(2);
    expect(rankTypeahead(library(), 'am', { limit: 1 })).toHaveLength(1);
  });

  it('survives an empty or missing index', () => {
    expect(rankTypeahead([], 'villen')).toEqual([]);
    expect(rankTypeahead(null, 'villen')).toEqual([]);
  });

  it('returns a stable order for equally-ranked terms', () => {
    const index = indexFrom([
      { counts: { Crime: 5, Cults: 5 }, expectedType: 'genre', kind: 'genre' }
    ]);

    expect(rankTypeahead(index, 'cr')[0].value).toBe('Crime');
    expect(rankTypeahead(index, 'cu')[0].value).toBe('Cults');
  });
});

describe('describeSuggestion', () => {
  it('says what kind of chip a row will build and how much it covers', () => {
    expect(describeSuggestion({ kind: 'director', count: 6 })).toBe('director · 6 films');
  });

  it('counts one film as a film', () => {
    expect(describeSuggestion({ kind: 'genre', count: 1 })).toBe('genre · 1 film');
  });

  it('falls back to the kind alone rather than saying "0 films"', () => {
    expect(describeSuggestion({ kind: 'keyword', count: 0 })).toBe('keyword');
  });

  it('has nothing to say about a row with no kind', () => {
    expect(describeSuggestion(null)).toBe('');
    expect(describeSuggestion({})).toBe('');
  });
});

// Typeahead for the main search bar (Matt, 2026-08-18: "we've added a lot of
// type ahead and fuzzy search features to our various inputs all over the
// app. Do you think it's something we could do to our main search input?").
//
// The rules that make it worth having: it offers the DIMENSIONS of your own
// library, ranked by how much of that library each one covers, and a tap
// carries the chip type that typing the same letters would not have found.
import { describe, it, expect } from 'vitest';
import {
  buildTypeaheadIndex,
  rankTypeahead,
  countTypeaheadSuggestionsThatFit,
  TYPEAHEAD_MIN_CHARS
} from '../assets/javascript/searchSuggestions.js';

const library = () => buildTypeaheadIndex([
  { counts: { 'Denis Villeneuve': 6, 'Steven Spielberg': 11 }, expectedType: 'director', kind: 'director' },
  { counts: { Drama: 40, Comedy: 22, 'Science Fiction': 9 }, expectedType: 'genre', kind: 'genre' },
  { counts: { 'Amblin Entertainment': 8 }, expectedType: 'studios', kind: 'studio' },
  { counts: { 'Denis Villeneuve': 6, 'Amy Adams': 4, 'Liam Neeson': 3 }, expectedType: 'cast/crew', kind: 'cast' },
  { counts: { holocaust: 2, aliens: 5 }, expectedType: 'keyword', kind: 'keyword' }
]);

describe('buildTypeaheadIndex', () => {
  it('carries the expectedType that decides what chip a tap builds', () => {
    const villeneuve = library().find((entry) => entry.value === 'Denis Villeneuve');
    expect(villeneuve.expectedType).toBe('director');
  });

  it('keeps a director out of the cast list rather than offering them twice', () => {
    // Directors are crew, so Villeneuve is in both count maps — and both
    // build the identical `person` chip. Two rows saying the same thing
    // would waste a line that only fits two.
    const matches = library().filter((entry) => entry.value === 'Denis Villeneuve');
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe('director');
  });

  it('records how many films each term covers, for ranking', () => {
    const spielberg = library().find((entry) => entry.value === 'Steven Spielberg');
    expect(spielberg.count).toBe(11);
  });

  it('survives empty and missing count maps', () => {
    expect(buildTypeaheadIndex(null)).toEqual([]);
    expect(buildTypeaheadIndex([{ counts: null, expectedType: 'genre', kind: 'genre' }])).toEqual([]);
    expect(buildTypeaheadIndex([{ counts: { '': 3 }, expectedType: 'genre', kind: 'genre' }])).toEqual([]);
  });
});

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
    const index = buildTypeaheadIndex([
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
    const index = buildTypeaheadIndex([
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
    const index = buildTypeaheadIndex([
      { counts: { Crime: 5, Cults: 5 }, expectedType: 'genre', kind: 'genre' }
    ]);

    expect(rankTypeahead(index, 'cr')[0].value).toBe('Crime');
    expect(rankTypeahead(index, 'cu')[0].value).toBe('Cults');
  });
});

describe('countTypeaheadSuggestionsThatFit', () => {
  const suggestion = (value, kind) => ({ value, kind });

  it('fits several short terms on a wide line', () => {
    const candidates = [suggestion('Drama', 'genre'), suggestion('Comedy', 'genre')];
    expect(countTypeaheadSuggestionsThatFit(candidates, 600)).toBe(2);
  });

  it('cuts back to what a phone-width line can hold', () => {
    const candidates = [
      suggestion('Amblin Entertainment', 'studio'),
      suggestion('Denis Villeneuve', 'director'),
      suggestion('Steven Spielberg', 'director')
    ];

    expect(countTypeaheadSuggestionsThatFit(candidates, 260)).toBeLessThan(3);
  });

  it('always attempts at least one, leaving the ellipsis to do the rest', () => {
    expect(countTypeaheadSuggestionsThatFit([suggestion('Amblin Entertainment', 'studio')], 20)).toBe(1);
    expect(countTypeaheadSuggestionsThatFit([suggestion('Drama', 'genre')], 0)).toBe(1);
  });

  it('counts nothing when there is nothing to show', () => {
    expect(countTypeaheadSuggestionsThatFit([], 400)).toBe(0);
    expect(countTypeaheadSuggestionsThatFit(null, 400)).toBe(0);
  });

  it('accounts for the kind word, not just the term', () => {
    const withKind = [suggestion('Steven Spielberg', 'director'), suggestion('Drama', 'genre')];
    const withoutKind = [suggestion('Steven Spielberg', ''), suggestion('Drama', '')];

    expect(countTypeaheadSuggestionsThatFit(withKind, 190))
      .toBeLessThanOrEqual(countTypeaheadSuggestionsThatFit(withoutKind, 190));
  });
});

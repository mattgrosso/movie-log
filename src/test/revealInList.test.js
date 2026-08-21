import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  indexOfMovie,
  resultElementId,
  resultsNeededToReveal,
  scrollOffsetFor,
} from '../assets/javascript/revealInList.js';

// Bug report (2026-08-20): a quick way to see where a film sits in the overall
// rankings and who its neighbours are. Matt, clarifying (2026-08-21): "I don't
// want like a new display... I just want a way for me to jump to the home
// screen, scroll to the position of that movie, so we use the existing sorting
// and sort order."

describe('resultElementId', () => {
  it('matches the id DBGridLayoutSearchResult actually renders', () => {
    // That component's sanitizeId is a private method on a multi-root
    // component, so there is nothing to import and nothing to read off the
    // rendered outside of it. The rule is therefore duplicated — and this is
    // what stops the two drifting apart, which would silently turn the whole
    // feature into a no-op (getElementById returning null).
    const source = readFileSync(
      join(process.cwd(), 'src/components/DBGridLayoutSearchResult.vue'),
      'utf8',
    );
    expect(source).toContain(':id="sanitizeId(result.dbKey)"');
    expect(source).toMatch(/return `movie-\$\{id\.replace\(\/\[\^a-z0-9\\-_:\.\]\/gi, '_'\)\}`;/);
  });

  it('replaces every character the DOM id rule disallows', () => {
    expect(resultElementId('1787231741613-bc02-The Holdovers'))
      .toBe('movie-1787231741613-bc02-The_Holdovers');
    expect(resultElementId('a/b#c?d')).toBe('movie-a_b_c_d');
  });

  it('keeps the characters that are legal', () => {
    expect(resultElementId('a-b_c:d.e')).toBe('movie-a-b_c:d.e');
  });
});

describe('indexOfMovie', () => {
  const results = [{ dbKey: 'a' }, { dbKey: 'b' }, { dbKey: 'c' }];

  it('finds a film by its database key', () => {
    expect(indexOfMovie(results, 'b')).toBe(1);
  });

  it('reports -1 when the film is not in the current results', () => {
    expect(indexOfMovie(results, 'zzz')).toBe(-1);
  });

  it('survives junk rather than throwing mid-navigation', () => {
    expect(indexOfMovie(null, 'a')).toBe(-1);
    expect(indexOfMovie(results, null)).toBe(-1);
    expect(indexOfMovie([null, undefined, { dbKey: 'a' }], 'a')).toBe(2);
  });
});

describe('resultsNeededToReveal', () => {
  // Home renders sortedResults.slice(0, numberOfResultsToShow) and grows it on
  // scroll. A film at #134 is simply not in the document until enough of the
  // list is, so scrolling to it would find nothing at all.
  it('renders far enough down the list to include the film', () => {
    expect(resultsNeededToReveal(133, 25)).toBeGreaterThan(133);
  });

  it('leaves room below it, since the neighbours are the point', () => {
    expect(resultsNeededToReveal(133, 25)).toBe(133 + 1 + 12);
  });

  it('never renders fewer rows than are already shown', () => {
    expect(resultsNeededToReveal(2, 500)).toBe(500);
  });

  it('changes nothing when the film was not found', () => {
    expect(resultsNeededToReveal(-1, 73)).toBe(73);
  });
});

describe('scrollOffsetFor', () => {
  it('puts the film about a third down, so both neighbours are visible', () => {
    expect(scrollOffsetFor(3000, 900)).toBe(2700);
  });

  // Scrolling to a negative offset silently does nothing in some browsers and
  // bounces in others.
  it('never scrolls above the top of the document', () => {
    expect(scrollOffsetFor(100, 900)).toBe(0);
    expect(scrollOffsetFor(0, 900)).toBe(0);
  });
});

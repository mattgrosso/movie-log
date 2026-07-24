import { describe, it, expect } from 'vitest';
import { buildClueDeck, STARTING_BUDGET } from '@/assets/javascript/games/clueBudget.js';

// Mid-month release dates — see CLAUDE.md's documented test pitfall
// (new Date('YYYY-01-01') can shift a year/decade in this repo's test env).
function entry (overrides = {}) {
  return {
    dbKey: 'key-1',
    movie: {
      id: 42,
      title: 'Test Movie',
      release_date: '1994-06-15',
      runtime: 142,
      genres: [{ name: 'Drama' }, { name: 'Thriller' }],
      cast: [{ name: 'Cast One' }, { name: 'Cast Two' }, { name: 'Cast Three' }, { name: 'Cast Four' }, { name: 'Cast Five' }],
      crew: [
        { name: 'Some Director', job: 'Director' },
        { name: 'Some Writer', job: 'Writer' },
        { name: 'Some Composer', job: 'Original Music Composer' },
        { name: 'Some DP', job: 'Director of Photography' },
        { name: 'Some Editor', job: 'Editor' },
        { name: 'Some Producer', job: 'Producer' }
      ],
      production_companies: [{ name: 'A24' }],
      flatKeywords: ['heist', 'ensemble cast', 'nonlinear timeline'],
      ...overrides.movie
    },
    ...overrides
  };
}

describe('STARTING_BUDGET', () => {
  it('is 100', () => {
    expect(STARTING_BUDGET).toBe(100);
  });
});

describe('buildClueDeck', () => {
  it('includes one clue per available field, with an increasing cost roughly matching how identifying it is', () => {
    const deck = buildClueDeck(entry());
    const byKey = Object.fromEntries(deck.map((c) => [c.key, c]));

    expect(byKey.decade).toEqual({ key: 'decade', label: 'Decade', cost: 5, value: '1990s' });
    expect(byKey.runtime).toEqual({ key: 'runtime', label: 'Runtime', cost: 5, value: '~142 min' });
    expect(byKey.genres.value).toBe('Drama, Thriller');
    expect(byKey.year.value).toBe('1994');
    expect(byKey.company.value).toBe('A24');
    expect(byKey.director.value).toBe('Some Director');
    expect(byKey.writer.value).toBe('Some Writer');
    expect(byKey.composer.value).toBe('Some Composer');
    expect(byKey.cinematographer.value).toBe('Some DP');
    expect(byKey.editor.value).toBe('Some Editor');
    expect(byKey.producer.value).toBe('Some Producer');

    // Broad/weak clues cost less than direct-fingerprint ones.
    expect(byKey.decade.cost).toBeLessThan(byKey.director.cost);
    expect(byKey.genres.cost).toBeLessThan(byKey.director.cost);
  });

  it('omits a clue entirely when the movie has no data for it, rather than showing an empty one', () => {
    const deck = buildClueDeck(entry({ movie: { production_companies: [], flatKeywords: [], crew: [] } }));
    const keys = deck.map((c) => c.key);
    expect(keys).not.toContain('company');
    expect(keys).not.toContain('director');
    expect(keys).not.toContain('writer');
    expect(keys.some((k) => k.startsWith('keyword-'))).toBe(false);
  });

  it('reveals cast members one at a time in billing order, each costing LESS than the last (bug report: "cast member #1... should cost more than someone further down")', () => {
    const deck = buildClueDeck(entry());
    const castClues = deck.filter((c) => c.key.startsWith('cast-'));
    // #1 is offered/bought first (it's still listed first) but is the most
    // EXPENSIVE — billing order tracks real-world recognizability, so the
    // top-billed actor is normally the single most identifying piece of
    // cast info on its own, unlike keywords (no such intrinsic ranking).
    expect(castClues.map((c) => c.value)).toEqual(['Cast One', 'Cast Two', 'Cast Three', 'Cast Four']);
    for (let i = 1; i < castClues.length; i++) {
      expect(castClues[i].cost).toBeLessThan(castClues[i - 1].cost);
    }
  });

  it('caps cast reveals at 4 even with a larger cast', () => {
    const bigCast = Array.from({ length: 10 }, (_, i) => ({ name: `Actor ${i}` }));
    const deck = buildClueDeck(entry({ movie: { cast: bigCast } }));
    expect(deck.filter((c) => c.key.startsWith('cast-'))).toHaveLength(4);
  });

  it('reveals keywords one at a time, each costing more than the last, capped at 3', () => {
    const deck = buildClueDeck(entry());
    const keywordClues = deck.filter((c) => c.key.startsWith('keyword-'));
    expect(keywordClues.map((c) => c.value)).toEqual(['heist', 'ensemble cast', 'nonlinear timeline']);
    for (let i = 1; i < keywordClues.length; i++) {
      expect(keywordClues[i].cost).toBeGreaterThan(keywordClues[i - 1].cost);
    }

    const manyKeywords = buildClueDeck(entry({ movie: { flatKeywords: ['a', 'b', 'c', 'd', 'e'] } }));
    expect(manyKeywords.filter((c) => c.key.startsWith('keyword-'))).toHaveLength(3);
  });

  it('does not include a tagline clue unless one is explicitly provided (it is fetched live, not stored)', () => {
    expect(buildClueDeck(entry()).some((c) => c.key === 'tagline')).toBe(false);
    const withTagline = buildClueDeck(entry(), { tagline: 'A gripping tale.' });
    expect(withTagline.find((c) => c.key === 'tagline')).toEqual({ key: 'tagline', label: 'Tagline', cost: 15, value: 'A gripping tale.' });
  });

  it('every individual clue costs less than the full starting budget (each one is affordable on its own)', () => {
    const deck = buildClueDeck(entry(), { tagline: 'Tagline here.' });
    deck.forEach((clue) => expect(clue.cost).toBeLessThan(STARTING_BUDGET));
  });
});

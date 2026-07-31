import { describe, it, expect } from 'vitest';
import {
  buildClueDeck,
  STARTING_BUDGET,
  priceFromPersonPopularity,
  priceFromKeywordRarity,
  priceFromCompanyRarity
} from '@/assets/javascript/games/clueBudget.js';

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

  // Feature request: "we should add my rating as a buyable clue on the
  // trivia budget game." Comes in via extras since a rating can't be
  // computed without the store (see buildClueDeck's own comment).
  describe('the Your Rating clue', () => {
    it('is offered, formatted to 2 decimals, when a finite rating is supplied', () => {
      const clue = buildClueDeck(entry(), { yourRating: 8.456 }).find((c) => c.key === 'yourRating');
      expect(clue).toBeTruthy();
      expect(clue.label).toBe('Your Rating');
      expect(clue.value).toBe('8.46');
      expect(clue.cost).toBeGreaterThan(0);
    });

    it('is offered for a legitimate zero rating (not treated as missing)', () => {
      const clue = buildClueDeck(entry(), { yourRating: 0 }).find((c) => c.key === 'yourRating');
      expect(clue).toBeTruthy();
      expect(clue.value).toBe('0.00');
    });

    it('is omitted entirely when no rating is supplied, or when it is not a real number', () => {
      expect(buildClueDeck(entry()).some((c) => c.key === 'yourRating')).toBe(false);
      expect(buildClueDeck(entry(), { yourRating: NaN }).some((c) => c.key === 'yourRating')).toBe(false);
      expect(buildClueDeck(entry(), { yourRating: null }).some((c) => c.key === 'yourRating')).toBe(false);
    });

    it('costs less than the starting budget, like every other clue', () => {
      const clue = buildClueDeck(entry(), { yourRating: 5 }).find((c) => c.key === 'yourRating');
      expect(clue.cost).toBeLessThan(STARTING_BUDGET);
    });
  });

  describe('dynamic pricing from live TMDB data', () => {
    it('prices a person clue from real popularity instead of the fallback tier, once it is known', () => {
      const obscure = buildClueDeck(entry(), { peoplePopularity: { 'Some Director': 1 } });
      const famous = buildClueDeck(entry(), { peoplePopularity: { 'Some Director': 80 } });
      const fallback = buildClueDeck(entry());

      const obscureCost = obscure.find((c) => c.key === 'director').cost;
      const famousCost = famous.find((c) => c.key === 'director').cost;
      const fallbackCost = fallback.find((c) => c.key === 'director').cost;

      expect(famousCost).toBeGreaterThan(obscureCost);
      // Dynamic pricing replaces the fallback entirely once known — it's
      // not blended with it.
      expect(obscureCost).not.toBe(fallbackCost);
      expect(famousCost).not.toBe(fallbackCost);
    });

    it('a person missing from peoplePopularity keeps the fallback cost for their clue (never blocks the clue)', () => {
      const deck = buildClueDeck(entry(), { peoplePopularity: { 'Someone Else Entirely': 50 } });
      const directorClue = deck.find((c) => c.key === 'director');
      expect(directorClue).toBeTruthy();
      expect(directorClue.cost).toBe(20); // the original fallback
    });

    it('prices a keyword by how many movies share it, only for keywords with a resolvable TMDB id', () => {
      const rare = buildClueDeck(entry(), { keywordMovieCounts: { heist: 4 } });
      const common = buildClueDeck(entry(), { keywordMovieCounts: { heist: 8000 } });
      const rareCost = rare.find((c) => c.key === 'keyword-0').cost;
      const commonCost = common.find((c) => c.key === 'keyword-0').cost;

      // Inverse of person pricing: RARER costs MORE.
      expect(rareCost).toBeGreaterThan(commonCost);

      // A keyword not present in keywordMovieCounts (no TMDB id resolved,
      // e.g. an AI/custom keyword) keeps its fallback cost untouched.
      const otherKeywordClue = rare.find((c) => c.key === 'keyword-1');
      expect(otherKeywordClue.cost).toBe(15); // fallback for slot index 1
    });

    it('prices production company inversely to how many movies it has made', () => {
      const boutique = buildClueDeck(entry(), { companyMovieCount: 5 });
      const major = buildClueDeck(entry(), { companyMovieCount: 6000 });
      expect(boutique.find((c) => c.key === 'company').cost).toBeGreaterThan(major.find((c) => c.key === 'company').cost);
    });

    it('prices a multi-name group clue (writers) by the MOST popular name in the group', () => {
      const deck = buildClueDeck(
        entry({ movie: { crew: [
          { name: 'Director X', job: 'Director' },
          { name: 'Obscure Writer', job: 'Writer' },
          { name: 'Famous Writer', job: 'Writer' }
        ] } }),
        { peoplePopularity: { 'Obscure Writer': 1, 'Famous Writer': 80 } }
      );
      const writerClue = deck.find((c) => c.key === 'writer');
      expect(writerClue.value).toBe('Obscure Writer, Famous Writer');
      expect(writerClue.cost).toBe(priceFromPersonPopularity(80));
    });
  });
});

describe('priceFromPersonPopularity', () => {
  it('increases monotonically with popularity', () => {
    expect(priceFromPersonPopularity(0)).toBeLessThan(priceFromPersonPopularity(5));
    expect(priceFromPersonPopularity(5)).toBeLessThan(priceFromPersonPopularity(30));
    expect(priceFromPersonPopularity(30)).toBeLessThan(priceFromPersonPopularity(200));
  });

  it('clamps to a sane range regardless of extreme input', () => {
    expect(priceFromPersonPopularity(0)).toBeGreaterThanOrEqual(8);
    expect(priceFromPersonPopularity(-5)).toBeGreaterThanOrEqual(8);
    expect(priceFromPersonPopularity(100000)).toBeLessThanOrEqual(35);
  });
});

describe('priceFromKeywordRarity', () => {
  it('decreases monotonically as the movie count grows (rarer = pricier)', () => {
    expect(priceFromKeywordRarity(2)).toBeGreaterThan(priceFromKeywordRarity(50));
    expect(priceFromKeywordRarity(50)).toBeGreaterThan(priceFromKeywordRarity(5000));
  });

  it('clamps to a sane range regardless of extreme input', () => {
    expect(priceFromKeywordRarity(0)).toBeLessThanOrEqual(30);
    expect(priceFromKeywordRarity(1)).toBeLessThanOrEqual(30);
    expect(priceFromKeywordRarity(10000000)).toBeGreaterThanOrEqual(8);
  });
});

describe('priceFromCompanyRarity', () => {
  it('decreases monotonically as the movie count grows (a more prolific studio costs less)', () => {
    expect(priceFromCompanyRarity(2)).toBeGreaterThan(priceFromCompanyRarity(50));
    expect(priceFromCompanyRarity(50)).toBeGreaterThan(priceFromCompanyRarity(5000));
  });

  it('clamps to a sane, narrower range than the other two (a noisier signal)', () => {
    expect(priceFromCompanyRarity(0)).toBeLessThanOrEqual(25);
    expect(priceFromCompanyRarity(10000000)).toBeGreaterThanOrEqual(6);
  });
});

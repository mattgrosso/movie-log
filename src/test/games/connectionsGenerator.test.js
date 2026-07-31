import { describe, it, expect } from 'vitest';
import { buildCandidateCategories, generateConnectionsPuzzle, CATEGORY_KIND_LABELS } from '@/assets/javascript/games/connectionsGenerator.js';
import { makeSeededRng } from '@/assets/javascript/games/gameUtils.js';

function entry ({ id, title, director, genre, year, cast = [], studio, keywords = [] }) {
  return {
    dbKey: `key-${id}`,
    movie: {
      id,
      title,
      // Mid-month, not Jan 1 — new Date('YYYY-01-01') parses as UTC midnight,
      // which shifts to the previous year/decade in a negative-UTC-offset
      // timezone (this repo's test environment is America/New_York; see the
      // identical note in Insights.test.js). A decade-boundary date here
      // would silently scramble which fixture movies share a decade.
      release_date: `${year}-06-15`,
      crew: director ? [{ name: director, job: 'Director' }] : [],
      genres: genre ? [{ name: genre }] : [],
      cast: cast.map((name) => ({ name })),
      // Still populated in fixtures that pass `studio`, to confirm it's
      // present-but-ignored rather than merely absent (see the "too tricky,
      // dropped" test below).
      production_companies: studio ? [{ name: studio }] : [],
      keywords: keywords.map((name) => ({ name }))
    }
  };
}

// A library with 4 clean, non-overlapping categories of exactly 4 movies
// each, plus enough padding for the "not enough data" test to have contrast.
function buildSolvableLibrary () {
  const entries = [];
  for (let i = 0; i < 4; i++) {
    entries.push(entry({ id: `nolan-${i}`, title: `Nolan Film ${i}`, director: 'Christopher Nolan', genre: 'Drama', year: 2000 + i, cast: [`Nolan Actor ${i}`], studio: 'Warner Bros' }));
  }
  for (let i = 0; i < 4; i++) {
    entries.push(entry({ id: `scifi-${i}`, title: `Sci-Fi Film ${i}`, director: `Director ${i}`, genre: 'Science Fiction', year: 2010 + i, cast: [`Scifi Actor ${i}`] }));
  }
  for (let i = 0; i < 4; i++) {
    entries.push(entry({ id: `90s-${i}`, title: `90s Film ${i}`, director: `Other Director ${i}`, genre: `Genre ${i}`, year: 1990 + i, cast: [`Actor ${i}`] }));
  }
  for (let i = 0; i < 4; i++) {
    // Deliberately a different decade (2020s) than the sci-fi group's 2010s
    // above — sharing a decade with another group would make "Released in
    // the 2010s"/"2020s" a candidate category that overlaps both groups'
    // movies, which is a real, valid puzzle-generation scenario but not what
    // this fixture is testing (a clean, fully solvable 4-category library).
    entries.push(entry({ id: `hanks-${i}`, title: `Hanks Film ${i}`, director: `Yet Another Director ${i}`, genre: `Different Genre ${i}`, year: 2020 + i, cast: ['Tom Hanks'] }));
  }
  return entries;
}

describe('buildCandidateCategories', () => {
  it('only includes attribute values shared by at least 4 movies', () => {
    const library = buildSolvableLibrary();
    const candidates = buildCandidateCategories(library);
    const nolanCategory = candidates.find((c) => c.label === 'Directed by Christopher Nolan');
    expect(nolanCategory.movies).toHaveLength(4);

    // Each "Director {i}" in the sci-fi group only directs 1 movie -> not a candidate.
    expect(candidates.some((c) => c.label.startsWith('Directed by Director'))).toBe(false);
  });

  it('returns an empty array when nothing in the library repeats 4+ times', () => {
    const library = [entry({ id: 1, title: 'A', director: 'D1', genre: 'G1', year: 2000, cast: ['X'] })];
    expect(buildCandidateCategories(library)).toEqual([]);
  });

  it('never builds a category from a shared production company ("too tricky", dropped per feedback)', () => {
    const library = buildSolvableLibrary(); // the Nolan group all share studio: 'Warner Bros'
    const candidates = buildCandidateCategories(library);
    expect(candidates.some((c) => c.label.includes('Warner Bros'))).toBe(false);
    expect(candidates.some((c) => c.label.startsWith('From '))).toBe(false);
  });

  describe('keyword categories', () => {
    it('builds a category from a keyword shared by a mid-range number of movies (5-10)', () => {
      const library = [
        ...buildSolvableLibrary(),
        ...Array.from({ length: 6 }, (_, i) => entry({ id: `kw-${i}`, title: `Keyword Film ${i}`, director: `KW Director ${i}`, genre: `KW Genre ${i}`, year: 2005 + i, keywords: ['time travel'] }))
      ];
      const candidates = buildCandidateCategories(library);
      const kwCategory = candidates.find((c) => c.label === 'Keyword: time travel');
      expect(kwCategory.movies).toHaveLength(6);
    });

    // Bug report follow-up: a keyword shared by exactly GROUP_SIZE (4) movies
    // is now excluded too, not just an overly-broad one - it has zero
    // flexibility during generation (all 4 must be used as-is) and reads as
    // coincidental rather than a real pattern.
    it('excludes a keyword shared by exactly 4 movies (at the bare mechanical floor, below the sweet spot)', () => {
      const bare = Array.from({ length: 4 }, (_, i) => entry({ id: `bare-${i}`, title: `Bare ${i}`, director: `BR ${i}`, genre: `BRG ${i}`, year: 2001 + i, keywords: ['coincidence'] }));
      const library = [...buildSolvableLibrary(), ...bare];
      const candidates = buildCandidateCategories(library);
      expect(candidates.some((c) => c.label === 'Keyword: coincidence')).toBe(false);
    });

    it('includes a keyword shared by exactly 5 movies (the minimum is inclusive)', () => {
      const atFloor = Array.from({ length: 5 }, (_, i) => entry({ id: `floor-${i}`, title: `Floor ${i}`, director: `FD ${i}`, genre: `FG ${i}`, year: 2001 + i, keywords: ['floor keyword'] }));
      const library = [...buildSolvableLibrary(), ...atFloor];
      const candidates = buildCandidateCategories(library);
      const kwCategory = candidates.find((c) => c.label === 'Keyword: floor keyword');
      expect(kwCategory.movies).toHaveLength(5);
    });

    it('excludes a keyword shared by MORE than 10 movies (too broad, not "special")', () => {
      const broad = Array.from({ length: 11 }, (_, i) => entry({ id: `broad-${i}`, title: `Broad ${i}`, director: `BD ${i}`, genre: `BG ${i}`, year: 2001 + i, keywords: ['based on a novel'] }));
      const library = [...buildSolvableLibrary(), ...broad];
      const candidates = buildCandidateCategories(library);
      expect(candidates.some((c) => c.label === 'Keyword: based on a novel')).toBe(false);
    });

    it('includes a keyword shared by exactly 10 movies (the cap is inclusive)', () => {
      const niche = Array.from({ length: 10 }, (_, i) => entry({ id: `niche-${i}`, title: `Niche ${i}`, director: `ND ${i}`, genre: `NG ${i}`, year: 2001 + i, keywords: ['rare keyword'] }));
      const library = [...buildSolvableLibrary(), ...niche];
      const candidates = buildCandidateCategories(library);
      const kwCategory = candidates.find((c) => c.label === 'Keyword: rare keyword');
      expect(kwCategory.movies).toHaveLength(10);
    });
  });

  describe('title categories', () => {
    it('groups 4+ movies sharing a first letter', () => {
      const library = [
        ...buildSolvableLibrary(),
        entry({ id: 'g1', title: 'Gladiator', director: 'GD1', genre: 'GG1', year: 2001 }),
        entry({ id: 'g2', title: 'Goodfellas', director: 'GD2', genre: 'GG2', year: 2002 }),
        entry({ id: 'g3', title: 'Gravity', director: 'GD3', genre: 'GG3', year: 2003 }),
        entry({ id: 'g4', title: 'Get Out', director: 'GD4', genre: 'GG4', year: 2004 })
      ];
      const candidates = buildCandidateCategories(library);
      const category = candidates.find((c) => c.label === 'Starts with "G"');
      expect(category).toBeTruthy();
      expect(category.kind).toBe('title');
      expect(category.movies).toHaveLength(4);
    });

    it('strips a leading article before grouping by first letter ("The Godfather" groups under G, not T)', () => {
      const library = [
        ...buildSolvableLibrary(),
        entry({ id: 'g1', title: 'The Godfather', director: 'GD1', genre: 'GG1', year: 2001 }),
        entry({ id: 'g2', title: 'Goodfellas', director: 'GD2', genre: 'GG2', year: 2002 }),
        entry({ id: 'g3', title: 'Gravity', director: 'GD3', genre: 'GG3', year: 2003 }),
        entry({ id: 'g4', title: 'A Ghost Story', director: 'GD4', genre: 'GG4', year: 2004 })
      ];
      const candidates = buildCandidateCategories(library);
      const gCategory = candidates.find((c) => c.label === 'Starts with "G"');
      expect(gCategory.movies).toHaveLength(4);
      expect(candidates.some((c) => c.label === 'Starts with "T"')).toBe(false);
      expect(candidates.some((c) => c.label === 'Starts with "A"')).toBe(false);
    });

    it('skips a title starting with a digit or symbol rather than mis-bucketing it', () => {
      const library = [
        ...buildSolvableLibrary(),
        entry({ id: 'n1', title: '2001: A Space Odyssey', director: 'ND1', genre: 'NG1', year: 2001 }),
        entry({ id: 'n2', title: 'Se7en', director: 'ND2', genre: 'NG2', year: 2002 }),
        entry({ id: 'n3', title: '9 to 5', director: 'ND3', genre: 'NG3', year: 2003 }),
        entry({ id: 'n4', title: '300', director: 'ND4', genre: 'NG4', year: 2004 })
      ];
      const candidates = buildCandidateCategories(library);
      const titleCategories = candidates.filter((c) => c.kind === 'title');
      expect(titleCategories.some((c) => c.movies.some((m) => m.movie.title === '2001: A Space Odyssey'))).toBe(false);
      expect(titleCategories.some((c) => c.movies.some((m) => m.movie.title === '300'))).toBe(false);
    });

    it('groups 4+ single-word-titled movies into "One-word titles"', () => {
      const library = [
        ...buildSolvableLibrary(),
        entry({ id: 's1', title: 'Gladiator', director: 'SD1', genre: 'SG1', year: 2001 }),
        entry({ id: 's2', title: 'Whiplash', director: 'SD2', genre: 'SG2', year: 2002 }),
        entry({ id: 's3', title: 'Inception', director: 'SD3', genre: 'SG3', year: 2003 }),
        entry({ id: 's4', title: 'Amadeus', director: 'SD4', genre: 'SG4', year: 2004 })
      ];
      const candidates = buildCandidateCategories(library);
      const category = candidates.find((c) => c.label === 'One-word titles');
      expect(category).toBeTruthy();
      expect(category.kind).toBe('title');
      expect(category.movies).toHaveLength(4);
    });

    it('does not count a multi-word title toward "One-word titles"', () => {
      const library = [
        ...buildSolvableLibrary(),
        entry({ id: 's1', title: 'Gladiator', director: 'SD1', genre: 'SG1', year: 2001 }),
        entry({ id: 's2', title: 'Whiplash', director: 'SD2', genre: 'SG2', year: 2002 }),
        entry({ id: 's3', title: 'Inception', director: 'SD3', genre: 'SG3', year: 2003 }),
        entry({ id: 'm1', title: 'The Godfather', director: 'MD1', genre: 'MG1', year: 2004 })
      ];
      const candidates = buildCandidateCategories(library);
      expect(candidates.some((c) => c.label === 'One-word titles')).toBe(false);
    });
  });

  describe('awards categories (feature request: "movies that have all won the best actor or best picture... any of the Academy Awards or really any of the awards", wins only; kept strictly SEPARATE per follow-up — "they should be separate. So only match movies within each award")', () => {
    // Award-winning movies, distinct from buildSolvableLibrary's fixtures so
    // an awards category never accidentally overlaps another group's tiles.
    function awardWinners (idPrefix, count) {
      return Array.from({ length: count }, (_, i) => entry({ id: `${idPrefix}-${i}`, title: `${idPrefix} ${i}`, director: `${idPrefix}D${i}`, genre: `${idPrefix}G${i}`, year: 1980 + i }));
    }

    // Raw film-awards-api record shape (`tmdb` comes back as a numeric-
    // looking STRING from the real API — confirmed live).
    function academyRecord (tmdb, category, isWinner = true) {
      return { id: `${tmdb}-${category}`, tmdb: String(tmdb), category, isWinner, isActing: false };
    }

    it('builds a "Won Best Picture (Academy)" category from the full academy dataset, not just a Best-Picture-only slice', () => {
      const winners = awardWinners('bp', 4);
      const library = [...buildSolvableLibrary(), ...winners];
      const awardsData = { personalAwards: {}, allAcademyAwards: winners.map((e) => academyRecord(e.movie.id, 'Best Picture')) };

      const candidates = buildCandidateCategories(library, awardsData);
      const category = candidates.find((c) => c.label === 'Won Best Picture (Academy)');
      expect(category).toBeTruthy();
      expect(category.kind).toBe('awards');
      expect(category.movies).toHaveLength(4);
    });

    it('builds a category from a NON-Best-Picture Academy category too, now that the full dataset is available', () => {
      const winners = awardWinners('bd', 4);
      const library = [...buildSolvableLibrary(), ...winners];
      const awardsData = { personalAwards: {}, allAcademyAwards: winners.map((e) => academyRecord(e.movie.id, 'Best Director')) };

      const candidates = buildCandidateCategories(library, awardsData);
      const category = candidates.find((c) => c.label === 'Won Best Director (Academy)');
      expect(category).toBeTruthy();
      expect(category.movies).toHaveLength(4);
    });

    it('does NOT count an Academy NOMINATION (isWinner: false) as a win', () => {
      const nominees = awardWinners('nom', 4);
      const library = [...buildSolvableLibrary(), ...nominees];
      const awardsData = { personalAwards: {}, allAcademyAwards: nominees.map((e) => academyRecord(e.movie.id, 'Best Actor', false)) };

      const candidates = buildCandidateCategories(library, awardsData);
      expect(candidates.some((c) => c.label.includes('Best Actor'))).toBe(false);
    });

    it('builds a category from personal-award WINS, using the real category display name', () => {
      const winners = awardWinners('pd', 4);
      const library = [...buildSolvableLibrary(), ...winners];
      const awardsData = {
        personalAwards: {
          2020: { categories: { bestDirector: { winner: { movieId: winners[0].movie.id } } } },
          2021: { categories: { bestDirector: { winner: { movieId: winners[1].movie.id } } } },
          2022: { categories: { bestDirector: { winner: { movieId: winners[2].movie.id } } } },
          2023: { categories: { bestDirector: { winner: { movieId: winners[3].movie.id } } } }
        },
        allAcademyAwards: [],
        personalAwardName: 'Groskers'
      };

      const candidates = buildCandidateCategories(library, awardsData);
      const category = candidates.find((c) => c.label === 'Won Best Director (The Groskers)');
      expect(category).toBeTruthy();
      expect(category.movies).toHaveLength(4);
    });

    it('does NOT count a personal-award NOMINATION (only nominees, no winner) as a win', () => {
      const nominees = awardWinners('nom2', 4);
      const library = [...buildSolvableLibrary(), ...nominees];
      const awardsData = {
        personalAwards: {
          2020: { categories: { bestActor: { nominees: nominees.map((e) => ({ movieId: e.movie.id })), winner: null } } }
        },
        allAcademyAwards: []
      };

      const candidates = buildCandidateCategories(library, awardsData);
      expect(candidates.some((c) => c.label.includes('Best Actor'))).toBe(false);
    });

    it('keeps a movie that won via BOTH systems in TWO separate categories, never merged (bug report: "I don\'t want that. They should be separate")', () => {
      // Every one of these 4 movies wins Best Picture in BOTH systems.
      const winners = awardWinners('both', 4);
      const library = [...buildSolvableLibrary(), ...winners];
      const personalAwards = {};
      winners.forEach((e, i) => { personalAwards[2000 + i] = { categories: { bestPicture: { winner: { movieId: e.movie.id } } } }; });
      const awardsData = {
        personalAwards,
        allAcademyAwards: winners.map((e) => academyRecord(e.movie.id, 'Best Picture')),
        personalAwardName: 'Groskers'
      };

      const candidates = buildCandidateCategories(library, awardsData);
      const academyCategory = candidates.find((c) => c.label === 'Won Best Picture (Academy)');
      const personalCategory = candidates.find((c) => c.label === 'Won Best Picture (The Groskers)');

      expect(academyCategory).toBeTruthy();
      expect(personalCategory).toBeTruthy();
      expect(academyCategory.movies).toHaveLength(4);
      expect(personalCategory.movies).toHaveLength(4);
      // Confirm they're genuinely two distinct candidate objects, not one
      // shared/merged category counted twice.
      expect(academyCategory).not.toBe(personalCategory);
    });

    it('a movie that only won the Academy award (not personally) never counts toward the Personal category, and vice versa', () => {
      const academyOnly = awardWinners('aonly', 4);
      const personalOnly = awardWinners('ponly', 4);
      const library = [...buildSolvableLibrary(), ...academyOnly, ...personalOnly];
      const personalAwards = {};
      personalOnly.forEach((e, i) => { personalAwards[2000 + i] = { categories: { bestPicture: { winner: { movieId: e.movie.id } } } }; });
      const awardsData = {
        personalAwards,
        allAcademyAwards: academyOnly.map((e) => academyRecord(e.movie.id, 'Best Picture')),
        personalAwardName: 'Groskers'
      };

      const candidates = buildCandidateCategories(library, awardsData);
      const academyCategory = candidates.find((c) => c.label === 'Won Best Picture (Academy)');
      const personalCategory = candidates.find((c) => c.label === 'Won Best Picture (The Groskers)');

      expect(academyCategory.movies.map((e) => e.movie.id).sort()).toEqual(academyOnly.map((e) => e.movie.id).sort());
      expect(personalCategory.movies.map((e) => e.movie.id).sort()).toEqual(personalOnly.map((e) => e.movie.id).sort());
    });

    // Bug report: "when the connection is that the movies won a personal
    // award of mine you put in parentheses that it was 'personal'. You
    // should use the name of the awards there... you can add the 'the'."
    it('falls back to the default award name when personalAwardName is not set', () => {
      const winners = awardWinners('nodefault', 4);
      const library = [...buildSolvableLibrary(), ...winners];
      const personalAwards = {};
      winners.forEach((e, i) => { personalAwards[2000 + i] = { categories: { bestPicture: { winner: { movieId: e.movie.id } } } }; });

      const candidates = buildCandidateCategories(library, { personalAwards, allAcademyAwards: [] });

      expect(candidates.some((c) => c.label === 'Won Best Picture (The Oscar)')).toBe(true);
      // The old generic label is gone entirely.
      expect(candidates.some((c) => c.label.includes('(Personal)'))).toBe(false);
    });

    it('produces no awards categories at all when awardsData is omitted (graceful no-op, same as every other pre-existing call site)', () => {
      const library = buildSolvableLibrary();
      const candidates = buildCandidateCategories(library);
      expect(candidates.some((c) => c.kind === 'awards')).toBe(false);
    });
  });
});

describe('generateConnectionsPuzzle', () => {
  it('produces exactly 4 categories of 4 tiles each, 16 tiles total, no movie repeated', () => {
    const library = buildSolvableLibrary();
    const puzzle = generateConnectionsPuzzle(library, makeSeededRng(1));

    expect(puzzle).not.toBeNull();
    expect(puzzle.categories).toHaveLength(4);
    puzzle.categories.forEach((category) => expect(category.keys).toHaveLength(4));
    expect(puzzle.tiles).toHaveLength(16);

    const allKeys = puzzle.tiles.map((tile) => tile.key);
    expect(new Set(allKeys).size).toBe(16); // no duplicate movie across the whole puzzle
  });

  it('every tile\'s categoryLabel matches a category that actually contains its key', () => {
    const library = buildSolvableLibrary();
    const puzzle = generateConnectionsPuzzle(library, makeSeededRng(7));

    puzzle.tiles.forEach((tile) => {
      const category = puzzle.categories.find((c) => c.label === tile.categoryLabel);
      expect(category.keys).toContain(tile.key);
    });
  });

  it('is deterministic for a fixed rng', () => {
    const library = buildSolvableLibrary();
    const a = generateConnectionsPuzzle(library, makeSeededRng(42));
    const b = generateConnectionsPuzzle(library, makeSeededRng(42));
    expect(a).toEqual(b);
  });

  it('returns null when the library cannot support 4 non-overlapping categories', () => {
    const tiny = buildSolvableLibrary().slice(0, 3); // not even one full category
    expect(generateConnectionsPuzzle(tiny, makeSeededRng(1))).toBeNull();
  });

  it('tags every category with a difficulty tier/name/color', () => {
    const library = buildSolvableLibrary();
    const puzzle = generateConnectionsPuzzle(library, makeSeededRng(3));
    puzzle.categories.forEach((category) => {
      expect(category.difficulty).toBeTruthy();
      expect(category.difficulty.tier).toBeGreaterThanOrEqual(1);
      expect(category.difficulty.tier).toBeLessThanOrEqual(4);
      expect(category.difficulty.name).toBeTruthy();
      expect(category.difficulty.color).toBeTruthy();
    });
  });

  it('spans more than one difficulty tier when the library offers a choice of tiers (not "everything is purple")', () => {
    // buildSolvableLibrary's 4 movie-groups each offer candidates across
    // multiple tiers (decade/genre/director/cast), so a puzzle should be
    // able to spread across tiers rather than settling on just one.
    const library = buildSolvableLibrary();
    const puzzle = generateConnectionsPuzzle(library, makeSeededRng(11));
    const tiers = new Set(puzzle.categories.map((c) => c.difficulty.tier));
    expect(tiers.size).toBeGreaterThan(1);
  });
});

describe('CATEGORY_KIND_LABELS', () => {
  it('lists every candidate kind with a label and difficulty', () => {
    expect(CATEGORY_KIND_LABELS).toHaveLength(7);
    CATEGORY_KIND_LABELS.forEach((entry) => {
      expect(entry.label).toBeTruthy();
      expect(entry.tier).toBeGreaterThanOrEqual(1);
      expect(entry.color).toBeTruthy();
    });
  });
});

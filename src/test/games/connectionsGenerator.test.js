import { describe, it, expect } from 'vitest';
import { buildCandidateCategories, generateConnectionsPuzzle } from '@/assets/javascript/games/connectionsGenerator.js';
import { makeSeededRng } from '@/assets/javascript/games/gameUtils.js';

function entry ({ id, title, director, genre, year, cast = [], studio }) {
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
      production_companies: studio ? [{ name: studio }] : []
    }
  };
}

// A library with 4 clean, non-overlapping categories of exactly 4 movies
// each, plus enough padding for the "not enough data" test to have contrast.
function buildSolvableLibrary () {
  const entries = [];
  for (let i = 0; i < 4; i++) {
    entries.push(entry({ id: `nolan-${i}`, title: `Nolan Film ${i}`, director: 'Christopher Nolan', genre: 'Drama', year: 2000 + i, cast: [`Nolan Actor ${i}`] }));
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
});

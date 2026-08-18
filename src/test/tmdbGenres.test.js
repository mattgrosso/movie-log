// The bug this exists to prevent (Matt, 2026-08-18): filtering by horror
// returned Spider-Man, Harry Potter and superhero films — TMDB's most
// popular movies overall — because the genre id never reached the fetch and
// axios omitted `with_genres` entirely. Once that was guarded, horror
// returned nothing instead. Same root cause, two faces.
import { describe, it, expect } from 'vitest';
import { genreIdFor, TMDB_GENRE_IDS } from '../assets/javascript/tmdbGenres.js';

describe('genreIdFor', () => {
  it('knows the genre at the centre of the bug', () => {
    expect(genreIdFor('Horror')).toBe(27);
  });

  it('is indifferent to case and stray spacing, as chips are', () => {
    expect(genreIdFor('horror')).toBe(27);
    expect(genreIdFor('  Horror  ')).toBe(27);
    expect(genreIdFor('SCIENCE FICTION')).toBe(878);
  });

  it('accepts the ways people write science fiction', () => {
    expect(genreIdFor('Science Fiction')).toBe(878);
    expect(genreIdFor('sci-fi')).toBe(878);
    expect(genreIdFor('scifi')).toBe(878);
  });

  it('covers every genre TMDB actually has', () => {
    // If this list and TMDB's ever diverge, a chip silently stops working —
    // which is precisely how this got missed the first time.
    const expected = [
      'action', 'adventure', 'animation', 'comedy', 'crime', 'documentary',
      'drama', 'family', 'fantasy', 'history', 'horror', 'music', 'mystery',
      'romance', 'science fiction', 'thriller', 'tv movie', 'war', 'western'
    ];

    expected.forEach((name) => {
      expect(genreIdFor(name), `missing genre: ${name}`).toEqual(expect.any(Number));
    });
    expect(TMDB_GENRE_IDS.drama).toBe(18);
  });

  it('returns null for something that is not a genre, rather than guessing', () => {
    // The old code defaulted an unknown genre to 18 (Drama), so an
    // unrecognised chip quietly returned drama films.
    expect(genreIdFor('spiderman')).toBeNull();
    expect(genreIdFor('')).toBeNull();
    expect(genreIdFor(null)).toBeNull();
    expect(genreIdFor(27)).toBeNull();
  });
});

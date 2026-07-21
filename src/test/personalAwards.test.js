import { describe, it, expect } from 'vitest';
import { expandNomineeFromMinimal } from '@/assets/javascript/personalAwards.js';

function libraryEntry (id, title) {
  return { dbKey: `key-${id}`, movie: { id, title } };
}

describe('expandNomineeFromMinimal', () => {
  it('returns null for a null/undefined nominee', () => {
    expect(expandNomineeFromMinimal(null, [])).toBeNull();
    expect(expandNomineeFromMinimal(undefined, [])).toBeNull();
  });

  it('passes through an already-expanded (legacy) nominee unchanged', () => {
    const legacy = { name: 'Old Format', movie: { id: 1, title: 'X' } };
    expect(expandNomineeFromMinimal(legacy, [])).toBe(legacy);
  });

  it('reconstructs a person nominee, carrying character/directors/profilePath through', () => {
    const library = [libraryEntry(42, 'Target Movie')];
    const expanded = expandNomineeFromMinimal(
      { type: 'person', id: 'p1', name: 'Someone', movieId: 42, character: 'Lead', profilePath: '/p.jpg' },
      library
    );
    expect(expanded.name).toBe('Someone');
    expect(expanded.character).toBe('Lead');
    expect(expanded.details.profile_path).toBe('/p.jpg');
    expect(expanded.movie.title).toBe('Target Movie');
  });

  it('reconstructs a director nominee, carrying the directors field through', () => {
    const library = [libraryEntry(7, 'A Film')];
    const expanded = expandNomineeFromMinimal(
      { type: 'person', id: 'd1', name: 'A Director', movieId: 7, directors: [{ id: 'd1', name: 'A Director' }] },
      library
    );
    expect(expanded.directors).toEqual([{ id: 'd1', name: 'A Director' }]);
  });

  it('reconstructs a movie nominee as the full library entry', () => {
    const library = [libraryEntry(42, 'Target Movie')];
    const expanded = expandNomineeFromMinimal({ type: 'movie', movieId: 42 }, library);
    expect(expanded.movie.title).toBe('Target Movie');
  });

  it('returns null (does not throw) when the movie is no longer in the library', () => {
    expect(expandNomineeFromMinimal({ type: 'person', movieId: 999 }, [])).toBeNull();
    expect(expandNomineeFromMinimal({ type: 'movie', movieId: 999 }, [])).toBeNull();
  });

  it('returns the raw object for an unrecognized type', () => {
    const weird = { type: 'something-else', movieId: 1 };
    expect(expandNomineeFromMinimal(weird, [])).toBe(weird);
  });
});

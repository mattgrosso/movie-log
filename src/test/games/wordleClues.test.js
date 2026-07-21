import { describe, it, expect } from 'vitest';
import { compareGuessToTarget, buildTargetClues, unlockedClueCount, CLUE_INTERVAL } from '@/assets/javascript/games/wordleClues.js';

function entry (overrides = {}) {
  return {
    dbKey: overrides.dbKey || 'target',
    movie: {
      id: 1,
      title: 'Target Movie',
      poster_path: '/p.jpg',
      release_date: '2010-06-01',
      runtime: 120,
      crew: [{ name: 'Dir A', job: 'Director' }],
      genres: [{ name: 'Drama' }, { name: 'Thriller' }],
      ...overrides.movie
    }
  };
}

const ratingForFn = (e) => e.movie.id * 2; // arbitrary deterministic stand-in

describe('compareGuessToTarget', () => {
  it('marks isCorrect when the guess is the target itself', () => {
    const target = entry({ dbKey: 'x' });
    const clue = compareGuessToTarget(target, target, ratingForFn);
    expect(clue.isCorrect).toBe(true);
  });

  it('marks isCorrect false for a different movie, even with identical stats', () => {
    const target = entry({ dbKey: 'target' });
    const guess = entry({ dbKey: 'guess' });
    const clue = compareGuessToTarget(guess, target, ratingForFn);
    expect(clue.isCorrect).toBe(false);
  });

  it('reports year direction relative to the target', () => {
    const target = entry({ movie: { release_date: '2015-01-01' } });
    const earlierGuess = entry({ dbKey: 'g1', movie: { release_date: '2005-01-01' } });
    const laterGuess = entry({ dbKey: 'g2', movie: { release_date: '2020-01-01' } });

    expect(compareGuessToTarget(earlierGuess, target, ratingForFn).year.direction).toBe('up');
    expect(compareGuessToTarget(laterGuess, target, ratingForFn).year.direction).toBe('down');
  });

  it('flags decade match only when the decades are equal', () => {
    const target = entry({ movie: { release_date: '2015-01-01' } });
    const sameDecade = entry({ dbKey: 'g1', movie: { release_date: '2011-01-01' } });
    const otherDecade = entry({ dbKey: 'g2', movie: { release_date: '1999-01-01' } });

    expect(compareGuessToTarget(sameDecade, target, ratingForFn).decade.match).toBe(true);
    expect(compareGuessToTarget(otherDecade, target, ratingForFn).decade.match).toBe(false);
  });

  it('flags a director match when any director overlaps', () => {
    const target = entry({ movie: { crew: [{ name: 'Shared Director', job: 'Director' }] } });
    const sharedGuess = entry({ dbKey: 'g1', movie: { crew: [{ name: 'Shared Director', job: 'Director' }] } });
    const differentGuess = entry({ dbKey: 'g2', movie: { crew: [{ name: 'Other Director', job: 'Director' }] } });

    expect(compareGuessToTarget(sharedGuess, target, ratingForFn).director.match).toBe(true);
    expect(compareGuessToTarget(differentGuess, target, ratingForFn).director.match).toBe(false);
  });

  it('reports the specific overlapping director name(s) so a match can be "filled in", not just checked', () => {
    const target = entry({ movie: { crew: [{ name: 'Shared Director', job: 'Director' }, { name: 'Only In Target', job: 'Director' }] } });
    const guess = entry({ dbKey: 'g1', movie: { crew: [{ name: 'Shared Director', job: 'Director' }, { name: 'Only In Guess', job: 'Director' }] } });

    expect(compareGuessToTarget(guess, target, ratingForFn).director.matchedNames).toEqual(['Shared Director']);
  });

  it('reports shared genres and whether the genre sets fully match', () => {
    const target = entry({ movie: { genres: [{ name: 'Drama' }, { name: 'Thriller' }] } });
    const partial = entry({ dbKey: 'g1', movie: { genres: [{ name: 'Drama' }, { name: 'Comedy' }] } });
    const exact = entry({ dbKey: 'g2', movie: { genres: [{ name: 'Thriller' }, { name: 'Drama' }] } });

    const partialClue = compareGuessToTarget(partial, target, ratingForFn);
    expect(partialClue.genres.shared).toEqual(['Drama']);
    expect(partialClue.genres.allMatch).toBe(false);

    const exactClue = compareGuessToTarget(exact, target, ratingForFn);
    expect(exactClue.genres.allMatch).toBe(true);
  });

  it('reports runtime and yourRating direction via compareNumber semantics', () => {
    const target = entry({ movie: { runtime: 120, id: 5 } });
    const guess = entry({ dbKey: 'g1', movie: { runtime: 90, id: 2 } });
    const clue = compareGuessToTarget(guess, target, ratingForFn);
    expect(clue.runtime).toEqual({ value: 90, direction: 'up', match: false });
    expect(clue.yourRating.direction).toBe('up'); // ratingForFn(guess)=4 < ratingForFn(target)=10
  });
});

describe('buildTargetClues', () => {
  it('builds an ordered decade/director/genre/runtime clue list about the target', () => {
    const target = entry({
      movie: {
        release_date: '1995-03-01',
        crew: [{ name: 'Dir A', job: 'Director' }, { name: 'Dir B', job: 'Director' }],
        genres: [{ name: 'Comedy' }, { name: 'Drama' }],
        runtime: 105
      }
    });

    expect(buildTargetClues(target)).toEqual([
      'Released in the 1990s.',
      'Directed by Dir A / Dir B.',
      'One genre: Comedy.',
      'Runtime: 105 minutes.'
    ]);
  });

  it('skips a clue type the target has no data for', () => {
    const target = entry({ movie: { release_date: '1995-03-01', crew: [], genres: [], runtime: null } });
    expect(buildTargetClues(target)).toEqual(['Released in the 1990s.']);
  });
});

describe('unlockedClueCount', () => {
  it('unlocks nothing before the first interval of wrong guesses', () => {
    expect(unlockedClueCount(CLUE_INTERVAL - 1, 4)).toBe(0);
  });

  it('unlocks one more clue per interval of wrong guesses', () => {
    expect(unlockedClueCount(CLUE_INTERVAL, 4)).toBe(1);
    expect(unlockedClueCount(CLUE_INTERVAL * 2, 4)).toBe(2);
    expect(unlockedClueCount(CLUE_INTERVAL * 3, 4)).toBe(3);
  });

  it('never unlocks more clues than the target actually has', () => {
    expect(unlockedClueCount(CLUE_INTERVAL * 10, 4)).toBe(4);
  });
});

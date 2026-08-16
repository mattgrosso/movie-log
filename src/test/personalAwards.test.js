import { describe, it, expect } from 'vitest';
import { expandNomineeFromMinimal, awardNameWithThe, awardNameWithoutThe, awardNameSingular, awardsYearThreshold, awardsYearsWithProgress } from '@/assets/javascript/personalAwards.js';

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

describe('award name grammar helpers', () => {
  it('defaults to Oscar when no name is configured', () => {
    expect(awardNameWithThe()).toBe('The Oscar');
    expect(awardNameWithoutThe()).toBe('Oscar');
    expect(awardNameSingular()).toBe('Oscar');
  });

  it('adds "The" only when missing', () => {
    expect(awardNameWithThe('Groskers')).toBe('The Groskers');
    expect(awardNameWithThe('The Groskers')).toBe('The Groskers');
    expect(awardNameWithThe('the groskers')).toBe('the groskers');
  });

  it('strips a leading "The" case-insensitively', () => {
    expect(awardNameWithoutThe('The Groskers')).toBe('Groskers');
    expect(awardNameWithoutThe('the Groskers')).toBe('Groskers');
    expect(awardNameWithoutThe('Groskers')).toBe('Groskers');
  });

  it('singularizes a plural name, handling the -ies case', () => {
    expect(awardNameSingular('The Groskers')).toBe('Grosker');
    expect(awardNameSingular('The Smithies')).toBe('Smithy');
    expect(awardNameSingular('Cinema')).toBe('Cinema');
  });
});

describe('actingSiblingConflict (feedback: no lead + supporting nomination for the same person, same movie)', () => {
  const awardsData = {
    bestActor: { nominees: [{ type: 'person', id: 101, name: 'Double Dipper', movieId: 7 }] },
    bestSupportingActor: { nominees: [] }
  };

  it('flags the same person + same movie across the lead/supporting pair, both directions', async () => {
    const { actingSiblingConflict } = await import('@/assets/javascript/personalAwards.js');
    expect(actingSiblingConflict('bestSupportingActor', { name: 'Double Dipper', id: 101, movieId: 7 }, awardsData)).toBe('bestActor');
    const reversed = { bestSupportingActor: awardsData.bestActor, bestActor: { nominees: [] } };
    expect(actingSiblingConflict('bestActor', { name: 'Double Dipper', movieId: 7 }, reversed)).toBe('bestSupportingActor');
  });

  it('a DIFFERENT movie is not a conflict — busy years are legal', async () => {
    const { actingSiblingConflict } = await import('@/assets/javascript/personalAwards.js');
    expect(actingSiblingConflict('bestSupportingActor', { name: 'Double Dipper', movieId: 8 }, awardsData)).toBeNull();
  });

  it('a different person in the same movie is not a conflict', async () => {
    const { actingSiblingConflict } = await import('@/assets/javascript/personalAwards.js');
    expect(actingSiblingConflict('bestSupportingActor', { name: 'Someone Else', id: 999, movieId: 7 }, awardsData)).toBeNull();
  });

  it('actor/actress pairs are separate tracks, and non-acting categories never conflict', async () => {
    const { actingSiblingConflict } = await import('@/assets/javascript/personalAwards.js');
    expect(actingSiblingConflict('bestSupportingActress', { name: 'Double Dipper', movieId: 7 }, awardsData)).toBeNull();
    expect(actingSiblingConflict('bestDirector', { name: 'Double Dipper', movieId: 7 }, awardsData)).toBeNull();
  });

  it('matches by id when names are missing', async () => {
    const { actingSiblingConflict } = await import('@/assets/javascript/personalAwards.js');
    const data = { bestActor: { nominees: [{ id: 101, movieId: 7 }] }, bestSupportingActor: { nominees: [] } };
    expect(actingSiblingConflict('bestSupportingActor', { id: 101, movieId: 7 }, data)).toBe('bestActor');
  });
});

// Bug report 2026-08-15: the 10-movie year gate was "an arbitrary number
// that I came up with for me" — now a per-user setting.
describe('awardsYearThreshold', () => {
  it('defaults to 10 with no setting, junk, or out-of-range values', () => {
    expect(awardsYearThreshold(undefined)).toBe(10)
    expect(awardsYearThreshold({})).toBe(10)
    expect(awardsYearThreshold({ awardsYearThreshold: 'many' })).toBe(10)
    expect(awardsYearThreshold({ awardsYearThreshold: 0 })).toBe(10)
    expect(awardsYearThreshold({ awardsYearThreshold: -3 })).toBe(10)
  })

  it('honours a user-chosen threshold, floored to a whole number', () => {
    expect(awardsYearThreshold({ awardsYearThreshold: 1 })).toBe(1)
    expect(awardsYearThreshold({ awardsYearThreshold: 50 })).toBe(50)
    expect(awardsYearThreshold({ awardsYearThreshold: 3.7 })).toBe(3)
  })
})

// Feeds the year strip on /awards (Matt, 2026-08-16: "I'm not sure how to get
// to my awards view. If I wanna just look at a single year's awards").
describe('awardsYearsWithProgress', () => {
  const TOTAL = 13;

  function moviesFor (year, count, runtime = 100) {
    return Array.from({ length: count }, () => ({
      movie: { release_date: `${year}-06-15`, runtime }
    }));
  }

  function categories (completedCount) {
    const built = {};
    for (let i = 0; i < completedCount; i++) {
      built[`category${i}`] = { nominees: [{ movieId: 1 }], winner: { movieId: 1 } };
    }
    return built;
  }

  it('includes only years that clear the threshold, oldest first', () => {
    const entries = [...moviesFor(1997, 12), ...moviesFor(1994, 10), ...moviesFor(1998, 9)];

    expect(awardsYearsWithProgress(entries, {}, TOTAL).map((y) => y.year)).toEqual([1994, 1997]);
  });

  it('honours a custom threshold', () => {
    const entries = moviesFor(1997, 4);

    expect(awardsYearsWithProgress(entries, { awardsYearThreshold: 3 }, TOTAL)).toHaveLength(1);
    expect(awardsYearsWithProgress(entries, { awardsYearThreshold: 5 }, TOTAL)).toHaveLength(0);
  });

  it('does not let shorts push a year over the threshold', () => {
    const entries = [...moviesFor(1997, 6), ...moviesFor(1997, 6, 22)];

    expect(awardsYearsWithProgress(entries, {}, TOTAL)).toHaveLength(0);
  });

  // The whole reason this isn't the modal's `yearsEligibleForAwards`, which
  // drops finished years because it answers a different question.
  it('keeps a completed year in the list, so you can go back and look at it', () => {
    const settings = { personalAwards: { 1997: { completed: true, categories: categories(13) } } };
    const [year] = awardsYearsWithProgress(moviesFor(1997, 12), settings, TOTAL);

    expect(year.completed).toBe(true);
    expect(year.completedCategories).toBe(13);
  });

  it('reports partial progress, and counts a no-nominees category as done', () => {
    const settings = {
      personalAwards: {
        1997: {
          categories: {
            ...categories(3),
            bestAnimatedFeature: { noNominees: true },
            bestScore: { nominees: [{ movieId: 2 }] } // nominated, no winner yet
          }
        }
      }
    };
    const [year] = awardsYearsWithProgress(moviesFor(1997, 12), settings, TOTAL);

    expect(year.completedCategories).toBe(4);
    expect(year.started).toBe(true);
    expect(year.completed).toBe(false);
  });

  it('marks an untouched year as neither started nor complete', () => {
    const [year] = awardsYearsWithProgress(moviesFor(1997, 12), {}, TOTAL);

    expect(year).toMatchObject({ year: 1997, completedCategories: 0, started: false, completed: false });
  });

  it('is null-safe', () => {
    expect(awardsYearsWithProgress(null, null, TOTAL)).toEqual([]);
    expect(awardsYearsWithProgress([{ movie: {} }, {}], {}, TOTAL)).toEqual([]);
  });
});

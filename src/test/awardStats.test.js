import { describe, it, expect } from 'vitest';
import { collectAwardEntries, rankPeople, rankMovies, rankPeopleWithoutWins, rankSweeps, winStreaks, categoryOwners, longestWaits, rankUpsets } from '@/assets/javascript/awardStats.js';

function libraryEntry (id, title) {
  return { dbKey: `key-${id}`, movie: { id, title, poster_path: `/${id}.jpg` } };
}

const library = [libraryEntry(1, 'Film One'), libraryEntry(2, 'Film Two'), libraryEntry(3, 'Film Three')];

function person (name, movieId, id = name) {
  return { type: 'person', id, name, movieId };
}
function movie (movieId) {
  return { type: 'movie', movieId };
}

describe('collectAwardEntries', () => {
  it('collects wins and nominations across every year and category', () => {
    const personalAwards = {
      2020: {
        categories: {
          bestPicture: { nominees: [movie(1), movie(2)], winner: movie(1) },
          bestDirector: { nominees: [person('A Director', 1)], winner: person('A Director', 1) }
        }
      },
      2021: { categories: { bestPicture: { nominees: [movie(3)], winner: movie(3) } } }
    };

    const { wins, nominations } = collectAwardEntries(personalAwards, library);

    expect(wins).toHaveLength(3);
    expect(nominations).toHaveLength(4);
    expect(wins.map((w) => w.year).sort()).toEqual([2020, 2020, 2021]);
  });

  it('tolerates missing data - no awards, a year with no categories, an empty nominee list', () => {
    expect(collectAwardEntries(undefined, library)).toEqual({ wins: [], nominations: [] });
    expect(collectAwardEntries({ 2020: {} }, library)).toEqual({ wins: [], nominations: [] });
    const sparse = { 2020: { categories: { bestPicture: { winner: null } } } };
    expect(collectAwardEntries(sparse, library)).toEqual({ wins: [], nominations: [] });
  });

  it('skips nominees whose movie is no longer in the library', () => {
    const personalAwards = {
      2020: { categories: { bestPicture: { nominees: [movie(1), movie(999)], winner: movie(999) } } }
    };
    const { wins, nominations } = collectAwardEntries(personalAwards, library);

    expect(wins).toHaveLength(0);
    expect(nominations).toHaveLength(1);
  });
});

describe('rankPeople', () => {
  it('ranks by count, highest first, and ignores movie-type entries', () => {
    const personalAwards = {
      2019: { categories: { bestActor: { nominees: [person('Repeat Actor', 1), person('One Timer', 2), movie(1)] } } },
      2020: { categories: { bestActor: { nominees: [person('Repeat Actor', 2)] } } },
      2021: { categories: { bestActor: { nominees: [person('Repeat Actor', 3)] } } }
    };
    const { nominations } = collectAwardEntries(personalAwards, library);

    const ranked = rankPeople(nominations);
    expect(ranked).toHaveLength(1); // One Timer has a single nod, below the threshold
    expect(ranked[0]).toMatchObject({ name: 'Repeat Actor', count: 3 });
    expect(ranked[0].entries).toHaveLength(3);
  });

  it('counts the same person across DIFFERENT categories', () => {
    const personalAwards = {
      2020: {
        categories: {
          bestDirector: { nominees: [person('Multi Talent', 1)] },
          bestScreenplayOrWriting: { nominees: [person('Multi Talent', 1)] }
        }
      }
    };
    const { nominations } = collectAwardEntries(personalAwards, library);
    expect(rankPeople(nominations)[0]).toMatchObject({ name: 'Multi Talent', count: 2 });
  });

  it('breaks ties alphabetically so the order is stable', () => {
    const personalAwards = {
      2020: { categories: { bestActor: { nominees: [person('Zoe', 1), person('Adam', 1)] } } },
      2021: { categories: { bestActor: { nominees: [person('Zoe', 2), person('Adam', 2)] } } }
    };
    const { nominations } = collectAwardEntries(personalAwards, library);
    expect(rankPeople(nominations).map((p) => p.name)).toEqual(['Adam', 'Zoe']);
  });

  it('respects limit and minCount', () => {
    const personalAwards = {
      2020: { categories: { bestActor: { nominees: [person('Solo', 1)] } } }
    };
    const { nominations } = collectAwardEntries(personalAwards, library);
    expect(rankPeople(nominations)).toHaveLength(0); // one nod, below default minCount
    expect(rankPeople(nominations, { minCount: 1 })).toHaveLength(1);
  });
});

describe('derived shapes (feedback: "identify some more interesting data shapes")', () => {
  const win = (year, categoryKey, expanded) => ({ year, categoryKey, expanded });
  const personExp = (name, movieId = 1) => ({ name, movieId, movie: { id: movieId, title: `Film ${movieId}` } });
  const movieExp = (movieId, title = `Film ${movieId}`) => ({ movie: { id: movieId, title } });

  describe('rankSweeps', () => {
    it('counts a single film\'s wins within ONE year, people included', () => {
      const wins = [
        win(1997, 'bestPicture', movieExp(11, 'Titanic')),
        win(1997, 'bestDirector', personExp('James Cameron', 11)),
        win(1997, 'bestCinematography', movieExp(11, 'Titanic')),
        win(1998, 'bestPicture', movieExp(11, 'Titanic')), // different year: separate
        win(1997, 'bestActor', personExp('Someone', 22))
      ];
      const sweeps = rankSweeps(wins);
      expect(sweeps).toHaveLength(1);
      expect(sweeps[0]).toMatchObject({ movieId: 11, year: 1997, count: 3 });
    });
  });

  describe('winStreaks', () => {
    it('finds the longest consecutive-year run per person', () => {
      const wins = [
        win(1994, 'bestDirector', personExp('Streaky', 1)),
        win(1995, 'bestDirector', personExp('Streaky', 2)),
        win(1996, 'bestActor', personExp('Streaky', 3)),
        win(1999, 'bestDirector', personExp('Streaky', 4)), // gap breaks the run
        win(2001, 'bestActor', personExp('One Off', 5))
      ];
      const streaks = winStreaks(wins);
      expect(streaks).toHaveLength(1);
      expect(streaks[0]).toMatchObject({ name: 'Streaky', length: 3, startYear: 1994, endYear: 1996 });
    });

    it('two wins in the SAME year is not a streak', () => {
      const wins = [
        win(1994, 'bestDirector', personExp('Doubled', 1)),
        win(1994, 'bestScreenplayOrWriting', personExp('Doubled', 1))
      ];
      expect(winStreaks(wins)).toEqual([]);
    });
  });

  describe('categoryOwners', () => {
    it('ranks (person, category) pairs — scattered wins across categories do not count together', () => {
      const wins = [
        win(1990, 'bestDirector', personExp('Auteur', 1)),
        win(1993, 'bestDirector', personExp('Auteur', 2)),
        win(1998, 'bestDirector', personExp('Auteur', 3)),
        win(1991, 'bestActor', personExp('Auteur', 4)),
        win(1992, 'bestActor', personExp('Spread', 5)),
        win(1994, 'bestDirector', personExp('Spread', 6))
      ];
      const owners = categoryOwners(wins, { minCount: 3 });
      expect(owners).toHaveLength(1);
      expect(owners[0]).toMatchObject({ name: 'Auteur', categoryKey: 'bestDirector', count: 3 });
    });
  });

  describe('longestWaits', () => {
    it('measures first nomination to first win', () => {
      const nominations = [
        win(1985, 'bestActor', personExp('Overdue', 1)),
        win(1990, 'bestActor', personExp('Overdue', 2)),
        win(1994, 'bestActor', personExp('Overdue', 3)),
        win(1994, 'bestActor', personExp('Instant', 4))
      ];
      const wins = [
        win(1994, 'bestActor', personExp('Overdue', 3)),
        win(1994, 'bestActor', personExp('Instant', 4))
      ];
      const waits = longestWaits(nominations, wins);
      expect(waits).toHaveLength(1);
      expect(waits[0]).toMatchObject({ name: 'Overdue', wait: 9, firstNomination: 1985, firstWin: 1994 });
    });
  });

  describe('rankUpsets', () => {
    it('flags a category where your highest-rated nominee lost, ranked by rating gap', () => {
      const wins = [win(1997, 'bestPicture', movieExp(11, 'The Winner'))];
      const nominations = [
        win(1997, 'bestPicture', movieExp(11, 'The Winner')),
        win(1997, 'bestPicture', movieExp(22, 'The Robbed')),
        win(1997, 'bestPicture', movieExp(33, 'Also Ran'))
      ];
      const ratings = new Map([[11, 7.2], [22, 9.1], [33, 8.0]]);

      const upsets = rankUpsets(wins, nominations, (id) => ratings.get(id) ?? null);

      expect(upsets).toHaveLength(1);
      expect(upsets[0].robbed.movie.title).toBe('The Robbed');
      expect(upsets[0].gap).toBeCloseTo(1.9);
    });

    it('no upset when the winner was also your best-rated, or the gap is trivial', () => {
      const wins = [win(1997, 'bestPicture', movieExp(11))];
      const nominations = [
        win(1997, 'bestPicture', movieExp(11)),
        win(1997, 'bestPicture', movieExp(22))
      ];
      expect(rankUpsets(wins, nominations, (id) => (id === 11 ? 9 : 8))).toEqual([]);
      expect(rankUpsets(wins, nominations, (id) => (id === 11 ? 8 : 8.2))).toEqual([]); // gap under 0.5
    });
  });
});

describe('rankPeopleWithoutWins (user request: "who has the most nominations without a win")', () => {
  it('ranks repeat nominees who have never won, excluding anyone with a win anywhere', () => {
    const personalAwards = {
      2019: { categories: { bestActor: { nominees: [person('Always Nominated', 1), person('Eventual Winner', 2)], winner: person('Eventual Winner', 2) } } },
      2020: { categories: { bestActor: { nominees: [person('Always Nominated', 2), person('Eventual Winner', 3)] } } },
      2021: { categories: { bestActor: { nominees: [person('Always Nominated', 3)] } } }
    };
    const { wins, nominations } = collectAwardEntries(personalAwards, library);

    const ranked = rankPeopleWithoutWins(nominations, wins);

    // Eventual Winner has three nominations too, but one win anywhere
    // disqualifies — this is the perpetually-passed-over list.
    expect(ranked.map((p) => p.name)).toEqual(['Always Nominated']);
    expect(ranked[0].count).toBe(3);
  });

  it('a win in a DIFFERENT category still disqualifies', () => {
    const personalAwards = {
      2020: {
        categories: {
          bestActor: { nominees: [person('Cross Winner', 1), person('Pure Nominee', 2)] },
          bestDirector: { nominees: [person('Cross Winner', 1)], winner: person('Cross Winner', 1) }
        }
      },
      2021: { categories: { bestActor: { nominees: [person('Cross Winner', 2), person('Pure Nominee', 3)] } } }
    };
    const { wins, nominations } = collectAwardEntries(personalAwards, library);

    expect(rankPeopleWithoutWins(nominations, wins).map((p) => p.name)).toEqual(['Pure Nominee']);
  });

  it('applies the same repeat threshold as the other leaderboards', () => {
    const personalAwards = {
      2020: { categories: { bestActor: { nominees: [person('Single Nod', 1)] } } }
    };
    const { wins, nominations } = collectAwardEntries(personalAwards, library);

    expect(rankPeopleWithoutWins(nominations, wins)).toHaveLength(0);
    expect(rankPeopleWithoutWins(nominations, wins, { minCount: 1 })).toHaveLength(1);
  });

  it('tolerates empty inputs', () => {
    expect(rankPeopleWithoutWins([], [])).toEqual([]);
    expect(rankPeopleWithoutWins(undefined, undefined)).toEqual([]);
  });
});

describe('rankMovies', () => {
  it("counts a PERSON's award toward the film they were nominated for", () => {
    const personalAwards = {
      2020: {
        categories: {
          bestPicture: { nominees: [movie(1)], winner: movie(1) },
          bestDirector: { nominees: [person('Its Director', 1)], winner: person('Its Director', 1) },
          bestActor: { nominees: [person('Its Star', 1)], winner: person('Its Star', 1) }
        }
      }
    };
    const { wins } = collectAwardEntries(personalAwards, library);

    const ranked = rankMovies(wins);
    expect(ranked[0]).toMatchObject({ movieId: 1, count: 3 });
    expect(ranked[0].movie.title).toBe('Film One');
  });

  it('separates two films by id even if they somehow share a title', () => {
    const remakeLibrary = [libraryEntry(1, 'Same Title'), { dbKey: 'key-2', movie: { id: 2, title: 'Same Title', poster_path: '/2.jpg' } }];
    const personalAwards = {
      2020: { categories: { bestPicture: { nominees: [movie(1), movie(2)] } } },
      2021: { categories: { bestPicture: { nominees: [movie(1), movie(2)] } } }
    };
    const { nominations } = collectAwardEntries(personalAwards, remakeLibrary);

    const ranked = rankMovies(nominations);
    expect(ranked).toHaveLength(2);
    expect(ranked.every((film) => film.count === 2)).toBe(true);
  });

  it('nomination counts include wins, matching how ceremonies are tallied', () => {
    const personalAwards = {
      2020: {
        categories: {
          bestPicture: { nominees: [movie(1), movie(2)], winner: movie(1) },
          bestEditing: { nominees: [movie(1)], winner: movie(1) }
        }
      }
    };
    const { wins, nominations } = collectAwardEntries(personalAwards, library);

    expect(rankMovies(wins, { minCount: 1 })[0]).toMatchObject({ movieId: 1, count: 2 });
    expect(rankMovies(nominations, { minCount: 1 })[0]).toMatchObject({ movieId: 1, count: 2 });
  });
});

// "At the top of the awards page it says the name of the award and then the
// year. Since the shape of the award name is explicitly set to match the
// Oscars, we should make that header read the 2026 Oscars, not the Oscars
// 2026." (2026-08-17)
describe('award heading word order', () => {
  // Mirrors PersonalAwardsModal.awardHeading.
  const heading = (name, year) => {
    const leading = /^(the)\s+/i.exec(name || '');
    return leading
      ? `${leading[1]} ${year} ${(name || '').slice(leading[0].length)}`
      : `${name} ${year}`;
  };

  it('slots the year between the article and the name', () => {
    expect(heading('The Oscars', 2026)).toBe('The 2026 Oscars');
    expect(heading('The Groskers', 1999)).toBe('The 1999 Groskers');
  });

  it('keeps the article capitalised as the user wrote it', () => {
    expect(heading('the Oscars', 2026)).toBe('the 2026 Oscars');
  });

  // A name that doesn't open with an article has nowhere to slot the year.
  it('falls back to trailing the year for a name with no article', () => {
    expect(heading('Groskers', 2026)).toBe('Groskers 2026');
    expect(heading('Theatre Awards', 2026)).toBe('Theatre Awards 2026');
  });
});

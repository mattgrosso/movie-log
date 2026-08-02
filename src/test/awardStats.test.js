import { describe, it, expect } from 'vitest';
import { collectAwardEntries, rankPeople, rankMovies } from '@/assets/javascript/awardStats.js';

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

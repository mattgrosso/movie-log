// "It could see what you were filtering with and give movies related to
// that filter that you have not watched. It's like a little watch list with
// each filter" (Matt, 2026-08-18).
//
// The old ranking was raw popularity behind a linear cutoff that mostly
// cancelled itself out. These are the properties the replacement has to
// hold: quality that survives sample size, your own taste, and never
// suggesting something you've already dealt with.
import { describe, it, expect } from 'vitest';
import {
  weightedRating,
  genreAffinity,
  affinityFor,
  scoreCandidate,
  rankMoreFrom
} from '../assets/javascript/moreFromRanking.js';

const film = (overrides = {}) => ({
  id: 1,
  title: 'A Film',
  poster_path: '/p.jpg',
  vote_average: 7,
  vote_count: 1000,
  popularity: 50,
  genre_ids: [],
  ...overrides
});

describe('weightedRating', () => {
  it('trusts a score backed by a lot of votes', () => {
    expect(weightedRating(8.4, 20000)).toBeGreaterThan(8.3);
  });

  it('pulls a small-sample score toward the crowd mean', () => {
    // The headline number is higher, but 40 people said it.
    expect(weightedRating(9.4, 40)).toBeLessThan(weightedRating(8.4, 20000));
  });

  it('treats an unrated film as merely average rather than terrible', () => {
    expect(weightedRating(0, 0)).toBeCloseTo(6.6, 5);
    expect(weightedRating(undefined, undefined)).toBeCloseTo(6.6, 5);
  });
});

describe('genreAffinity', () => {
  const entry = (score, genreIds) => ({
    score,
    movie: { genres: genreIds.map((id) => ({ id, name: `g${id}` })) }
  });
  const getScore = (item) => item.score;

  it('scores a genre you rate above your average over 0.5, and below under', () => {
    const library = [
      // Horror (1): consistently loved. Comedy (2): consistently not.
      entry(9, [1]), entry(9, [1]), entry(9, [1]),
      entry(4, [2]), entry(4, [2]), entry(4, [2])
    ];

    const affinity = genreAffinity(library, getScore);

    expect(affinity.get(1)).toBeGreaterThan(0.5);
    expect(affinity.get(2)).toBeLessThan(0.5);
  });

  it('ignores a genre with too few films to mean anything', () => {
    const library = [
      entry(9, [1]), entry(9, [1]), entry(9, [1]),
      entry(2, [99]) // one lonely film
    ];

    expect(genreAffinity(library, getScore).has(99)).toBe(false);
  });

  it('returns nothing for an empty library instead of throwing', () => {
    expect(genreAffinity([], getScore).size).toBe(0);
    expect(genreAffinity(null, getScore).size).toBe(0);
  });
});

describe('affinityFor', () => {
  it('is neutral when a film has no genre you have an opinion on', () => {
    expect(affinityFor(film({ genre_ids: [42] }), new Map())).toBe(0.5);
  });

  it('averages the genres it does know', () => {
    const affinity = new Map([[1, 1], [2, 0]]);
    expect(affinityFor(film({ genre_ids: [1, 2] }), affinity)).toBe(0.5);
    expect(affinityFor(film({ genre_ids: [1] }), affinity)).toBe(1);
  });

  it('reads library-shaped genres as well as TMDB genre_ids', () => {
    const affinity = new Map([[1, 1]]);
    expect(affinityFor({ genres: [{ id: 1 }] }, affinity)).toBe(1);
  });
});

describe('scoreCandidate', () => {
  it('prefers the better-reviewed of two equally popular films', () => {
    const good = scoreCandidate(film({ vote_average: 8.5 }), { popularityCeiling: 100 });
    const poor = scoreCandidate(film({ vote_average: 5.0 }), { popularityCeiling: 100 });

    expect(good).toBeGreaterThan(poor);
  });

  it('lets your taste outweigh a modest popularity gap', () => {
    const affinity = new Map([[1, 1]]);
    const yourGenre = scoreCandidate(
      film({ genre_ids: [1], popularity: 20 }), { affinity, popularityCeiling: 200 }
    );
    const merelyPopular = scoreCandidate(
      film({ genre_ids: [2], popularity: 200 }), { affinity, popularityCeiling: 200 }
    );

    expect(yourGenre).toBeGreaterThan(merelyPopular);
  });

  it('does not let one blockbuster flatten everything below it', () => {
    // The old linear cutoff did exactly this: a single 900-popularity film
    // pushed the threshold above the entire rest of the field.
    const modest = scoreCandidate(film({ popularity: 30 }), { popularityCeiling: 900 });
    expect(modest).toBeGreaterThan(0.4);
  });
});

describe('rankMoreFrom', () => {
  it('never suggests something already in the library or a hat', () => {
    const ranked = rankMoreFrom(
      [film({ id: 1 }), film({ id: 2 }), film({ id: 3 })],
      { exclude: new Set([1, 3]) }
    );

    expect(ranked.map((movie) => movie.id)).toEqual([2]);
  });

  it('matches an excluded id whether it is a number or a string', () => {
    // Hat ids arrive as object keys, which are strings.
    const ranked = rankMoreFrom([film({ id: 550 })], { exclude: new Set(['550']) });
    expect(ranked).toEqual([]);
  });

  it('drops anything with no artwork — the row is all posters', () => {
    const ranked = rankMoreFrom([film({ id: 1, poster_path: null }), film({ id: 2 })], {});
    expect(ranked.map((movie) => movie.id)).toEqual([2]);
  });

  it('removes duplicates from a multi-page fetch', () => {
    const ranked = rankMoreFrom([film({ id: 7 }), film({ id: 7 })], {});
    expect(ranked).toHaveLength(1);
  });

  it('puts the best first, not the most popular', () => {
    const ranked = rankMoreFrom([
      film({ id: 1, title: 'Loud', vote_average: 5.2, vote_count: 8000, popularity: 400 }),
      film({ id: 2, title: 'Good', vote_average: 8.3, vote_count: 8000, popularity: 60 })
    ], {});

    expect(ranked[0].title).toBe('Good');
  });

  it('honours the limit', () => {
    const many = Array.from({ length: 40 }, (_, index) => film({ id: index + 1 }));
    expect(rankMoreFrom(many, { limit: 18 })).toHaveLength(18);
  });

  it('returns an empty row rather than throwing on nothing', () => {
    expect(rankMoreFrom(null, {})).toEqual([]);
    expect(rankMoreFrom([], {})).toEqual([]);
  });
});

// Matt, 2026-08-18: "the next one I tried was just horror... mostly what it
// gave me was actually some more Spiderman, but then some Harry Potter and
// some other superhero stuff."
//
// Neither the genre nor the keyword path returns anything like that for
// horror — those were the PREVIOUS filter's results arriving late. Each
// fetch is several sequential TMDB pages, so switching filters leaves two
// in flight, and whichever finished last used to win. The guard is a
// sequence number; this is the property it has to hold.
describe('only the newest filter may write results', () => {
  // A miniature of fetchUnratedMoviesBySearchFilter's guard.
  function makeSection () {
    return {
      results: [],
      requestId: 0,
      async run (label, finishAfterMs, clock) {
        const id = ++this.requestId;
        await clock(finishAfterMs);
        if (this.requestId !== id) return; // superseded
        this.results = [label];
      }
    };
  }

  const clock = (waits) => (ms) => new Promise((resolve) => waits.push({ ms, resolve }));

  it('discards a slow earlier filter that lands after a newer one', async () => {
    const section = makeSection();
    const waits = [];
    const tick = clock(waits);

    const spiderman = section.run('spiderman', 300, tick); // three pages
    const horror = section.run('horror', 100, tick); // lands first

    waits.find((w) => w.ms === 100).resolve();
    await horror;
    expect(section.results).toEqual(['horror']);

    // The older request finally answers — and must be ignored.
    waits.find((w) => w.ms === 300).resolve();
    await spiderman;
    expect(section.results).toEqual(['horror']);
  });

  it('still shows the newest filter when responses arrive in order', async () => {
    const section = makeSection();
    const waits = [];
    const tick = clock(waits);

    const first = section.run('spiderman', 100, tick);
    waits[0].resolve();
    await first;
    expect(section.results).toEqual(['spiderman']);

    const second = section.run('horror', 100, tick);
    waits[1].resolve();
    await second;
    expect(section.results).toEqual(['horror']);
  });
});

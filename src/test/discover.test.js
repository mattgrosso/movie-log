import { describe, it, expect } from 'vitest';
import { rewatchCandidates, favoritePeople, rankWatchlistCandidates, ratedTmdbIds } from '@/assets/javascript/discover.js';

const NOW = new Date('2026-08-15T00:00:00Z').getTime();
const yearsAgo = (years) => NOW - years * 365.25 * 24 * 3600 * 1000;

function entry (id, title, { rating = 8, watched = yearsAgo(3), crew = [], cast = [] } = {}) {
  return {
    dbKey: `key-${id}`,
    movie: { id, title, poster_path: '/p.jpg', crew, cast },
    ratings: [{ calculatedTotal: rating, date: watched }]
  };
}
const ratingOf = (e) => ({ calculatedTotal: e.ratings[0].calculatedTotal });

describe('rewatchCandidates', () => {
  it('surfaces loved-but-long-unwatched movies, best score first', () => {
    const entries = [
      entry(1, 'Loved, long ago', { rating: 9, watched: yearsAgo(6) }),
      entry(2, 'Loved, recent', { rating: 9.5, watched: yearsAgo(0.2) }),
      entry(3, 'Meh, long ago', { rating: 5, watched: yearsAgo(8) }),
      entry(4, 'Loved, medium ago', { rating: 8, watched: yearsAgo(2) })
    ];

    const list = rewatchCandidates(entries, ratingOf, NOW);

    expect(list.map((c) => c.entry.movie.title)).toEqual(['Loved, long ago', 'Loved, medium ago']);
    expect(list[0].yearsSince).toBeCloseTo(6, 0);
  });

  it('quality outranks sheer age: a 9 from 3 years beats a 7.2 from 8 years', () => {
    const entries = [
      entry(1, 'Great, 3y', { rating: 9, watched: yearsAgo(3) }),
      entry(2, 'Okay, 8y', { rating: 7.2, watched: yearsAgo(8) })
    ];
    const list = rewatchCandidates(entries, ratingOf, NOW);
    expect(list[0].entry.movie.title).toBe('Great, 3y');
  });

  it('skips entries with no readable rating or watch date, and respects the cap', () => {
    const entries = [
      { dbKey: 'broken', movie: { id: 99, title: 'No ratings' }, ratings: [] },
      ...Array.from({ length: 30 }, (_, i) => entry(i, `M${i}`, { rating: 8, watched: yearsAgo(2 + i * 0.1) }))
    ];
    const list = rewatchCandidates(entries, (e) => ({ calculatedTotal: e.ratings[0]?.calculatedTotal }), NOW);
    expect(list).toHaveLength(24);
  });

  it('accepts string dates as well as epoch numbers', () => {
    const stringDated = entry(1, 'String date', { rating: 8.5 });
    stringDated.ratings[0].date = '2020-06-15T12:00:00Z';
    const list = rewatchCandidates([stringDated], ratingOf, NOW);
    expect(list).toHaveLength(1);
  });
});

describe('favoritePeople', () => {
  const crewFor = (name) => [{ job: 'Director', name }];

  it('ranks directors by average rating weighted by how many of their movies you rated', () => {
    const entries = [
      entry(1, 'A', { rating: 9, crew: crewFor('Consistent Great') }),
      entry(2, 'B', { rating: 8.6, crew: crewFor('Consistent Great') }),
      entry(3, 'C', { rating: 8.8, crew: crewFor('Consistent Great') }),
      entry(4, 'D', { rating: 9.6, crew: crewFor('One Hit') }),
      entry(5, 'E', { rating: 9.5, crew: crewFor('One Hit') })
    ];

    const people = favoritePeople(entries, ratingOf, { role: 'director' });

    // One Hit's average is higher, but Consistent Great's three loved
    // movies outweigh via the log2(count+1) factor.
    expect(people[0].name).toBe('Consistent Great');
    expect(people[0].count).toBe(3);
  });

  it('requires a minimum body of work — a single rated movie is not a favorite yet', () => {
    const entries = [entry(1, 'A', { rating: 10, crew: crewFor('Once Only') })];
    expect(favoritePeople(entries, ratingOf, { role: 'director' })).toEqual([]);
  });

  it('actor mode reads top-billed cast only', () => {
    const bigCast = Array.from({ length: 12 }, (_, i) => ({ name: `Actor ${i}` }));
    const entries = [
      entry(1, 'A', { rating: 9, cast: bigCast }),
      entry(2, 'B', { rating: 9, cast: bigCast })
    ];
    const people = favoritePeople(entries, ratingOf, { role: 'actor', cap: 20 });
    expect(people.map((p) => p.name)).toContain('Actor 0');
    expect(people.map((p) => p.name)).not.toContain('Actor 11'); // beyond castDepth
  });

  it('counts a person once per movie even if credited twice', () => {
    const entries = [
      entry(1, 'A', { rating: 8, crew: [...crewFor('Double Credit'), ...crewFor('Double Credit')] }),
      entry(2, 'B', { rating: 8, crew: crewFor('Double Credit') })
    ];
    expect(favoritePeople(entries, ratingOf, { role: 'director' })[0].count).toBe(2);
  });
});

describe('rankWatchlistCandidates', () => {
  const tmdb = (id, title, { votes = 1000, avg = 8, release = '2015-06-15', adult = false } = {}) =>
    ({ id, title, vote_count: votes, vote_average: avg, release_date: release, adult });

  it('drops already-rated, unreleased, low-vote and adult titles, and dedupes', () => {
    const rated = new Set([1]);
    const credits = [
      tmdb(1, 'Already seen'),
      tmdb(2, 'Good'),
      tmdb(2, 'Good duplicate'),
      tmdb(3, 'Unreleased', { release: '2030-01-01' }),
      tmdb(4, 'No date', { release: '' }),
      tmdb(5, 'Obscure', { votes: 3 }),
      tmdb(6, 'Adult', { adult: true })
    ];

    const list = rankWatchlistCandidates(credits, rated, NOW);

    expect(list.map((m) => m.id)).toEqual([2]);
  });

  it('vote volume weights the score: a well-loved popular film beats a slightly higher obscure one', () => {
    const credits = [
      tmdb(1, 'Popular', { votes: 12000, avg: 7.9 }),
      tmdb(2, 'Niche', { votes: 60, avg: 8.6 })
    ];
    const list = rankWatchlistCandidates(credits, new Set(), NOW);
    expect(list[0].title).toBe('Popular');
  });

  it('caps the list', () => {
    const credits = Array.from({ length: 40 }, (_, i) => tmdb(i, `M${i}`));
    expect(rankWatchlistCandidates(credits, new Set(), NOW)).toHaveLength(12);
  });
});

describe('ratedTmdbIds', () => {
  it('collects numeric TMDB ids and skips offline placeholders', () => {
    const ids = ratedTmdbIds([
      entry(550, 'Fight Club'),
      { dbKey: 'x', movie: { id: 'offline-abc', title: 'Placeholder' }, ratings: [] }
    ]);
    expect(ids.has(550)).toBe(true);
    expect(ids.size).toBe(1);
  });
});

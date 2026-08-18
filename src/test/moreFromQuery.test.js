// "Sometimes I have more than one chip... right now I just searched for
// horror, and I searched for comedy. Can we filter the more from list for
// more than one chip?" (Matt, 2026-08-18).
//
// It couldn't: the row was driven by whichever single chip won a priority
// list. These are the rules for asking TMDB the combined question instead.
import { describe, it, expect } from 'vitest';
import {
  partitionFilters,
  hasDiscoverableFilters,
  releaseWindow,
  discoverParams,
  matchesLocalConstraints,
  intersectById,
  describeFilters
} from '../assets/javascript/moreFromQuery.js';

const chip = (type, value, extra = {}) => ({ type, value, display: value, ...extra });

describe('partitionFilters', () => {
  it('sorts chips by what TMDB can be asked about', () => {
    const groups = partitionFilters([
      chip('genre', 'Horror', { genreId: 27 }),
      chip('genre', 'Comedy', { genreId: 35 }),
      chip('person', 'Sofia Coppola'),
      chip('general', 'spiderman'),
      chip('tag', 'rewatch')
    ]);

    expect(groups.genres).toHaveLength(2);
    expect(groups.people).toHaveLength(1);
    expect(groups.texts).toHaveLength(1);
    // A tag is your own label on your own library — TMDB has never heard
    // of it and can't narrow a suggestion by it.
    expect(groups.local).toHaveLength(1);
  });

  it('survives junk in the chip list', () => {
    expect(() => partitionFilters([null, {}, undefined])).not.toThrow();
    expect(partitionFilters(null).genres).toEqual([]);
  });
});

describe('hasDiscoverableFilters', () => {
  it('is true when there is something to ask TMDB', () => {
    expect(hasDiscoverableFilters(partitionFilters([chip('genre', 'Horror')]))).toBe(true);
  });

  it('is false when only your own tags are active', () => {
    expect(hasDiscoverableFilters(partitionFilters([chip('tag', 'rewatch')]))).toBe(false);
  });
});

describe('releaseWindow', () => {
  it('turns a single year into that year', () => {
    const window = releaseWindow(partitionFilters([chip('year', '1994')]));
    expect(window).toMatchObject({ gte: '1994-01-01', lte: '1994-12-31', impossible: false });
  });

  it('narrows to the overlap of a year and a decade', () => {
    const window = releaseWindow(partitionFilters([
      chip('yearRange', { startYear: 1990, endYear: 1999 }),
      chip('year', '1994')
    ]));

    expect(window).toMatchObject({ gte: '1994-01-01', lte: '1994-12-31' });
  });

  it('says plainly when two chips cannot both be true', () => {
    // 1994 AND 1997 is nothing at all; quietly honouring one would be a lie.
    const window = releaseWindow(partitionFilters([chip('year', '1994'), chip('year', '1997')]));
    expect(window.impossible).toBe(true);
  });

  it('is open at both ends when no year is involved', () => {
    expect(releaseWindow(partitionFilters([chip('genre', 'Horror')])))
      .toMatchObject({ gte: null, lte: null, impossible: false });
  });
});

describe('discoverParams', () => {
  it('ANDs two genres into one query — the whole point', () => {
    // Comma is AND in TMDB's discover: horror-comedies, not horror or comedy.
    expect(discoverParams({ genreIds: [27, 35] }).with_genres).toBe('27,35');
  });

  it('combines different kinds of constraint at once', () => {
    const params = discoverParams({
      genreIds: [27],
      personIds: [1234],
      companyIds: [420],
      keywordIds: [999],
      window: { gte: '1990-01-01', lte: '1999-12-31' }
    });

    expect(params).toMatchObject({
      with_genres: '27',
      with_people: '1234',
      with_companies: '420',
      with_keywords: '999',
      'primary_release_date.gte': '1990-01-01',
      'primary_release_date.lte': '1999-12-31'
    });
  });

  it('omits what it has nothing to say about', () => {
    const params = discoverParams({ genreIds: [27] });
    // An undefined param is dropped by axios, which is exactly how a genre
    // fetch once turned into "the most popular films on TMDB".
    expect(params).not.toHaveProperty('with_people');
    expect(params).not.toHaveProperty('primary_release_date.lte');
  });

  it('lets an explicit year beat the section\'s "nothing too new" rule', () => {
    const params = discoverParams({
      genreIds: [27],
      window: { gte: '2025-01-01', lte: '2025-12-31' },
      notNewerThan: '2024-08-18'
    });

    // Asking for 2025 and being told about 2019 is not an answer.
    expect(params['primary_release_date.lte']).toBe('2024-08-18');
    expect(params['primary_release_date.gte']).toBe('2025-01-01');
  });
});

describe('matchesLocalConstraints', () => {
  const horrorComedy = { genre_ids: [27, 35], release_date: '1994-06-01' };

  it('keeps a film carrying every required genre', () => {
    expect(matchesLocalConstraints(horrorComedy, { genreIds: [27, 35] })).toBe(true);
  });

  it('rejects a film missing one of them — chips are AND, not OR', () => {
    expect(matchesLocalConstraints({ genre_ids: [27] }, { genreIds: [27, 35] })).toBe(false);
  });

  it('honours the release window', () => {
    const window = { gte: '1990-01-01', lte: '1999-12-31' };
    expect(matchesLocalConstraints(horrorComedy, { window })).toBe(true);
    expect(matchesLocalConstraints({ ...horrorComedy, release_date: '2005-01-01' }, { window })).toBe(false);
  });

  it('rejects an undated film when a window was asked for', () => {
    expect(matchesLocalConstraints({ genre_ids: [27], release_date: '' }, { window: { gte: '1990-01-01' } })).toBe(false);
  });

  it('keeps everything when nothing was asked', () => {
    expect(matchesLocalConstraints(horrorComedy, {})).toBe(true);
  });
});

describe('intersectById', () => {
  it('keeps only what appears in both', () => {
    const result = intersectById(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [{ id: 2 }, { id: 3 }, { id: 9 }]
    );

    expect(result.map((movie) => movie.id)).toEqual([2, 3]);
  });

  it('is empty when nothing satisfies both', () => {
    expect(intersectById([{ id: 1 }], [{ id: 2 }])).toEqual([]);
  });
});

describe('describeFilters', () => {
  it('names a single chip as it always did', () => {
    expect(describeFilters([chip('genre', 'Horror')])).toBe('Horror');
  });

  it('joins two chips so the heading matches what is below it', () => {
    expect(describeFilters([chip('genre', 'Horror'), chip('genre', 'Comedy')]))
      .toBe('Horror + Comedy');
  });

  it('handles three or more readably', () => {
    expect(describeFilters([
      chip('genre', 'Horror'), chip('genre', 'Comedy'), chip('year', '1994')
    ])).toBe('Horror, Comedy + 1994');
  });

  it('has nothing to say about nothing', () => {
    expect(describeFilters([])).toBeNull();
    expect(describeFilters(null)).toBeNull();
  });
});

// The catalog: identity for everything filterable, resolved once.
//
// The claim under test throughout: an id taken from a film in the library
// cannot be an orphan, because it is attached to at least the film it came
// from. This is what makes the /search-at-fetch-time resolution (and its
// Spiderland failure mode) unnecessary for genres, companies and keywords.
import { describe, it, expect } from 'vitest';
import { buildCatalog, typeaheadEntries, CATALOG_KINDS } from '../assets/javascript/catalog.js';
import { countKeywords, countCastCrew } from '../assets/javascript/entityCounts.js';
import { computeFlatKeywords } from '../utils/keywords.js';

const entry = (movie, ratings = [{ calculatedTotal: 8, date: '2023-01-01' }]) => {
  const shaped = { ...movie, flatKeywords: computeFlatKeywords(movie) };
  return { movie: shaped, ratings, dbKey: `movie-${movie.id}` };
};

const library = () => ([
  entry({
    id: 1,
    title: 'Arrival',
    release_date: '2016-11-11',
    runtime: 116,
    genres: [{ id: 878, name: 'Science Fiction' }, { id: 18, name: 'Drama' }],
    cast: [{ name: 'Amy Adams' }],
    crew: [{ name: 'Denis Villeneuve', job: 'Director' }, { name: 'Joe Walker', job: 'Editor' }],
    production_companies: [{ id: 84092, name: 'FilmNation Entertainment' }],
    keywords: [{ id: 9951, name: 'alien' }],
    chatGPTKeywords: ['first contact']
  }),
  entry({
    id: 2,
    title: 'Sicario',
    release_date: '2015-09-18',
    runtime: 121,
    genres: [{ id: 18, name: 'Drama' }],
    cast: [{ name: 'Emily Blunt' }],
    crew: [{ name: 'Denis Villeneuve', job: 'Director' }],
    production_companies: [{ id: 1632, name: 'Lionsgate' }],
    keywords: [{ id: 10391, name: 'mexico' }]
  })
]);

describe('buildCatalog', () => {
  it('keeps the ids the library already stores, instead of re-buying them from /search', () => {
    const catalog = buildCatalog(library());

    expect(catalog.idFor('company', 'FilmNation Entertainment')).toBe(84092);
    expect(catalog.idFor('keyword', 'alien')).toBe(9951);
  });

  it('resolves however the name is cased or accented, as every comparison does', () => {
    const catalog = buildCatalog(library());

    expect(catalog.idFor('company', 'lionsgate')).toBe(1632);
    expect(catalog.idFor('keyword', '  ALIEN  ')).toBe(9951);
  });

  it('uses the shared genre map first, so chips and fetches cannot disagree', () => {
    // The map is how the horror bug was fixed; the catalog must not
    // reintroduce a second opinion about what "horror" means.
    const catalog = buildCatalog(library());

    expect(catalog.idFor('genre', 'Science Fiction')).toBe(878);
    expect(catalog.idFor('genre', 'Drama')).toBe(18);
  });

  it('is honest about what has no id: people, and keywords TMDB never issued', () => {
    const catalog = buildCatalog(library());

    const villeneuve = catalog.entries.find((item) => item.kind === 'director' && item.name === 'Denis Villeneuve');
    expect(villeneuve.tmdbId).toBeNull(); // stored name-only, deliberately

    const aiKeyword = catalog.entries.find((item) => item.kind === 'keyword' && item.name === 'first contact');
    expect(aiKeyword.tmdbId).toBeNull(); // an AI keyword is not TMDB's
  });

  it('agrees with entityCounts to the number, since the (N) badges read those', () => {
    const catalog = buildCatalog(library());
    const expected = countKeywords(library(), false);

    catalog.entries
      .filter((item) => item.kind === 'keyword')
      .forEach((item) => {
        expect(item.count, item.name).toBe(expected[item.name]);
      });

    const villeneuve = catalog.entries.find((item) => item.kind === 'director' && item.name === 'Denis Villeneuve');
    expect(villeneuve.count).toBe(2);
  });

  it('counts respect the shorts setting, but identity does not', () => {
    const short = entry({
      id: 3,
      title: 'The World of Tomorrow',
      release_date: '2015-03-31',
      runtime: 17, // a short: excluded from counts by default
      genres: [{ id: 16, name: 'Animation' }],
      cast: [],
      crew: [{ name: 'Don Hertzfeldt', job: 'Director' }],
      production_companies: [{ id: 424242, name: 'Bitter Films' }],
      keywords: [{ id: 4344, name: 'stick figure' }]
    });

    const catalog = buildCatalog([...library(), short], false);

    // Not counted, so not offered...
    expect(catalog.entries.find((item) => item.name === 'Don Hertzfeldt')).toBeUndefined();
    // ...but what a name MEANS is a fact, not a display preference.
    expect(catalog.idFor('company', 'Bitter Films')).toBe(424242);
    expect(catalog.idFor('keyword', 'stick figure')).toBe(4344);
  });

  it('survives an empty or damaged library', () => {
    expect(buildCatalog(null).entries).toEqual([]);
    // Genres resolve even from an empty library — the TMDB genre map is
    // global knowledge, not something learned from stored films.
    expect(buildCatalog([]).idFor('genre', 'Drama')).toBe(18);
    expect(buildCatalog([]).idFor('company', 'Lionsgate')).toBeNull();
    expect(() => buildCatalog([{ movie: null }, {}, entry({ id: 9, title: 'X', genres: null, cast: null, crew: null })])).not.toThrow();
  });

  it('returns null rather than guessing for an unknown name', () => {
    const catalog = buildCatalog(library());

    expect(catalog.idFor('keyword', 'spiderman')).toBeNull();
    expect(catalog.idFor('company', '')).toBeNull();
    expect(catalog.idFor('nonsense', 'alien')).toBeNull();
  });
});

describe('typeaheadEntries', () => {
  it('projects the shape rankTypeahead consumes, now carrying the id', () => {
    const projected = typeaheadEntries(buildCatalog(library()));
    const filmNation = projected.find((item) => item.value === 'FilmNation Entertainment');

    expect(filmNation).toMatchObject({
      kind: 'studio',
      expectedType: 'studios',
      tmdbId: 84092
    });
    expect(filmNation.norm).toBe('filmnation entertainment');
    expect(filmNation.count).toBe(1);
  });

  it('offers a director once, as a director, though they are also crew', () => {
    const projected = typeaheadEntries(buildCatalog(library()));
    const matches = projected.filter((item) => item.value === 'Denis Villeneuve');

    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe('director');
  });

  it('keeps a cast member who is not a director in the cast bucket', () => {
    // Sanity check the priority dedupe is not simply swallowing everyone.
    const counted = countCastCrew(library(), false);
    expect(counted['Amy Adams']).toBe(1);

    const projected = typeaheadEntries(buildCatalog(library()));
    expect(projected.find((item) => item.value === 'Amy Adams')?.kind).toBe('cast');
  });

  it('kind labels come from one shared table', () => {
    expect(CATALOG_KINDS.company.label).toBe('studio');
    expect(CATALOG_KINDS.cast.expectedType).toBe('cast/crew');
  });

  it('survives an empty catalog', () => {
    expect(typeaheadEntries(null)).toEqual([]);
    expect(typeaheadEntries(buildCatalog([]))).toEqual([]);
  });
});

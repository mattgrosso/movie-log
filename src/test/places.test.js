import { describe, it, expect } from 'vitest';
import {
  movieLocations,
  placeNames,
  placeRows,
  favouritePlaces,
  mostVisitedPlaces,
  placeSummary,
  countryCoverage,
  RANK_SHRINK
} from '@/assets/javascript/places.js';
import { countPlaces } from '@/assets/javascript/entityCounts.js';

// Matt, 2026-09-08: "Seeing that I really like movies set in Paris would be
// cool." These pin what a place is, how films are counted against it, and
// how "really like" is ranked.

const paris = (type) => ({ name: 'Paris', lat: 48.85, lon: 2.35, type, id: 'Q90' });
const london = (type) => ({ name: 'London', lat: 51.5, lon: -0.12, type, id: 'Q84' });
const tokyo = (type) => ({ name: 'Tokyo', lat: 35.68, lon: 139.69, type, id: 'Q1490' });

const entry = (id, title, score, locations, runtime = 100) => ({
  dbKey: `m${id}`,
  movie: { id, title, runtime, poster_path: `/${id}.jpg`, locations },
  ratings: [{ calculatedTotal: score }]
});
const getRating = (e) => ({ calculatedTotal: e.ratings[0].calculatedTotal });

const library = () => [
  entry(1, 'Amélie', 9.5, [paris('narrative'), paris('filming')]),
  entry(2, 'Ratatouille', 9.0, [paris('narrative')]),
  entry(3, 'Before Sunset', 8.5, [paris('narrative'), paris('filming')]),
  entry(4, 'Paddington', 7.0, [london('narrative'), london('filming')]),
  entry(5, 'Lost in Translation', 9.8, [tokyo('narrative'), tokyo('filming')]),
  entry(6, 'Unplaced', 6.0, []),
  entry(7, 'Never checked', 6.0, undefined)
];

describe('movieLocations / placeNames', () => {
  it('reads an array, or the object Firebase can hand back', () => {
    expect(movieLocations({ locations: [paris('filming')] })).toHaveLength(1);
    expect(movieLocations({ locations: { 0: paris('filming'), 1: london('narrative') } })).toHaveLength(2);
    expect(movieLocations({})).toEqual([]);
    expect(movieLocations({ locations: [{ lat: 1, lon: 2, type: 'filming' }, null, { name: 'X', type: 'weird' }] })).toEqual([]);
  });

  it('names each place once per movie, optionally by type', () => {
    const movie = { locations: [paris('narrative'), paris('filming'), london('filming')] };
    expect(placeNames(movie)).toEqual(['Paris', 'London']);
    expect(placeNames(movie, 'narrative')).toEqual(['Paris']);
    expect(placeNames(movie, 'filming')).toEqual(['Paris', 'London']);
  });
});

describe('countPlaces', () => {
  it('counts a movie once per place, whichever type', () => {
    expect(countPlaces(library(), false)).toEqual({ Paris: 3, London: 1, Tokyo: 1 });
  });

  it('respects the shorts setting like every other count', () => {
    const lib = [...library(), entry(8, 'A short in Paris', 8, [paris('narrative')], 12)];
    expect(countPlaces(lib, false).Paris).toBe(3);
    expect(countPlaces(lib, true).Paris).toBe(4);
  });
});

describe('placeRows', () => {
  it('gives each place its films, its average and its best film', () => {
    const rows = placeRows(library(), getRating);
    const parisRow = rows.find((r) => r.name === 'Paris');
    expect(parisRow.films).toBe(3);
    expect(parisRow.average).toBeCloseTo(9.0, 5);
    expect(parisRow.best.title).toBe('Amélie');
    expect(parisRow.lat).toBe(48.85);
    expect(rows.map((r) => r.name).sort()).toEqual(['London', 'Paris', 'Tokyo']);
  });

  it('filters by type, so "set in" and "filmed in" are different lists', () => {
    const set = placeRows(library(), getRating, { type: 'narrative' });
    const filmed = placeRows(library(), getRating, { type: 'filming' });
    expect(set.find((r) => r.name === 'Paris').films).toBe(3);
    expect(filmed.find((r) => r.name === 'Paris').films).toBe(2);
  });

  it('shrinks the ranking score toward the library average', () => {
    const rows = placeRows(library(), getRating);
    const scores = [9.5, 9.0, 8.5, 7.0, 9.8, 6.0, 6.0];
    const libraryAverage = scores.reduce((a, b) => a + b) / scores.length;
    const tokyoRow = rows.find((r) => r.name === 'Tokyo');
    expect(tokyoRow.average).toBe(9.8);
    expect(tokyoRow.rank).toBeCloseTo((9.8 + RANK_SHRINK * libraryAverage) / (1 + RANK_SHRINK), 6);
  });
});

describe('favouritePlaces / mostVisitedPlaces', () => {
  it('ranks favourites by shrunk score among places with enough films', () => {
    const rows = placeRows(library(), getRating);
    // Tokyo has the best single film but only one; Paris has three at 9.0.
    expect(favouritePlaces(rows, { minFilms: 3 }).map((r) => r.name)).toEqual(['Paris']);
    expect(favouritePlaces(rows, { minFilms: 1 }).map((r) => r.name)).toEqual(['Paris', 'Tokyo', 'London']);
  });

  it('orders most visited by count, then rating', () => {
    const rows = placeRows(library(), getRating);
    expect(mostVisitedPlaces(rows).map((r) => r.name)).toEqual(['Paris', 'Tokyo', 'London']);
    expect(mostVisitedPlaces(rows, { limit: 1 })).toHaveLength(1);
  });
});

describe('placeSummary', () => {
  it('counts movies with any place, and distinct places', () => {
    expect(placeSummary(library())).toEqual({ movies: 5, places: 3, library: 7 });
    expect(placeSummary(library(), { type: 'filming' })).toEqual({ movies: 4, places: 3, library: 7 });
  });
});

describe('countryCoverage', () => {
  // A toy world on the real 2000×1000 grid: "Westland" spans lon -100..-50
  // and lat 20..60, "Eastland" spans lon 0..50, lat 30..60. Grid x = (lon+180)/360*2000,
  // y = (90-lat)/180*1000.
  const box = (lon1, lon2, lat1, lat2) => {
    const x = (lon) => Math.round((lon + 180) / 360 * 2000);
    const y = (lat) => Math.round((90 - lat) / 180 * 1000);
    return [x(lon1), y(lat2), x(lon2), y(lat2), x(lon2), y(lat1), x(lon1), y(lat1)];
  };
  const world = {
    width: 2000,
    height: 1000,
    viewBox: '0 0 2000 1000',
    countries: [
      { iso: 'WL', name: 'Westland', rings: [box(-100, -50, 20, 60)] },
      { iso: 'EL', name: 'Eastland', rings: [box(0, 50, 30, 60)] },
      { iso: null, name: 'Nowhere', rings: [box(100, 110, -40, -30)] }
    ]
  };
  const west = (type, name = 'West City') => ({ name, lat: 40, lon: -75, type, id: `Q-${name}` });
  const east = (type, name = 'East City') => ({ name, lat: 45, lon: 25, type, id: `Q-${name}` });
  const sea = (type) => ({ name: 'Mid Ocean', lat: 0, lon: -150, type, id: 'Q-sea' });

  const lib = () => [
    { dbKey: 'a', movie: { id: 1, runtime: 100, locations: [west('narrative'), west('filming')], production_countries: [{ iso_3166_1: 'WL', name: 'Westland' }] }, ratings: [{ calculatedTotal: 8 }] },
    { dbKey: 'b', movie: { id: 2, runtime: 100, locations: [west('narrative', 'West Town'), east('filming')] }, ratings: [{ calculatedTotal: 7 }] },
    { dbKey: 'c', movie: { id: 3, runtime: 100, locations: [sea('narrative')], production_countries: [{ iso_3166_1: 'el', name: 'Eastland' }] }, ratings: [{ calculatedTotal: 6 }] },
    { dbKey: 'd', movie: { id: 4, runtime: 100, locations: [], production_countries: [{ iso_3166_1: 'ZZ', name: 'Unmapped' }] }, ratings: [{ calculatedTotal: 5 }] }
  ];

  it('counts each film once per country, however many ways it touches it', () => {
    const coverage = countryCoverage(lib(), world);
    const westland = coverage.rows.find((r) => r.iso === 'WL');
    expect(westland.films).toBe(2);
    expect(westland.setIn).toBe(2);
    expect(westland.filmedIn).toBe(1);
    expect(westland.madeIn).toBe(1);
    expect(westland.places).toEqual([{ name: 'West City', films: 1 }, { name: 'West Town', films: 1 }]);
  });

  it('joins production countries by ISO code, case-insensitively', () => {
    const coverage = countryCoverage(lib(), world);
    const eastland = coverage.rows.find((r) => r.iso === 'EL');
    expect(eastland.films).toBe(2); // film 2 shot there, film 3 made there
    expect(eastland.madeIn).toBe(1);
    expect(coverage.counts).toEqual({ WL: 2, EL: 2 });
  });

  it('leaves made-in out when narrowed to one type', () => {
    const set = countryCoverage(lib(), world, { type: 'narrative' });
    expect(set.counts).toEqual({ WL: 2 });
    const filmed = countryCoverage(lib(), world, { type: 'filming' });
    expect(filmed.counts).toEqual({ WL: 1, EL: 1 });
  });

  it('reports how much of the map is touched, ignoring countries with no code', () => {
    const coverage = countryCoverage(lib(), world);
    expect(coverage.touched).toBe(2);
    expect(coverage.total).toBe(2);
    expect(countryCoverage([], world).touched).toBe(0);
  });
});

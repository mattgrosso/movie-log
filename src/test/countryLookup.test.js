import { describe, it, expect } from 'vitest';
import {
  projectPoint,
  countryForPoint,
  countryForIso,
  pathFor,
  NEAREST_FALLBACK_UNITS
} from '../assets/javascript/countryLookup.js';
import realWorld from '../assets/data/worldCountries.json';

// A tiny synthetic world on a 360x180 grid, so one unit is one degree and the
// fixtures can be read straight off the page:
//   Alpha    — square, lon 10..20, lat 10..20  (x 190..200, y 70..80)
//   Beta     — square, lon 30..40, lat 10..20  (x 210..220, y 70..80)
//   Gamma    — triangle, lon -20..-10, lat -10..0
const WORLD = {
  width: 360,
  height: 180,
  viewBox: '0 0 360 180',
  countries: [
    { iso: 'AA', name: 'Alpha', rings: [[190, 70, 200, 70, 200, 80, 190, 80]] },
    { iso: 'BB', name: 'Beta', rings: [[210, 70, 220, 70, 220, 80, 210, 80]] },
    { iso: null, name: 'Gamma', rings: [[160, 90, 170, 90, 165, 100]] }
  ]
};

describe('projectPoint', () => {
  it('maps lon/lat onto the grid the generator used', () => {
    expect(projectPoint(0, 0, WORLD)).toEqual({ x: 180, y: 90 });
    expect(projectPoint(-180, 90, WORLD)).toEqual({ x: 0, y: 0 });
    expect(projectPoint(180, -90, WORLD)).toEqual({ x: 360, y: 180 });
  });
});

describe('countryForPoint', () => {
  it('finds the country a point is inside', () => {
    expect(countryForPoint(15, 15, WORLD)?.iso).toBe('AA');
    expect(countryForPoint(15, 35, WORLD)?.iso).toBe('BB');
    // Inside the triangle, near its centroid.
    expect(countryForPoint(-5, -15, WORLD)?.name).toBe('Gamma');
  });

  it('is null for a point far from any coastline', () => {
    // lon 90, lat 60: nowhere near anything drawn.
    expect(countryForPoint(60, 90, WORLD)).toBeNull();
  });

  it('snaps a point just off the coast to the nearest country', () => {
    // 2 units east of Alpha's edge, 8 from Beta's — Alpha wins.
    expect(countryForPoint(15, 22, WORLD)?.iso).toBe('AA');
    // Nearer Beta's edge than Alpha's.
    expect(countryForPoint(15, 28, WORLD)?.iso).toBe('BB');
    // Past the fallback reach, north of Alpha (Beta is 15 units east): sea.
    expect(countryForPoint(20 + NEAREST_FALLBACK_UNITS + 1, 15, WORLD)).toBeNull();
    expect(countryForPoint(20 + 2, 15, WORLD)?.iso).toBe('AA');
  });

  it('tolerates bad input', () => {
    expect(countryForPoint(NaN, 10, WORLD)).toBeNull();
    expect(countryForPoint(10, 10, null)).toBeNull();
  });
});

describe('countryForIso', () => {
  it('is case-insensitive and null for unknown codes', () => {
    expect(countryForIso('bb', WORLD)?.name).toBe('Beta');
    expect(countryForIso('BB', WORLD)?.name).toBe('Beta');
    expect(countryForIso('ZZ', WORLD)).toBeNull();
    expect(countryForIso(null, WORLD)).toBeNull();
  });
});

describe('pathFor', () => {
  it('closes every ring and memoizes', () => {
    const country = WORLD.countries[0];
    expect(pathFor(country)).toBe('M190 70L200 70L200 80L190 80Z');
    expect(pathFor(country)).toBe(pathFor(country));
    expect(pathFor(null)).toBe('');
  });

  it('joins several rings into one path', () => {
    const island = { iso: 'II', name: 'Islands', rings: [[0, 0, 1, 0, 1, 1], [5, 5, 6, 5, 6, 6]] };
    expect(pathFor(island)).toBe('M0 0L1 0L1 1ZM5 5L6 5L6 6Z');
  });
});

describe('against the real world', () => {
  it('resolves the places a library actually holds', () => {
    expect(countryForPoint(48.8566, 2.3522, realWorld)?.iso).toBe('FR');
    expect(countryForPoint(34.05, -118.24, realWorld)?.iso).toBe('US');
    // Coastal at 110m: Santa Monica and Kauaʻi land in the sea and rely on
    // the fallback.
    expect(countryForPoint(34.0195, -118.4912, realWorld)?.iso).toBe('US');
    expect(countryForPoint(22.07, -159.4975, realWorld)?.iso).toBe('US');
    expect(countryForPoint(35.6762, 139.6503, realWorld)?.iso).toBe('JP');
    expect(countryForPoint(30, -40, realWorld)).toBeNull();
  });
});

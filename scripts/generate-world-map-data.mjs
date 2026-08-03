#!/usr/bin/env node
//
// Generates src/assets/data/worldMap.json — the land outline, country and
// state/province borders, and city labels behind WorldMap.vue.
//
// Source is Natural Earth (public domain, no attribution required, though it's
// credited in the output anyway). Everything is pre-projected to SVG path data
// at build time so the runtime does no geometry work and needs no mapping
// library, no API key and no tile server.
//
// WHY 50m AND NOT 110m: 110m is drawn for world-scale maps and visibly
// staircases into rectangles past about 5x zoom. 50m stays smooth to ~16x.
// 10m was measured too and adds almost nothing over 50m for six times the
// bytes, so it isn't worth it.
//
// WHY THE 20000x10000 GRID: at the old 2000x1000 integer grid one unit is
// ~20km, which would throw away most of what 50m data actually contains. This
// grid is ~2km per unit — finer than anything visible at max zoom.
//
// Usage:  node scripts/generate-world-map-data.mjs
//
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

const WIDTH = 20000;
const HEIGHT = 10000;

// The display window crops the empty polar caps: Antarctica and the high Arctic
// are ~20% of an equirectangular map's height and essentially never hold a film
// location.
const TOP_LAT = 84;
const BOTTOM_LAT = -58;

// Cities are ranked by importance in Natural Earth (0 = world capitals).
// Anything past 6 is small enough that it's noise at any zoom this map reaches.
const MAX_CITY_RANK = 6;

// Drop islands smaller than this many grid units across — they render as a
// sub-pixel speck anyway, and there are thousands of them.
const MIN_FEATURE_SIZE = 3;

const project = (lon, lat) => [
  Math.round(((lon + 180) / 360) * WIDTH),
  Math.round(((90 - lat) / 180) * HEIGHT)
];

async function fetchGeoJson (name) {
  const response = await fetch(`${NE}/${name}.geojson`);
  if (!response.ok) {
    throw new Error(`Could not fetch ${name}: HTTP ${response.status}`);
  }
  return response.json();
}

// Consecutive points that round to the same grid cell collapse to one, which is
// where most of the size reduction comes from.
function toPoints (coordinates) {
  const points = [];
  coordinates.forEach((coordinate) => {
    const point = project(coordinate[0], coordinate[1]);
    const last = points[points.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) {
      points.push(point);
    }
  });
  return points;
}

const toPath = (points, close) =>
  `M${points.map(([x, y]) => `${x} ${y}`).join('L')}${close ? 'Z' : ''}`;

function polygonPaths (geojson) {
  const paths = [];

  geojson.features.forEach((feature) => {
    const geometry = feature.geometry || {};
    const polygons = geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : (geometry.coordinates || []);

    polygons.forEach((polygon) => {
      // Outer ring only — the holes are inland lakes, which this map doesn't draw.
      const points = toPoints(polygon[0] || []);
      if (points.length < 3) return;

      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const tooSmall = (Math.max(...xs) - Math.min(...xs)) < MIN_FEATURE_SIZE &&
                       (Math.max(...ys) - Math.min(...ys)) < MIN_FEATURE_SIZE;
      if (tooSmall) return;

      paths.push(toPath(points, true));
    });
  });

  return paths;
}

function linePaths (geojson) {
  const paths = [];

  geojson.features.forEach((feature) => {
    const geometry = feature.geometry || {};
    const lines = geometry.type === 'LineString'
      ? [geometry.coordinates]
      : (geometry.coordinates || []);

    lines.forEach((line) => {
      const points = toPoints(line || []);
      if (points.length > 1) {
        paths.push(toPath(points, false));
      }
    });
  });

  return paths;
}

function cityPoints (geojson) {
  return geojson.features
    .filter((feature) => (feature.properties.scalerank ?? 99) <= MAX_CITY_RANK)
    .map((feature) => {
      const [x, y] = project(...feature.geometry.coordinates.slice(0, 2));
      // [name, x, y, rank] rather than an object — 1,100+ of these, and the
      // repeated keys would roughly double the payload.
      return [feature.properties.name, x, y, feature.properties.scalerank ?? 99];
    })
    // Most important first, so the renderer can simply take the first N that
    // fall inside the current view.
    .sort((a, b) => a[3] - b[3]);
}

const [landJson, borderJson, stateJson, cityJson] = await Promise.all([
  fetchGeoJson('ne_50m_land'),
  fetchGeoJson('ne_50m_admin_0_boundary_lines_land'),
  // Internal boundaries matter more than usual for this app: Wikidata very
  // often returns a US state as a film's location, so "Colorado" should land
  // inside a visible outline rather than an anonymous patch of continent.
  fetchGeoJson('ne_50m_admin_1_states_provinces_lines'),
  fetchGeoJson('ne_50m_populated_places_simple')
]);

const top = Math.round(((90 - TOP_LAT) / 180) * HEIGHT);
const bottom = Math.round(((90 - BOTTOM_LAT) / 180) * HEIGHT);

const output = {
  note: 'GENERATED — run scripts/generate-world-map-data.mjs. Natural Earth 50m (public domain).',
  projection: 'equirectangular',
  width: WIDTH,
  height: HEIGHT,
  viewBox: `0 ${top} ${WIDTH} ${bottom - top}`,
  land: polygonPaths(landJson),
  borders: linePaths(borderJson),
  stateBorders: linePaths(stateJson),
  cities: cityPoints(cityJson)
};

const serialised = JSON.stringify(output);
writeFileSync(join(repoRoot, 'src/assets/data/worldMap.json'), serialised);

const raw = Buffer.byteLength(serialised) / 1024;
const gzipped = gzipSync(serialised, { level: 9 }).length / 1024;
console.log('Wrote src/assets/data/worldMap.json');
console.log(`  land     ${output.land.length} paths`);
console.log(`  borders  ${output.borders.length} paths`);
console.log(`  states   ${output.stateBorders.length} paths`);
console.log(`  cities   ${output.cities.length} points`);
console.log(`  size     ${raw.toFixed(0)}K raw, ${gzipped.toFixed(0)}K gzipped`);

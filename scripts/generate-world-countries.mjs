#!/usr/bin/env node
//
// Generates src/assets/data/worldCountries.json — one polygon set per country,
// with its ISO code, behind CoverageMap.vue (the "how much of the world have I
// explored in film" choropleth) and countryLookup.js (which country a
// lat/lon falls in, so a Wikidata filming location can be counted against a
// country without a second lookup).
//
// Source is Natural Earth (public domain). Everything is pre-projected to an
// integer grid at build time so the runtime does no geometry work and needs no
// mapping library, no API key and no tile server.
//
// WHY 110m AND NOT 50m: this map is never zoomed — it's the whole world in one
// glance — and 110m is a fraction of the bytes. (The removed street-level map
// needed 50m; see docs/history/geography-removed.md for that measurement.)
//
// WHY A 2000x1000 GRID: one unit is ~20km, which is finer than 110m data
// resolves anyway, and small integers keep the JSON compact.
//
// Usage:  node scripts/generate-world-countries.mjs
//
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

const WIDTH = 2000;
const HEIGHT = 1000;

// The display window crops the empty polar caps: Antarctica and the high Arctic
// are ~20% of an equirectangular map's height and essentially never hold a film
// location.
const TOP_LAT = 84;
const BOTTOM_LAT = -58;

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

// Consecutive points that round to the same grid cell collapse to one. The ring
// comes back FLATTENED ([x0, y0, x1, y1, ...]) — 177 countries' worth of nested
// pairs is mostly brackets.
function toRing (coordinates) {
  const ring = [];
  let lastX = null;
  let lastY = null;
  coordinates.forEach((coordinate) => {
    const [x, y] = project(coordinate[0], coordinate[1]);
    if (x !== lastX || y !== lastY) {
      ring.push(x, y);
      lastX = x;
      lastY = y;
    }
  });
  // GeoJSON rings repeat their first point last; drop it, the path closes itself.
  if (ring.length >= 4 && ring[0] === ring[ring.length - 2] && ring[1] === ring[ring.length - 1]) {
    ring.length -= 2;
  }
  return ring;
}

function countryRings (feature) {
  const geometry = feature.geometry || {};
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : (geometry.coordinates || []);

  return polygons
    // Outer ring only — the holes are inland lakes, which this map doesn't draw.
    .map((polygon) => toRing(polygon[0] || []))
    .filter((ring) => ring.length >= 6);
}

// Plain ISO_A2 is "-99" for France and Norway (Natural Earth's own quirk);
// ISO_A2_EH carries the code everyone expects. Anything still -99 after that
// (Kosovo, Somaliland, Northern Cyprus) keeps drawing, just uncounted.
function isoFor (properties) {
  const iso = properties.ISO_A2_EH || properties.ISO_A2;
  return iso && iso !== '-99' ? iso : null;
}

const countriesJson = await fetchGeoJson('ne_110m_admin_0_countries');

const countries = countriesJson.features
  .map((feature) => ({
    iso: isoFor(feature.properties),
    name: feature.properties.NAME,
    rings: countryRings(feature)
  }))
  .filter((country) => country.rings.length)
  .sort((a, b) => a.name.localeCompare(b.name));

const top = Math.round(((90 - TOP_LAT) / 180) * HEIGHT);
const bottom = Math.round(((90 - BOTTOM_LAT) / 180) * HEIGHT);

const output = {
  note: 'GENERATED — run scripts/generate-world-countries.mjs. Natural Earth 110m (public domain).',
  projection: 'equirectangular',
  width: WIDTH,
  height: HEIGHT,
  viewBox: `0 ${top} ${WIDTH} ${bottom - top}`,
  countries
};

const serialised = JSON.stringify(output);
writeFileSync(join(repoRoot, 'src/assets/data/worldCountries.json'), serialised);

const raw = Buffer.byteLength(serialised) / 1024;
const gzipped = gzipSync(serialised, { level: 9 }).length / 1024;
console.log('Wrote src/assets/data/worldCountries.json');
console.log(`  countries ${countries.length} (${countries.filter((c) => c.iso).length} with an ISO code)`);
console.log(`  rings     ${countries.reduce((sum, c) => sum + c.rings.length, 0)}`);
console.log(`  size      ${raw.toFixed(0)}K raw, ${gzipped.toFixed(0)}K gzipped`);

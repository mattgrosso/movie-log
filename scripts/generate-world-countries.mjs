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

// Measured 2026-09-08 (gzipped): 110m/2000 grid 35K; 50m/4000 grid raw 212K,
// with sub-5-unit islands dropped and a 1.5-unit Douglas–Peucker pass 62K.
// The map zooms to ~10x now, and 110m staircases past ~5x, so 50m it is —
// 27K more than the coarse file for four times the coastline.
//
// Resolution and grid are overridable so the trade-off can be re-measured
// (`NE_SCALE=50m GRID_WIDTH=4000 OUT=/tmp/x.json node scripts/...`).
const NE_SCALE = process.env.NE_SCALE || '50m';
const WIDTH = Number(process.env.GRID_WIDTH) || 4000;
const HEIGHT = WIDTH / 2;
const OUT = process.env.OUT || join(repoRoot, 'src/assets/data/worldCountries.json');
// Rings whose bounding box is smaller than this many grid units on both axes
// are dropped: sub-pixel islands at any zoom this map reaches, and there are
// thousands of them in the 50m set.
const MIN_RING_SIZE = Number(process.env.MIN_RING_SIZE) || 5;

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

// Douglas–Peucker on the projected ring: drops points that sit within
// SIMPLIFY_TOLERANCE grid units of the line between their neighbours. At a
// 3000-wide grid one unit is ~13km, so a tolerance of one unit removes only
// what the screen could never show, and it roughly halves the 50m payload.
const SIMPLIFY_TOLERANCE = Number(process.env.SIMPLIFY_TOLERANCE) || 1.5;

function simplifyRing (ring, tolerance) {
  if (!tolerance || ring.length < 8) return ring;
  const points = [];
  for (let i = 0; i < ring.length; i += 2) points.push([ring[i], ring[i + 1]]);
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const sq = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = -1;
    const [x1, y1] = points[first];
    const [x2, y2] = points[last];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      let dist;
      if (lengthSq === 0) {
        dist = (px - x1) * (px - x1) + (py - y1) * (py - y1);
      } else {
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
        const cx = x1 + t * dx;
        const cy = y1 + t * dy;
        dist = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      }
      if (dist > maxDist) { maxDist = dist; index = i; }
    }
    if (maxDist > sq && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out = [];
  points.forEach((point, i) => { if (keep[i]) out.push(point[0], point[1]); });
  return out;
}

// The larger side of a ring's bounding box, in grid units. A loop rather
// than Math.max(...ring): a 50m coastline can run to tens of thousands of
// points, past the spread-argument limit.
function ringSpan (ring) {
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    minX = Math.min(minX, ring[i]); maxX = Math.max(maxX, ring[i]);
    minY = Math.min(minY, ring[i + 1]); maxY = Math.max(maxY, ring[i + 1]);
  }
  return Math.max(maxX - minX, maxY - minY);
}

function countryRings (feature) {
  const geometry = feature.geometry || {};
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : (geometry.coordinates || []);

  const rings = polygons
    // Outer ring only — the holes are inland lakes, which this map doesn't draw.
    .map((polygon) => simplifyRing(toRing(polygon[0] || []), SIMPLIFY_TOLERANCE))
    .filter((ring) => ring.length >= 6);
  // Drop sub-pixel islands, but never a country's LARGEST ring: Malta is
  // under 3 units wide and Gladiator was filmed there — a country that
  // vanishes from the map vanishes from the coverage count too.
  const largest = rings.reduce((best, ring) => (ringSpan(ring) > ringSpan(best) ? ring : best), rings[0]);
  return rings.filter((ring) => ring === largest || ringSpan(ring) >= MIN_RING_SIZE);
}

// Plain ISO_A2 is "-99" for France and Norway (Natural Earth's own quirk);
// ISO_A2_EH carries the code everyone expects. Anything still -99 after that
// (Kosovo, Somaliland, Northern Cyprus) keeps drawing, just uncounted.
function isoFor (properties) {
  const iso = properties.ISO_A2_EH || properties.ISO_A2;
  return iso && iso !== '-99' ? iso : null;
}

const countriesJson = await fetchGeoJson(`ne_${NE_SCALE}_admin_0_countries`);

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
  note: `GENERATED — run scripts/generate-world-countries.mjs. Natural Earth ${NE_SCALE} (public domain).`,
  projection: 'equirectangular',
  width: WIDTH,
  height: HEIGHT,
  viewBox: `0 ${top} ${WIDTH} ${bottom - top}`,
  countries
};

const serialised = JSON.stringify(output);
writeFileSync(OUT, serialised);

const raw = Buffer.byteLength(serialised) / 1024;
const gzipped = gzipSync(serialised, { level: 9 }).length / 1024;
console.log(`Wrote ${OUT} (${NE_SCALE}, ${WIDTH}x${HEIGHT})`);
console.log(`  countries ${countries.length} (${countries.filter((c) => c.iso).length} with an ISO code)`);
console.log(`  rings     ${countries.reduce((sum, c) => sum + c.rings.length, 0)}`);
console.log(`  size      ${raw.toFixed(0)}K raw, ${gzipped.toFixed(0)}K gzipped`);

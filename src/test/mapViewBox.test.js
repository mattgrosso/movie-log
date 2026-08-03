import { describe, it, expect } from 'vitest';
import { fitViewBox } from '../assets/javascript/mapViewBox.js';

const WORLD = { width: 2000, height: 1000, fallback: '0 33 2000 789' };

const parse = (viewBox) => {
  const [x, y, width, height] = viewBox.split(' ').map(Number);
  return { x, y, width, height, right: x + width, bottom: y + height };
};

const fit = (points, options = {}) => parse(fitViewBox(points, { minWidth: 400, ...WORLD, ...options }));

// Every point must end up inside the box — that's the whole contract.
const containsAll = (box, points) => points.every(
  (p) => p.x >= box.x && p.x <= box.right && p.y >= box.y && p.y <= box.bottom
);

describe('fitViewBox', () => {
  it('falls back when there is nothing to fit', () => {
    expect(fitViewBox([], WORLD)).toBe(WORLD.fallback);
    expect(fitViewBox(null, WORLD)).toBe(WORLD.fallback);
  });

  it('ignores points with unusable coordinates', () => {
    expect(fitViewBox([{ x: null, y: 5 }, { x: 'a', y: 'b' }], WORLD)).toBe(WORLD.fallback);
  });

  it('zooms in on a tight cluster', () => {
    const box = fit([{ x: 1000, y: 400 }, { x: 1020, y: 410 }]);
    expect(box.width).toBeLessThan(2000);
  });

  it('contains every point it was given', () => {
    const points = [{ x: 900, y: 300 }, { x: 1100, y: 500 }, { x: 1000, y: 380 }];
    expect(containsAll(fit(points), points)).toBe(true);
  });

  it('contains a single point, without zooming to a pinpoint', () => {
    const points = [{ x: 1000, y: 500 }];
    const box = fit(points);

    expect(containsAll(box, points)).toBe(true);
    // A floor on the zoom, set by the resolution of the land outline rather
    // than by taste. Expressed against this test's own 2000-wide world; the
    // real default (1250 of 20000, ~16x) is where Natural Earth 50m stops
    // being smooth.
    expect(box.width).toBeGreaterThanOrEqual(400);
  });

  it('keeps a landscape shape even for a vertically-arranged set', () => {
    // A tall narrow box would render as a tall narrow map, since the SVG
    // scales to its viewBox.
    const box = fit([{ x: 1000, y: 200 }, { x: 1000, y: 800 }]);
    expect(box.width / box.height).toBeGreaterThan(1.5);
  });

  it('never claims more than the world', () => {
    const box = fit([{ x: 0, y: 0 }, { x: 2000, y: 1000 }]);

    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(2000);
    expect(box.bottom).toBeLessThanOrEqual(1000);
  });

  it('slides the box inside the world rather than shrinking it, so edge points stay visible', () => {
    // A point hard against the left edge would otherwise sit outside a box
    // centred on it.
    const points = [{ x: 5, y: 500 }, { x: 60, y: 520 }];
    const box = fit(points);

    expect(box.x).toBe(0);
    expect(containsAll(box, points)).toBe(true);
  });

  it('handles a point in each far corner', () => {
    const points = [{ x: 2, y: 2 }, { x: 1998, y: 998 }];
    expect(containsAll(fit(points), points)).toBe(true);
  });

  it('respects a custom minimum width', () => {
    expect(fit([{ x: 1000, y: 500 }], { minWidth: 900 }).width).toBeGreaterThanOrEqual(900);
  });

  it('pads around the points rather than cropping to them exactly', () => {
    const box = fit([{ x: 900, y: 480 }, { x: 1100, y: 520 }]);
    expect(box.x).toBeLessThan(900);
    expect(box.right).toBeGreaterThan(1100);
  });

  it('produces a globe-spanning box for globe-spanning points', () => {
    // Known limitation, pinned here so it's a documented choice rather than a
    // surprise: no antimeridian wrapping, so Tokyo + Los Angeles spans the long
    // way round instead of across the Pacific.
    const tokyo = { x: (139.69 + 180) / 360 * 2000, y: (90 - 35.68) / 180 * 1000 };
    const la = { x: (-118.24 + 180) / 360 * 2000, y: (90 - 34.05) / 180 * 1000 };
    const box = fit([tokyo, la]);

    expect(box.width).toBe(2000);
    expect(containsAll(box, [tokyo, la])).toBe(true);
  });
});

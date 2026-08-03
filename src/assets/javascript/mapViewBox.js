// Works out the tightest sensible SVG viewBox that still contains every point
// on a WorldMap.
//
// Bug report: "with the map it looks cool, but it is too zoomed out ... we need
// to automatically scope the map zoomed in already ... the most zoomed in that
// it can be where it still contains all of the points of interest."
//
// Pure and store-free so the geometry can be unit tested directly, rather than
// only through a mounted component.

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

/**
 * @param plottedPoints [{ x, y }] already projected into world space
 * @param width/height  the full projection space (2000 x 1000)
 * @param fallback      viewBox to use when there's nothing to fit
 * @param targetAspect  preferred width:height of the resulting box. A tall,
 *                      narrow box would render as a tall narrow map, since the
 *                      SVG scales to its viewBox — so the box is widened to a
 *                      landscape shape rather than hugging the points exactly.
 * @param paddingFraction  breathing room around the points, as a fraction of
 *                      their own span.
 * @param minWidth      floor on how far in we'll zoom, and it exists because of
 *                      the SOURCE DATA, not taste. The land outline is Natural
 *                      Earth 110m — drawn for world-scale maps, with no borders
 *                      or labels — so past roughly 2.5x it degrades into an
 *                      unrecognisable blur. With the 50m upgrade that limit
 *                      moved out to ~16x, i.e. 1250 of the 20000-unit grid,
 *                      measured by rendering southern California at 110m/50m/
 *                      10m and comparing where the coastline stops
 *                      staircasing. Going closer than this needs real map
 *                      tiles, which would mean a network connection and an API
 *                      key — and would cost the offline support.
 *
 * KNOWN LIMITATION: no antimeridian wrapping. Points in Tokyo and Los Angeles
 * produce a box spanning the long way round (~257°) rather than the short way
 * across the Pacific (~103°). The result is correct, just wider than ideal.
 * Handling it properly means picking the smaller of the two arcs and rendering
 * a wrapped map, which is a lot of complexity for a rare case.
 */
export function fitViewBox (plottedPoints, {
  width,
  height,
  fallback,
  targetAspect = 2.5,
  paddingFraction = 0.35,
  minWidth = 1250
} = {}) {
  const points = (plottedPoints || []).filter(
    (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)
  );

  if (!points.length) {
    return fallback;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const spanX = maxX - minX;
  const spanY = maxY - minY;

  // Pad relative to the span, with an absolute floor so a single point (span 0)
  // still gets room around it.
  let boxWidth = spanX + Math.max(spanX * paddingFraction * 2, minWidth * 0.4);
  let boxHeight = spanY + Math.max(spanY * paddingFraction * 2, minWidth * 0.4 / targetAspect);

  boxWidth = Math.max(boxWidth, minWidth);
  boxHeight = Math.max(boxHeight, minWidth / targetAspect);

  // Grow the deficient dimension to reach the target shape — never shrink,
  // which would push points outside the box.
  if (boxWidth / boxHeight < targetAspect) {
    boxWidth = boxHeight * targetAspect;
  } else {
    boxHeight = boxWidth / targetAspect;
  }

  // Never claim more than the world. Clamping width first and re-deriving
  // height keeps the shape landscape; only a genuinely globe-spanning set ends
  // up hitting both limits, and at that point "the whole world" is the right
  // answer anyway.
  if (boxWidth > width) {
    boxWidth = width;
    boxHeight = Math.min(boxWidth / targetAspect, height);
  }
  if (boxHeight > height) {
    boxHeight = height;
    boxWidth = Math.min(boxHeight * targetAspect, width);
  }

  // Containment beats shape. Clamping to the world above can leave a box too
  // short (or narrow) to actually hold the points — e.g. points in opposite
  // corners give a 2:1 span, which the 2.5:1 target then widens past the
  // world's width, and re-deriving height from the clamped width produced a
  // box shorter than the points' own vertical span. Both spans fit inside the
  // world by construction, so this can always be satisfied.
  boxWidth = clamp(Math.max(boxWidth, spanX), 0, width);
  boxHeight = clamp(Math.max(boxHeight, spanY), 0, height);

  // Centre on the points, then slide the whole box inside the world rather
  // than shrinking it — sliding keeps every point visible.
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  const x = clamp(centreX - boxWidth / 2, 0, width - boxWidth);
  const y = clamp(centreY - boxHeight / 2, 0, height - boxHeight);

  const round = (value) => Math.round(value * 10) / 10;
  return `${round(x)} ${round(y)} ${round(boxWidth)} ${round(boxHeight)}`;
}

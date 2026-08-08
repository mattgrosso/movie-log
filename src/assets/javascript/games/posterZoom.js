import { entryKey } from './gameUtils.js';

// Pure, store-free rules for Poster Zoom: a poster starts at an extreme crop
// and zooms out a step at a time until the player names it. Fewer zoom-outs
// is a better score.
//
// Nothing here touches the DOM or the network — the component turns a zoom
// level plus a focal point into CSS, and this decides what those should be.

// Scale factors, most zoomed first. The last step is 1 (the whole poster),
// so a player who keeps zooming always ends up seeing the answer rather than
// stalling on a crop they can't place.
//
// 6x was tried first and gave too many featureless openings — a ~50px square
// of a poster is very often just sky or a flat backdrop, which makes a
// zero-zoom-out win luck rather than skill.
export const ZOOM_LEVELS = [4.5, 3.4, 2.6, 2, 1.5, 1];

// Where the crop is allowed to land.
//
// Deliberately not symmetric: posters overwhelmingly put artwork in the
// upper two-thirds and the title treatment plus the credit block along the
// bottom, so biasing upward lands on the image itself far more often. The
// horizontal range stays centred to avoid the spine/border margins.
//
// Picking a genuinely "interesting" crop by measuring image variance is NOT
// an option: TMDB's image CDN sends no CORS headers, so drawing a poster to
// a canvas taints it and getImageData throws. Verified in a real browser.
const FOCUS_X_MIN = 0.25;
const FOCUS_X_RANGE = 0.5;
const FOCUS_Y_MIN = 0.18;
const FOCUS_Y_RANGE = 0.44;

/**
 * Where to zoom in on. Returned as percentages so it can be dropped straight
 * into `transform-origin`, and persisted so a resumed round shows the exact
 * same crop rather than silently becoming a different puzzle.
 */
export function pickZoomOrigin (rng = Math.random) {
  return {
    x: Math.round((FOCUS_X_MIN + rng() * FOCUS_X_RANGE) * 100),
    y: Math.round((FOCUS_Y_MIN + rng() * FOCUS_Y_RANGE) * 100)
  };
}

/** Clamped so a stored or fat-fingered index can never index off the array. */
export function clampZoomIndex (index, levels = ZOOM_LEVELS) {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), levels.length - 1);
}

export function zoomLevelAt (index, levels = ZOOM_LEVELS) {
  return levels[clampZoomIndex(index, levels)];
}

export function isFullyZoomedOut (index, levels = ZOOM_LEVELS) {
  return clampZoomIndex(index, levels) >= levels.length - 1;
}

/**
 * The CSS for one step. `transform-origin` is what makes the zoom appear to
 * pull back from a specific point rather than the middle of the image.
 */
export function zoomStyleFor (index, origin, levels = ZOOM_LEVELS) {
  const scale = zoomLevelAt(index, levels);
  const x = origin?.x ?? 50;
  const y = origin?.y ?? 50;
  return {
    transform: `scale(${scale})`,
    transformOrigin: `${x}% ${y}%`
  };
}

/**
 * Same "don't hand back the round we just finished, but fall back to the full
 * pool rather than dead-ending" shape as pickTriviaTarget. Built in from the
 * start because two games' "keeps repeating" bug reports both traced to this
 * exclusion being missing (see CLAUDE.md).
 */
export function pickZoomTarget (pool, excludeKey, rng = Math.random) {
  if (!pool || !pool.length) return null;
  const candidates = excludeKey ? pool.filter((entry) => entryKey(entry) !== excludeKey) : pool;
  const choices = candidates.length ? candidates : pool;
  return choices[Math.floor(rng() * choices.length)];
}

/** Only posters can be zoomed, so entries without one can't be a target. */
export function entriesWithPosters (entries) {
  return (entries || []).filter((entry) => entry?.movie?.poster_path);
}

/** Golf-style: zero zoom-outs (named from the tightest crop) is the best. */
export function isNewBestScore (zoomOuts, previousBest) {
  return previousBest == null || zoomOuts < previousBest;
}

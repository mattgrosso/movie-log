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
// The opening step is deliberately near-impossible — you're looking at an
// eighth of the poster's width, a patch of texture. It's meant to be a
// lottery ticket you glance at before taking the first zoom-out, not a fair
// guess. The rest of the ladder is the playable part.
//
// An earlier version opened at 6x with a CENTRED focal point and gave too
// many featureless crops. That was fixed by biasing the focal point upward
// (see below), not by backing off the zoom.
export const ZOOM_LEVELS = [8, 5.5, 4, 3, 2.2, 1.6, 1];

// Where the crop is allowed to land.
//
// Deliberately not symmetric: posters overwhelmingly put artwork in the
// upper two-thirds and the title treatment plus the credit block along the
// bottom, so biasing upward lands on the image itself far more often. The
// horizontal range stays centred to avoid the spine/border margins.
//
// A random point in this band is only the FALLBACK. The opening crop is an
// eighth of the poster, which lands on a flat patch of sky or a black
// background often enough to be useless, so candidates are scored against
// the real pixels — see zoomOriginCandidates and the component's
// chooseOrigin. (An earlier note here claimed TMDB sends no CORS headers and
// that this was impossible. That was wrong: it does send
// access-control-allow-origin, and the load that "proved" otherwise failed
// only because the image was already cached from a non-CORS request.)
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

/**
 * A spread of candidate focal points for the component to score against the
 * poster's actual pixels, picking whichever has the most going on.
 *
 * Generated here rather than in the component so the allowed band stays in
 * one place, and so the scoring step can be tested with a fake sampler.
 */
export function zoomOriginCandidates (rng = Math.random, count = 24) {
  return Array.from({ length: Math.max(1, count) }, () => pickZoomOrigin(rng));
}

/**
 * The candidate with the most visual variation, given a sampler that reports
 * how much is going on at a point. Ties and an all-flat poster both resolve
 * to the first candidate, which is a plain random pick — never worse than
 * the fallback.
 */
export function pickMostInterestingOrigin (candidates, varianceAt) {
  if (!candidates || !candidates.length) return null;
  if (typeof varianceAt !== 'function') return candidates[0];

  let best = candidates[0];
  let bestScore = -Infinity;
  candidates.forEach((candidate) => {
    const score = varianceAt(candidate);
    if (Number.isFinite(score) && score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  });
  return best;
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

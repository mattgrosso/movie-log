import { describe, it, expect } from 'vitest';
import {
  ZOOM_LEVELS,
  pickZoomOrigin,
  clampZoomIndex,
  zoomLevelAt,
  isFullyZoomedOut,
  zoomStyleFor,
  zoomOriginCandidates,
  pickMostInterestingOrigin,
  pickZoomTarget,
  entriesWithPosters,
  isNewBestScore
} from '../../assets/javascript/games/posterZoom.js';

const entry = (id, posterPath = `/p${id}.jpg`) => ({
  dbKey: `key-${id}`,
  movie: { id, title: `Movie ${id}`, poster_path: posterPath }
});

describe('ZOOM_LEVELS', () => {
  it('starts tight and ends on the whole poster', () => {
    // The last step must be 1, so a player who keeps zooming always ends up
    // seeing the answer rather than stalling on a crop they can't place.
    expect(ZOOM_LEVELS[0]).toBeGreaterThan(1);
    expect(ZOOM_LEVELS.at(-1)).toBe(1);
  });

  it('only ever zooms out, never back in', () => {
    ZOOM_LEVELS.forEach((level, i) => {
      if (i > 0) expect(level).toBeLessThan(ZOOM_LEVELS[i - 1]);
    });
  });
});

describe('pickZoomOrigin', () => {
  it('keeps the focal point off the edges', () => {
    // Poster edges are mostly border or margin — a crop there is
    // unguessable for reasons that have nothing to do with the film.
    for (let i = 0; i < 200; i++) {
      const { x, y } = pickZoomOrigin();
      expect(x).toBeGreaterThanOrEqual(25);
      expect(x).toBeLessThanOrEqual(75);
      expect(y).toBeGreaterThanOrEqual(18);
      expect(y).toBeLessThanOrEqual(62);
    }
  });

  it('biases upward, away from the title and credit block', () => {
    // Posters put artwork in the upper two-thirds and the title treatment
    // plus credits along the bottom, so a centred vertical range would land
    // on text far too often.
    const ys = Array.from({ length: 300 }, () => pickZoomOrigin().y);
    expect(Math.max(...ys)).toBeLessThan(70);
    expect(ys.reduce((a, b) => a + b, 0) / ys.length).toBeLessThan(50);
  });

  it('is driven entirely by the rng, so a round can be reproduced', () => {
    expect(pickZoomOrigin(() => 0)).toEqual({ x: 25, y: 18 });
    expect(pickZoomOrigin(() => 1)).toEqual({ x: 75, y: 62 });
  });

  it('varies between rounds', () => {
    const seen = new Set(Array.from({ length: 50 }, () => JSON.stringify(pickZoomOrigin())));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('clampZoomIndex', () => {
  it('never indexes off either end of the ladder', () => {
    expect(clampZoomIndex(-5)).toBe(0);
    expect(clampZoomIndex(999)).toBe(ZOOM_LEVELS.length - 1);
    expect(clampZoomIndex(2)).toBe(2);
  });

  it('tolerates junk from a stored round', () => {
    expect(clampZoomIndex(undefined)).toBe(0);
    expect(clampZoomIndex(NaN)).toBe(0);
    expect(clampZoomIndex('3')).toBe(0);
    expect(clampZoomIndex(1.9)).toBe(1);
  });
});

describe('zoomLevelAt / isFullyZoomedOut', () => {
  it('reads the ladder by index', () => {
    expect(zoomLevelAt(0)).toBe(ZOOM_LEVELS[0]);
    expect(zoomLevelAt(ZOOM_LEVELS.length - 1)).toBe(1);
  });

  it('knows when there is nothing left to reveal', () => {
    expect(isFullyZoomedOut(0)).toBe(false);
    expect(isFullyZoomedOut(ZOOM_LEVELS.length - 1)).toBe(true);
    expect(isFullyZoomedOut(999)).toBe(true);
  });
});

describe('zoomStyleFor', () => {
  it('scales from the chosen focal point, not the centre', () => {
    // transform-origin is the whole trick: without it every poster would
    // just zoom out from the middle and the crop would be meaningless.
    expect(zoomStyleFor(0, { x: 30, y: 70 })).toEqual({
      transform: `scale(${ZOOM_LEVELS[0]})`,
      transformOrigin: '30% 70%'
    });
  });

  it('ends at scale(1) — the untouched poster', () => {
    expect(zoomStyleFor(ZOOM_LEVELS.length - 1, { x: 40, y: 40 }).transform).toBe('scale(1)');
  });

  it('falls back to the centre when no origin was stored', () => {
    expect(zoomStyleFor(0, null).transformOrigin).toBe('50% 50%');
    expect(zoomStyleFor(0, {}).transformOrigin).toBe('50% 50%');
  });
});

describe('pickZoomTarget', () => {
  it('never hands back the round that just finished', () => {
    const pool = [entry(1), entry(2)];
    for (let i = 0; i < 30; i++) {
      expect(pickZoomTarget(pool, 'key-1').dbKey).toBe('key-2');
    }
  });

  it('falls back to the pool rather than dead-ending on a one-movie library', () => {
    const pool = [entry(1)];
    expect(pickZoomTarget(pool, 'key-1').dbKey).toBe('key-1');
  });

  it('returns null with nothing to pick from', () => {
    expect(pickZoomTarget([], null)).toBeNull();
    expect(pickZoomTarget(null, null)).toBeNull();
  });
});

describe('entriesWithPosters', () => {
  it('drops entries that have no poster to zoom into', () => {
    const pool = [entry(1), entry(2, null), { dbKey: 'k3', movie: {} }, null];
    expect(entriesWithPosters(pool).map((e) => e.dbKey)).toEqual(['key-1']);
  });

  it('tolerates no input', () => {
    expect(entriesWithPosters(null)).toEqual([]);
  });
});

describe('isNewBestScore', () => {
  it('treats fewer zoom-outs as better', () => {
    expect(isNewBestScore(1, null)).toBe(true);
    expect(isNewBestScore(1, 3)).toBe(true);
    expect(isNewBestScore(3, 1)).toBe(false);
    expect(isNewBestScore(2, 2)).toBe(false);
  });

  it('counts a zero-zoom-out win, which is the best possible', () => {
    expect(isNewBestScore(0, 1)).toBe(true);
  });
});

describe('zoomOriginCandidates', () => {
  it('offers a spread of points inside the allowed band', () => {
    const candidates = zoomOriginCandidates(Math.random, 12);
    expect(candidates).toHaveLength(12);
    candidates.forEach(({ x, y }) => {
      expect(x).toBeGreaterThanOrEqual(25);
      expect(x).toBeLessThanOrEqual(75);
      expect(y).toBeGreaterThanOrEqual(18);
      expect(y).toBeLessThanOrEqual(62);
    });
  });

  it('always offers at least one', () => {
    expect(zoomOriginCandidates(Math.random, 0)).toHaveLength(1);
  });
});

describe('pickMostInterestingOrigin', () => {
  it('picks the busiest spot, so the opening crop is not a blank rectangle', () => {
    // At 8x a random point lands on flat sky or a black background often
    // enough to open on nothing at all — hard for no interesting reason.
    const candidates = [{ x: 30, y: 30 }, { x: 40, y: 40 }, { x: 50, y: 50 }];
    const busy = ({ x }) => (x === 40 ? 90 : 2);

    expect(pickMostInterestingOrigin(candidates, busy)).toEqual({ x: 40, y: 40 });
  });

  it('falls back to a plain random pick when nothing can be measured', () => {
    const candidates = [{ x: 30, y: 30 }, { x: 40, y: 40 }];
    expect(pickMostInterestingOrigin(candidates, null)).toEqual({ x: 30, y: 30 });
    expect(pickMostInterestingOrigin(candidates, () => NaN)).toEqual({ x: 30, y: 30 });
  });

  it('still returns a point on a completely flat poster', () => {
    const candidates = [{ x: 30, y: 30 }, { x: 40, y: 40 }];
    expect(candidates).toContainEqual(pickMostInterestingOrigin(candidates, () => 0));
  });

  it('tolerates having nothing to choose from', () => {
    expect(pickMostInterestingOrigin([], () => 1)).toBeNull();
    expect(pickMostInterestingOrigin(null, () => 1)).toBeNull();
  });
});

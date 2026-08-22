import { describe, it, expect, vi } from 'vitest';
import {
  MAX_TILT_DEG,
  MAX_SHIFT_PCT,
  SCALE,
  tiltOffset,
  tiltVector,
  settleBaseline,
  follow,
  createBannerParallax
} from '@/assets/javascript/bannerParallax.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// A window stand-in the orchestrator can attach to, with handlers we can
// fire by hand.
function fakeWin ({ DeviceOrientationEvent: doe, reducedMotion = false } = {}) {
  const handlers = {};
  return {
    DeviceOrientationEvent: doe,
    matchMedia: (query) => ({ matches: reducedMotion && query.includes('reduced-motion') }),
    addEventListener: vi.fn((type, handler) => { handlers[type] = handler; }),
    removeEventListener: vi.fn((type) => { delete handlers[type]; }),
    handlers
  };
}

function img () {
  return { style: { transform: '' } };
}

describe('tilt math', () => {
  const rad = (deg) => (deg * Math.PI) / 180;
  const S = Math.sin(rad(MAX_TILT_DEG)); // tilt-vector length at full throw

  it('sits at zero when the reading matches the baseline', () => {
    const reading = { beta: 40, gamma: -5 };
    const offset = tiltOffset(reading, tiltVector(reading));
    // toBeCloseTo, not toEqual: the negation makes this -0, which toEqual
    // distinguishes from +0. They render identically.
    expect(offset.x).toBeCloseTo(0, 10);
    expect(offset.y).toBeCloseTo(0, 10);
  });

  // Signs are the window illusion (report 2026-08-21: "peek around the
  // corner, not slide the picture in that direction"): tilting toward one
  // side moves the photo the OTHER way, revealing that side.
  it('scales with the tilt, clamps at the full-tilt angle, and counter-moves the tilt', () => {
    const upright = tiltVector({ beta: 0, gamma: 0 });

    const half = tiltOffset({ beta: 0, gamma: MAX_TILT_DEG / 2 }, upright);
    expect(half.x).toBeCloseTo(-(Math.sin(rad(MAX_TILT_DEG / 2)) / S) * MAX_SHIFT_PCT, 5);

    const wild = tiltOffset({ beta: 30, gamma: -30 }, upright);
    expect(wild.x).toBe(MAX_SHIFT_PCT);
    expect(wild.y).toBe(-MAX_SHIFT_PCT);
  });

  // Bug report (2026-08-21, lying in bed): "the banner image is like weirdly
  // bouncy or loose... really jerky." Euler angles are discontinuous in two
  // ways and BOTH showed up in bed. The tilt vector (gravity direction) is
  // continuous everywhere, so these postures are ordinary points on it.
  it('a tremor across the beta ±180 wrap (phone overhead) is a small nudge', () => {
    const offset = tiltOffset({ beta: 179.5, gamma: 0 }, tiltVector({ beta: -179.5, gamma: 0 }));
    const delta = Math.sin(rad(179.5)) - Math.sin(rad(-179.5));
    expect(offset.y).toBeCloseTo(-(delta / S) * MAX_SHIFT_PCT, 5);
    expect(Math.abs(offset.y)).toBeLessThan(0.3);
  });

  // The one the first fix missed (report: "still doing its sort of jerky
  // motions"): as the screen passes near vertical, iOS re-expresses the SAME
  // physical pose with gamma's sign flipped and beta jumped by 180 at once.
  // A 180° jump has no "short way around" — it flip-flopped full throw. The
  // two representations must produce the SAME tilt vector.
  it('the coordinated Euler flip (screen near vertical) is a no-op', () => {
    const before = tiltVector({ beta: 0, gamma: 89 });
    const after = tiltVector({ beta: -180, gamma: -89 });
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);

    const offset = tiltOffset({ beta: -180, gamma: -89 }, before);
    expect(offset.x).toBeCloseTo(0, 10);
    expect(offset.y).toBeCloseTo(0, 10);
  });

  it('the scale margin always covers the maximum shift, so no edge shows', () => {
    expect((SCALE - 1) / 2 * 100).toBeGreaterThan(MAX_SHIFT_PCT);
  });

  it('settleBaseline drifts the neutral vector toward the current posture', () => {
    const settled = settleBaseline({ x: 0, y: 0 }, { beta: 10, gamma: -10 }, 0.5);
    expect(settled.x).toBeCloseTo((Math.sin(rad(-10)) * Math.cos(rad(10))) / 2, 10);
    expect(settled.y).toBeCloseTo(Math.sin(rad(10)) / 2, 10);
  });

  it('follow eases the drawn offset toward the target', () => {
    expect(follow({ x: 0, y: 0 }, { x: 10, y: -10 }, 0.5)).toEqual({ x: 5, y: -5 });
  });
});

describe('createBannerParallax', () => {
  it('does nothing without DeviceOrientationEvent support', async () => {
    const win = fakeWin({ DeviceOrientationEvent: undefined });
    const parallax = createBannerParallax({ getImage: img, win, raf: null });
    parallax.start();
    await flush();

    expect(win.addEventListener).not.toHaveBeenCalled();
  });

  it('does nothing under prefers-reduced-motion', async () => {
    const win = fakeWin({ DeviceOrientationEvent: function () {}, reducedMotion: true });
    const parallax = createBannerParallax({ getImage: img, win, raf: null });
    parallax.start();
    await flush();

    expect(win.addEventListener).not.toHaveBeenCalled();
  });

  it('attaches directly where no permission is needed, and moves the photo', async () => {
    const win = fakeWin({ DeviceOrientationEvent: function () {} });
    const image = img();
    const parallax = createBannerParallax({ getImage: () => image, win, raf: null });
    parallax.start();
    await flush();

    expect(win.handlers.deviceorientation).toBeTruthy();

    // First reading becomes the neutral posture...
    win.handlers.deviceorientation({ beta: 40, gamma: 0 });
    parallax._frame();
    expect(image.style.transform).toContain(`scale(${SCALE})`);
    expect(image.style.transform).toContain('translate3d(0.000%, 0.000%');

    // ...and a rightward tilt drifts the photo LEFT — the window illusion.
    win.handlers.deviceorientation({ beta: 40, gamma: 10 });
    parallax._frame();
    const x = parseFloat(image.style.transform.match(/translate3d\((-?[\d.]+)%/)[1]);
    expect(x).toBeLessThan(0);
  });

  it('on iOS, a gesture-required refusal arms a one-time tap that asks again', async () => {
    const requestPermission = vi.fn()
      .mockRejectedValueOnce(new Error('needs a user gesture'))
      .mockResolvedValueOnce('granted');
    const win = fakeWin({ DeviceOrientationEvent: { requestPermission } });
    const parallax = createBannerParallax({ getImage: img, win, raf: null });

    parallax.start();
    await flush();
    expect(win.handlers.click).toBeTruthy();
    expect(win.handlers.deviceorientation).toBeFalsy();

    win.handlers.click();
    await flush();
    expect(requestPermission).toHaveBeenCalledTimes(2);
    expect(win.handlers.deviceorientation).toBeTruthy();
  });

  it('a real denial is final — no listeners, no re-asking', async () => {
    const requestPermission = vi.fn().mockResolvedValue('denied');
    const win = fakeWin({ DeviceOrientationEvent: { requestPermission } });
    const parallax = createBannerParallax({ getImage: img, win, raf: null });

    parallax.start();
    await flush();
    parallax.start();
    await flush();

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(win.handlers.deviceorientation).toBeFalsy();
    expect(win.handlers.click).toBeFalsy();
  });

  it('stop removes the listener and clears the transform', async () => {
    const win = fakeWin({ DeviceOrientationEvent: function () {} });
    const image = img();
    const parallax = createBannerParallax({ getImage: () => image, win, raf: null });
    parallax.start();
    await flush();

    win.handlers.deviceorientation({ beta: 10, gamma: 5 });
    parallax._frame();
    expect(image.style.transform).not.toBe('');

    parallax.stop();
    expect(win.handlers.deviceorientation).toBeFalsy();
    expect(image.style.transform).toBe('');
  });
});

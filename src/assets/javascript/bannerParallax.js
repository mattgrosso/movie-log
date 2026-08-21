// Banner tilt parallax. Matt's report (2026-08-21): "as I tilt my phone
// [the banner photo] kind of moves around a little bit... like the
// background relative to the foreground like logo... subtle little bit of
// movement."
//
// The photo drifts a couple of percent against the fixed "Cinema Roll"
// pill, driven by deviceorientation. Three realities shape the code:
//
// - iOS only delivers orientation events after
//   DeviceOrientationEvent.requestPermission(), which itself only works
//   from a user gesture. So: try silently at start (Android and old iOS
//   just work), and if that's refused, arm a one-time tap listener and ask
//   again from inside the gesture. A user who *denies* is never asked again.
// - There is no absolute "neutral" phone angle — however you're holding it
//   right now IS neutral. The baseline is a slow exponential follow of the
//   readings, so the effect always re-centres on your current posture and a
//   change of grip fades out instead of sticking the photo at an edge.
// - prefers-reduced-motion means none of this happens at all.
//
// The image gets `translate3d(x%, y%, 0) scale(SCALE)`; the scale margin is
// larger than the maximum shift, so the drift never exposes an edge inside
// the header's overflow-hidden wrapper. transform only — this app has seen
// visual trails from combining transform with filters (vue-ui rule).

export const MAX_TILT_DEG = 14;   // tilt that reaches full shift
export const MAX_SHIFT_PCT = 2.2; // of the image's own size, per axis
export const SCALE = 1.06;        // 3% margin a side — always > MAX_SHIFT_PCT
// Feel (retuned 2026-08-21, "a little bit squishy"): the chase is fast so
// the photo tracks the hand rather than swimming after it, and the baseline
// follow is slow so a held tilt doesn't visibly rubber-band back to centre.
export const BASELINE_ALPHA = 0.006; // ~2s half-life at 60fps
export const FOLLOW = 0.35;          // how fast the drawn offset chases the tilt

// Where the photo should sit for a reading against a baseline: linear in
// the tilt delta, clamped at MAX_TILT_DEG. gamma is left/right tilt → x,
// beta is toward/away tilt → y (portrait mapping; the banner is phone-only).
export function tiltOffset (reading, baseline) {
  const unit = (value) => Math.max(-1, Math.min(1, value / MAX_TILT_DEG));
  return {
    x: unit((reading.gamma ?? 0) - baseline.gamma) * MAX_SHIFT_PCT,
    y: unit((reading.beta ?? 0) - baseline.beta) * MAX_SHIFT_PCT
  };
}

// Slow exponential follow: the neutral point drifts toward however the
// phone is actually being held.
export function settleBaseline (baseline, reading, alpha = BASELINE_ALPHA) {
  return {
    beta: baseline.beta + ((reading.beta ?? 0) - baseline.beta) * alpha,
    gamma: baseline.gamma + ((reading.gamma ?? 0) - baseline.gamma) * alpha
  };
}

export function follow (current, target, factor = FOLLOW) {
  return {
    x: current.x + (target.x - current.x) * factor,
    y: current.y + (target.y - current.y) * factor
  };
}

/**
 * Wire the effect to a banner image. `getImage` re-resolves every frame —
 * the img is v-if'd on a store value and may appear or vanish at any time.
 * Pass `raf: null` in tests and drive `_frame()` by hand.
 */
export function createBannerParallax ({
  getImage,
  win = typeof window === 'undefined' ? null : window,
  raf = win ? win.requestAnimationFrame?.bind(win) : null
} = {}) {
  let running = false;
  let armed = false;
  let denied = false;
  let reading = null;
  let baseline = null;
  let drawn = { x: 0, y: 0 };
  let frameId = null;

  const onOrientation = (event) => {
    if (event.beta == null && event.gamma == null) return;
    reading = { beta: event.beta ?? 0, gamma: event.gamma ?? 0 };
  };

  const frame = () => {
    if (!running) return;
    if (reading) {
      baseline = baseline ? settleBaseline(baseline, reading) : { ...reading };
      drawn = follow(drawn, tiltOffset(reading, baseline));
      const image = getImage();
      if (image) {
        image.style.transform =
          `translate3d(${drawn.x.toFixed(3)}%, ${drawn.y.toFixed(3)}%, 0) scale(${SCALE})`;
      }
    }
    if (raf) frameId = raf(frame);
  };

  const attach = () => {
    if (running) return;
    running = true;
    win.addEventListener('deviceorientation', onOrientation);
    frame();
  };

  const tryStart = async () => {
    const Orientation = win?.DeviceOrientationEvent;
    if (!Orientation || denied) return;
    if (typeof Orientation.requestPermission === 'function') {
      try {
        const answer = await Orientation.requestPermission();
        if (answer !== 'granted') { denied = true; return; } // a "no" is final
      } catch {
        // Needs a user gesture — ask again from inside the next tap.
        armOnce();
        return;
      }
    }
    attach();
  };

  const onGesture = () => {
    armed = false;
    tryStart();
  };

  const armOnce = () => {
    if (armed || running || denied) return;
    armed = true;
    win.addEventListener('click', onGesture, { once: true, passive: true });
  };

  return {
    start () {
      if (!win || running) return;
      if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      tryStart();
    },
    stop () {
      if (armed) { win.removeEventListener('click', onGesture); armed = false; }
      if (!running) return;
      running = false;
      win.removeEventListener('deviceorientation', onOrientation);
      if (frameId != null && win.cancelAnimationFrame) win.cancelAnimationFrame(frameId);
      const image = getImage();
      if (image) image.style.transform = '';
    },
    _frame: frame
  };
}

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

// Orientation angles live on circles, and every delta must take the SHORT
// way around (bug report 2026-08-21, lying in bed: "the banner image is
// like weirdly bouncy or loose... really jerky"). Held overhead, the phone
// sits near beta's ±180 wrap, where a tremor flips the reading from +179 to
// -179 — a raw subtraction saw a 358° swing and slammed the photo to full
// throw on every flip. beta's period is 360 ([-180, 180)); gamma's is 180
// ([-90, 90), it flips sign as the screen passes vertical).
const angleDelta = (to, from, period) => {
  let delta = (to - from) % period;
  if (delta > period / 2) delta -= period;
  if (delta < -period / 2) delta += period;
  return delta;
};

// Keep an accumulating angle inside its sensor range after a nudge.
const wrapAngle = (value, period) => {
  const half = period / 2;
  return ((((value + half) % period) + period) % period) - half;
};

// Where the photo should sit for a reading against a baseline: linear in
// the tilt delta, clamped at MAX_TILT_DEG. gamma is left/right tilt → x,
// beta is toward/away tilt → y (portrait mapping; the banner is phone-only).
//
// NEGATED on both axes (report 2026-08-21: "when I tilt my phone, it lets
// me kind of like peek around the corner, not like it slides the picture in
// that direction"): the header is a window, and tilting the phone right
// should reveal more of the photo's left — the way a real window works —
// rather than dragging the photo rightward with the motion.
export function tiltOffset (reading, baseline) {
  const unit = (value) => Math.max(-1, Math.min(1, value / MAX_TILT_DEG));
  return {
    x: -unit(angleDelta(reading.gamma ?? 0, baseline.gamma, 180)) * MAX_SHIFT_PCT,
    y: -unit(angleDelta(reading.beta ?? 0, baseline.beta, 360)) * MAX_SHIFT_PCT
  };
}

// Slow exponential follow: the neutral point drifts toward however the
// phone is actually being held — by the short way around, staying inside
// the sensor's own range so later deltas keep making sense.
export function settleBaseline (baseline, reading, alpha = BASELINE_ALPHA) {
  return {
    beta: wrapAngle(baseline.beta + angleDelta(reading.beta ?? 0, baseline.beta, 360) * alpha, 360),
    gamma: wrapAngle(baseline.gamma + angleDelta(reading.gamma ?? 0, baseline.gamma, 180) * alpha, 180)
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

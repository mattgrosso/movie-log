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
//   again from inside the gesture. That whole dance happens ONCE for the
//   whole app and its answer is remembered across launches — see the
//   permission section below, and the bug report that forced it.
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

// Euler angles are the WRONG shape for this effect (bug report 2026-08-21,
// lying in bed: "the banner image is like weirdly bouncy or loose... really
// jerky", and after a shortest-path-wrap fix, "still doing its sort of
// jerky motions"). They are discontinuous two ways: a tremor at beta's
// ±180 wrap (phone overhead), and — the one the wrap fix couldn't cover —
// the coordinated flip as the screen passes near vertical, where iOS
// re-expresses the SAME physical pose with gamma's sign flipped and beta
// jumped by 180 at once. A 180° jump has no "short way around", so it
// flip-flopped between +full and -full throw.
//
// So: convert each reading to the tilt VECTOR — where gravity points across
// the screen plane. sin/cos of the same angles, but continuous at every
// posture, because two Euler spellings of one pose produce one vector.
// Components are ≈ the tilt in radians for small angles, so the feel
// upright is unchanged.
const rad = (deg) => (deg * Math.PI) / 180;

export function tiltVector (reading) {
  const beta = rad(reading.beta ?? 0);
  const gamma = rad(reading.gamma ?? 0);
  return {
    x: Math.sin(gamma) * Math.cos(beta),
    y: Math.sin(beta)
  };
}

// Full throw is still "MAX_TILT_DEG of tilt", expressed in vector units.
const FULL_TILT = Math.sin(rad(MAX_TILT_DEG));

// Where the photo should sit for a reading against a baseline VECTOR:
// linear in the tilt delta, clamped at MAX_TILT_DEG's worth. x is
// left/right, y toward/away (portrait mapping; the banner is phone-only).
//
// NEGATED on both axes (report 2026-08-21: "when I tilt my phone, it lets
// me kind of like peek around the corner, not like it slides the picture in
// that direction"): the header is a window, and tilting the phone right
// should reveal more of the photo's left — the way a real window works —
// rather than dragging the photo rightward with the motion.
export function tiltOffset (reading, baseline) {
  const unit = (value) => Math.max(-1, Math.min(1, value / FULL_TILT));
  const vector = tiltVector(reading);
  return {
    x: -unit(vector.x - baseline.x) * MAX_SHIFT_PCT,
    y: -unit(vector.y - baseline.y) * MAX_SHIFT_PCT
  };
}

// Slow exponential follow: the neutral vector drifts toward however the
// phone is actually being held. Plain lerp — vectors have no wrap to chase.
export function settleBaseline (baseline, reading, alpha = BASELINE_ALPHA) {
  const target = tiltVector(reading);
  return {
    x: baseline.x + (target.x - baseline.x) * alpha,
    y: baseline.y + (target.y - baseline.y) * alpha
  };
}

export function follow (current, target, factor = FOLLOW) {
  return {
    x: current.x + (target.x - current.x) * factor,
    y: current.y + (target.y - current.y) * factor
  };
}

// ---------------------------------------------------------------------------
// Motion permission — ONE answer for the whole app, remembered across launches
// ---------------------------------------------------------------------------
//
// Bug report (2026-08-22): "It's annoying how often cinema roll is now asking
// me for permission to detect motion. Honestly, if we can't reduce the number
// of times that it asks then we should just get rid of that feature."
//
// Three components build their own parallax — Header (mounted always),
// MovieDetail and RateMovie (mounted on every visit) — and the permission
// state used to be a closure variable inside each one. So every movie you
// opened created an instance that knew nothing, called requestPermission(),
// got the "needs a user gesture" rejection, armed its own click listener, and
// put the iOS dialog in front of your next tap. Denying didn't help either:
// the `denied` flag died with the instance and with the page.
//
// So the answer lives here, at module scope, and in localStorage:
//
// - One in-flight request, shared. Instances that start while a request is
//   pending await the same promise instead of queueing another dialog.
// - One armed gesture listener for the whole app, not one per instance.
// - A "no" is remembered on the DEVICE and is final. Turning the effect back
//   on in Settings is the only way back, which is what makes remembering it
//   safe.
//
// The stored answer can't replace asking outright when it says yes: iOS only
// delivers orientation events after requestPermission() resolves in THIS page
// session. But an already-granted origin resolves it without showing a
// dialog, so a yes costs one silent call per launch and no prompts.

export const MOTION_PERMISSION_KEY = 'cinemaroll.motionPermission';

let sessionAnswer = null;   // 'granted' | 'denied' | null (not asked yet)
let pendingRequest = null;  // shared promise while a request is outstanding

function readStored (win) {
  try {
    return win?.localStorage?.getItem(MOTION_PERMISSION_KEY) || null;
  } catch {
    return null; // Safari private mode throws on access, not just on write.
  }
}

function writeStored (win, answer) {
  try {
    win?.localStorage?.setItem(MOTION_PERMISSION_KEY, answer);
  } catch {
    // Nothing to do — we still have the session answer.
  }
}

/** Test seam, and what the Settings switch calls when the effect is re-enabled. */
export function forgetMotionPermission (win = typeof window === 'undefined' ? null : window) {
  sessionAnswer = null;
  pendingRequest = null;
  try {
    win?.localStorage?.removeItem(MOTION_PERMISSION_KEY);
  } catch {
    // Ignore.
  }
}

function nextGesture (win) {
  return new Promise((resolve) => {
    win.addEventListener('click', () => resolve(), { once: true, passive: true });
  });
}

/**
 * Resolve to 'granted' or 'denied', asking the user at most once per launch
 * and never again after a remembered "no".
 */
export function requestMotionPermission (win) {
  const Orientation = win?.DeviceOrientationEvent;
  if (!Orientation) return Promise.resolve('denied');

  // Nothing to ask on Android / older iOS — events just arrive.
  if (typeof Orientation.requestPermission !== 'function') {
    return Promise.resolve('granted');
  }

  if (sessionAnswer) return Promise.resolve(sessionAnswer);
  if (readStored(win) === 'denied') {
    sessionAnswer = 'denied';
    return Promise.resolve('denied');
  }
  if (pendingRequest) return pendingRequest;

  const settle = (answer) => {
    sessionAnswer = answer;
    pendingRequest = null;
    writeStored(win, answer);
    return answer;
  };

  pendingRequest = (async () => {
    try {
      const answer = await Orientation.requestPermission();
      return settle(answer === 'granted' ? 'granted' : 'denied');
    } catch {
      // Needs a user gesture. ONE armed listener, ONE retry from inside the
      // tap. A second failure ends the attempt for this launch without
      // storing anything, so the next launch may try once more — but this
      // launch will not arm another listener and put up another dialog.
      await nextGesture(win);
      try {
        const answer = await Orientation.requestPermission();
        return settle(answer === 'granted' ? 'granted' : 'denied');
      } catch {
        sessionAnswer = 'denied';
        pendingRequest = null;
        return 'denied';
      }
    }
  })();

  return pendingRequest;
}

/**
 * Wire the effect to a banner image. `getImage` re-resolves every frame —
 * the img is v-if'd on a store value and may appear or vanish at any time.
 * Pass `raf: null` in tests and drive `_frame()` by hand.
 *
 * `isEnabled` is read at start(), not captured, so the Settings switch takes
 * effect on the next screen without a reload.
 */
export function createBannerParallax ({
  getImage,
  isEnabled = () => true,
  win = typeof window === 'undefined' ? null : window,
  raf = win ? win.requestAnimationFrame?.bind(win) : null
} = {}) {
  let running = false;
  let stopped = false;
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
      // The baseline is a tilt VECTOR (see tiltVector); the first reading
      // becomes neutral verbatim.
      baseline = baseline ? settleBaseline(baseline, reading) : tiltVector(reading);
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
    const answer = await requestMotionPermission(win);
    // The permission request can outlive this instance by a long way — it
    // sits on an armed gesture listener — so a screen the user has already
    // left must not quietly start listening when it finally resolves.
    if (answer !== 'granted' || stopped) return;
    attach();
  };

  return {
    start () {
      if (!win || running) return;
      if (!isEnabled()) return;
      if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      stopped = false;
      tryStart();
    },
    stop () {
      stopped = true;
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

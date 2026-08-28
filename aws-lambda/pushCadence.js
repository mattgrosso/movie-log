// WHEN the push Lambda is allowed to send, and what it's allowed to say.
// Pure and dependency-free (plain CommonJS) so it ships inside the Lambda zip
// AND is unit-tested from src/test/pushCadence.test.js — the decision here is
// far too fiddly to leave untested, and it is the difference between a useful
// nudge and an app that nags.
//
// Matt, 2026-08-28: "is this only gonna notify me once a day? It'll be nice
// if it just happened more regularly, you know, as the prompts come in."
//
// THE TRAP, and the reason this file exists: "check more often" naively
// implemented means re-reading the same standing backlog every few hours.
// Thirteen films have been waiting on stickiness for a month; pinging about
// them at 9am, noon, and 3pm is the same notification three times. So the
// rule is NEWS, not STATE — a send needs something that wasn't true last
// time we sent:
//
//   * more films past their stickiness boundary than we've mentioned
//   * a tiebreak where there wasn't one
//   * an award year we haven't named
//
// A BASELINE (stored at {topKey}/push/state/baseline) is what we've already
// told them. It ratchets DOWN freely as chores get done — clearing work must
// never itself look like news, and must re-arm the same chore for next time —
// and jumps UP only when we actually send.
//
// Three more guards, each earning its place:
//   * a waking-hours window, because a film maturing at 3am can wait
//   * spacing across that window, the same "N a day, evenly spaced" shape
//     settings/promptQuota.js already uses for the on-screen prompts
//   * silence while the app is OPEN — the prompts are on screen; a push
//     about what someone is already looking at is pure noise. `digestUpdatedAt`
//     is the signal: the app republishes its digest on every launch.
//
// Plus a staleness backstop: if something is still waiting a full day later,
// say so again. Otherwise ignoring one notification means never hearing
// about that chore again.

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// The app was open this recently ⇒ they are looking at the prompts already.
const ACTIVE_IN_APP_MS = 30 * 60 * 1000;

// Re-mention a still-unfinished chore after this long, even with no news.
const STALE_REMINDER_MS = ONE_DAY_MS;

// 'daily' keeps the original single-nudge-per-day behaviour.
const DEFAULT_CADENCE = 'asTheyCome';
const DEFAULT_WINDOW_START = 9;
const DEFAULT_WINDOW_END = 21;
const DEFAULT_PER_DAY = 4;
const DAILY_MIN_GAP_MS = 20 * HOUR_MS;

const EMPTY_BASELINE = { stickinessCount: 0, tiebreak: false, awardYears: [] };

/**
 * What's due right now, honouring per-category opt-outs.
 *
 * `dueTimes` is why the digest carries future boundary timestamps: films
 * mature into stickiness candidacy while the app is closed, and counting them
 * here is what makes "as the prompts come in" work at all without the client
 * ever running.
 */
function dueFromDigest (digest, prefs, now) {
  const stickinessCount = prefs.stickiness === false
    ? 0
    : (digest?.stickiness?.count || 0) +
      (digest?.stickiness?.dueTimes || []).filter((time) => time <= now).length;

  const tiebreak = prefs.tiebreak === false
    ? null
    : (digest?.tiebreak?.due ? digest.tiebreak : null);

  const awardYears = prefs.awards === false ? [] : (digest?.awards?.years || []);

  return { stickinessCount, tiebreak, awardYears };
}

function normalizeBaseline (baseline) {
  return {
    stickinessCount: Number(baseline?.stickinessCount) || 0,
    tiebreak: Boolean(baseline?.tiebreak),
    awardYears: Array.isArray(baseline?.awardYears) ? baseline.awardYears.map(Number) : []
  };
}

/** What's true now that we haven't already said. */
function newsIn (due, baseline) {
  const base = normalizeBaseline(baseline);
  const known = new Set(base.awardYears);
  const newAwardYears = due.awardYears.filter((year) => !known.has(Number(year)));
  const newStickiness = due.stickinessCount > base.stickinessCount;
  const newTiebreak = Boolean(due.tiebreak) && !base.tiebreak;

  return {
    newStickiness,
    newTiebreak,
    newAwardYears,
    any: newStickiness || newTiebreak || newAwardYears.length > 0
  };
}

function anythingDue (due) {
  return due.stickinessCount > 0 || Boolean(due.tiebreak) || due.awardYears.length > 0;
}

/**
 * The baseline to store after a sweep.
 *
 * Sent ⇒ everything currently due is now "said". Didn't send ⇒ ratchet DOWN
 * only, so finished chores re-arm (do all your stickiness, and the next film
 * to mature is news again) while a standing backlog stays quiet.
 */
function nextBaseline (due, baseline, sent) {
  if (sent) {
    return {
      stickinessCount: due.stickinessCount,
      tiebreak: Boolean(due.tiebreak),
      awardYears: due.awardYears.map(Number)
    };
  }

  const base = normalizeBaseline(baseline);
  const stillDue = new Set(due.awardYears.map(Number));
  return {
    stickinessCount: Math.min(base.stickinessCount, due.stickinessCount),
    tiebreak: base.tiebreak && Boolean(due.tiebreak),
    awardYears: base.awardYears.filter((year) => stillDue.has(year))
  };
}

function windowFor (prefs) {
  const start = Number.isFinite(Number(prefs?.windowStart)) ? Number(prefs.windowStart) : DEFAULT_WINDOW_START;
  const end = Number.isFinite(Number(prefs?.windowEnd)) ? Number(prefs.windowEnd) : DEFAULT_WINDOW_END;
  // A window that doesn't span at least an hour would silence pushes
  // entirely; fall back rather than going mysteriously quiet.
  if (!(end > start)) return { start: DEFAULT_WINDOW_START, end: DEFAULT_WINDOW_END };
  return { start, end };
}

/**
 * Minimum gap between sends: the waking window divided by the allowance, so
 * "4 a day" across a 12-hour window really is every 3 hours. (Dividing a full
 * 24h by the allowance — the shape promptQuota.js uses for on-screen prompts,
 * where there is no window — would silently deliver about half the stated
 * number.)
 */
function spacingMs (prefs) {
  const { start, end } = windowFor(prefs);
  const perDay = Number(prefs?.pushesPerDay);
  const allowance = Number.isFinite(perDay) && perDay > 0 ? perDay : DEFAULT_PER_DAY;
  return ((end - start) * HOUR_MS) / allowance;
}

/**
 * Should a notification go out right now?
 *
 * `localHour` is the user's own wall-clock hour; `digestUpdatedAt` is when
 * their app last published (i.e. was last open).
 */
function shouldSend ({ due, prefs = {}, baseline, now, localHour, lastSentAt = 0, digestUpdatedAt = 0 }) {
  if (prefs.enabled === false) return { send: false, reason: 'disabled' };
  if (!anythingDue(due)) return { send: false, reason: 'nothing-due' };

  const cadence = prefs.cadence || DEFAULT_CADENCE;

  if (cadence === 'daily') {
    const hour = Number.isFinite(Number(prefs.hour)) ? Number(prefs.hour) : 19;
    if (localHour !== hour) return { send: false, reason: 'wrong-hour' };
    if (now - lastSentAt < DAILY_MIN_GAP_MS) return { send: false, reason: 'too-soon' };
    return { send: true, reason: 'daily' };
  }

  const { start, end } = windowFor(prefs);
  if (localHour < start || localHour >= end) return { send: false, reason: 'outside-window' };

  // They have the app open — the prompts are already on screen.
  if (now - digestUpdatedAt < ACTIVE_IN_APP_MS) return { send: false, reason: 'in-app' };

  if (now - lastSentAt < spacingMs(prefs)) return { send: false, reason: 'too-soon' };

  const news = newsIn(due, baseline);
  if (news.any) return { send: true, reason: 'news', news };
  if (now - lastSentAt >= STALE_REMINDER_MS) return { send: true, reason: 'stale', news };

  return { send: false, reason: 'no-news' };
}

/**
 * The notification text. Leads with what's NEW when this send was triggered
 * by news, since that's the part they haven't heard — and for a single newly
 * matured film the digest's `nextTitle` IS that film (it sorts by rating date
 * descending, and the newest arrival is the one that just crossed its
 * boundary).
 */
function composeMessage (due, digest, news) {
  const leadWithNew = Boolean(news?.any);
  const parts = [];

  if (due.stickinessCount > 0) {
    const title = digest?.stickiness?.nextTitle;
    const justOne = leadWithNew
      ? news.newStickiness && due.stickinessCount - 1 <= 0
      : due.stickinessCount === 1;

    if (title && (justOne || (leadWithNew && news.newStickiness))) {
      parts.push(due.stickinessCount > 1
        ? `${title} is ready for its stickiness rating (+${due.stickinessCount - 1} more)`
        : `${title} is ready for its stickiness rating`);
    } else {
      parts.push(due.stickinessCount === 1
        ? 'A film is ready for its stickiness rating'
        : `${due.stickinessCount} films are ready for a stickiness check`);
    }
  }

  if (due.tiebreak) {
    parts.push(due.tiebreak.count >= 2 ? `${due.tiebreak.count} films are tied` : 'A tiebreak is waiting');
  }

  if (due.awardYears.length === 1) {
    parts.push(`${due.awardYears[0]} needs its personal awards`);
  } else if (due.awardYears.length > 1) {
    parts.push(`${due.awardYears.length} years need personal awards`);
  }

  if (!parts.length) return null;
  return {
    title: parts[0],
    body: parts.length > 1 ? parts.slice(1).join(' · ') : 'Tap to knock it out.'
  };
}

module.exports = {
  ONE_DAY_MS,
  ACTIVE_IN_APP_MS,
  STALE_REMINDER_MS,
  DEFAULT_CADENCE,
  DEFAULT_WINDOW_START,
  DEFAULT_WINDOW_END,
  DEFAULT_PER_DAY,
  EMPTY_BASELINE,
  dueFromDigest,
  newsIn,
  anythingDue,
  nextBaseline,
  spacingMs,
  shouldSend,
  composeMessage
};

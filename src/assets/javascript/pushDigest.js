// What the daily push notification is allowed to say — computed HERE, on the
// client, never on the server (Matt, 2026-08-27: push notifications for "the
// prompts that we display": stickiness, tiebreaks, award years needing input).
//
// The design rule this file exists for: THE CLIENT COMPUTES, THE SERVER
// SENDS. The prompt logic (what needs stickiness, what's tied, which award
// years want work) lives in this app and depends on getRating, tournament
// state, and per-user settings; porting any of it into the Lambda would be a
// second copy that drifts. Instead the app publishes this compact digest to
// `{topKey}/push/digest` whenever the library or settings change, and the
// scheduled Lambda (aws-lambda/push-notify.js) only READS it and formats a
// notification.
//
// The one thing a stale digest would get wrong is time passing: a movie rated
// six days ago isn't a stickiness candidate today but becomes one in 24 hours,
// possibly without the app being opened in between. That's what `dueTimes`
// is for — the FUTURE boundary timestamps, so the server can count how many
// candidates exist at send time without knowing any of the rules that
// produced them: dueCount(at send) = count + dueTimes ≤ now.
//
// Mirrors, deliberately:
//   - stickiness candidacy: StickinessInline.vue's resultsThatNeedStickiness
//     (last-element rating, the favoriteTuning.js mixin's mostRecentRating —
//     NOT GetRating.js's date-max version; the prompt uses the mixin).
//   - tiebreak due-ness: Home.vue's shouldShowTieBreakModal (tournament
//     record counts even when quota-paused; else a fresh adjacent-tie scan).
//   - awards years: Home.vue's shouldShowAwardsModal eligibility core.
// A prompt the user disabled in-app (settings/*PromptState === 'disabled')
// publishes as empty — a push about a prompt you turned off is spam.

import { findTiedGroup, tiedContestantCount } from './tieBreakTournament.js';
import { yearsMeetingAwardsThreshold } from './personalAwards.js';
import { promptsPerDay, lastAwardsPromptAt, ONE_DAY_MS } from './promptQuota.js';

const ONE_WEEK_MS = 604800000;
// Same odd constant StickinessInline.vue uses (≈ half a Julian year).
const SIX_MONTHS_MS = 15778476000;

// How far ahead the digest bothers projecting stickiness boundaries. The
// Lambda sweeps daily and the app republishes on every open, so the horizon
// only has to outlast a realistic stretch of not opening the app.
const DUE_TIMES_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;
const DUE_TIMES_CAP = 60;

// The prompt's own reading of "the rating": last element, not date-max.
function lastRating (entry) {
  const ratings = entry?.ratings;
  return (ratings && ratings.length) ? ratings[ratings.length - 1] : null;
}

function entryTitle (entry) {
  return entry?.movie?.title || entry?.movie?.name || null;
}

function promptState (settings, key) {
  const value = settings?.[key];
  return (typeof value === 'string' && ['disabled', 'normal', 'forced'].includes(value)) ? value : 'normal';
}

/**
 * WHEN the on-screen prompt is next allowed to appear — the quota gate, as a
 * timestamp the server can compare against without knowing the rules.
 *
 * Bug (2026-08-28): "Cinema Roll gave me a push notification this morning
 * about some stickiness updates... but then when I clicked the notification
 * and arrived in the app, there's no stickiness prompt there."
 *
 * The digest reported what was due IN THE DATA; Home.vue additionally gates
 * every prompt behind a per-prompt daily quota (promptQuota.js — tiebreaks
 * were suppressed until 10:14 that morning, awards until 6pm). So the push
 * named chores the app then refused to show, and he arrived at an empty
 * screen. Publishing the gate alongside the count is what keeps the two
 * honest: a notification may only mention work the app will actually put in
 * front of you when you get there.
 *
 * `0` means no limit / always eligible. `null` means never (the user set the
 * allowance to zero), and callers treat that section as empty.
 */
function eligibleAt (lastAt, perDay) {
  if (perDay === null || perDay === undefined) return 0;
  if (!(perDay > 0)) return null;
  const last = Number(lastAt);
  if (!Number.isFinite(last) || last <= 0) return 0;
  return last + ONE_DAY_MS / perDay;
}

/**
 * Stickiness: how many films are waiting right now, which one the prompt
 * would lead with, and when the NEXT candidates mature.
 */
export function stickinessDigest (entries, settings, now = Date.now()) {
  const gate = eligibleAt(
    settings?.lastStickinessPromptAt,
    promptsPerDay(settings?.stickinessPromptsPerDay, null)
  );
  if (promptState(settings, 'stickinessPromptState') === 'disabled' || gate === null) {
    return { count: 0, nextTitle: null, dueTimes: [], eligibleAt: 0 };
  }

  const due = [];
  const dueTimes = [];

  (entries || []).forEach((entry) => {
    const rating = lastRating(entry);
    if (!rating) return;

    const ratedAt = new Date(rating.date || '1/1/2021').getTime();
    if (!Number.isFinite(ratedAt)) return;

    const needsWeek = !rating.userAddedStickiness;
    const needsSixMonth = !rating.userAddedSixMonthStickiness;
    const weekAt = ratedAt + ONE_WEEK_MS;
    const sixMonthAt = ratedAt + SIX_MONTHS_MS;

    if ((needsWeek && now > weekAt) || (needsSixMonth && now > sixMonthAt)) {
      due.push({ title: entryTitle(entry), ratedAt });
      return;
    }
    // Not due yet — publish the ONE boundary that will make it due, so the
    // server can count forward in time without knowing why. Deliberately the
    // earliest applicable boundary and no more: a film waiting on both its
    // week and its six-month pass is still a single entry in the prompt's
    // list, so emitting both would let the server count one film twice.
    const boundaries = [];
    if (needsWeek) boundaries.push(weekAt);
    if (needsSixMonth) boundaries.push(sixMonthAt);
    const next = Math.min(...boundaries);
    if (Number.isFinite(next) && next > now && next - now < DUE_TIMES_HORIZON_MS) dueTimes.push(next);
  });

  // Same order the prompt itself uses: most recently rated first.
  due.sort((a, b) => b.ratedAt - a.ratedAt);
  dueTimes.sort((a, b) => a - b);

  return {
    count: due.length,
    nextTitle: due.length ? due[0].title : null,
    dueTimes: dueTimes.slice(0, DUE_TIMES_CAP),
    eligibleAt: gate
  };
}

/**
 * Tiebreak: is there something to settle (a live tournament, or a fresh
 * adjacent tie), and between how many films.
 */
export function tiebreakDigest (entries, settings, getRating, now = Date.now()) {
  if (promptState(settings, 'tieBreakPromptState') === 'disabled') {
    return { due: false, count: 0, eligibleAt: 0, pinned: false };
  }

  // Home.vue's own arithmetic, mirrored exactly — including the `|| now`
  // fallback, which makes a brand-new account wait one interval for its
  // first tiebreak rather than being asked immediately.
  const gate = (Number(settings?.lastTweak) || now) + ONE_DAY_MS / (Number(settings?.tieBreakTweak) || 1);

  const tournament = settings?.tieBreakTournament || null;

  // Score each entry ONCE, then sort — getRating in a comparator is the
  // documented perf trap (CLAUDE.md).
  const scored = (entries || [])
    .map((entry) => ({ entry, score: getRating(entry)?.calculatedTotal }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);

  const tiedGroup = tournament ? [] : findTiedGroup(scored, (item) => item.score);
  const due = Boolean(tournament) || tiedGroup.length >= 2;

  return {
    due,
    count: due ? tiedContestantCount(tournament, tiedGroup) : 0,
    eligibleAt: gate,
    // A tournament already under way PINS the screen to the tiebreak prompt
    // (Home.vue's activeModalType: it is work the user is in the middle of,
    // and nothing may take the screen from it). So while one exists, no
    // notification may promise stickiness or awards — they cannot appear.
    pinned: Boolean(tournament)
  };
}

/**
 * Awards: every eligible year still wanting input — never started, started
 * but not completed, or completed before its newest movie arrived. Mirrors
 * Home.vue's shouldShowAwardsModal eligibility core (minus its load-order
 * guards, which are about render flashes, not eligibility).
 */
export function awardsYearsNeedingInput (entries, settings, now = Date.now()) {
  if (promptState(settings, 'awardsPromptState') === 'disabled') return [];
  // The quota can switch this prompt off entirely (allowance of 0).
  if (eligibleAt(lastAwardsPromptAt(settings, now), promptsPerDay(settings?.awardsPromptsPerDay, 1)) === null) return [];

  const eligibleYears = yearsMeetingAwardsThreshold(entries, settings);

  return eligibleYears.filter((year) => {
    const existing = settings?.personalAwards?.[year];
    if (!existing) return true;
    if (!existing.completed) return true;
    if (!existing.lastUpdated) return true;

    return (entries || []).some((entry) => {
      const releaseDate = entry?.movie?.release_date;
      if (!releaseDate) return false;
      if (new Date(releaseDate).getFullYear() !== year) return false;
      const movieDate = new Date(entry.ratings?.[0]?.date || releaseDate);
      return movieDate.getTime() > existing.lastUpdated;
    });
  });
}

/**
 * The full digest published to `{topKey}/push/digest`. Always a complete
 * object (empty sections stay present) so the Lambda never has to guess
 * whether an absent key means "nothing due" or "old app version".
 */
export function buildPushDigest ({ entries, settings, getRating, now = Date.now() }) {
  return {
    updatedAt: now,
    stickiness: stickinessDigest(entries, settings, now),
    tiebreak: tiebreakDigest(entries, settings, getRating, now),
    awards: {
      years: awardsYearsNeedingInput(entries, settings, now),
      eligibleAt: eligibleAt(
        lastAwardsPromptAt(settings, now),
        promptsPerDay(settings?.awardsPromptsPerDay, 1)
      ) ?? 0
    }
  };
}

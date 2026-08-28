import { describe, it, expect } from 'vitest';
import {
  buildPushDigest,
  stickinessDigest,
  tiebreakDigest,
  awardsYearsNeedingInput
} from '@/assets/javascript/pushDigest.js';

// The digest is what the push Lambda trusts VERBATIM — it never re-derives
// prompt logic. So these tests pin the digest to the same behaviour the
// on-screen prompts have, including the boundary arithmetic that lets the
// server count candidates FORWARD in time from a stale digest.

const NOW = new Date('2026-08-27T12:00:00Z').getTime();
const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 604800000;
const SIX_MONTHS = 15778476000;

const getRating = (entry) => ({ calculatedTotal: entry.__score });

const entry = (id, title, { score = 8, ratedAt, rating = {} } = {}) => ({
  __score: score,
  movie: { id, title, release_date: '2020-06-01', runtime: 120 },
  ratings: [{ date: ratedAt, ...rating }]
});

describe('stickinessDigest', () => {
  it('counts films past the one-week boundary without a stickiness rating', () => {
    const entries = [
      entry(1, 'Old, unrated', { ratedAt: NOW - 10 * ONE_DAY }),
      entry(2, 'Fresh, unrated', { ratedAt: NOW - 2 * ONE_DAY }),
      entry(3, 'Old, already rated', {
        ratedAt: NOW - 10 * ONE_DAY,
        rating: { userAddedStickiness: true, userAddedSixMonthStickiness: true }
      })
    ];
    const digest = stickinessDigest(entries, {}, NOW);
    expect(digest.count).toBe(1);
    expect(digest.nextTitle).toBe('Old, unrated');
  });

  it('a film with week-stickiness done still comes due at six months', () => {
    const entries = [entry(1, 'Sixer', {
      ratedAt: NOW - SIX_MONTHS - ONE_DAY,
      rating: { userAddedStickiness: true }
    })];
    expect(stickinessDigest(entries, {}, NOW).count).toBe(1);
  });

  it('publishes FUTURE due boundaries so the server can count forward in time', () => {
    const ratedAt = NOW - 5 * ONE_DAY; // due in 2 days
    const digest = stickinessDigest([entry(1, 'Soon', { ratedAt })], {}, NOW);
    expect(digest.count).toBe(0);
    expect(digest.dueTimes).toContain(ratedAt + ONE_WEEK);
    // The server-side count at (boundary + 1ms) must see it as due.
    const sendTime = ratedAt + ONE_WEEK + 1;
    const dueAtSend = digest.count + digest.dueTimes.filter((t) => t <= sendTime).length;
    expect(dueAtSend).toBe(1);
  });

  it('leads with the most recently rated due film, same as the prompt', () => {
    const entries = [
      entry(1, 'Older', { ratedAt: NOW - 30 * ONE_DAY }),
      entry(2, 'Newer', { ratedAt: NOW - 8 * ONE_DAY })
    ];
    expect(stickinessDigest(entries, {}, NOW).nextTitle).toBe('Newer');
  });

  it('uses the LAST rating element, not the newest by date (the mixin behaviour)', () => {
    // Last element already has stickiness — even though an earlier element
    // doesn't. The prompt only reads the last element, so nothing is due.
    const entries = [{
      __score: 8,
      movie: { id: 1, title: 'Rewatched' },
      ratings: [
        { date: NOW - 400 * ONE_DAY },
        { date: NOW - 10 * ONE_DAY, userAddedStickiness: true, userAddedSixMonthStickiness: true }
      ]
    }];
    expect(stickinessDigest(entries, {}, NOW).count).toBe(0);
  });

  it('goes silent when the user disabled the stickiness prompt', () => {
    const entries = [entry(1, 'Due', { ratedAt: NOW - 10 * ONE_DAY })];
    const digest = stickinessDigest(entries, { stickinessPromptState: 'disabled' }, NOW);
    expect(digest.count).toBe(0);
    expect(digest.dueTimes).toEqual([]);
  });
});

describe('tiebreakDigest', () => {
  it('reports a fresh adjacent tie with its group size', () => {
    const entries = [
      entry(1, 'A', { score: 9, ratedAt: NOW }),
      entry(2, 'B', { score: 8, ratedAt: NOW }),
      entry(3, 'C', { score: 8, ratedAt: NOW }),
      entry(4, 'D', { score: 8, ratedAt: NOW }),
      entry(5, 'E', { score: 7, ratedAt: NOW })
    ];
    const digest = tiebreakDigest(entries, {}, getRating);
    expect(digest.due).toBe(true);
    expect(digest.count).toBe(3);
  });

  it('an in-flight tournament is due regardless of current scores', () => {
    const entries = [
      entry(1, 'A', { score: 9, ratedAt: NOW }),
      entry(2, 'B', { score: 8, ratedAt: NOW })
    ];
    const settings = { tieBreakTournament: { contestantIds: [10, 11, 12, 13] } };
    const digest = tiebreakDigest(entries, settings, getRating);
    expect(digest.due).toBe(true);
    expect(digest.count).toBe(4); // frozen contestant list, not a fresh scan
  });

  it('no ties, no tournament — nothing due', () => {
    const entries = [
      entry(1, 'A', { score: 9, ratedAt: NOW }),
      entry(2, 'B', { score: 8, ratedAt: NOW })
    ];
    expect(tiebreakDigest(entries, {}, getRating)).toEqual({ due: false, count: 0 });
  });

  it('goes silent when the user disabled the tiebreak prompt', () => {
    const entries = [
      entry(1, 'A', { score: 8, ratedAt: NOW }),
      entry(2, 'B', { score: 8, ratedAt: NOW })
    ];
    const digest = tiebreakDigest(entries, { tieBreakPromptState: 'disabled' }, getRating);
    expect(digest.due).toBe(false);
  });
});

describe('awardsYearsNeedingInput', () => {
  const yearEntries = (year, count, ratedAt = NOW - 30 * ONE_DAY) => Array.from(
    { length: count },
    (_, i) => ({
      __score: 8,
      movie: { id: year * 100 + i, title: `Movie ${i}`, release_date: `${year}-06-01`, runtime: 120 },
      ratings: [{ date: ratedAt }]
    })
  );

  it('a year past the threshold with no awards yet needs input', () => {
    const entries = yearEntries(1997, 3);
    const settings = { awardsYearThreshold: 3 };
    expect(awardsYearsNeedingInput(entries, settings, NOW)).toEqual([1997]);
  });

  it('a completed year with no movies since is done', () => {
    const entries = yearEntries(1997, 3, NOW - 30 * ONE_DAY);
    const settings = {
      awardsYearThreshold: 3,
      personalAwards: { 1997: { completed: true, lastUpdated: NOW - ONE_DAY } }
    };
    expect(awardsYearsNeedingInput(entries, settings, NOW)).toEqual([]);
  });

  it('a completed year reopens when a newer movie lands in it', () => {
    const entries = [
      ...yearEntries(1997, 3, NOW - 30 * ONE_DAY),
      ...yearEntries(1997, 1, NOW - ONE_DAY) // rated after completion
    ];
    const settings = {
      awardsYearThreshold: 3,
      personalAwards: { 1997: { completed: true, lastUpdated: NOW - 10 * ONE_DAY } }
    };
    expect(awardsYearsNeedingInput(entries, settings, NOW)).toEqual([1997]);
  });

  it('a started-but-not-completed year still needs input', () => {
    const entries = yearEntries(1997, 3);
    const settings = {
      awardsYearThreshold: 3,
      personalAwards: { 1997: { completed: false } }
    };
    expect(awardsYearsNeedingInput(entries, settings, NOW)).toEqual([1997]);
  });

  it('goes silent when the user disabled the awards prompt', () => {
    const entries = yearEntries(1997, 3);
    const settings = { awardsYearThreshold: 3, awardsPromptState: 'disabled' };
    expect(awardsYearsNeedingInput(entries, settings, NOW)).toEqual([]);
  });
});

describe('buildPushDigest', () => {
  it('always publishes a complete object, empty sections included', () => {
    const digest = buildPushDigest({ entries: [], settings: {}, getRating, now: NOW });
    expect(digest).toEqual({
      updatedAt: NOW,
      stickiness: { count: 0, nextTitle: null, dueTimes: [] },
      tiebreak: { due: false, count: 0 },
      awards: { years: [] }
    });
  });
});

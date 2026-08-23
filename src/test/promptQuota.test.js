import { describe, it, expect } from 'vitest';
import {
  ONE_DAY_MS,
  promptsPerDay,
  dueForPrompt,
  lastAwardsPromptAt
} from '@/assets/javascript/promptQuota.js';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-08-22T18:00:00').getTime();

describe('promptsPerDay', () => {
  it('reads a number through', () => {
    expect(promptsPerDay(3, 1)).toBe(3);
    expect(promptsPerDay('3', 1)).toBe(3);
  });

  // Blank is a real answer, not a missing one: for stickiness it means "no
  // limit", which is how stickiness has always behaved.
  it('falls back for a blank or unparseable value, not to zero', () => {
    expect(promptsPerDay('', null)).toBeNull();
    expect(promptsPerDay(undefined, null)).toBeNull();
    expect(promptsPerDay(null, 1)).toBe(1);
    expect(promptsPerDay('what', 1)).toBe(1);
  });

  it('keeps an explicit zero, which is "never"', () => {
    expect(promptsPerDay(0, 1)).toBe(0);
  });

  it('never goes negative', () => {
    expect(promptsPerDay(-4, 1)).toBe(0);
  });
});

describe('dueForPrompt', () => {
  it('no limit means always due', () => {
    expect(dueForPrompt({ lastAt: NOW - 1000, perDay: null, now: NOW })).toBe(true);
  });

  it('zero a day means never due, however long it has been', () => {
    expect(dueForPrompt({ lastAt: NOW - 400 * ONE_DAY_MS, perDay: 0, now: NOW })).toBe(false);
  });

  it('one a day spaces prompts a day apart', () => {
    expect(dueForPrompt({ lastAt: NOW - 23 * HOUR, perDay: 1, now: NOW })).toBe(false);
    expect(dueForPrompt({ lastAt: NOW - 25 * HOUR, perDay: 1, now: NOW })).toBe(true);
  });

  it('three a day spaces them eight hours apart', () => {
    expect(dueForPrompt({ lastAt: NOW - 7 * HOUR, perDay: 3, now: NOW })).toBe(false);
    expect(dueForPrompt({ lastAt: NOW - 9 * HOUR, perDay: 3, now: NOW })).toBe(true);
  });

  // The tiebreak path read `lastTweak || Date.now()`, which made a brand-new
  // account wait a day for its first prompt. Never prompted = due now.
  it('treats "never prompted" as due', () => {
    expect(dueForPrompt({ lastAt: null, perDay: 1, now: NOW })).toBe(true);
    expect(dueForPrompt({ lastAt: 0, perDay: 1, now: NOW })).toBe(true);
    expect(dueForPrompt({ lastAt: undefined, perDay: 1, now: NOW })).toBe(true);
  });
});

describe('lastAwardsPromptAt', () => {
  it('prefers a real timestamp when one has been written', () => {
    const stamp = NOW - 3 * HOUR;
    expect(lastAwardsPromptAt({ lastAwardsPromptAt: stamp }, NOW)).toBe(stamp);
  });

  // Every account predating the timestamp carries only this date string, and
  // the old gate was the string equality `lastAwardCompletionDate === today`.
  it('reads a legacy completion date as the start of that day', () => {
    const settings = { lastAwardCompletionDate: 'Sat Aug 22 2026' };
    const read = lastAwardsPromptAt(settings, NOW);

    expect(new Date(read).getHours()).toBe(0);
    // Which reproduces the old behaviour exactly at one a day: completed
    // today, so nothing more today...
    expect(dueForPrompt({ lastAt: read, perDay: 1, now: NOW })).toBe(false);
    // ...and available again tomorrow.
    const tomorrow = NOW + ONE_DAY_MS;
    expect(dueForPrompt({ lastAt: read, perDay: 1, now: tomorrow })).toBe(true);
  });

  it('is null when nothing has ever been recorded', () => {
    expect(lastAwardsPromptAt({}, NOW)).toBeNull();
    expect(lastAwardsPromptAt(null, NOW)).toBeNull();
    expect(lastAwardsPromptAt({ lastAwardCompletionDate: 'not a date' }, NOW)).toBeNull();
  });

  it('never reports the future, whatever the stored data says', () => {
    const settings = { lastAwardCompletionDate: 'Fri Aug 22 2036' };
    expect(lastAwardsPromptAt(settings, NOW)).toBe(NOW);
  });
});

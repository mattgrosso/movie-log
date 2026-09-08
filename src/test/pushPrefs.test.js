import { describe, it, expect } from 'vitest'
import { PUSH_PREF_DEFAULTS, pushPrefsWithDefaults, gameReminderOn } from '@/assets/javascript/pushPrefs.js'

describe('push preference defaults', () => {
  // The score toggle (2026-09-06) defaults ON: an account that has never seen
  // the switch keeps the notification it already had.
  it('includes the friend\'s score in a friend-log push unless turned off', () => {
    expect(PUSH_PREF_DEFAULTS.friendLogScores).toBe(true)
    expect(pushPrefsWithDefaults(null).friendLogScores).toBe(true)
    expect(pushPrefsWithDefaults({ friendLogScores: false }).friendLogScores).toBe(false)
  })

  // 2026-09-07: "an optional notification, one that defaults to off, but you
  // can turn it on, that reminds you to play the games every day".
  it('the games reminder is OFF until someone turns it on', () => {
    expect(PUSH_PREF_DEFAULTS.games).toBe(false)
    expect(pushPrefsWithDefaults(null).games).toBe(false)
    expect(pushPrefsWithDefaults({ games: true }).games).toBe(true)
    expect(pushPrefsWithDefaults(null).gamesHour).toBe(20)
  })

  // "maybe even you can choose per game" — absent means on, so a game added
  // later joins the reminder without anyone touching a switch.
  it('every game is in the reminder unless explicitly muted', () => {
    expect(gameReminderOn(pushPrefsWithDefaults(null), 'wordle')).toBe(true)
    expect(gameReminderOn({ gamePicks: { wordle: false } }, 'wordle')).toBe(false)
    expect(gameReminderOn({ gamePicks: { wordle: false } }, 'trivia')).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { PUSH_PREF_DEFAULTS, pushPrefsWithDefaults } from '@/assets/javascript/pushPrefs.js'

describe('push preference defaults', () => {
  // The score toggle (2026-09-06) defaults ON: an account that has never seen
  // the switch keeps the notification it already had.
  it('includes the friend\'s score in a friend-log push unless turned off', () => {
    expect(PUSH_PREF_DEFAULTS.friendLogScores).toBe(true)
    expect(pushPrefsWithDefaults(null).friendLogScores).toBe(true)
    expect(pushPrefsWithDefaults({ friendLogScores: false }).friendLogScores).toBe(false)
  })
})

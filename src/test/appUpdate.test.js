import { describe, it, expect } from 'vitest'
import { isSafeMomentForReload, shouldAutoAttempt } from '@/utils/appUpdate.js'

// Auto-update ships reloads only at provably quiet moments (bug report:
// "the user shouldn't have to take an action" — but the July lesson stands:
// never yank the page out from under the user).

describe('isSafeMomentForReload', () => {
  const classList = (...names) => ({ contains: (n) => names.includes(n) })

  it('is safe on an ordinary browse screen', () => {
    expect(isSafeMomentForReload({ activeElement: document.body, bodyClassList: classList(), routePath: '/' })).toBe(true)
    expect(isSafeMomentForReload({ activeElement: null, bodyClassList: classList(), routePath: '/awards' })).toBe(true)
  })

  it('never while a text input is focused (the user is typing)', () => {
    const input = document.createElement('input')
    expect(isSafeMomentForReload({ activeElement: input, bodyClassList: classList(), routePath: '/' })).toBe(false)
    const textarea = document.createElement('textarea')
    expect(isSafeMomentForReload({ activeElement: textarea, bodyClassList: classList(), routePath: '/' })).toBe(false)
  })

  it('never while a modal has the body scroll-locked', () => {
    expect(isSafeMomentForReload({ activeElement: document.body, bodyClassList: classList('no-scroll'), routePath: '/' })).toBe(false)
  })

  it('never mid-game (an in-memory round would be lost)', () => {
    expect(isSafeMomentForReload({ activeElement: document.body, bodyClassList: classList(), routePath: '/games/poster-zoom' })).toBe(false)
  })
})

describe('shouldAutoAttempt', () => {
  const memoryStorage = () => {
    const map = new Map()
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) }
  }

  it('attempts once per target bundle, then defers to the banner', () => {
    const storage = memoryStorage()
    expect(shouldAutoAttempt('app.abc.js', storage)).toBe(true)
    expect(shouldAutoAttempt('app.abc.js', storage)).toBe(false) // no reload loop
    expect(shouldAutoAttempt('app.def.js', storage)).toBe(true) // a NEWER deploy gets its own attempt
  })

  it('still attempts when storage is unavailable', () => {
    const broken = { getItem () { throw new Error('denied') }, setItem () { throw new Error('denied') } }
    expect(shouldAutoAttempt('app.abc.js', broken)).toBe(true)
  })
})

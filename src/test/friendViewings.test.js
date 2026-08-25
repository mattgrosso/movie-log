import { describe, it, expect } from 'vitest'
import {
  friendViewing,
  friendViewingsFor,
  clubAverage,
  sharesRatings,
  SEEN,
  NOT_SEEN,
  UNKNOWN
} from '@/assets/javascript/friendViewings.js'

// Feature request, 2026-08-25: "It would be cool if I could see which of my
// friends had seen a movie on its detail page."
//
// Most of these tests are about the third answer. Sharing ratings is its own
// opt-in tier, so a friend can be someone the app CANNOT speak for — and
// saying "hasn't seen it" about them would be the app inventing a fact from a
// privacy setting.

const friend = (name, ratings, extra = {}) => ({
  key: name.toLowerCase(),
  name,
  profile: ratings === null ? null : { name, ratings },
  ...extra
})

describe('friendViewing', () => {
  it('finds a friend who has seen the film, with their score', () => {
    const result = friendViewing(friend('Sarah', { 42: { r: 8.5, at: 1000, t: 'Heat' } }), 42)
    expect(result.status).toBe(SEEN)
    expect(result.score).toBe(8.5)
    expect(result.at).toBe(1000)
    expect(result.name).toBe('Sarah')
  })

  it('matches a numeric movie id against the string keys Firebase returns', () => {
    // Published maps come back from Firebase as objects, so every key is a
    // string; a movie's id is a number. Comparing them directly finds nobody.
    const sarah = friend('Sarah', { '42': { r: 8.5 } })
    expect(friendViewing(sarah, 42).status).toBe(SEEN)
    expect(friendViewing(sarah, '42').status).toBe(SEEN)
  })

  it('says NOT SEEN when the friend shares ratings and this one is absent', () => {
    expect(friendViewing(friend('Sarah', { 99: { r: 7 } }), 42).status).toBe(NOT_SEEN)
  })

  it('treats an empty ratings map as a real answer, not a missing one', () => {
    // Someone who shares ratings and has rated nothing genuinely has not seen
    // this film. Only a MISSING map is unknowable.
    expect(friendViewing(friend('Sarah', {}), 42).status).toBe(NOT_SEEN)
  })

  it('says UNKNOWN for a shelf-only sharer rather than accusing them of missing it', () => {
    // The whole point. Sharing ratings is its own opt-in; a profile can carry
    // topShelf and recent with no ratings map at all.
    const shelfOnly = { key: 'sarah', name: 'Sarah', profile: { name: 'Sarah', topShelf: [], recent: [] } }
    expect(friendViewing(shelfOnly, 42).status).toBe(UNKNOWN)
  })

  it('says UNKNOWN for a friend who has not published a profile yet', () => {
    expect(friendViewing(friend('Sarah', null), 42).status).toBe(UNKNOWN)
  })

  it('says UNKNOWN when there is no movie id to look up', () => {
    expect(friendViewing(friend('Sarah', { 42: { r: 8 } }), null).status).toBe(UNKNOWN)
    expect(friendViewing(friend('Sarah', { 42: { r: 8 } }), undefined).status).toBe(UNKNOWN)
  })

  it('does not count an entry with no usable score as seen', () => {
    expect(friendViewing(friend('Sarah', { 42: { t: 'Heat' } }), 42).status).toBe(NOT_SEEN)
    expect(friendViewing(friend('Sarah', { 42: { r: null } }), 42).status).toBe(NOT_SEEN)
  })

  it('carries where and when they saw it, when that tier is shared too', () => {
    const withViewings = friend('Sarah', {
      42: { r: 8.5, v: [{ at: 100, m: 'Theatre' }, { at: 900, m: 'Blu-ray' }] }
    })
    const result = friendViewing(withViewings, 42)
    expect(result.medium).toBe('Blu-ray')       // most recent, not first
    expect(result.viewingCount).toBe(2)
  })

  it('survives a friend who shares ratings but not viewings', () => {
    const result = friendViewing(friend('Sarah', { 42: { r: 8.5, at: 1000 } }), 42)
    expect(result.medium).toBeNull()
    expect(result.at).toBe(1000)
  })

  it('falls back to the viewing list when the map carries no timestamp', () => {
    const result = friendViewing(friend('Sarah', { 42: { r: 8.5, v: [{ at: 555 }] } }), 42)
    expect(result.at).toBe(555)
  })

  it('names an unnamed friend rather than rendering undefined at anyone', () => {
    expect(friendViewing({ key: 'x', profile: null }, 42).name).toBe('A friend')
  })
})

describe('friendViewingsFor', () => {
  const club = [
    friend('Sarah', { 42: { r: 8.5 } }),
    friend('Ben', { 42: { r: 9.2 } }),
    friend('Chris', { 99: { r: 5 } }),
    friend('Dana', null),
    { key: 'evan', name: 'Evan', profile: { name: 'Evan', topShelf: [] } }
  ]

  it('splits the club three ways', () => {
    const { seen, notSeen, unknown } = friendViewingsFor(club, 42)
    expect(seen.map((f) => f.name)).toEqual(['Ben', 'Sarah'])
    expect(notSeen.map((f) => f.name)).toEqual(['Chris'])
    expect(unknown.map((f) => f.name)).toEqual(['Dana', 'Evan'])
  })

  it('puts the highest score first, because that is the interesting question', () => {
    const { seen } = friendViewingsFor(club, 42)
    expect(seen[0].name).toBe('Ben')
    expect(seen[0].score).toBe(9.2)
  })

  it('breaks ties by name so the order does not wobble between renders', () => {
    const tied = [friend('Zoe', { 42: { r: 8 } }), friend('Adam', { 42: { r: 8 } })]
    expect(friendViewingsFor(tied, 42).seen.map((f) => f.name)).toEqual(['Adam', 'Zoe'])
  })

  it('copes with no club at all', () => {
    expect(friendViewingsFor([], 42)).toEqual({ seen: [], notSeen: [], unknown: [] })
    expect(friendViewingsFor(null, 42)).toEqual({ seen: [], notSeen: [], unknown: [] })
  })
})

describe('clubAverage', () => {
  it('averages the scores of everyone who saw it', () => {
    expect(clubAverage([{ score: 8 }, { score: 9 }])).toBe(8.5)
  })

  it('is null when nobody has seen it, never zero', () => {
    // A screen reading "club average 0.00" for a film nobody watched would be
    // worse than showing nothing.
    expect(clubAverage([])).toBeNull()
    expect(clubAverage(null)).toBeNull()
  })

  it('ignores entries with no usable score', () => {
    expect(clubAverage([{ score: 8 }, { score: undefined }])).toBe(8)
  })
})

describe('sharesRatings', () => {
  it('is true only when a ratings map is actually published', () => {
    expect(sharesRatings({ ratings: {} })).toBe(true)
    expect(sharesRatings({ ratings: { 1: { r: 5 } } })).toBe(true)
    expect(sharesRatings({ topShelf: [] })).toBe(false)
    expect(sharesRatings({ ratings: null })).toBe(false)
    expect(sharesRatings(null)).toBe(false)
  })
})

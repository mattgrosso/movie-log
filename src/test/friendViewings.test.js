import { describe, it, expect } from 'vitest'
import { friendsWhoRated } from '@/assets/javascript/friendViewings.js'

// "I just need little pills that show the name and rating for any friends who
// have seen and rated the movie" (2026-08-25).

const rated = (name, score) => ({
  key: name.toLowerCase(),
  name,
  profile: { name, ratings: { 42: { r: score } } }
})

describe('friendsWhoRated', () => {
  it('returns the friends with a published rating for this film', () => {
    expect(friendsWhoRated([rated('Sarah', 8.5), rated('Ben', 9.2)], 42).map((f) => f.name))
      .toEqual(['Ben', 'Sarah'])
  })

  it('puts the highest score first', () => {
    const result = friendsWhoRated([rated('Sarah', 8.5), rated('Ben', 9.2)], 42)
    expect(result[0]).toMatchObject({ name: 'Ben', score: 9.2 })
  })

  it('breaks ties by name so the order does not wobble between renders', () => {
    expect(friendsWhoRated([rated('Zoe', 8), rated('Adam', 8)], 42).map((f) => f.name))
      .toEqual(['Adam', 'Zoe'])
  })

  it('matches a numeric movie id against the string keys Firebase returns', () => {
    // Published maps come back as objects, so every key is a string; a
    // movie's id is a number. Comparing them directly finds nobody.
    expect(friendsWhoRated([rated('Ben', 9)], 42)).toHaveLength(1)
    expect(friendsWhoRated([rated('Ben', 9)], '42')).toHaveLength(1)
  })

  it('includes external friends, whose feeds translate to the same shape', () => {
    // Brian's club feed is translated by interchange.js into exactly this
    // structure, so nothing here needs to know where a friend came from.
    const external = { key: 'ext-msx4vqxj', name: 'Brian Goegan', external: true, profile: { ratings: { 42: { r: 6.78 } } } }
    expect(friendsWhoRated([external], 42)[0]).toMatchObject({ name: 'Brian Goegan', score: 6.78 })
  })

  it('leaves out friends who have not rated this one', () => {
    const chris = { key: 'chris', name: 'Chris', profile: { ratings: { 99: { r: 5 } } } }
    expect(friendsWhoRated([chris], 42)).toEqual([])
  })

  it('leaves out friends who share no ratings at all', () => {
    // Sharing ratings is its own opt-in tier: a shelf-only sharer publishes
    // topShelf and recent with no ratings map. They simply don't appear --
    // the screen makes no claim about anyone it leaves out.
    const shelfOnly = { key: 'evan', name: 'Evan', profile: { name: 'Evan', topShelf: [] } }
    const unpublished = { key: 'dana', name: 'Dana', profile: null }
    expect(friendsWhoRated([shelfOnly, unpublished], 42)).toEqual([])
  })

  it('ignores an entry with no usable score', () => {
    const noScore = { key: 'x', name: 'X', profile: { ratings: { 42: { t: 'Heat' } } } }
    const nullScore = { key: 'y', name: 'Y', profile: { ratings: { 42: { r: null } } } }
    expect(friendsWhoRated([noScore, nullScore], 42)).toEqual([])
  })

  it('says nothing until a movie id arrives', () => {
    // MovieDetail loads asynchronously and `movie` is null on first render.
    expect(friendsWhoRated([rated('Ben', 9)], null)).toEqual([])
    expect(friendsWhoRated([rated('Ben', 9)], '')).toEqual([])
  })

  it('copes with no club at all', () => {
    expect(friendsWhoRated([], 42)).toEqual([])
    expect(friendsWhoRated(null, 42)).toEqual([])
  })
})

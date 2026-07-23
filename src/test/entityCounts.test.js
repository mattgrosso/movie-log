import { describe, it, expect } from 'vitest'
import { countDirectors, countCastCrew, countGenres, countKeywords, countStudios } from '@/assets/javascript/entityCounts.js'

// Direct unit tests of the pure counting module extracted from the
// byte-for-byte-duplicated logic that used to live separately in Home.vue
// and MovieDetail.vue (a bug report questioning MovieDetail's badge
// accuracy surfaced two real bugs in that duplicated logic — see CLAUDE.md).

function entry (dbKey, overrides = {}) {
  return {
    dbKey,
    movie: {
      runtime: 100,
      cast: [],
      crew: [],
      genres: [],
      flatKeywords: [],
      production_companies: [],
      ...overrides
    }
  }
}

describe('countDirectors', () => {
  it('credits every co-director on a movie, not just whichever TMDB lists first', () => {
    const entries = [
      entry('a', { crew: [
        { name: 'Daniel Kwan', job: 'Director' },
        { name: 'Daniel Scheinert', job: 'Director' }
      ] })
    ]
    const counts = countDirectors(entries, true)
    expect(counts['Daniel Kwan']).toBe(1)
    expect(counts['Daniel Scheinert']).toBe(1)
  })

  it('counts across multiple movies', () => {
    const entries = [
      entry('a', { crew: [{ name: 'Denis Villeneuve', job: 'Director' }] }),
      entry('b', { crew: [{ name: 'Denis Villeneuve', job: 'Director' }] }),
      entry('c', { crew: [{ name: 'Greta Gerwig', job: 'Director' }] })
    ]
    const counts = countDirectors(entries, true)
    expect(counts['Denis Villeneuve']).toBe(2)
    expect(counts['Greta Gerwig']).toBe(1)
  })

  it('ignores non-director crew entries', () => {
    const entries = [entry('a', { crew: [{ name: 'Someone', job: 'Editor' }] })]
    expect(countDirectors(entries, true)).toEqual({})
  })
})

describe('countCastCrew', () => {
  it('counts a cast member billed past position 10', () => {
    const bigCast = Array.from({ length: 15 }, (_, i) => ({ name: `Actor ${i}` }))
    const entries = [entry('a', { cast: bigCast })]
    const counts = countCastCrew(entries, true)
    expect(counts['Actor 14']).toBe(1)
  })

  it('counts a composer/editor/cinematographer regardless of their position in the crew array', () => {
    const paddingCrew = Array.from({ length: 15 }, (_, i) => ({ name: `Grip ${i}`, job: 'Grip' }))
    const entries = [entry('a', { crew: [
      ...paddingCrew,
      { name: 'Hans Zimmer', job: 'Original Music Composer' },
      { name: 'Thelma Schoonmaker', job: 'Editor' },
      { name: 'Roger Deakins', job: 'Director of Photography' },
      { name: 'Kevin Feige', job: 'Producer' }
    ] })]
    const counts = countCastCrew(entries, true)
    expect(counts['Hans Zimmer']).toBe(1)
    expect(counts['Thelma Schoonmaker']).toBe(1)
    expect(counts['Roger Deakins']).toBe(1)
    expect(counts['Kevin Feige']).toBe(1)
  })

  it('does not count background crew whose job is never rendered as a badge anywhere', () => {
    const entries = [entry('a', { crew: [{ name: 'Some Grip', job: 'Grip' }] })]
    expect(countCastCrew(entries, true)).toEqual({})
  })

  it('does not double count a person credited as both cast and crew on the same movie', () => {
    const entries = [entry('a', {
      cast: [{ name: 'Greta Gerwig' }],
      crew: [{ name: 'Greta Gerwig', job: 'Writer' }]
    })]
    expect(countCastCrew(entries, true)['Greta Gerwig']).toBe(1)
  })

  it('excludes the director from the shared cast/crew bucket (director has its own map)', () => {
    const entries = [entry('a', { crew: [{ name: 'Denis Villeneuve', job: 'Director' }] })]
    expect(countCastCrew(entries, true)).toEqual({})
  })
})

describe('countGenres', () => {
  it('counts distinct movies per genre', () => {
    const entries = [
      entry('a', { genres: [{ name: 'Drama' }, { name: 'Romance' }] }),
      entry('b', { genres: [{ name: 'Drama' }] })
    ]
    const counts = countGenres(entries, true)
    expect(counts.Drama).toBe(2)
    expect(counts.Romance).toBe(1)
  })
})

describe('countKeywords', () => {
  it('counts distinct movies per keyword', () => {
    const entries = [
      entry('a', { flatKeywords: ['heist', 'ensemble cast'] }),
      entry('b', { flatKeywords: ['heist'] })
    ]
    const counts = countKeywords(entries, true)
    expect(counts.heist).toBe(2)
    expect(counts['ensemble cast']).toBe(1)
  })
})

describe('countStudios', () => {
  it('counts distinct movies per production company', () => {
    const entries = [
      entry('a', { production_companies: [{ name: 'A24' }] }),
      entry('b', { production_companies: [{ name: 'A24' }] })
    ]
    expect(countStudios(entries, true).A24).toBe(2)
  })
})

describe('shorts exclusion', () => {
  const shortEntries = [
    entry('a', { runtime: 30, genres: [{ name: 'Drama' }], crew: [{ name: 'Someone', job: 'Director' }] }),
    entry('b', { runtime: 100, genres: [{ name: 'Drama' }], crew: [{ name: 'Someone Else', job: 'Director' }] })
  ]

  it('excludes short films (<=40min) from every count when includeShorts is false — matching what the filtered results grid actually shows', () => {
    expect(countGenres(shortEntries, false).Drama).toBe(1)
    expect(countDirectors(shortEntries, false)).toEqual({ 'Someone Else': 1 })
  })

  it('includes short films when includeShorts is true', () => {
    expect(countGenres(shortEntries, true).Drama).toBe(2)
  })
})

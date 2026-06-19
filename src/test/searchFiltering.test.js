import { describe, it, expect } from 'vitest'
import {
  buildSearchFields,
  getListOfYearsFromRange,
  applyFilter,
  getSortValue,
  sortResultsFast,
  sortResults
} from '@/assets/javascript/searchFiltering.js'

// Direct unit tests of the pure search/filter/sort module — no component mount.
// (Home.vue's thin wrappers are still exercised by ChipFiltering / QuickLinks /
// SortResultsFast, which guard that the wrappers feed these the right state.)

const movie = {
  title: 'Amélie',
  release_date: '2001-04-25',
  genres: [{ name: 'Comedy' }, { name: 'Romance' }],
  cast: [{ name: 'Audrey Tautou' }, { name: 'Mathieu Kassovitz' }],
  crew: [
    { name: 'Jean-Pierre Jeunet', job: 'Director' },
    { name: 'Guillaume Laurant', job: 'Writer' },
    { name: 'Claudie Ossard', job: 'Executive Producer' }
  ],
  production_companies: [{ name: 'UGC' }],
  flatKeywords: ['Paris', 'whimsical']
}
const result = { movie, ratings: [{ tags: [{ title: 'cozy' }] }] }

describe('buildSearchFields', () => {
  it('lowercases title/keywords/genres/cast/crew/companies and NFD-normalizes title', () => {
    const s = buildSearchFields(movie)
    expect(s.title).toBe('amélie')
    expect(s.titleNormalized).toBe('amelie') // accents stripped
    expect(s.keywords).toEqual(['paris', 'whimsical'])
    expect(s.genres).toEqual(['comedy', 'romance'])
    expect(s.cast).toContain('audrey tautou')
    expect(s.crew[0]).toEqual({ name: 'jean-pierre jeunet', job: 'Director', jobLower: 'director' })
    expect(s.companies).toEqual(['ugc'])
  })

  it('is null-safe for missing fields', () => {
    const s = buildSearchFields({})
    expect(s.title).toBe('')
    expect(s.cast).toEqual([])
    expect(s.crew).toEqual([])
  })
})

describe('getListOfYearsFromRange', () => {
  it('returns inclusive year strings', () => {
    expect(getListOfYearsFromRange({ startYear: 1999, endYear: 2001 })).toEqual(['1999', '2000', '2001'])
  })
  it('returns [] for invalid input', () => {
    expect(getListOfYearsFromRange(null)).toEqual([])
    expect(getListOfYearsFromRange({ startYear: 2000 })).toEqual([])
  })
})

describe('applyFilter', () => {
  const cases = [
    ['general', 'amelie', true],        // NFD title match
    ['general', 'whimsical', true],     // keyword
    ['general', 'tautou', true],        // cast substring
    ['general', 'nope', false],
    ['person', 'tautou', true],         // last-name
    ['person', 'audrey tautou', true],  // full name
    ['year', '2001', true],
    ['year', '1999', false],
    ['genre', 'Comedy', true],          // case-sensitive exact
    ['genre', 'comedy', false],
    ['company', 'UGC', true],
    ['keyword', 'PARIS', true],         // case-insensitive
    ['tag', 'cozy', true],
    ['tag', 'noir', false],
    ['title', 'amé', true],
    ['director', 'jeunet', true],
    ['director', 'laurant', false],     // not the Director
    ['producer', 'ossard', true],       // matches "Executive Producer"
    ['cast', 'kassovitz', true]
  ]
  it.each(cases)('%s "%s" → %s', (type, value, expected) => {
    expect(applyFilter(result, { type, value })).toBe(expected)
  })

  it('yearRange matches via getListOfYearsFromRange', () => {
    expect(applyFilter(result, { type: 'yearRange', value: { startYear: 2000, endYear: 2002 } })).toBe(true)
    expect(applyFilter(result, { type: 'yearRange', value: { startYear: 1990, endYear: 1999 } })).toBe(false)
  })

  it('uses a precomputed _search when present (and it overrides the movie fields)', () => {
    const decorated = { ...result, _search: buildSearchFields({ ...movie, title: 'Different' }) }
    expect(applyFilter(decorated, { type: 'title', value: 'different' })).toBe(true)
    expect(applyFilter(decorated, { type: 'title', value: 'amelie' })).toBe(false)
  })
})

// --- sorting ---------------------------------------------------------------

// Deterministic fake rating accessor keyed off a per-item rating object.
const getRating = (item) => item.rating

function makeItems() {
  return [
    { movie: { title: 'B', release_date: '2010-01-01' }, ratings: [{}], rating: { calculatedTotal: 7, date: '2', love: 5 } },
    { movie: { title: 'A', release_date: '2020-01-01' }, ratings: [{}, {}], rating: { calculatedTotal: 9, date: '3', love: 5 } },
    { movie: { title: 'C', release_date: '2000-01-01' }, ratings: [{}], rating: { calculatedTotal: 7, date: '1', love: 8 } },
    { movie: { title: 'D', release_date: '2015-01-01' }, ratings: [{}, {}, {}], rating: { calculatedTotal: 9, date: '4', love: 2 } }
  ]
}

describe('getSortValue', () => {
  it('returns the right key per sort type', () => {
    const item = makeItems()[0]
    expect(getSortValue(item, 'rating', getRating)).toBe(7)
    expect(getSortValue(item, 'title', getRating)).toBe('B')
    expect(getSortValue(item, 'views', getRating)).toBe(1)
    expect(getSortValue(item, 'release', getRating)).toEqual(new Date('2010-01-01'))
  })
})

describe('sortResultsFast matches sortResults (the oracle) exactly', () => {
  const keys = ['rating', 'release', 'title', 'watched', 'views', 'love']
  const orders = ['bestOrNewestOnTop', 'worstOrOldestOnTop']
  for (const sortValue of keys) {
    for (const sortOrder of orders) {
      it(`${sortValue} / ${sortOrder}`, () => {
        const opts = { sortValue, sortOrder, getRating }
        const fast = sortResultsFast(makeItems(), opts).map(i => i.movie.title)
        const oracle = [...makeItems()].sort((a, b) => sortResults(a, b, opts)).map(i => i.movie.title)
        expect(fast).toEqual(oracle)
      })
    }
  }

  it('does not mutate the input array', () => {
    const input = makeItems()
    const snapshot = input.map(i => i.movie.title)
    sortResultsFast(input, { sortValue: 'rating', sortOrder: 'bestOrNewestOnTop', getRating })
    expect(input.map(i => i.movie.title)).toEqual(snapshot)
  })
})

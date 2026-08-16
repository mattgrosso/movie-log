import { describe, it, expect } from 'vitest'
import {
  buildSearchFields,
  getListOfYearsFromRange,
  applyFilter,
  getSortValue,
  sortResultsFast,
  sortResults,
  countDidYouMeanSuggestionsThatFit
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

  // Matt, 2026-08-16: typed "Adam’s rib" on an iPhone (which substitutes a
  // curly apostrophe) and got nothing, on a library that has Adam's Rib.
  it("folds typographic punctuation so a phone's curly apostrophe matches", () => {
    const adamsRib = { movie: { title: "Adam's Rib" } }

    expect(applyFilter(adamsRib, { type: 'general', value: 'Adam’s rib' })).toBe(true)
    expect(applyFilter(adamsRib, { type: 'title', value: 'Adam’s' })).toBe(true)
    // And the other direction: a stored curly apostrophe, a typed straight one.
    expect(applyFilter({ movie: { title: 'Adam’s Rib' } }, { type: 'general', value: "adam's rib" })).toBe(true)
  })

  it('folds curly punctuation in names and dashes too', () => {
    const entry = { movie: { cast: [{ name: "Peter O'Toole" }], title: 'Spider-Man' } }

    expect(applyFilter(entry, { type: 'cast', value: 'O’Toole' })).toBe(true)
    expect(applyFilter(entry, { type: 'title', value: 'Spider—Man' })).toBe(true)
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
    ['general', 'amelie', true], // NFD title match
    ['general', 'whimsical', true], // keyword
    ['general', 'tautou', true], // cast substring
    ['general', 'nope', false],
    ['person', 'tautou', true], // last-name
    ['person', 'audrey tautou', true], // full name
    ['year', '2001', true],
    ['year', '1999', false],
    ['genre', 'Comedy', true], // case-sensitive exact
    ['genre', 'comedy', false],
    ['company', 'UGC', true],
    ['keyword', 'PARIS', true], // case-insensitive
    ['tag', 'cozy', true],
    ['tag', 'noir', false],
    ['title', 'amé', true],
    ['director', 'jeunet', true],
    ['director', 'laurant', false], // not the Director
    ['producer', 'ossard', true], // matches "Executive Producer"
    ['cast', 'kassovitz', true]
  ]
  it.each(cases)('%s "%s" → %s', (type, value, expected) => {
    expect(applyFilter(result, { type, value })).toBe(expected)
  })

  it('yearRange matches via getListOfYearsFromRange', () => {
    expect(applyFilter(result, { type: 'yearRange', value: { startYear: 2000, endYear: 2002 } })).toBe(true)
    expect(applyFilter(result, { type: 'yearRange', value: { startYear: 1990, endYear: 1999 } })).toBe(false)
  })

  it('year / yearRange do not throw on an entry missing release_date', () => {
    const noDate = { movie: { ...movie, release_date: undefined } }
    expect(applyFilter(noDate, { type: 'year', value: '2001' })).toBe(false)
    expect(applyFilter(noDate, { type: 'yearRange', value: { startYear: 2000, endYear: 2002 } })).toBe(false)
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

function makeItems () {
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

describe('countDidYouMeanSuggestionsThatFit', () => {
  const term = (value) => ({ value })

  it('returns 0 when there are no candidates, regardless of width', () => {
    expect(countDidYouMeanSuggestionsThatFit([], 1000)).toBe(0)
    expect(countDidYouMeanSuggestionsThatFit([], 0)).toBe(0)
  })

  it('returns 1 (never 0) when width is unknown/unmeasurable but candidates exist', () => {
    expect(countDidYouMeanSuggestionsThatFit([term('Denis Villeneuve')], 0)).toBe(1)
  })

  it('fits exactly one short term in a narrow width', () => {
    // "Did you mean?: " (16 chars) + "Ab" (2 chars) at 6px/char = 108px
    const count = countDidYouMeanSuggestionsThatFit([term('Ab'), term('Cd'), term('Ef')], 120)
    expect(count).toBe(1)
  })

  it('fits more terms as width grows', () => {
    const candidates = [term('Ab'), term('Cd'), term('Ef'), term('Gh')]
    const narrow = countDidYouMeanSuggestionsThatFit(candidates, 120)
    const wide = countDidYouMeanSuggestionsThatFit(candidates, 2000)
    expect(wide).toBeGreaterThan(narrow)
    expect(wide).toBe(4)
  })

  it('never returns more than the number of candidates available', () => {
    const candidates = [term('Ab'), term('Cd')]
    expect(countDidYouMeanSuggestionsThatFit(candidates, 100000)).toBe(2)
  })

  it('accounts for the ", " separator between terms, not just the terms themselves', () => {
    // Two terms whose own widths just fit, but not with a separator between them.
    const labelWidth = 'Did you mean?: '.length * 6 // 96
    const termWidth = 10 * 6 // a 10-char term = 60px
    // Room for label + one term + separator, but not a second full term.
    const maxWidth = labelWidth + termWidth + 2 * 6 + 5
    const candidates = [term('AAAAAAAAAA'), term('BBBBBBBBBB')]
    expect(countDidYouMeanSuggestionsThatFit(candidates, maxWidth)).toBe(1)
  })

  it('always returns at least 1 even if the single best term does not perfectly fit', () => {
    const count = countDidYouMeanSuggestionsThatFit([term('A Very Long Suggestion Title Indeed')], 50)
    expect(count).toBe(1)
  })
})

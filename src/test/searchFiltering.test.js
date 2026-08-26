import { describe, it, expect } from 'vitest'
import {
  buildSearchFields,
  getListOfYearsFromRange,
  applyFilter,
  getSortValue,
  isSortValueUnknown,
  sortResultsFast,
  sortResults,
  countDidYouMeanSuggestionsThatFit,
  normalizeSearchText,
  looseSearchText
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
  it('normalizes title/keywords/genres/cast/crew/companies, accents and all', () => {
    const s = buildSearchFields(movie)
    expect(s.title).toBe('amelie') // accents stripped on the stored side too
    expect(s.titleLoose).toBe('amelie')
    expect(s.keywords).toEqual(['paris', 'whimsical'])
    expect(s.genres).toEqual(['comedy', 'romance'])
    expect(s.cast).toContain('audrey tautou')
    expect(s.crew[0]).toEqual({
      // The hyphen is a space by now, so either spelling reaches this string.
      name: 'jean pierre jeunet',
      job: 'Director',
      jobLower: 'director'
    })
    expect(s.companies).toEqual(['ugc'])
  })

  // The bug this pass was for: the stored title was de-accented but the query
  // wasn't, so typing the title correctly found nothing.
  it('finds an accented title whether or not the accent is typed', () => {
    expect(applyFilter(result, { type: 'general', value: 'Amélie' })).toBe(true)
    expect(applyFilter(result, { type: 'general', value: 'amelie' })).toBe(true)
    expect(applyFilter(result, { type: 'title', value: 'Amélie' })).toBe(true)
  })

  it('finds an accented name whether or not the accent is typed', () => {
    const zellweger = { movie: { cast: [{ name: 'Renée Zellweger' }] } }

    expect(applyFilter(zellweger, { type: 'cast', value: 'Renee' })).toBe(true)
    expect(applyFilter(zellweger, { type: 'cast', value: 'Renée' })).toBe(true)
    expect(applyFilter(zellweger, { type: 'general', value: 'renée zellweger' })).toBe(true)
    expect(applyFilter(zellweger, { type: 'person', value: 'Renee Zellweger' })).toBe(true)
  })

  it('ignores punctuation and spacing differences in titles and names', () => {
    const spiderMan = { movie: { title: 'Spider-Man' } }
    const wall_e = { movie: { title: 'WALL·E' } }
    const jeunet = { movie: { crew: [{ name: 'Jean-Pierre Jeunet', job: 'Director' }] } }

    expect(applyFilter(spiderMan, { type: 'general', value: 'spider man' })).toBe(true)
    expect(applyFilter(spiderMan, { type: 'general', value: 'spiderman' })).toBe(true)
    expect(applyFilter(wall_e, { type: 'title', value: 'wall e' })).toBe(true)
    expect(applyFilter(jeunet, { type: 'director', value: 'jean pierre' })).toBe(true)
    expect(applyFilter(jeunet, { type: 'person', value: 'jean pierre jeunet' })).toBe(true)
  })

  it('collapses runaway whitespace instead of failing on it', () => {
    expect(applyFilter(result, { type: 'general', value: '  amelie  ' })).toBe(true)
    expect(applyFilter({ movie: { title: "Adam's Rib" } }, { type: 'title', value: 'adam  s   rib' })).toBe(true)
  })

  it('keeps a non-Latin title findable rather than stripping it to nothing', () => {
    const entry = { movie: { title: '千と千尋の神隠し' } }

    expect(applyFilter(entry, { type: 'general', value: '千と千尋' })).toBe(true)
    expect(applyFilter(entry, { type: 'general', value: 'spirited away' })).toBe(false)
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
    expect(s.titleLoose).toBe('')
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
    ['genre', 'Comedy', true],
    ['genre', 'comedy', true], // matching is case-insensitive now, not just for chips
    ['genre', 'horror', false],
    ['company', 'UGC', true],
    ['company', 'ugc', true],
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

// Requested 2026-08-25: "sort by budget, by box office, and then by profit and
// by percentage of budget returned." The awkward part is that the data is
// optional — TMDB's 0 means "unknown", and about a fifth of a real library has
// no figures.
function makeMoneyItems () {
  const at = (title, budget, revenue, calculatedTotal) => ({
    movie: { title, release_date: '2010-01-01', budget, revenue },
    ratings: [{}],
    rating: { calculatedTotal, date: '1', love: 5 }
  })
  return [
    at('Cheap Hit', 5, 100, 7),        // 20x return, +95 profit
    at('Blockbuster', 200, 900, 8),    // 4.5x return, +700 profit
    at('Flop', 300, 60, 6),            // 0.2x return, -240 profit
    at('Unknown Budget', 0, 400, 9),   // revenue only
    at('No Figures At All', 0, 0, 5)
  ]
}

describe('the money sorts', () => {
  const item = (title) => makeMoneyItems().find((i) => i.movie.title === title)

  it('reads each figure off the movie', () => {
    expect(getSortValue(item('Blockbuster'), 'budget', getRating)).toBe(200)
    expect(getSortValue(item('Blockbuster'), 'boxOffice', getRating)).toBe(900)
    expect(getSortValue(item('Blockbuster'), 'profit', getRating)).toBe(700)
    expect(getSortValue(item('Blockbuster'), 'returnPct', getRating)).toBe(450)
  })

  it('reports a loss as a negative profit rather than clamping it', () => {
    expect(getSortValue(item('Flop'), 'profit', getRating)).toBe(-240)
    expect(getSortValue(item('Flop'), 'returnPct', getRating)).toBe(20)
  })

  // A zero budget would make the ratio Infinity and float a film with no
  // figures above every real one.
  it('never returns Infinity for a zero budget', () => {
    expect(getSortValue(item('Unknown Budget'), 'returnPct', getRating)).toBe(0)
    expect(Number.isFinite(getSortValue(item('Unknown Budget'), 'returnPct', getRating))).toBe(true)
  })

  it('knows which figures each sort actually needs', () => {
    // Revenue but no budget: box office is answerable, the other three aren't.
    expect(isSortValueUnknown(item('Unknown Budget'), 'boxOffice')).toBe(false)
    expect(isSortValueUnknown(item('Unknown Budget'), 'budget')).toBe(true)
    expect(isSortValueUnknown(item('Unknown Budget'), 'profit')).toBe(true)
    expect(isSortValueUnknown(item('Unknown Budget'), 'returnPct')).toBe(true)
  })

  it('leaves every other sort alone', () => {
    expect(isSortValueUnknown(item('No Figures At All'), 'rating')).toBe(false)
    expect(isSortValueUnknown(item('No Figures At All'), 'title')).toBe(false)
  })

  // The behaviour that makes the sorts usable: flipping to worst-on-top to
  // find the biggest flops must show flops, not the films with no figures.
  it('sinks the films with no figures in BOTH directions', () => {
    const withFigures = ['Cheap Hit', 'Blockbuster', 'Flop']
    for (const sortOrder of ['bestOrNewestOnTop', 'worstOrOldestOnTop']) {
      const titles = sortResultsFast(makeMoneyItems(), { sortValue: 'profit', sortOrder, getRating })
        .map((i) => i.movie.title)
      expect(titles.slice(0, 3).sort()).toEqual([...withFigures].sort())
      expect(titles.slice(3).sort()).toEqual(['No Figures At All', 'Unknown Budget'])
    }
  })

  it('puts the biggest earner on top and the biggest loss at the bottom', () => {
    const titles = sortResultsFast(makeMoneyItems(), { sortValue: 'profit', sortOrder: 'bestOrNewestOnTop', getRating })
      .map((i) => i.movie.title)
    expect(titles[0]).toBe('Blockbuster')
    expect(titles[2]).toBe('Flop')
  })

  // Profit and return are different questions, and the cheap film should win
  // one of them — that's the reason to offer both.
  it('ranks by return on budget differently than by raw profit', () => {
    const byReturn = sortResultsFast(makeMoneyItems(), { sortValue: 'returnPct', sortOrder: 'bestOrNewestOnTop', getRating })
      .map((i) => i.movie.title)
    expect(byReturn[0]).toBe('Cheap Hit')
    expect(byReturn[1]).toBe('Blockbuster')
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

  // The money sorts go through the same lockstep check, on a fixture that
  // actually exercises the unknown-sinks branch in both implementations.
  for (const sortValue of ['budget', 'boxOffice', 'profit', 'returnPct']) {
    for (const sortOrder of ['bestOrNewestOnTop', 'worstOrOldestOnTop']) {
      it(`${sortValue} / ${sortOrder}`, () => {
        const opts = { sortValue, sortOrder, getRating }
        const fast = sortResultsFast(makeMoneyItems(), opts).map(i => i.movie.title)
        const oracle = [...makeMoneyItems()].sort((a, b) => sortResults(a, b, opts)).map(i => i.movie.title)
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

// Gotchas found reading the whole search path on 2026-08-16, after the curly
// apostrophe and the accent bug. Each was reachable by typing, not just by
// clicking a chip built from the library.
describe('search normalization gotchas', () => {
  it('folds letters NFD leaves alone', () => {
    expect(normalizeSearchText('Łódź')).toBe('lodz')
    expect(normalizeSearchText('Straße')).toBe('strasse')
    expect(applyFilter({ movie: { title: 'Łódź' } }, { type: 'general', value: 'lodz' })).toBe(true)
  })

  it('matches a company or genre typed in the wrong case', () => {
    const entry = { movie: { production_companies: [{ name: 'Warner Bros. Pictures' }] } }

    expect(applyFilter(entry, { type: 'company', value: 'warner bros. pictures' })).toBe(true)
    expect(applyFilter(entry, { type: 'company', value: 'Warner Bros Pictures' })).toBe(false) // exact, minus case
  })

  it('matches a tag regardless of how it was capitalized when written', () => {
    const entry = { movie: {}, ratings: [{ tags: [{ title: 'Cozy' }] }] }

    expect(applyFilter(entry, { type: 'tag', value: 'cozy' })).toBe(true)
  })

  it('matches a year chip that arrived as a number', () => {
    const entry = { movie: { release_date: '2001-04-25' } }

    expect(applyFilter(entry, { type: 'year', value: 2001 })).toBe(true)
  })

  it('memoizes without leaking the previous answer', () => {
    expect(normalizeSearchText('Amélie')).toBe('amelie')
    expect(normalizeSearchText('Amélie')).toBe('amelie') // cache hit
    expect(normalizeSearchText('Adam’s Rib')).toBe("adam's rib")
    expect(looseSearchText('Adam’s Rib')).toBe('adamsrib')
    expect(looseSearchText('Spider-Man')).toBe('spiderman')
  })
})

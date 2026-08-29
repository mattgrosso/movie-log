// What a typed word could MEAN, as a list rather than a verdict.
//
// This is the half of the 2026-08-29 search redesign that keeps precision
// available after typed text stopped committing typed chips. The filtering
// question ("plain search, always") and the identity question ("what could
// these words refer to?") were tangled together in one cascade; this module
// is the second one, and "More from" is its consumer.
import { describe, it, expect } from 'vitest'
import {
  interpretationsFor,
  discoverFilterFor,
  describeInterpretation
} from '@/assets/javascript/searchInterpretations.js'
import { normalizeSearchText } from '@/assets/javascript/searchText.js'

// The shape buildCatalog returns: entries carrying kind, name, norm, count
// and the TMDB id the library already knew. `norm` is derived here the same
// way the catalog derives it, rather than hand-written — a hand-written one
// silently disagreed with the real thing over the full stop in "Warner Bros."
// (normalizeSearchText folds dashes and curly quotes, but keeps full stops).
const entry = (kind, name, count, tmdbId = null) =>
  ({ kind, name, norm: normalizeSearchText(name), count, tmdbId })

const catalog = {
  entries: [
    entry('genre', 'Thriller', 40, 53),
    entry('genre', 'Drama', 300, 18),
    entry('cast', 'Mary Alice', 2),
    entry('cast', 'Denzel Washington', 9),
    entry('director', 'Martin Scorsese', 14),
    entry('company', 'Warner Bros. Pictures', 60, 174),
    entry('keyword', 'heist', 12, 9748),
    // Same person as both a director and a member of a cast — a director with
    // a cameo is the normal case, not a corner one.
    entry('director', 'Jordan Peele', 3),
    entry('cast', 'Jordan Peele', 4)
  ]
}

describe('interpretationsFor', () => {
  it('reads an exact genre, with the id More from will need', () => {
    const [lead] = interpretationsFor(catalog, 'Thriller')
    expect(lead).toMatchObject({ kind: 'genre', name: 'Thriller', tmdbId: 53, exact: true })
  })

  // The Alice case. Nobody in the library is CALLED "Alice" — she is Mary
  // Alice — so the only way the word reaches her is by surname.
  it('reads a surname as a partial reading of a person', () => {
    const readings = interpretationsFor(catalog, 'Alice')
    expect(readings).toHaveLength(1)
    expect(readings[0]).toMatchObject({ kind: 'cast', name: 'Mary Alice', exact: false })
  })

  it('prefers a whole name over a surname', () => {
    const readings = interpretationsFor(catalog, 'Mary Alice')
    expect(readings[0]).toMatchObject({ name: 'Mary Alice', exact: true })
  })

  it('matches a surname only for people, never for a studio or keyword', () => {
    // "Pictures" is the last word of a company name; a company is not a
    // person and has no surname to be known by.
    expect(interpretationsFor(catalog, 'Pictures')).toEqual([])
  })

  it('collapses one person who is both director and cast into a single reading', () => {
    const readings = interpretationsFor(catalog, 'Jordan Peele')
    expect(readings).toHaveLength(1)
    // The sharper word survives: he shows as a director, not as cast.
    expect(readings[0].kind).toBe('director')
  })

  it('says nothing about a word the library does not know', () => {
    expect(interpretationsFor(catalog, 'zzzz')).toEqual([])
    expect(interpretationsFor(catalog, '')).toEqual([])
    expect(interpretationsFor(null, 'Thriller')).toEqual([])
  })

  it('normalizes both sides, so punctuation and accents still land', () => {
    expect(interpretationsFor(catalog, 'warner bros pictures')[0]?.kind).toBe('company')
    expect(interpretationsFor(catalog, 'WARNER BROS. PICTURES')[0]?.kind).toBe('company')
  })

  it('caps how many readings it offers', () => {
    expect(interpretationsFor(catalog, 'Drama', { limit: 1 })).toHaveLength(1)
  })
})

describe('discoverFilterFor', () => {
  it('turns a genre reading into a genre question carrying its id', () => {
    const [genre] = interpretationsFor(catalog, 'Thriller')
    expect(discoverFilterFor(genre)).toMatchObject({ type: 'genre', value: 'Thriller', genreId: 53 })
  })

  // Both roles ask TMDB the same thing: films this person is attached to.
  it('turns either kind of person into one person question', () => {
    const [director] = interpretationsFor(catalog, 'Martin Scorsese')
    const [cast] = interpretationsFor(catalog, 'Mary Alice')
    expect(discoverFilterFor(director).type).toBe('person')
    expect(discoverFilterFor(cast).type).toBe('person')
  })

  it('carries a stored id for a studio or keyword so no lookup is needed', () => {
    const [company] = interpretationsFor(catalog, 'Warner Bros. Pictures')
    const [keyword] = interpretationsFor(catalog, 'heist')
    expect(discoverFilterFor(company)).toMatchObject({ type: 'company', tmdbId: 174 })
    expect(discoverFilterFor(keyword)).toMatchObject({ type: 'keyword', tmdbId: 9748 })
  })

  it('refuses anything it does not understand', () => {
    expect(discoverFilterFor(null)).toBeNull()
    expect(discoverFilterFor({ kind: 'nonsense', name: 'x' })).toBeNull()
  })
})

describe('describeInterpretation', () => {
  it('names each kind in its own words, so two rows can be told apart', () => {
    expect(describeInterpretation({ kind: 'genre', name: 'Thriller' })).toBe('More Thriller')
    expect(describeInterpretation({ kind: 'cast', name: 'Mary Alice' })).toBe('More with Mary Alice')
    expect(describeInterpretation({ kind: 'director', name: 'Martin Scorsese' })).toBe('More from Martin Scorsese')
    expect(describeInterpretation(null)).toBe('')
  })
})

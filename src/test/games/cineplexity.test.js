import { describe, it, expect } from 'vitest'
import { buildCineplexityRound, matchGuess, normalizeTitle } from '@/assets/javascript/games/cineplexity.js'

// Cineplexity round logic (Brian-survey F5): a pair of trait values whose
// intersection is a findable, bounded set of the player's own movies.

function entry (id, title, { year = 1995, genres = [], cast = [], director = null } = {}) {
  return {
    dbKey: `k${id}`,
    movie: {
      id,
      title,
      release_date: `${year}-06-15`,
      genres: genres.map((name, i) => ({ id: i + 1, name })),
      cast: cast.map((name) => ({ name })),
      crew: director ? [{ name: director, job: 'Director' }] : []
    },
    ratings: [{ calculatedTotal: 7 }]
  }
}

// A library where Horror + the 1980s intersect on exactly 3 movies.
function library () {
  return [
    entry(1, 'Alpha', { year: 1984, genres: ['Horror'] }),
    entry(2, 'Beta', { year: 1986, genres: ['Horror'] }),
    entry(3, 'Gamma', { year: 1988, genres: ['Horror'] }),
    entry(4, 'Delta', { year: 1984, genres: ['Comedy'] }),
    entry(5, 'Epsilon', { year: 1985, genres: ['Comedy'] }),
    entry(6, 'Zeta', { year: 1983, genres: ['Comedy'] }),
    entry(7, 'Eta', { year: 1999, genres: ['Horror'] }),
    entry(8, 'Theta', { year: 1997, genres: ['Horror'] }),
    entry(9, 'Iota', { year: 1996, genres: ['Comedy'] })
  ]
}

describe('buildCineplexityRound', () => {
  it('produces two different-kind traits with a bounded intersection', () => {
    const round = buildCineplexityRound(library(), () => 0.4, { minMatches: 3, maxMatches: 6 })
    expect(round).not.toBeNull()
    expect(round.traitA.kind).not.toBe(round.traitB.kind)
    expect(round.matches.length).toBeGreaterThanOrEqual(3)
    expect(round.matches.length).toBeLessThanOrEqual(6)
    round.matches.forEach((m) => expect(m.movie.title).toBeTruthy())
  })

  it('returns null for a library too small to play', () => {
    expect(buildCineplexityRound([entry(1, 'Only')], () => 0.5)).toBeNull()
  })
})

describe('matchGuess', () => {
  const remaining = [entry(1, 'The Empire Strikes Back'), entry(2, 'The Matrix')]

  it('matches case- and punctuation-insensitively', () => {
    expect(matchGuess('the matrix', remaining)?.movie.title).toBe('The Matrix')
    expect(matchGuess('  THE MATRIX!! ', remaining)?.movie.title).toBe('The Matrix')
  })

  it('accepts an unambiguous prefix of 4+ characters', () => {
    expect(matchGuess('the empire', remaining)?.movie.title).toBe('The Empire Strikes Back')
    // ambiguous short prefix: both start with "the " — no match
    expect(matchGuess('the ', remaining)).toBeNull()
  })

  it('rejects non-members and trivial input', () => {
    expect(matchGuess('Jaws', remaining)).toBeNull()
    expect(matchGuess('t', remaining)).toBeNull()
  })

  it('normalizeTitle strips punctuation and case', () => {
    expect(normalizeTitle("WALL·E")).toBe('wall e')
  })
})

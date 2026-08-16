import { describe, it, expect } from 'vitest'
import { rankDirectorsByLogScore } from '@/assets/javascript/logScoreRankings.js'

// Brian's-method director list: pure log score over composite ratings.

function entry (id, title, rating, directors) {
  return {
    dbKey: `k${id}`,
    movie: {
      id,
      title,
      crew: directors.map((name) => ({ name, job: 'Director' }))
    },
    ratings: [{ calculatedTotal: rating }]
  }
}
const ratingOf = (e) => ({ calculatedTotal: e.ratings[0].calculatedTotal })

describe('rankDirectorsByLogScore', () => {
  it('ranks a deep strong filmography above a lone masterpiece (Bayesian pull)', () => {
    const library = [
      entry(1, 'A', 9, ['Deep Career']),
      entry(2, 'B', 9, ['Deep Career']),
      entry(3, 'C', 9, ['Deep Career']),
      entry(4, 'D', 9, ['Deep Career']),
      entry(5, 'One Hit', 10, ['One Hit Wonder']),
      // Ballast so the global average sits well below 9.
      entry(6, 'E', 5, ['Someone Else']),
      entry(7, 'F', 5, ['Someone Else']),
      entry(8, 'G', 5, ['Another Person'])
    ]
    const ranked = rankDirectorsByLogScore(library, ratingOf)
    expect(ranked[0].name).toBe('Deep Career')
    expect(ranked[0].count).toBe(4)
    // The single 10 gets pulled hard toward the global average with n=1.
    const oneHit = ranked.find((d) => d.name === 'One Hit Wonder')
    expect(oneHit.score).toBeLessThan(ranked[0].score)
  })

  it('films come back sorted best-first and co-directors both get credit', () => {
    const library = [
      entry(1, 'Together', 8, ['Ana', 'Ben']),
      entry(2, 'Solo High', 9.5, ['Ana'])
    ]
    const ranked = rankDirectorsByLogScore(library, ratingOf)
    const ana = ranked.find((d) => d.name === 'Ana')
    expect(ana.count).toBe(2)
    expect(ana.films[0].entry.movie.title).toBe('Solo High')
    expect(ranked.find((d) => d.name === 'Ben').count).toBe(1)
  })

  it('a duplicate Director credit on one film counts once', () => {
    const library = [
      { dbKey: 'k1', movie: { id: 1, title: 'Dup', crew: [{ name: 'Ana', job: 'Director' }, { name: 'Ana', job: 'Director' }] }, ratings: [{ calculatedTotal: 8 }] },
      entry(2, 'Other', 6, ['Ben'])
    ]
    const ranked = rankDirectorsByLogScore(library, ratingOf)
    expect(ranked.find((d) => d.name === 'Ana').count).toBe(1)
  })

  it('empty library yields an empty list', () => {
    expect(rankDirectorsByLogScore([], ratingOf)).toEqual([])
  })
})

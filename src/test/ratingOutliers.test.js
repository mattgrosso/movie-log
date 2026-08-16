import { describe, it, expect } from 'vitest'
import { tasteOutliers, bestReleaseYears } from '@/assets/javascript/ratingOutliers.js'

function entry (id, rating, { genre = null, year = 2000, director = null } = {}) {
  return {
    dbKey: `k${id}`,
    movie: {
      id,
      title: `Film ${id}`,
      release_date: `${year}-06-15`,
      genres: genre ? [{ name: genre }] : [],
      crew: director ? [{ name: director, job: 'Director' }] : [],
      cast: [],
      flatKeywords: [],
      production_companies: []
    },
    ratings: [{ calculatedTotal: rating }]
  }
}
const ratingOf = (e) => ({ calculatedTotal: e.ratings[0].calculatedTotal })

describe('tasteOutliers', () => {
  // Global average ~6: Horror runs hot (9s), War runs cold (3s), and a
  // 2-film genre is excluded by the min-count floor no matter how extreme.
  const library = [
    ...Array.from({ length: 5 }, (_, i) => entry(i, 9, { genre: 'Horror' })),
    ...Array.from({ length: 5 }, (_, i) => entry(10 + i, 3, { genre: 'War' })),
    ...Array.from({ length: 8 }, (_, i) => entry(20 + i, 6, { genre: 'Drama' })),
    entry(40, 10, { genre: 'Tiny Sample' }),
    entry(41, 10, { genre: 'Tiny Sample' })
  ]

  it('splits loved and hardest by deviation with counts attached', () => {
    const { loved, hardest } = tasteOutliers(library, ratingOf, { minCount: 5 })
    expect(loved[0].name).toBe('Horror')
    expect(loved[0].count).toBe(5)
    expect(loved[0].deviation).toBeGreaterThan(0)
    expect(hardest[0].name).toBe('War')
    expect(hardest[0].deviation).toBeLessThan(0)
  })

  it('the min-count floor silences tiny samples', () => {
    const { loved } = tasteOutliers(library, ratingOf, { minCount: 5 })
    expect(loved.map((l) => l.name)).not.toContain('Tiny Sample')
  })

  it('empty library yields empty lists', () => {
    expect(tasteOutliers([], ratingOf)).toEqual({ loved: [], hardest: [] })
  })
})

describe('bestReleaseYears', () => {
  const library = [
    // 1994: deep AND great
    ...Array.from({ length: 6 }, (_, i) => entry(i, 9, { year: 1994 })),
    // 2005: one masterpiece, too thin to qualify at minCount 4
    entry(20, 10, { year: 2005 }),
    // 2010: deep but mediocre
    ...Array.from({ length: 6 }, (_, i) => entry(30 + i, 5, { year: 2010 }))
  ]

  it('ranks release years by log score with counts and the top film', () => {
    const years = bestReleaseYears(library, ratingOf, {}, { minCount: 4 })
    expect(years[0].year).toBe(1994)
    expect(years[0].count).toBe(6)
    expect(years[0].top.movie.release_date).toContain('1994')
    expect(years.map((y) => y.year)).not.toContain(2005) // below the floor
    const y2010 = years.find((y) => y.year === 2010)
    expect(y2010.score).toBeLessThan(years[0].score)
  })
})

describe('tasteOutliers type diversity', () => {
  // TMDB gives films many keywords, so without a per-type cap the lists
  // come back all keywords and bury genres/people.
  const many = []
  for (let i = 0; i < 10; i++) {
    many.push({
      dbKey: `k${i}`,
      movie: {
        id: i,
        release_date: '2000-06-15',
        genres: [{ name: 'Horror' }],
        crew: [{ name: 'Dir Person', job: 'Director' }],
        cast: [{ name: 'Star Person' }],
        flatKeywords: ['kw-a', 'kw-b', 'kw-c', 'kw-d', 'kw-e', 'kw-f'],
        production_companies: [{ name: 'Studio X' }]
      },
      ratings: [{ calculatedTotal: 9 }]
    })
  }
  // Ballast to pull the global average well below 9.
  for (let i = 0; i < 20; i++) {
    many.push({
      dbKey: `b${i}`,
      movie: { id: 100 + i, release_date: '2000-06-15', genres: [{ name: 'Drama' }], crew: [], cast: [], flatKeywords: [], production_companies: [] },
      ratings: [{ calculatedTotal: 4 }]
    })
  }
  const rate = (e) => ({ calculatedTotal: e.ratings[0].calculatedTotal })

  it('caps how many of any one type can fill a card', () => {
    const { loved } = tasteOutliers(many, rate, { minCount: 5, cap: 8, perType: 3 })
    const keywordCount = loved.filter((l) => l.type === 'Keyword').length
    expect(keywordCount).toBeLessThanOrEqual(3)
    // …leaving room for the other kinds of signal.
    expect(loved.map((l) => l.type)).toContain('Genre')
    expect(loved.map((l) => l.type)).toContain('Director')
  })
})

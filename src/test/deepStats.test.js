import { describe, it, expect } from 'vitest'
import { crownTimeline, pantheon, rewatchStats, marathonStats, yearStats, genreStats } from '@/assets/javascript/deepStats.js'

const NOW = Date.UTC(2026, 7, 15)
const day = (y, m, d) => Date.UTC(y, m, d, 12)

function entry (id, { rating = 7, release = '2000-06-15', dates = [day(2020, 5, 10)], genres = [], runtime = 100, criteria = {} } = {}) {
  return {
    dbKey: `k${id}`,
    movie: { id, title: `M${id}`, release_date: release, runtime, genres: genres.map((name, i) => ({ id: i + 1, name })) },
    ratings: dates.map((date) => ({ date, calculatedTotal: rating, ...criteria }))
  }
}
const ratingOf = (e) => ({ calculatedTotal: e.ratings[e.ratings.length - 1]?.calculatedTotal })

describe('crownTimeline', () => {
  it('crowns each new all-time high by release year, with reign lengths', () => {
    const entries = [
      entry(1, { rating: 6, release: '1950-06-15' }),
      entry(2, { rating: 8, release: '1962-06-15' }),
      entry(3, { rating: 7, release: '1970-06-15' }), // never crowned
      entry(4, { rating: 9.5, release: '1993-06-15' })
    ]
    const reigns = crownTimeline(entries, ratingOf, NOW)

    expect(reigns.map((r) => r.entry.movie.id)).toEqual([1, 2, 4])
    expect(reigns[0]).toMatchObject({ year: 1950, until: 1962, reignYears: 12, current: false })
    expect(reigns[2]).toMatchObject({ year: 1993, until: null, current: true, reignYears: 33 })
  })
})

describe('pantheon', () => {
  it('collects perfect marks per category (10s, and 5s for love/stickiness) with constellations', () => {
    const entries = [
      entry(1, { criteria: { direction: 10, imagery: 10 } }),
      entry(2, { criteria: { love: 5 } }),
      entry(3, { criteria: { direction: 9.9 } }) // not perfect
    ]
    const result = pantheon(entries, ratingOf)

    expect(result.perfectFilms).toBe(2)
    expect(result.totalMarks).toBe(3)
    expect(result.categories.map((c) => c.label).sort()).toEqual(['Direction', 'Imagery', 'Love'])
    expect(result.constellations).toHaveLength(1)
    expect(result.constellations[0].count).toBe(2)
  })

  it('uses only the most recent viewing', () => {
    const changed = entry(1, { dates: [day(2019, 0, 1), day(2021, 0, 1)] })
    changed.ratings[0].direction = 10 // old viewing was perfect
    changed.ratings[1].direction = 8 // newest is not
    expect(pantheon([changed], ratingOf).perfectFilms).toBe(0)
  })
})

describe('rewatchStats', () => {
  it('counts repeats, rate, median return, and quickest gaps', () => {
    const entries = [
      entry(1, { dates: [day(2018, 0, 1), day(2020, 0, 1), day(2021, 0, 1)] }), // 2 repeats
      entry(2, { dates: [day(2020, 0, 1), day(2020, 0, 1)] }), // same-day repeat
      entry(3, { dates: [day(2020, 5, 1)] }) // single viewing
    ]
    const stats = rewatchStats(entries)

    expect(stats.repeatViewings).toBe(3)
    expect(stats.filmsRevisited).toBe(2)
    expect(stats.rewatchRate).toBeCloseTo(2 / 3, 5)
    expect(stats.mostRewatched[0].entry.movie.id).toBe(1)
    expect(stats.quickestReturns[0].entry.movie.id).toBe(2)
    expect(stats.quickestReturns[0].gapDays).toBe(0)
  })

  it('null when nothing was ever rewatched', () => {
    expect(rewatchStats([entry(1)])).toBeNull()
  })
})

describe('marathonStats', () => {
  it('finds day records, totals, and top days', () => {
    const bigDay = day(2024, 9, 27)
    const entries = [
      entry(1, { dates: [bigDay], runtime: 120 }),
      entry(2, { dates: [bigDay], runtime: 90 }),
      entry(3, { dates: [bigDay], runtime: 100 }),
      entry(4, { dates: [day(2024, 9, 28)], runtime: 100 })
    ]
    const stats = marathonStats(entries)

    expect(stats.admissions).toBe(4)
    expect(stats.screenMinutes).toBe(410)
    expect(stats.movieDays).toBe(2)
    expect(stats.dayRecord.count).toBe(3)
    expect(stats.dayRecord.minutes).toBe(310)
    expect(stats.topDays[0].count).toBe(3)
  })

  it('excludes shorts unless asked', () => {
    const entries = [entry(1, { runtime: 30 }), entry(2, { runtime: 100 })]
    expect(marathonStats(entries).admissions).toBe(1)
    expect(marathonStats(entries, { includeShorts: true }).admissions).toBe(2)
  })
})

describe('yearStats / genreStats (log-scored)', () => {
  it('buckets by watch year with from-that-year counts and a top film', () => {
    const entries = [
      entry(1, { rating: 9, dates: [day(2024, 2, 1)], release: '2024-01-15' }),
      entry(2, { rating: 7, dates: [day(2024, 4, 1)], release: '1999-01-15' }),
      entry(3, { rating: 8, dates: [day(2023, 4, 1)] })
    ]
    const years = yearStats(entries, ratingOf)

    expect(years[0]).toMatchObject({ year: 2024, watched: 2, fromYear: 1 })
    expect(years[0].top.movie.id).toBe(1)
    expect(years[0].score).not.toBeNull()
  })

  it('ranks genres by log score with a minimum count', () => {
    const entries = [
      ...Array.from({ length: 5 }, (_, i) => entry(i, { rating: 9, genres: ['Horror'] })),
      ...Array.from({ length: 5 }, (_, i) => entry(10 + i, { rating: 6, genres: ['Comedy'] })),
      entry(30, { rating: 10, genres: ['Documentary'] }) // below minCount
    ]
    const genres = genreStats(entries, ratingOf)

    expect(genres.map((g) => g.name)).toEqual(['Horror', 'Comedy'])
    expect(genres[0].score).toBeGreaterThan(genres[1].score)
    expect(genres.find((g) => g.name === 'Documentary')).toBeUndefined()
  })
})

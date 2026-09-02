import { describe, it, expect } from 'vitest'
import {
  decadesAvailable,
  defaultDecade,
  decadeChampionship,
  releaseDecade
} from '@/assets/javascript/decadeChampionship.js'

// A library where the same rating is read straight off the entry.
function entry (id, { rating = 7, release = '1994-06-15', cast = [], crew = [] } = {}) {
  return {
    dbKey: `k${id}`,
    movie: {
      id,
      title: `M${id}`,
      release_date: release,
      poster_path: `/p${id}.jpg`,
      cast: cast.map((name) => ({ name, character: 'Self' })),
      crew: crew.map(([job, name]) => ({ job, name }))
    },
    ratings: [{ date: '2024-01-01', calculatedTotal: rating }]
  }
}
const ratingOf = (e) => ({ calculatedTotal: e.ratings[0].calculatedTotal })
const names = (ranked) => ranked.map((p) => p.name)

describe('releaseDecade / decadesAvailable / defaultDecade', () => {
  it('buckets by release decade, newest first, counting rated films only', () => {
    const entries = [
      entry(1, { release: '1994-01-01' }),
      entry(2, { release: '1999-12-31' }),
      entry(3, { release: '2001-05-05' }),
      entry(4, { release: '1978-05-05' }),
      { dbKey: 'undated', movie: { id: 5, title: 'X' }, ratings: [{ calculatedTotal: 9 }] }
    ]
    expect(releaseDecade(entries[0])).toBe(1990)
    expect(releaseDecade(entries[4])).toBeNull()
    expect(decadesAvailable(entries, ratingOf)).toEqual([
      { decade: 2000, label: '2000s', count: 1 },
      { decade: 1990, label: '1990s', count: 2 },
      { decade: 1970, label: '1970s', count: 1 }
    ])
  })

  it('leaves out films with no rating', () => {
    const unrated = entry(1)
    unrated.ratings = []
    const ratingOfSafe = (e) => ({ calculatedTotal: e.ratings[0]?.calculatedTotal })
    expect(decadesAvailable([unrated, entry(2)], ratingOfSafe)).toEqual([{ decade: 1990, label: '1990s', count: 1 }])
  })

  it('defaults to the decade with the most rated films, newest on a tie', () => {
    expect(defaultDecade([
      { decade: 2000, count: 3 },
      { decade: 1990, count: 5 },
      { decade: 1970, count: 5 }
    ])).toBe(1990)
    expect(defaultDecade([])).toBeNull()
  })
})

describe('decadeChampionship', () => {
  it('only films released in that decade count', () => {
    const entries = [
      entry(1, { release: '1994-01-01', crew: [['Director', 'Nineties']] }),
      entry(2, { release: '1997-01-01', crew: [['Director', 'Nineties']] }),
      entry(3, { release: '2004-01-01', crew: [['Director', 'Noughties']] }),
      entry(4, { release: '2007-01-01', crew: [['Director', 'Noughties']] })
    ]
    const result = decadeChampionship(entries, ratingOf, undefined, 1990)
    expect(result.label).toBe('1990s')
    expect(result.filmCount).toBe(2)
    expect(result.films.map((f) => f.entry.movie.id)).toEqual([1, 2])
    expect(names(result.crew.find((c) => c.key === 'director').ranked)).toEqual(['Nineties'])
  })

  it('nobody qualifies on a single film', () => {
    const entries = [
      entry(1, { rating: 10, crew: [['Director', 'One Hit']] }),
      entry(2, { rating: 7, crew: [['Director', 'Steady']] }),
      entry(3, { rating: 7, crew: [['Director', 'Steady']] })
    ]
    const director = decadeChampionship(entries, ratingOf, undefined, 1990).crew.find((c) => c.key === 'director')
    expect(names(director.ranked)).toEqual(['Steady'])
  })

  it('depth beats one great film: four good films outrank two great ones', () => {
    const entries = [
      entry(1, { rating: 9.8, crew: [['Director', 'Flash']] }),
      entry(2, { rating: 9.8, crew: [['Director', 'Flash']] }),
      ...Array.from({ length: 4 }, (_, i) => entry(10 + i, { rating: 9.2, crew: [['Director', 'Body Of Work']] })),
      // Padding so the library average sits well below both.
      ...Array.from({ length: 20 }, (_, i) => entry(100 + i, { rating: 6 }))
    ]
    const director = decadeChampionship(entries, ratingOf, undefined, 1990).crew.find((c) => c.key === 'director')
    expect(names(director.ranked)).toEqual(['Body Of Work', 'Flash'])
    expect(director.ranked[0].count).toBe(4)
    expect(director.ranked[0].best.movie.id).toBe(10)
  })

  it('one person, one film, one credit — a double writing credit does not double-count', () => {
    const entries = [
      entry(1, { rating: 9, crew: [['Screenplay', 'Crichton'], ['Novel', 'Crichton']] }),
      entry(2, { rating: 9, crew: [['Screenplay', 'Crichton']] }),
      entry(3, { rating: 9, crew: [['Screenplay', 'Rival']] }),
      entry(4, { rating: 9, crew: [['Screenplay', 'Rival']] })
    ]
    const writer = decadeChampionship(entries, ratingOf, undefined, 1990).crew.find((c) => c.key === 'writer')
    const crichton = writer.ranked.find((p) => p.name === 'Crichton')
    const rival = writer.ranked.find((p) => p.name === 'Rival')
    expect(crichton.count).toBe(2)
    expect(crichton.score).toBe(rival.score)
  })

  it('ranks performers gender-agnostically with billing shrinking confidence, not rating', () => {
    // Support is billed tenth on every film; the fillers between have one
    // film each and never qualify.
    const fillers = (n) => Array.from({ length: 9 }, (_, i) => `Extra ${n}-${i}`)
    const entries = [
      entry(1, { rating: 9, cast: ['Lead', ...fillers(1), 'Support'] }),
      entry(2, { rating: 9, cast: ['Lead', ...fillers(2), 'Support'] }),
      entry(3, { rating: 9, cast: ['Lead', ...fillers(3), 'Support'] }),
      ...Array.from({ length: 10 }, (_, i) => entry(100 + i, { rating: 6 }))
    ]
    const { performers } = decadeChampionship(entries, ratingOf, undefined, 1990)
    expect(names(performers)).toEqual(['Lead', 'Support'])
    expect(performers[0].billings).toEqual([0, 0, 0])
    expect(performers[1].billings).toEqual([10, 10, 10])
    // Same films, same ratings: only confidence differs, so the lead wins
    // but the gap is small.
    expect(performers[0].score).toBeGreaterThan(performers[1].score)
    expect(performers[0].score - performers[1].score).toBeLessThan(0.5)
  })

  it('returns full ranked people lists, and films to the unfold depth', () => {
    const entries = [
      ...Array.from({ length: 5 }, (_, i) => entry(20 + i, { rating: 7 + i * 0.2, crew: [['Director', `D${i}`], ['Director', 'Prolific']] })),
      ...Array.from({ length: 5 }, (_, i) => entry(30 + i, { rating: 8, crew: [['Director', 'Also Prolific']] }))
    ]
    const result = decadeChampionship(entries, ratingOf, undefined, 1990)
    // Films are trimmed to `depth` (8 of 10 here); people lists are not.
    expect(result.films).toHaveLength(8)
    expect(names(result.crew.find((c) => c.key === 'director').ranked)).toEqual(['Also Prolific', 'Prolific'])
  })

  it('has no producer, genre or studio category (cut 2026-09-02)', () => {
    const result = decadeChampionship([entry(1), entry(2)], ratingOf, undefined, 1990)
    expect(result.crew.map((c) => c.key)).toEqual(['director', 'writer', 'cinematographer', 'composer', 'editor'])
    expect(result.groups).toBeUndefined()
  })

  it('equal scores rank by film count, then by name, so order is stable', () => {
    const entries = [
      entry(1, { rating: 8, crew: [['Editor', 'Zed'], ['Editor', 'Amy']] }),
      entry(2, { rating: 8, crew: [['Editor', 'Zed'], ['Editor', 'Amy']] })
    ]
    const editor = decadeChampionship(entries, ratingOf, undefined, 1990).crew.find((c) => c.key === 'editor')
    expect(names(editor.ranked)).toEqual(['Amy', 'Zed'])
  })

  it('an empty decade yields empty podiums rather than throwing', () => {
    const result = decadeChampionship([entry(1, { release: '1994-01-01' })], ratingOf, undefined, 1950)
    expect(result.filmCount).toBe(0)
    expect(result.films).toEqual([])
    expect(result.performers).toEqual([])
    result.crew.forEach((c) => expect(c.ranked).toEqual([]))
  })
})

import { describe, it, expect } from 'vitest'
import {
  makeListId,
  sanitizeListName,
  normalizeLists,
  itemCount,
  listContains,
  nextOrder,
  resolveListEntries,
  listStats,
  reorderUpdates
} from '@/assets/javascript/customLists.js'

function entry (tmdbId, title, rating, year = 2000) {
  return {
    dbKey: `k${tmdbId}`,
    movie: { id: tmdbId, title, release_date: `${year}-06-15`, poster_path: `/${tmdbId}.jpg` },
    ratings: [{ calculatedTotal: rating }]
  }
}
const ratingOf = (e) => ({ calculatedTotal: e.ratings[0].calculatedTotal })

describe('makeListId', () => {
  it('slugifies and avoids collisions', () => {
    expect(makeListId('Comfort Watches')).toBe('comfort-watches')
    expect(makeListId('Comfort Watches', ['comfort-watches'])).toBe('comfort-watches-2')
    expect(makeListId('Comfort Watches', ['comfort-watches', 'comfort-watches-2'])).toBe('comfort-watches-3')
  })

  it('never produces a key Firebase rejects', () => {
    const id = makeListId('Best of . $ # [ ] / 2020!')
    expect(id).not.toMatch(/[.$#[\]/]/)
    expect(id.length).toBeGreaterThan(0)
  })

  it('falls back to a usable id when the name has no usable characters', () => {
    expect(makeListId('...')).toBe('list')
    expect(makeListId('')).toBe('list')
  })
})

describe('sanitizeListName', () => {
  it('trims, collapses whitespace, and caps length', () => {
    expect(sanitizeListName('  Comfort   Watches ')).toBe('Comfort Watches')
    expect(sanitizeListName('x'.repeat(200)).length).toBe(60)
  })
})

describe('normalizeLists', () => {
  it('maps settings into an array sorted by most recently touched', () => {
    const lists = normalizeLists({
      old: { name: 'Old', updatedAt: 100, items: {} },
      fresh: { name: 'Fresh', updatedAt: 900, items: { 1: { at: 1 } } }
    })
    expect(lists.map((l) => l.id)).toEqual(['fresh', 'old'])
    expect(itemCount(lists[0])).toBe(1)
  })

  it('survives junk: missing fields, bad sort modes, null entries', () => {
    const lists = normalizeLists({ a: null, b: { sortMode: 'nonsense' }, c: 'not an object' })
    expect(lists.length).toBe(1)
    expect(lists[0].sortMode).toBe('manual')
    expect(lists[0].name).toBe('b')
    expect(itemCount(lists[0])).toBe(0)
  })

  it('handles a missing customLists branch entirely', () => {
    expect(normalizeLists(undefined)).toEqual([])
  })
})

describe('listContains / nextOrder', () => {
  const list = { items: { 10: { at: 1, order: 0 }, 20: { at: 2, order: 3 } } }

  it('matches ids whether given a number or a string', () => {
    expect(listContains(list, 10)).toBe(true)
    expect(listContains(list, '20')).toBe(true)
    expect(listContains(list, 999)).toBe(false)
    expect(listContains(list, null)).toBe(false)
  })

  it('nextOrder lands past the current maximum', () => {
    expect(nextOrder(list)).toBe(4)
    expect(nextOrder({ items: {} })).toBe(0)
  })
})

describe('resolveListEntries', () => {
  const library = [
    entry(1, 'Beta', 7, 1990),
    entry(2, 'Alpha', 9, 2020),
    entry(3, 'Gamma', 5, 2005)
  ]
  const list = {
    sortMode: 'manual',
    items: {
      1: { at: 300, order: 2 },
      2: { at: 100, order: 0 },
      3: { at: 200, order: 1 }
    }
  }

  it('orders by each sort mode', () => {
    const titles = (mode) => resolveListEntries(list, library, ratingOf, { sortMode: mode })
      .rows.map((r) => r.entry.movie.title)

    expect(titles('manual')).toEqual(['Alpha', 'Gamma', 'Beta'])
    expect(titles('added')).toEqual(['Beta', 'Gamma', 'Alpha'])
    expect(titles('rating')).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(titles('release')).toEqual(['Alpha', 'Gamma', 'Beta'])
    expect(titles('title')).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('drops movies no longer in the library and counts them', () => {
    const withGhost = { ...list, items: { ...list.items, 999: { at: 400, order: 9 } } }
    const { rows, missing } = resolveListEntries(withGhost, library, ratingOf)
    expect(rows.length).toBe(3)
    expect(missing).toBe(1)
  })

  it('uses the list\'s own sortMode when no override is given', () => {
    const byRating = resolveListEntries({ ...list, sortMode: 'rating' }, library, ratingOf)
    expect(byRating.rows[0].entry.movie.title).toBe('Alpha')
  })
})

describe('listStats', () => {
  it('summarises count, average, and the release-year span', () => {
    const { rows } = resolveListEntries(
      { items: { 1: { at: 1, order: 0 }, 2: { at: 2, order: 1 } } },
      [entry(1, 'Beta', 7, 1990), entry(2, 'Alpha', 9, 2020)],
      ratingOf
    )
    const stats = listStats(rows)
    expect(stats.count).toBe(2)
    expect(stats.average).toBe(8)
    expect(stats.earliest).toBe(1990)
    expect(stats.latest).toBe(2020)
  })

  it('an empty list has no average rather than a zero', () => {
    expect(listStats([]).average).toBeNull()
    expect(listStats([]).count).toBe(0)
  })
})

describe('reorderUpdates', () => {
  const rows = [
    { tmdbId: '2', order: 0 },
    { tmdbId: '3', order: 1 },
    { tmdbId: '1', order: 2 }
  ]

  it('swaps a row with its neighbour and returns only changed orders', () => {
    expect(reorderUpdates(rows, '3', 'up')).toEqual({ 3: 0, 2: 1 })
    expect(reorderUpdates(rows, '3', 'down')).toEqual({ 1: 1, 3: 2 })
  })

  it('is a no-op at the boundaries or for an unknown id', () => {
    expect(reorderUpdates(rows, '2', 'up')).toEqual({})
    expect(reorderUpdates(rows, '1', 'down')).toEqual({})
    expect(reorderUpdates(rows, 'nope', 'up')).toEqual({})
  })
})

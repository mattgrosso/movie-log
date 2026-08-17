import { describe, it, expect } from 'vitest'
import {
  pendingUpdates,
  reconcilePending,
  sourceScore,
  globalHitRate,
  rankSections,
  sourceSummary,
  PENDING_EXPIRY_DAYS
} from '@/assets/javascript/recommendationStats.js'

const NOW = Date.UTC(2026, 7, 16)
const daysAgo = (n) => NOW - n * 24 * 60 * 60 * 1000

describe('pendingUpdates', () => {
  it('records only suggestions it has never seen before', () => {
    const existing = { 10: { source: 'gems', at: daysAgo(3) } }
    const updates = pendingUpdates(existing, { directors: [10, 11], gems: [12] }, NOW)

    expect(Object.keys(updates).sort()).toEqual(['11', '12'])
    expect(updates['11']).toEqual({ source: 'directors', at: NOW })
  })

  it('gives credit to the first source that suggested a movie', () => {
    // Same movie offered by two sections in one render.
    const updates = pendingUpdates({}, { directors: [7], similar: [7] }, NOW)
    expect(updates['7'].source).toBe('directors')
  })

  it('writes nothing when there is nothing new', () => {
    expect(pendingUpdates({ 5: { source: 'gems', at: NOW } }, { gems: [5] }, NOW)).toEqual({})
    expect(pendingUpdates({}, {}, NOW)).toEqual({})
  })
})

describe('reconcilePending', () => {
  const pending = {
    100: { source: 'directors', at: daysAgo(10) },
    200: { source: 'directors', at: daysAgo(20) },
    300: { source: 'gems', at: daysAgo(5) },
    400: { source: 'gems', at: daysAgo(PENDING_EXPIRY_DAYS + 5) }
  }

  it('credits the suggesting source for movies now in the library', () => {
    const { hits, resolved } = reconcilePending(pending, [100, 200, 300], NOW)
    expect(hits).toEqual({ directors: 2, gems: 1 })
    expect(resolved.sort()).toEqual(['100', '200', '300'])
  })

  it('forgets stale suggestions rather than counting them against a source', () => {
    const { hits, expired } = reconcilePending(pending, [], NOW)
    expect(hits).toEqual({})
    expect(expired).toEqual(['400'])   // only the one past the expiry window
  })

  it('drops malformed records', () => {
    const { expired } = reconcilePending({ 1: null, 2: { at: NOW } }, [], NOW)
    expect(expired.sort()).toEqual(['1', '2'])
  })

  // The one real caller passes a Set: WatchlistScreen builds its rated ids
  // with discover.js's ratedTmdbIds(), which returns a Set because every
  // other consumer wants .has(). Every test above passes an array, which is
  // why `(ratedTmdbIds || []).map(...)` throwing on a Set was never caught —
  // it took down the whole learning loop on every visit after the first.
  it('accepts the Set its only caller actually passes', () => {
    const { hits, resolved } = reconcilePending(pending, new Set([100, 200, 300]), NOW)

    expect(hits).toEqual({ directors: 2, gems: 1 })
    expect(resolved.sort()).toEqual(['100', '200', '300'])
  })

  it('still handles no rated ids at all, however they arrive', () => {
    expect(reconcilePending(pending, new Set(), NOW).hits).toEqual({})
    expect(reconcilePending(pending, null, NOW).hits).toEqual({})
    expect(reconcilePending(pending, undefined, NOW).hits).toEqual({})
  })
})

describe('sourceScore', () => {
  it('pulls a thin record toward the global rate', () => {
    const global = 0.2
    const perfectButThin = sourceScore({ suggested: 1, hits: 1 }, global)
    const goodAndDeep = sourceScore({ suggested: 30, hits: 12 }, global)

    expect(perfectButThin).toBeLessThan(goodAndDeep)   // 1-for-1 must not win
    expect(perfectButThin).toBeGreaterThan(global)     // …but it still helps
  })

  it('a source with no history sits exactly at the prior', () => {
    expect(sourceScore(undefined, 0.25)).toBe(0.25)
    expect(sourceScore({ suggested: 0, hits: 0 }, 0.25)).toBe(0.25)
  })

  it('globalHitRate totals across sources and survives an empty history', () => {
    expect(globalHitRate({ a: { suggested: 10, hits: 2 }, b: { suggested: 10, hits: 4 } })).toBe(0.3)
    expect(globalHitRate({})).toBe(0)
  })
})

describe('rankSections', () => {
  const sections = [
    { key: 'directors' },
    { key: 'actors' },
    { key: 'similar' },
    { key: 'gems' }
  ]

  it('promotes the source that actually earns watches', () => {
    const sources = {
      directors: { suggested: 40, hits: 2 },
      gems: { suggested: 40, hits: 20 }
    }
    const order = rankSections(sections, sources).map((s) => s.key)
    expect(order[0]).toBe('gems')
    expect(order.indexOf('gems')).toBeLessThan(order.indexOf('directors'))
  })

  it('keeps the original order when nothing has a record', () => {
    expect(rankSections(sections, {}).map((s) => s.key))
      .toEqual(['directors', 'actors', 'similar', 'gems'])
  })

  it('leaves an untried section at the prior rather than burying it', () => {
    const sources = { directors: { suggested: 40, hits: 1 } }   // demonstrably poor
    const order = rankSections(sections, sources).map((s) => s.key)
    expect(order.indexOf('actors')).toBeLessThan(order.indexOf('directors'))
  })
})

describe('sourceSummary', () => {
  it('reports a plain record for the UI, or nothing before there is one', () => {
    expect(sourceSummary({ suggested: 11, hits: 3 })).toEqual({ suggested: 11, hits: 3, rate: 27 })
    expect(sourceSummary({ suggested: 0, hits: 0 })).toBeNull()
    expect(sourceSummary(undefined)).toBeNull()
  })
})

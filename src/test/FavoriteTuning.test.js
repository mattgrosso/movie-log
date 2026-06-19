import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FavoriteDirectors from '@/components/FavoriteDirectors.vue'

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 8, normalizedRating: 8 }))
}))

// Build a director who appears in `count` films, each rated `score`.
function films(directorName, count, score, startId) {
  const out = []
  for (let i = 0; i < count; i++) {
    out.push({
      movie: {
        id: startId + i,
        title: `${directorName} Film ${i}`,
        crew: [{ job: 'Director', name: directorName }]
      },
      ratings: [{ calculatedTotal: score, direction: score }]
    })
  }
  return out
}

describe('FavoriteDirectors live tuning', () => {
  let wrapper
  let fetchSpy
  let dispatch
  let commit

  beforeEach(() => {
    // TMDB person lookup → no match, so knownForBonus is 0 and we isolate the
    // count/minEntries/confidence levers.
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
    global.fetch = fetchSpy

    dispatch = vi.fn()
    commit = vi.fn()

    const library = [
      ...films('Prolific Pat', 6, 8, 100),   // many films, good
      ...films('Solid Sam', 4, 8.5, 200),    // fewer films, slightly higher
      ...films('Rare Renee', 2, 10, 300)     // too few for default minEntries (4)
    ]

    wrapper = mount(FavoriteDirectors, {
      props: { allEntriesWithFlatKeywordsAdded: library },
      global: {
        mocks: {
          $store: {
            state: { settings: {} },
            commit,
            dispatch
          }
        },
        stubs: { FavoriteTuner: true }
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds a ranked list and excludes people below minEntries', async () => {
    await wrapper.vm.buildTopTwelveList()
    const names = wrapper.vm.topTenList.map(d => d.name)
    expect(names).toContain('Prolific Pat')
    expect(names).toContain('Solid Sam')
    // Rare Renee has only 2 films < default minEntries (4) → excluded.
    expect(names).not.toContain('Rare Renee')
  })

  it('re-tunes live: lowering minEntries surfaces Rare Renee and persists', async () => {
    await wrapper.vm.buildTopTwelveList()
    expect(wrapper.vm.topTenList.map(d => d.name)).not.toContain('Rare Renee')

    await wrapper.vm.onTunerUpdate({ key: 'minEntries', value: 2 })
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.topTenList.map(d => d.name)).toContain('Rare Renee')
    // Persisted to Firebase settings.
    expect(dispatch).toHaveBeenCalledWith('setDBValue', expect.objectContaining({
      path: 'settings/favoriteTuning/director',
      value: expect.objectContaining({ minEntries: 2 })
    }))
  })

  it('re-scoring on a lever change does NOT re-hit TMDB', async () => {
    await wrapper.vm.buildTopTwelveList()
    const callsAfterBuild = fetchSpy.mock.calls.length
    expect(callsAfterBuild).toBeGreaterThan(0) // fetched once during build

    // Changing a pure-scoring lever should reuse cached details (no new fetches).
    await wrapper.vm.onTunerUpdate({ key: 'countWeight', value: 1.5 })
    await wrapper.vm.$nextTick()
    expect(fetchSpy.mock.calls.length).toBe(callsAfterBuild)
  })

  it('countWeight rewards volume: raising it lifts the more prolific director', async () => {
    await wrapper.vm.buildTopTwelveList()

    await wrapper.vm.onTunerUpdate({ key: 'countWeight', value: 0 })
    await wrapper.vm.$nextTick()
    const patNoVolume = wrapper.vm.topTenList.findIndex(d => d.name === 'Prolific Pat')
    const samNoVolume = wrapper.vm.topTenList.findIndex(d => d.name === 'Solid Sam')
    // With no volume boost, higher-rated Sam leads.
    expect(samNoVolume).toBeLessThan(patNoVolume)

    await wrapper.vm.onTunerUpdate({ key: 'countWeight', value: 2 })
    await wrapper.vm.$nextTick()
    const patHi = wrapper.vm.topTenList.findIndex(d => d.name === 'Prolific Pat')
    const samHi = wrapper.vm.topTenList.findIndex(d => d.name === 'Solid Sam')
    // With a strong volume boost, prolific Pat overtakes.
    expect(patHi).toBeLessThan(samHi)
  })

  it('resetTuner restores defaults and persists them', async () => {
    await wrapper.vm.buildTopTwelveList()
    await wrapper.vm.onTunerUpdate({ key: 'minEntries', value: 2 })
    expect(wrapper.vm.minEntries).toBe(2)

    await wrapper.vm.resetTuner()
    expect(wrapper.vm.minEntries).toBe(4) // default
    expect(dispatch).toHaveBeenLastCalledWith('setDBValue', expect.objectContaining({
      path: 'settings/favoriteTuning/director',
      value: expect.objectContaining({ minEntries: 4 })
    }))
  })
})

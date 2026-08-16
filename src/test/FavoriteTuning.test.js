import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FavoriteDirectors from '@/components/FavoriteDirectors.vue'

vi.mock('@/assets/javascript/GetRating.js', () => ({
  // The real getRating is store-backed; here it reads the fixture's own
  // rating so score-order assertions actually exercise the math.
  getRating: vi.fn((entry) => ({ calculatedTotal: entry?.ratings?.[0]?.calculatedTotal }))
}))

// Build a director who appears in `count` films, each rated `score`.
function films (directorName, count, score, startId) {
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
      ...films('Prolific Pat', 6, 8, 100), // many films, good
      ...films('Solid Sam', 4, 8.5, 200), // fewer films, slightly higher
      ...films('Rare Renee', 2, 9, 300), // too few for default minEntries (4)
      ...films('Steady Stan', 4, 6.5, 500), // consistent, unspectacular
      // Peaky Petra: one masterpiece, three duds — the rank-weight case.
      {
        movie: { id: 600, title: 'Petra Peak', crew: [{ job: 'Director', name: 'Peaky Petra' }] },
        ratings: [{ calculatedTotal: 10 }]
      },
      ...films('Peaky Petra', 3, 4, 601),
      // Ballast so the library average sits at 6.05, well below the leaders.
      ...films('Background Bob', 8, 5, 400)
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
    expect(dispatch).toHaveBeenCalledWith('writeDurably', expect.objectContaining({
      path: 'settings/favoriteTuning/director',
      value: expect.objectContaining({ minEntries: 2 })
    }))
  })

  it('re-scoring on a lever change does NOT re-hit TMDB', async () => {
    await wrapper.vm.buildTopTwelveList()
    const callsAfterBuild = fetchSpy.mock.calls.length
    expect(callsAfterBuild).toBeGreaterThan(0) // fetched once during build

    // Changing a pure-scoring lever should reuse cached details (no new fetches).
    await wrapper.vm.onTunerUpdate({ key: 'rankWeight', value: 3 })
    await wrapper.vm.$nextTick()
    expect(fetchSpy.mock.calls.length).toBe(callsAfterBuild)
  })

  it('bayesianWeight (small-sample caution) drags a thin filmography down past a deeper one', async () => {
    await wrapper.vm.buildTopTwelveList()
    await wrapper.vm.onTunerUpdate({ key: 'minEntries', value: 1 })
    await wrapper.vm.onTunerUpdate({ key: 'bayesianWeight', value: 0 })
    await wrapper.vm.$nextTick()
    const names = () => wrapper.vm.topTenList.map(d => d.name)
    // No pull: Renee's two 9s beat Sam's four 8.5s outright.
    expect(names().indexOf('Rare Renee')).toBeLessThan(names().indexOf('Solid Sam'))

    await wrapper.vm.onTunerUpdate({ key: 'bayesianWeight', value: 15 })
    await wrapper.vm.$nextTick()
    // Heavy caution: two films can't escape the library-average pull; Sam overtakes.
    expect(names().indexOf('Solid Sam')).toBeLessThan(names().indexOf('Rare Renee'))
  })

  it('rankWeight (best-work emphasis) lets one masterpiece carry a spotty filmography', async () => {
    await wrapper.vm.buildTopTwelveList()
    await wrapper.vm.onTunerUpdate({ key: 'minEntries', value: 1 })
    await wrapper.vm.onTunerUpdate({ key: 'bayesianWeight', value: 0 })
    await wrapper.vm.onTunerUpdate({ key: 'rankWeight', value: 1 })
    await wrapper.vm.$nextTick()
    const names = () => wrapper.vm.topTenList.map(d => d.name)
    // Steep decline: Petra's 10 dominates her three 4s and beats steady 6.5s.
    expect(names().indexOf('Peaky Petra')).toBeLessThan(names().indexOf('Steady Stan'))

    await wrapper.vm.onTunerUpdate({ key: 'rankWeight', value: 15 })
    await wrapper.vm.$nextTick()
    // Near-flat weights: the duds count almost fully; Stan's consistency wins.
    expect(names().indexOf('Steady Stan')).toBeLessThan(names().indexOf('Peaky Petra'))
  })

  it('resetTuner restores defaults and persists them', async () => {
    await wrapper.vm.buildTopTwelveList()
    await wrapper.vm.onTunerUpdate({ key: 'minEntries', value: 2 })
    expect(wrapper.vm.minEntries).toBe(2)

    await wrapper.vm.resetTuner()
    expect(wrapper.vm.minEntries).toBe(4) // default
    expect(dispatch).toHaveBeenLastCalledWith('writeDurably', expect.objectContaining({
      path: 'settings/favoriteTuning/director',
      value: expect.objectContaining({ minEntries: 4 })
    }))
  })
})

import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import MovieDetail from '@/components/MovieDetail.vue'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} }))
  }
}))

vi.mock('@/assets/javascript/GetRating.js', () => ({
  // Keyed by movie id so the "current movie" vs "comparison movie" datasets
  // are distinguishable in assertions below. Any id not listed (e.g. the
  // "no rating yet" fixture) falls back to calculatedTotal: 0.
  getRating: vi.fn((entry) => {
    const byId = {
      42: { calculatedTotal: 8.5, direction: 8, imagery: 7, story: 9, performance: 6, soundtrack: 5, stickiness: 4, love: 3, overall: 8 },
      99: { calculatedTotal: 9.2, direction: 9, imagery: 9, story: 8, performance: 9, soundtrack: 7, stickiness: 5, love: 4, overall: 9 }
    }
    return byId[entry?.movie?.id] || { calculatedTotal: 0 }
  }),
  getAllRatings: vi.fn(() => [])
}))

vi.mock('@/services/ErrorLogService.js', () => ({ default: { error: vi.fn() } }))

function makeResult (overrides = {}) {
  return {
    dbKey: overrides.dbKey || 'abc123',
    movie: {
      id: 42,
      title: 'Current Movie',
      release_date: '2023-07-19',
      runtime: 180,
      poster_path: '/poster.jpg',
      genres: [],
      crew: [],
      ...overrides.movie
    },
    ratings: [{ calculatedTotal: 8.5, date: Date.now() }],
    ...overrides
  }
}

function mountMovieDetail (mediaEntries = []) {
  const mockStore = {
    state: { movieLog: {}, settings: { tags: { 'viewing-tags': {} } }, academyAwardWinners: {} },
    getters: { allMoviesAsArray: [], allMediaAsArray: mediaEntries },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  return shallowMount(MovieDetail, {
    global: {
      mocks: {
        $store: mockStore,
        $route: { params: { tmdbId: '42' }, query: {} },
        $router: { push: vi.fn() }
      },
      stubs: { ToggleableRating: true, Modal: true, RadarChart: true }
    }
  })
}

describe('MovieDetail - rating radar', () => {
  it('builds a single dataset (this movie only) when there is no comparison movie', async () => {
    const wrapper = mountMovieDetail()
    await wrapper.setData({ result: makeResult(), movie: makeResult().movie })

    expect(wrapper.vm.lastHigherRatedMovie).toBeFalsy()
    expect(wrapper.vm.ratingRadarData.labels).toEqual(['Direction', 'Imagery', 'Story', 'Performance', 'Soundtrack', 'Stickiness', 'Love', 'Overall'])
    expect(wrapper.vm.ratingRadarData.datasets).toHaveLength(1)
    expect(wrapper.vm.ratingRadarData.datasets[0].label).toBe('Current Movie')
    // love=3 -> 3+5=8, stickiness=4 -> 4*2=8, rest pass through unchanged
    expect(wrapper.vm.ratingRadarData.datasets[0].data).toEqual([8, 7, 9, 6, 5, 8, 8, 8])
  })

  it('adds a second dataset for the "Best since" comparison movie when one exists', async () => {
    const comparisonEntry = makeResult({ dbKey: 'cmp', movie: { id: 99, title: 'Earlier Better Movie', release_date: '2020-01-01' } })
    // lastHigherRatedMovie is derived from the store's media list, so it must
    // be present at mount time (see the Insights.vue computed-caching note
    // elsewhere in this test suite for why "mutate after mount" is unsafe).
    const wrapper = mountMovieDetail([makeResult(), comparisonEntry])
    await wrapper.setData({ result: makeResult(), movie: makeResult().movie })

    expect(wrapper.vm.lastHigherRatedMovie?.movie?.title).toBe('Earlier Better Movie')
    expect(wrapper.vm.ratingRadarData.datasets).toHaveLength(2)
    expect(wrapper.vm.ratingRadarData.datasets[1].label).toBe('Earlier Better Movie')
    // love=4 -> 4+5=9, stickiness=5 -> 5*2=10
    expect(wrapper.vm.ratingRadarData.datasets[1].data).toEqual([9, 9, 8, 9, 7, 10, 9, 9])
  })

  it('returns null when there is no rating yet to plot', async () => {
    const wrapper = mountMovieDetail()
    const unrated = makeResult({ dbKey: 'unrated', movie: { id: 7 } })
    await wrapper.setData({ result: unrated, movie: unrated.movie })
    expect(wrapper.vm.ratingRadarData).toBeNull()
  })

  it('the radar options fix the scale to 0-10 and hide the legend (custom legend used instead)', async () => {
    const wrapper = mountMovieDetail()
    await wrapper.setData({ result: makeResult(), movie: makeResult().movie })
    expect(wrapper.vm.ratingRadarOptions.scales.r.min).toBe(0)
    expect(wrapper.vm.ratingRadarOptions.scales.r.max).toBe(10)
    expect(wrapper.vm.ratingRadarOptions.plugins.legend.display).toBe(false)
  })
})

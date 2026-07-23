import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Home from '@/components/Home.vue'

vi.mock('axios', () => ({
  default: { get: vi.fn() }
}))

vi.mock('lodash/debounce', () => ({
  default: vi.fn((fn) => fn)
}))

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 8.25, normalizedRating: 8 })),
  getAllRatings: vi.fn(() => [])
}))

const mountHome = () => {
  const mockStore = {
    state: reactive({
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: { bestPicture: [] },
      settings: {
        normalizationTweak: 0.25,
        tieBreakTweak: 1,
        includeShorts: false,
        tags: { 'viewing-tags': {} }
      },
      filteredResults: [],
      homePageScrollPosition: 0,
      homePageSearchChips: [],
      homePageSearchValue: '',
      homePageNumberOfResults: 25,
      homePageNavigationIntent: null,
      homePageSortValue: null,
      homePageSortOrder: null,
      homePagePromoteGroup: null
    }),
    getters: {
      allMediaAsArray: [],
      allMoviesAsArray: [],
      allMediaSortedByRating: []
    },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  return mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: {
        DBGridLayoutSearchResult: true,
        NoResults: true,
        StickinessModal: true,
        TweakModal: true,
        InsetBrowserModal: true
      }
    }
  })
}

describe('no-results-for-TMDB-search message', () => {
  let wrapper

  beforeEach(() => {
    vi.useFakeTimers()
    wrapper = mountHome()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays visible indefinitely - no auto-revert timer', async () => {
    wrapper.vm.showNoResultsMessage()
    expect(wrapper.vm.noResults).toBe(true)

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000) // well past the old 30s timer

    expect(wrapper.vm.noResults).toBe(true)
  })

  it('clears via the explicit "Try Another Search" path (startNewSearch)', () => {
    wrapper.vm.showNoResultsMessage()
    expect(wrapper.vm.noResults).toBe(true)

    wrapper.vm.startNewSearch()

    expect(wrapper.vm.noResults).toBe(false)
  })

  it('clears as soon as the user types again, so it cannot get stuck showing a stale term', () => {
    wrapper.vm.showNoResultsMessage()
    expect(wrapper.vm.noResults).toBe(true)

    wrapper.vm.onInput({ target: { value: 'something new' } })

    expect(wrapper.vm.noResults).toBe(false)
  })
})

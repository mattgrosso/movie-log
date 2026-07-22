import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'
import { LAST_PLAYED_KEY } from '@/mixins/gameData.js'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }))
vi.mock('lodash/uniq', () => ({ default: vi.fn((arr) => [...new Set(arr)]) }))

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((media) => ({
    calculatedTotal: media?.ratings?.[0]?.calculatedTotal ?? 8,
    normalizedRating: 8,
    date: media?.ratings?.[0]?.date
  }))
}))

function entry (id, title) {
  return {
    movie: { id, title, backdrop_path: `/b${id}.jpg`, poster_path: `/p${id}.jpg`, flatKeywords: [] },
    ratings: [{ calculatedTotal: 9, date: Date.now() }],
    dbKey: `movie-${id}`
  }
}

function mountHome () {
  const movies = [entry(1, 'A'), entry(2, 'B')]
  const mockStore = {
    state: {
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: {},
      settings: { normalizationTweak: 0.25, tieBreakTweak: 1, includeShorts: false, tags: { 'viewing-tags': {} } },
      bannerUrl: null,
      bannerRequest: null,
      filteredResults: [],
      homePageScrollPosition: 0,
      homePageSearchChips: [],
      homePageSearchValue: '',
      homePageNumberOfResults: 25,
      homePageNavigationIntent: null,
      homePageSortValue: null,
      homePageSortOrder: null,
      homePagePromoteGroup: null
    },
    getters: { allMediaAsArray: movies, allMoviesAsArray: movies, allMediaSortedByRating: movies },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  const push = vi.fn()
  const wrapper = mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push } },
      stubs: {
        DBGridLayoutSearchResult: true, NoResults: true, StickinessModal: true,
        TweakModal: true, InsetBrowserModal: true
      }
    }
  })

  return { wrapper, mockStore, push }
}

describe('Home goToGames — resume last-played game (bug report)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('goes to the games hub when nothing has been played yet', () => {
    const { wrapper, push } = mountHome()
    wrapper.vm.goToGames()
    expect(push).toHaveBeenCalledWith('/games')
  })

  it('jumps straight to the last-played individual game instead of the hub', () => {
    window.localStorage.setItem(LAST_PLAYED_KEY, '/games/wordle')
    const { wrapper, push } = mountHome()
    wrapper.vm.goToGames()
    expect(push).toHaveBeenCalledWith('/games/wordle')
  })

  it('falls back to the hub if the stored value is not a real game route', () => {
    window.localStorage.setItem(LAST_PLAYED_KEY, '/games')
    const { wrapper, push } = mountHome()
    wrapper.vm.goToGames()
    expect(push).toHaveBeenCalledWith('/games')
  })
})

describe('Home beforeRouteLeave — preserve search when going to a game (bug report)', () => {
  it('saves search state when navigating to a /games route, same as navigating to MovieDetail', () => {
    const { wrapper, mockStore } = mountHome()
    wrapper.vm.inputValue = 'spielberg'
    wrapper.vm.activeFilters = [{ type: 'director', value: 'Spielberg', display: 'Spielberg' }]

    const next = vi.fn()
    wrapper.vm.$options.beforeRouteLeave.call(wrapper.vm, { path: '/games/wordle', name: 'ReelWordleGame' }, {}, next)

    expect(mockStore.commit).toHaveBeenCalledWith('setHomePageSearchValue', 'spielberg')
    expect(mockStore.commit).toHaveBeenCalledWith('setHomePageSearchChips', wrapper.vm.activeFilters)
    expect(next).toHaveBeenCalled()
  })

  it('still resets sorting (does not save search) when navigating elsewhere, e.g. RateMovie', () => {
    const { wrapper, mockStore } = mountHome()
    wrapper.vm.inputValue = 'spielberg'

    const next = vi.fn()
    wrapper.vm.$options.beforeRouteLeave.call(wrapper.vm, { path: '/rate-movie', name: 'RateMovie' }, {}, next)

    expect(mockStore.commit).not.toHaveBeenCalledWith('setHomePageSearchValue', 'spielberg')
    expect(next).toHaveBeenCalled()
  })
})

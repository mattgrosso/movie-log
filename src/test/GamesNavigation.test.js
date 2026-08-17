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

function mountHome (stateOverrides = {}) {
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
      homePagePromoteGroup: null,
      ...stateOverrides
    },
    getters: { allMediaAsArray: movies, allMoviesAsArray: movies, allMediaSortedByRating: movies },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  const push = vi.fn()
  // Mirrors the real router's getRoutes(), which is how a stored game path is
  // checked for still existing. Deliberately omits removed games like
  // /games/rate-off and /games/quiz — the reason the button could go dead.
  const getRoutes = vi.fn(() => [
    { path: '/' }, { path: '/games' },
    { path: '/games/wordle' }, { path: '/games/six-degrees' }, { path: '/games/trivia' }
  ])
  const wrapper = mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push, getRoutes } },
      stubs: {
        DBGridLayoutSearchResult: true, NoResults: true, StickinessModal: true,
        TweakModal: true, InsetBrowserModal: true
      }
    }
  })

  return { wrapper, mockStore, push, getRoutes }
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

  it('falls back to the hub when the stored game has since been removed', () => {
    // Rate-Off and Taste Quiz were both deleted. Pushing a route that no
    // longer exists rendered a blank page, so the button looked dead.
    window.localStorage.setItem(LAST_PLAYED_KEY, '/games/rate-off')
    const { wrapper, push } = mountHome()
    wrapper.vm.goToGames()
    expect(push).toHaveBeenCalledWith('/games')
  })

  it('clears the stale value so the button is not permanently dead', () => {
    // The key is only overwritten by successfully visiting another game —
    // which this button is how you would reach — so without clearing it, a
    // removed game would break the button forever.
    window.localStorage.setItem(LAST_PLAYED_KEY, '/games/rate-off')
    const { wrapper } = mountHome()
    wrapper.vm.goToGames()
    expect(window.localStorage.getItem(LAST_PLAYED_KEY)).toBeNull()
  })

  it('does not show a removed game\'s icon on the button', () => {
    window.localStorage.setItem(LAST_PLAYED_KEY, '/games/rate-off')
    const { wrapper } = mountHome()
    expect(wrapper.vm.gamesButtonIcon).toBe('bi-dice-5')
  })

  it('still shows the real last-played game\'s icon', () => {
    window.localStorage.setItem(LAST_PLAYED_KEY, '/games/wordle')
    const { wrapper } = mountHome()
    expect(wrapper.vm.gamesButtonIcon).toBe('bi-grid-3x3-gap-fill')
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

  // The round trip nobody was testing: leave Home with a search and a sort,
  // come back, and find both still there.
  it('restores the filters and sort a previous visit left behind', () => {
    const { wrapper: leaving, mockStore } = mountHome()
    leaving.vm.inputValue = 'spielberg'
    leaving.vm.sortValue = 'watched'
    leaving.vm.sortOrder = 'worstOrOldestOnTop'
    leaving.vm.activeFilters = [{ id: 'g1', type: 'genre', value: 'Drama', display: 'Drama' }]

    leaving.vm.$options.beforeRouteLeave.call(leaving.vm, { path: '/insights', name: 'Insights' }, {}, vi.fn());

    // Whatever it saved is what the next visit finds waiting.
    const saved = Object.fromEntries(
      mockStore.commit.mock.calls
        .filter(([name]) => name.startsWith('setHomePage'))
        .map(([name, value]) => [name, value])
    )
    expect(saved.setHomePageSortValue).toBe('watched')
    expect(saved.setHomePageSortOrder).toBe('worstOrOldestOnTop')
    expect(saved.setHomePageSearchValue).toBe('spielberg')
    expect(saved.setHomePageSearchChips).toHaveLength(1)

    // Coming back: Home mounts with that state and adopts it.
    const returning = mountHome({
      homePageSearchChips: saved.setHomePageSearchChips,
      homePageSearchValue: saved.setHomePageSearchValue,
      homePageSortValue: saved.setHomePageSortValue,
      homePageSortOrder: saved.setHomePageSortOrder
    })

    expect(returning.wrapper.vm.sortValue).toBe('watched')
    expect(returning.wrapper.vm.sortOrder).toBe('worstOrOldestOnTop')
    expect(returning.wrapper.vm.activeFilters).toHaveLength(1)
  })

  // Used to save for MovieDetail and /games only, and reset everywhere else.
  // Nothing about the destination explained the difference: popping over to
  // Wordle kept your search, popping over to the watchlist didn't. It saves
  // for every destination now (Matt, 2026-08-16).
  it('saves the search when navigating anywhere else too, e.g. RateMovie', () => {
    const { wrapper, mockStore } = mountHome()
    wrapper.vm.inputValue = 'spielberg'

    const next = vi.fn()
    wrapper.vm.$options.beforeRouteLeave.call(wrapper.vm, { path: '/rate-movie', name: 'RateMovie' }, {}, next)

    expect(mockStore.commit).toHaveBeenCalledWith('setHomePageSearchValue', 'spielberg')
    expect(next).toHaveBeenCalled()
  })
})

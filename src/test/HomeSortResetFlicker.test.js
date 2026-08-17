import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }))
vi.mock('lodash/uniq', () => ({ default: vi.fn((arr) => [...new Set(arr)]) }))
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 8, normalizedRating: 8 }))
}))

// Bug report (Matt): tapping any rainbow-bar button made "the whole bar...
// shift a little bit to the right... the icon for the sort order is
// disappearing for just a half a beat right before we navigate."
// beforeRouteLeave's non-detail branch used to null the LIVE sortValue,
// unmounting the sort icon's v-if for one frame pre-navigation. The reset
// must touch only the store (for the next Home visit), never the visible
// component.

function factory () {
  const movies = [
    { movie: { id: 1, title: 'M', flatKeywords: [], poster_path: '/p.jpg' }, ratings: [{ calculatedTotal: 9, date: Date.now() }], dbKey: 'k1' }
  ]
  const mockStore = {
    state: {
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: {},
      settings: { normalizationTweak: 0.25, tieBreakTweak: 1, includeShorts: false, tags: { 'viewing-tags': {} } },
      bannerUrl: null, bannerRequest: null, filteredResults: [],
      homePageScrollPosition: 0, homePageSearchChips: [], homePageSearchValue: '',
      homePageNumberOfResults: 25, homePageNavigationIntent: null,
      homePageSortValue: null, homePageSortOrder: null, homePagePromoteGroup: null
    },
    getters: { allMediaAsArray: movies, allMoviesAsArray: movies, allMediaSortedByRating: movies },
    commit: vi.fn(),
    dispatch: vi.fn()
  }
  const wrapper = mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: {
        DBGridLayoutSearchResult: true, NoResults: true, StickinessModal: true,
        TweakModal: true, InsetBrowserModal: true, PersonalAwardsModal: true,
        RatingCurveSettings: true
      }
    }
  })
  return { wrapper, mockStore }
}

describe('rainbow bar sort icon stays put during navigation', () => {
  // Leaving used to RESET the sort for anywhere that wasn't a movie or a
  // game. It saves it now (Matt, 2026-08-16: "we need to maintain sort order
  // and filters when we come back to the home page") — but the flicker rule
  // this file exists for still holds: the live component is never touched.
  it('leaving to a non-detail page saves sort in the STORE only — live state untouched', () => {
    const { wrapper, mockStore } = factory()
    wrapper.vm.sortValue = 'watched'
    wrapper.vm.sortOrder = 'worstOrOldestOnTop'

    const next = vi.fn()
    Home.beforeRouteLeave.call(wrapper.vm, { name: 'Insights', path: '/insights' }, { path: '/' }, next)

    // The one-frame flicker was exactly this mutating to null:
    expect(wrapper.vm.sortValue).toBe('watched')
    expect(wrapper.vm.sortOrder).toBe('worstOrOldestOnTop')
    // And the sort is kept for the trip back, rather than thrown away:
    expect(mockStore.commit).toHaveBeenCalledWith('setHomePageSortValue', 'watched')
    expect(mockStore.commit).toHaveBeenCalledWith('setHomePageSortOrder', 'worstOrOldestOnTop')
    expect(next).toHaveBeenCalled()
  })

  it('leaving to MovieDetail still saves live state for the return trip', () => {
    const { wrapper, mockStore } = factory()
    wrapper.vm.sortValue = 'watched'

    const next = vi.fn()
    Home.beforeRouteLeave.call(wrapper.vm, { name: 'MovieDetail', path: '/movie/1' }, { path: '/' }, next)

    expect(mockStore.commit).toHaveBeenCalledWith('setHomePageSortValue', 'watched')
    expect(wrapper.vm.sortValue).toBe('watched')
    expect(next).toHaveBeenCalled()
  })
})

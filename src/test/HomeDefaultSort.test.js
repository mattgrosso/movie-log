import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }))
vi.mock('lodash/uniq', () => ({ default: vi.fn((arr) => [...new Set(arr)]) }))
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 8, normalizedRating: 8 }))
}))

// Report -P-HHWRf-WATy1lEwdYP: "We set up the default viewing order for the
// homepage, but it doesn't seem to be respected. I chose to have it be based
// on recent watch, but it's still showing me in order by rating."
//
// mounted() reads settings.defaultSort, but settings arrive from Firebase
// AFTER mount — so it read the 'rating' fallback and never looked again.

function factory ({ settings = {}, DBSortValue = null } = {}) {
  const movies = [
    { movie: { id: 1, title: 'M', flatKeywords: [], poster_path: '/p.jpg' }, ratings: [{ calculatedTotal: 9, date: Date.now() }], dbKey: 'k1' }
  ]
  const mockStore = {
    // Reactive on purpose: this file is about a computed re-evaluating when
    // settings land late, which a plain object could never demonstrate.
    state: reactive({
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue,
      academyAwardWinners: {},
      settings: { normalizationTweak: 0.25, tieBreakTweak: 1, includeShorts: false, tags: { 'viewing-tags': {} }, ...settings },
      bannerUrl: null, bannerRequest: null, filteredResults: [],
      homePageScrollPosition: 0, homePageSearchChips: [], homePageSearchValue: '',
      homePageNumberOfResults: 25, homePageNavigationIntent: null,
      homePageSortValue: null, homePageSortOrder: null, homePagePromoteGroup: null
    }),
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

describe('the saved default sort is honoured even though settings load late', () => {
  it('applies the saved default when settings arrive after mount', async () => {
    // Mount with settings not yet loaded: the old code locked in 'rating'.
    const { wrapper } = factory()
    expect(wrapper.vm.sortValue).toBe('rating')

    // Firebase answers a moment later with the real choice.
    wrapper.vm.$store.state.settings.defaultSort = { value: 'watched', order: 'bestOrNewestOnTop' }
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.sortValue).toBe('watched')
  })

  it('picks up a late default ORDER as well as a late value', async () => {
    const { wrapper } = factory()

    wrapper.vm.$store.state.settings.defaultSort = { value: 'rating', order: 'worstOrOldestOnTop' }
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.sortOrder).toBe('worstOrOldestOnTop')
  })

  it('never overrides a sort the session already chose', async () => {
    // DBSortValue set means this session picked a sort explicitly; a late
    // default must not yank the view out from under it.
    const { wrapper } = factory({ DBSortValue: 'release' })
    expect(wrapper.vm.sortValue).toBe('release')

    wrapper.vm.$store.state.settings.defaultSort = { value: 'watched', order: 'bestOrNewestOnTop' }
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.sortValue).toBe('release')
  })

  it('leaves a sort chosen AFTER mount alone', async () => {
    const { wrapper } = factory()

    // The user sorts by hand, which is what setting DBSortValue represents.
    wrapper.vm.$store.state.DBSortValue = 'release'
    wrapper.vm.setSortValue('release')
    await wrapper.vm.$nextTick()

    wrapper.vm.$store.state.settings.defaultSort = { value: 'watched', order: 'bestOrNewestOnTop' }
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.sortValue).toBe('release')
  })

  it('ignores an empty default rather than blanking the sort', async () => {
    const { wrapper } = factory()

    wrapper.vm.$store.state.settings.defaultSort = { value: '', order: '' }
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.sortValue).toBe('rating')
  })
})

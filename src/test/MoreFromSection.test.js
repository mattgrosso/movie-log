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

// Report -P-HV1bfduJBFvmSGM-b: "At the bottom of our filtered results we
// have a 'more from…' section. I've never been that pleased with how that
// section was built but I like the concept. Let's bring that section into
// our modern styles and make it possible to add movies from there to a hat."

function factory () {
  const movies = [
    { movie: { id: 1, title: 'M', flatKeywords: [], poster_path: '/p.jpg' }, ratings: [{ calculatedTotal: 9, date: Date.now() }], dbKey: 'k1' }
  ]
  const mockStore = {
    state: reactive({
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: {},
      settings: { normalizationTweak: 0.25, tieBreakTweak: 1, includeShorts: false, tags: { 'viewing-tags': {} } },
      movieHatMovieIds: {},
      bannerUrl: null, bannerRequest: null, filteredResults: [],
      homePageScrollPosition: 0, homePageSearchChips: [], homePageSearchValue: '',
      homePageNumberOfResults: 25, homePageNavigationIntent: null,
      homePageSortValue: null, homePageSortOrder: null, homePagePromoteGroup: null
    }),
    getters: { allMediaAsArray: movies, allMoviesAsArray: movies, allMediaSortedByRating: movies, linkedMovieHats: [] },
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
  return { wrapper }
}

describe('"More from…" heading', () => {
  it('names the person, company, or year it is showing more from', async () => {
    const { wrapper } = factory()
    wrapper.vm.unratedMoviesSearchType = 'person'
    await wrapper.vm.$nextTick()

    // effectiveSearchTerm is derived from the active filters; stub it so
    // this test is about the heading and nothing else.
    Object.defineProperty(wrapper.vm, 'effectiveSearchTerm', { get: () => 'Sofia Coppola', configurable: true })
    expect(wrapper.vm.moreFromTitle).toBe('More from Sofia Coppola')
  })

  it('lowercases a genre, which reads as a sentence rather than a label', () => {
    const { wrapper } = factory()
    wrapper.vm.unratedMoviesSearchType = 'genre'
    Object.defineProperty(wrapper.vm, 'effectiveSearchTerm', { get: () => 'Horror', configurable: true })

    expect(wrapper.vm.moreFromTitle).toBe('More horror movies')
  })

  it('says "this time period" for a year range, which has no name to use', () => {
    const { wrapper } = factory()
    wrapper.vm.unratedMoviesSearchType = 'yearRange'

    expect(wrapper.vm.moreFromTitle).toBe('More from this time period')
  })

  it('quotes a plain search rather than claiming it is a person', () => {
    const { wrapper } = factory()
    wrapper.vm.unratedMoviesSearchType = 'search'
    Object.defineProperty(wrapper.vm, 'effectiveSearchTerm', { get: () => 'spiderman', configurable: true })

    expect(wrapper.vm.moreFromTitle).toBe('Movies matching “spiderman”')
  })
})

describe('sending one of these to a hat', () => {
  it('writes where it came from, so a draw months later can say', () => {
    const { wrapper } = factory()
    Object.defineProperty(wrapper.vm, 'effectiveSearchTerm', { get: () => 'Sofia Coppola', configurable: true })

    expect(wrapper.vm.moreFromHatNote).toBe('Found under Sofia Coppola')
  })

  it('falls back to naming the app when there is no search term', () => {
    const { wrapper } = factory()
    Object.defineProperty(wrapper.vm, 'effectiveSearchTerm', { get: () => '', configurable: true })

    expect(wrapper.vm.moreFromHatNote).toBe('Found in Cinema Roll')
  })
})


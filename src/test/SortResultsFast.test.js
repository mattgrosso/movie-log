import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Home from '@/components/Home.vue'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }))

// getRating must return DIFFERENT values per movie so sorts are meaningful and
// the fast/slow paths can actually diverge if the logic is wrong. We derive a
// stable per-movie rating from its id.
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((media) => {
    const id = media?.movie?.id ?? 0
    // Deliberate ties: movies 3 and 4 share a calculatedTotal so the secondary
    // tiebreak path is exercised.
    const totals = { 1: 9.5, 2: 8.0, 3: 7.0, 4: 7.0, 5: 6.5 }
    return {
      calculatedTotal: totals[id] ?? id,
      normalizedRating: 8,
      date: `2023-0${id}-01`,
      love: id,
      story: 10 - id
    }
  }),
  getAllRatings: vi.fn(() => [])
}))

const makeMovies = () => ([1, 2, 3, 4, 5].map((id) => ({
  movie: {
    id,
    title: `Movie ${String.fromCharCode(90 - id)}`, // titles in reverse id order
    release_date: `20${10 + id}-01-01`,
    genres: [],
    cast: [],
    crew: [],
    production_companies: [],
    keywords: []
  },
  ratings: [{ calculatedTotal: 0, date: `2023-0${id}-01` }],
  dbKey: `movie-${id}`
})))

const mountHome = () => {
  const mockMovies = makeMovies()
  const mockStore = {
    state: reactive({
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: { bestPicture: [] },
      settings: { normalizationTweak: 0.25, tieBreakTweak: 1, includeShorts: false, tags: { 'viewing-tags': {} } },
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
      allMediaAsArray: mockMovies,
      allMoviesAsArray: mockMovies,
      allMediaSortedByRating: mockMovies
    },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  const wrapper = mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: {
        DBGridLayoutSearchResult: { template: '<div/>', props: ['result', 'keywordCounts', 'allCounts', 'index', 'resultsAreFiltered', 'sortValue', 'activeQuickLinkList'] },
        NoResults: true,
        StickinessModal: true,
        TweakModal: true,
        InsetBrowserModal: true
      }
    }
  })
  return { wrapper, mockMovies }
}

describe('sortResultsFast produces identical ordering to sortResults', () => {
  let wrapper
  let mockMovies

  beforeEach(() => {
    ({ wrapper, mockMovies } = mountHome())
  })

  const sortKeys = ['rating', 'release', 'title', 'watched', 'views', 'love', 'story']
  const sortOrders = ['bestOrNewestOnTop', 'worstOnTop']

  sortKeys.forEach((key) => {
    sortOrders.forEach((order) => {
      it(`matches the legacy comparator for sortValue="${key}" sortOrder="${order}"`, () => {
        wrapper.vm.sortValue = key
        wrapper.vm.sortOrder = order

        const legacy = [...mockMovies].sort(wrapper.vm.sortResults).map(m => m.movie.id)
        const fast = wrapper.vm.sortResultsFast(mockMovies).map(m => m.movie.id)

        expect(fast).toEqual(legacy)
      })
    })
  })

  it('does not mutate the input array', () => {
    const before = mockMovies.map(m => m.movie.id)
    wrapper.vm.sortResultsFast(mockMovies)
    const after = mockMovies.map(m => m.movie.id)
    expect(after).toEqual(before)
  })

  it('preserves stable order for tied items (movies 3 and 4 share a rating)', () => {
    wrapper.vm.sortValue = 'rating'
    wrapper.vm.sortOrder = 'bestOrNewestOnTop'
    const fast = wrapper.vm.sortResultsFast(mockMovies).map(m => m.movie.id)
    const legacy = [...mockMovies].sort(wrapper.vm.sortResults).map(m => m.movie.id)
    // Whatever the legacy order of the 3/4 tie is, fast must match it exactly.
    expect(fast).toEqual(legacy)
  })
})

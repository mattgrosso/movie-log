import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Home from '@/components/Home.vue'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }))
vi.mock('lodash/uniq', () => ({ default: vi.fn((arr) => [...new Set(arr)]) }))
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((m) => ({ calculatedTotal: m?.ratings?.[0]?.calculatedTotal ?? 8, normalizedRating: 8, date: m?.ratings?.[0]?.date })),
  getAllRatings: vi.fn(() => [])
}))

// Library: three movies released in 2010, plus year-like keywords ("2010s",
// "2015") that WOULD fuzzy-match "2010" — so if the year chip is dropped, the
// "Did you mean?" suggestions fire (the reported bug).
const makeMovies = () => ([
  {
    movie: {
      id: 1, title: 'Inception', release_date: '2010-07-16',
      genres: [{ name: 'Sci-Fi' }], cast: [], crew: [],
      production_companies: [], keywords: [{ name: '2010s' }, { name: 'dream' }]
    },
    ratings: [{ calculatedTotal: 9.4, date: '2023-01-01' }], dbKey: 'm-1'
  },
  {
    movie: {
      id: 2, title: 'The Social Network', release_date: '2010-10-01',
      genres: [{ name: 'Drama' }], cast: [], crew: [],
      production_companies: [], keywords: [{ name: '2010s' }]
    },
    ratings: [{ calculatedTotal: 9.0, date: '2023-02-01' }], dbKey: 'm-2'
  },
  {
    movie: {
      id: 3, title: 'Black Swan', release_date: '2010-12-03',
      genres: [{ name: 'Thriller' }], cast: [], crew: [],
      production_companies: [], keywords: [{ name: '2015' }]
    },
    ratings: [{ calculatedTotal: 8.6, date: '2023-03-01' }], dbKey: 'm-3'
  },
  {
    movie: {
      id: 4, title: 'Arrival', release_date: '2016-11-11',
      genres: [{ name: 'Sci-Fi' }], cast: [], crew: [],
      production_companies: [], keywords: [{ name: 'aliens' }]
    },
    ratings: [{ calculatedTotal: 9.1, date: '2023-04-01' }], dbKey: 'm-4'
  }
])

function mountHome () {
  const movies = makeMovies()
  const mockStore = {
    state: reactive({
      dbLoaded: true, databaseTopKey: 'test-user', currentLog: 'movieLog',
      DBSearchValue: '', DBSortValue: 'rating', academyAwardWinners: {},
      settings: { normalizationTweak: 0.25, tieBreakTweak: 1, includeShorts: false, tags: { 'viewing-tags': {} } },
      bannerUrl: null, bannerRequest: null, filteredResults: [],
      homePageScrollPosition: 0, homePageSearchChips: [], homePageSearchValue: '',
      homePageNumberOfResults: 25, homePageNavigationIntent: null,
      homePageSortValue: null, homePageSortOrder: null, homePagePromoteGroup: null
    }),
    getters: { allMediaAsArray: movies, allMoviesAsArray: movies, allMediaSortedByRating: movies },
    commit: vi.fn(), dispatch: vi.fn()
  }
  const wrapper = mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: { DBGridLayoutSearchResult: true, NoResults: true, StickinessModal: true, TweakModal: true, InsetBrowserModal: true }
    }
  })
  return { wrapper, movies }
}

describe('Typing a year then blurring (the "2010" bug)', () => {
  let wrapper

  beforeEach(() => {
    ({ wrapper } = mountHome())
  })

  it('shows the year results while typing (via the temp year chip)', async () => {
    wrapper.vm.overwriteCurrentlyTypingSearchFilter('2010')
    wrapper.vm.inputValue = '2010'
    wrapper.vm.setSearchValue('2010')
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.paginatedSortedResults.length).toBe(3) // the three 2010 movies
    expect(wrapper.vm.didYouMeanSuggestions).toEqual([])
  })

  it('commits a permanent year chip on blur — results persist, no suggestions', async () => {
    // Type "2010" (creates the temp year chip).
    wrapper.vm.overwriteCurrentlyTypingSearchFilter('2010')
    wrapper.vm.inputValue = '2010'
    wrapper.vm.setSearchValue('2010')
    await wrapper.vm.$nextTick()

    // Blur the input.
    wrapper.vm.convertSearchToChip()
    await wrapper.vm.$nextTick()

    // A permanent (non-temp) year chip should exist...
    const yearChip = wrapper.vm.activeFilters.find((f) => f.type === 'year' && !f.temp)
    expect(yearChip).toBeTruthy()
    expect(yearChip.value).toBe('2010')

    // ...results persist, and suggestions stay hidden.
    expect(wrapper.vm.paginatedSortedResults.length).toBe(3)
    expect(wrapper.vm.didYouMeanSuggestions).toEqual([])
  })
})

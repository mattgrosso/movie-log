import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Home from '@/components/Home.vue'

// Places (2026-09-08). Matt: "I just think it would be fun to be able to see
// what movies are set where." On Home that means three things: typing
// "Paris" gets its own section, the Add Filter menu offers places, and a
// place chip matches the whole name only.

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }))
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 8.25, normalizedRating: 8 })),
  getAllRatings: vi.fn(() => [])
}))

const paris = (type) => ({ name: 'Paris', lat: 48.85, lon: 2.35, type, id: 'Q90' })

const makeMovies = () => ([
  {
    movie: {
      id: 1, title: 'Amélie', release_date: '2001-04-25', runtime: 122,
      genres: [{ name: 'Comedy' }], cast: [], crew: [{ name: 'Jean-Pierre Jeunet', job: 'Director' }],
      production_companies: [], keywords: [], locations: [paris('narrative'), paris('filming')]
    },
    ratings: [{ calculatedTotal: 9.5, date: '2023-01-01' }],
    dbKey: 'movie-1'
  },
  {
    movie: {
      id: 2, title: 'Paris, Texas', release_date: '1984-05-19', runtime: 147,
      genres: [{ name: 'Drama' }], cast: [], crew: [{ name: 'Wim Wenders', job: 'Director' }],
      production_companies: [], keywords: [],
      locations: [{ name: 'Texas', lat: 31, lon: -100, type: 'narrative', id: 'Q1439' }]
    },
    ratings: [{ calculatedTotal: 9.0, date: '2023-02-01' }],
    dbKey: 'movie-2'
  },
  {
    movie: {
      id: 3, title: 'Ratatouille', release_date: '2007-06-29', runtime: 111,
      genres: [{ name: 'Animation' }], cast: [], crew: [{ name: 'Brad Bird', job: 'Director' }],
      production_companies: [], keywords: [], locations: [paris('narrative')]
    },
    ratings: [{ calculatedTotal: 9.0, date: '2023-03-01' }],
    dbKey: 'movie-3'
  }
])

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
      allMediaSortedByRating: [...mockMovies]
    },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  const wrapper = mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: {
        DBGridLayoutSearchResult: {
          template: '<div data-testid="r">{{ result.movie.title }}</div>',
          props: ['result', 'keywordCounts', 'allCounts', 'index', 'resultsAreFiltered', 'sortValue', 'activeQuickLinkList']
        },
        NoResults: true, StickinessModal: true, TweakModal: true, InsetBrowserModal: true
      }
    }
  })
  return { wrapper, mockStore }
}

describe('places on Home', () => {
  it('typing a place name gets a "Set or Filmed There" section, next to the title match', async () => {
    const { wrapper } = mountHome()
    wrapper.vm.searchValue = 'paris'
    await wrapper.vm.$nextTick()

    const groups = wrapper.vm.groupedByAllCategories
    const title = groups.find((g) => g.category === 'title')
    const place = groups.find((g) => g.category === 'place')
    expect(title.movies.map((m) => m.movie.id)).toEqual([2])
    expect(place.categoryDisplay).toBe('Set or Filmed There')
    expect(place.movies.map((m) => m.movie.id).sort()).toEqual([1, 3])
  })

  it('a place chip matches the whole place, so "Paris" is not "Paris, Texas"', async () => {
    const { wrapper } = mountHome()
    wrapper.vm.activeFilters = [{ id: 'place-1', type: 'place', value: 'Paris', display: 'Paris' }]
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const shown = wrapper.findAll('[data-testid="r"]').map((n) => n.text()).sort()
    expect(shown).toEqual(['Amélie', 'Ratatouille'])
  })

  it('the Add Filter menu offers places with their counts and adds a chip', async () => {
    const { wrapper } = mountHome()
    expect(wrapper.vm.topPlaces).toEqual([{ name: 'Paris', count: 2 }, { name: 'Texas', count: 1 }])

    wrapper.vm.showAddFilterModal = true
    await wrapper.vm.$nextTick()
    const select = wrapper.findAll('select').find((node) => node.text().includes('Select a place...'))
    expect(select).toBeTruthy()
    await select.setValue('Paris')

    expect(wrapper.vm.activeFilters.map((f) => [f.type, f.value])).toEqual([['place', 'Paris']])
    expect(wrapper.vm.showAddFilterModal).toBe(false)
  })

  it('counts places for the (N) badges and the catalog', () => {
    const { wrapper } = mountHome()
    expect(wrapper.vm.allCounts.places).toEqual({ Paris: 2, Texas: 1 })
    expect(wrapper.vm.groupOrder).toContain('place')
  })
})

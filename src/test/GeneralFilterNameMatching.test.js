import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

// Locks in the cast/crew matching behavior of applyFilter's `general` case after
// the flatMap+split was collapsed to a single fullName.includes() check. The
// collapse is only valid because every space-delimited name-part is a substring
// of the full name, so part matches must still resolve via the full-name check.

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }))
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 8.25, normalizedRating: 8 })),
  getAllRatings: vi.fn(() => [])
}))

describe('applyFilter general — cast/crew name matching', () => {
  let wrapper

  beforeEach(async () => {
    const mockMovies = [
      {
        movie: {
          id: 1,
          title: 'Heat',
          release_date: '1995-12-15',
          genres: [{ name: 'Crime' }],
          cast: [{ name: 'Al Pacino' }, { name: 'Robert De Niro' }],
          crew: [{ name: 'Michael Mann', job: 'Director' }],
          production_companies: [{ name: 'Warner Bros.' }],
          flatKeywords: ['heist']
        },
        ratings: [{ calculatedTotal: 9.1, date: '2023-01-01' }],
        dbKey: 'movie-1'
      }
    ]

    const mockStore = {
      state: {
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
      },
      getters: {
        allMediaAsArray: mockMovies,
        allMoviesAsArray: mockMovies,
        allMediaSortedByRating: mockMovies
      },
      commit: vi.fn(),
      dispatch: vi.fn()
    }

    wrapper = mount(Home, {
      global: {
        mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
        stubs: { 'NoResults': true, 'StickinessModal': true, 'TweakModal': true, 'InsetBrowserModal': true }
      }
    })
    await wrapper.vm.$nextTick()
  })

  const movie = () => wrapper.vm.allEntriesWithFlatKeywordsAdded[0]
  const match = (value) => wrapper.vm.applyFilter(movie(), { type: 'general', value })

  it('matches a cast member by full name', () => {
    expect(match('Al Pacino')).toBe(true)
  })

  it('matches a cast member by last-name part', () => {
    expect(match('pacino')).toBe(true)
  })

  it('matches a cast member by first-name part', () => {
    expect(match('al')).toBe(true)
  })

  it('matches a substring inside a name part', () => {
    expect(match('acino')).toBe(true)
  })

  it('matches a crew member by name', () => {
    expect(match('mann')).toBe(true)
  })

  it('does not match a name that is absent', () => {
    expect(match('spielberg')).toBe(false)
  })
})

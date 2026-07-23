import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Home from '@/components/Home.vue'

// Guards Home.vue's thin wrapper computeds (countDirectors/countCastCrew/
// countedGenres) correctly delegate to the shared entityCounts.js module —
// see entityCounts.test.js for direct coverage of the counting logic itself,
// and MovieDetail.test.js's "badge counts" describe block for the same
// wiring guard on the other consumer of that module.

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }))
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 8, normalizedRating: 8 })),
  getAllRatings: vi.fn(() => [])
}))

function movie (dbKey, overrides = {}) {
  return {
    dbKey,
    movie: {
      id: dbKey,
      title: `Movie ${dbKey}`,
      release_date: '2019-01-15',
      runtime: 100,
      genres: [],
      cast: [],
      crew: [],
      production_companies: [],
      keywords: [],
      ...overrides
    },
    ratings: [{ calculatedTotal: 8, date: '2023-01-01' }]
  }
}

function mountHome (movies, settings = {}) {
  const mockStore = {
    state: reactive({
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      settings: { normalizationTweak: 0.25, tags: { 'viewing-tags': {} }, ...settings },
      homePageSearchChips: [],
      homePageSearchValue: '',
      homePageNumberOfResults: 25,
      homePageNavigationIntent: null,
      homePageSortValue: null,
      homePageSortOrder: null,
      homePagePromoteGroup: null
    }),
    getters: { allMediaAsArray: movies, allMoviesAsArray: movies, allMediaSortedByRating: movies },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  const wrapper = mount(Home, {
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

  return wrapper
}

describe('Home.vue badge/count wiring (entityCounts.js)', () => {
  it('countDirectors credits every co-director, not just whichever TMDB lists first', () => {
    const wrapper = mountHome([
      movie('a', { crew: [
        { name: 'Daniel Kwan', job: 'Director' },
        { name: 'Daniel Scheinert', job: 'Director' }
      ] })
    ])
    expect(wrapper.vm.countDirectors['Daniel Kwan']).toBe(1)
    expect(wrapper.vm.countDirectors['Daniel Scheinert']).toBe(1)
  })

  it('countCastCrew credits a composer regardless of their position in the crew array', () => {
    const padding = Array.from({ length: 12 }, (_, i) => ({ name: `Grip ${i}`, job: 'Grip' }))
    const wrapper = mountHome([
      movie('a', { crew: [...padding, { name: 'Hans Zimmer', job: 'Original Music Composer' }] })
    ])
    expect(wrapper.vm.countCastCrew['Hans Zimmer']).toBe(1)
  })

  it('countedGenres excludes short films when includeShorts is off', () => {
    const wrapper = mountHome([
      movie('a', { runtime: 30, genres: [{ name: 'Drama' }] }),
      movie('b', { runtime: 100, genres: [{ name: 'Drama' }] })
    ], { includeShorts: false })
    expect(wrapper.vm.countedGenres.Drama).toBe(1)
  })

  it('countedGenres includes short films when includeShorts is on', () => {
    const wrapper = mountHome([
      movie('a', { runtime: 30, genres: [{ name: 'Drama' }] }),
      movie('b', { runtime: 100, genres: [{ name: 'Drama' }] })
    ], { includeShorts: true })
    expect(wrapper.vm.countedGenres.Drama).toBe(2)
  })
})

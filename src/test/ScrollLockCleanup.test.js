import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

// Mirrors the other mount-based Home suites.
vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }))
vi.mock('lodash/uniq', () => ({ default: vi.fn((arr) => [...new Set(arr)]) }))

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((media) => {
    if (!media?.ratings?.length) {
      return { calculatedTotal: 0, date: null }
    }
    return {
      calculatedTotal: media.ratings[0].calculatedTotal || 8.0,
      normalizedRating: media.ratings[0].normalizedRating || 8,
      date: media.ratings[0].date
    }
  })
}))

function buildMovies (count) {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: count }, (_, i) => ({
    movie: {
      id: i + 1,
      title: `Movie ${i + 1}`,
      release_date: `${currentYear}-06-15`,
      genres: [{ name: 'Drama' }],
      cast: [{ name: 'Actor One' }],
      crew: [{ name: 'Director One', job: 'Director' }],
      production_companies: [{ name: 'Studio One' }],
      flatKeywords: ['keyword1']
    },
    ratings: [{ calculatedTotal: 9 - i * 0.01, date: `${Date.now()}` }],
    dbKey: `movie-${i + 1}`
  }))
}

// Regression for the stuck-scroll bug: Home's movie-info modal locks body scroll
// via `body.no-scroll` (overflow:hidden). Tapping "Rate" from that modal routes
// away; if the lock isn't removed first it leaks onto every subsequent screen
// until a reload. `rateMovieFromModal` must clear it before navigating.
describe('Scroll-lock cleanup on modal navigation', () => {
  let wrapper
  let mockMovies

  beforeEach(async () => {
    mockMovies = buildMovies(5)

    const mockStore = {
      state: {
        dbLoaded: true,
        databaseTopKey: 'test-user',
        currentLog: 'movieLog',
        DBSearchValue: '',
        DBSortValue: 'rating',
        academyAwardWinners: {},
        settings: {
          normalizationTweak: 0.25,
          tieBreakTweak: 1,
          includeShorts: false,
          tags: { 'viewing-tags': {} }
        },
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
        allMediaSortedByRating: [...mockMovies]
      },
      commit: vi.fn(),
      dispatch: vi.fn()
    }

    wrapper = mount(Home, {
      global: {
        mocks: {
          $store: mockStore,
          $route: { query: {} },
          $router: { push: vi.fn() }
        },
        stubs: {
          DBGridLayoutSearchResult: true,
          NoResults: true,
          StickinessModal: true,
          TweakModal: true,
          InsetBrowserModal: true
        }
      }
    })
    await wrapper.vm.$nextTick()
  })

  afterEach(() => {
    document.body.classList.remove('no-scroll')
  })

  it('showMovieInfo locks body scroll', () => {
    wrapper.vm.showMovieInfo(mockMovies[0])
    expect(document.body.classList.contains('no-scroll')).toBe(true)
  })

  it('closeMovieInfoModal releases the scroll lock', () => {
    wrapper.vm.showMovieInfo(mockMovies[0])
    wrapper.vm.closeMovieInfoModal()
    expect(document.body.classList.contains('no-scroll')).toBe(false)
  })

  it('rateMovieFromModal releases the lock before navigating away', () => {
    wrapper.vm.showMovieInfo(mockMovies[0])
    expect(document.body.classList.contains('no-scroll')).toBe(true)

    wrapper.vm.rateMovieFromModal()

    // The lock must be gone, and the navigation must still have happened.
    expect(document.body.classList.contains('no-scroll')).toBe(false)
    expect(wrapper.vm.$router.push).toHaveBeenCalledWith('/rate-movie')
  })
})

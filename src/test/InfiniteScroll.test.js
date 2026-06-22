import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

// Mock external dependencies (mirrors the other mount-based Home suites)
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

// --- IntersectionObserver mock ----------------------------------------------
// jsdom has no IntersectionObserver. Capture every instance so a test can fire
// its callback and assert the load-more wiring without a real viewport.
let observerInstances = []

class MockIntersectionObserver {
  constructor (callback, options) {
    this.callback = callback
    this.options = options
    this.observed = []
    this.disconnected = false
    observerInstances.push(this)
  }

  observe (el) { this.observed.push(el) }
  unobserve (el) { this.observed = this.observed.filter((e) => e !== el) }
  disconnect () { this.disconnected = true; this.observed = [] }

  // Test helper: simulate the sentinel entering the pre-load zone.
  trigger (isIntersecting = true) {
    this.callback([{ isIntersecting, target: this.observed[0] }], this)
  }
}

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

describe('Infinite-scroll result loading', () => {
  let wrapper
  let mockStore
  let mockMovies
  const MOVIE_COUNT = 60 // > the initial 25 so canLoadMore is true

  beforeEach(async () => {
    observerInstances = []
    global.IntersectionObserver = MockIntersectionObserver

    mockMovies = buildMovies(MOVIE_COUNT)

    mockStore = {
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
          DBGridLayoutSearchResult: {
            template: '<div data-testid="db-grid-result">{{ result.movie.title }}</div>',
            props: ['result', 'keywordCounts', 'allCounts', 'index', 'resultsAreFiltered', 'sortValue', 'activeQuickLinkList']
          },
          NoResults: true,
          StickinessModal: true,
          TweakModal: true,
          InsetBrowserModal: true
        }
      }
    })

    wrapper.vm.allEntriesWithFlatKeywordsAdded = mockMovies
    await wrapper.vm.$nextTick()
  })

  afterEach(() => {
    delete global.IntersectionObserver
  })

  it('renders only the first batch and exposes canLoadMore when more remain', () => {
    expect(wrapper.vm.numberOfResultsToShow).toBe(25)
    expect(wrapper.vm.paginatedSortedResults.length).toBe(25)
    expect(wrapper.vm.sortedResults.length).toBe(MOVIE_COUNT)
    expect(wrapper.vm.canLoadMore).toBe(true)
  })

  it('loadMoreResults adds 48 without scrolling the window', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    wrapper.vm.loadMoreResults()
    expect(wrapper.vm.numberOfResultsToShow).toBe(73)
    expect(scrollBy).not.toHaveBeenCalled()
    scrollBy.mockRestore()
  })

  it('observes the sentinel and loads the next batch when it intersects', async () => {
    expect(observerInstances.length).toBeGreaterThan(0)
    const observer = observerInstances[observerInstances.length - 1]
    expect(observer.observed.length).toBe(1)

    observer.trigger(true)
    expect(wrapper.vm.numberOfResultsToShow).toBe(73)
  })

  it('does not load when the sentinel reports not intersecting', () => {
    const observer = observerInstances[observerInstances.length - 1]
    observer.trigger(false)
    expect(wrapper.vm.numberOfResultsToShow).toBe(25)
  })

  it('stops showing the sentinel and disconnects once everything is loaded', async () => {
    wrapper.vm.numberOfResultsToShow = MOVIE_COUNT
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.canLoadMore).toBe(false)
    // Every observer created so far should have been torn down.
    expect(observerInstances.every((o) => o.disconnected)).toBe(true)
  })

  it('disconnects the observer on unmount', () => {
    const observer = observerInstances[observerInstances.length - 1]
    wrapper.unmount()
    expect(observer.disconnected).toBe(true)
  })
})

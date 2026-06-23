import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }))
vi.mock('lodash/uniq', () => ({ default: vi.fn((arr) => [...new Set(arr)]) }))

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((media) => ({
    calculatedTotal: media?.ratings?.[0]?.calculatedTotal ?? 8,
    normalizedRating: 8,
    date: media?.ratings?.[0]?.date
  }))
}))

function entry (id, title, backdrop, customBackdrop) {
  const e = {
    movie: { id, title, backdrop_path: backdrop, poster_path: `/p${id}.jpg`, flatKeywords: [] },
    ratings: [{ calculatedTotal: 9, date: Date.now() }],
    dbKey: `movie-${id}`
  }
  if (customBackdrop !== undefined) e.customBackdropPath = customBackdrop
  return e
}

describe('Home.resolveBanner — custom backdrop', () => {
  let wrapper
  let mockStore
  let movies

  beforeEach(() => {
    movies = [
      entry(1, 'Default Backdrop Movie', '/default-1.jpg'),
      entry(2, 'Custom Backdrop Movie', '/default-2.jpg', '/custom-2.jpg')
    ]

    mockStore = {
      state: {
        dbLoaded: true,
        databaseTopKey: 'test-user',
        currentLog: 'movieLog',
        DBSearchValue: '',
        DBSortValue: 'rating',
        academyAwardWinners: {},
        settings: { normalizationTweak: 0.25, tieBreakTweak: 1, includeShorts: false, tags: { 'viewing-tags': {} } },
        bannerUrl: null,
        bannerRequest: null,
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
      getters: { allMediaAsArray: movies, allMoviesAsArray: movies, allMediaSortedByRating: movies },
      commit: vi.fn(),
      dispatch: vi.fn()
    }

    wrapper = mount(Home, {
      global: {
        mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
        stubs: {
          DBGridLayoutSearchResult: true, NoResults: true, StickinessModal: true,
          TweakModal: true, InsetBrowserModal: true
        }
      }
    })
    wrapper.vm.allEntriesWithFlatKeywordsAdded = movies
  })

  function bannerUrlCommits () {
    return mockStore.commit.mock.calls.filter((c) => c[0] === 'setBannerUrl').map((c) => c[1])
  }

  it('features the entry-level customBackdropPath when present', () => {
    mockStore.state.bannerRequest = { type: 'movie', movieId: 2 }
    wrapper.vm.resolveBanner()

    const urls = bannerUrlCommits()
    expect(urls.length).toBeGreaterThan(0)
    expect(urls[urls.length - 1]).toContain('/custom-2.jpg')
    expect(urls[urls.length - 1]).not.toContain('/default-2.jpg')
  })

  it('falls back to the movie default backdrop when no custom path is set', () => {
    mockStore.state.bannerRequest = { type: 'movie', movieId: 1 }
    wrapper.vm.resolveBanner()

    const urls = bannerUrlCommits()
    expect(urls[urls.length - 1]).toContain('/default-1.jpg')
  })
})

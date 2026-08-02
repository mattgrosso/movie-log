import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Home from '@/components/Home.vue'

vi.mock('axios', () => ({
  default: { get: vi.fn() }
}))

vi.mock('lodash/debounce', () => ({
  default: vi.fn((fn) => fn)
}))

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 8.25, normalizedRating: 8 })),
  getAllRatings: vi.fn(() => [])
}))

const makeMovie = (id) => ({
  movie: {
    id,
    title: `Movie ${id}`,
    release_date: '2020-01-15',
    genres: [{ name: 'Drama' }],
    cast: [],
    crew: [],
    production_companies: [],
    keywords: []
  },
  ratings: [{ calculatedTotal: 8, date: '2023-01-01' }],
  dbKey: `movie-${id}`
})

const mountHome = (movieCount, { dbLoaded = true } = {}) => {
  const mockMovies = Array.from({ length: movieCount }, (_, i) => makeMovie(i + 1))
  const mockStore = {
    state: reactive({
      dbLoaded,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: { bestPicture: [] },
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
    }),
    getters: {
      allMediaAsArray: mockMovies,
      allMoviesAsArray: mockMovies,
      allMediaSortedByRating: [...mockMovies].sort((a, b) => b.ratings[0].calculatedTotal - a.ratings[0].calculatedTotal)
    },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  const wrapper = mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: {
        DBGridLayoutSearchResult: true,
        NoResults: {
          template: '<div data-testid="no-results" :data-suggestions-mode="suggestionsMode"></div>',
          props: ['value', 'suggestionsMode'],
          emits: ['cancel-suggestions', 'startNewSearch']
        },
        StickinessModal: true,
        TweakModal: true,
        InsetBrowserModal: true
      }
    }
  })

  // Returned so a test can flip dbLoaded and watch the UI react, the way it
  // does when the library actually arrives.
  wrapper.mockStore = mockStore
  return wrapper
}

describe('New user onboarding (0-rated vs 1-9-rated vs 10+-rated)', () => {
  it('a brand new (0-rated) user sees the welcome text AND suggestions immediately, no tap required', () => {
    const wrapper = mountHome(0)

    expect(wrapper.find('.welcome-new-user-text').exists()).toBe(true)
    expect(wrapper.vm.shouldShowStartSuggestions).toBe(true)
    const noResults = wrapper.find('[data-testid="no-results"]')
    expect(noResults.exists()).toBe(true)
    expect(noResults.attributes('data-suggestions-mode')).toBe('true')
    // The tap-through button (for the 1-9 range) should not also be showing.
    expect(wrapper.find('.btn-success').exists()).toBe(false)
  })

  // Bug report: "there is a brief moment on a fresh load when it shows me the
  // 'want help getting started?' messaging. I should never see that."
  // Until the library arrives, userRatedMovieCount is 0 — indistinguishable
  // from a genuinely new account — so an established user got a flash of the
  // onboarding UI on every load. The welcome TEXT was already guarded on
  // dbLoaded; the suggestions component was not.
  describe('while the library is still loading', () => {
    it('shows neither the welcome text nor the suggestions', () => {
      const wrapper = mountHome(0, { dbLoaded: false })

      expect(wrapper.vm.isBrandNewUser).toBe(false)
      expect(wrapper.vm.shouldShowStartSuggestions).toBe(false)
      expect(wrapper.find('.welcome-new-user-text').exists()).toBe(false)
      expect(wrapper.find('[data-testid="no-results"]').exists()).toBe(false)
    })

    it('shows them only once the library has actually arrived empty', async () => {
      const wrapper = mountHome(0, { dbLoaded: false })
      expect(wrapper.vm.shouldShowStartSuggestions).toBe(false)

      wrapper.mockStore.state.dbLoaded = true
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.shouldShowStartSuggestions).toBe(true)
      expect(wrapper.find('.welcome-new-user-text').exists()).toBe(true)
    })
  })

  it('a 1-9-rated user does NOT see the welcome text, and suggestions require a tap', async () => {
    const wrapper = mountHome(3)

    expect(wrapper.find('.welcome-new-user-text').exists()).toBe(false)
    expect(wrapper.vm.shouldShowStartSuggestions).toBe(false)
    const button = wrapper.find('.btn-success')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('Suggest more movies to rate')

    await button.trigger('click')

    expect(wrapper.vm.shouldShowStartSuggestions).toBe(true)
  })

  it('a 10+-rated user sees neither the welcome text nor the new-user suggestions button', () => {
    const wrapper = mountHome(12)

    expect(wrapper.find('.welcome-new-user-text').exists()).toBe(false)
    expect(wrapper.vm.shouldShowStartSuggestions).toBe(false)
  })

  it('cancelling the brand-new-user welcome suggestions dismisses it (does not reappear)', async () => {
    const wrapper = mountHome(0)
    expect(wrapper.vm.shouldShowStartSuggestions).toBe(true)

    wrapper.vm.handleCancelSuggestions()
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.shouldShowStartSuggestions).toBe(false)
    expect(wrapper.find('.welcome-new-user-text').exists()).toBe(false)
  })
})

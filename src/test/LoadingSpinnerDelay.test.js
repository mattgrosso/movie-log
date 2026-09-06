import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Home, { LOADING_SPINNER_DELAY_MS } from '@/components/Home.vue'

// Bug report (Matt, 2026-09-05): tapping a push notification "shows me
// Cinema Roll and then immediately flashes to the loading screen and then
// shows it again." iOS reloads the installed app on that tap; the spinner
// was showing for the few hundred milliseconds the cached library took to
// come back. Now the spinner waits, so a warm launch never shows it.

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

const mountHome = ({ dbLoaded = false } = {}) => {
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
      allMediaAsArray: [],
      allMoviesAsArray: [],
      allMediaSortedByRating: []
    },
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
  wrapper.mockStore = mockStore
  return wrapper
}

describe('Home loading spinner is delayed', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows no spinner while the library is still fresh from a warm launch', async () => {
    vi.useFakeTimers()
    const wrapper = mountHome()

    expect(wrapper.find('.loading-screen').exists()).toBe(true)
    expect(wrapper.find('.spinner-border').exists()).toBe(false)

    vi.advanceTimersByTime(LOADING_SPINNER_DELAY_MS - 1)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.spinner-border').exists()).toBe(false)
  })

  it('shows the spinner once the load has genuinely dragged on', async () => {
    vi.useFakeTimers()
    const wrapper = mountHome()

    vi.advanceTimersByTime(LOADING_SPINNER_DELAY_MS)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.spinner-border').exists()).toBe(true)
  })

  it('never shows it when the library arrives inside the delay', async () => {
    vi.useFakeTimers()
    const wrapper = mountHome()

    vi.advanceTimersByTime(200)
    wrapper.mockStore.state.dbLoaded = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.loading-screen').exists()).toBe(false)

    vi.advanceTimersByTime(LOADING_SPINNER_DELAY_MS)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.spinner-border').exists()).toBe(false)
    expect(wrapper.find('.loading-screen').exists()).toBe(false)
  })
})

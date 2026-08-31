import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

// Report -P0Jz3pTqFQuw (Matt, 2026-08-30, on the phone): "I've searched for a
// trip to the moon which is the name of the movie. I've definitely rated the
// movie and yet it isn't showing up."
//
// The chain that made a rated film unfindable by its own exact title:
// includeShorts=false drops runtime<=40 from unifiedFilteredResults (step 3),
// so the flat pipeline is empty — and the results area's v-if gates on
// paginatedSortedResults.length, so the GROUPED sections (which had found the
// film; they never filtered shorts) never render either. The screen shows
// nothing but the add-a-rating fallback, i.e. the app denies owning a movie
// it has a rating for.
//
// The rule these tests pin down: a short you NAME appears despite the
// setting; a short you'd merely browse into stays hidden. Naming = a typed /
// general filter whose text matches the title. Structured chips are browsing.

vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: {} })),
    get: vi.fn(() => Promise.resolve({ data: {} }))
  }
}))

const shortFilm = {
  movie: {
    id: 775,
    title: 'A Trip to the Moon',
    release_date: '1902-06-15',
    runtime: 15,
    genres: [{ name: 'Science Fiction' }],
    cast: [],
    crew: [{ name: 'Georges Melies', job: 'Director' }],
    production_companies: [],
    flatKeywords: ['moon', 'short film']
  },
  ratings: [{ calculatedTotal: 8.5, date: '2023-01-01' }],
  dbKey: 'movie-775'
}

const feature = {
  movie: {
    id: 62,
    title: '2001: A Space Odyssey',
    release_date: '1968-04-02',
    runtime: 149,
    genres: [{ name: 'Science Fiction' }],
    cast: [],
    crew: [{ name: 'Stanley Kubrick', job: 'Director' }],
    production_companies: [],
    flatKeywords: ['moon', 'space']
  },
  ratings: [{ calculatedTotal: 9.2, date: '2023-02-01' }],
  dbKey: 'movie-62'
}

function mountHome ({ includeShorts = false } = {}) {
  const movies = [shortFilm, feature]
  const mockStore = {
    state: {
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: { bestPicture: [] },
      settings: { includeShorts, tags: { 'viewing-tags': {} } },
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
      allMediaAsArray: movies,
      allMoviesAsArray: movies,
      allMediaSortedByRating: [...movies].sort((a, b) => b.ratings[0].calculatedTotal - a.ratings[0].calculatedTotal)
    },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  return mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
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
}

async function searchFor (wrapper, value, type = 'general') {
  wrapper.vm.activeFilters.push({ id: `test-${type}`, type, value, display: value })
  await wrapper.vm.$nextTick()
}

const renderedTitles = (wrapper) =>
  wrapper.findAll('[data-testid="db-grid-result"]').map((node) => node.text())

describe('searching for a short by name, with shorts switched off', () => {
  let wrapper
  beforeEach(async () => {
    wrapper = mountHome()
    await wrapper.vm.$nextTick()
  })

  // THE report scenario, asserted through the DOM: the film must actually
  // render, not merely survive some intermediate computed. The bug's
  // signature was grouped sections holding the film while the results area's
  // v-if (gated on the flat pipeline) kept every row off the screen.
  it('renders the short when its exact title is the search', async () => {
    await searchFor(wrapper, 'A Trip to the Moon')

    expect(wrapper.vm.unifiedFilteredResults.map((r) => r.movie.title)).toContain('A Trip to the Moon')
    expect(renderedTitles(wrapper)).toContain('A Trip to the Moon')
  })

  it('renders it without the leading article too', async () => {
    await searchFor(wrapper, 'trip to the moon')

    expect(renderedTitles(wrapper)).toContain('A Trip to the Moon')
  })

  // The follow-up (2026-08-31): "moon" is a title SUBSTRING, and the first
  // rescue rule surfaced the short for it with shorts hidden — through both
  // pipelines, since the grouped sections never filtered shorts at all. A
  // substring is browsing; only the name rescues. Asserted through the DOM so
  // the grouped path is covered too.
  it('a title substring does not resurface it — the toggle governs browsing', async () => {
    await searchFor(wrapper, 'moon')

    expect(wrapper.vm.unifiedFilteredResults.map((r) => r.movie.title)).not.toContain('A Trip to the Moon')
    expect(renderedTitles(wrapper)).not.toContain('A Trip to the Moon')
  })

  it('still hides it from browsing — a genre chip does not resurface it', async () => {
    await searchFor(wrapper, 'Science Fiction', 'genre')

    const titles = wrapper.vm.unifiedFilteredResults.map((r) => r.movie.title)
    expect(titles).toContain('2001: A Space Odyssey')
    expect(titles).not.toContain('A Trip to the Moon')
  })

  it('still hides it from a non-title text match (keyword browsing)', async () => {
    // "space" names nothing in the short's title; general matching would only
    // reach it through keywords, and that is browsing, not naming.
    await searchFor(wrapper, 'space')

    const titles = wrapper.vm.unifiedFilteredResults.map((r) => r.movie.title)
    expect(titles).not.toContain('A Trip to the Moon')
  })

  it('leaves the no-chips browse view free of shorts', () => {
    const titles = wrapper.vm.unifiedFilteredResults.map((r) => r.movie.title)
    expect(titles).toEqual(['2001: A Space Odyssey'])
  })
})

describe('with shorts switched on', () => {
  it('nothing changes — the setting alone governs', async () => {
    const wrapper = mountHome({ includeShorts: true })
    await wrapper.vm.$nextTick()

    const titles = wrapper.vm.unifiedFilteredResults.map((r) => r.movie.title)
    expect(titles).toContain('A Trip to the Moon')
    expect(titles).toContain('2001: A Space Odyssey')
  })
})

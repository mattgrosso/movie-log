// Typed text is a plain search, always. The sections do the sorting.
//
// Matt, 2026-08-29: "I don't really understand why we have to have different
// types of searches. Like, why do we need a name search separate from a title
// search? Don't we have all those sections within our search results for
// exactly this reason? So everything that comes up under a name will be under
// the person or, like, cast or crew or wherever they are, and everything that
// comes up under a title will be under title, and then I can sort those
// sections as needed."
//
// What prompted it: searching "Alice" didn't find Alice Doesn't Live Here
// Anymore. detectFilterType used to guess which ONE thing a word named, and
// "Alice" is the actress Mary Alice's surname. Worse, the guess also switched
// OFF the grouped sections — they render only for a plain search — so the one
// mechanism that would have shown both readings at once was the thing the
// guess removed.
//
// This file is the contract for the replacement:
//   1. Typing anything is a plain search (years excepted — a plain search
//      cannot match a release year at all).
//   2. The grouped sections split the answer by where each film matched.
//   3. Precision is still available, but deliberately: the typeahead, the Add
//      Filter menu, the links on a movie page, quick links, tags.
//   4. "More from" stays precise by reading INTERPRETATIONS of the words
//      rather than by having a typed chip to lean on (searchInterpretations).
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

const makeMovies = () => ([
  {
    movie: {
      id: 16153,
      title: "Alice Doesn't Live Here Anymore",
      release_date: '1974-12-09',
      genres: [{ id: 18, name: 'Drama' }],
      cast: [{ name: 'Ellen Burstyn' }],
      crew: [{ name: 'Martin Scorsese', job: 'Director' }],
      production_companies: [{ id: 174, name: 'Warner Bros. Pictures' }],
      keywords: [{ id: 1, name: 'waitress' }]
    },
    ratings: [{ calculatedTotal: 8.6, date: '2023-02-01' }],
    dbKey: 'movie-alice'
  },
  {
    movie: {
      id: 1578,
      // Deliberately collides on BOTH readings: the word "alice" is in this
      // title as well, and Mary Alice is in the cast.
      title: 'Malcolm X and the Waitress',
      release_date: '1992-11-18',
      genres: [{ id: 18, name: 'Drama' }],
      cast: [{ name: 'Denzel Washington' }, { name: 'Mary Alice' }],
      crew: [{ name: 'Spike Lee', job: 'Director' }],
      production_companies: [{ id: 174, name: 'Warner Bros. Pictures' }],
      keywords: [{ id: 2, name: 'biography' }]
    },
    ratings: [{ calculatedTotal: 9.0, date: '2023-03-01' }],
    dbKey: 'movie-malcolm-x'
  },
  {
    movie: {
      id: 999,
      title: 'Awakenings',
      release_date: '1990-12-22',
      genres: [{ id: 18, name: 'Drama' }],
      cast: [{ name: 'Mary Alice' }],
      crew: [{ name: 'Penny Marshall', job: 'Director' }],
      production_companies: [{ id: 33, name: 'Universal Pictures' }],
      keywords: []
    },
    ratings: [{ calculatedTotal: 8.1, date: '2023-04-01' }],
    dbKey: 'movie-awakenings'
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
        DBGridLayoutSearchResult: {
          template: '<div data-testid="db-grid-result">{{ result.movie.title }}</div>',
          props: ['result', 'keywordCounts', 'allCounts', 'index', 'resultsAreFiltered', 'sortValue', 'activeQuickLinkList']
        },
        NoResults: { template: '<div/>', props: ['value', 'suggestionsMode'] },
        StickinessModal: true,
        TweakModal: true,
        InsetBrowserModal: true
      }
    }
  })

  return { wrapper, mockStore }
}

describe('typing never guesses at a filter', () => {
  let wrapper

  beforeEach(() => {
    ({ wrapper } = mountHome())
  })

  it.each([
    ['Alice', 'an actress’s surname'],
    ['Mary Alice', 'a cast member’s whole name'],
    ['Martin Scorsese', 'a director’s whole name'],
    ['Drama', 'an exact genre'],
    ['waitress', 'an exact keyword'],
    ['Warner Bros. Pictures', 'an exact studio']
  ])('%s stays a plain search (%s)', (term) => {
    expect(wrapper.vm.detectFilterType(term).type).toBe('general')
  })

  // Years are the deliberate exception: `general` does not look at
  // release_date at all, so a typed year has to become a year chip or it
  // finds nothing whatsoever.
  it('still turns a typed year into a year chip', () => {
    expect(wrapper.vm.detectFilterType('1974').type).toBe('year')
  })

  it('finds the film the report was about, and Mary Alice’s too', () => {
    const filter = wrapper.vm.detectFilterType('Alice')
    const titles = wrapper.vm.allEntriesWithFlatKeywordsAdded
      .filter((result) => wrapper.vm.applyFilter(result, filter))
      .map((result) => result.movie.title)

    expect(titles).toContain("Alice Doesn't Live Here Anymore")
    expect(titles).toContain('Awakenings')
  })
})

describe('the sections do the sorting', () => {
  let wrapper

  beforeEach(() => {
    ({ wrapper } = mountHome())
  })

  const groupsFor = async (term) => {
    wrapper.vm.inputValue = term
    wrapper.vm.searchValue = term
    await wrapper.vm.$nextTick()
    return wrapper.vm.groupedByAllCategories
  }

  it('splits one ambiguous word into Title and Cast', async () => {
    const groups = await groupsFor('Alice')
    expect(groups).toBeTruthy()

    const byCategory = Object.fromEntries(
      groups.map((group) => [group.category, group.movies.map((m) => m.movie.title)])
    )
    expect(byCategory.title).toContain("Alice Doesn't Live Here Anymore")
    expect(byCategory.cast).toContain('Awakenings')
  })

  // A movie is claimed by the FIRST group that matches it, so a film matching
  // two readings appears once — under whichever section is ranked higher.
  it('never lists the same film in two sections', async () => {
    const groups = await groupsFor('Alice')
    const ids = groups.flatMap((group) => group.movies.map((m) => m.movie.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  // The blocklist of "generic" words — war, love, black, red, american — used
  // to fall back to a flat list. Those are precisely the words with several
  // readings, so they now get sections like everything else.
  it('groups a word that used to be blocked as too generic', async () => {
    const groups = await groupsFor('waitress')
    expect(groups).toBeTruthy()
    expect(groups.length).toBeGreaterThan(0)
  })
})

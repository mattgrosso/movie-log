// A bare SURNAME must not outrank a title. A whole entity name still does.
//
// The report (2026-08-29): "When I search for the word, Alice, the movie
// Alice doesn't live here anymore doesn't come up and it ought to." The
// library really did contain the movie — but it also contained Malcolm X and
// Awakenings, both with the actress Mary ALICE in the cast, and
// buildCastMembersCache indexes bare surnames as well as full names. So
// detectFilterType's exact-match cascade turned "Alice" into a PERSON chip
// that matched her two films and none of the three Alice-titled ones. From
// the phone it looked exactly like partial title matching being broken.
//
// The line drawn here is between a whole name and a fragment. Every other
// branch of that cascade matches a COMPLETE entity name — an exact genre,
// keyword, studio, director, or a cast member's full name — and those are
// deliberate things to type, so they still win over a title. The surname
// index is the only fragment in there, and it is the one that collided.
//
// This matters in both directions, and MovieDetailSearchLinks.test.js is the
// other one: the detail page hands its keyword and company links off as free
// text and RELIES on this cascade to type them, so a blanket "titles always
// win" rule made clicking the keyword "heist" drag in a film merely titled
// "Heist of the Lantern Thriller". Falling through to `general` only ever
// widens results, which is right for something typed and wrong for something
// clicked.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Home from '@/components/Home.vue'
import { termMatchesAnyTitle, buildSearchFields } from '@/assets/javascript/searchFiltering.js'

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
      // "waitress" is both an exact keyword here and a word in the other
      // film's title — the collision the detail-page links depend on.
      keywords: [{ id: 1, name: 'waitress' }]
    },
    ratings: [{ calculatedTotal: 8.6, date: '2023-02-01' }],
    dbKey: 'movie-alice'
  },
  {
    movie: {
      id: 1578,
      title: 'Malcolm X and the Waitress',
      release_date: '1992-11-18',
      genres: [{ id: 18, name: 'Drama' }],
      // The hijacker: her surname is the whole search term.
      cast: [{ name: 'Denzel Washington' }, { name: 'Mary Alice' }],
      crew: [{ name: 'Spike Lee', job: 'Director' }],
      production_companies: [{ id: 174, name: 'Warner Bros. Pictures' }],
      keywords: [{ id: 2, name: 'biography' }]
    },
    ratings: [{ calculatedTotal: 9.0, date: '2023-03-01' }],
    dbKey: 'movie-malcolm-x'
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

describe('a surname does not outrank a title', () => {
  let wrapper

  beforeEach(() => {
    ({ wrapper } = mountHome())
  })

  it('keeps "Alice" a general search, despite Mary Alice', () => {
    // Sanity: the surname really is in the exact-match cache, so without the
    // title guard this WOULD have been a person chip.
    wrapper.vm.buildCastMembersCache()
    expect(wrapper.vm.cachedCastMembers.has('alice')).toBe(true)

    const detected = wrapper.vm.detectFilterType('Alice')
    expect(detected.type).toBe('general')

    // And the general chip finds both the title and Mary Alice's film —
    // the fix widens the results, never narrows them.
    const matches = (filter) => wrapper.vm.allEntriesWithFlatKeywordsAdded
      .filter((result) => wrapper.vm.applyFilter(result, filter))
      .map((result) => result.movie.title)
    expect(matches(detected)).toEqual(expect.arrayContaining([
      "Alice Doesn't Live Here Anymore",
      'Malcolm X and the Waitress'
    ]))
  })

  it('still commits a surname as a person chip when no title contains it', () => {
    const detected = wrapper.vm.detectFilterType('Washington')
    expect(detected.type).toBe('person')
  })

  it('still commits a whole cast name even when a title contains it', () => {
    // A full name is deliberate. "Mary Alice" collides with the Alice title
    // and still wins, because nobody types a person's whole name by accident.
    const detected = wrapper.vm.detectFilterType('Mary Alice')
    expect(detected.type).toBe('person')
  })

  it('still commits an exact director name as a person chip', () => {
    const detected = wrapper.vm.detectFilterType('Martin Scorsese')
    expect(detected.type).toBe('person')
  })

  // The other direction, and the reason this rule is scoped to surnames:
  // MovieDetail hands its keyword/company links off as free text and relies
  // on this cascade to type them (MovieDetailSearchLinks.test.js). A blanket
  // "titles always win" rule made a clicked keyword drag in films that merely
  // said the word in their title.
  it('still commits an exact keyword as a keyword chip when a title says the word', () => {
    const detected = wrapper.vm.detectFilterType('waitress')
    expect(detected.type).toBe('keyword')
  })

  it('still commits an exact studio as a company chip', () => {
    const detected = wrapper.vm.detectFilterType('Warner Bros. Pictures')
    expect(detected.type).toBe('company')
  })
})

describe('termMatchesAnyTitle', () => {
  const entries = makeMovies().map((entry) => ({ ...entry, _search: buildSearchFields(entry.movie) }))

  it('matches loosely, both sides, like the general title matcher', () => {
    // Curly apostrophe and run-together spelling both reach the title.
    expect(termMatchesAnyTitle('doesn’t live', entries)).toBe(true)
    expect(termMatchesAnyTitle('alicedoesnt', entries)).toBe(true)
    expect(termMatchesAnyTitle('malcolm', entries)).toBe(true)
    expect(termMatchesAnyTitle('Alice', entries)).toBe(true)
  })

  it('says no when no title contains the term', () => {
    expect(termMatchesAnyTitle('washington', entries)).toBe(false)
    expect(termMatchesAnyTitle('', entries)).toBe(false)
    expect(termMatchesAnyTitle('alice', [])).toBe(false)
  })

  it('copes with entries that carry no precomputed _search', () => {
    const bare = makeMovies()
    expect(termMatchesAnyTitle('alice', bare)).toBe(true)
  })
})

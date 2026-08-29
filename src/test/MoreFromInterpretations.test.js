// "More from" after typed text stopped becoming a typed chip.
//
// Matt, 2026-08-29, on making every typed search a plain one: "Figure out how
// to make the more from also work." That was the real risk in the change. A
// plain chip carries no TMDB id, so the suggestions row could only ever ask
// /search/movie for the words — typing "Thriller" would have offered films
// CALLED Thriller instead of more thrillers, which is a straight loss against
// what the old genre chip did.
//
// The fix keeps the two questions separate. The chip stays plain, so the
// results list and its sections behave the way Matt asked. Alongside it, the
// words are INTERPRETED against the library's own catalog, and the leading
// reading is asked of /discover as well. Both answers are then unioned:
// "Alice" legitimately means the films called Alice AND the ones with Mary
// Alice in them, and a row that had to choose is what started all this.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import axios from 'axios'
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

const ratedLibrary = () => ([
  {
    movie: {
      id: 1,
      title: 'Sicario',
      release_date: '2015-09-18',
      genres: [{ id: 53, name: 'Thriller' }],
      cast: [{ name: 'Emily Blunt' }],
      crew: [{ name: 'Denis Villeneuve', job: 'Director' }],
      production_companies: [{ id: 1632, name: 'Lionsgate' }],
      keywords: [{ id: 10391, name: 'mexico' }]
    },
    ratings: [{ calculatedTotal: 8.5, date: '2023-03-01' }],
    dbKey: 'movie-1'
  }
])

const candidate = (id, title) => ({
  id,
  title,
  release_date: '2018-06-01',
  poster_path: `/${id}.jpg`,
  genre_ids: [28],
  vote_average: 7.4,
  vote_count: 4000,
  popularity: 55
})

const mountHome = () => {
  const movies = ratedLibrary()
  const store = {
    state: reactive({
      dbLoaded: true,
      isOnline: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: { bestPicture: [] },
      settings: { normalizationTweak: 0.25, tieBreakTweak: 1, includeShorts: false, tags: { 'viewing-tags': {} } },
      movieHatMovieIds: {},
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
      allMediaAsArray: movies,
      allMoviesAsArray: movies,
      allMediaSortedByRating: movies
    },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  return mount(Home, {
    global: {
      mocks: { $store: store, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: {
        DBGridLayoutSearchResult: true,
        NoResults: true,
        StickinessModal: true,
        TweakModal: true,
        InsetBrowserModal: true
      }
    }
  })
}

// Every /discover call made, as its query params — so a test can assert what
// TMDB was actually ASKED, not merely what came back.
const discoverCalls = () =>
  axios.get.mock.calls
    .filter(([url]) => String(url).includes('/discover/movie'))
    .map(([, config]) => config?.params || {})

const respondWith = ({ keywordSearch = [], discover = [], titleSearch = [], person = [] } = {}) => {
  axios.get.mockImplementation((url) => {
    if (url.includes('/search/keyword')) return Promise.resolve({ data: { results: keywordSearch } })
    if (url.includes('/search/person')) return Promise.resolve({ data: { results: person } })
    if (url.includes('/search/movie')) return Promise.resolve({ data: { results: titleSearch } })
    if (url.includes('/discover/movie')) return Promise.resolve({ data: { results: discover, total_pages: 1 } })
    return Promise.resolve({ data: { results: [] } })
  })
}

const plain = (value) => ({ id: `g-${value}`, type: 'general', value, display: value })

describe('More from, driven by what a plain search could mean', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = mountHome()
  })

  // The headline case. "Thriller" is a genre in the library, so the row must
  // still be able to offer thrillers — the thing the old genre chip did.
  it('asks TMDB for the genre when the typed words name one', async () => {
    respondWith({
      titleSearch: [candidate(600, 'Thriller Night')],
      discover: [candidate(700, 'Prisoners')]
    })

    await wrapper.vm.fetchUnratedMoviesForFilters([plain('Thriller')])

    const genreQuestions = discoverCalls().filter((params) => params.with_genres)
    expect(genreQuestions.length).toBeGreaterThan(0)
    expect(genreQuestions[0].with_genres).toBe('53')

    // Union, not replacement: the films CALLED Thriller are still there.
    const ids = wrapper.vm.unratedMovies.map((movie) => movie.id)
    expect(ids).toContain(600)
    expect(ids).toContain(700)
  })

  it('asks TMDB about the person when the words are a name in the library', async () => {
    respondWith({
      person: [{ id: 12345, name: 'Denis Villeneuve', known_for: [{ id: 1 }] }],
      titleSearch: [],
      discover: [candidate(701, 'Enemy')]
    })

    await wrapper.vm.fetchUnratedMoviesForFilters([plain('Denis Villeneuve')])

    const peopleQuestions = discoverCalls().filter((params) => params.with_people)
    expect(peopleQuestions.length).toBeGreaterThan(0)
    expect(peopleQuestions[0].with_people).toBe('12345')
    expect(wrapper.vm.unratedMovies.map((m) => m.id)).toContain(701)
  })

  // Identity the library already knows must not cost a round trip — the
  // catalog exists precisely so a studio or keyword resolves locally.
  it('uses the studio id the library already stored, with no lookup', async () => {
    respondWith({ titleSearch: [], discover: [candidate(702, 'John Wick')] })

    await wrapper.vm.fetchUnratedMoviesForFilters([plain('Lionsgate')])

    const companyQuestions = discoverCalls().filter((params) => params.with_companies)
    expect(companyQuestions.length).toBeGreaterThan(0)
    expect(companyQuestions[0].with_companies).toBe('1632')
    expect(axios.get.mock.calls.some(([url]) => String(url).includes('/search/company'))).toBe(false)
  })

  // The union must never become an intersection. Asking for "films called
  // Thriller that are ALSO thrillers" is nearly nothing — the same mistake
  // that fetching two chips separately and intersecting them made.
  it('keeps text results even when the interpretation returns nothing', async () => {
    respondWith({
      titleSearch: [candidate(800, 'Thriller Night')],
      discover: []
    })

    await wrapper.vm.fetchUnratedMoviesForFilters([plain('Thriller')])

    expect(wrapper.vm.unratedMovies.map((movie) => movie.id)).toContain(800)
  })

  it('shows nothing twice when both readings return the same film', async () => {
    const shared = candidate(900, 'Sicario 2')
    respondWith({ titleSearch: [shared], discover: [shared] })

    await wrapper.vm.fetchUnratedMoviesForFilters([plain('Thriller')])

    const ids = wrapper.vm.unratedMovies.map((movie) => movie.id)
    expect(ids.filter((id) => id === 900)).toHaveLength(1)
  })

  // Words the library has never heard of have no reading, and must not
  // trigger a discover call at all — a question with no constraints would
  // quietly widen to "every popular film", which is how "horror" once
  // returned Spider-Man.
  it('asks no structured question when the words name nothing', async () => {
    respondWith({ titleSearch: [candidate(1000, 'Some Film')] })

    await wrapper.vm.fetchUnratedMoviesForFilters([plain('zzzznotathing')])

    expect(discoverCalls().filter((p) => p.with_genres || p.with_people || p.with_companies)).toHaveLength(0)
    expect(wrapper.vm.unratedMovies.map((movie) => movie.id)).toContain(1000)
  })

  // A question the user has already made precise is theirs. Reinterpreting a
  // deliberate chip would be the old cascade all over again, just later.
  it('never reinterprets a question that is already typed', async () => {
    respondWith({ discover: [candidate(1100, 'Heat')] })

    await wrapper.vm.fetchUnratedMoviesForFilters([
      { id: 'k-1', type: 'keyword', value: 'mexico', display: 'mexico', tmdbId: 10391 }
    ])

    expect(wrapper.vm.interpretationsFrom([
      { id: 'k-1', type: 'keyword', value: 'mexico', display: 'mexico', tmdbId: 10391 }
    ])).toEqual([])
    const questions = discoverCalls()
    expect(questions.every((params) => !params.with_genres)).toBe(true)
  })

  it('leaves a multi-chip question alone as well', async () => {
    respondWith({ discover: [] })

    await wrapper.vm.fetchUnratedMoviesForFilters([plain('Thriller'), plain('Drama')])

    expect(wrapper.vm.interpretationsFrom([plain('Thriller'), plain('Drama')])).toEqual([])
  })

  // The heading is the only thing telling the reader which question was
  // answered, so a plain search that clearly names a genre says so.
  it('describes a genre search as a genre search', async () => {
    respondWith({ titleSearch: [], discover: [candidate(1200, 'Prisoners')] })

    await wrapper.vm.fetchUnratedMoviesForFilters([plain('Thriller')])

    expect(wrapper.vm.unratedMoviesSearchType).toBe('genre')
  })
})

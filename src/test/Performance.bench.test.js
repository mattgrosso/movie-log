import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

// Performance harness for the search/result hot paths. NOT a correctness gate —
// it logs timings so we can experiment with optimizations and see the effect.
// Asserts are loose sanity only (never tight enough to flake in CI). getRating is
// mocked (same as the other suites) so we measure applyFilter / grouping / sort
// orchestration — the live bottleneck — not Vuex weight-getter cost.
//
// Run: yarn test:run src/test/Performance.bench.test.js
// Read the `[bench]` lines in the output.

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }))
vi.mock('@/assets/javascript/GetRating.js', () => ({
  // Vary the rating by id so sorts actually do work (no all-equal short-circuit).
  getRating: vi.fn((media) => {
    const id = media?.movie?.id || 0
    return { calculatedTotal: (id % 100) / 10, normalizedRating: id % 10, date: String(1600000000000 + id * 86400000) }
  }),
  getAllRatings: vi.fn(() => [])
}))

const FIRST = ['John', 'Robert', 'Michael', 'James', 'Denis', 'Steven', 'Al', 'Marlon', 'Roy', 'Richard', 'Cate', 'Meryl', 'Frances', 'Tilda', 'Gary']
const LAST = ['Smith', 'Mann', 'Pacino', 'Brando', 'Spielberg', 'Villeneuve', 'Scorsese', 'Coppola', 'Streep', 'Blanchett', 'Oldman', 'Scheider', 'Dreyfuss', 'Zanuck', 'Linson']
const GENRES = ['Crime', 'Drama', 'Thriller', 'Adventure', 'Comedy', 'Horror', 'Sci-Fi', 'Romance', 'Action', 'Mystery']
const KEYWORDS = ['heist', 'police', 'mafia', 'family', 'shark', 'ocean', 'terror', 'revenge', 'space', 'dystopia', 'war', 'love', 'friendship', 'betrayal']
const COMPANIES = ['Warner Bros.', 'Paramount Pictures', 'Universal Pictures', 'A24', 'Focus Features', '20th Century', 'Sony', 'Lionsgate']
const TITLE_WORDS = ['Heat', 'Godfather', 'Jaws', 'Dune', 'Goodfellas', 'Arrival', 'Sicario', 'Drive', 'Fargo', 'Prisoners', 'Joker', 'Gravity', 'Nightcrawler', 'Whiplash']

const pick = (arr, n) => arr[n % arr.length]
const name = (n) => `${pick(FIRST, n)} ${pick(LAST, Math.floor(n / 3) + n)}`

function makeLibrary (count) {
  const movies = []
  for (let i = 1; i <= count; i++) {
    movies.push({
      movie: {
        id: i,
        title: `${pick(TITLE_WORDS, i)} ${pick(TITLE_WORDS, i * 7)} ${i}`,
        release_date: `${1970 + (i % 55)}-0${(i % 9) + 1}-15`,
        genres: [{ name: pick(GENRES, i) }, { name: pick(GENRES, i + 3) }],
        cast: Array.from({ length: 12 }, (_, k) => ({ name: name(i + k), character: 'X' })),
        crew: [
          { name: name(i + 100), job: 'Director' },
          { name: name(i + 200), job: 'Producer' },
          { name: name(i + 300), job: 'Writer' },
          { name: name(i + 400), job: 'Original Music Composer' }
        ],
        production_companies: [{ name: pick(COMPANIES, i) }, { name: pick(COMPANIES, i + 2) }],
        keywords: KEYWORDS.filter((_, k) => (i + k) % 3 === 0).map((kw, idx) => ({ id: idx, name: kw }))
      },
      ratings: [{ calculatedTotal: (i % 100) / 10, date: String(1600000000000 + i * 86400000) }],
      dbKey: `movie-${i}`
    })
  }
  return movies
}

function mountWith (movies) {
  const mockStore = {
    state: {
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: { bestPicture: [] },
      settings: { normalizationTweak: 0.25, tieBreakTweak: 1, includeShorts: false, tags: { 'viewing-tags': {} } },
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
      allMediaSortedByRating: movies
    },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  return mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: { NoResults: true, StickinessModal: true, TweakModal: true, InsetBrowserModal: true }
    }
  })
}

function time (label, iterations, fn) {
  // Warm up (JIT) then measure median-ish over a few runs.
  for (let i = 0; i < 2; i++) fn()
  const runs = []
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    fn()
    runs.push(performance.now() - t0)
  }
  runs.sort((a, b) => a - b)
  const median = runs[Math.floor(runs.length / 2)]
  // process.stdout bypasses vitest's console intercept so timings always print.
  process.stdout.write(`[bench] ${label}: ${median.toFixed(2)}ms (median of ${iterations})\n`)
  return median
}

describe('Performance harness (search hot paths)', () => {
  let wrapper
  const LIB_SIZE = 1300

  beforeEach(async () => {
    wrapper = mountWith(makeLibrary(LIB_SIZE))
    await wrapper.vm.$nextTick()
  })

  it('reports timings for the per-keystroke hot paths', () => {
    const vm = wrapper.vm
    const library = vm.allEntriesWithFlatKeywordsAdded
    expect(library.length).toBe(LIB_SIZE)

    // 1. Full-library applyFilter pass (one simulated keystroke of a general search).
    time('applyFilter general x library', 20, () => {
      let hits = 0
      for (const entry of library) {
        if (vm.applyFilter(entry, { type: 'general', value: 'pacino' })) hits++
      }
      return hits
    })

    // 2. applyFilter director pass (runs per-keystroke inside grouping).
    time('applyFilter director x library', 20, () => {
      for (const entry of library) vm.applyFilter(entry, { type: 'director', value: 'mann' })
    })

    // 3. sortResultsFast over the whole library.
    time('sortResultsFast x library', 20, () => vm.sortResultsFast(library))

    // 4. The big one: grouped view recompute for a real search term.
    vm.searchValue = 'heat'
    time('groupedByAllCategories (searchValue="heat")', 15, () => {
      // Force re-eval: read after nudging the reactive dep the computed caches on.
      vm.searchValue = vm.searchValue === 'heat' ? 'heat ' : 'heat'
      return vm.groupedByAllCategories
    })

    // Sanity: grouping produced something for a matching term.
    vm.searchValue = 'heat'
    const grouped = vm.groupedByAllCategories
    expect(grouped === null || Array.isArray(grouped)).toBe(true)
  })
})

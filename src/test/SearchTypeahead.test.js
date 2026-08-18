// The typeahead line under the main search bar, wired into Home.
//
// The pure ranking is covered in searchSuggestions.test.js. What matters here
// is the wiring: that a tap produces a correctly TYPED chip, that the line
// never fights the zero-results "Did you mean?" line, and that tapping it
// can't be beaten to the punch by the blur handler committing a general chip.
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
      id: 1,
      title: 'Arrival',
      release_date: '2016-11-11',
      genres: [{ name: 'Science Fiction' }],
      cast: [{ name: 'Amy Adams' }],
      crew: [{ name: 'Denis Villeneuve', job: 'Director' }],
      production_companies: [{ name: 'FilmNation Entertainment' }],
      keywords: [{ name: 'aliens' }]
    },
    ratings: [{ calculatedTotal: 9.0, date: '2023-02-01' }],
    dbKey: 'movie-1'
  },
  {
    movie: {
      id: 2,
      title: 'Sicario',
      release_date: '2015-09-18',
      genres: [{ name: 'Thriller' }],
      cast: [{ name: 'Emily Blunt' }],
      crew: [{ name: 'Denis Villeneuve', job: 'Director' }],
      production_companies: [{ name: 'Lionsgate' }],
      keywords: [{ name: 'cartel' }]
    },
    ratings: [{ calculatedTotal: 8.5, date: '2023-03-01' }],
    dbKey: 'movie-2'
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
        NoResults: {
          template: '<div data-testid="no-results">Search TMDB</div>',
          props: ['value', 'suggestionsMode']
        },
        StickinessModal: true,
        TweakModal: true,
        InsetBrowserModal: true
      }
    }
  })

  return { wrapper, mockStore }
}

// The component gates on inputValue (synchronous) and searches searchValue
// (debounced), so a realistic keystroke sets both.
const type = async (wrapper, text) => {
  wrapper.vm.inputValue = text
  wrapper.vm.searchValue = text
  await wrapper.vm.$nextTick()
}

describe('search bar typeahead', () => {
  let wrapper

  beforeEach(() => {
    ({ wrapper } = mountHome())
  })

  describe('what it offers', () => {
    it('offers the dimensions of the library, not its titles', () => {
      // Titles are excluded on purpose: the results list below the bar is
      // already matching them live, so a title suggestion spends the row
      // saying what is already on screen.
      const kinds = wrapper.vm.typeaheadIndex.map((entry) => entry.kind)
      expect(new Set(kinds)).toEqual(new Set(['director', 'genre', 'studio', 'cast', 'keyword']))
      expect(wrapper.vm.typeaheadIndex.map((entry) => entry.value)).not.toContain('Arrival')
    })

    it('completes a surname into a director suggestion', async () => {
      await type(wrapper, 'villen')

      const [top] = wrapper.vm.typeaheadSuggestions
      expect(top.value).toBe('Denis Villeneuve')
      expect(top.expectedType).toBe('director')
    })

    it('stays quiet on a single character', async () => {
      await type(wrapper, 'v')
      expect(wrapper.vm.typeaheadSuggestions).toEqual([])
    })

    it('stays quiet when the input is empty, whatever the debounced value still holds', async () => {
      wrapper.vm.inputValue = ''
      wrapper.vm.searchValue = 'villen'
      await wrapper.vm.$nextTick()

      // Tapping a suggestion clears the input immediately but leaves
      // searchValue behind for one debounce; the row must not linger.
      expect(wrapper.vm.typeaheadSuggestions).toEqual([])
    })

    it('does not offer a filter that is already applied', async () => {
      wrapper.vm.activeFilters = [{ id: 'p1', type: 'person', value: 'Denis Villeneuve', display: 'Denis Villeneuve' }]
      await type(wrapper, 'villen')

      expect(wrapper.vm.typeaheadSuggestions.map((entry) => entry.value)).not.toContain('Denis Villeneuve')
    })
  })

  describe('the chip a tap builds', () => {
    it('builds a person chip from a partial name that would have detected as general', async () => {
      // The reason the feature exists: detectFilterType is an exact-match
      // cascade, so the typed letters alone produce a title search.
      expect(wrapper.vm.detectFilterType('villen').type).toBe('general')

      await type(wrapper, 'villen')
      wrapper.vm.applyTypeaheadSuggestion(wrapper.vm.typeaheadSuggestions[0])

      const chip = wrapper.vm.activeFilters.find((filter) => !filter.temp)
      expect(chip.type).toBe('person')
      expect(chip.value).toBe('Denis Villeneuve')
    })

    it('builds a genre chip carrying the word More from needs', async () => {
      await type(wrapper, 'thril')
      wrapper.vm.applyTypeaheadSuggestion(wrapper.vm.typeaheadSuggestions[0])

      const chip = wrapper.vm.activeFilters.find((filter) => !filter.temp)
      expect(chip.type).toBe('genre')
      expect(chip.value).toBe('Thriller')
    })

    it('clears the input so the row does not survive its own tap', async () => {
      await type(wrapper, 'villen')
      wrapper.vm.applyTypeaheadSuggestion(wrapper.vm.typeaheadSuggestions[0])
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.inputValue).toBe('')
      expect(wrapper.vm.typeaheadSuggestions).toEqual([])
    })
  })

  describe('living beside "Did you mean?"', () => {
    it('leaves the line to the fuzzy correction when a term is a genuine typo', async () => {
      await type(wrapper, 'villenueve') // misspelled: no prefix match anywhere

      expect(wrapper.vm.typeaheadSuggestions).toEqual([])
      expect(wrapper.vm.didYouMeanSuggestions.length).toBeGreaterThan(0)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.did-you-mean-inline').exists()).toBe(true)
    })

    it('takes the line when a part-typed genre has both lines to offer', async () => {
      // "thril" returns zero results — `general` matches genres by exact
      // equality — so the fuzzy line is up too, offering the same word. The
      // prefix match is the surer read, and it names the chip it will build.
      await type(wrapper, 'thril')

      expect(wrapper.vm.didYouMeanSuggestions.map((entry) => entry.value)).toContain('Thriller')
      expect(wrapper.vm.typeaheadSuggestions[0].value).toBe('Thriller')

      await wrapper.vm.$nextTick()
      expect(wrapper.find('.typeahead-inline').exists()).toBe(true)
      expect(wrapper.find('.did-you-mean-inline').exists()).toBe(false)
    })

    it('renders the kind beside each term', async () => {
      await type(wrapper, 'villen')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.typeahead-inline').text()).toContain('Denis Villeneuve')
      expect(wrapper.find('.typeahead-inline').text()).toContain('director')
    })

    it('keeps the blur guard working off the fuzzy suggestions, untouched', async () => {
      // blurSearchBar refuses to commit a probable typo as a dead general
      // chip. That guard reads didYouMeanSuggestions, which this feature
      // deliberately does not narrow.
      await type(wrapper, 'thril')
      wrapper.vm.blurSearchBar({ target: { classList: { remove: () => {} }, style: {} } })

      expect(wrapper.vm.activeFilters.filter((filter) => !filter.temp)).toEqual([])
    })
  })

  describe('the blur race', () => {
    it('does not let the half-typed term become a chip when a suggestion is tapped', async () => {
      // mousedown.prevent in the template is what stops the input blurring
      // before the click lands. Without it, blurSearchBar -> convertSearchToChip
      // would commit "villen" as a general chip and the tap would add a second.
      await type(wrapper, 'villen')
      await wrapper.vm.$nextTick()

      const link = wrapper.find('.typeahead-inline a')
      expect(link.exists()).toBe(true)

      await link.trigger('click')
      await wrapper.vm.$nextTick()

      const chips = wrapper.vm.activeFilters.filter((filter) => !filter.temp)
      expect(chips).toHaveLength(1)
      expect(chips[0]).toMatchObject({ type: 'person', value: 'Denis Villeneuve' })
    })
  })
})


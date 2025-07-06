import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

// Mock external dependencies
vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}))

vi.mock('lodash/uniq', () => ({ default: vi.fn(arr => [...new Set(arr)]) }))
vi.mock('lodash/minBy', () => ({ default: vi.fn() }))
vi.mock('lodash/debounce', () => ({ default: vi.fn(fn => fn) }))

// Mock the getRating utility
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({
    calculatedTotal: 8.25,
    normalizedRating: 8
  })),
  getAllRatings: vi.fn(() => [])
}))

describe('Sigourney Weaver - Input vs Random Chip Consistency', () => {
  let wrapper
  let mockStore
  let mockMovies
  let axiosMock

  beforeEach(async () => {
    // Import axios mock
    const axios = await import('axios')
    axiosMock = axios.default.get

    // Create test movies that include Sigourney Weaver
    mockMovies = [
      {
        movie: {
          id: 1,
          title: 'Alien',
          release_date: '1979-05-25',
          genres: [{ name: 'Horror' }, { name: 'Sci-Fi' }],
          cast: [
            { name: 'Sigourney Weaver', character: 'Ellen Ripley' },
            { name: 'Tom Skerritt', character: 'Dallas' }
          ],
          crew: [
            { name: 'Ridley Scott', job: 'Director' }
          ],
          production_companies: [{ name: '20th Century Fox' }],
          flatKeywords: ['space', 'alien', 'horror', 'survival']
        },
        ratings: [{ calculatedTotal: 8.5, date: '2023-01-01' }],
        dbKey: 'movie-1'
      },
      {
        movie: {
          id: 2,
          title: 'Aliens',
          release_date: '1986-07-18',
          genres: [{ name: 'Action' }, { name: 'Sci-Fi' }],
          cast: [
            { name: 'Sigourney Weaver', character: 'Ellen Ripley' },
            { name: 'Michael Biehn', character: 'Corporal Hicks' }
          ],
          crew: [
            { name: 'James Cameron', job: 'Director' }
          ],
          production_companies: [{ name: '20th Century Fox' }],
          flatKeywords: ['space', 'alien', 'action', 'marines']
        },
        ratings: [{ calculatedTotal: 9.0, date: '2023-02-01' }],
        dbKey: 'movie-2'
      },
      {
        movie: {
          id: 3,
          title: 'Ghostbusters',
          release_date: '1984-06-08',
          genres: [{ name: 'Comedy' }, { name: 'Fantasy' }],
          cast: [
            { name: 'Bill Murray', character: 'Peter Venkman' },
            { name: 'Dan Aykroyd', character: 'Ray Stantz' },
            { name: 'Sigourney Weaver', character: 'Dana Barrett' }
          ],
          crew: [
            { name: 'Ivan Reitman', job: 'Director' }
          ],
          production_companies: [{ name: 'Columbia Pictures' }],
          flatKeywords: ['ghosts', 'comedy', 'supernatural']
        },
        ratings: [{ calculatedTotal: 8.2, date: '2023-03-01' }],
        dbKey: 'movie-3'
      }
    ]

    // Mock cast/crew counts (this is what random shuffle uses)
    const mockCastCrewCounts = {
      'Sigourney Weaver': 3,
      'Bill Murray': 1,
      'Dan Aykroyd': 1,
      'Tom Skerritt': 1,
      'Michael Biehn': 1,
      'Ridley Scott': 1,
      'James Cameron': 1,
      'Ivan Reitman': 1
    }

    mockStore = {
      state: {
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
          tags: { 'viewing-tags': {} },
          enableRandomSearch: true
        },
        filteredResults: []
      },
      getters: {
        allMediaAsArray: mockMovies,
        allMediaSortedByRating: [...mockMovies].sort((a, b) => b.ratings[0].calculatedTotal - a.ratings[0].calculatedTotal)
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
          'DBGridLayoutSearchResult': {
            template: '<div data-testid="db-grid-result">{{ result.movie.title }}</div>',
            props: ['result', 'keywordCounts', 'allCounts', 'index', 'resultsAreFiltered', 'sortValue', 'activeQuickLinkList']
          },
          'NoResults': true,
          'StickinessModal': true,
          'TweakModal': true,
          'InsetBrowserModal': true
        }
      }
    })

    // Mock the countCastCrew computed property to return our test data
    Object.defineProperty(wrapper.vm, 'countCastCrew', {
      get: () => mockCastCrewCounts,
      configurable: true
    })

    await wrapper.vm.$nextTick()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Helper function to set up successful TMDB API response for person search
  const setupPersonTMDBResponse = () => {
    // Mock the person search API call
    axiosMock.mockImplementation((url) => {
      if (url.includes('/search/person')) {
        return Promise.resolve({
          data: {
            results: [
              {
                id: 10205,
                name: 'Sigourney Weaver',
                known_for_department: 'Acting',
                popularity: 15.5
              }
            ]
          }
        })
      } else if (url.includes('/person/10205/movie_credits')) {
        return Promise.resolve({
          data: {
            cast: [
              { id: 501, title: 'Avatar', release_date: '2009-12-18', popularity: 95.2, vote_count: 150 },
              { id: 502, title: 'Working Girl', release_date: '1988-12-21', popularity: 45.8, vote_count: 85 },
              { id: 503, title: 'Galaxy Quest', release_date: '1999-12-25', popularity: 72.1, vote_count: 120 }
            ],
            crew: []
          }
        })
      }
      return Promise.reject(new Error('Unexpected API call'))
    })
  }

  // Helper function to wait for async operations
  const waitForAsyncOperations = async () => {
    await new Promise(resolve => setTimeout(resolve, 900))
    await wrapper.vm.$nextTick()
  }

  describe('Search Type Detection', () => {
    it('should detect "Sigourney Weaver" as general search type for input', () => {
      const searchType = wrapper.vm.detectSearchType('Sigourney Weaver')
      console.log('Search type detection for input:', searchType)
      expect(searchType.type).toBe('general')
      expect(searchType.value).toBe('Sigourney Weaver')
    })

    it('should detect "Sigourney Weaver" filter type for chip creation', () => {
      // This tests the detectFilterType method used by addSearchFilter
      const filterType = wrapper.vm.detectFilterType('Sigourney Weaver')
      console.log('Filter type detection for chip:', filterType)
      // Should be 'search' type since Sigourney Weaver is not in allDirectors
      expect(filterType.type).toBe('search')
      expect(filterType.value).toBe('Sigourney Weaver')
    })
  })

  describe('Typed Input Scenario', () => {
    it('should show More from section when "Sigourney Weaver" is typed', async () => {
      setupPersonTMDBResponse()
      
      // Simulate typing "Sigourney Weaver" in input
      wrapper.vm.value = 'Sigourney Weaver'
      wrapper.vm.debouncedSearchValue = 'Sigourney Weaver'
      
      await waitForAsyncOperations()
      
      console.log('Typed input results:')
      console.log('- effectiveSearchTerm:', wrapper.vm.effectiveSearchTerm)
      console.log('- unratedMovies length:', wrapper.vm.unratedMovies.length)
      console.log('- unratedMoviesSearchType:', wrapper.vm.unratedMoviesSearchType)
      console.log('- unratedMoviesLoading:', wrapper.vm.unratedMoviesLoading)
      console.log('- unratedMoviesError:', wrapper.vm.unratedMoviesError)
      console.log('- filteredResults length:', wrapper.vm.filteredResults.length)
      
      // Should trigger unrated movies fetch
      expect(wrapper.vm.effectiveSearchTerm).toBe('Sigourney Weaver')
      expect(wrapper.vm.unratedMovies.length).toBeGreaterThan(0)
      expect(wrapper.vm.unratedMoviesSearchType).toBe('person') // Should be 'person' due to fallback
      expect(wrapper.vm.unratedMoviesLoading).toBe(false)
      expect(wrapper.vm.unratedMoviesError).toBe(null)
      
      // Should show More from section
      const moreFromSection = wrapper.find('.unrated-movies-grid')
      expect(moreFromSection.exists()).toBe(true)
      
      const heading = moreFromSection.find('h3')
      expect(heading.text()).toContain('More from Sigourney Weaver')
    })
  })

  describe('Random Chip Scenario', () => {
    it('should show More from section when "Sigourney Weaver" comes from random shuffle', async () => {
      setupPersonTMDBResponse()
      
      // Simulate what happens during random shuffle
      // First, clear any existing input
      wrapper.vm.value = ''
      wrapper.vm.debouncedSearchValue = ''
      wrapper.vm.inputValue = ''
      
      // Simulate random shuffle selecting "Sigourney Weaver" from cast/crew
      // This calls updateSearchValue which calls addSearchFilter
      wrapper.vm.updateSearchValue('Sigourney Weaver', true) // true = isAutoRandom
      
      await waitForAsyncOperations()
      
      console.log('Random chip results:')
      console.log('- activeFilters:', wrapper.vm.activeFilters)
      console.log('- effectiveSearchTerm:', wrapper.vm.effectiveSearchTerm)
      console.log('- unratedMovies length:', wrapper.vm.unratedMovies.length)
      console.log('- unratedMoviesSearchType:', wrapper.vm.unratedMoviesSearchType)
      console.log('- unratedMoviesLoading:', wrapper.vm.unratedMoviesLoading)
      console.log('- unratedMoviesError:', wrapper.vm.unratedMoviesError)
      console.log('- filteredResults length:', wrapper.vm.filteredResults.length)
      
      // Should create a search chip
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.activeFilters[0].type).toBe('search')
      expect(wrapper.vm.activeFilters[0].value).toBe('Sigourney Weaver')
      
      // Should have correct effectiveSearchTerm
      expect(wrapper.vm.effectiveSearchTerm).toBe('Sigourney Weaver')
      
      // Should trigger unrated movies fetch
      expect(wrapper.vm.unratedMovies.length).toBeGreaterThan(0)
      expect(wrapper.vm.unratedMoviesSearchType).toBe('person') // Should be 'person' due to fallback
      expect(wrapper.vm.unratedMoviesLoading).toBe(false)
      expect(wrapper.vm.unratedMoviesError).toBe(null)
      
      // Should show More from section
      const moreFromSection = wrapper.find('.unrated-movies-grid')
      expect(moreFromSection.exists()).toBe(true)
      
      const heading = moreFromSection.find('h3')
      expect(heading.text()).toContain('More from Sigourney Weaver')
    })
  })

  describe('Direct Comparison', () => {
    it('should produce identical More from section behavior for input vs chip', async () => {
      setupPersonTMDBResponse()
      
      // Test 1: Typed input
      wrapper.vm.value = 'Sigourney Weaver'
      wrapper.vm.debouncedSearchValue = 'Sigourney Weaver'
      await waitForAsyncOperations()
      
      const inputResults = {
        effectiveSearchTerm: wrapper.vm.effectiveSearchTerm,
        unratedMoviesLength: wrapper.vm.unratedMovies.length,
        unratedMoviesSearchType: wrapper.vm.unratedMoviesSearchType,
        unratedMoviesLoading: wrapper.vm.unratedMoviesLoading,
        unratedMoviesError: wrapper.vm.unratedMoviesError,
        moreFromExists: wrapper.find('.unrated-movies-grid').exists()
      }
      
      // Reset state
      wrapper.vm.value = ''
      wrapper.vm.debouncedSearchValue = ''
      wrapper.vm.inputValue = ''
      wrapper.vm.activeFilters = []
      wrapper.vm.unratedMovies = []
      wrapper.vm.unratedMoviesSearchType = null
      await wrapper.vm.$nextTick()
      
      // Test 2: Random chip
      wrapper.vm.updateSearchValue('Sigourney Weaver', true)
      await waitForAsyncOperations()
      
      const chipResults = {
        effectiveSearchTerm: wrapper.vm.effectiveSearchTerm,
        unratedMoviesLength: wrapper.vm.unratedMovies.length,
        unratedMoviesSearchType: wrapper.vm.unratedMoviesSearchType,
        unratedMoviesLoading: wrapper.vm.unratedMoviesLoading,
        unratedMoviesError: wrapper.vm.unratedMoviesError,
        moreFromExists: wrapper.find('.unrated-movies-grid').exists()
      }
      
      console.log('Comparison:')
      console.log('Input results:', inputResults)
      console.log('Chip results:', chipResults)
      
      // Both should have identical behavior
      expect(chipResults.effectiveSearchTerm).toBe(inputResults.effectiveSearchTerm)
      expect(chipResults.unratedMoviesLength).toBe(inputResults.unratedMoviesLength)
      expect(chipResults.unratedMoviesSearchType).toBe(inputResults.unratedMoviesSearchType)
      expect(chipResults.unratedMoviesLoading).toBe(inputResults.unratedMoviesLoading)
      expect(chipResults.unratedMoviesError).toBe(inputResults.unratedMoviesError)
      expect(chipResults.moreFromExists).toBe(inputResults.moreFromExists)
    })
  })

  describe('Debug Random Shuffle Mechanism', () => {
    it('should verify cast/crew counts include Sigourney Weaver', () => {
      const castCrew = wrapper.vm.countCastCrew
      console.log('Available cast/crew:', Object.keys(castCrew))
      console.log('Sigourney Weaver count:', castCrew['Sigourney Weaver'])
      
      expect(castCrew).toHaveProperty('Sigourney Weaver')
      expect(castCrew['Sigourney Weaver']).toBeGreaterThan(0)
    })

    it('should test actual random selection that would pick Sigourney Weaver', () => {
      // Mock Math.random to select "cast/crew" category and then "Sigourney Weaver"
      const originalRandom = Math.random
      let callCount = 0
      Math.random = vi.fn(() => {
        callCount++
        if (callCount === 1) return 0.8 // Select "cast/crew" category
        if (callCount === 2) return 0.1 // Select "Sigourney Weaver" from cast/crew
        return 0.5
      })
      
      try {
        wrapper.vm.findRandomSearchValue()
        
        console.log('Random selection result:')
        console.log('- activeFilters:', wrapper.vm.activeFilters)
        console.log('- effectiveSearchTerm:', wrapper.vm.effectiveSearchTerm)
        
        // Should have created a search filter for Sigourney Weaver
        expect(wrapper.vm.activeFilters.length).toBeGreaterThan(0)
        expect(wrapper.vm.effectiveSearchTerm).toBe('Sigourney Weaver')
        
      } finally {
        Math.random = originalRandom
      }
    })
  })
})
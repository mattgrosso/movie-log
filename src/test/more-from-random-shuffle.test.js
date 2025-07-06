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

describe('More From Section - Random Shuffle Scenarios', () => {
  let wrapper
  let mockStore
  let mockMovies
  let axiosMock

  beforeEach(async () => {
    // Import axios mock
    const axios = await import('axios')
    axiosMock = axios.default.get

    // Create test movies with keyword "opera" in flatKeywords
    mockMovies = [
      {
        movie: {
          id: 1,
          title: 'The Phantom of the Opera',
          release_date: '2004-12-22',
          genres: [{ name: 'Drama' }, { name: 'Musical' }],
          cast: [
            { name: 'Gerard Butler', character: 'The Phantom' },
            { name: 'Emmy Rossum', character: 'Christine Daaé' }
          ],
          crew: [
            { name: 'Joel Schumacher', job: 'Director' }
          ],
          production_companies: [{ name: 'Warner Bros.' }],
          flatKeywords: ['opera', 'musical', 'phantom', 'romance']
        },
        ratings: [{ calculatedTotal: 7.5, date: '2023-01-01' }],
        dbKey: 'movie-1'
      },
      {
        movie: {
          id: 2,
          title: 'Carmen',
          release_date: '1984-03-14',
          genres: [{ name: 'Drama' }, { name: 'Musical' }],
          cast: [
            { name: 'Julia Migenes', character: 'Carmen' },
            { name: 'Plácido Domingo', character: 'Don José' }
          ],
          crew: [
            { name: 'Francesco Rosi', job: 'Director' }
          ],
          production_companies: [{ name: 'Gaumont' }],
          flatKeywords: ['opera', 'carmen', 'classical', 'music']
        },
        ratings: [{ calculatedTotal: 8.0, date: '2023-02-01' }],
        dbKey: 'movie-2'
      },
      {
        movie: {
          id: 3,
          title: 'Amadeus',
          release_date: '1984-09-19',
          genres: [{ name: 'Drama' }, { name: 'Biography' }],
          cast: [
            { name: 'F. Murray Abraham', character: 'Antonio Salieri' },
            { name: 'Tom Hulce', character: 'Wolfgang Amadeus Mozart' }
          ],
          crew: [
            { name: 'Miloš Forman', job: 'Director' }
          ],
          production_companies: [{ name: 'The Saul Zaentz Company' }],
          flatKeywords: ['opera', 'classical', 'composer', 'biography']
        },
        ratings: [{ calculatedTotal: 9.2, date: '2023-03-01' }],
        dbKey: 'movie-3'
      }
    ]

    // Mock keyword counts (this is what random shuffle uses)
    const mockKeywordCounts = {
      'opera': 3,
      'musical': 2,
      'classical': 2,
      'phantom': 1,
      'romance': 1,
      'carmen': 1,
      'music': 1,
      'composer': 1,
      'biography': 1
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
          enableRandomSearch: true // Enable random search for this test
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

    // Mock the countedKeywords computed property to return our test data
    Object.defineProperty(wrapper.vm, 'countedKeywords', {
      get: () => mockKeywordCounts,
      configurable: true
    })

    await wrapper.vm.$nextTick()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Helper function to set up successful TMDB API response for keyword search
  const setupKeywordTMDBResponse = (movies = [
    { id: 101, title: 'Don Giovanni', poster_path: '/opera1.jpg', release_date: '2023-01-01', popularity: 85.5, vote_count: 25 },
    { id: 102, title: 'La Traviata', poster_path: '/opera2.jpg', release_date: '2022-01-01', popularity: 78.2, vote_count: 30 },
    { id: 103, title: 'Tosca', poster_path: '/opera3.jpg', release_date: '2021-01-01', popularity: 72.1, vote_count: 15 }
  ]) => {
    axiosMock.mockResolvedValue({
      data: {
        results: movies
      }
    })
  }

  // Helper function to wait for async operations
  const waitForAsyncOperations = async () => {
    await new Promise(resolve => setTimeout(resolve, 900)) // Wait for debounce + a bit more
    await wrapper.vm.$nextTick()
  }

  describe('Random Shuffle "opera" keyword scenario', () => {
    it('should detect "opera" as general search type', () => {
      const searchType = wrapper.vm.detectSearchType('opera')
      expect(searchType.type).toBe('general')
      expect(searchType.value).toBe('opera')
    })

    it('should show More from section when "opera" is set as search filter', async () => {
      setupKeywordTMDBResponse()
      
      // Simulate what happens when random shuffle picks "opera"
      // This should call updateSearchValue which calls addSearchFilter
      wrapper.vm.updateSearchValue('opera', true) // true = isAutoRandom
      
      await waitForAsyncOperations()
      
      // Check that search filter was added
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.activeFilters[0].type).toBe('search')
      expect(wrapper.vm.activeFilters[0].value).toBe('opera')
      
      // Check that effectiveSearchTerm is working
      expect(wrapper.vm.effectiveSearchTerm).toBe('opera')
      
      // Check that unrated movies were fetched
      expect(wrapper.vm.unratedMovies.length).toBeGreaterThan(0)
      expect(wrapper.vm.unratedMoviesSearchType).toBe('general')
      
      // Check that More from section should be visible
      expect(wrapper.vm.displayableUnratedMovies.length).toBeGreaterThan(0)
      expect(wrapper.vm.unratedMoviesLoading).toBe(false)
      expect(wrapper.vm.unratedMoviesError).toBe(null)
      expect(wrapper.vm.paginatedSortedResults.length).toBeGreaterThan(0)
      
      // Verify More from section appears in template
      const moreFromSection = wrapper.find('.unrated-movies-grid')
      expect(moreFromSection.exists()).toBe(true)
      
      const heading = moreFromSection.find('h3')
      expect(heading.text()).toContain('Movies matching "opera"')
    })

    it('should manually test random shuffle flow', async () => {
      setupKeywordTMDBResponse()
      
      // Mock Math.random to always return "opera"
      const originalRandom = Math.random
      Math.random = vi.fn(() => 0.1) // This should pick "opera" from countedKeywords
      
      try {
        // Trigger the random search
        wrapper.vm.findRandomSearchValue()
        
        await waitForAsyncOperations()
        
        // Check that a search filter was added
        expect(wrapper.vm.activeFilters.length).toBeGreaterThan(0)
        
        // Check that effectiveSearchTerm has a value
        expect(wrapper.vm.effectiveSearchTerm).toBeTruthy()
        
        // Check if unrated movies were fetched (this might be the issue)
        console.log('Random search result:')
        console.log('- activeFilters:', wrapper.vm.activeFilters)
        console.log('- effectiveSearchTerm:', wrapper.vm.effectiveSearchTerm)
        console.log('- unratedMovies length:', wrapper.vm.unratedMovies.length)
        console.log('- unratedMoviesSearchType:', wrapper.vm.unratedMoviesSearchType)
        console.log('- unratedMoviesLoading:', wrapper.vm.unratedMoviesLoading)
        console.log('- unratedMoviesError:', wrapper.vm.unratedMoviesError)
        
      } finally {
        Math.random = originalRandom
      }
    })

    it('should test keyword search API flow specifically', async () => {
      // Set up TMDB response with movies that meet the filtering criteria
      const currentYear = new Date().getFullYear()
      const maxYear = currentYear - 1 // The method filters to 1 year ago
      
      console.log('Current year:', currentYear)
      console.log('Max year for filtering:', maxYear)
      
      axiosMock.mockResolvedValue({
        data: {
          results: [
            { 
              id: 101, 
              title: 'Don Giovanni', 
              poster_path: '/opera1.jpg', 
              release_date: `${maxYear}-01-01`, // Use valid year
              popularity: 85.5,
              vote_count: 50 // Meet minimum vote threshold
            },
            { 
              id: 102, 
              title: 'La Traviata', 
              poster_path: '/opera2.jpg', 
              release_date: `${maxYear-1}-01-01`, // Even older to be safe
              popularity: 78.2,
              vote_count: 75 // Meet minimum vote threshold
            }
          ]
        }
      })
      
      // Directly test the keyword search flow
      const results = await wrapper.vm.fetchUnratedMoviesByKeyword('opera')
      
      console.log('Keyword search results:', results)
      console.log('Results length:', results.length)
      
      // Check that API was called
      expect(axiosMock).toHaveBeenCalled()
      
      // Check that results were processed (should pass filters now)
      expect(results.length).toBeGreaterThan(0)
    })

    it('should test full More from section display conditions', async () => {
      setupKeywordTMDBResponse()
      
      // Set up the exact conditions that should show More from section
      wrapper.vm.activeFilters = [{
        id: 'search-opera',
        type: 'search',
        value: 'opera',
        display: 'opera'
      }]
      
      // Manually set unrated movies (simulating successful fetch)
      wrapper.vm.unratedMovies = [
        { id: 101, title: 'Don Giovanni', poster_path: '/opera1.jpg' },
        { id: 102, title: 'La Traviata', poster_path: '/opera2.jpg' }
      ]
      wrapper.vm.unratedMoviesLoading = false
      wrapper.vm.unratedMoviesError = null
      wrapper.vm.unratedMoviesSearchType = 'general'
      
      await wrapper.vm.$nextTick()
      
      // Check all conditions for More from section
      console.log('More from section conditions:')
      console.log('- displayableUnratedMovies.length:', wrapper.vm.displayableUnratedMovies.length)
      console.log('- unratedMoviesLoading:', wrapper.vm.unratedMoviesLoading)
      console.log('- unratedMoviesError:', wrapper.vm.unratedMoviesError)
      console.log('- paginatedSortedResults.length:', wrapper.vm.paginatedSortedResults.length)
      
      // All conditions should be met
      expect(wrapper.vm.displayableUnratedMovies.length).toBeGreaterThan(0)
      expect(wrapper.vm.unratedMoviesLoading).toBe(false)
      expect(wrapper.vm.unratedMoviesError).toBe(null)
      expect(wrapper.vm.paginatedSortedResults.length).toBeGreaterThan(0)
      
      // More from section should be visible
      const moreFromSection = wrapper.find('.unrated-movies-grid')
      expect(moreFromSection.exists()).toBe(true)
    })
  })

  describe('Debug random shuffle mechanism', () => {
    it('should verify countedKeywords contains opera', () => {
      const keywords = wrapper.vm.countedKeywords
      console.log('Available keywords:', Object.keys(keywords))
      console.log('Opera count:', keywords['opera'])
      
      expect(keywords).toHaveProperty('opera')
      expect(keywords['opera']).toBeGreaterThan(0)
    })

    it('should test random value selection logic', () => {
      const keywords = wrapper.vm.countedKeywords
      const keywordsList = Object.keys(keywords)
      
      console.log('Keywords list:', keywordsList)
      console.log('Keywords with counts:', keywords)
      
      // Test that "opera" would be selected with specific random value
      const operaIndex = keywordsList.indexOf('opera')
      expect(operaIndex).toBeGreaterThanOrEqual(0)
      
      // Test minimum count logic (should be 3 for opera)
      expect(keywords['opera']).toBeGreaterThanOrEqual(3)
    })
  })
})
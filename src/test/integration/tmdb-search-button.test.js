import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'
import axios from 'axios'

// Mock external dependencies
vi.mock('axios')
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

// Mock environment variable
process.env.VUE_APP_TMDB_API_KEY = 'test-api-key'

describe('TMDB Search Method Functionality', () => {
  let wrapper
  let mockStore
  let mockAxiosGet

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    vi.clearAllTimers()
    mockAxiosGet = vi.mocked(axios.get)

    // Complete mock store based on existing test patterns
    mockStore = {
      state: {
        dbLoaded: true,
        databaseTopKey: 'test-user',
        currentLog: 'movieLog',
        DBSearchValue: '',
        DBSortValue: 'rating',
        academyAwardWinners: { bestPicture: [] },
        newEntrySearchResults: [],
        settings: {
          normalizationTweak: 0.25,
          tieBreakTweak: 1,
          includeShorts: false,
          randomSearchOnLoad: false,
          tags: { 'viewing-tags': {} }
        }
      },
      getters: {
        allMediaAsArray: [],
        allMediaSortedByRating: [],
        settings: (state) => state.settings
      },
      commit: vi.fn(),
      dispatch: vi.fn()
    }

    // Mock global methods
    global.window = { scroll: vi.fn() }
  })

  const createComponent = (data = {}) => {
    return mount(Home, {
      global: {
        mocks: {
          $store: mockStore,
          $route: { query: {} },
          $router: { push: vi.fn() }
        },
        stubs: {
          'DBGridLayoutSearchResult': true,
          'NewRatingSearch': true,
          'NoResults': true,
          'Header': true,
          'Footer': true
        }
      },
      data() {
        return {
          value: '',
          searchChips: [],
          ...data
        }
      }
    })
  }

  describe('effectiveSearchTerm computed property', () => {
    it('returns search input value when present', async () => {
      wrapper = createComponent({ value: 'Inception' })
      expect(wrapper.vm.effectiveSearchTerm).toBe('Inception')
    })

    it('returns search chip value when no input', async () => {
      wrapper = createComponent({ 
        value: '',
        searchChips: [{ type: 'search', value: 'Batman' }]
      })
      expect(wrapper.vm.effectiveSearchTerm).toBe('Batman')
    })

    it('returns director chip value when no search input or search chip', async () => {
      wrapper = createComponent({ 
        value: '',
        searchChips: [{ type: 'director', value: 'Christopher Nolan' }]
      })
      expect(wrapper.vm.effectiveSearchTerm).toBe('Christopher Nolan')
    })

    it('prioritizes search input over chips', async () => {
      wrapper = createComponent({ 
        value: 'Inception',
        searchChips: [{ type: 'director', value: 'Christopher Nolan' }]
      })
      expect(wrapper.vm.effectiveSearchTerm).toBe('Inception')
    })

    it('prioritizes search chip over other chip types', async () => {
      wrapper = createComponent({ 
        value: '',
        searchChips: [
          { type: 'director', value: 'Steven Spielberg' },
          { type: 'search', value: 'Jurassic' }
        ]
      })
      expect(wrapper.vm.effectiveSearchTerm).toBe('Jurassic')
    })

    it('returns empty string when no search terms or chips', async () => {
      wrapper = createComponent({ value: '', searchChips: [] })
      expect(wrapper.vm.effectiveSearchTerm).toBe('')
    })
  })

  describe('searchTMDB method', () => {
    it('calls TMDB API with search input value', async () => {
      const mockResponse = {
        data: { results: [{ id: 1, title: 'Inception', release_date: '2010-07-16' }] }
      }
      mockAxiosGet.mockResolvedValue(mockResponse)

      wrapper = createComponent({ value: 'Inception' })
      await wrapper.vm.searchTMDB()

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/search/movie?api_key=test-api-key&language=en-US&query=Inception'
      )
    })

    it('calls TMDB API with search chip value when no input', async () => {
      const mockResponse = {
        data: { results: [{ id: 2, title: 'The Dark Knight', release_date: '2008-07-18' }] }
      }
      mockAxiosGet.mockResolvedValue(mockResponse)

      wrapper = createComponent({ 
        value: '',
        searchChips: [{ type: 'search', value: 'Batman' }]
      })
      await wrapper.vm.searchTMDB()

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/search/movie?api_key=test-api-key&language=en-US&query=Batman'
      )
    })

    it('calls TMDB API with director chip value', async () => {
      const mockResponse = {
        data: { results: [{ id: 3, title: 'Jurassic Park', release_date: '1993-06-11' }] }
      }
      mockAxiosGet.mockResolvedValue(mockResponse)

      wrapper = createComponent({ 
        value: '',
        searchChips: [{ type: 'director', value: 'Steven Spielberg' }]
      })
      await wrapper.vm.searchTMDB()

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/search/movie?api_key=test-api-key&language=en-US&query=Steven Spielberg'
      )
    })

    it('does not call API when no search term or chips are present', async () => {
      wrapper = createComponent({ value: '', searchChips: [] })
      await wrapper.vm.searchTMDB()
      expect(mockAxiosGet).not.toHaveBeenCalled()
    })

    it('commits search results to store when API returns results', async () => {
      const mockResults = [
        { id: 1, title: 'Inception', release_date: '2010-07-16' },
        { id: 2, title: 'Interstellar', release_date: '2014-11-07' }
      ]
      const mockResponse = { data: { results: mockResults } }
      mockAxiosGet.mockResolvedValue(mockResponse)

      wrapper = createComponent({ value: 'Nolan' })
      
      // Mock newEntrySearch method
      const newEntrySearchSpy = vi.spyOn(wrapper.vm, 'newEntrySearch').mockImplementation(() => {})
      
      await wrapper.vm.searchTMDB()

      expect(newEntrySearchSpy).toHaveBeenCalledWith(mockResults)
      expect(window.scroll).toHaveBeenCalledWith({
        top: 0,
        left: 0,
        behavior: 'instant'
      })
    })

    it('shows no results message when API returns empty results', async () => {
      const mockResponse = { data: { results: [] } }
      mockAxiosGet.mockResolvedValue(mockResponse)

      wrapper = createComponent({ value: 'NonexistentMovie' })
      
      // Mock showNoResultsMessage method
      const showNoResultsMessageSpy = vi.spyOn(wrapper.vm, 'showNoResultsMessage').mockImplementation(() => {})
      
      await wrapper.vm.searchTMDB()

      expect(showNoResultsMessageSpy).toHaveBeenCalled()
    })

    it('works with year chips', async () => {
      const mockResponse = {
        data: { results: [{ id: 1, title: '2010 Movie', release_date: '2010-01-01' }] }
      }
      mockAxiosGet.mockResolvedValue(mockResponse)

      wrapper = createComponent({ 
        value: '',
        searchChips: [{ type: 'year', value: '2010' }]
      })
      
      await wrapper.vm.searchTMDB()

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/search/movie?api_key=test-api-key&language=en-US&query=2010'
      )
    })

    it('works with genre chips', async () => {
      const mockResponse = {
        data: { results: [{ id: 1, title: 'Action Movie', release_date: '2020-01-01' }] }
      }
      mockAxiosGet.mockResolvedValue(mockResponse)

      wrapper = createComponent({ 
        value: '',
        searchChips: [{ type: 'genre', value: 'Action' }]
      })
      
      await wrapper.vm.searchTMDB()

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/search/movie?api_key=test-api-key&language=en-US&query=Action'
      )
    })

    it('works with production company chips', async () => {
      const mockResponse = {
        data: { results: [{ id: 1, title: 'Marvel Movie', release_date: '2021-01-01' }] }
      }
      mockAxiosGet.mockResolvedValue(mockResponse)

      wrapper = createComponent({ 
        value: '',
        searchChips: [{ type: 'company', value: 'Marvel Studios' }]
      })
      
      await wrapper.vm.searchTMDB()

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/search/movie?api_key=test-api-key&language=en-US&query=Marvel Studios'
      )
    })
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

// Mock external dependencies
vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}))

vi.mock('lodash/debounce', () => ({ 
  default: vi.fn((fn) => fn) // Remove debouncing for tests
}))

// Mock the getRating utility
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({
    calculatedTotal: 8.25,
    normalizedRating: 8
  })),
  getAllRatings: vi.fn(() => [])
}))

describe('Chip Filtering System', () => {
  let wrapper
  let mockStore
  let mockMovies

  beforeEach(async () => {
    // Create test movies with various properties for filtering
    mockMovies = [
      {
        movie: {
          id: 1,
          title: 'Heat',
          release_date: '1995-12-15',
          genres: [{ name: 'Crime' }, { name: 'Drama' }],
          cast: [
            { name: 'Al Pacino', character: 'Vincent Hanna' },
            { name: 'Robert De Niro', character: 'Neil McCauley' }
          ],
          crew: [
            { name: 'Michael Mann', job: 'Director' },
            { name: 'Art Linson', job: 'Producer' }
          ],
          production_companies: [{ name: 'Warner Bros.' }],
          flatKeywords: ['crime', 'heist', 'police']
        },
        ratings: [{ calculatedTotal: 9.1, date: '2023-01-01' }],
        dbKey: 'movie-1'
      },
      {
        movie: {
          id: 2,
          title: 'The Godfather',
          release_date: '1972-03-24',
          genres: [{ name: 'Crime' }, { name: 'Drama' }],
          cast: [
            { name: 'Marlon Brando', character: 'Don Vito Corleone' },
            { name: 'Al Pacino', character: 'Michael Corleone' }
          ],
          crew: [
            { name: 'Francis Ford Coppola', job: 'Director' },
            { name: 'Albert S. Ruddy', job: 'Producer' }
          ],
          production_companies: [{ name: 'Paramount Pictures' }],
          flatKeywords: ['mafia', 'family', 'crime']
        },
        ratings: [{ calculatedTotal: 9.8, date: '2023-02-01' }],
        dbKey: 'movie-2'
      },
      {
        movie: {
          id: 3,
          title: 'Jaws',
          release_date: '1975-06-20',
          genres: [{ name: 'Thriller' }, { name: 'Adventure' }],
          cast: [
            { name: 'Roy Scheider', character: 'Martin Brody' },
            { name: 'Richard Dreyfuss', character: 'Matt Hooper' }
          ],
          crew: [
            { name: 'Steven Spielberg', job: 'Director' },
            { name: 'Richard D. Zanuck', job: 'Producer' }
          ],
          production_companies: [{ name: 'Universal Pictures' }],
          flatKeywords: ['shark', 'ocean', 'terror']
        },
        ratings: [{ calculatedTotal: 8.7, date: '2023-03-01' }],
        dbKey: 'movie-3'
      }
    ]

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
          enableRandomSearch: false
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

    await wrapper.vm.$nextTick()
  })

  describe('Filter Management', () => {
    it('should start with no active filters', () => {
      expect(wrapper.vm.activeFilters).toEqual([])
      expect(wrapper.vm.activeFiltersMinusTemps).toEqual([])
    })

    it('should add a filter', () => {
      const filter = {
        id: 'director-1',
        type: 'director',
        value: 'Steven Spielberg',
        display: 'Steven Spielberg'
      }

      // Directly add to activeFilters array (how the component actually works)
      wrapper.vm.activeFilters.push(filter)

      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.activeFilters[0]).toEqual(filter)
    })

    it('should remove a filter by id', () => {
      const filter1 = {
        id: 'director-1',
        type: 'director',
        value: 'Steven Spielberg',
        display: 'Steven Spielberg'
      }
      const filter2 = {
        id: 'genre-1',
        type: 'genre',
        value: 'Crime',
        display: 'Crime'
      }

      wrapper.vm.activeFilters.push(filter1)
      wrapper.vm.activeFilters.push(filter2)
      expect(wrapper.vm.activeFilters).toHaveLength(2)

      wrapper.vm.removeFilter('director-1')
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.activeFilters[0].id).toBe('genre-1')
    })

    it('should clear all filters', () => {
      wrapper.vm.activeFilters.push({
        id: 'director-1',
        type: 'director',
        value: 'Steven Spielberg',
        display: 'Steven Spielberg'
      })

      expect(wrapper.vm.activeFilters).toHaveLength(1)

      wrapper.vm.clearAllFilters()
      expect(wrapper.vm.activeFilters).toEqual([])
    })

    it('should filter out temp filters from activeFiltersMinusTemps', () => {
      const permanentFilter = {
        id: 'director-1',
        type: 'director',
        value: 'Steven Spielberg',
        display: 'Steven Spielberg'
      }
      const tempFilter = {
        id: 'temp-1',
        type: 'search',
        value: 'test',
        display: 'test',
        temp: true
      }

      wrapper.vm.activeFilters.push(permanentFilter)
      wrapper.vm.activeFilters.push(tempFilter)

      expect(wrapper.vm.activeFilters).toHaveLength(2)
      expect(wrapper.vm.activeFiltersMinusTemps).toHaveLength(1)
      expect(wrapper.vm.activeFiltersMinusTemps[0].id).toBe('director-1')
    })
  })

  describe('applyFilter method', () => {
    it('should filter by title', () => {
      const filter = { type: 'title', value: 'Heat' }
      
      expect(wrapper.vm.applyFilter(mockMovies[0], filter)).toBe(true) // Heat
      expect(wrapper.vm.applyFilter(mockMovies[1], filter)).toBe(false) // The Godfather
      expect(wrapper.vm.applyFilter(mockMovies[2], filter)).toBe(false) // Jaws
    })

    it('should filter by director', () => {
      const filter = { type: 'director', value: 'Steven Spielberg' }
      
      expect(wrapper.vm.applyFilter(mockMovies[0], filter)).toBe(false) // Heat (Michael Mann)
      expect(wrapper.vm.applyFilter(mockMovies[1], filter)).toBe(false) // The Godfather (Francis Ford Coppola)
      expect(wrapper.vm.applyFilter(mockMovies[2], filter)).toBe(true) // Jaws (Steven Spielberg)
    })

    it('should filter by cast/actor', () => {
      const filter = { type: 'cast', value: 'Al Pacino' }
      
      expect(wrapper.vm.applyFilter(mockMovies[0], filter)).toBe(true) // Heat (has Al Pacino)
      expect(wrapper.vm.applyFilter(mockMovies[1], filter)).toBe(true) // The Godfather (has Al Pacino)
      expect(wrapper.vm.applyFilter(mockMovies[2], filter)).toBe(false) // Jaws (no Al Pacino)
    })

    it('should filter by genre', () => {
      const filter = { type: 'genre', value: 'Crime' }
      
      expect(wrapper.vm.applyFilter(mockMovies[0], filter)).toBe(true) // Heat (Crime genre)
      expect(wrapper.vm.applyFilter(mockMovies[1], filter)).toBe(true) // The Godfather (Crime genre)
      expect(wrapper.vm.applyFilter(mockMovies[2], filter)).toBe(false) // Jaws (Thriller/Adventure)
    })

    it('should filter by production company', () => {
      const filter = { type: 'company', value: 'Warner Bros.' }
      
      expect(wrapper.vm.applyFilter(mockMovies[0], filter)).toBe(true) // Heat (Warner Bros.)
      expect(wrapper.vm.applyFilter(mockMovies[1], filter)).toBe(false) // The Godfather (Paramount)
      expect(wrapper.vm.applyFilter(mockMovies[2], filter)).toBe(false) // Jaws (Universal)
    })

    it('should filter by year', () => {
      const filter = { type: 'year', value: '1995' }
      
      expect(wrapper.vm.applyFilter(mockMovies[0], filter)).toBe(true) // Heat (1995)
      expect(wrapper.vm.applyFilter(mockMovies[1], filter)).toBe(false) // The Godfather (1972)
      expect(wrapper.vm.applyFilter(mockMovies[2], filter)).toBe(false) // Jaws (1975)
    })

    it('should filter by keyword', () => {
      const filter = { type: 'keyword', value: 'crime' }
      
      expect(wrapper.vm.applyFilter(mockMovies[0], filter)).toBe(true) // Heat (has 'crime' keyword)
      expect(wrapper.vm.applyFilter(mockMovies[1], filter)).toBe(true) // The Godfather (has 'crime' keyword)
      expect(wrapper.vm.applyFilter(mockMovies[2], filter)).toBe(false) // Jaws (no 'crime' keyword)
    })

    it('should handle general search across multiple fields', () => {
      const filter = { type: 'general', value: 'Al Pacino' }
      
      // Should match both movies with Al Pacino in cast
      expect(wrapper.vm.applyFilter(mockMovies[0], filter)).toBe(true) // Heat
      expect(wrapper.vm.applyFilter(mockMovies[1], filter)).toBe(true) // The Godfather
      expect(wrapper.vm.applyFilter(mockMovies[2], filter)).toBe(false) // Jaws
    })
  })

  describe('Filter Intersection Logic', () => {
    it('should apply multiple filters with AND logic (intersection)', () => {
      // Add two filters: Crime genre AND Al Pacino
      wrapper.vm.activeFilters.push({
        id: 'genre-1',
        type: 'genre',
        value: 'Crime',
        display: 'Crime'
      })
      wrapper.vm.activeFilters.push({
        id: 'cast-1',
        type: 'cast',
        value: 'Al Pacino',
        display: 'Al Pacino'
      })

      const results = wrapper.vm.unifiedFilteredResults

      // Should only return movies that have BOTH Crime genre AND Al Pacino
      expect(results).toHaveLength(2) // Heat and The Godfather
      expect(results.map(r => r.movie.title)).toContain('Heat')
      expect(results.map(r => r.movie.title)).toContain('The Godfather')
      expect(results.map(r => r.movie.title)).not.toContain('Jaws') // Has neither Crime genre nor Al Pacino
    })

    it('should handle strict filtering when no movies match all criteria', () => {
      // Add incompatible filters: Steven Spielberg director AND Crime genre
      wrapper.vm.activeFilters.push({
        id: 'director-1',
        type: 'director',
        value: 'Steven Spielberg',
        display: 'Steven Spielberg'
      })
      wrapper.vm.activeFilters.push({
        id: 'genre-1',
        type: 'genre',
        value: 'Crime',
        display: 'Crime'
      })

      const results = wrapper.vm.unifiedFilteredResults

      // No movies should match (Spielberg doesn't direct Crime movies in our test data)
      expect(results).toHaveLength(0)
    })
  })

  describe('effectiveSearchTerm', () => {
    it('should return general filter value when general chip is active', () => {
      wrapper.vm.activeFilters.push({
        id: 'general-1',
        type: 'general',
        value: 'Heat',
        display: 'Heat'
      })

      expect(wrapper.vm.effectiveSearchTerm).toBe('Heat')
    })

    it('should return person filter value when person chip is active', () => {
      wrapper.vm.activeFilters.push({
        id: 'person-1',
        type: 'person',
        value: 'Steven Spielberg',
        display: 'Steven Spielberg'
      })

      expect(wrapper.vm.effectiveSearchTerm).toBe('Steven Spielberg')
    })

    it('should prioritize general filters over other types (based on filterTypes order)', () => {
      wrapper.vm.activeFilters.push({
        id: 'person-1',
        type: 'person',
        value: 'Steven Spielberg',
        display: 'Steven Spielberg'
      })
      wrapper.vm.activeFilters.push({
        id: 'general-1',
        type: 'general',
        value: 'Heat',
        display: 'Heat'
      })

      expect(wrapper.vm.effectiveSearchTerm).toBe('Heat') // general has higher priority
    })

    it('should return genre filter value when only genre filter is active', () => {
      wrapper.vm.activeFilters.push({
        id: 'genre-1',
        type: 'genre',
        value: 'Crime',
        display: 'Crime'
      })

      expect(wrapper.vm.effectiveSearchTerm).toBe('Crime')
    })
  })

  describe('Edge Cases', () => {
    it('should handle case-insensitive filtering', () => {
      const filter = { type: 'title', value: 'heat' } // lowercase
      
      expect(wrapper.vm.applyFilter(mockMovies[0], filter)).toBe(true) // Should match "Heat"
    })

    it('should handle partial matches in titles', () => {
      const filter = { type: 'title', value: 'God' } // partial
      
      expect(wrapper.vm.applyFilter(mockMovies[1], filter)).toBe(true) // Should match "The Godfather"
    })

    it('should handle empty filter values', () => {
      const filter = { type: 'title', value: '' }
      
      // Empty filter should match everything (this appears to be the actual behavior)
      expect(wrapper.vm.applyFilter(mockMovies[0], filter)).toBe(true)
    })

    it('should handle filters with missing movie properties gracefully', () => {
      const incompleteMovie = {
        movie: {
          id: 999,
          title: 'Incomplete Movie'
          // Missing cast, crew, genres, etc.
        },
        ratings: [{ calculatedTotal: 7.0, date: '2023-01-01' }],
        dbKey: 'incomplete'
      }

      const castFilter = { type: 'cast', value: 'Al Pacino' }
      const genreFilter = { type: 'genre', value: 'Crime' }
      
      // Should not crash, should return a value (even if undefined)
      expect(() => wrapper.vm.applyFilter(incompleteMovie, castFilter)).not.toThrow()
      expect(() => wrapper.vm.applyFilter(incompleteMovie, genreFilter)).not.toThrow()
    })
  })
})
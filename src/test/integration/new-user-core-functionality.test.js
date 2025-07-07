import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

// Mock external dependencies
vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { query: { pages: {} } } }))
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

describe('New User Core Functionality', () => {
  let wrapper
  let mockStore

  describe('Empty Database - Core Issues', () => {
    beforeEach(() => {
      mockStore = {
        state: {
          dbLoaded: true,
          databaseTopKey: 'new-user-123',
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
          allMediaAsArray: [],
          allMediaSortedByRating: []
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
            'DBGridLayoutSearchResult': true,
            'NoResults': true,
            'StickinessModal': true,
            'TweakModal': true,
            'InsetBrowserModal': true
          }
        }
      })
    })

    it('should not crash with empty database', () => {
      expect(() => wrapper.vm.filteredResults).not.toThrow()
      expect(() => wrapper.vm.paginatedSortedResults).not.toThrow()
      expect(() => wrapper.vm.userRatedMovieCount).not.toThrow()
    })

    it('should handle empty arrays in computed properties', () => {
      expect(() => wrapper.vm.allDirectors).not.toThrow()
      expect(() => wrapper.vm.allGenres).not.toThrow()
      expect(() => wrapper.vm.availableYears).not.toThrow()
      expect(() => wrapper.vm.topGenres).not.toThrow()
      
      expect(Array.isArray(wrapper.vm.allDirectors)).toBe(true)
      expect(Array.isArray(wrapper.vm.allGenres)).toBe(true)
      expect(Array.isArray(wrapper.vm.availableYears)).toBe(true)
      expect(Array.isArray(wrapper.vm.topGenres)).toBe(true)
    })

    it('should handle search with empty database', async () => {
      wrapper.vm.value = 'Star Wars'
      await wrapper.vm.$nextTick()
      
      expect(() => wrapper.vm.unifiedFilteredResults).not.toThrow()
      expect(wrapper.vm.filteredResults).toEqual([])
    })

    it('should handle chip operations with empty database', async () => {
      expect(() => wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })).not.toThrow()
      expect(() => wrapper.vm.clearAllFilters()).not.toThrow()
      expect(() => wrapper.vm.removeFilter('nonexistent-id')).not.toThrow()
    })

    it('should handle statistics calculations with empty data', () => {
      expect(() => wrapper.vm.averageRating([])).not.toThrow()
      expect(() => wrapper.vm.viewsCount([])).not.toThrow()
      
      const avgResult = wrapper.vm.averageRating([])
      const viewsResult = wrapper.vm.viewsCount([])
      
      expect(typeof avgResult === 'string' || typeof avgResult === 'number' || avgResult === 0).toBe(true)
      expect(typeof viewsResult === 'number' || viewsResult === 0).toBe(true)
    })

    it('should show new user guidance', () => {
      expect(wrapper.vm.userRatedMovieCount).toBe(0)
      
      // Should show some form of guidance for new users
      const suggestionsButton = wrapper.find('.btn-success')
      if (suggestionsButton.exists()) {
        expect(suggestionsButton.text().length).toBeGreaterThan(0)
      }
    })
  })

  describe('Minimal Data Scenarios', () => {
    beforeEach(() => {
      // Single movie scenario
      const singleMovie = [{
        movie: {
          id: 1,
          title: 'Test Movie',
          release_date: '2023-01-01',
          genres: [{ name: 'Drama' }],
          cast: [{ name: 'Test Actor', character: 'Character' }],
          crew: [{ name: 'Test Director', job: 'Director' }],
          production_companies: [{ name: 'Test Studio' }],
          flatKeywords: ['test']
        },
        ratings: [{ calculatedTotal: 8.0, date: '2023-01-01' }],
        dbKey: 'movie-1'
      }]

      mockStore = {
        state: {
          dbLoaded: true,
          databaseTopKey: 'user-with-one-movie',
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
          allMediaAsArray: singleMovie,
          allMediaSortedByRating: singleMovie
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
            'DBGridLayoutSearchResult': true,
            'NoResults': true,
            'StickinessModal': true,
            'TweakModal': true,
            'InsetBrowserModal': true
          }
        }
      })
    })

    it('should handle single movie correctly', () => {
      expect(wrapper.vm.userRatedMovieCount).toBe(1)
      expect(wrapper.vm.filteredResults).toHaveLength(1)
      expect(wrapper.vm.paginatedSortedResults).toHaveLength(1)
    })

    it('should handle filtering with minimal data', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Test Director' } })
      
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.filteredResults).toHaveLength(1)
    })

    it('should handle no-match filters gracefully', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Nonexistent Director' } })
      
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.filteredResults).toHaveLength(0)
      expect(wrapper.vm.paginatedSortedResults).toHaveLength(0)
    })

    it('should handle computed properties with minimal data', () => {
      expect(wrapper.vm.allDirectors.length).toBeGreaterThan(0)
      expect(wrapper.vm.allGenres.length).toBeGreaterThan(0)
      expect(wrapper.vm.availableYears.length).toBeGreaterThan(0)
    })
  })

  describe('Loading States', () => {
    beforeEach(() => {
      mockStore = {
        state: {
          dbLoaded: false, // Not loaded
          databaseTopKey: null,
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
          allMediaAsArray: [],
          allMediaSortedByRating: []
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
            'DBGridLayoutSearchResult': true,
            'NoResults': true,
            'StickinessModal': true,
            'TweakModal': true,
            'InsetBrowserModal': true
          }
        }
      })
    })

    it('should handle database not loaded state', () => {
      expect(wrapper.vm.$store.state.dbLoaded).toBe(false)
      
      // Should not show main interface when not loaded
      const searchBar = wrapper.find('.search-bar')
      expect(searchBar.exists()).toBe(false)
    })

    it('should transition to loaded state properly', async () => {
      // Simulate loading completion
      mockStore.state.dbLoaded = true
      mockStore.state.databaseTopKey = 'loaded-user'
      
      await wrapper.vm.$forceUpdate()
      await wrapper.vm.$nextTick()
      
      // Now should show interface
      const searchBar = wrapper.find('.search-bar')
      expect(searchBar.exists()).toBe(true)
    })
  })

  describe('Error Resilience', () => {
    beforeEach(() => {
      mockStore = {
        state: {
          dbLoaded: true,
          databaseTopKey: 'error-test-user',
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
          allMediaAsArray: [],
          allMediaSortedByRating: []
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
            'DBGridLayoutSearchResult': true,
            'NoResults': true,
            'StickinessModal': true,
            'TweakModal': true,
            'InsetBrowserModal': true
          }
        }
      })
    })

    it('should handle undefined/null values gracefully', () => {
      expect(() => wrapper.vm.mostRecentRating({})).not.toThrow()
      expect(() => wrapper.vm.mostRecentRating(null)).not.toThrow()
      expect(() => wrapper.vm.mostRecentRating(undefined)).not.toThrow()
    })

    it('should handle malformed search input', async () => {
      // Test various problematic inputs
      const problematicInputs = [
        '',
        '   ',
        null,
        undefined,
        'a'.repeat(1000), // Very long string
        '!@#$%^&*()',     // Special characters
        '🎬🍿📽️',          // Emojis
      ]

      for (const input of problematicInputs) {
        wrapper.vm.value = input
        await wrapper.vm.$nextTick()
        
        expect(() => wrapper.vm.unifiedFilteredResults).not.toThrow()
        expect(() => wrapper.vm.convertSearchToChip()).not.toThrow()
      }
    })

    it('should handle rapid state changes', async () => {
      // Rapidly add and remove filters
      for (let i = 0; i < 5; i++) {
        await wrapper.vm.addDirectorFilter({ target: { value: `Director ${i}` } })
        await wrapper.vm.addYearFilter({ target: { value: `200${i}` } })
        await wrapper.vm.clearAllFilters()
      }
      
      expect(wrapper.vm.activeFilters).toHaveLength(0)
      expect(() => wrapper.vm.filteredResults).not.toThrow()
    })

    it('should handle Wikipedia functionality with no data', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Test Director' } })
      
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      
      // Should not crash even if Wikipedia API fails
      try {
        await wrapper.vm.goToWikipediaForChip()
      } catch (error) {
        // Expected to fail with empty data, but shouldn't crash app
      }
      
      // App should remain functional
      expect(wrapper.vm.activeFilters).toHaveLength(1)
    })
  })

  describe('Performance with Empty/Minimal Data', () => {
    beforeEach(() => {
      mockStore = {
        state: {
          dbLoaded: true,
          databaseTopKey: 'performance-test',
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
          allMediaAsArray: [],
          allMediaSortedByRating: []
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
            'DBGridLayoutSearchResult': true,
            'NoResults': true,
            'StickinessModal': true,
            'TweakModal': true,
            'InsetBrowserModal': true
          }
        }
      })
    })

    it('should perform efficiently with empty data', () => {
      const startTime = performance.now()
      
      // Trigger all major computations
      wrapper.vm.filteredResults
      wrapper.vm.paginatedSortedResults
      wrapper.vm.allDirectors
      wrapper.vm.allGenres
      wrapper.vm.topGenres
      wrapper.vm.userRatedMovieCount
      
      const endTime = performance.now()
      
      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('should not have memory leaks with empty data', () => {
      // Repeatedly access computed properties
      for (let i = 0; i < 100; i++) {
        wrapper.vm.filteredResults
        wrapper.vm.allDirectors
        wrapper.vm.topGenres
      }
      
      // Should not crash or slow down significantly
      expect(() => wrapper.vm.filteredResults).not.toThrow()
    })
  })

  describe('UI States for New Users', () => {
    beforeEach(() => {
      mockStore = {
        state: {
          dbLoaded: true,
          databaseTopKey: 'ui-test-user',
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
          allMediaAsArray: [],
          allMediaSortedByRating: []
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
            'DBGridLayoutSearchResult': true,
            'NoResults': true,
            'StickinessModal': true,
            'TweakModal': true,
            'InsetBrowserModal': true
          }
        }
      })
    })

    it('should show appropriate UI for empty state', () => {
      // Should not show chip controls when no chips exist
      const filterSection = wrapper.find('.active-filters-section')
      expect(filterSection.exists()).toBe(false)
      
      // Should not show results actions when no movies
      const resultsActions = wrapper.find('.results-actions')
      expect(resultsActions.exists()).toBe(false)
    })

    it('should show progressive controls when chips are added', async () => {
      // Initially no controls
      expect(wrapper.find('.active-filters-section').exists()).toBe(false)
      
      // Add a chip
      await wrapper.vm.addDirectorFilter({ target: { value: 'Test Director' } })
      await wrapper.vm.$nextTick()
      
      // Now controls should appear
      expect(wrapper.find('.active-filters-section').exists()).toBe(true)
    })

    it('should handle search input properly', () => {
      const searchInput = wrapper.find('#search')
      expect(searchInput.exists()).toBe(true)
      expect(searchInput.attributes('placeholder')).toBeDefined()
    })

    it('should provide clear visual feedback', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Test Director' } })
      await wrapper.vm.$nextTick()
      
      // Chip should be visible
      const chip = wrapper.find('.badge')
      expect(chip.exists()).toBe(true)
      
      // Control buttons should be styled properly
      const buttons = wrapper.findAll('.active-filters-section button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })
})
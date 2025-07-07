import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

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

describe('New User Onboarding', () => {
  let wrapper
  let mockStore

  describe('Completely Empty Database', () => {
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
            // Default settings for a new user
            normalizationTweak: 0.25,
            tieBreakTweak: 1,
            includeShorts: false,
            tags: { 'viewing-tags': {} },
            enableRandomSearch: true // Default for new users
          },
          filteredResults: []
        },
        getters: {
          allMediaAsArray: [], // Completely empty
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

    it('should handle empty database gracefully without errors', () => {
      expect(wrapper.vm.$store.getters.allMediaAsArray).toEqual([])
      expect(wrapper.vm.filteredResults).toEqual([])
      expect(wrapper.vm.paginatedSortedResults).toEqual([])
      
      // Should not throw errors
      expect(() => wrapper.vm.averageRating([])).not.toThrow()
      expect(() => wrapper.vm.viewsCount([])).not.toThrow()
    })

    it('should show suggestions button for new users with less than 10 movies', async () => {
      expect(wrapper.vm.userRatedMovieCount).toBe(0)
      expect(wrapper.vm.showSuggestionsOnly).toBe(false)
      
      await wrapper.vm.$nextTick()
      
      // Should show suggestions button
      const suggestionsButton = wrapper.find('.btn-success')
      expect(suggestionsButton.exists()).toBe(true)
      expect(suggestionsButton.text()).toMatch(/suggest/i)
    })

    it('should handle search with no results gracefully', async () => {
      wrapper.vm.value = 'nonexistent movie'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.filteredResults).toEqual([])
      expect(wrapper.vm.paginatedSortedResults).toEqual([])
      
      // Should not crash when searching with empty database
      expect(() => wrapper.vm.unifiedFilteredResults).not.toThrow()
    })

    it('should handle chip operations with empty database', async () => {
      // Should not crash when adding chips to empty database
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.filteredResults).toEqual([]) // No movies to filter
      expect(wrapper.vm.paginatedSortedResults).toEqual([])
    })

    it('should handle empty computed properties safely', () => {
      // These should not crash with empty data
      expect(wrapper.vm.allDirectors).toEqual([])
      expect(wrapper.vm.allGenres).toEqual([])
      expect(wrapper.vm.availableYears).toEqual([])
      expect(wrapper.vm.topGenres).toEqual([])
      expect(wrapper.vm.userTags).toEqual([])
    })

    it('should handle Wikipedia functionality with empty database', async () => {
      // Add a chip even with empty database
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      // Wikipedia button should appear
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      
      // Should not crash when trying to get Wikipedia info
      expect(() => wrapper.vm.goToWikipediaForChip()).not.toThrow()
    })

    it('should handle random search with empty database', async () => {
      // Should not crash when trying random search with no movies
      expect(() => wrapper.vm.checkResultsAndFindFilter()).not.toThrow()
      
      // Should not set random search values
      expect(wrapper.vm.value).toBe('')
      expect(wrapper.vm.hasAutoRandomChip).toBe(false)
    })
  })

  describe('Database Loading States', () => {
    beforeEach(() => {
      mockStore = {
        state: {
          dbLoaded: false, // Database not loaded yet
          databaseTopKey: null,
          currentLog: 'movieLog',
          DBSearchValue: '',
          DBSortValue: 'rating',
          academyAwardWinners: { bestPicture: [] },
          settings: null, // Settings not loaded
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
      
      // Search bar should not be shown when database not loaded
      const searchBar = wrapper.find('.search-bar')
      expect(searchBar.exists()).toBe(false)
    })

    it('should handle null settings gracefully', () => {
      expect(wrapper.vm.$store.state.settings).toBe(null)
      
      // Should not crash with null settings
      expect(() => wrapper.vm.enableRandomSearch).not.toThrow()
      expect(wrapper.vm.enableRandomSearch).toBe(null)
    })

    it('should handle transition from loading to loaded state', async () => {
      // Initially not loaded
      expect(wrapper.vm.$store.state.dbLoaded).toBe(false)
      
      // Simulate database loading
      mockStore.state.dbLoaded = true
      mockStore.state.databaseTopKey = 'new-user-123'
      mockStore.state.settings = {
        normalizationTweak: 0.25,
        tieBreakTweak: 1,
        includeShorts: false,
        tags: { 'viewing-tags': {} },
        enableRandomSearch: true
      }
      
      await wrapper.vm.$forceUpdate()
      await wrapper.vm.$nextTick()
      
      // Now search bar should be available
      const searchBar = wrapper.find('.search-bar')
      expect(searchBar.exists()).toBe(true)
    })
  })

  describe('First Movie Scenarios', () => {
    beforeEach(() => {
      // User with exactly one movie
      const oneMovie = [{
        movie: {
          id: 1,
          title: 'The Shawshank Redemption',
          release_date: '1994-09-23',
          genres: [{ name: 'Drama' }],
          cast: [{ name: 'Tim Robbins', character: 'Andy Dufresne' }],
          crew: [{ name: 'Frank Darabont', job: 'Director' }],
          production_companies: [{ name: 'Castle Rock Entertainment' }],
          flatKeywords: ['prison', 'hope']
        },
        ratings: [{ calculatedTotal: 9.5, date: '2023-01-01' }],
        dbKey: 'movie-1'
      }]

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
          allMediaAsArray: oneMovie,
          allMediaSortedByRating: oneMovie
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

    it('should handle single movie database correctly', () => {
      expect(wrapper.vm.allMediaAsArray).toHaveLength(1)
      expect(wrapper.vm.userRatedMovieCount).toBe(1)
      expect(wrapper.vm.filteredResults).toHaveLength(1)
    })

    it('should still show suggestions for users with less than 10 movies', async () => {
      expect(wrapper.vm.userRatedMovieCount).toBe(1)
      
      await wrapper.vm.$nextTick()
      
      const suggestionsButton = wrapper.find('.btn-success')
      expect(suggestionsButton.exists()).toBe(true)
    })

    it('should handle filtering with minimal data', async () => {
      // Filter by the only director
      await wrapper.vm.addDirectorFilter({ target: { value: 'Frank Darabont' } })
      
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.filteredResults).toHaveLength(1)
      expect(wrapper.vm.filteredResults[0].movie.title).toBe('The Shawshank Redemption')
    })

    it('should handle filtering that results in no matches', async () => {
      // Filter by non-existent director
      await wrapper.vm.addDirectorFilter({ target: { value: 'Christopher Nolan' } })
      
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.filteredResults).toHaveLength(0)
      expect(wrapper.vm.paginatedSortedResults).toHaveLength(0)
    })

    it('should handle computed properties with minimal data', () => {
      expect(wrapper.vm.allDirectors).toHaveLength(1)
      expect(wrapper.vm.allDirectors[0].name).toBe('Frank Darabont')
      expect(wrapper.vm.allGenres).toHaveLength(1)
      expect(wrapper.vm.allGenres[0].name).toBe('Drama')
      expect(wrapper.vm.availableYears).toEqual(['1994'])
      expect(wrapper.vm.topGenres).toHaveLength(1)
      expect(wrapper.vm.topGenres[0].name).toBe('Drama')
      expect(wrapper.vm.topGenres[0].count).toBe(1)
    })
  })

  describe('Error Handling for New Users', () => {
    beforeEach(() => {
      mockStore = {
        state: {
          dbLoaded: true,
          databaseTopKey: 'new-user-123',
          currentLog: 'movieLog',
          DBSearchValue: '',
          DBSortValue: 'rating',
          academyAwardWinners: null, // Potential error state
          settings: {
            // Minimal settings
            enableRandomSearch: false
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

    it('should handle null academyAwardWinners gracefully', () => {
      expect(wrapper.vm.$store.state.academyAwardWinners).toBe(null)
      
      // Should not crash when accessing award winners
      expect(() => wrapper.vm.filteredResults).not.toThrow()
    })

    it('should handle missing settings properties', () => {
      // Settings missing most properties
      expect(wrapper.vm.$store.state.settings.normalizationTweak).toBeUndefined()
      expect(wrapper.vm.$store.state.settings.tags).toBeUndefined()
      
      // Should handle missing tags gracefully
      expect(() => wrapper.vm.userTags).not.toThrow()
      expect(wrapper.vm.userTags).toEqual([])
    })

    it('should handle malformed movie data gracefully', () => {
      // Add malformed movie data
      const malformedMovie = [{
        movie: {
          id: 1,
          title: 'Test Movie',
          // Missing many expected properties
        },
        ratings: [{ calculatedTotal: 8.0 }],
        dbKey: 'movie-1'
      }]

      mockStore.getters.allMediaAsArray = malformedMovie
      mockStore.getters.allMediaSortedByRating = malformedMovie

      // Should not crash with malformed data
      expect(() => wrapper.vm.allDirectors).not.toThrow()
      expect(() => wrapper.vm.allGenres).not.toThrow()
      expect(() => wrapper.vm.availableYears).not.toThrow()
    })

    it('should handle API failures gracefully', async () => {
      // Mock API failure for unrated movies
      const axios = await import('axios')
      vi.spyOn(axios.default, 'get').mockRejectedValue(new Error('Network error'))
      
      // Add a chip to trigger API call
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      // Should handle API failure without crashing the app state
      try {
        await wrapper.vm.goToWikipediaForChip()
      } catch (error) {
        // Expected to throw, but app should remain functional
        expect(error.message).toBe('Network error')
      }
      
      // App should still be usable
      expect(wrapper.vm.activeFilters).toHaveLength(1)
    })
  })

  describe('Performance with Minimal Data', () => {
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

    it('should perform efficiently with empty arrays', () => {
      const startTime = performance.now()
      
      // Trigger expensive computations
      wrapper.vm.filteredResults
      wrapper.vm.paginatedSortedResults
      wrapper.vm.allDirectors
      wrapper.vm.allGenres
      wrapper.vm.topGenres
      
      const endTime = performance.now()
      
      // Should complete quickly even with empty data
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('should handle rapid state changes without errors', async () => {
      // Rapidly add and remove chips
      await wrapper.vm.addDirectorFilter({ target: { value: 'Director 1' } })
      await wrapper.vm.addYearFilter({ target: { value: '2020' } })
      await wrapper.vm.clearAllFilters()
      await wrapper.vm.addGenreFilter({ target: { value: 'Action' } })
      await wrapper.vm.clearAllFilters()
      
      // Should handle rapid changes without errors
      expect(wrapper.vm.activeFilters).toHaveLength(0)
      expect(() => wrapper.vm.filteredResults).not.toThrow()
    })
  })

  describe('UI State for New Users', () => {
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

    it('should not show chip control buttons when no chips exist', () => {
      expect(wrapper.vm.activeFilters).toHaveLength(0)
      
      // Filter section should not be shown
      const filterSection = wrapper.find('.active-filters-section')
      expect(filterSection.exists()).toBe(false)
    })

    it('should not show Wikipedia button with no chips', () => {
      const wikiButton = wrapper.find('[title="Wikipedia Info"]')
      expect(wikiButton.exists()).toBe(false)
    })

    it('should not show results actions when no movies exist', () => {
      const resultsActions = wrapper.find('.results-actions')
      expect(resultsActions.exists()).toBe(false)
    })

    it('should show appropriate placeholder state', () => {
      // With no movies, should show suggestions or empty state
      expect(wrapper.vm.userRatedMovieCount).toBe(0)
      expect(wrapper.vm.paginatedSortedResults).toHaveLength(0)
    })
  })
})
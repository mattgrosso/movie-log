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

describe('New User UI/UX Experience', () => {
  let wrapper
  let mockStore

  describe('First Load Experience', () => {
    beforeEach(() => {
      mockStore = {
        state: {
          dbLoaded: false, // Simulating initial load
          databaseTopKey: null,
          currentLog: 'movieLog',
          DBSearchValue: '',
          DBSortValue: 'rating',
          academyAwardWinners: { bestPicture: [] },
          settings: null,
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

    it('should show appropriate loading state when database is not loaded', () => {
      expect(wrapper.vm.$store.state.dbLoaded).toBe(false)
      
      // Main interface should be hidden
      const searchBar = wrapper.find('.search-bar')
      expect(searchBar.exists()).toBe(false)
      
      // Should not show any results or error states
      const results = wrapper.find('.results')
      expect(results.exists()).toBe(false)
    })

    it('should gracefully transition from loading to loaded state', async () => {
      // Initially loading
      expect(wrapper.find('.search-bar').exists()).toBe(false)
      
      // Simulate database loading completion
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
      
      // Now interface should be available
      const searchBar = wrapper.find('.search-bar')
      expect(searchBar.exists()).toBe(true)
    })

    it('should handle incomplete database load gracefully', async () => {
      // Database loaded but missing settings
      mockStore.state.dbLoaded = true
      mockStore.state.databaseTopKey = 'new-user-123'
      // settings still null
      
      await wrapper.vm.$forceUpdate()
      await wrapper.vm.$nextTick()
      
      // Should not crash with incomplete load
      expect(() => wrapper.vm.enableRandomSearch).not.toThrow()
      const searchBar = wrapper.find('.search-bar')
      expect(searchBar.exists()).toBe(true)
    })
  })

  describe('Empty State Guidance', () => {
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

    it('should show suggestions button for new users with no movies', () => {
      expect(wrapper.vm.userRatedMovieCount).toBe(0)
      expect(wrapper.vm.allMediaAsArray).toHaveLength(0)
      
      // Should show suggestions button to help new users get started
      const suggestionsButton = wrapper.find('.btn-success')
      expect(suggestionsButton.exists()).toBe(true)
      expect(suggestionsButton.text()).toMatch(/suggestions?/i)
    })

    it('should show helpful placeholder text in search input', () => {
      const searchInput = wrapper.find('#search')
      expect(searchInput.exists()).toBe(true)
      
      // Should have helpful placeholder
      const placeholder = searchInput.attributes('placeholder')
      expect(placeholder).toBeDefined()
      expect(placeholder.length).toBeGreaterThan(0)
    })

    it('should not show overwhelming controls to new users', () => {
      // Should not show complex filtering options when there are no movies
      const filterSection = wrapper.find('.active-filters-section')
      expect(filterSection.exists()).toBe(false)
      
      // Should not show results actions
      const resultsActions = wrapper.find('.results-actions')
      expect(resultsActions.exists()).toBe(false)
    })

    it('should handle search attempts with empty database gracefully', async () => {
      const searchInput = wrapper.find('#search')
      await searchInput.setValue('Star Wars')
      await searchInput.trigger('input')
      
      // Should not crash or show confusing error states
      expect(wrapper.vm.filteredResults).toEqual([])
      expect(wrapper.vm.paginatedSortedResults).toEqual([])
      
      // Should still show search interface
      expect(searchInput.exists()).toBe(true)
    })
  })

  describe('Progressive Feature Discovery', () => {
    beforeEach(() => {
      // User with a few movies (3-5) - typical early user state
      const earlyUserMovies = [
        {
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
        },
        {
          movie: {
            id: 2,
            title: 'The Godfather',
            release_date: '1972-03-24',
            genres: [{ name: 'Crime' }, { name: 'Drama' }],
            cast: [{ name: 'Marlon Brando', character: 'Don Vito Corleone' }],
            crew: [{ name: 'Francis Ford Coppola', job: 'Director' }],
            production_companies: [{ name: 'Paramount Pictures' }],
            flatKeywords: ['mafia', 'family']
          },
          ratings: [{ calculatedTotal: 9.2, date: '2023-01-02' }],
          dbKey: 'movie-2'
        },
        {
          movie: {
            id: 3,
            title: 'Pulp Fiction',
            release_date: '1994-10-14',
            genres: [{ name: 'Crime' }, { name: 'Drama' }],
            cast: [{ name: 'John Travolta', character: 'Vincent Vega' }],
            crew: [{ name: 'Quentin Tarantino', job: 'Director' }],
            production_companies: [{ name: 'Miramax' }],
            flatKeywords: ['nonlinear', 'dialogue']
          },
          ratings: [{ calculatedTotal: 8.9, date: '2023-01-03' }],
          dbKey: 'movie-3'
        }
      ]

      mockStore = {
        state: {
          dbLoaded: true,
          databaseTopKey: 'early-user-123',
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
          allMediaAsArray: earlyUserMovies,
          allMediaSortedByRating: earlyUserMovies
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

    it('should still show suggestions for users with few movies', () => {
      expect(wrapper.vm.userRatedMovieCount).toBe(3)
      expect(wrapper.vm.userRatedMovieCount).toBeLessThan(10)
      
      // Should still encourage exploring more movies
      const suggestionsButton = wrapper.find('.btn-success')
      expect(suggestionsButton.exists()).toBe(true)
    })

    it('should show chip functionality when searching', async () => {
      // Search for a director
      wrapper.vm.value = 'Frank Darabont'
      await wrapper.vm.$nextTick()
      
      // Should show search results
      expect(wrapper.vm.filteredResults.length).toBeGreaterThan(0)
      
      // Should be able to convert to chip
      expect(() => wrapper.vm.convertSearchToChip()).not.toThrow()
    })

    it('should show filter controls progressively', async () => {
      // Initially no chip controls shown
      expect(wrapper.find('.active-filters-section').exists()).toBe(false)
      
      // Add a filter
      await wrapper.vm.addDirectorFilter({ target: { value: 'Frank Darabont' } })
      await wrapper.vm.$nextTick()
      
      // Now filter controls should appear
      expect(wrapper.find('.active-filters-section').exists()).toBe(true)
      
      // Should show add filter button
      const addFilterButton = wrapper.find('[title="Add Filter"]')
      expect(addFilterButton.exists()).toBe(true)
    })

    it('should show Wikipedia functionality when appropriate', async () => {
      // Add exactly one chip
      await wrapper.vm.addDirectorFilter({ target: { value: 'Frank Darabont' } })
      await wrapper.vm.$nextTick()
      
      // Wikipedia button should appear
      const wikiButton = wrapper.find('[title="Wikipedia Info"]')
      expect(wikiButton.exists()).toBe(true)
      
      // Should be functional
      expect(() => wrapper.vm.goToWikipediaForChip()).not.toThrow()
    })

    it('should handle user discovering advanced features', async () => {
      // User tries multiple filters
      await wrapper.vm.addDirectorFilter({ target: { value: 'Frank Darabont' } })
      await wrapper.vm.addGenreFilter({ target: { value: 'Drama' } })
      await wrapper.vm.addYearFilter({ target: { value: '1994' } })
      
      expect(wrapper.vm.activeFilters).toHaveLength(3)
      expect(wrapper.vm.filteredResults.length).toBeGreaterThan(0)
      
      // Should handle complex filtering without issues
      expect(() => wrapper.vm.clearAllFilters()).not.toThrow()
    })
  })

  describe('Error States and Recovery', () => {
    beforeEach(() => {
      mockStore = {
        state: {
          dbLoaded: true,
          databaseTopKey: 'user-123',
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

    it('should provide clear feedback when searches return no results', async () => {
      wrapper.vm.value = 'nonexistent movie search term'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.filteredResults).toHaveLength(0)
      expect(wrapper.vm.paginatedSortedResults).toHaveLength(0)
      
      // Interface should remain functional
      const searchInput = wrapper.find('#search')
      expect(searchInput.exists()).toBe(true)
      expect(searchInput.element.value).toBe('nonexistent movie search term')
    })

    it('should handle filter combinations that return no results', async () => {
      // Add filters that won\'t match anything in empty database
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      await wrapper.vm.addYearFilter({ target: { value: '1993' } })
      await wrapper.vm.addGenreFilter({ target: { value: 'Adventure' } })
      
      expect(wrapper.vm.activeFilters).toHaveLength(3)
      expect(wrapper.vm.filteredResults).toHaveLength(0)
      
      // Should be able to recover by clearing filters
      await wrapper.vm.clearAllFilters()
      expect(wrapper.vm.activeFilters).toHaveLength(0)
    })

    it('should handle network errors gracefully in UI', async () => {
      // Mock network error
      vi.mocked(require('axios').default.get).mockRejectedValue(new Error('Network error'))
      
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      // Should handle error without breaking UI
      try {
        await wrapper.vm.goToWikipediaForChip()
      } catch (error) {
        // Error expected, but UI should remain functional
      }
      
      // Interface should still work
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.find('#search').exists()).toBe(true)
    })

    it('should maintain consistent state during error recovery', async () => {
      // Add some state
      await wrapper.vm.addDirectorFilter({ target: { value: 'Director 1' } })
      wrapper.vm.value = 'test search'
      
      // Simulate error and recovery
      try {
        await wrapper.vm.goToWikipediaForChip()
      } catch (error) {
        // Expected error
      }
      
      // State should be preserved
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.value).toBe('test search')
      
      // Should be able to continue using the app
      await wrapper.vm.clearAllFilters()
      expect(wrapper.vm.activeFilters).toHaveLength(0)
    })
  })

  describe('Accessibility for New Users', () => {
    beforeEach(() => {
      mockStore = {
        state: {
          dbLoaded: true,
          databaseTopKey: 'user-123',
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

    it('should have proper labels and titles for interactive elements', async () => {
      // Add a chip to show controls
      await wrapper.vm.addDirectorFilter({ target: { value: 'Test Director' } })
      await wrapper.vm.$nextTick()
      
      // Check for helpful titles/labels
      const addFilterButton = wrapper.find('[title="Add Filter"]')
      expect(addFilterButton.exists()).toBe(true)
      expect(addFilterButton.attributes('title')).toBe('Add Filter')
      
      const clearAllButton = wrapper.find('[title="Clear All"]')
      expect(clearAllButton.exists()).toBe(true)
      expect(clearAllButton.attributes('title')).toBe('Clear All')
      
      const wikiButton = wrapper.find('[title="Wikipedia Info"]')
      expect(wikiButton.exists()).toBe(true)
      expect(wikiButton.attributes('title')).toBe('Wikipedia Info')
    })

    it('should have proper input labels and IDs', () => {
      const searchInput = wrapper.find('#search')
      expect(searchInput.exists()).toBe(true)
      expect(searchInput.attributes('id')).toBe('search')
      expect(searchInput.attributes('name')).toBe('search')
    })

    it('should provide visual feedback for interactive elements', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Test Director' } })
      await wrapper.vm.$nextTick()
      
      // Buttons should have proper styling classes
      const buttons = wrapper.findAll('.active-filters-section button')
      buttons.forEach(button => {
        expect(button.classes()).toContain('btn')
      })
    })

    it('should handle keyboard navigation gracefully', () => {
      const searchInput = wrapper.find('#search')
      expect(searchInput.exists()).toBe(true)
      
      // Should be focusable
      expect(searchInput.attributes('type')).toBe('text')
      
      // Should handle keyboard events without errors
      expect(() => {
        searchInput.trigger('focus')
        searchInput.trigger('blur')
        searchInput.trigger('keydown', { key: 'Enter' })
      }).not.toThrow()
    })
  })
})
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

describe('New User Edge Cases', () => {
  let wrapper
  let mockStore

  describe('Malformed Data Handling', () => {
    beforeEach(() => {
      // Movies with various data issues that might crash the app
      const problematicMovies = [
        {
          // Movie with null/undefined properties
          movie: {
            id: 1,
            title: null,
            release_date: undefined,
            genres: null,
            cast: undefined,
            crew: [],
            production_companies: null,
            flatKeywords: undefined
          },
          ratings: null,
          dbKey: 'movie-1'
        },
        {
          // Movie with empty arrays and strings
          movie: {
            id: 2,
            title: '',
            release_date: '',
            genres: [],
            cast: [],
            crew: [],
            production_companies: [],
            flatKeywords: []
          },
          ratings: [],
          dbKey: 'movie-2'
        },
        {
          // Movie with unexpected data types
          movie: {
            id: 3,
            title: 123, // Number instead of string
            release_date: 'invalid-date',
            genres: 'Action', // String instead of array
            cast: 'Tom Hanks', // String instead of array
            crew: { name: 'Director' }, // Object instead of array
            production_companies: 'Studio',
            flatKeywords: 'keyword'
          },
          ratings: [{ calculatedTotal: 'invalid', date: null }],
          dbKey: 'movie-3'
        }
      ]

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
          allMediaAsArray: problematicMovies,
          allMediaSortedByRating: problematicMovies
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

    it('should handle null/undefined movie properties without crashing', () => {
      expect(() => wrapper.vm.allDirectors).not.toThrow()
      expect(() => wrapper.vm.allGenres).not.toThrow()
      expect(() => wrapper.vm.availableYears).not.toThrow()
      expect(() => wrapper.vm.topGenres).not.toThrow()
    })

    it('should handle empty arrays and strings gracefully', () => {
      expect(() => wrapper.vm.filteredResults).not.toThrow()
      expect(() => wrapper.vm.paginatedSortedResults).not.toThrow()
      
      // Should return empty arrays for computed properties with bad data
      const directors = wrapper.vm.allDirectors
      const genres = wrapper.vm.allGenres
      const years = wrapper.vm.availableYears
      
      expect(Array.isArray(directors)).toBe(true)
      expect(Array.isArray(genres)).toBe(true)
      expect(Array.isArray(years)).toBe(true)
    })

    it('should handle invalid data types without crashing', () => {
      expect(() => wrapper.vm.userRatedMovieCount).not.toThrow()
      expect(() => wrapper.vm.averageRating(wrapper.vm.filteredResults)).not.toThrow()
      expect(() => wrapper.vm.viewsCount(wrapper.vm.filteredResults)).not.toThrow()
    })

    it('should handle null ratings arrays', () => {
      expect(() => wrapper.vm.mostRecentRating({ ratings: null })).not.toThrow()
      expect(() => wrapper.vm.mostRecentRating({ ratings: undefined })).not.toThrow()
      expect(() => wrapper.vm.mostRecentRating({})).not.toThrow()
    })

    it('should handle search with malformed data', async () => {
      wrapper.vm.value = 'test search'
      await wrapper.vm.$nextTick()
      
      expect(() => wrapper.vm.fuzzyFilter).not.toThrow()
    })
  })

  describe('Network Failures and Timeouts', () => {
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

    it('should handle Wikipedia API failure gracefully', async () => {
      // Mock API failure
      vi.mocked(require('axios').default.get).mockRejectedValue(new Error('Network timeout'))
      
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      // Should not crash when Wikipedia API fails
      await expect(wrapper.vm.goToWikipediaForChip()).rejects.toThrow('Network timeout')
      
      // App should still be functional
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.showInsetBrowserModal).toBe(false)
    })

    it('should handle malformed Wikipedia API response', async () => {
      // Mock malformed API response
      vi.mocked(require('axios').default.get).mockResolvedValue({
        data: null // Invalid response
      })
      
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      // Should handle invalid response without crashing
      await expect(wrapper.vm.goToWikipediaForChip()).rejects.toThrow()
    })

    it('should handle empty Wikipedia API response', async () => {
      // Mock empty API response
      vi.mocked(require('axios').default.get).mockResolvedValue({
        data: {
          query: {
            pages: {}
          }
        }
      })
      
      await wrapper.vm.addDirectorFilter({ target: { value: 'Unknown Person' } })
      
      // Should handle empty results without crashing
      await expect(wrapper.vm.goToWikipediaForChip()).rejects.toThrow()
    })
  })

  describe('Extreme User Interactions', () => {
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

    it('should handle very long search terms', async () => {
      const veryLongSearch = 'a'.repeat(1000)
      wrapper.vm.value = veryLongSearch
      await wrapper.vm.$nextTick()
      
      expect(() => wrapper.vm.fuzzyFilter).not.toThrow()
      expect(() => wrapper.vm.convertSearchToChip()).not.toThrow()
    })

    it('should handle special characters in search', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
      wrapper.vm.value = specialChars
      await wrapper.vm.$nextTick()
      
      expect(() => wrapper.vm.fuzzyFilter).not.toThrow()
      expect(() => wrapper.vm.convertSearchToChip()).not.toThrow()
    })

    it('should handle Unicode and emoji in search', async () => {
      const unicodeSearch = '🎬 Movie 测试 العربية русский'
      wrapper.vm.value = unicodeSearch
      await wrapper.vm.$nextTick()
      
      expect(() => wrapper.vm.fuzzyFilter).not.toThrow()
      expect(() => wrapper.vm.convertSearchToChip()).not.toThrow()
    })

    it('should handle rapid chip addition and removal', async () => {
      // Rapidly add many chips
      for (let i = 0; i < 10; i++) {
        await wrapper.vm.addDirectorFilter({ target: { value: `Director ${i}` } })
        await wrapper.vm.addYearFilter({ target: { value: `200${i}` } })
        await wrapper.vm.addGenreFilter({ target: { value: `Genre ${i}` } })
      }
      
      expect(wrapper.vm.activeFilters.length).toBeGreaterThan(0)
      
      // Rapidly clear all
      await wrapper.vm.clearAllFilters()
      
      expect(wrapper.vm.activeFilters).toHaveLength(0)
      expect(() => wrapper.vm.filteredResults).not.toThrow()
    })

    it('should handle many modal open/close cycles', async () => {
      // Rapidly open and close movie info modal
      const testMovie = { id: 1, title: 'Test Movie' }
      
      for (let i = 0; i < 10; i++) {
        wrapper.vm.showMovieInfo(testMovie)
        expect(wrapper.vm.showMovieInfoModal).toBe(true)
        
        wrapper.vm.closeMovieInfoModal()
        expect(wrapper.vm.showMovieInfoModal).toBe(false)
      }
      
      // Should still be functional
      expect(() => wrapper.vm.showMovieInfo(testMovie)).not.toThrow()
    })
  })

  describe('Memory and Performance Edge Cases', () => {
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

    it('should handle circular references in data', () => {
      // Create circular reference
      const circularMovie = {
        movie: {
          id: 1,
          title: 'Circular Movie'
        },
        ratings: [{ calculatedTotal: 8.0 }],
        dbKey: 'movie-1'
      }
      circularMovie.movie.self = circularMovie // Circular reference
      
      mockStore.getters.allMediaAsArray = [circularMovie]
      
      // Should handle circular references without infinite loops
      expect(() => wrapper.vm.filteredResults).not.toThrow()
    })

    it('should handle very large numbers', () => {
      const movieWithLargeNumbers = [{
        movie: {
          id: Number.MAX_SAFE_INTEGER,
          title: 'Big Number Movie',
          vote_count: Number.MAX_SAFE_INTEGER
        },
        ratings: [{ calculatedTotal: Number.MAX_SAFE_INTEGER }],
        dbKey: 'movie-1'
      }]
      
      mockStore.getters.allMediaAsArray = movieWithLargeNumbers
      
      expect(() => wrapper.vm.averageRating(movieWithLargeNumbers)).not.toThrow()
      expect(() => wrapper.vm.viewsCount(movieWithLargeNumbers)).not.toThrow()
    })

    it('should handle negative numbers gracefully', () => {
      const movieWithNegativeNumbers = [{
        movie: {
          id: -1,
          title: 'Negative Movie',
          vote_count: -100
        },
        ratings: [{ calculatedTotal: -5.0 }],
        dbKey: 'movie-1'
      }]
      
      mockStore.getters.allMediaAsArray = movieWithNegativeNumbers
      
      expect(() => wrapper.vm.averageRating(movieWithNegativeNumbers)).not.toThrow()
      expect(() => wrapper.vm.viewsCount(movieWithNegativeNumbers)).not.toThrow()
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
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

    it('should handle missing localStorage gracefully', () => {
      // Mock localStorage being unavailable
      const originalLocalStorage = global.localStorage
      delete global.localStorage
      
      // Should not crash when localStorage is unavailable
      expect(() => wrapper.vm.filteredResults).not.toThrow()
      
      // Restore localStorage
      global.localStorage = originalLocalStorage
    })

    it('should handle missing requestAnimationFrame', () => {
      // Mock missing requestAnimationFrame
      const originalRAF = global.requestAnimationFrame
      delete global.requestAnimationFrame
      
      // Should not crash when requestAnimationFrame is unavailable
      expect(() => wrapper.vm.focusOnSearchBar({ target: { value: 'test' } })).not.toThrow()
      
      // Restore requestAnimationFrame
      global.requestAnimationFrame = originalRAF
    })

    it('should handle missing fetch API', () => {
      // Mock missing fetch
      const originalFetch = global.fetch
      delete global.fetch
      
      // Should handle missing fetch gracefully
      expect(() => wrapper.vm.goToWikipediaForChip()).not.toThrow()
      
      // Restore fetch
      global.fetch = originalFetch
    })
  })
})
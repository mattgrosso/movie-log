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

/**
 * Test the new unified filtering system
 * This replaces the dual fuzzyFilter + activeFilters system
 */
describe('Unified Filtering Method', () => {
  let wrapper
  let mockStore

  const mockMovieData = [
    {
      movie: {
        id: 1,
        title: 'Dídì',
        release_date: '2024-01-01',
        genres: [{ name: 'Drama' }],
        cast: [{ name: 'Joan Chen' }],
        crew: [{ name: 'Sean Wang', job: 'Director' }],
        production_companies: [{ name: 'A24' }],
        flatKeywords: ['coming-of-age', 'family']
      },
      ratings: [{ 
        calculatedTotal: 8.5, 
        date: '2024-01-01',
        tags: [{ title: 'indie' }]
      }],
      dbKey: 'movie-1'
    },
    {
      movie: {
        id: 2,
        title: 'Test Movie',
        release_date: '2023-01-01',
        genres: [{ name: 'Action' }],
        cast: [{ name: 'Test Actor' }],
        crew: [{ name: 'Steven Spielberg', job: 'Director' }],
        production_companies: [{ name: 'Universal Pictures' }],
        flatKeywords: ['action', 'adventure']
      },
      ratings: [{ calculatedTotal: 7.5, date: '2023-01-01' }],
      dbKey: 'movie-2'
    },
    {
      movie: {
        id: 3,
        title: 'Horror Film',
        release_date: '2024-06-01',
        genres: [{ name: 'Horror' }],
        cast: [{ name: 'Joan Chen' }],
        crew: [{ name: 'Different Director', job: 'Director' }],
        production_companies: [{ name: 'Sony Pictures' }],
        flatKeywords: ['scary', 'supernatural']
      },
      ratings: [{ 
        calculatedTotal: 6.5, 
        date: '2024-06-01',
        tags: [{ title: 'horror' }]
      }],
      dbKey: 'movie-3'
    }
  ]

  beforeEach(() => {
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
          tags: {}
        }
      },
      getters: {
        allMediaAsArray: mockMovieData,
        allMediaSortedByRating: mockMovieData
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
        }
      }
    })
  })

  describe('unifiedFilteredResults', () => {
    it('should return all results when no filters', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: '',
        activeFilters: []
      })
      
      const results = wrapper.vm.unifiedFilteredResults
      expect(results).toHaveLength(3)
    })

    it('should filter by input text only', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: 'didi',
        activeFilters: []
      })
      
      const results = wrapper.vm.unifiedFilteredResults
      expect(results).toHaveLength(1)
      expect(results[0].movie.title).toBe('Dídì')
    })

    it('should filter by chip only', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: '',
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' }
        ]
      })
      
      const results = wrapper.vm.unifiedFilteredResults
      expect(results).toHaveLength(1)
      expect(results[0].movie.title).toBe('Test Movie')
    })

    it('should combine input and chips (AND logic)', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: 'test',
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' }
        ]
      })
      
      const results = wrapper.vm.unifiedFilteredResults
      expect(results).toHaveLength(1)
      expect(results[0].movie.title).toBe('Test Movie')
    })

    it('should return empty when filters dont match', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: 'didi',
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' }
        ]
      })
      
      const results = wrapper.vm.unifiedFilteredResults
      expect(results).toHaveLength(0)
    })

    it('should handle multiple chips', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: '',
        activeFilters: [
          { id: '1', type: 'year', value: '2024', display: '2024' },
          { id: '2', type: 'person', value: 'Joan Chen', display: 'Joan Chen' }
        ]
      })
      
      const results = wrapper.vm.unifiedFilteredResults
      expect(results).toHaveLength(2) // Both Dídì and Horror Film are 2024 with Joan Chen
      expect(results.every(r => ['Dídì', 'Horror Film'].includes(r.movie.title))).toBe(true)
    })
  })

  describe('applyFilter method', () => {
    let movie, result

    beforeEach(() => {
      movie = mockMovieData[0].movie
      result = mockMovieData[0]
    })

    describe('search filters', () => {
      it('should match title with accent normalization', () => {
        const filter = { type: 'search', value: 'didi' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should match keywords', () => {
        const filter = { type: 'search', value: 'family' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should match genres', () => {
        const filter = { type: 'search', value: 'drama' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should match cast names', () => {
        const filter = { type: 'search', value: 'joan' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should match crew names', () => {
        const filter = { type: 'search', value: 'sean' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should match production companies', () => {
        const filter = { type: 'search', value: 'a24' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should handle year searches', () => {
        const filter = { type: 'search', value: '2024' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should not match non-existent content', () => {
        const filter = { type: 'search', value: 'nonexistent' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(false)
      })
    })

    describe('specific filter types', () => {
      it('should match director filters', () => {
        const filter = { type: 'director', value: 'Sean Wang' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should match person filters (cast)', () => {
        const filter = { type: 'person', value: 'Joan Chen' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should match person filters (crew)', () => {
        const filter = { type: 'person', value: 'Sean Wang' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should match year filters', () => {
        const filter = { type: 'year', value: '2024' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should match genre filters', () => {
        const filter = { type: 'genre', value: 'Drama' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should match tag filters', () => {
        const filter = { type: 'tag', value: 'indie' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should match company filters', () => {
        const filter = { type: 'company', value: 'A24' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(true)
      })

      it('should not match incorrect values', () => {
        const filter = { type: 'director', value: 'Wrong Director' }
        expect(wrapper.vm.applyFilter(movie, result, filter)).toBe(false)
      })
    })
  })

  describe('getYearFiltersForSearch method', () => {
    it('should parse 4-digit years', () => {
      const years = wrapper.vm.getYearFiltersForSearch('2024')
      expect(years).toEqual(['2024'])
    })

    it('should parse 2-digit years (21st century)', () => {
      const years = wrapper.vm.getYearFiltersForSearch('23')
      expect(years).toEqual(['2023'])
    })

    it('should parse year ranges', () => {
      const years = wrapper.vm.getYearFiltersForSearch('2020-2023')
      expect(years).toContain('2020')
      expect(years).toContain('2021')
      expect(years).toContain('2022')
      expect(years).toContain('2023')
    })

    it('should parse decade shortcuts', () => {
      const years = wrapper.vm.getYearFiltersForSearch('2020s')
      expect(years).toContain('2020')
      expect(years).toContain('2029')
    })

    it('should return empty for non-year strings', () => {
      const years = wrapper.vm.getYearFiltersForSearch('action')
      expect(years).toEqual([])
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle empty filters array', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: '',
        activeFilters: []
      })
      
      const results = wrapper.vm.unifiedFilteredResults
      expect(results).toHaveLength(mockMovieData.length)
    })

    it('should handle missing movie data gracefully', async () => {
      const incompleteMovie = {
        movie: { id: 999, title: 'Incomplete Movie' },
        ratings: [],
        dbKey: 'incomplete'
      }
      
      mockStore.getters.allMediaAsArray = [incompleteMovie]
      
      await wrapper.setData({ 
        debouncedSearchValue: 'test',
        activeFilters: []
      })
      
      // Should not crash, even with incomplete data
      expect(() => wrapper.vm.unifiedFilteredResults).not.toThrow()
    })
  })
})
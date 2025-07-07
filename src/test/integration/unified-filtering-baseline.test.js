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
 * BASELINE TEST SUITE FOR UNIFIED FILTERING REFACTOR
 * 
 * This test captures the current behavior of the dual filtering system
 * (this.value + activeFilters) before we refactor to unified filtering.
 * All these tests should continue to pass after the refactor.
 */
describe('Unified Filtering - Baseline Behavior', () => {
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
      ratings: [{ calculatedTotal: 8.5, date: '2024-01-01' }],
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
        title: 'Another Film',
        release_date: '2024-06-01',
        genres: [{ name: 'Comedy' }],
        cast: [{ name: 'Joan Chen' }],
        crew: [{ name: 'Different Director', job: 'Director' }],
        production_companies: [{ name: 'Sony Pictures' }],
        flatKeywords: ['comedy', 'humor']
      },
      ratings: [{ calculatedTotal: 6.5, date: '2024-06-01' }],
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

  describe('Current Filtering Behavior', () => {
    it('should filter by input text only (no chips)', async () => {
      // Set search value
      await wrapper.setData({ value: 'didi', debouncedSearchValue: 'didi' })
      
      const filteredResults = wrapper.vm.filteredResults
      expect(filteredResults.length).toBe(1)
      expect(filteredResults[0].movie.title).toBe('Dídì')
    })

    it('should filter by chips only (no input text)', async () => {
      // Clear input and add director chip
      await wrapper.setData({ 
        value: '', 
        debouncedSearchValue: '',
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' }
        ]
      })
      
      const filteredResults = wrapper.vm.filteredResults
      expect(filteredResults.length).toBe(1)
      expect(filteredResults[0].movie.title).toBe('Test Movie')
    })

    it('should apply both input text AND chips (intersection logic)', async () => {
      // Search for "Test" AND director "Steven Spielberg"
      await wrapper.setData({ 
        value: 'Test', 
        debouncedSearchValue: 'Test',
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' }
        ]
      })
      
      const filteredResults = wrapper.vm.filteredResults
      expect(filteredResults.length).toBe(1)
      expect(filteredResults[0].movie.title).toBe('Test Movie')
    })

    it('should return no results when input text and chips dont intersect', async () => {
      // Search for "Didi" AND director "Steven Spielberg" (should be empty)
      await wrapper.setData({ 
        value: 'Didi', 
        debouncedSearchValue: 'Didi',
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' }
        ]
      })
      
      const filteredResults = wrapper.vm.filteredResults
      expect(filteredResults.length).toBe(0)
    })
  })

  describe('effectiveSearchTerm Behavior', () => {
    it('should return input value when input has text', async () => {
      await wrapper.setData({ value: 'Test Movie' })
      expect(wrapper.vm.effectiveSearchTerm).toBe('Test Movie')
    })

    it('should return chip value when no input but single chip', async () => {
      await wrapper.setData({ 
        value: '',
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' }
        ]
      })
      expect(wrapper.vm.effectiveSearchTerm).toBe('Steven Spielberg')
    })

    it('should prioritize input over chips when both exist', async () => {
      await wrapper.setData({ 
        value: 'Test Movie',
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' }
        ]
      })
      expect(wrapper.vm.effectiveSearchTerm).toBe('Test Movie')
    })

    it('should return highest priority chip when no input and multiple chips', async () => {
      await wrapper.setData({ 
        value: '',
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' },
          { id: '2', type: 'year', value: '2023', display: '2023' }
        ]
      })
      
      // BASELINE: This captures current (possibly buggy) behavior
      // Logic says director should win but system returns year - documenting as-is
      expect(wrapper.vm.effectiveSearchTerm).toBe('2023')
    })
  })

  describe('UI State Behavior', () => {
    it('should show chips when activeFilters has items', async () => {
      await wrapper.setData({
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' }
        ]
      })
      
      const chipElements = wrapper.findAll('.badge.text-bg-secondary')
      expect(chipElements.length).toBeGreaterThan(0)
      // Find the specific chip we added
      const ourChip = chipElements.find(el => el.text().includes('Steven Spielberg'))
      expect(ourChip).toBeTruthy()
    })

    it('should show Wikipedia button when exactly one chip', async () => {
      await wrapper.setData({
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' }
        ]
      })
      
      const wikiButton = wrapper.find('button[title="Wikipedia Info"]')
      expect(wikiButton.exists()).toBe(true)
    })

    it('should NOT show Wikipedia button when multiple chips', async () => {
      await wrapper.setData({
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' },
          { id: '2', type: 'year', value: '2023', display: '2023' }
        ]
      })
      
      const wikiButton = wrapper.find('button[title="Wikipedia Info"]')
      expect(wikiButton.exists()).toBe(false)
    })

    it('should show filtered results count correctly', async () => {
      await wrapper.setData({ value: 'Test', debouncedSearchValue: 'Test' })
      
      const filteredResults = wrapper.vm.filteredResults
      expect(filteredResults.length).toBeGreaterThan(0)
      expect(wrapper.vm.showResultsList).toBe(true)
    })
  })

  describe('Chip Management Behavior', () => {
    it('should remove specific chip when removeFilter called', async () => {
      await wrapper.setData({
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' },
          { id: '2', type: 'year', value: '2023', display: '2023' }
        ]
      })
      
      wrapper.vm.removeFilter('1')
      
      expect(wrapper.vm.activeFilters.length).toBe(1)
      expect(wrapper.vm.activeFilters[0].id).toBe('2')
    })

    it('should clear all chips when clearAllFilters called', async () => {
      await wrapper.setData({
        value: 'Test',
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' },
          { id: '2', type: 'year', value: '2023', display: '2023' }
        ]
      })
      
      wrapper.vm.clearAllFilters()
      
      expect(wrapper.vm.activeFilters.length).toBe(0)
      expect(wrapper.vm.value).toBe('')
    })
  })

  describe('Year Filter Parsing', () => {
    it('should parse 4-digit years correctly', async () => {
      await wrapper.setData({ value: '2024' })
      expect(wrapper.vm.yearFilter).toContain('2024')
    })

    it('should parse 2-digit years correctly', async () => {
      await wrapper.setData({ value: '23' })
      expect(wrapper.vm.yearFilter).toContain('2023')
    })

    it('should handle year ranges', async () => {
      await wrapper.setData({ value: '2020-2024' })
      expect(wrapper.vm.yearFilter).toContain('2020')
      expect(wrapper.vm.yearFilter).toContain('2024')
    })
  })

  describe('Search Type Detection', () => {
    it('should detect years', async () => {
      const searchInfo = wrapper.vm.detectSearchType('2024')
      expect(searchInfo.type).toBe('year')
    })

    it('should fallback to general search for unknown terms', async () => {
      const searchInfo = wrapper.vm.detectSearchType('UnknownTerm')
      expect(searchInfo.type).toBe('general')
    })

    // Note: Director/person detection requires the person to exist in the current dataset
    // which may not be the case in this test environment
  })
})
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
 * Test the new allActiveFilters computed property
 * This unified property combines input text and chips into a single array
 */
describe('allActiveFilters Computed Property', () => {
  let wrapper
  let mockStore

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
        }
      }
    })
  })

  describe('Empty State', () => {
    it('should return empty array when no input and no chips', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: '',
        activeFilters: []
      })
      
      expect(wrapper.vm.allActiveFilters).toEqual([])
    })
  })

  describe('Input Only', () => {
    it('should create input filter when user types', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: 'didi',
        activeFilters: []
      })
      
      const filters = wrapper.vm.allActiveFilters
      expect(filters).toHaveLength(1)
      expect(filters[0]).toEqual({
        id: '__input__',
        type: 'search',
        value: 'didi',
        display: 'didi',
        source: 'input'
      })
    })

    it('should trim whitespace from input', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: '  test movie  ',
        activeFilters: []
      })
      
      const filters = wrapper.vm.allActiveFilters
      expect(filters[0].value).toBe('test movie')
      expect(filters[0].display).toBe('test movie')
    })

    it('should ignore empty/whitespace-only input', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: '   ',
        activeFilters: []
      })
      
      expect(wrapper.vm.allActiveFilters).toEqual([])
    })
  })

  describe('Chips Only', () => {
    it('should include all chips when no input', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: '',
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' },
          { id: '2', type: 'year', value: '2023', display: '2023' }
        ]
      })
      
      const filters = wrapper.vm.allActiveFilters
      expect(filters).toHaveLength(2)
      
      expect(filters[0]).toEqual({
        id: '1',
        type: 'director',
        value: 'Steven Spielberg',
        display: 'Steven Spielberg',
        source: 'chip'
      })
      
      expect(filters[1]).toEqual({
        id: '2',
        type: 'year',
        value: '2023',
        display: '2023',
        source: 'chip'
      })
    })
  })

  describe('Input + Chips Combined', () => {
    it('should combine input and chips into unified array', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: 'action',
        activeFilters: [
          { id: '1', type: 'director', value: 'Steven Spielberg', display: 'Steven Spielberg' },
          { id: '2', type: 'year', value: '2023', display: '2023' }
        ]
      })
      
      const filters = wrapper.vm.allActiveFilters
      expect(filters).toHaveLength(3)
      
      // Input should be first
      expect(filters[0]).toEqual({
        id: '__input__',
        type: 'search',
        value: 'action',
        display: 'action',
        source: 'input'
      })
      
      // Then chips in order
      expect(filters[1].source).toBe('chip')
      expect(filters[1].type).toBe('director')
      expect(filters[2].source).toBe('chip')
      expect(filters[2].type).toBe('year')
    })

    it('should handle complex filtering scenarios', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: 'horror',
        activeFilters: [
          { id: '1', type: 'search', value: 'thriller', display: 'thriller' },
          { id: '2', type: 'genre', value: 'Horror', display: 'Horror' },
          { id: '3', type: 'year', value: '2024', display: '2024' },
          { id: '4', type: 'company', value: 'A24', display: 'A24' }
        ]
      })
      
      const filters = wrapper.vm.allActiveFilters
      expect(filters).toHaveLength(5)
      
      // Should have input filter + 4 chip filters
      expect(filters.filter(f => f.source === 'input')).toHaveLength(1)
      expect(filters.filter(f => f.source === 'chip')).toHaveLength(4)
      
      // Input filter should be first
      expect(filters[0].source).toBe('input')
      expect(filters[0].value).toBe('horror')
      
      // Should preserve all chip types
      const chipTypes = filters.slice(1).map(f => f.type)
      expect(chipTypes).toEqual(['search', 'genre', 'year', 'company'])
    })
  })

  describe('Filter Structure', () => {
    it('should preserve original chip properties while adding source', async () => {
      const originalChip = { 
        id: 'test-123', 
        type: 'director', 
        value: 'Christopher Nolan', 
        display: 'Christopher Nolan',
        customProp: 'test' 
      }
      
      await wrapper.setData({ 
        debouncedSearchValue: '',
        activeFilters: [originalChip]
      })
      
      const filters = wrapper.vm.allActiveFilters
      expect(filters[0]).toEqual({
        ...originalChip,
        source: 'chip'
      })
    })

    it('should create consistent structure for input filters', async () => {
      await wrapper.setData({ 
        debouncedSearchValue: 'test query',
        activeFilters: []
      })
      
      const inputFilter = wrapper.vm.allActiveFilters[0]
      expect(inputFilter).toHaveProperty('id')
      expect(inputFilter).toHaveProperty('type')
      expect(inputFilter).toHaveProperty('value')
      expect(inputFilter).toHaveProperty('display')
      expect(inputFilter).toHaveProperty('source')
      
      expect(inputFilter.id).toBe('__input__')
      expect(inputFilter.type).toBe('search')
      expect(inputFilter.source).toBe('input')
    })
  })

  describe('Reactivity', () => {
    it('should update when debouncedSearchValue changes', async () => {
      await wrapper.setData({ debouncedSearchValue: '', activeFilters: [] })
      expect(wrapper.vm.allActiveFilters).toHaveLength(0)
      
      await wrapper.setData({ debouncedSearchValue: 'new search' })
      expect(wrapper.vm.allActiveFilters).toHaveLength(1)
      expect(wrapper.vm.allActiveFilters[0].value).toBe('new search')
      
      await wrapper.setData({ debouncedSearchValue: '' })
      expect(wrapper.vm.allActiveFilters).toHaveLength(0)
    })

    it('should update when activeFilters changes', async () => {
      await wrapper.setData({ debouncedSearchValue: '', activeFilters: [] })
      expect(wrapper.vm.allActiveFilters).toHaveLength(0)
      
      await wrapper.setData({ 
        activeFilters: [
          { id: '1', type: 'year', value: '2024', display: '2024' }
        ]
      })
      expect(wrapper.vm.allActiveFilters).toHaveLength(1)
      expect(wrapper.vm.allActiveFilters[0].type).toBe('year')
      
      await wrapper.setData({ activeFilters: [] })
      expect(wrapper.vm.allActiveFilters).toHaveLength(0)
    })
  })
})
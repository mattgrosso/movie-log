import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

// Mock external dependencies
vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({
      data: {
        query: {
          pages: {
            '12345': {
              pageid: 12345,
              title: 'Steven Spielberg',
              index: 1
            }
          }
        }
      }
    }))
  }
}))

vi.mock('lodash/uniq', () => ({ default: vi.fn(arr => [...new Set(arr)]) }))
vi.mock('lodash/minBy', () => ({ 
  default: vi.fn((array, fn) => {
    // Simple mock that returns the item with lowest index
    return array.reduce((min, item) => fn(item) < fn(min) ? item : min)
  })
}))
vi.mock('lodash/debounce', () => ({ default: vi.fn(fn => fn) }))

// Mock the getRating utility
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({
    calculatedTotal: 8.25,
    normalizedRating: 8
  })),
  getAllRatings: vi.fn(() => [])
}))

describe('Wikipedia Chip Functionality', () => {
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
          tags: { 'viewing-tags': {} },
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

  describe('Wikipedia Button Visibility', () => {
    it('should not show Wikipedia button when no chips are active', () => {
      expect(wrapper.vm.activeFilters).toHaveLength(0)
      
      const wikiButton = wrapper.find('[title="Wikipedia Info"]')
      expect(wikiButton.exists()).toBe(false)
    })

    it('should show Wikipedia button when exactly one chip is active', async () => {
      // Add one chip
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      
      const wikiButton = wrapper.find('[title="Wikipedia Info"]')
      expect(wikiButton.exists()).toBe(true)
    })

    it('should not show Wikipedia button when multiple chips are active', async () => {
      // Add two chips
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      await wrapper.vm.addYearFilter({ target: { value: '1993' } })
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.activeFilters).toHaveLength(2)
      
      const wikiButton = wrapper.find('[title="Wikipedia Info"]')
      expect(wikiButton.exists()).toBe(false)
    })
  })

  describe('Wikipedia Functionality', () => {
    it('should call goToWikipediaForChip when Wikipedia button is clicked', async () => {
      // Add one chip
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      await wrapper.vm.$nextTick()
      
      // Spy on the method
      const goToWikipediaForChipSpy = vi.spyOn(wrapper.vm, 'goToWikipediaForChip')
      
      const wikiButton = wrapper.find('[title="Wikipedia Info"]')
      expect(wikiButton.exists()).toBe(true)
      
      await wikiButton.trigger('click')
      
      expect(goToWikipediaForChipSpy).toHaveBeenCalled()
    })

    it('should set insetBrowserUrl and show modal when goToWikipediaForChip is called', async () => {
      // Add one chip
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      expect(wrapper.vm.showInsetBrowserModal).toBe(false)
      expect(wrapper.vm.insetBrowserUrl).toBe('')
      
      // Call the method
      await wrapper.vm.goToWikipediaForChip()
      
      expect(wrapper.vm.showInsetBrowserModal).toBe(true)
      expect(wrapper.vm.insetBrowserUrl).toContain('wikipedia.org')
      expect(wrapper.vm.insetBrowserUrl).toContain('12345') // from mock pageid
    })

    it('should not do anything if called when no single chip exists', async () => {
      // No chips
      expect(wrapper.vm.activeFilters).toHaveLength(0)
      
      const initialModalState = wrapper.vm.showInsetBrowserModal
      const initialUrl = wrapper.vm.insetBrowserUrl
      
      await wrapper.vm.goToWikipediaForChip()
      
      // Should not change state
      expect(wrapper.vm.showInsetBrowserModal).toBe(initialModalState)
      expect(wrapper.vm.insetBrowserUrl).toBe(initialUrl)
    })

    it('should use the chip value for Wikipedia search', async () => {
      // Mock axios to verify the search term
      const axios = await import('axios')
      const getSpy = vi.spyOn(axios.default, 'get')
      
      // Add a chip with specific value
      await wrapper.vm.addDirectorFilter({ target: { value: 'Christopher Nolan' } })
      
      await wrapper.vm.goToWikipediaForChip()
      
      // Verify axios was called with the chip value
      expect(getSpy).toHaveBeenCalledWith(
        expect.stringContaining('Christopher Nolan')
      )
    })
  })

  describe('Button Placement and Styling', () => {
    it('should place Wikipedia button after Clear All button', async () => {
      // Add one chip to show the Wikipedia button
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      await wrapper.vm.$nextTick()
      
      // Find the control buttons (not chip close buttons)
      const controlButtons = wrapper.findAll('.active-filters-section button').filter(button => 
        button.attributes('title') && 
        ['Add Filter', 'Clear All', 'Wikipedia Info'].includes(button.attributes('title'))
      )
      
      // Should have: Add Filter, Clear All, Wikipedia
      expect(controlButtons).toHaveLength(3)
      
      // Check order by title attributes
      expect(controlButtons[0].attributes('title')).toBe('Add Filter')
      expect(controlButtons[1].attributes('title')).toBe('Clear All')
      expect(controlButtons[2].attributes('title')).toBe('Wikipedia Info')
    })

    it('should have consistent styling with other chip buttons', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      await wrapper.vm.$nextTick()
      
      const wikiButton = wrapper.find('[title="Wikipedia Info"]')
      const clearButton = wrapper.find('[title="Clear All"]')
      
      // Should have similar classes
      expect(wikiButton.classes()).toContain('btn')
      expect(wikiButton.classes()).toContain('btn-link')
      expect(wikiButton.classes()).toContain('text-light')
      
      // Should have Wikipedia icon
      const icon = wikiButton.find('i')
      expect(icon.classes()).toContain('bi-wikipedia')
    })
  })
})
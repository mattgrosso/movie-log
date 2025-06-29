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

describe('Search Integration', () => {
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
        allMediaAsArray: [
          {
            movie: {
              id: 1,
              title: 'Test Movie',
              release_date: '2023-01-01',
              genres: [{ name: 'Action' }],
              cast: [{ name: 'Test Actor' }],
              crew: [{ name: 'Test Director', job: 'Director' }],
              flatKeywords: ['action', 'adventure'],
              production_companies: [{ name: 'Test Studio' }]
            },
            ratings: [{
              calculatedTotal: 8.25,
              date: Date.now()
            }],
            dbKey: 'test-1'
          }
        ],
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
          $router: {
            push: vi.fn()
          }
        },
        stubs: {
          'DBGridLayoutSearchResult': {
            template: '<div data-testid="db-grid-result"></div>',
            props: ['result', 'keywordCounts', 'allCounts', 'index', 'resultsAreFiltered', 'sortValue', 'activeQuickLinkList']
          },
          'NoResults': true,
          'StickinessModal': true,
          'TweakModal': true,
          'InsetBrowserModal': true
        }
      }
    })
  })

  describe('Search functionality', () => {
    it('should render search input when database is loaded', () => {
      const searchInput = wrapper.find('input#search')
      expect(searchInput.exists()).toBe(true)
      expect(searchInput.attributes('placeholder')).toBe('Search...')
    })

    it('should update search value when typing', async () => {
      const searchInput = wrapper.find('input#search')
      
      await searchInput.setValue('Test Movie')
      
      expect(wrapper.vm.value).toBe('Test Movie')
    })

    it('should show clear button when search has value', async () => {
      await wrapper.setData({ value: 'Test Movie' })
      
      const clearButton = wrapper.find('.clear-button')
      expect(clearButton.exists()).toBe(true)
    })

    it('should clear search value when clear button is clicked', async () => {
      await wrapper.setData({ value: 'Test Movie' })
      
      const clearButton = wrapper.find('.clear-button')
      await clearButton.trigger('click')
      
      expect(wrapper.vm.value).toBe('')
    })

    it('should show Wikipedia button when search has value', async () => {
      await wrapper.setData({ value: 'Test Movie' })
      
      const wikiButton = wrapper.find('.more-info-button')
      expect(wikiButton.exists()).toBe(true)
    })
  })

  describe('Search filtering', () => {
    it('should filter results based on title', async () => {
      await wrapper.setData({ value: 'Test' })
      
      const filteredResults = wrapper.vm.fuzzyFilter
      expect(filteredResults.length).toBeGreaterThan(0)
      expect(filteredResults[0].movie.title).toContain('Test')
    })

    it('should filter results based on genre', async () => {
      await wrapper.setData({ value: 'action' })
      
      const filteredResults = wrapper.vm.fuzzyFilter
      expect(filteredResults.length).toBeGreaterThan(0)
    })

    it('should filter results based on cast member', async () => {
      await wrapper.setData({ value: 'Test Actor' })
      
      const filteredResults = wrapper.vm.fuzzyFilter
      expect(filteredResults.length).toBeGreaterThan(0)
    })

    it('should return empty results for non-matching search', async () => {
      await wrapper.setData({ value: 'NonExistentMovie' })
      
      const filteredResults = wrapper.vm.fuzzyFilter
      expect(filteredResults.length).toBe(0)
    })
  })

  describe('Year filtering', () => {
    it('should handle 4-digit year search', async () => {
      await wrapper.setData({ value: '2023' })
      
      const yearFilter = wrapper.vm.yearFilter
      expect(yearFilter).toContain('2023')
    })

    it('should handle 2-digit year search for recent years', async () => {
      await wrapper.setData({ value: '23' })
      
      const yearFilter = wrapper.vm.yearFilter
      expect(yearFilter).toContain('2023')
    })

    it('should handle decade search', async () => {
      await wrapper.setData({ value: '2020s' })
      
      const yearFilter = wrapper.vm.yearFilter
      expect(yearFilter.length).toBeGreaterThan(1)
      expect(yearFilter).toContain('2020')
    })

    it('should handle year range search', async () => {
      await wrapper.setData({ value: '2020-2023' })
      
      const yearFilter = wrapper.vm.yearFilter
      expect(yearFilter.length).toBeGreaterThan(1)
      expect(yearFilter).toContain('2020')
      expect(yearFilter).toContain('2023')
    })
  })

  describe('Quick filters', () => {
    it('should toggle quick links accordion', async () => {
      const quickLinksButton = wrapper.find('[data-bs-target="#quick-links-accordion"]')
      expect(quickLinksButton.exists()).toBe(true)
    })

    it('should handle annual best filter', async () => {
      await wrapper.vm.toggleAnnualBestFilter()
      
      expect(wrapper.vm.activeQuickLinkList).toBe('annual')
      expect(wrapper.vm.value).toBe('')
    })

    it('should handle this year filter', async () => {
      await wrapper.vm.toggleThisYearFilter()
      
      expect(wrapper.vm.activeQuickLinkList).toBe('thisYear')
    })

    it('should handle this month filter', async () => {
      await wrapper.vm.toggleThisMonthFilter()
      
      expect(wrapper.vm.activeQuickLinkList).toBe('thisMonth')
    })
  })

  describe('Search results display', () => {
    it('should show results when there are filtered results', async () => {
      await wrapper.setData({ value: 'Test' })
      
      const showResultsList = wrapper.vm.showResultsList
      expect(showResultsList).toBe(true)
    })

    it('should calculate average rating for filtered results', async () => {
      await wrapper.setData({ value: 'Test' })
      
      const average = wrapper.vm.averageRating(wrapper.vm.filteredResults)
      expect(typeof average).toBe('string')
      expect(parseFloat(average)).toBeGreaterThan(0)
    })

    it('should count total views for filtered results', async () => {
      await wrapper.setData({ value: 'Test' })
      
      const viewsCount = wrapper.vm.viewsCount(wrapper.vm.filteredResults)
      expect(typeof viewsCount).toBe('number')
      expect(viewsCount).toBeGreaterThanOrEqual(0)
    })
  })
})
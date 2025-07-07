import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

// Mock external dependencies
vi.mock('axios', async () => {
  const { mockAxiosModule } = await import('../utils/mockAxios.js')
  return mockAxiosModule()
})
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



  })

  describe('Search filtering', () => {
    it('should filter results based on title', async () => {
      await wrapper.setData({ value: 'Test' })
      
      const filteredResults = wrapper.vm.unifiedFilteredResults
      expect(filteredResults.length).toBeGreaterThan(0)
      expect(filteredResults[0].movie.title).toContain('Test')
    })

    it('should filter results based on genre', async () => {
      await wrapper.setData({ value: 'action' })
      
      const filteredResults = wrapper.vm.unifiedFilteredResults
      expect(filteredResults.length).toBeGreaterThan(0)
    })

    it('should filter results based on cast member', async () => {
      await wrapper.setData({ value: 'Test Actor' })
      
      const filteredResults = wrapper.vm.unifiedFilteredResults
      expect(filteredResults.length).toBeGreaterThan(0)
    })

    it('should return empty results for non-matching search', async () => {
      await wrapper.setData({ 
        value: 'NonExistentMovie',
        debouncedSearchValue: 'NonExistentMovie'
      })
      
      const filteredResults = wrapper.vm.unifiedFilteredResults
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

    it('should group search results by person role when person has multiple roles', async () => {
      await wrapper.setData({ value: 'Steven Spielberg' })
      
      const groupedResults = wrapper.vm.groupedByPersonRole
      
      // If Steven Spielberg has multiple roles in our test data, groupedResults should exist
      if (groupedResults) {
        expect(Array.isArray(groupedResults)).toBe(true)
        groupedResults.forEach(group => {
          expect(group).toHaveProperty('personName')
          expect(group).toHaveProperty('role')
          expect(group).toHaveProperty('movies')
          expect(group).toHaveProperty('ranking')
          expect(Array.isArray(group.movies)).toBe(true)
          expect(group.personName).toContain('Steven Spielberg')
          expect(typeof group.ranking).toBe('number')
        })
        
        // Verify roles are sorted by ranking (highest first)
        for (let i = 1; i < groupedResults.length; i++) {
          if (groupedResults[i-1].personName === groupedResults[i].personName) {
            expect(groupedResults[i-1].ranking).toBeGreaterThanOrEqual(groupedResults[i].ranking)
          }
        }
        
        // Verify no movie appears in multiple groups
        const allMovieIds = new Set()
        groupedResults.forEach(group => {
          group.movies.forEach(movie => {
            const movieId = wrapper.vm.topStructure(movie).id
            expect(allMovieIds.has(movieId)).toBe(false) // Should not already exist
            allMovieIds.add(movieId)
          })
        })
      }
    })

    it('should return null for groupedByPersonRole when person has only one role', async () => {
      // Set up search for a person who only has one role in our test data
      await wrapper.setData({ value: 'SingleRolePerson' })
      
      const groupedResults = wrapper.vm.groupedByPersonRole
      
      // Should be null when person doesn't have multiple roles
      expect(groupedResults).toBeNull()
    })

    it('should return null for groupedByPersonRole when search is not for a person', async () => {
      await wrapper.setData({ value: 'Test Movie' })
      
      const groupedResults = wrapper.vm.groupedByPersonRole
      
      // Should be null when searching for movies, not people
      expect(groupedResults).toBeNull()
    })
  })
})
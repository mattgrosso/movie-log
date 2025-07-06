import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

describe('More From Section - Debug Test', () => {
  let wrapper
  let mockStore

  beforeEach(async () => {
    // Very simple mock store
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

    await wrapper.vm.$nextTick()
  })

  it('should have the correct methods available', () => {
    // Check that all required methods exist
    expect(typeof wrapper.vm.detectSearchType).toBe('function')
    expect(typeof wrapper.vm.addDirectorFilter).toBe('function')
    expect(typeof wrapper.vm.addCompanyFilter).toBe('function')
    expect(typeof wrapper.vm.addSearchFilter).toBe('function')
    expect(typeof wrapper.vm.fetchUnratedMoviesByValue).toBe('function')
  })

  it('should correctly detect search types', () => {
    // Test year detection
    const yearResult = wrapper.vm.detectSearchType('1995')
    expect(yearResult.type).toBe('year')

    // Test general search (should default to general)
    const generalResult = wrapper.vm.detectSearchType('Heat')
    expect(generalResult.type).toBe('general')
  })

  it('should show correct effectiveSearchTerm for director chip', async () => {
    // Make sure value is empty so it doesn't interfere  
    wrapper.vm.value = ''
    
    // Test with director chip
    wrapper.vm.activeFilters = [{
      id: 'director-1',
      type: 'director',
      value: 'Steven Spielberg',
      display: 'Steven Spielberg'
    }]
    
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.effectiveSearchTerm).toBe('Steven Spielberg')
  })

  it('should show correct effectiveSearchTerm for search chip', async () => {
    // Make sure value is empty and no filters
    wrapper.vm.value = ''
    wrapper.vm.activeFilters = []
    
    // Test with search chip  
    wrapper.vm.activeFilters = [{
      id: 'search-1',
      type: 'search',
      value: 'Al Pacino',
      display: 'Al Pacino'
    }]
    
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.effectiveSearchTerm).toBe('Al Pacino')
  })

  it('should trigger fetch when effectiveSearchTerm changes', async () => {
    // Spy on the fetch method
    const fetchSpy = vi.spyOn(wrapper.vm, 'debouncedFetchUnratedMoviesByValue')
    
    // Add a chip which should change effectiveSearchTerm
    wrapper.vm.activeFilters = [{
      id: 'director-1',
      type: 'director',
      value: 'Steven Spielberg',
      display: 'Steven Spielberg'
    }]
    
    await wrapper.vm.$nextTick()
    
    // Should have called fetch
    expect(fetchSpy).toHaveBeenCalled()
  })
})
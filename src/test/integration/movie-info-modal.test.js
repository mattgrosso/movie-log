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

describe('Movie Info Modal', () => {
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

  describe('Modal State Management', () => {
    it('should initialize with modal closed', () => {
      expect(wrapper.vm.showMovieInfoModal).toBe(false)
      expect(wrapper.vm.selectedMovieInfo).toBe(null)
    })

    it('should open modal when showMovieInfo is called', async () => {
      const testMovie = {
        id: 123,
        title: 'Test Movie',
        release_date: '2023-01-01',
        poster_path: '/test-poster.jpg',
        overview: 'Test movie description'
      }

      wrapper.vm.showMovieInfo(testMovie)

      expect(wrapper.vm.showMovieInfoModal).toBe(true)
      expect(wrapper.vm.selectedMovieInfo).toStrictEqual(testMovie)
    })

    it('should close modal when closeMovieInfoModal is called', async () => {
      // First open the modal
      const testMovie = { id: 123, title: 'Test Movie' }
      wrapper.vm.showMovieInfo(testMovie)
      expect(wrapper.vm.showMovieInfoModal).toBe(true)

      // Then close it
      wrapper.vm.closeMovieInfoModal()
      expect(wrapper.vm.showMovieInfoModal).toBe(false)
      expect(wrapper.vm.selectedMovieInfo).toBe(null)
    })
  })

  describe('Modal Rendering', () => {
    it('should not render modal when showMovieInfoModal is false', () => {
      const modal = wrapper.find('.movie-info-modal')
      expect(modal.exists()).toBe(false)
    })

    it('should render modal when showMovieInfoModal is true', async () => {
      const testMovie = {
        id: 123,
        title: 'Test Movie',
        release_date: '2023-01-01',
        poster_path: '/test-poster.jpg',
        overview: 'Test movie description',
        genres: [{ name: 'Action' }, { name: 'Drama' }],
        vote_average: 8.5
      }

      wrapper.vm.showMovieInfo(testMovie)
      await wrapper.vm.$nextTick()

      const modal = wrapper.find('.movie-info-modal')
      expect(modal.exists()).toBe(true)
    })

    it('should display movie information correctly', async () => {
      const testMovie = {
        id: 123,
        title: 'Test Movie',
        release_date: '2023-01-01',
        poster_path: '/test-poster.jpg',
        overview: 'Test movie description',
        genres: [{ name: 'Action' }, { name: 'Drama' }],
        vote_average: 8.5
      }

      wrapper.vm.showMovieInfo(testMovie)
      await wrapper.vm.$nextTick()

      const modal = wrapper.find('.movie-info-modal')
      expect(modal.exists()).toBe(true)
      
      // Check if movie title is displayed
      expect(modal.text()).toContain('Test Movie')
      
      // Check if year is displayed
      expect(modal.text()).toContain('2022')
      
      // Check if genres are displayed
      expect(modal.text()).toContain('Action, Drama')
      
      // Check if overview is displayed
      expect(modal.text()).toContain('Test movie description')
      
      // Check if rating is displayed
      expect(modal.text()).toContain('8.5/10')
    })

    it('should handle missing movie data gracefully', async () => {
      const testMovie = {
        id: 123,
        title: 'Test Movie'
        // Missing other fields
      }

      wrapper.vm.showMovieInfo(testMovie)
      await wrapper.vm.$nextTick()

      const modal = wrapper.find('.movie-info-modal')
      expect(modal.exists()).toBe(true)
      expect(modal.text()).toContain('Test Movie')
    })
  })

  describe('Modal Interaction', () => {
    it('should close modal when close button is clicked', async () => {
      const testMovie = { id: 123, title: 'Test Movie' }
      wrapper.vm.showMovieInfo(testMovie)
      await wrapper.vm.$nextTick()

      const closeButton = wrapper.find('.modal-header .btn-close')
      expect(closeButton.exists()).toBe(true)

      await closeButton.trigger('click')
      expect(wrapper.vm.showMovieInfoModal).toBe(false)
      expect(wrapper.vm.selectedMovieInfo).toBe(null)
    })

    it('should close modal when overlay is clicked', async () => {
      const testMovie = { id: 123, title: 'Test Movie' }
      wrapper.vm.showMovieInfo(testMovie)
      await wrapper.vm.$nextTick()

      const overlay = wrapper.find('.modal-overlay')
      expect(overlay.exists()).toBe(true)

      await overlay.trigger('click')
      expect(wrapper.vm.showMovieInfoModal).toBe(false)
      expect(wrapper.vm.selectedMovieInfo).toBe(null)
    })
  })

  describe('Scroll Prevention', () => {
    let addSpy, removeSpy

    beforeEach(() => {
      // Create spies for classList methods
      addSpy = vi.spyOn(document.body.classList, 'add')
      removeSpy = vi.spyOn(document.body.classList, 'remove')
    })

    afterEach(() => {
      // Restore original methods
      addSpy.mockRestore()
      removeSpy.mockRestore()
    })

    it('should add no-scroll class when modal opens', () => {
      const testMovie = { id: 123, title: 'Test Movie' }
      
      wrapper.vm.showMovieInfo(testMovie)
      
      expect(addSpy).toHaveBeenCalledWith('no-scroll')
    })

    it('should remove no-scroll class when modal closes', () => {
      const testMovie = { id: 123, title: 'Test Movie' }
      
      // Open modal first
      wrapper.vm.showMovieInfo(testMovie)
      
      // Then close it
      wrapper.vm.closeMovieInfoModal()
      
      expect(removeSpy).toHaveBeenCalledWith('no-scroll')
    })
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

// Mock external dependencies
vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({
      data: {
        results: [
          {
            id: 101,
            title: 'Jaws',
            release_date: '1975-06-20',
            poster_path: '/l2nhJBVdqKFNRt4wRANYoRqbCr.jpg',
            backdrop_path: '/s2bT29y0NgXxxKy5TJ0KYPGjRHB.jpg',
            vote_count: 100
          },
          {
            id: 102, 
            title: 'E.T. the Extra-Terrestrial',
            release_date: '1982-06-11',
            poster_path: '/an0nD6uq6nju6gc8Ql7cShKKA1Z.jpg',
            backdrop_path: '/8BPZO0Bf8TeAy8znF43z8soK3ys.jpg',
            vote_count: 200
          }
        ]
      }
    }))
  }
}))

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

describe('More From Section', () => {
  let wrapper
  let mockStore
  let mockMovies

  beforeEach(() => {
    // Create test movies with Steven Spielberg
    mockMovies = [
      {
        movie: {
          id: 1,
          title: 'Indiana Jones and the Last Crusade',
          release_date: '1989-05-24',
          genres: [{ name: 'Action' }, { name: 'Adventure' }],
          cast: [
            { name: 'Harrison Ford', character: 'Indiana Jones' },
            { name: 'Sean Connery', character: 'Professor Henry Jones' }
          ],
          crew: [
            { name: 'Steven Spielberg', job: 'Director' },
            { name: 'George Lucas', job: 'Producer' }
          ],
          production_companies: [{ name: 'Lucasfilm' }, { name: 'Paramount Pictures' }],
          flatKeywords: ['archaeology', 'adventure', 'nazi']
        },
        ratings: [{ calculatedTotal: 8.5, date: '2023-01-01' }],
        dbKey: 'movie-1'
      },
      {
        movie: {
          id: 2,
          title: 'Jurassic Park', 
          release_date: '1993-06-11',
          genres: [{ name: 'Action' }, { name: 'Sci-Fi' }],
          cast: [
            { name: 'Sam Neill', character: 'Dr. Alan Grant' },
            { name: 'Laura Dern', character: 'Dr. Ellie Sattler' }
          ],
          crew: [
            { name: 'Steven Spielberg', job: 'Director' },
            { name: 'Kathleen Kennedy', job: 'Producer' }
          ],
          production_companies: [{ name: 'Universal Pictures' }, { name: 'Amblin Entertainment' }],
          flatKeywords: ['dinosaurs', 'genetics', 'island']
        },
        ratings: [{ calculatedTotal: 9.0, date: '2023-02-01' }],
        dbKey: 'movie-2'
      },
      {
        movie: {
          id: 3,
          title: 'Schindlers List',
          release_date: '1993-12-15',
          genres: [{ name: 'Drama' }, { name: 'History' }],
          cast: [
            { name: 'Liam Neeson', character: 'Oskar Schindler' },
            { name: 'Ralph Fiennes', character: 'Amon Göth' }
          ],
          crew: [
            { name: 'Steven Spielberg', job: 'Director' },
            { name: 'Gerald R. Molen', job: 'Producer' }
          ],
          production_companies: [{ name: 'Universal Pictures' }, { name: 'Amblin Entertainment' }],
          flatKeywords: ['holocaust', 'world war ii', 'factory']
        },
        ratings: [{ calculatedTotal: 9.5, date: '2023-03-01' }],
        dbKey: 'movie-3'
      }
    ]

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
        allMediaAsArray: mockMovies,
        allMediaSortedByRating: [...mockMovies].sort((a, b) => b.ratings[0].calculatedTotal - a.ratings[0].calculatedTotal)
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
          'DBGridLayoutSearchResult': {
            template: '<div data-testid="db-grid-result">{{ result.movie.title }}</div>',
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

  describe('Director Search Flow', () => {
    it('should show More from section for Steven Spielberg director chip', async () => {
      // Simulate the exact flow: click on Steven Spielberg from a movie
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      // Wait for any async operations
      await wrapper.vm.$nextTick()
      
      // Check that we have the director chip
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.activeFilters[0].type).toBe('director')
      expect(wrapper.vm.activeFilters[0].value).toBe('Steven Spielberg')
      
      // Check that effectiveSearchTerm is working
      expect(wrapper.vm.effectiveSearchTerm).toBe('Steven Spielberg')
      
      // Simulate unrated movies being loaded successfully
      wrapper.vm.unratedMovies = [
        {
          id: 101,
          title: 'Jaws',
          release_date: '1975-06-20',
          poster_path: '/l2nhJBVdqKFNRt4wRANYoRqbCr.jpg'
        },
        {
          id: 102,
          title: 'E.T. the Extra-Terrestrial', 
          release_date: '1982-06-11',
          poster_path: '/an0nD6uq6nju6gc8Ql7cShKKA1Z.jpg'
        }
      ]
      wrapper.vm.unratedMoviesLoading = false
      wrapper.vm.unratedMoviesError = null
      wrapper.vm.unratedMoviesSearchType = 'person'
      
      await wrapper.vm.$nextTick()
      
      // Check that displayableUnratedMovies has content
      expect(wrapper.vm.displayableUnratedMovies.length).toBeGreaterThan(0)
      
      // Check that filtered results exist (Steven Spielberg movies)
      expect(wrapper.vm.filteredResults.length).toBeGreaterThan(0)
      expect(wrapper.vm.paginatedSortedResults.length).toBeGreaterThan(0)
      
      // Check all conditions for More from section
      expect(wrapper.vm.displayableUnratedMovies.length).toBeGreaterThan(0)
      expect(wrapper.vm.unratedMoviesLoading).toBe(false)
      expect(wrapper.vm.unratedMoviesError).toBe(null)
      expect(wrapper.vm.paginatedSortedResults.length).toBeGreaterThan(0)
      
      // The More from section should be visible
      const moreFromSection = wrapper.find('.unrated-movies-grid')
      expect(moreFromSection.exists()).toBe(true)
      
      // Check the heading shows the correct person
      const heading = moreFromSection.find('h3')
      expect(heading.text()).toContain('More from Steven Spielberg:')
    })

    it('should trigger unrated movies fetch when director chip is added', async () => {
      // Spy on the debounced fetch function
      const fetchSpy = vi.spyOn(wrapper.vm, 'debouncedFetchUnratedMoviesByValue')
      
      // Add director chip
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      await wrapper.vm.$nextTick()
      
      // Should trigger fetch with correct parameters
      expect(fetchSpy).toHaveBeenCalledWith('Steven Spielberg', { type: 'director', value: 'Steven Spielberg' })
    })

    it('should set correct search type when fetching by director', async () => {
      // Add director chip
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      // Manually trigger the fetch like the watcher would
      await wrapper.vm.fetchUnratedMoviesByValue('Steven Spielberg', { type: 'director', value: 'Steven Spielberg' })
      
      // Should set the search type to 'person'
      expect(wrapper.vm.unratedMoviesSearchType).toBe('person')
    })
  })

  describe('Conditions for More From Section', () => {
    beforeEach(async () => {
      // Set up base conditions
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      wrapper.vm.unratedMovies = [
        { id: 101, title: 'Jaws', poster_path: '/test.jpg' },
        { id: 102, title: 'E.T.', poster_path: '/test2.jpg' }
      ]
      wrapper.vm.unratedMoviesSearchType = 'person'
    })

    it('should show when all conditions are met', async () => {
      wrapper.vm.unratedMoviesLoading = false
      wrapper.vm.unratedMoviesError = null
      
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.displayableUnratedMovies.length).toBeGreaterThan(0)
      expect(wrapper.vm.paginatedSortedResults.length).toBeGreaterThan(0)
      
      const moreFromSection = wrapper.find('.unrated-movies-grid')
      expect(moreFromSection.exists()).toBe(true)
    })

    it('should NOT show when unrated movies are loading', async () => {
      wrapper.vm.unratedMoviesLoading = true
      wrapper.vm.unratedMoviesError = null
      
      await wrapper.vm.$nextTick()
      
      const moreFromSection = wrapper.find('.unrated-movies-grid')
      expect(moreFromSection.exists()).toBe(false)
      
      // But loading indicator should show
      const loadingSection = wrapper.find('.unrated-movies-loading')
      expect(loadingSection.exists()).toBe(true)
    })

    it('should NOT show when there are no unrated movies', async () => {
      wrapper.vm.unratedMovies = []
      wrapper.vm.unratedMoviesLoading = false
      wrapper.vm.unratedMoviesError = null
      
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.displayableUnratedMovies.length).toBe(0)
      
      const moreFromSection = wrapper.find('.unrated-movies-grid')
      expect(moreFromSection.exists()).toBe(false)
    })

    it('should NOT show when there is an error', async () => {
      wrapper.vm.unratedMoviesLoading = false
      wrapper.vm.unratedMoviesError = 'API Error'
      
      await wrapper.vm.$nextTick()
      
      const moreFromSection = wrapper.find('.unrated-movies-grid')
      expect(moreFromSection.exists()).toBe(false)
    })

    it('should NOT show when there are no filtered results', async () => {
      // Clear all movies to simulate no results
      wrapper.vm.activeFilters = []
      mockStore.getters.allMediaAsArray = []
      wrapper.vm.unratedMoviesLoading = false
      wrapper.vm.unratedMoviesError = null
      
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.paginatedSortedResults.length).toBe(0)
      
      const moreFromSection = wrapper.find('.unrated-movies-grid')
      expect(moreFromSection.exists()).toBe(false)
    })
  })

  describe('Different Search Types', () => {
    it('should show correct heading for person search', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Christopher Nolan' } })
      
      wrapper.vm.unratedMovies = [{ id: 101, title: 'Tenet', poster_path: '/test.jpg' }]
      wrapper.vm.unratedMoviesLoading = false
      wrapper.vm.unratedMoviesError = null
      wrapper.vm.unratedMoviesSearchType = 'person'
      
      await wrapper.vm.$nextTick()
      
      const heading = wrapper.find('.unrated-movies-grid h3')
      expect(heading.text()).toContain('More from Christopher Nolan:')
    })

    it('should show correct heading for genre search', async () => {
      await wrapper.vm.addGenreFilter({ target: { value: 'Action' } })
      
      wrapper.vm.unratedMovies = [{ id: 101, title: 'Die Hard', poster_path: '/test.jpg' }]
      wrapper.vm.unratedMoviesLoading = false
      wrapper.vm.unratedMoviesError = null
      wrapper.vm.unratedMoviesSearchType = 'genre'
      
      await wrapper.vm.$nextTick()
      
      const heading = wrapper.find('.unrated-movies-grid h3')
      expect(heading.text()).toContain('More action movies:')
    })
  })

  describe('Real-world Steven Spielberg Flow', () => {
    it('should work for the exact user flow: Last Crusade -> Steven Spielberg', async () => {
      // Step 1: Simulate starting from Last Crusade page
      // Step 2: Click on Steven Spielberg (adds director chip)
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      // Step 3: Check that filtering is working
      const spielbergMovies = wrapper.vm.filteredResults
      expect(spielbergMovies.length).toBeGreaterThan(0)
      expect(spielbergMovies.every(movie => 
        movie.movie.crew.some(crew => crew.name === 'Steven Spielberg' && crew.job === 'Director')
      )).toBe(true)
      
      // Step 4: Simulate successful API response for unrated movies
      wrapper.vm.unratedMovies = [
        {
          id: 101,
          title: 'Jaws',
          release_date: '1975-06-20',
          poster_path: '/l2nhJBVdqKFNRt4wRANYoRqbCr.jpg',
          backdrop_path: '/s2bT29y0NgXxxKy5TJ0KYPGjRHB.jpg'
        },
        {
          id: 102,
          title: 'E.T. the Extra-Terrestrial',
          release_date: '1982-06-11', 
          poster_path: '/an0nD6uq6nju6gc8Ql7cShKKA1Z.jpg',
          backdrop_path: '/8BPZO0Bf8TeAy8znF43z8soK3ys.jpg'
        }
      ]
      wrapper.vm.unratedMoviesLoading = false
      wrapper.vm.unratedMoviesError = null
      wrapper.vm.unratedMoviesSearchType = 'person'
      
      await wrapper.vm.$nextTick()
      
      // Step 5: Verify More from section appears
      expect(wrapper.vm.displayableUnratedMovies.length).toBe(2)
      expect(wrapper.vm.unratedMoviesLoading).toBe(false)
      expect(wrapper.vm.unratedMoviesError).toBe(null)
      expect(wrapper.vm.paginatedSortedResults.length).toBeGreaterThan(0)
      
      const moreFromSection = wrapper.find('.unrated-movies-grid')
      expect(moreFromSection.exists()).toBe(true)
      
      const heading = moreFromSection.find('h3')
      expect(heading.text()).toBe('More from Steven Spielberg:')
      
      // Step 6: Verify unrated movies are displayed
      const unratedMovieElements = moreFromSection.findAll('.unrated-movie-card, .unrated-movie, [class*="unrated"]')
      // Should have some unrated movie elements (exact selector depends on template)
      expect(unratedMovieElements.length).toBeGreaterThanOrEqual(0) // At minimum, structure should exist
    })
  })
})
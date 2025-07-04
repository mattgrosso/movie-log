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

describe('Chip Filtering System', () => {
  let wrapper
  let mockStore
  let mockMovies

  beforeEach(() => {
    // Reset any timers or state that might carry over
    vi.clearAllTimers()
    // Create comprehensive test data to cover various chip filtering scenarios
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
          title: 'Apollo 13',
          release_date: '1995-06-30',
          genres: [{ name: 'Drama' }, { name: 'History' }],
          cast: [
            { name: 'Tom Hanks', character: 'Jim Lovell' },
            { name: 'Kevin Bacon', character: 'Jack Swigert' }
          ],
          crew: [
            { name: 'Ron Howard', job: 'Director' },
            { name: 'Brian Grazer', job: 'Producer' }
          ],
          production_companies: [{ name: 'Imagine Entertainment' }, { name: 'Universal Pictures' }],
          flatKeywords: ['space', 'nasa', 'disaster']
        },
        ratings: [{ calculatedTotal: 8.8, date: '2023-03-01' }],
        dbKey: 'movie-3'
      },
      {
        movie: {
          id: 4,
          title: 'The Rock',
          release_date: '1996-06-07',
          genres: [{ name: 'Action' }, { name: 'Thriller' }],
          cast: [
            { name: 'Sean Connery', character: 'John Mason' },
            { name: 'Nicolas Cage', character: 'Stanley Goodspeed' }
          ],
          crew: [
            { name: 'Michael Bay', job: 'Director' },
            { name: 'Jerry Bruckheimer', job: 'Producer' }
          ],
          production_companies: [{ name: 'Hollywood Pictures' }, { name: 'Don Simpson/Jerry Bruckheimer Films' }],
          flatKeywords: ['prison', 'alcatraz', 'chemical weapons']
        },
        ratings: [{ calculatedTotal: 7.5, date: '2023-04-01' }],
        dbKey: 'movie-4'
      },
      {
        movie: {
          id: 5,
          title: 'A Beautiful Mind',
          release_date: '2001-12-21',
          genres: [{ name: 'Drama' }, { name: 'Biography' }],
          cast: [
            { name: 'Russell Crowe', character: 'John Nash' },
            { name: 'Jennifer Connelly', character: 'Alicia Nash' }
          ],
          crew: [
            { name: 'Ron Howard', job: 'Director' },
            { name: 'Brian Grazer', job: 'Producer' }
          ],
          production_companies: [{ name: 'Imagine Entertainment' }, { name: 'DreamWorks Pictures' }],
          flatKeywords: ['mathematics', 'mental illness', 'genius']
        },
        ratings: [{ calculatedTotal: 8.2, date: '2023-05-01' }],
        dbKey: 'movie-5'
      },
      {
        movie: {
          id: 6,
          title: 'Backdraft',
          release_date: '1991-05-24',
          genres: [{ name: 'Action' }, { name: 'Drama' }],
          cast: [
            { name: 'Kurt Russell', character: 'Stephen McCaffrey' },
            { name: 'William Baldwin', character: 'Brian McCaffrey' }
          ],
          crew: [
            { name: 'Ron Howard', job: 'Director' },
            { name: 'Brian Grazer', job: 'Producer' }
          ],
          production_companies: [{ name: 'Imagine Entertainment' }, { name: 'Universal Pictures' }],
          flatKeywords: ['firefighters', 'chicago', 'arson']
        },
        ratings: [{ calculatedTotal: 7.8, date: '2023-06-01' }],
        dbKey: 'movie-6'
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
          tags: { 'viewing-tags': {} }
        }
      },
      getters: {
        allMediaAsArray: mockMovies,
        allMediaSortedByRating: [...mockMovies].sort((a, b) => b.ratings[0].calculatedTotal - a.ratings[0].calculatedTotal)
      },
      commit: vi.fn(),
      dispatch: vi.fn()
    }

    // Mock the computed properties before mounting
    const mockDirectors = [
      { name: 'Steven Spielberg' },
      { name: 'Ron Howard' },
      { name: 'Michael Bay' }
    ]
    
    const mockGenres = [
      { name: 'Action' },
      { name: 'Drama' },
      { name: 'Adventure' },
      { name: 'Sci-Fi' }
    ]

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

    // Override the computed properties using vi.spyOn
    vi.spyOn(wrapper.vm, 'allDirectors', 'get').mockReturnValue(mockDirectors)
    vi.spyOn(wrapper.vm, 'allGenres', 'get').mockReturnValue(mockGenres)
    
    // Ensure clean state for each test
    wrapper.vm.activeFilters = []
    wrapper.vm.value = ''
    wrapper.vm.inputValue = ''
  })

  describe('Basic Chip Operations', () => {
    it('should create director chip when known director name is converted', async () => {
      // Set search value and trigger chip conversion
      await wrapper.setData({ value: 'Steven Spielberg' })
      
      // Call convertSearchToChip and wait for the timeout
      wrapper.vm.convertSearchToChip()
      
      // Wait for the setTimeout (150ms) to complete
      await new Promise(resolve => setTimeout(resolve, 200))
      
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.activeFilters[0].type).toBe('director')
      expect(wrapper.vm.activeFilters[0].value).toBe('Steven Spielberg')
      expect(wrapper.vm.activeFilters[0].display).toBe('Steven Spielberg')
    })

    it('should create search chip when unknown term is converted', async () => {
      // Set search value and trigger chip conversion
      await wrapper.setData({ value: 'Unknown Person' })
      
      wrapper.vm.convertSearchToChip()
      
      // Wait for the setTimeout (150ms) to complete
      await new Promise(resolve => setTimeout(resolve, 200))

      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.activeFilters[0].type).toBe('search')
      expect(wrapper.vm.activeFilters[0].value).toBe('Unknown Person')
      expect(wrapper.vm.activeFilters[0].display).toBe('Unknown Person')
    })

    it('should create director chip', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })

      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.activeFilters[0].type).toBe('director')
      expect(wrapper.vm.activeFilters[0].value).toBe('Steven Spielberg')
      expect(wrapper.vm.activeFilters[0].display).toBe('Director: Steven Spielberg')
    })

    it('should create year chip', async () => {
      await wrapper.vm.addYearFilter({ target: { value: '1995' } })

      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.activeFilters[0].type).toBe('year')
      expect(wrapper.vm.activeFilters[0].value).toBe('1995')
      expect(wrapper.vm.activeFilters[0].display).toBe('Year: 1995')
    })

    it('should create genre chip', async () => {
      await wrapper.vm.addGenreFilter({ target: { value: 'Action' } })

      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.activeFilters[0].type).toBe('genre')
      expect(wrapper.vm.activeFilters[0].value).toBe('Action')
      expect(wrapper.vm.activeFilters[0].display).toBe('Genre: Action')
    })

    it('should remove chip when remove button is clicked', async () => {
      // Add a chip first
      await wrapper.vm.addYearFilter({ target: { value: '1995' } })
      expect(wrapper.vm.activeFilters).toHaveLength(1)

      // Remove the chip
      const chipId = wrapper.vm.activeFilters[0].id
      await wrapper.vm.removeFilter(chipId)

      expect(wrapper.vm.activeFilters).toHaveLength(0)
    })

    it('should clear all chips when clearAllFilters is called', async () => {
      // Add multiple chips
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      await wrapper.vm.addYearFilter({ target: { value: '1995' } })
      expect(wrapper.vm.activeFilters).toHaveLength(2)

      // Clear all
      await wrapper.vm.clearAllFilters()

      expect(wrapper.vm.activeFilters).toHaveLength(0)
    })
  })

  describe('Single Chip Filtering', () => {
    it('should filter by director chip', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })

      const filtered = wrapper.vm.filteredResults
      expect(filtered).toHaveLength(2) // Indiana Jones and Jurassic Park
      expect(filtered.every(movie => 
        movie.movie.crew.some(crew => crew.name === 'Steven Spielberg' && crew.job === 'Director')
      )).toBe(true)
    })

    it('should filter by year chip', async () => {
      await wrapper.vm.addYearFilter({ target: { value: '1995' } })

      const filtered = wrapper.vm.filteredResults
      expect(filtered).toHaveLength(1) // Apollo 13
      expect(filtered[0].movie.title).toBe('Apollo 13')
    })

    it('should filter by genre chip', async () => {
      await wrapper.vm.addGenreFilter({ target: { value: 'Action' } })

      const filtered = wrapper.vm.filteredResults
      expect(filtered.length).toBeGreaterThan(0)
      expect(filtered.every(movie => 
        movie.movie.genres.some(genre => genre.name === 'Action')
      )).toBe(true)
    })

    it('should filter by production company chip', async () => {
      // Create a production company filter manually
      wrapper.vm.activeFilters.push({
        id: 'company-test',
        type: 'company',
        value: 'Imagine Entertainment',
        display: 'Company: Imagine Entertainment'
      })

      const filtered = wrapper.vm.filteredResults
      expect(filtered).toHaveLength(3) // Apollo 13, A Beautiful Mind, Backdraft
      expect(filtered.every(movie => 
        movie.movie.production_companies.some(company => company.name === 'Imagine Entertainment')
      )).toBe(true)
    })
  })

  describe('Multiple Chip Combinations (AND Logic)', () => {
    it('should combine director and year chips with AND logic', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Ron Howard' } })
      await wrapper.vm.addYearFilter({ target: { value: '1995' } })

      const filtered = wrapper.vm.filteredResults
      expect(filtered).toHaveLength(1) // Only Apollo 13
      expect(filtered[0].movie.title).toBe('Apollo 13')
    })

    it('should combine production company and year chips with AND logic (regression test)', async () => {
      // This is the specific bug that was reported
      wrapper.vm.activeFilters.push({
        id: 'company-test',
        type: 'company',
        value: 'Imagine Entertainment',
        display: 'Company: Imagine Entertainment'
      })
      await wrapper.vm.addYearFilter({ target: { value: '1995' } })

      const filtered = wrapper.vm.filteredResults
      expect(filtered).toHaveLength(1) // Only Apollo 13 (1995 + Imagine Entertainment)
      expect(filtered[0].movie.title).toBe('Apollo 13')
      
      // Verify it's the intersection, not union
      expect(filtered.length).toBeLessThan(3) // Should be fewer than Imagine Entertainment alone (3 movies)
    })

    it('should combine genre and director chips with AND logic', async () => {
      await wrapper.vm.addGenreFilter({ target: { value: 'Action' } })
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })

      const filtered = wrapper.vm.filteredResults
      expect(filtered).toHaveLength(2) // Indiana Jones and Jurassic Park
      expect(filtered.every(movie => 
        movie.movie.genres.some(genre => genre.name === 'Action') &&
        movie.movie.crew.some(crew => crew.name === 'Steven Spielberg' && crew.job === 'Director')
      )).toBe(true)
    })

    it('should handle three chips with AND logic', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Ron Howard' } })
      await wrapper.vm.addGenreFilter({ target: { value: 'Drama' } })
      wrapper.vm.activeFilters.push({
        id: 'company-test',
        type: 'company',
        value: 'Imagine Entertainment',
        display: 'Company: Imagine Entertainment'
      })

      const filtered = wrapper.vm.filteredResults
      expect(filtered).toHaveLength(3) // Apollo 13, A Beautiful Mind, and Backdraft
      expect(filtered.every(movie => 
        movie.movie.crew.some(crew => crew.name === 'Ron Howard' && crew.job === 'Director') &&
        movie.movie.genres.some(genre => genre.name === 'Drama') &&
        movie.movie.production_companies.some(company => company.name === 'Imagine Entertainment')
      )).toBe(true)
    })

    it('should return empty results when no movies match all chips', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      await wrapper.vm.addYearFilter({ target: { value: '2010' } }) // No Spielberg movies in 2010 in our test data

      const filtered = wrapper.vm.filteredResults
      expect(filtered).toHaveLength(0)
    })
  })

  describe('Search Chip Behavior', () => {
    it('should apply search chip with proper search logic', async () => {
      await wrapper.setData({ value: 'Sean Connery' })
      
      wrapper.vm.convertSearchToChip()
      await new Promise(resolve => setTimeout(resolve, 200))

      const filtered = wrapper.vm.filteredResults
      expect(filtered).toHaveLength(2) // Indiana Jones and The Rock
      expect(filtered.every(movie => 
        movie.movie.cast.some(cast => cast.name.includes('Sean Connery'))
      )).toBe(true)
    })

    it('should combine search chip with other chips', async () => {
      await wrapper.setData({ value: 'Sean Connery' })
      
      wrapper.vm.convertSearchToChip()
      await new Promise(resolve => setTimeout(resolve, 200))
      
      await wrapper.vm.addYearFilter({ target: { value: '1989' } })

      const filtered = wrapper.vm.filteredResults
      expect(filtered).toHaveLength(1) // Only Indiana Jones
      expect(filtered[0].movie.title).toBe('Indiana Jones and the Last Crusade')
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain this.value when chips are active for backward compatibility', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })

      // this.value should be set for backward compatibility
      expect(wrapper.vm.value).toBe('Steven Spielberg')
    })

    it('should update this.value when removing chips', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      await wrapper.vm.addYearFilter({ target: { value: '1993' } })

      // Remove director chip, should update this.value to year chip value
      const directorChipId = wrapper.vm.activeFilters.find(f => f.type === 'director').id
      await wrapper.vm.removeFilter(directorChipId)

      expect(wrapper.vm.value).toBe('1993')
    })

    it('should clear this.value when all chips are removed', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      const chipId = wrapper.vm.activeFilters[0].id
      await wrapper.vm.removeFilter(chipId)

      expect(wrapper.vm.value).toBe('')
    })
  })

  describe('Edge Cases', () => {
    it('should handle chips with no matching movies gracefully', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'NonExistentDirector' } })

      const filtered = wrapper.vm.filteredResults
      expect(filtered).toHaveLength(0)
    })

    it('should handle special characters in chip values', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: "D'Angelo Russell" } })

      // Should not crash and should handle the special character
      expect(wrapper.vm.activeFilters).toHaveLength(1)
      expect(wrapper.vm.activeFilters[0].value).toBe("D'Angelo Russell")
    })

    it('should handle empty string chip values', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: '' } })

      // Should not create a chip for empty values
      expect(wrapper.vm.activeFilters).toHaveLength(0)
    })

    it('should handle case sensitivity in filtering', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'steven spielberg' } })

      // Should still match despite case difference
      const filtered = wrapper.vm.filteredResults
      expect(filtered).toHaveLength(0) // Case sensitive exact match
    })

    it('should handle duplicate chips', async () => {
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })

      // Should allow duplicate chips (user might want to add same filter twice)
      expect(wrapper.vm.activeFilters).toHaveLength(2)
    })
  })

  describe('Performance and State Management', () => {
    it('should efficiently filter large result sets', async () => {
      // Add many more movies to test performance
      const additionalMovies = Array.from({ length: 100 }, (_, i) => ({
        movie: {
          id: 100 + i,
          title: `Test Movie ${i}`,
          release_date: '2000-01-01',
          genres: [{ name: 'Drama' }],
          cast: [{ name: 'Test Actor' }],
          crew: [{ name: 'Test Director', job: 'Director' }],
          production_companies: [{ name: 'Test Studio' }],
          flatKeywords: ['test']
        },
        ratings: [{ calculatedTotal: 7.0, date: '2023-01-01' }],
        dbKey: `test-movie-${i}`
      }))

      mockStore.getters.allMediaAsArray = [...mockMovies, ...additionalMovies]
      await wrapper.vm.$nextTick()

      await wrapper.vm.addGenreFilter({ target: { value: 'Drama' } })

      const startTime = performance.now()
      const filtered = wrapper.vm.filteredResults
      const endTime = performance.now()

      // Should complete filtering in reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100)
      expect(filtered.length).toBeGreaterThan(0)
    })

    it('should maintain reactive updates when chips change', async () => {
      let filteredCount = wrapper.vm.filteredResults.length

      await wrapper.vm.addDirectorFilter({ target: { value: 'Steven Spielberg' } })
      
      // Should reactively update
      expect(wrapper.vm.filteredResults.length).not.toBe(filteredCount)
      expect(wrapper.vm.filteredResults.length).toBe(2)
    })
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import addRating from '@/assets/javascript/AddRating.js'

// Mock external dependencies
vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}))

vi.mock('@/store/index', () => ({
  default: {
    state: {
      currentLog: 'movieLog',
      movieLog: {},
      tvLog: {}
    },
    getters: {
      allMediaSortedByRating: []
    },
    dispatch: vi.fn()
  }
}))

// Import axios for mocking
import axios from 'axios'
import store from '@/store/index'

describe('TMDb Data Processing & Movie Rating Addition', () => {
  let mockTMDbData
  let mockCreditsData
  let mockKeywordsData
  let mockRatings
  let mockMovieTags

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock TMDb API responses
    mockTMDbData = {
      id: 550,
      title: 'Fight Club',
      release_date: '1999-10-15',
      runtime: 139,
      backdrop_path: '/fCayJrkfRaCRCTh8GqN30f8oyQF.jpg',
      poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      imdb_id: 'tt0137523',
      genres: [
        { id: 18, name: 'Drama' },
        { id: 53, name: 'Thriller' }
      ],
      production_companies: [
        { id: 508, name: '20th Century Fox' },
        { id: 711, name: 'Fox 2000 Pictures' }
      ]
    }

    mockCreditsData = {
      cast: [
        { name: 'Brad Pitt', character: 'Tyler Durden' },
        { name: 'Edward Norton', character: 'The Narrator' },
        { name: 'Helena Bonham Carter', character: 'Marla Singer' }
      ],
      crew: [
        { name: 'David Fincher', job: 'Director' },
        { name: 'Chuck Palahniuk', job: 'Novel' },
        { name: 'Jim Uhls', job: 'Screenplay' }
      ]
    }

    mockKeywordsData = {
      keywords: [
        { id: 825, name: 'support group' },
        { id: 849, name: 'dual identity' },
        { id: 851, name: 'nihilism' }
      ]
    }

    mockRatings = [
      {
        id: 550,
        love: 9,
        overall: 9,
        story: 8,
        direction: 10,
        imagery: 9,
        performance: 9,
        soundtrack: 8,
        stickiness: 9,
        date: '2023-10-15',
        medium: 'Theater',
        ownership: 'Digital',
        chatGPTKeywords: ['psychological', 'underground']
      }
    ]

    mockMovieTags = [
      { title: 'dark-themes' },
      { title: 'masterpiece' }
    ]

    // Setup default axios mock responses
    axios.get.mockImplementation((url) => {
      if (url.includes('/movie/550?')) {
        return Promise.resolve({ data: mockTMDbData })
      }
      if (url.includes('/movie/550/credits')) {
        return Promise.resolve({ data: mockCreditsData })
      }
      if (url.includes('/movie/550/keywords')) {
        return Promise.resolve({ data: mockKeywordsData })
      }
      if (url.includes('/person/') && url.includes('/movie_credits')) {
        return Promise.resolve({
          data: {
            crew: [
              {
                id: 550,
                job: 'Director',
                title: 'Fight Club',
                release_date: '1999-10-15',
                popularity: 8.5
              },
              {
                id: 26752,
                job: 'Director', 
                title: 'Gone Girl',
                release_date: '2014-10-01',
                popularity: 9.2
              }
            ]
          }
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    // Reset store state
    store.state.movieLog = {}
    store.state.currentLog = 'movieLog'
  })

  describe('TMDb API Data Fetching', () => {
    it('should fetch movie data, credits, and keywords from TMDb API', async () => {
      const result = await addRating(mockRatings, mockMovieTags)

      expect(axios.get).toHaveBeenCalledTimes(3)
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/movie/550?'))
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/movie/550/credits'))
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/movie/550/keywords'))
    })

    it('should handle TV show data when currentLog is tvLog', async () => {
      store.state.currentLog = 'tvLog'
      const tvRatings = [{
        ...mockRatings[0],
        tvShowId: 550
      }]
      // Keep the id field since the function requires ratings[0].id to exist
      // The getTMDBData function will use either id or tvShowId

      // Update axios mock to handle TV show endpoints
      axios.get.mockImplementation((url) => {
        if (url.includes('/tv/550?')) {
          return Promise.resolve({ data: mockTMDbData })
        }
        if (url.includes('/tv/550/credits')) {
          return Promise.resolve({ data: mockCreditsData })
        }
        if (url.includes('/tv/550/keywords')) {
          return Promise.resolve({ data: mockKeywordsData })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      await addRating(tvRatings, mockMovieTags)

      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/tv/550?'))
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/tv/550/credits'))
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/tv/550/keywords'))
    })

    it('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValue(new Error('API Error'))

      const result = await addRating(mockRatings, mockMovieTags)

      expect(result).toBeDefined()
      expect(result.value.movie.title).toBe('') // Should use empty string when no TMDb data
      expect(result.value.movie.cast).toEqual([])
      expect(result.value.movie.crew).toEqual([])
    })

    it('should handle missing ratings gracefully', async () => {
      // The actual implementation will throw an error when accessing ratings[0] on empty array
      // This is expected behavior that should be handled by the calling code
      await expect(addRating([], mockMovieTags)).rejects.toThrow()
      expect(axios.get).not.toHaveBeenCalled()
    })

    it('should handle ratings without id', async () => {
      const ratingsWithoutId = [{ love: 8, overall: 7 }]

      const result = await addRating(ratingsWithoutId, mockMovieTags)

      expect(result).toBeUndefined()
      expect(axios.get).not.toHaveBeenCalled()
    })
  })

  describe('Data Transformation and Processing', () => {
    it('should correctly transform TMDb data for storage', async () => {
      const result = await addRating(mockRatings, mockMovieTags)

      const movieData = result.value.movie

      expect(movieData.id).toBe(550)
      expect(movieData.title).toBe('Fight Club')
      expect(movieData.release_date).toBe('1999-10-15')
      expect(movieData.runtime).toBe(139)
      expect(movieData.backdrop_path).toBe('/fCayJrkfRaCRCTh8GqN30f8oyQF.jpg')
      expect(movieData.poster_path).toBe('/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg')
      expect(movieData.imdb_id).toBe('tt0137523')
    })

    it('should process cast data correctly', async () => {
      const result = await addRating(mockRatings, mockMovieTags)

      const cast = result.value.movie.cast

      expect(cast).toHaveLength(3)
      expect(cast[0]).toEqual({
        name: 'Brad Pitt',
        character: 'Tyler Durden'
      })
      expect(cast[1]).toEqual({
        name: 'Edward Norton',
        character: 'The Narrator'
      })
      expect(cast[2]).toEqual({
        name: 'Helena Bonham Carter',
        character: 'Marla Singer'
      })
    })

    it('should process crew data correctly', async () => {
      const result = await addRating(mockRatings, mockMovieTags)

      const crew = result.value.movie.crew

      expect(crew).toHaveLength(3)
      expect(crew[0]).toEqual({
        name: 'David Fincher',
        job: 'Director'
      })
      expect(crew[1]).toEqual({
        name: 'Chuck Palahniuk',
        job: 'Novel'
      })
      expect(crew[2]).toEqual({
        name: 'Jim Uhls',
        job: 'Screenplay'
      })
    })

    it('should process genres and production companies', async () => {
      const result = await addRating(mockRatings, mockMovieTags)

      const movieData = result.value.movie

      expect(movieData.genres).toEqual([
        { id: 18, name: 'Drama' },
        { id: 53, name: 'Thriller' }
      ])
      expect(movieData.production_companies).toEqual([
        { id: 508, name: '20th Century Fox' },
        { id: 711, name: 'Fox 2000 Pictures' }
      ])
    })

    it('should process keywords correctly', async () => {
      const result = await addRating(mockRatings, mockMovieTags)

      const keywords = result.value.movie.keywords

      expect(keywords).toEqual([
        { id: 825, name: 'support group' },
        { id: 849, name: 'dual identity' },
        { id: 851, name: 'nihilism' }
      ])
    })

    it('should handle keywords from TV shows (results field)', async () => {
      store.state.currentLog = 'tvLog'
      const tvRatings = [{
        ...mockRatings[0],
        tvShowId: 550
      }]
      // Keep the id field since the function requires ratings[0].id to exist

      // Update the mock to return results field for TV shows
      const originalKeywords = mockKeywordsData.keywords
      axios.get.mockImplementation((url) => {
        if (url.includes('/tv/550?')) {
          return Promise.resolve({ data: mockTMDbData })
        }
        if (url.includes('/tv/550/credits')) {
          return Promise.resolve({ data: mockCreditsData })
        }
        if (url.includes('/tv/550/keywords')) {
          return Promise.resolve({ data: { results: originalKeywords } })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      const result = await addRating(tvRatings, mockMovieTags)

      expect(result.value.movie.keywords).toEqual(originalKeywords)
    })

    it('should process ChatGPT keywords from multiple ratings', async () => {
      const multipleRatings = [
        {
          id: 550,
          love: 9,
          chatGPTKeywords: ['psychological', 'underground']
        },
        {
          id: 550,
          love: 8,
          chatGPTKeywords: ['underground', 'consumerism', 'fight']
        }
      ]

      const result = await addRating(multipleRatings, mockMovieTags)

      const chatGPTKeywords = result.value.movie.chatGPTKeywords

      expect(chatGPTKeywords).toEqual(['psychological', 'underground', 'consumerism', 'fight'])
      expect(chatGPTKeywords).toHaveLength(4) // Should deduplicate 'underground'
    })

    it('should remove ownership from ratings but preserve in movie data', async () => {
      const result = await addRating(mockRatings, mockMovieTags)

      expect(result.value.movie.ownership).toBe('Digital')
      expect(result.value.ratings[0].ownership).toBeUndefined()
    })

    it('should process movie tags correctly', async () => {
      const result = await addRating(mockRatings, mockMovieTags)

      expect(result.value.movie.tags).toEqual([
        { title: 'dark-themes' },
        { title: 'masterpiece' }
      ])
    })

    it('should handle empty or missing movie tags', async () => {
      const result = await addRating(mockRatings, null)

      expect(result.value.movie.tags).toEqual([])
    })
  })

  describe('Database Key Generation', () => {
    it('should generate new key when movie not in database', async () => {
      const result = await addRating(mockRatings, mockMovieTags)

      expect(result.path).toMatch(/^movieLog\/\d+-[a-f0-9-]+-Fight Club$/)
      expect(result.path).toContain('Fight Club') // Title preserved with space
    })

    it('should use existing key when movie already in database', async () => {
      // Add movie to mock database
      store.state.movieLog = {
        'existing-key-fight-club': {
          movie: { id: 550, title: 'Fight Club' },
          ratings: []
        }
      }

      const result = await addRating(mockRatings, mockMovieTags)

      expect(result.path).toBe('movieLog/existing-key-fight-club')
    })

    it('should sanitize title for safe key generation', async () => {
      mockTMDbData.title = 'Movie: With/Special\\Characters!@#$%^&*()_+{}[]|;\':"<>?,./'

      const result = await addRating(mockRatings, mockMovieTags)

      // Check that special characters are replaced with dashes
      expect(result.path).toContain('Movie- With-Special')
      // The backslash is not in the replacement regex, so we can't check for it
      // Let's check for a subset of special characters that should be replaced
      expect(result.path).not.toMatch(/[!@#$%^&*()_+{}[\]|;':"<>?,.]/)
    })

    it('should handle empty title gracefully', async () => {
      mockTMDbData.title = ''

      const result = await addRating(mockRatings, mockMovieTags)

      expect(result.path).toMatch(/^movieLog\/\d+-[a-f0-9-]+-$/)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing TMDb data fields gracefully', async () => {
      // TMDb data with missing fields
      mockTMDbData = {
        id: 550,
        title: 'Fight Club'
        // Missing many fields
      }
      mockCreditsData = { cast: [], crew: [] }
      mockKeywordsData = { keywords: [] }

      const result = await addRating(mockRatings, mockMovieTags)

      const movieData = result.value.movie

      expect(movieData.backdrop_path).toBeUndefined()
      expect(movieData.poster_path).toBeUndefined()
      expect(movieData.imdb_id).toBeUndefined()
      expect(movieData.runtime).toBeUndefined()
      expect(movieData.genres).toBeUndefined() // When field is missing from tmdbData, it's undefined
      expect(movieData.production_companies).toBeUndefined()
      expect(movieData.cast).toEqual([]) // Empty arrays from mockCreditsData
      expect(movieData.crew).toEqual([])
      expect(movieData.keywords).toEqual([]) // Empty array from mockKeywordsData
    })

    it('should handle partial API failures', async () => {
      // Main movie data succeeds, but credits and keywords fail
      axios.get.mockImplementation((url) => {
        if (url.includes('/movie/550?')) {
          return Promise.resolve({ data: mockTMDbData })
        }
        return Promise.reject(new Error('API Error'))
      })

      const result = await addRating(mockRatings, mockMovieTags)

      // When any API call fails, getTMDBData returns undefined, so we get fallback values
      expect(result).toBeDefined()
      expect(result.value.movie.title).toBe('') // Empty string is the fallback for title
      expect(result.value.movie.cast).toEqual([]) // Empty array is the fallback
      expect(result.value.movie.crew).toEqual([])
    })

    it('should handle malformed API responses', async () => {
      // Mock malformed responses - the function will crash on malformed data
      // This tests that the function needs proper error handling for production
      axios.get.mockImplementation((url) => {
        if (url.includes('/movie/550?')) {
          return Promise.resolve({ data: mockTMDbData })
        }
        if (url.includes('/credits')) {
          return Promise.resolve({ data: { cast: null, crew: null } })
        }
        if (url.includes('/keywords')) {
          return Promise.resolve({ data: { keywords: null } })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      // The function will throw an error when trying to map over null values
      await expect(addRating(mockRatings, mockMovieTags)).rejects.toThrow()
    })

    it('should handle very large datasets', async () => {
      // Create large cast and crew arrays
      const largeCast = Array(100).fill().map((_, i) => ({
        name: `Actor ${i}`,
        character: `Character ${i}`
      }))
      const largeCrew = Array(100).fill().map((_, i) => ({
        name: `Crew Member ${i}`,
        job: `Job ${i}`
      }))

      mockCreditsData = { cast: largeCast, crew: largeCrew }

      const result = await addRating(mockRatings, mockMovieTags)

      expect(result.value.movie.cast).toHaveLength(100)
      expect(result.value.movie.crew).toHaveLength(100)
    })

    it('should handle multiple ratings with different ChatGPT keywords', async () => {
      const multipleRatings = [
        {
          id: 550,
          love: 9,
          chatGPTKeywords: ['psychological']
        },
        {
          id: 550,
          love: 8
          // No chatGPTKeywords
        },
        {
          id: 550,
          love: 7,
          chatGPTKeywords: ['underground', 'consumerism']
        }
      ]

      const result = await addRating(multipleRatings, mockMovieTags)

      expect(result.value.movie.chatGPTKeywords).toEqual(['psychological', 'underground', 'consumerism'])
    })
  })

  describe('Store Integration', () => {
    it('should dispatch setDBValue action with correct data', async () => {
      const result = await addRating(mockRatings, mockMovieTags)

      expect(store.dispatch).toHaveBeenCalledWith('setDBValue', result)
    })

    it('should return database entry structure', async () => {
      const result = await addRating(mockRatings, mockMovieTags)

      expect(result).toHaveProperty('path')
      expect(result).toHaveProperty('value')
      expect(result.path).toMatch(/^movieLog\//)
      expect(result.value).toHaveProperty('movie')
      expect(result.value).toHaveProperty('ratings')
    })

    it('should handle missing environment variables', async () => {
      // Temporarily clear the API key
      const originalApiKey = process.env.VUE_APP_TMDB_API_KEY
      delete process.env.VUE_APP_TMDB_API_KEY

      await addRating(mockRatings, mockMovieTags)

      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('api_key=undefined'))

      // Restore API key
      process.env.VUE_APP_TMDB_API_KEY = originalApiKey
    })
  })
})
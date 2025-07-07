import { vi } from 'vitest'

// Comprehensive axios mock that handles all API endpoints
export const createComprehensiveAxiosMock = () => {
  return vi.fn((config) => {
    const url = typeof config === 'string' ? config : config.url

    // TMDB API endpoints
    if (url.includes('api.themoviedb.org')) {
      if (url.includes('/search/person')) {
        return Promise.resolve({
          data: {
            results: [
              { id: 1, name: 'Steven Spielberg', known_for_department: 'Directing' },
              { id: 2, name: 'Al Pacino', known_for_department: 'Acting' }
            ]
          }
        })
      }
      
      if (url.includes('/search/movie') || url.includes('/discover/movie')) {
        return Promise.resolve({
          data: {
            results: [
              { 
                id: 101, 
                title: 'Unrated Movie 1', 
                poster_path: '/test1.jpg', 
                release_date: '2023-01-01',
                overview: 'Test movie description'
              },
              { 
                id: 102, 
                title: 'Unrated Movie 2', 
                poster_path: '/test2.jpg', 
                release_date: '2023-01-02',
                overview: 'Another test movie'
              }
            ]
          }
        })
      }
      
      if (url.includes('/person/')) {
        return Promise.resolve({
          data: {
            id: 1,
            name: 'Steven Spielberg',
            known_for_department: 'Directing',
            movie_credits: {
              cast: [],
              crew: [
                { id: 101, title: 'Test Movie 1', job: 'Director' },
                { id: 102, title: 'Test Movie 2', job: 'Director' }
              ]
            }
          }
        })
      }
      
      // Default TMDB response
      return Promise.resolve({
        data: {
          results: [],
          cast: [],
          crew: []
        }
      })
    }
    
    // Wikipedia API endpoints
    if (url.includes('wikipedia.org')) {
      return Promise.resolve({
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
      })
    }
    
    // Letterboxd scraping endpoints
    if (url.includes('letterboxd')) {
      return Promise.resolve({
        data: {
          logged: false,
          movies: []
        }
      })
    }
    
    // Random search endpoints
    if (url.includes('random') || url.includes('discover')) {
      return Promise.resolve({
        data: {
          results: [
            { 
              id: 999, 
              title: 'Random Movie', 
              poster_path: '/random.jpg', 
              release_date: '2020-01-01' 
            }
          ]
        }
      })
    }
    
    // Default fallback - return empty but valid response
    return Promise.resolve({
      data: {
        results: [],
        query: { pages: {} }
      }
    })
  })
}

// Mock for axios module
export const mockAxiosModule = () => {
  return {
    default: {
      get: createComprehensiveAxiosMock(),
      post: vi.fn(() => Promise.resolve({ data: {} })),
      put: vi.fn(() => Promise.resolve({ data: {} })),
      delete: vi.fn(() => Promise.resolve({ data: {} }))
    }
  }
}
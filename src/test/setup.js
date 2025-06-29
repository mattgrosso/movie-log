// Global test setup
import { vi } from 'vitest'

// Mock environment variables
vi.mock('@/assets/javascript/version.js', () => ({
  version: '1.0.0-test'
}))

// Global mocks for browser APIs
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid'
  }
})

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn()
}))

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(),
  ref: vi.fn(),
  push: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  onValue: vi.fn(),
  off: vi.fn()
}))

// Mock window.scroll
Object.defineProperty(window, 'scroll', {
  value: vi.fn(),
  writable: true
})

// Mock window.scrollBy  
Object.defineProperty(window, 'scrollBy', {
  value: vi.fn(),
  writable: true
})

// Global test helpers
global.createMockMovie = () => ({
  movie: {
    id: 123,
    title: 'Test Movie',
    release_date: '2023-01-01',
    runtime: 120,
    poster_path: '/test-poster.jpg',
    backdrop_path: '/test-backdrop.jpg',
    genres: [{ id: 1, name: 'Action' }],
    cast: [{ id: 1, name: 'Test Actor' }],
    crew: [{ id: 1, name: 'Test Director', job: 'Director' }],
    keywords: [{ id: 1, name: 'test keyword' }],
    flatKeywords: ['test keyword'],
    production_companies: [{ id: 1, name: 'Test Studio' }]
  },
  ratings: [{
    id: 'test-rating-id',
    date: Date.now(),
    direction: 8,
    imagery: 7,
    story: 9,
    performance: 8,
    soundtrack: 7,
    stickiness: 8,
    love: 9,
    overall: 8,
    calculatedTotal: 8.25
  }],
  dbKey: 'test-movie-key'
})

global.createMockStore = () => ({
  state: {
    dbLoaded: true,
    databaseTopKey: 'test-user',
    currentLog: 'movieLog',
    academyAwardWinners: { bestPicture: [] },
    settings: {
      normalizationTweak: 0.25,
      tieBreakTweak: 1,
      includeShorts: false
    }
  },
  getters: {
    allMediaAsArray: [],
    allMediaSortedByRating: []
  },
  commit: vi.fn(),
  dispatch: vi.fn()
})
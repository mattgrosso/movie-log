// Global test setup
import { vi } from 'vitest'

// Suppress unhandled promise rejection warnings in tests
const originalConsoleError = console.error
console.error = (...args) => {
  // Suppress specific unhandled promise rejection errors that are expected in tests
  if (
    args[0]?.includes?.('Cannot read properties of undefined') ||
    args[0]?.includes?.('Unexpected API call') ||
    args[0]?.toString?.().includes?.('TypeError')
  ) {
    return
  }
  originalConsoleError.apply(console, args)
}

// Global unhandled rejection handler for tests
process.on('unhandledRejection', (reason, promise) => {
  // Suppress expected API-related rejections in test environment
  if (
    reason?.message?.includes?.('Cannot read properties of undefined') ||
    reason?.message?.includes?.('Unexpected API call') ||
    reason?.toString?.().includes?.('TypeError')
  ) {
    return
  }
  
  // Log unexpected rejections for debugging
  console.warn('Unhandled Promise Rejection:', reason)
})

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
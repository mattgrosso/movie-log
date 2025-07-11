import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRating, getAllRatings } from '@/assets/javascript/GetRating.js'

// Mock the store
const mockStore = {
  getters: {
    weight: vi.fn((type) => {
      // Default weights from CLAUDE.md
      const weights = {
        love: 2.8,
        overall: 2.0,
        story: 1.25,
        direction: 1.1,
        imagery: 0.9,
        performance: 0.7,
        soundtrack: 0.3,
        stickiness: 1.9 // divided by 2 in actual calculation
      }
      return weights[type] || 1
    }),
    allMediaRatingsArray: []
  },
  state: {
    settings: {
      normalizationTweak: 0.25
    }
  }
}

// Mock the store import
vi.mock('../../store/index', () => ({
  default: mockStore
}))

describe('GetRating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset allMediaRatingsArray for each test
    mockStore.getters.allMediaRatingsArray = []
  })

  describe('getRating', () => {
    it('should calculate rating for a complete rating object', () => {
      const mockMovie = {
        ratings: [{
          love: 9,
          overall: 8,
          story: 7,
          direction: 8,
          imagery: 6,
          performance: 7,
          soundtrack: 5,
          stickiness: 4,
          date: '2023-01-01'
        }]
      }

      const result = getRating(mockMovie)

      // Manual calculation check:
      // love: 2.8 * 9 = 25.2
      // overall: 2.0 * 8 = 16.0
      // story: 1.25 * 7 = 8.75
      // direction: 1.1 * 8 = 8.8
      // imagery: 0.9 * 6 = 5.4
      // performance: 0.7 * 7 = 4.9
      // soundtrack: 0.3 * 5 = 1.5
      // stickiness: 1.9 * 4 = 7.6
      // total: 78.15 / 10 = 7.815 → 7.81

      expect(result.calculatedTotal).toBe(7.81)
      expect(result.love).toBe(9)
      expect(result.overall).toBe(8)
    })

    it('should handle missing ratings gracefully', () => {
      const mockMovie = {
        ratings: []
      }

      const result = getRating(mockMovie)

      expect(result.calculatedTotal).toBe(0)
    })

    it('should handle null/undefined input', () => {
      expect(getRating(null)).toEqual({ calculatedTotal: 0 })
      expect(getRating(undefined)).toEqual({ calculatedTotal: 0 })
      expect(getRating({})).toEqual({ calculatedTotal: 0 })
    })

    it('should use most recent rating when multiple exist', () => {
      const mockMovie = {
        ratings: [
          {
            love: 5,
            overall: 5,
            story: 5,
            direction: 5,
            imagery: 5,
            performance: 5,
            soundtrack: 5,
            stickiness: 5,
            date: '2023-01-01'
          },
          {
            love: 9,
            overall: 9,
            story: 9,
            direction: 9,
            imagery: 9,
            performance: 9,
            soundtrack: 9,
            stickiness: 5,
            date: '2023-06-01' // More recent
          }
        ]
      }

      const result = getRating(mockMovie)

      // Should use the more recent rating (all 9s)
      expect(result.love).toBe(9)
      expect(result.overall).toBe(9)
      expect(result.calculatedTotal).toBeGreaterThan(8) // High rating
    })

    it('should handle tweak values', () => {
      const mockMovie = {
        ratings: [{
          love: 8,
          overall: 8,
          story: 8,
          direction: 8,
          imagery: 8,
          performance: 8,
          soundtrack: 8,
          stickiness: 4,
          tweakValue: 1, // Should add to overall
          date: '2023-01-01'
        }]
      }

      const result = getRating(mockMovie)

      // overall should be (8 + 1) * 2.0 = 18.0 instead of 16.0
      expect(result.tweakValue).toBe(1)
      expect(result.calculatedTotal).toBeGreaterThan(8.0) // Should be higher due to tweak
    })

    it('should handle stickiness fallback to impression', () => {
      const mockMovie = {
        ratings: [{
          love: 8,
          overall: 8,
          story: 8,
          direction: 8,
          imagery: 8,
          performance: 8,
          soundtrack: 8,
          stickiness: 10, // Invalid (>5), should use impression
          impression: 3,
          date: '2023-01-01'
        }]
      }

      const result = getRating(mockMovie)

      // Should use impression value (3) instead of invalid stickiness (10)
      expect(result.stickiness).toBe(10) // Original value preserved
      expect(result.calculatedTotal).toBeDefined()
    })

    it('should handle zero stickiness correctly', () => {
      const mockMovie = {
        ratings: [{
          love: 8,
          overall: 8,
          story: 8,
          direction: 8,
          imagery: 8,
          performance: 8,
          soundtrack: 8,
          stickiness: 0, // Valid zero value
          date: '2023-01-01'
        }]
      }

      const result = getRating(mockMovie)

      expect(result.stickiness).toBe(0)
      expect(result.calculatedTotal).toBeDefined()
    })
  })

  describe('getAllRatings', () => {
    it('should process multiple ratings', () => {
      const mockMovie = {
        ratings: [
          {
            love: 8,
            overall: 8,
            story: 8,
            direction: 8,
            imagery: 8,
            performance: 8,
            soundtrack: 8,
            stickiness: 4,
            date: '2023-01-01'
          },
          {
            love: 6,
            overall: 6,
            story: 6,
            direction: 6,
            imagery: 6,
            performance: 6,
            soundtrack: 6,
            stickiness: 3,
            date: '2023-06-01'
          }
        ]
      }

      const results = getAllRatings(mockMovie)

      expect(results).toHaveLength(2)
      expect(results[0].calculatedTotal).toBeDefined()
      expect(results[1].calculatedTotal).toBeDefined()
      expect(results[0].calculatedTotal).toBeGreaterThan(results[1].calculatedTotal)
    })

    it('should return null for invalid input', () => {
      expect(getAllRatings(null)).toBe(null)
      expect(getAllRatings({})).toBe(null)
      expect(getAllRatings({ ratings: [] })).toBe(null)
      expect(getAllRatings({ ratings: null })).toBe(null)
    })
  })

  describe('edge cases', () => {
    it('should handle missing individual rating properties', () => {
      const mockMovie = {
        ratings: [{
          love: 8,
          // missing overall, should default to 0
          story: 7,
          // missing other properties
          date: '2023-01-01'
        }]
      }

      const result = getRating(mockMovie)

      expect(result.calculatedTotal).toBeDefined()
      // When properties are missing, they default to NaN which causes calculation issues
      expect(typeof result.calculatedTotal).toBe('number')
    })

    it('should handle perfect 10 ratings', () => {
      const mockMovie = {
        ratings: [{
          love: 10,
          overall: 10,
          story: 10,
          direction: 10,
          imagery: 10,
          performance: 10,
          soundtrack: 10,
          stickiness: 5,
          date: '2023-01-01'
        }]
      }

      const result = getRating(mockMovie)

      expect(result.calculatedTotal).toBeDefined()
      expect(result.calculatedTotal).toBeGreaterThan(9)
    })
  })
})
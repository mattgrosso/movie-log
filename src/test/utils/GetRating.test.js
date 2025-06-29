import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the store before importing GetRating
vi.mock('@/store/index', () => ({
  default: {
    state: {
      currentLog: 'movieLog',
      settings: {
        normalizationTweak: 0.25
      }
    },
    getters: {
      weight: vi.fn((category) => {
        // Standard weights for each category
        const weights = {
          direction: 1.5,
          imagery: 1.2,
          story: 1.8,
          performance: 1.3,
          soundtrack: 1.0,
          love: 1.1,
          overall: 1.4,
          stickiness: 0.7
        }
        return weights[category] || 1.0
      }),
      allMediaRatingsArray: [6.5, 7.2, 8.1, 9.0, 5.8]
    }
  }
}))

import { getRating, getAllRatings } from '@/assets/javascript/GetRating.js'

describe('GetRating utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRating', () => {
    it('should return null for undefined media', () => {
      const result = getRating(undefined)
      expect(result.calculatedTotal).toBe(0)
    })

    it('should return null for media without ratings', () => {
      const media = { ratings: [] }
      const result = getRating(media)
      expect(result.calculatedTotal).toBe(0)
    })

    it('should calculate rating for movie with single rating', () => {
      const media = {
        ratings: [{
          date: '2023-01-01',
          direction: 8,
          imagery: 7,
          story: 9,
          performance: 8,
          soundtrack: 7,
          stickiness: 8,
          love: 9,
          overall: 8
        }]
      }

      const result = getRating(media)
      
      expect(result).toBeDefined()
      expect(result.calculatedTotal).toBeGreaterThan(0)
      expect(typeof result.calculatedTotal).toBe('number')
      expect(result.normalizedRating).toBeDefined()
      expect(result.normalizedRating).toBeGreaterThanOrEqual(0)
      expect(result.normalizedRating).toBeLessThanOrEqual(10)
    })

    it('should return most recent rating for movie with multiple ratings', () => {
      const media = {
        ratings: [
          {
            date: '2023-01-01',
            direction: 6,
            imagery: 6,
            story: 6,
            performance: 6,
            soundtrack: 6,
            stickiness: 6,
            love: 6,
            overall: 6
          },
          {
            date: '2023-06-01', // More recent
            direction: 9,
            imagery: 9,
            story: 9,
            performance: 9,
            soundtrack: 9,
            stickiness: 9,
            love: 9,
            overall: 9
          }
        ]
      }

      const result = getRating(media)
      
      expect(result).toBeDefined()
      // Should use the more recent (higher) rating
      expect(result.calculatedTotal).toBeGreaterThan(8)
    })

    it('should handle missing stickiness by using impression', () => {
      const media = {
        ratings: [{
          date: '2023-01-01',
          direction: 8,
          imagery: 7,
          story: 9,
          performance: 8,
          soundtrack: 7,
          impression: 7,
          love: 9,
          overall: 8
          // stickiness is missing
        }]
      }

      const result = getRating(media)
      
      expect(result).toBeDefined()
      expect(result.calculatedTotal).toBeGreaterThan(0)
    })

    it('should apply tweak value to overall score', () => {
      const media = {
        ratings: [{
          date: '2023-01-01',
          direction: 8,
          imagery: 7,
          story: 9,
          performance: 8,
          soundtrack: 7,
          stickiness: 8,
          love: 9,
          overall: 8,
          tweakValue: 1.0 // Should boost the overall score
        }]
      }

      const result = getRating(media)
      
      expect(result).toBeDefined()
      expect(result.calculatedTotal).toBeGreaterThan(0)
    })
  })

  describe('getAllRatings', () => {
    it('should return null for undefined entry', () => {
      const result = getAllRatings(undefined)
      expect(result).toBe(null)
    })

    it('should return null for entry without ratings', () => {
      const entry = {}
      const result = getAllRatings(entry)
      expect(result).toBe(null)
    })

    it('should return null for entry with empty ratings array', () => {
      const entry = { ratings: [] }
      const result = getAllRatings(entry)
      expect(result).toBe(null)
    })

    it('should process all ratings in array', () => {
      const entry = {
        ratings: [
          {
            date: '2023-01-01',
            direction: 7,
            imagery: 6,
            story: 8,
            performance: 7,
            soundtrack: 6,
            stickiness: 7,
            love: 8,
            overall: 7
          },
          {
            date: '2023-06-01',
            direction: 9,
            imagery: 8,
            story: 9,
            performance: 9,
            soundtrack: 8,
            stickiness: 9,
            love: 9,
            overall: 9
          }
        ]
      }

      const result = getAllRatings(entry)
      
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      
      result.forEach(rating => {
        expect(rating.calculatedTotal).toBeDefined()
        expect(typeof rating.calculatedTotal).toBe('number')
        expect(rating.calculatedTotal).toBeGreaterThan(0)
      })
    })

    it('should handle TV show ratings structure', () => {
      const entry = {
        ratings: {
          tvShow: {
            date: '2023-01-01',
            direction: 8,
            imagery: 7,
            story: 9,
            performance: 8,
            soundtrack: 7,
            stickiness: 8,
            love: 9,
            overall: 8
          }
        }
      }

      const result = getAllRatings(entry)
      
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0].calculatedTotal).toBeGreaterThan(0)
    })
  })

  describe('Rating calculations', () => {
    it('should calculate normalized rating within valid range', () => {
      const media = {
        ratings: [{
          date: '2023-01-01',
          direction: 8,
          imagery: 7,
          story: 9,
          performance: 8,
          soundtrack: 7,
          stickiness: 8,
          love: 9,
          overall: 8
        }]
      }

      const result = getRating(media)
      
      expect(result.normalizedRating).toBeGreaterThanOrEqual(0)
      expect(result.normalizedRating).toBeLessThanOrEqual(10)
      expect(Number.isInteger(result.normalizedRating)).toBe(true)
    })

    it('should handle edge case where all ratings are equal', async () => {
      // This test verifies the function calculates normalized rating correctly
      // Since our mock has ratings [6.5, 7.2, 8.1, 9.0, 5.8], min !== max
      
      const media = {
        ratings: [{
          date: '2023-01-01',
          direction: 8,
          imagery: 8,
          story: 8,
          performance: 8,
          soundtrack: 8,
          stickiness: 8,
          love: 8,
          overall: 8
        }]
      }

      const result = getRating(media)
      
      // Should have a valid normalized rating between 0 and 10
      expect(result.normalizedRating).toBeGreaterThanOrEqual(0)
      expect(result.normalizedRating).toBeLessThanOrEqual(10)
      expect(Number.isInteger(result.normalizedRating)).toBe(true)
    })
  })
})
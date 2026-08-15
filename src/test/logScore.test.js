import { describe, it, expect } from 'vitest'
import { logScore, actorLogScore, globalAverage, logScoreSettings, LOG_SCORE_DEFAULTS } from '@/assets/javascript/logScore.js'

// The Log Score, adopted from Brian's Movie Log: rank-weighted average
// Bayesian-blended with the user's whole-library average. Known-value
// tests lock the math to his spec (defaults 7/7/7).

describe('logScore', () => {
  it('single movie with default B=7: n=1 blends 7/8 global + 1/8 movie', () => {
    // global 6, movie 10: 6 * 7/8 + 10 * 1/8 = 5.25 + 1.25 = 6.5
    expect(logScore([10], 6)).toBe(6.5)
  })

  it('a seven-movie list of identical scores is a 50/50 blend (the documented anchor case)', () => {
    // All 10s, global 6: weighted avg 10; n=7,B=7 -> (6+10)/2 = 8
    expect(logScore([10, 10, 10, 10, 10, 10, 10], 6)).toBe(8)
  })

  it('rank weights decline as R/(R+i): the best movie counts most', () => {
    // scores [10, 8], R=7: weights [1, 0.875]
    // weighted avg = (10*1 + 8*0.875) / 1.875 = 17/1.875 = 9.0667
    // n=2, B=7: 6*(7/9) + 9.0667*(2/9) = 4.6667 + 2.0148 = 6.6815 -> 6.68
    expect(logScore([10, 8], 6)).toBe(6.68)
    // order in must not matter — sorting is internal
    expect(logScore([8, 10], 6)).toBe(6.68)
  })

  it('a big list stands on its own; a tiny one hugs the baseline', () => {
    const fifty = Array.from({ length: 50 }, () => 9)
    expect(logScore(fifty, 6)).toBeGreaterThan(8.5)
    expect(logScore([9], 6)).toBeLessThan(6.5)
  })

  it('handles junk and empties', () => {
    expect(logScore([], 6)).toBeNull()
    expect(logScore([NaN], 6)).toBeNull()
    expect(logScore([8], null)).toBeNull()
  })
})

describe('actorLogScore', () => {
  it('billing reduces confidence (n), never the rating: lead=1.0, second-billed=0.875', () => {
    const credits = [
      { score: 9, castPosition: 0 },
      { score: 9, castPosition: 1 }
    ]
    const result = actorLogScore(credits, 6)
    expect(result.effectiveN).toBe(1.88) // 1.0 + 7/8
    // weighted avg of [9,9] = 9; blend with n=1.875:
    // 6 * (7/8.875) + 9 * (1.875/8.875) = 4.7324 + 1.9014 = 6.63
    expect(result.score).toBe(6.63)
  })

  it('a deep-cast cameo adds little confidence', () => {
    const lead = actorLogScore([{ score: 9, castPosition: 0 }], 6)
    const cameo = actorLogScore([{ score: 9, castPosition: 30 }], 6)
    expect(cameo.effectiveN).toBeLessThan(0.2)
    expect(cameo.score).toBeLessThan(lead.score)
  })

  it('missing castPosition is treated as lead', () => {
    expect(actorLogScore([{ score: 9 }], 6).effectiveN).toBe(1)
  })
})

describe('globalAverage / settings', () => {
  it('averages calculatedTotals, skipping unrated entries', () => {
    const entries = [
      { ratings: [{}] }, // unreadable
      { r: 8 }, { r: 6 }
    ]
    const getRating = (e) => (e.r ? { calculatedTotal: e.r } : null)
    expect(globalAverage(entries, getRating)).toBe(7)
  })

  it('settings override the 7/7/7 defaults, junk falls back', () => {
    expect(logScoreSettings(undefined)).toEqual(LOG_SCORE_DEFAULTS)
    expect(logScoreSettings({ logScoreWeights: { rankWeight: 3, bayesianWeight: 'x', billingWeight: -2 } }))
      .toEqual({ rankWeight: 3, bayesianWeight: 7, billingWeight: 7 })
  })
})

import { describe, it, expect } from 'vitest'
import { personLogScore } from '@/assets/javascript/logScoreRankings.js'

// The shared Brian's-method scorer behind every Favorite* section.

function entry (id, rating) {
  return { dbKey: `k${id}`, movie: { id }, ratings: [{ calculatedTotal: rating }] }
}
const ratingOf = (e) => ({ calculatedTotal: e.ratings[0].calculatedTotal })

describe('personLogScore', () => {
  it('crew: deep strong filmography beats a lone masterpiece under the Bayesian pull', () => {
    const globalAvg = 5.5
    const deep = personLogScore({ entries: [entry(1, 9), entry(2, 9), entry(3, 9), entry(4, 9)] }, ratingOf, globalAvg)
    const oneHit = personLogScore({ entries: [entry(5, 10)] }, ratingOf, globalAvg)
    expect(deep).toBeGreaterThan(oneHit)
  })

  it('crew: rankWeight low lets the best work dominate a spotty record', () => {
    const globalAvg = 5.5
    const spotty = { entries: [entry(1, 10), entry(2, 4), entry(3, 4), entry(4, 4)] }
    const steep = personLogScore(spotty, ratingOf, globalAvg, { rankWeight: 1, bayesianWeight: 0 })
    const flat = personLogScore(spotty, ratingOf, globalAvg, { rankWeight: 15, bayesianWeight: 0 })
    expect(steep).toBeGreaterThan(flat)
  })

  it('cast: deep billing reduces CONFIDENCE, not the rating — more pull toward the average', () => {
    const globalAvg = 5.5
    const films = [entry(1, 9), entry(2, 9), entry(3, 9)]
    const lead = personLogScore({ entries: films, billings: [0, 0, 0] }, ratingOf, globalAvg, { billingWeight: 7 })
    const support = personLogScore({ entries: films, billings: [12, 12, 12] }, ratingOf, globalAvg, { billingWeight: 7 })
    // Same films, same ratings — the supporting player just has less proof.
    expect(lead).toBeGreaterThan(support)
    expect(support).toBeGreaterThan(globalAvg) // still above average, just less so
  })

  it('cast: billingWeight high makes supporting parts count almost like leads', () => {
    const globalAvg = 5.5
    const person = { entries: [entry(1, 9), entry(2, 9)], billings: [10, 10] }
    const strict = personLogScore(person, ratingOf, globalAvg, { billingWeight: 1 })
    const generous = personLogScore(person, ratingOf, globalAvg, { billingWeight: 15 })
    expect(generous).toBeGreaterThan(strict)
  })

  it('returns null when nothing is rated', () => {
    expect(personLogScore({ entries: [] }, ratingOf, 5.5)).toBeNull()
    expect(personLogScore({ entries: [{ movie: {}, ratings: [] }] }, () => null, 5.5)).toBeNull()
  })
})

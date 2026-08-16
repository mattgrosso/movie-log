import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Outliers from '@/components/Outliers.vue'

// The 2026-08-15 rework: two fixed cards (loved / hardest-on) over
// tasteOutliers — the SD-threshold slider is gone. The math itself is
// covered in ratingOutliers.test.js; this covers the component contract.

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((result) => ({ calculatedTotal: result.ratings[0].calculatedTotal }))
}))

function movie (overrides = {}) {
  return {
    release_date: '2015-06-01',
    crew: [],
    genres: [],
    cast: [],
    flatKeywords: [],
    production_companies: [],
    ...overrides
  }
}

function result (rating, movieOverrides = {}) {
  return { movie: movie(movieOverrides), ratings: [{ calculatedTotal: rating }] }
}

function library () {
  return [
    ...Array.from({ length: 5 }, () => result(9, { genres: [{ name: 'Horror' }] })),
    ...Array.from({ length: 5 }, () => result(3, { genres: [{ name: 'War' }] })),
    ...Array.from({ length: 8 }, () => result(6, { genres: [{ name: 'Drama' }] }))
  ]
}

describe('Outliers (reworked)', () => {
  it('renders loved and hardest cards with counts, no threshold slider', () => {
    const wrapper = mount(Outliers, { props: { resultsWithRatings: library() } })
    const text = wrapper.text()
    expect(text).toContain('You love these more than most things')
    expect(text).toContain("You're hardest on these")
    expect(text).toContain('Horror')
    expect(text).toContain('War')
    expect(text).toContain('5 films')
    expect(wrapper.find('input[type="range"]').exists()).toBe(false)
  })

  it('tapping a row emits updateSearchValue with the entity name', async () => {
    const wrapper = mount(Outliers, { props: { resultsWithRatings: library() } })
    await wrapper.findAll('.outlier-row')[0].trigger('click')
    expect(wrapper.emitted('updateSearchValue')[0]).toEqual(['Horror'])
  })

  it('a sub-minimum sample never appears no matter how extreme', () => {
    const wrapper = mount(Outliers, {
      props: { resultsWithRatings: [...library(), result(10, { genres: [{ name: 'Tiny' }] })] }
    })
    expect(wrapper.text()).not.toContain('Tiny')
  })
})

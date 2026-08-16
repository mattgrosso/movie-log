import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import YearlyAverage from '@/components/YearlyAverage.vue'

// The 2026-08-15 rework: the bar chart became a "Best years of movies"
// ranked list (RELEASE years by log score — watch years live in Deep
// Stats). Ranking math is covered in ratingOutliers.test.js.

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((result) => ({ calculatedTotal: result.ratings[0].calculatedTotal }))
}))

function movieResult (rating, releaseDate, title = 'Film') {
  return { movie: { title, release_date: releaseDate }, ratings: [{ calculatedTotal: rating }] }
}

function library () {
  return [
    ...Array.from({ length: 6 }, (_, i) => movieResult(9, '1994-06-15', `Great ${i}`)),
    ...Array.from({ length: 6 }, (_, i) => movieResult(5, '2010-06-15', `Meh ${i}`)),
    // Too thin to qualify (minCount 4)
    movieResult(10, '2005-06-15', 'Lone Gem')
  ]
}

function factory (resultsWithRatings = library()) {
  return mount(YearlyAverage, {
    props: { resultsWithRatings },
    global: { mocks: { $store: { state: { settings: {} } } } }
  })
}

describe('YearlyAverage (Best Years rework)', () => {
  it('ranks release years best-first with score, count, and top film', () => {
    const wrapper = factory()
    const rows = wrapper.findAll('.year-row')
    expect(rows[0].text()).toContain('1994')
    expect(rows[0].text()).toContain('6 films')
    expect(rows[0].text()).toContain('Great')
    // 2005 has only 1 film — below the floor.
    expect(wrapper.text()).not.toContain('2005')
  })

  it('tapping a year emits updateSearchValue with the year string', async () => {
    const wrapper = factory()
    await wrapper.findAll('.year-row')[0].trigger('click')
    expect(wrapper.emitted('updateSearchValue')[0]).toEqual(['1994'])
  })

  // Was capped at ten behind a "show all" button. The card scrolls internally
  // now, so every year is present and one flick away (Matt, 2026-08-16:
  // "shorter and had internal scrolling so I could flip through them").
  it('lists every year, with no expander to press', () => {
    const many = []
    for (let y = 1990; y < 2005; y++) {
      for (let i = 0; i < 4; i++) many.push(movieResult(5 + (y % 5), `${y}-06-15`))
    }
    const wrapper = factory(many)

    expect(wrapper.findAll('.year-row').length).toBe(15)
    expect(wrapper.find('.year-more').exists()).toBe(false)
  })
})

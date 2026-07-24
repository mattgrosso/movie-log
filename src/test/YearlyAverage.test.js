import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import YearlyAverage from '@/components/YearlyAverage.vue'

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((result) => ({ calculatedTotal: result.ratings[0].calculatedTotal }))
}))

function movieResult (rating, releaseDate) {
  return { movie: { release_date: releaseDate }, ratings: [{ calculatedTotal: rating }] }
}

function tvResult (rating, firstAirDate) {
  return { tvShow: { first_air_date: firstAirDate }, ratings: [{ calculatedTotal: rating }] }
}

function factory (resultsWithRatings, { currentLog = 'movieLog' } = {}) {
  return mount(YearlyAverage, {
    props: { resultsWithRatings },
    global: {
      stubs: { BarChart: true },
      mocks: { $store: { state: { currentLog } } }
    }
  })
}

describe('YearlyAverage', () => {
  it('uniqueYears derives distinct, ascending years from movie release dates', () => {
    const results = [movieResult(5, '2020-06-10'), movieResult(7, '2018-06-01'), movieResult(6, '2020-09-01')]
    const wrapper = factory(results)
    expect(wrapper.vm.uniqueYears).toEqual([2018, 2020])
  })

  it('getYear reads tvShow.first_air_date when the current log is the TV log', () => {
    const results = [tvResult(8, '2015-03-01')]
    const wrapper = factory(results, { currentLog: 'tvLog' })
    expect(wrapper.vm.uniqueYears).toEqual([2015])
  })

  it('yearlyAverageData averages ratings per year and skips non-numeric ratings', () => {
    const results = [
      movieResult(8, '2020-06-10'),
      movieResult(4, '2020-06-01'),
      movieResult(NaN, '2020-09-01'),
      movieResult(6, '2021-06-10'),
    ]
    const wrapper = factory(results)
    expect(wrapper.vm.yearlyAverageData.labels).toEqual([2020, 2021])
    expect(wrapper.vm.yearlyAverageData.datasets[0].data).toEqual(['6.00', '6.00'])
  })

  it('yearlyAverageData only includes the most recent numberOfYears', () => {
    const results = [
      movieResult(1, '2015-06-10'),
      movieResult(2, '2016-06-10'),
      movieResult(3, '2017-06-10'),
    ]
    const wrapper = factory(results)
    wrapper.vm.numberOfYears = 2
    expect(wrapper.vm.yearlyAverageData.labels).toEqual([2016, 2017])
  })

  describe('decreaseYears / increaseYears', () => {
    it('decreaseYears halves numberOfYears while it can, then floors at 1', () => {
      const wrapper = factory([])
      wrapper.vm.numberOfYears = 4
      wrapper.vm.decreaseYears()
      expect(wrapper.vm.numberOfYears).toBe(2)
      wrapper.vm.decreaseYears()
      expect(wrapper.vm.numberOfYears).toBe(1)
      // canDecreaseYears is false at 1 (1/2 = 0.5 < 1) -> floors, doesn't go below 1.
      wrapper.vm.decreaseYears()
      expect(wrapper.vm.numberOfYears).toBe(1)
    })

    it('increaseYears doubles numberOfYears while doubling still fits the data, then snaps to the full range', () => {
      const results = Array.from({ length: 5 }, (_, i) => movieResult(5, `${2010 + i}-06-10`))
      const wrapper = factory(results)
      wrapper.vm.numberOfYears = 2
      wrapper.vm.increaseYears()
      // 2*2=4 <= 5 unique years -> doubles.
      expect(wrapper.vm.numberOfYears).toBe(4)
      wrapper.vm.increaseYears()
      // 4*2=8 > 5, but 4 < 5 -> snaps to the full unique-years count.
      expect(wrapper.vm.numberOfYears).toBe(5)
      wrapper.vm.increaseYears()
      // Already at the full range -> no-op (neither branch's condition holds).
      expect(wrapper.vm.numberOfYears).toBe(5)
    })
  })

  it('renders the current year count and wires the Fewer/More buttons', async () => {
    const results = Array.from({ length: 5 }, (_, i) => movieResult(5, `${2010 + i}-06-10`))
    const wrapper = factory(results)
    expect(wrapper.text()).toContain('Average ratings for last 10 years.')

    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.vm.numberOfYears).toBe(5)
  })
})

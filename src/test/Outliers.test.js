import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Outliers from '@/components/Outliers.vue'

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((result) => ({ calculatedTotal: result.ratings[0].calculatedTotal }))
}))

function movie (overrides = {}) {
  return {
    release_date: '2015-06-01',
    crew: [],
    genres: [],
    flatKeywords: [],
    production_companies: [],
    ...overrides
  }
}

function result (rating, movieOverrides = {}) {
  return { movie: movie(movieOverrides), ratings: [{ calculatedTotal: rating }] }
}

function factory (props) {
  return mount(Outliers, { props })
}

describe('Outliers', () => {
  describe('directorsAverages / outlierDirectors', () => {
    it('only considers directors meeting the minimum film count (3), and averages their ratings', () => {
      const results = [
        result(9, { crew: [{ job: 'Director', name: 'A' }] }),
        result(9, { crew: [{ job: 'Director', name: 'A' }] }),
        result(9, { crew: [{ job: 'Director', name: 'A' }] }),
        result(2, { crew: [{ job: 'Director', name: 'B' }] }),
        result(2, { crew: [{ job: 'Director', name: 'B' }] }),
        // B only directed 2 -- below the minimum, so B never shows up as a
        // director outlier even though it's a rating extreme.
      ]
      const wrapper = factory({
        resultsWithRatings: results,
        allCounts: { directors: { A: 3, B: 2 }, castCrew: {}, genres: {}, keywords: {}, studios: {}, years: {} }
      })

      expect(wrapper.vm.directorsAverages).toEqual([{ name: 'A', type: 'Director', average: 9, count: 3 }])
      // A single qualifying director has zero stdDev -> nothing crosses the
      // threshold, so the outlier list stays empty.
      expect(wrapper.vm.outlierDirectors).toEqual([])
    })

    it('flags a director whose average deviates beyond the threshold', async () => {
      const results = [
        result(9, { crew: [{ job: 'Director', name: 'Great' }] }),
        result(9, { crew: [{ job: 'Director', name: 'Great' }] }),
        result(9, { crew: [{ job: 'Director', name: 'Great' }] }),
        result(2, { crew: [{ job: 'Director', name: 'Bad' }] }),
        result(2, { crew: [{ job: 'Director', name: 'Bad' }] }),
        result(2, { crew: [{ job: 'Director', name: 'Bad' }] }),
        result(6, { crew: [{ job: 'Director', name: 'Middling' }] }),
        result(6, { crew: [{ job: 'Director', name: 'Middling' }] }),
        result(6, { crew: [{ job: 'Director', name: 'Middling' }] }),
      ]
      const wrapper = factory({
        resultsWithRatings: results,
        allCounts: { directors: { Great: 3, Bad: 3, Middling: 3 }, castCrew: {}, genres: {}, keywords: {}, studios: {}, years: {} }
      })
      // Default threshold (2 stdDev) is too wide a net for a small 3-point
      // population's mean-hugging Middling value to clear it at all -- lower
      // it deterministically rather than hand-tuning fragile statistics.
      wrapper.vm.threshold = 1
      await wrapper.vm.$nextTick()

      const names = wrapper.vm.outlierDirectors.map((o) => o.name)
      expect(names).toContain('Great')
      expect(names).toContain('Bad')
      expect(names).not.toContain('Middling')
      // Sorted descending by average.
      expect(wrapper.vm.outlierDirectors[0].name).toBe('Great')
    })

    it('lowering the threshold surfaces more outliers', async () => {
      const results = [
        result(9, { crew: [{ job: 'Director', name: 'Great' }] }),
        result(9, { crew: [{ job: 'Director', name: 'Great' }] }),
        result(9, { crew: [{ job: 'Director', name: 'Great' }] }),
        result(2, { crew: [{ job: 'Director', name: 'Bad' }] }),
        result(2, { crew: [{ job: 'Director', name: 'Bad' }] }),
        result(2, { crew: [{ job: 'Director', name: 'Bad' }] }),
        result(6, { crew: [{ job: 'Director', name: 'Middling' }] }),
        result(6, { crew: [{ job: 'Director', name: 'Middling' }] }),
        result(6, { crew: [{ job: 'Director', name: 'Middling' }] }),
      ]
      const wrapper = factory({
        resultsWithRatings: results,
        allCounts: { directors: { Great: 3, Bad: 3, Middling: 3 }, castCrew: {}, genres: {}, keywords: {}, studios: {}, years: {} }
      })

      wrapper.vm.threshold = 0.1
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.outlierDirectors.map((o) => o.name)).toContain('Middling')
    })
  })

  it('castCrewAverages matches on ANY crew member, not just directors', () => {
    const results = [
      result(9, { crew: [{ job: 'Cinematographer', name: 'X' }] }),
      result(9, { crew: [{ job: 'Cinematographer', name: 'X' }] }),
      result(9, { crew: [{ job: 'Cinematographer', name: 'X' }] }),
    ]
    const wrapper = factory({
      resultsWithRatings: results,
      allCounts: { directors: {}, castCrew: { X: 3 }, genres: {}, keywords: {}, studios: {}, years: {} }
    })

    expect(wrapper.vm.castCrewAverages).toEqual([{ name: 'X', type: 'Crewmember', average: 9, count: 3 }])
  })

  it('genresAverages requires the minimum film count of 5', () => {
    const results = Array.from({ length: 4 }, () => result(9, { genres: [{ name: 'Horror' }] }))
    const wrapper = factory({
      resultsWithRatings: results,
      allCounts: { directors: {}, castCrew: {}, genres: { Horror: 4 }, keywords: {}, studios: {}, years: {} }
    })

    expect(wrapper.vm.genresAverages).toEqual([])
  })

  it('keywordAverages matches against movie.flatKeywords', () => {
    const results = Array.from({ length: 5 }, () => result(7, { flatKeywords: ['heist'] }))
    const wrapper = factory({
      resultsWithRatings: results,
      allCounts: { directors: {}, castCrew: {}, genres: {}, keywords: { heist: 5 }, studios: {}, years: {} }
    })

    expect(wrapper.vm.keywordAverages).toEqual([{ name: 'heist', type: 'Keyword', average: 7, count: 5 }])
  })

  it('studioAverages matches against movie.production_companies', () => {
    const results = Array.from({ length: 5 }, () => result(4, { production_companies: [{ name: 'A24' }] }))
    const wrapper = factory({
      resultsWithRatings: results,
      allCounts: { directors: {}, castCrew: {}, genres: {}, keywords: {}, studios: { A24: 5 }, years: {} }
    })

    expect(wrapper.vm.studioAverages).toEqual([{ name: 'A24', type: 'Studio', average: 4, count: 5 }])
  })

  it('yearsAverages matches by the release year, not exact date', () => {
    const results = [
      result(8, { release_date: '2010-03-10' }),
      result(8, { release_date: '2010-06-15' }),
      result(8, { release_date: '2010-09-20' }),
    ]
    const wrapper = factory({
      resultsWithRatings: results,
      allCounts: { directors: {}, castCrew: {}, genres: {}, keywords: {}, studios: {}, years: { 2010: 3 } }
    })

    expect(wrapper.vm.yearsAverages).toEqual([{ name: '2010', type: 'Year', average: 8, count: 3 }])
  })

  it('allOutliersArray dedupes a name shared across categories and sorts by average descending', async () => {
    // "Same Name" qualifies as both a Director outlier AND a Crewmember
    // outlier (e.g. a director who also produced) -- allOutliersArray should
    // only keep the first (Director, since it's spread in before castCrew).
    const results = [
      result(9, { crew: [{ job: 'Director', name: 'Same Name' }] }),
      result(9, { crew: [{ job: 'Director', name: 'Same Name' }] }),
      result(9, { crew: [{ job: 'Director', name: 'Same Name' }] }),
      result(2, { crew: [{ job: 'Director', name: 'Other' }] }),
      result(2, { crew: [{ job: 'Director', name: 'Other' }] }),
      result(2, { crew: [{ job: 'Director', name: 'Other' }] }),
      result(6, { crew: [{ job: 'Director', name: 'Mid' }] }),
      result(6, { crew: [{ job: 'Director', name: 'Mid' }] }),
      result(6, { crew: [{ job: 'Director', name: 'Mid' }] }),
    ]
    const wrapper = factory({
      resultsWithRatings: results,
      allCounts: {
        directors: { 'Same Name': 3, Other: 3, Mid: 3 },
        castCrew: { 'Same Name': 3 },
        genres: {},
        keywords: {},
        studios: {},
        years: {}
      }
    })
    wrapper.vm.threshold = 1
    await wrapper.vm.$nextTick()

    const names = wrapper.vm.allOutliersArray.map((o) => o.name)
    expect(names).toContain('Same Name')
    expect(new Set(names).size).toBe(names.length)
    expect(wrapper.vm.allOutliersArray.find((o) => o.name === 'Same Name').type).toBe('Director')
    const averages = wrapper.vm.allOutliersArray.map((o) => o.average)
    expect(averages).toEqual([...averages].sort((a, b) => b - a))
  })

  describe('rendering', () => {
    // A three-point population's mean sits close to the middle value, so at
    // the default threshold (2 standard deviations) none of these clear a
    // real-world Great/Bad/Middling spread. Lower the threshold directly
    // (same lever the "lowering the threshold" test above already exercises
    // via the slider) so Great/Bad register as outliers deterministically,
    // without hand-tuning fragile statistics.
    async function directorOutlierWrapper () {
      const results = [
        result(9, { crew: [{ job: 'Director', name: 'Great' }] }),
        result(9, { crew: [{ job: 'Director', name: 'Great' }] }),
        result(9, { crew: [{ job: 'Director', name: 'Great' }] }),
        result(2, { crew: [{ job: 'Director', name: 'Bad' }] }),
        result(2, { crew: [{ job: 'Director', name: 'Bad' }] }),
        result(2, { crew: [{ job: 'Director', name: 'Bad' }] }),
        result(6, { crew: [{ job: 'Director', name: 'Middling' }] }),
        result(6, { crew: [{ job: 'Director', name: 'Middling' }] }),
        result(6, { crew: [{ job: 'Director', name: 'Middling' }] }),
      ]
      const wrapper = factory({
        resultsWithRatings: results,
        allCounts: { directors: { Great: 3, Bad: 3, Middling: 3 }, castCrew: {}, genres: {}, keywords: {}, studios: {}, years: {} }
      })
      wrapper.vm.threshold = 1
      await wrapper.vm.$nextTick()
      return wrapper
    }

    it('renders a green badge above 6 and a red badge at/below 6', async () => {
      const wrapper = await directorOutlierWrapper()

      expect(wrapper.find('.bg-success').exists()).toBe(true)
      expect(wrapper.find('.bg-danger').exists()).toBe(true)
    })

    it('emits updateSearchValue with the outlier name when a list item is clicked', async () => {
      const wrapper = await directorOutlierWrapper()

      await wrapper.find('.outlier-item').trigger('click')

      expect(wrapper.emitted('updateSearchValue')).toBeTruthy()
      expect(wrapper.emitted('updateSearchValue')[0][0]).toBe(wrapper.vm.allOutliersArray[0].name)
    })

    it('wraps keyword names in quotes but not other types', async () => {
      const results = [
        ...Array.from({ length: 5 }, () => result(9, { flatKeywords: ['heist'] })),
        ...Array.from({ length: 5 }, () => result(2, { flatKeywords: ['romance'] })),
        ...Array.from({ length: 5 }, () => result(6, { flatKeywords: ['drama'] })),
      ]
      const wrapper = factory({
        resultsWithRatings: results,
        allCounts: { directors: {}, castCrew: {}, genres: {}, keywords: { heist: 5, romance: 5, drama: 5 }, studios: {}, years: {} }
      })
      wrapper.vm.threshold = 1
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.outlier-item').text()).toContain('"heist"')
    })
  })

  it('getYear extracts the release year from a result', () => {
    const wrapper = factory({
      resultsWithRatings: [],
      allCounts: { directors: {}, castCrew: {}, genres: {}, keywords: {}, studios: {}, years: {} }
    })

    expect(wrapper.vm.getYear(result(9, { release_date: '1999-03-04' }))).toBe(1999)
  })
})

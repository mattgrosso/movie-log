import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Insights from '@/components/Insights.vue'

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((media) => {
    const r = (media?.ratings && media.ratings[media.ratings.length - 1]) || {}
    return {
      ...r,
      calculatedTotal: r.calculatedTotal != null ? r.calculatedTotal : 0
    }
  })
}))

// Ratings record `date` as a real Date-derived value, not a bare "YYYY-MM-DD"
// string — using a local-time timestamp here (not a date-only ISO string)
// sidesteps `new Date('YYYY-MM-DD')`'s UTC-midnight parsing, which shifts a
// day backward in negative-UTC-offset timezones (confirmed in this repo's
// test environment: America/New_York) and would otherwise misassign ratings
// across month/year boundaries in these fixtures.
function localDate (year, month, day, hour = 12) {
  return new Date(year, month - 1, day, hour).getTime()
}

function entry (overrides = {}) {
  return {
    dbKey: overrides.dbKey || 'key',
    ratings: overrides.ratings || [{ calculatedTotal: 5, date: localDate(2026, 1, 15) }],
    movie: {
      id: 1,
      title: 'Movie',
      release_date: localDate(2010, 5, 15),
      runtime: 100,
      genres: [],
      cast: [],
      crew: [],
      keywords: [],
      ...overrides.movie
    }
  }
}

// `mediaEntries` MUST be supplied here, at construction, rather than mutated
// on the mock store after mounting. Insights.vue's template reads several
// computeds unconditionally during the initial (synchronous) shallowMount
// render, and since this mock $store is a plain object (not a real reactive
// Vuex store), any computed touched during that first render permanently
// caches whatever `getters.allMediaAsArray` held AT THAT MOMENT — the same
// "Vue computed with no reactive dependency never re-evaluates" trap fixed
// in store/index.js's devMode getter (see that commit). Mutating the array
// post-mount silently no-ops for any computed already rendered once.
function mountInsights ({ state = {}, mediaEntries = [] } = {}) {
  const pushSpy = vi.fn()
  const commitSpy = vi.fn()
  const dispatchSpy = vi.fn(() => Promise.resolve())
  const mockStore = {
    state: {
      currentLog: 'movieLog',
      settings: {},
      ...state
    },
    getters: { allMediaAsArray: mediaEntries },
    commit: commitSpy,
    dispatch: dispatchSpy
  }

  const wrapper = shallowMount(Insights, {
    global: {
      mocks: {
        $store: mockStore,
        $route: { query: {} },
        $router: { push: pushSpy }
      }
    }
  })

  return { wrapper, pushSpy, commitSpy, dispatchSpy, mockStore }
}

describe('Insights', () => {
  describe('date-window computeds (fixed system time)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 6, 21)) // Jul 21 2026
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('thisMonth/lastMonth/thisYear/lastYear read off the pinned wall clock', () => {
      const { wrapper } = mountInsights()
      expect(wrapper.vm.thisMonth).toBe('July')
      expect(wrapper.vm.lastMonth).toBe('June')
      expect(wrapper.vm.thisYear).toBe(2026)
      expect(wrapper.vm.lastYear).toBe(2025)
    })

    it('moviesWatchedThisWeek/LastWeek only count ratings within their 7-day windows', () => {
      const mediaEntries = [
        entry({ dbKey: 'today', ratings: [{ calculatedTotal: 5, date: localDate(2026, 7, 21) }] }),
        entry({ dbKey: 'thisWeek', ratings: [{ calculatedTotal: 5, date: localDate(2026, 7, 17) }] }),
        entry({ dbKey: 'lastWeek', ratings: [{ calculatedTotal: 5, date: localDate(2026, 7, 10) }] }),
        entry({ dbKey: 'longAgo', ratings: [{ calculatedTotal: 5, date: localDate(2026, 1, 1) }] })
      ]
      const { wrapper } = mountInsights({ mediaEntries })

      expect(wrapper.vm.moviesWatchedThisWeek).toBe(2) // today + thisWeek
      expect(wrapper.vm.moviesWatchedLastWeek).toBe(1) // lastWeek
    })

    it('moviesWatchedThisMonth/LastMonth bucket by calendar month, not a rolling window', () => {
      const mediaEntries = [
        entry({ dbKey: 'a', ratings: [{ calculatedTotal: 5, date: localDate(2026, 7, 1) }] }),
        entry({ dbKey: 'b', ratings: [{ calculatedTotal: 5, date: localDate(2026, 7, 21) }] }),
        entry({ dbKey: 'c', ratings: [{ calculatedTotal: 5, date: localDate(2026, 6, 15) }] }),
        entry({ dbKey: 'd', ratings: [{ calculatedTotal: 5, date: localDate(2025, 7, 15) }] }) // same month, different year
      ]
      const { wrapper } = mountInsights({ mediaEntries })

      expect(wrapper.vm.moviesWatchedThisMonth).toBe(2)
      expect(wrapper.vm.moviesWatchedLastMonth).toBe(1)
    })

    it('moviesWatchedThisYear/LastYear bucket by calendar year', () => {
      const mediaEntries = [
        entry({ dbKey: 'a', ratings: [{ calculatedTotal: 5, date: localDate(2026, 2, 1) }] }),
        entry({ dbKey: 'b', ratings: [{ calculatedTotal: 5, date: localDate(2026, 11, 1) }] }),
        entry({ dbKey: 'c', ratings: [{ calculatedTotal: 5, date: localDate(2025, 3, 1) }] })
      ]
      const { wrapper } = mountInsights({ mediaEntries })

      expect(wrapper.vm.moviesWatchedThisYear).toBe(2)
      expect(wrapper.vm.moviesWatchedLastYear).toBe(1)
    })

    it('moviesWatchedLastYearToDate only counts last year up through the same month/day as today', () => {
      const mediaEntries = [
        entry({ dbKey: 'before-cutoff', ratings: [{ calculatedTotal: 5, date: localDate(2025, 7, 20) }] }),
        entry({ dbKey: 'on-cutoff', ratings: [{ calculatedTotal: 5, date: localDate(2025, 7, 21) }] }),
        entry({ dbKey: 'after-cutoff', ratings: [{ calculatedTotal: 5, date: localDate(2025, 7, 22) }] })
      ]
      const { wrapper } = mountInsights({ mediaEntries })

      expect(wrapper.vm.moviesWatchedLastYearToDate).toBe(2) // before + on cutoff, not after
    })
  })

  describe('estimatedMoviesThisYear (characterization)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 6, 21)) // day 202 of 2026 (not a leap year)
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('produces a stable estimate for a fixed viewing history — locks in current behavior', () => {
      const mediaEntries = [
        entry({ dbKey: 'a', ratings: [{ calculatedTotal: 5, date: localDate(2026, 1, 5) }] }),
        entry({ dbKey: 'b', ratings: [{ calculatedTotal: 5, date: localDate(2026, 3, 10) }] }),
        entry({ dbKey: 'c', ratings: [{ calculatedTotal: 5, date: localDate(2026, 7, 18) }] }),
        entry({ dbKey: 'd', ratings: [{ calculatedTotal: 5, date: localDate(2026, 7, 20) }] })
      ]
      const { wrapper } = mountInsights({ mediaEntries })

      // This is a characterization test: the exact number below is whatever
      // the current formula produces for this fixture, captured as a
      // regression guard — not independently re-derived by hand. If this
      // starts failing after a legitimate formula change, recompute and
      // update rather than assuming the new number is wrong.
      expect(wrapper.vm.estimatedMoviesThisYear).toBe(15)
    })

    it('does not throw when nothing has been watched yet this year (division by small dayOfYear)', () => {
      const { wrapper } = mountInsights()
      expect(Number.isNaN(wrapper.vm.estimatedMoviesThisYear)).toBe(false)
      expect(wrapper.vm.estimatedMoviesThisYear).toBe(0)
    })
  })

  describe('seasonalProjectedAdditional (follow-up ask: "look at what I was doing last year... build in some guards against people with very small libraries")', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 6, 21)) // Jul 21 2026, same as the describe block above
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    function datedEntries (prefix, dates) {
      return dates.map(([y, m, d], i) => entry({ dbKey: `${prefix}-${i}`, ratings: [{ calculatedTotal: 5, date: localDate(y, m, d) }] }))
    }

    it('is null when last year\'s FULL-YEAR total is too small to trust a "shape" (MIN_LAST_YEAR_TOTAL)', () => {
      // 11 movies, all last year — under the 12-movie floor.
      const mediaEntries = datedEntries('ly', Array.from({ length: 11 }, (_, i) => [2025, 1, i + 1]))
      const { wrapper } = mountInsights({ mediaEntries })

      expect(wrapper.vm.moviesWatchedLastYear).toBe(11)
      expect(wrapper.vm.seasonalProjectedAdditional).toBeNull()
    })

    it('is null when last year\'s TO-DATE count is too small, even with a large full-year total (MIN_LAST_YEAR_TO_DATE)', () => {
      // Only 3 movies by Jul 21 2025 (to-date), but 20 for the full year —
      // the rest all land after the cutoff.
      const mediaEntries = datedEntries('ly', [
        [2025, 1, 1], [2025, 1, 2], [2025, 1, 3],
        ...Array.from({ length: 17 }, (_, i) => [2025, 9, i + 1])
      ])
      const { wrapper } = mountInsights({ mediaEntries })

      expect(wrapper.vm.moviesWatchedLastYear).toBe(20)
      expect(wrapper.vm.moviesWatchedLastYearToDate).toBe(3)
      expect(wrapper.vm.seasonalProjectedAdditional).toBeNull()
    })

    it('computes a real projection once both guards pass, scaling this year\'s count by the inverse of last year\'s to-date fraction', () => {
      // Last year: 10 by Jul 21 (to-date), 10 more after -> total 20,
      // fraction watched-by-now = 0.5. This year: exactly 10 watched so
      // far. Projected full-year total = 10 / 0.5 = 20, so the ADDITIONAL
      // implied by this signal alone is 20 - 10 = 10 — a clean, exactly
      // hand-checkable case (not just a characterization lock-in).
      const mediaEntries = [
        ...datedEntries('ly-early', Array.from({ length: 10 }, (_, i) => [2025, 1, i + 1])),
        ...datedEntries('ly-late', Array.from({ length: 10 }, (_, i) => [2025, 9, i + 1])),
        ...datedEntries('ty', Array.from({ length: 10 }, (_, i) => [2026, 2, i + 1]))
      ]
      const { wrapper } = mountInsights({ mediaEntries })

      expect(wrapper.vm.moviesWatchedLastYear).toBe(20)
      expect(wrapper.vm.moviesWatchedLastYearToDate).toBe(10)
      expect(wrapper.vm.moviesWatchedThisYear).toBe(10)
      expect(wrapper.vm.seasonalProjectedAdditional).toBe(10)
    })

    it('floors an extremely lopsided fraction at MIN_FRACTION rather than letting it scale up unboundedly', () => {
      // Last year: 4 by Jul 21 (to-date — clears MIN_LAST_YEAR_TO_DATE on
      // its own), but 40 for the full year — a real fraction of 4/40 =
      // 0.1 would imply a 10x scale-up. MIN_FRACTION (0.15) caps it well
      // short of that, independent of the absolute-count guards above.
      const mediaEntries = [
        ...datedEntries('ly-early', [[2025, 1, 1], [2025, 1, 2], [2025, 1, 3], [2025, 1, 4]]),
        ...datedEntries('ly-late', Array.from({ length: 36 }, (_, i) => [2025, 9, (i % 28) + 1])),
        ...datedEntries('ty', Array.from({ length: 6 }, (_, i) => [2026, 2, i + 1]))
      ]
      const { wrapper } = mountInsights({ mediaEntries })

      expect(wrapper.vm.moviesWatchedLastYear).toBe(40)
      expect(wrapper.vm.moviesWatchedLastYearToDate).toBe(4)
      // Uncapped, 6 / (4/40) - 6 = 54. Capped at the 0.15 floor:
      // 6 / 0.15 - 6 = 34.
      expect(wrapper.vm.seasonalProjectedAdditional).toBeCloseTo(34, 5)
    })

    it('estimatedMoviesThisYear blends the seasonal signal in when it qualifies, and falls back to the unchanged 3-way blend when it does not', () => {
      const thisYearDates = Array.from({ length: 10 }, (_, i) => [2026, 2, i + 1])
      const qualifyingLastYear = [
        ...Array.from({ length: 10 }, (_, i) => [2025, 1, i + 1]),
        ...Array.from({ length: 10 }, (_, i) => [2025, 9, i + 1])
      ]

      const withSeasonal = mountInsights({
        mediaEntries: [...datedEntries('ly', qualifyingLastYear), ...datedEntries('ty', thisYearDates)]
      }).wrapper
      const withoutSeasonal = mountInsights({
        mediaEntries: datedEntries('ty', thisYearDates)
      }).wrapper

      expect(withSeasonal.vm.seasonalProjectedAdditional).not.toBeNull()
      expect(withoutSeasonal.vm.seasonalProjectedAdditional).toBeNull()
      // Same "this year" viewing in both cases, but the version with a
      // qualifying prior year produces a DIFFERENT (not just coincidentally
      // equal) final estimate — proof the signal actually reaches the
      // blended output, not just its own isolated computed.
      expect(withSeasonal.vm.estimatedMoviesThisYear).not.toBe(withoutSeasonal.vm.estimatedMoviesThisYear)
    })
  })

  describe('rating stats (highest/lowest/average)', () => {
    it('computes max/min/mean over rated movies only', () => {
      const mediaEntries = [
        entry({ dbKey: 'a', ratings: [{ calculatedTotal: 4, date: localDate(2026, 1, 1) }] }),
        entry({ dbKey: 'b', ratings: [{ calculatedTotal: 9, date: localDate(2026, 1, 1) }] }),
        entry({ dbKey: 'c', ratings: [{ calculatedTotal: 6.5, date: localDate(2026, 1, 1) }] })
      ]
      const { wrapper } = mountInsights({ mediaEntries })

      expect(wrapper.vm.highestRating).toBe('9.00')
      expect(wrapper.vm.lowestRating).toBe('4.00')
      expect(wrapper.vm.averageRating).toBe('6.50')
    })

    it('characterizes the empty-library edge case (no unrated-safe guard today)', () => {
      const { wrapper } = mountInsights()

      // Documents current (not necessarily desirable) behavior: Math.max()/
      // Math.min() over an empty array are +/-Infinity, and 0/0 is NaN.
      expect(wrapper.vm.highestRating).toBe('-Infinity')
      expect(wrapper.vm.lowestRating).toBe('Infinity')
      expect(wrapper.vm.averageRating).toBe('NaN')
    })
  })

  describe('ratingsCountData histogram', () => {
    it('buckets ratings into 0.5-point-wide labeled buckets', () => {
      const mediaEntries = [
        entry({ dbKey: 'a', ratings: [{ calculatedTotal: 7.1, date: localDate(2026, 1, 1) }] }),
        entry({ dbKey: 'b', ratings: [{ calculatedTotal: 7.4, date: localDate(2026, 1, 1) }] }),
        entry({ dbKey: 'c', ratings: [{ calculatedTotal: 8.0, date: localDate(2026, 1, 1) }] })
      ]
      const { wrapper } = mountInsights({ mediaEntries })

      const data = wrapper.vm.ratingsCountData
      const total = data.datasets[0].data.reduce((a, b) => a + b, 0)
      expect(total).toBe(3)
      // 7.1 and 7.4 both round to the nearest 0.5 -> 7.0 and 7.5 respectively;
      // whichever labels they land on should sum with the 8.0 bucket to 3.
      expect(data.labels).toContain('8')
    })
  })

  describe('getAxisValue + calculate*Scale heuristics', () => {
    it('dispatches simple axes without touching the scale calculators', () => {
      const { wrapper } = mountInsights()
      const result = entry({ movie: { runtime: 120, release_date: localDate(2015, 6, 1), genres: [{ name: 'Drama' }], cast: [1, 2, 3], title: 'Abc' } })

      expect(wrapper.vm.getAxisValue(result, 'runtime')).toBe(120)
      expect(wrapper.vm.getAxisValue(result, 'releaseYear')).toBe(2015)
      expect(wrapper.vm.getAxisValue(result, 'releaseMonth')).toBe(6)
      expect(wrapper.vm.getAxisValue(result, 'genreCount')).toBe(1)
      expect(wrapper.vm.getAxisValue(result, 'castSize')).toBe(3)
      expect(wrapper.vm.getAxisValue(result, 'titleLength')).toBe(3)
    })

    it('returns null for an unknown axis key', () => {
      const { wrapper } = mountInsights()
      const result = entry()
      expect(wrapper.vm.getAxisValue(result, 'notARealAxis')).toBeNull()
    })

    it('dispatches *Scale axes to their matching calculate*Scale method', () => {
      const { wrapper } = mountInsights()
      const result = entry({ movie: { genres: [{ name: 'Documentary' }], flatKeywords: [] } })
      const spy = vi.spyOn(wrapper.vm, 'calculateCerebralScale')

      wrapper.vm.getAxisValue(result, 'cerebralScale')
      expect(spy).toHaveBeenCalledWith(result.movie)
    })

    it('calculateCerebralScale scores cerebral genres positive and instinctual genres negative', () => {
      const { wrapper } = mountInsights()
      const documentary = { genres: [{ name: 'Documentary' }], flatKeywords: [], runtime: 100, title: '' }
      const action = { genres: [{ name: 'Action' }], flatKeywords: [], runtime: 100, title: '' }

      expect(wrapper.vm.calculateCerebralScale(documentary)).toBeGreaterThan(0)
      expect(wrapper.vm.calculateCerebralScale(action)).toBeLessThan(0)
    })

    it('every calculate*Scale result is clamped to [-10, 10]', () => {
      const { wrapper } = mountInsights()
      // Stack every cerebral+instinctual genre/keyword this function knows about
      // to try to blow past the clamp in both directions.
      const maxedOut = {
        genres: [{ name: 'Documentary' }, { name: 'Drama' }, { name: 'History' }, { name: 'War' }, { name: 'Biography' }],
        flatKeywords: ['philosophy', 'politics', 'paranoia', 'dystopia', 'investigation', 'memory', 'psychology', 'conspiracy'],
        runtime: 400,
        title: 'x'.repeat(50)
      }
      const score = wrapper.vm.calculateCerebralScale(maxedOut)
      expect(score).toBeLessThanOrEqual(10)
      expect(score).toBeGreaterThanOrEqual(-10)
    })
  })

  describe('navigation and Firebase-write methods', () => {
    it('returnHome shows the header again and navigates to Home', () => {
      const { wrapper, commitSpy, pushSpy } = mountInsights()
      wrapper.vm.returnHome()
      expect(commitSpy).toHaveBeenCalledWith('setShowHeader', true)
      expect(pushSpy).toHaveBeenCalledWith({ path: '/', query: { movieDbKey: undefined } })
    })

    it('goToYearInReview navigates to /year-in-review', () => {
      const { wrapper, pushSpy } = mountInsights()
      wrapper.vm.goToYearInReview()
      expect(pushSpy).toHaveBeenCalledWith('/year-in-review')
    })

    it('updateSearchValue navigates Home with the search term as a query param', () => {
      const { wrapper, pushSpy } = mountInsights()
      wrapper.vm.updateSearchValue('Denis Villeneuve')
      expect(pushSpy).toHaveBeenCalledWith({ name: 'Home', query: { search: encodeURIComponent('Denis Villeneuve') } })
    })

  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import YearInReview from '@/components/YearInReview.vue'

// dateAtLocalNoon avoids the documented "new Date('YYYY-01-01') can roll to
// the previous year under a negative UTC offset" trap by using a
// timestamp-of-day (rating dates in this app are epoch ms) rather than a
// date-only ISO string.
function dateAtLocalNoon (year, month, day) {
  return new Date(year, month, day, 12, 0, 0).getTime()
}

function entry (id, { year = 2023, month = 5, day = 10, runtime = 100, cast = [], crew = [], genres = [], calculatedTotal = 7, releaseYear = year } = {}) {
  return {
    movie: {
      id,
      title: `Movie ${id}`,
      runtime,
      cast,
      crew,
      genres,
      release_date: `${releaseYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    },
    ratings: [{ calculatedTotal, date: dateAtLocalNoon(year, month, day) }]
  }
}

function factory (entries, { includeShorts = true, push = vi.fn() } = {}) {
  return mount(YearInReview, {
    global: {
      // BarChart drives real Chart.js DOM/resize-observer lifecycle work
      // that isn't safe to leave running past jsdom's per-test teardown --
      // none of these tests are about chart rendering, so stub it out.
      stubs: { BarChart: true },
      mocks: {
        $store: {
          getters: { allMediaAsArray: entries },
          state: { settings: { includeShorts } }
        },
        $router: { push }
      }
    }
  })
}

describe('YearInReview', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('availableYears derives distinct years from rating dates, newest first', () => {
    const entries = [entry(1, { year: 2022 }), entry(2, { year: 2024 }), entry(3, { year: 2023 })]
    const wrapper = factory(entries)
    expect(wrapper.vm.availableYears).toEqual([2024, 2023, 2022])
  })

  it('watchedMoviesInYear only includes entries with a rating dated in selectedYear', () => {
    const entries = [entry(1, { year: 2023 }), entry(2, { year: 2022 })]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.watchedMoviesInYear.map((e) => e.movie.id)).toEqual([1])
  })

  it('excludes shorts (Short genre or runtime <= 40) when includeShorts is false', () => {
    const entries = [
      entry(1, { year: 2023, runtime: 100 }),
      entry(2, { year: 2023, runtime: 30 }),
      entry(3, { year: 2023, runtime: 100, genres: [{ name: 'Short' }] }),
    ]
    const wrapper = factory(entries, { includeShorts: false })
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.watchedMoviesInYear.map((e) => e.movie.id)).toEqual([1])
  })

  it('includeShorts true keeps everything', () => {
    const entries = [entry(1, { year: 2023, runtime: 30 })]
    const wrapper = factory(entries, { includeShorts: true })
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.watchedMoviesInYear.map((e) => e.movie.id)).toEqual([1])
  })

  it('releasedMoviesInYear filters by the movie release date, not the rating date', () => {
    const entries = [entry(1, { year: 2023, releaseYear: 2023 }), entry(2, { year: 2023, releaseYear: 2010 })]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.moviesRatedCount).toBe(1)
  })

  it('totalMinutes sums runtime across watched movies and timeStats breaks it into d/h/m', () => {
    const entries = [entry(1, { year: 2023, runtime: 90 }), entry(2, { year: 2023, runtime: 1500 })]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.totalMinutes).toBe(1590)
    // 1590 min = 1 day, 2 hours, 30 min
    expect(wrapper.vm.timeStats).toEqual({ days: 1, hours: 2, minutes: 30 })
  })

  it('percentOfYear is totalMinutes over 16 waking hours * 365 days, to 1 decimal', () => {
    const wakingMinutesInYear = 16 * 60 * 365
    const entries = [entry(1, { year: 2023, runtime: wakingMinutesInYear / 2 })]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.percentOfYear).toBe('50.0')
  })

  it('moviesByMonth buckets watched-in-year ratings by the rating month', () => {
    const entries = [entry(1, { year: 2023, month: 0 }), entry(2, { year: 2023, month: 0 }), entry(3, { year: 2023, month: 11 })]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.moviesByMonth[0]).toBe(2)
    expect(wrapper.vm.moviesByMonth[11]).toBe(1)
    expect(wrapper.vm.moviesByMonth.reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('busiestMonth reports the month with the highest count', () => {
    const entries = [entry(1, { year: 2023, month: 2 }), entry(2, { year: 2023, month: 2 }), entry(3, { year: 2023, month: 5 })]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.busiestMonth).toEqual({ month: 'March', count: 2 })
  })

  it('topActors counts cast appearances (top 10 billed only) and sorts descending', () => {
    const entries = [
      entry(1, { year: 2023, cast: [{ name: 'A' }, { name: 'B' }] }),
      entry(2, { year: 2023, cast: [{ name: 'A' }] }),
    ]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.topActors[0]).toMatchObject({ name: 'A', count: 2 })
    expect(wrapper.vm.topActors[1]).toMatchObject({ name: 'B', count: 1 })
  })

  it('topDirectors only counts crew with job === Director', () => {
    const entries = [entry(1, { year: 2023, crew: [{ job: 'Director', name: 'D1' }, { job: 'Editor', name: 'E1' }] })]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.topDirectors).toEqual([{ name: 'D1', count: 1 }])
  })

  it('topGenres counts genre occurrences across watched movies', () => {
    const entries = [
      entry(1, { year: 2023, genres: [{ name: 'Drama' }] }),
      entry(2, { year: 2023, genres: [{ name: 'Drama' }, { name: 'Comedy' }] }),
    ]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.topGenres[0]).toEqual({ name: 'Drama', count: 2 })
  })

  it('bestRatedMovies uses the LAST rating in each entry\'s ratings array, sorted descending', () => {
    const low = entry(1, { year: 2023, releaseYear: 2023, calculatedTotal: 3 })
    const high = entry(2, { year: 2023, releaseYear: 2023, calculatedTotal: 9 })
    const wrapper = factory([low, high])
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.bestRatedMovies.map((m) => m.rating)).toEqual([9, 3])
  })

  it('longestMovie / shortestMovie pick runtime extremes, ignoring zero/missing runtime', () => {
    const entries = [
      entry(1, { year: 2023, runtime: 200 }),
      entry(2, { year: 2023, runtime: 50 }),
      entry(3, { year: 2023, runtime: 0 }),
    ]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.longestMovie.id).toBe(1)
    expect(wrapper.vm.shortestMovie.id).toBe(2)
  })

  it('oldestMovie picks the earliest release_date among watched movies', () => {
    const entries = [
      entry(1, { year: 2023, releaseYear: 2020 }),
      entry(2, { year: 2023, releaseYear: 1975 }),
    ]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.oldestMovie.id).toBe(2)
  })

  it('averageRating averages the last rating of each watched movie, and is 0 for an empty year', () => {
    const entries = [
      entry(1, { year: 2023, calculatedTotal: 6 }),
      entry(2, { year: 2023, calculatedTotal: 8 }),
    ]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.averageRating).toBe('7.0')

    wrapper.vm.selectedYear = 1999
    expect(wrapper.vm.averageRating).toBe(0)
  })

  it('mostCommonDecade buckets by release year and falls back to N/A when nothing qualifies', () => {
    const entries = [
      entry(1, { year: 2023, releaseYear: 1994 }),
      entry(2, { year: 2023, releaseYear: 1998 }),
      entry(3, { year: 2023, releaseYear: 2001 }),
    ]
    const wrapper = factory(entries)
    wrapper.vm.selectedYear = 2023
    expect(wrapper.vm.mostCommonDecade).toEqual({ decade: '1990s', count: 2 })

    wrapper.vm.selectedYear = 1999
    expect(wrapper.vm.mostCommonDecade).toEqual({ decade: 'N/A', count: 0 })
  })

  describe('methods', () => {
    it('getBadgeSizeClass ranks the top 3 distinctly, then falls back', () => {
      const wrapper = factory([])
      expect(wrapper.vm.getBadgeSizeClass(0)).toBe('bg-primary')
      expect(wrapper.vm.getBadgeSizeClass(1)).toBe('bg-info')
      expect(wrapper.vm.getBadgeSizeClass(2)).toBe('bg-success')
      expect(wrapper.vm.getBadgeSizeClass(3)).toBe('bg-secondary')
    })

    it('getGenreFontSize steps down for lower ranks', () => {
      const wrapper = factory([])
      expect(wrapper.vm.getGenreFontSize(0)).toBe('1rem')
      expect(wrapper.vm.getGenreFontSize(3)).toBe('0.75rem')
    })

    it('goToMovie pushes to the movie detail route', () => {
      const push = vi.fn()
      const wrapper = factory([], { push })
      wrapper.vm.goToMovie({ id: 42 })
      expect(push).toHaveBeenCalledWith('/movie/42')
    })

    // There was no way off this screen at all: `returnHome` was defined and
    // never called from anywhere (found in the 2026-08-16 navigation pass).
    it('has a back link, which it previously did not', () => {
      const wrapper = factory([], { push: vi.fn() })

      expect(wrapper.findComponent({ name: 'BackLink' }).exists()).toBe(true)
      expect(wrapper.vm.returnHome).toBeUndefined()
    })
  })

  describe('fetchActorDetails (mounted)', () => {
    it('fetches TMDB person details for the top 5 actors and caches them by name', async () => {
      const entries = [entry(1, { year: 2023, cast: [{ name: 'Famous Person' }] })]
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ id: 99, profile_path: '/p.jpg' }] })
      })
      const wrapper = factory(entries)
      wrapper.vm.selectedYear = 2023
      await flushPromises()

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('search/person'))
      expect(wrapper.vm.actorDetails['Famous Person']).toEqual({ id: 99, profile_path: '/p.jpg' })
      expect(wrapper.vm.topActors[0]).toMatchObject({ name: 'Famous Person', id: 99, profile_path: '/p.jpg' })
    })

    it('silently no-ops on a failed fetch rather than throwing', async () => {
      const entries = [entry(1, { year: 2023, cast: [{ name: 'Someone' }] })]
      global.fetch = vi.fn().mockRejectedValue(new Error('network down'))
      const wrapper = factory(entries)
      wrapper.vm.selectedYear = 2023
      await flushPromises()

      expect(wrapper.vm.actorDetails).toEqual({})
    })

    it('re-fetches when selectedYear changes', async () => {
      const entries = [entry(1, { year: 2023, cast: [{ name: 'A' }] }), entry(2, { year: 2022, cast: [{ name: 'B' }] })]
      const wrapper = factory(entries)
      await flushPromises()
      global.fetch.mockClear()

      wrapper.vm.selectedYear = 2022
      await flushPromises()

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('B')))
    })
  })
})

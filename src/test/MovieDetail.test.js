import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import MovieDetail from '@/components/MovieDetail.vue'

// created() fires loadMovieData() which uses axios; resolve it benignly.
vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} }))
  }
}))

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((media) => {
    const r = (media?.ratings && media.ratings[0]) || {}
    return {
      ...r,
      calculatedTotal: r.calculatedTotal != null ? r.calculatedTotal : 5,
      normalizedRating: r.normalizedRating != null ? r.normalizedRating : 5
    }
  }),
  getAllRatings: vi.fn(() => [])
}))

vi.mock('@/services/ErrorLogService.js', () => ({ default: { error: vi.fn() } }))

function makeResult (overrides = {}) {
  return {
    dbKey: 'abc123',
    movie: {
      id: 42,
      title: 'Test Movie',
      release_date: '2019-05-20',
      runtime: 142,
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      genres: [{ name: 'Drama' }, { name: 'Thriller' }],
      crew: [
        { name: 'Jane Director', job: 'Director' },
        { name: 'Joe Writer', job: 'Writer' },
        { name: 'Co Director', job: 'Co-Director' }
      ],
      ...overrides.movie
    },
    ratings: [{ calculatedTotal: 8.5, normalizedRating: 8, date: Date.now() }],
    ...overrides
  }
}

describe('MovieDetail', () => {
  let wrapper
  let mockStore
  let pushSpy

  beforeEach(async () => {
    pushSpy = vi.fn()
    mockStore = {
      state: {
        movieLog: {},
        settings: { tags: { 'viewing-tags': {} } },
        academyAwardWinners: {}
      },
      getters: { allMoviesAsArray: [], allMediaAsArray: [] },
      commit: vi.fn(),
      dispatch: vi.fn()
    }

    wrapper = shallowMount(MovieDetail, {
      global: {
        mocks: {
          $store: mockStore,
          $route: { params: { tmdbId: '42' }, query: {} },
          $router: { push: pushSpy }
        },
        stubs: { ToggleableRating: true, Modal: true }
      }
    })

    // result/movie are normally loaded async in created(); set them directly.
    await wrapper.setData({ result: makeResult(), movie: makeResult().movie })
  })

  describe('pure formatters', () => {
    it('getYear returns the release year, or Unknown when missing', () => {
      expect(wrapper.vm.getYear({ movie: { release_date: '2019-05-20' } })).toBe(2019)
      expect(wrapper.vm.getYear({ movie: {} })).toBe('Unknown')
    })

    it('prettifyRuntime handles hours+minutes, minutes-only, and unknown', () => {
      expect(wrapper.vm.prettifyRuntime({ movie: { runtime: 142 } })).toBe('2h 22m')
      expect(wrapper.vm.prettifyRuntime({ movie: { runtime: 45 } })).toBe('45m')
      expect(wrapper.vm.prettifyRuntime({ movie: {} })).toBe('Runtime unknown')
    })

    it('formattedDate returns a localized date or empty string', () => {
      expect(wrapper.vm.formattedDate(null)).toBe('')
      expect(wrapper.vm.formattedDate('2020-01-01')).not.toBe('')
    })

    it('formatTimeDifference bins by days, weeks, months, years', () => {
      const day = 24 * 60 * 60 * 1000
      const base = new Date('2020-01-01').getTime()
      expect(wrapper.vm.formatTimeDifference(base, base + day)).toBe('1 day')
      expect(wrapper.vm.formatTimeDifference(base, base + 3 * day)).toBe('3 days')
      expect(wrapper.vm.formatTimeDifference(base, base + 14 * day)).toBe('2 weeks')
      expect(wrapper.vm.formatTimeDifference(base, base + 90 * day)).toBe('3 months')
      // NOTE: the months branch runs all the way to 730 days, so 400 days is
      // reported as months, not years. (Characterizes current behavior — the
      // '1 year' string is effectively unreachable since 730/365 rounds to 2.)
      expect(wrapper.vm.formatTimeDifference(base, base + 400 * day)).toBe('13 months')
      expect(wrapper.vm.formatTimeDifference(base, base + 800 * day)).toBe('2 years')
    })
  })

  describe('crew + structure', () => {
    it('getCrewMember strict matches the exact job; loose matches substrings', () => {
      // 'strict' → only exact "Director"
      expect(wrapper.vm.getCrewMember('Director', 'strict')).toEqual(['Jane Director'])
      // loose → "Director" and "Co-Director" both include "Director"
      expect(wrapper.vm.getCrewMember('Director')).toEqual(['Jane Director', 'Co Director'])
    })

    it('topStructure spreads the movie and attaches flatKeywords', () => {
      const top = wrapper.vm.topStructure(makeResult())
      expect(top.title).toBe('Test Movie')
      expect(Array.isArray(top.flatKeywords)).toBe(true)
    })

    it('ratingForMedia / normalizedRatingForMedia read from getRating', () => {
      const result = makeResult()
      expect(wrapper.vm.ratingForMedia(result)).toBe(8.5)
      expect(wrapper.vm.normalizedRatingForMedia(result)).toBe(8)
    })
  })

  describe('poster / backdrop selection', () => {
    it('getBackdropPath / getPosterPath prefer a custom path', async () => {
      expect(wrapper.vm.getBackdropPath()).toBe('/backdrop.jpg')
      expect(wrapper.vm.getPosterPath(wrapper.vm.result)).toBe('/poster.jpg')

      await wrapper.setData({
        result: makeResult({ customBackdropPath: '/custom-bd.jpg', customPosterPath: '/custom-p.jpg' })
      })
      expect(wrapper.vm.getBackdropPath()).toBe('/custom-bd.jpg')
      expect(wrapper.vm.getPosterPath(wrapper.vm.result)).toBe('/custom-p.jpg')
    })

    it('isSelectedBackdrop marks the movie default when no custom is set', () => {
      expect(wrapper.vm.isSelectedBackdrop('/backdrop.jpg')).toBe(true)
      expect(wrapper.vm.isSelectedBackdrop('/other.jpg')).toBe(false)
    })
  })

  describe('navigation (documented banner behavior)', () => {
    it('goBack features this movie in the banner and routes home', () => {
      wrapper.vm.goBack()
      expect(mockStore.commit).toHaveBeenCalledWith('setHomePageNavigationIntent', 'close')
      expect(mockStore.commit).toHaveBeenCalledWith('setBannerRequest', { type: 'movie', movieId: 42 })
      expect(pushSpy).toHaveBeenCalledWith('/')
    })

    it('searchFor promotes the clicked type group and samples from results for the banner', () => {
      wrapper.vm.searchFor('Denis Villeneuve', 'director')
      expect(mockStore.commit).toHaveBeenCalledWith('setHomePagePromoteGroup', 'director')
      expect(mockStore.commit).toHaveBeenCalledWith('setHomePageSearchValue', 'Denis Villeneuve')
      expect(mockStore.commit).toHaveBeenCalledWith('setBannerRequest', { type: 'fromResults' })
      expect(pushSpy).toHaveBeenCalledWith('/')
    })

    it('groupKeyForClickType maps known types and falls back to null', () => {
      expect(wrapper.vm.groupKeyForClickType('keyword')).toBe('keyword-genre')
      expect(wrapper.vm.groupKeyForClickType('genre')).toBe('keyword-genre')
      expect(wrapper.vm.groupKeyForClickType('composer')).toBe('music')
      expect(wrapper.vm.groupKeyForClickType('photo')).toBe('cinematographer')
      expect(wrapper.vm.groupKeyForClickType('year')).toBeNull()
      expect(wrapper.vm.groupKeyForClickType(undefined)).toBeNull()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import RateMovie from '@/components/RateMovie.vue'

// --- Mocks ------------------------------------------------------------------
// axios: getChatGPTKeywords runs in mounted(); resolve it so mount is quiet.
vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { keywords: [] } })),
    get: vi.fn(() => Promise.resolve({ data: {} }))
  }
}))

// addRating hits Firebase — stub it to a predictable db path.
vi.mock('@/assets/javascript/AddRating.js', () => ({
  default: vi.fn(() => Promise.resolve({ path: 'test-user/movieLog/new-key' }))
}))

// Deterministic getRating: calculatedTotal = explicit value, else `overall`,
// else 5. Spreads the rating through so weightedTotal sees the raw criteria.
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((media) => {
    const r = (media?.ratings && media.ratings[0]) || {}
    const calculatedTotal = r.calculatedTotal != null
      ? r.calculatedTotal
      : (r.overall != null ? Number(r.overall) : 5)
    return { ...r, calculatedTotal }
  }),
  getAllRatings: vi.fn(() => [])
}))

vi.mock('@/services/ErrorLogService.js', () => ({
  default: { error: vi.fn() }
}))

const WEIGHTS = [
  { name: 'love', weight: 2.8 },
  { name: 'overall', weight: 2 },
  { name: 'story', weight: 1.25 },
  { name: 'direction', weight: 1.1 },
  { name: 'imagery', weight: 0.9 },
  { name: 'stickiness', weight: 1.9 },
  { name: 'performance', weight: 0.7 },
  { name: 'soundtrack', weight: 0.3 }
]

function ratedMovie (id, title, calculatedTotal, date) {
  return {
    movie: { id, title, release_date: '2020-01-01', poster_path: `/p${id}.jpg`, backdrop_path: `/b${id}.jpg` },
    ratings: [{ calculatedTotal, date: date || Date.now() }],
    dbKey: `key-${id}`
  }
}

describe('RateMovie', () => {
  let wrapper
  let mockStore
  let pushSpy

  const library = [
    ratedMovie(101, 'Nine Movie', 9),
    ratedMovie(102, 'Eight Movie', 8),
    ratedMovie(103, 'Six Movie', 6),
    ratedMovie(104, 'Four Movie', 4)
  ]

  beforeEach(async () => {
    pushSpy = vi.fn()
    mockStore = {
      state: {
        movieLog: {},
        movieToRate: {
          id: 555,
          title: 'Movie Under Test',
          release_date: '2021-07-15',
          poster_path: '/under-test.jpg',
          backdrop_path: '/under-test-backdrop.jpg'
        },
        settings: {
          tags: {
            'viewing-tags': {
              t1: { title: 'date-night' },
              t2: { title: 'rewatch' }
            }
          }
        },
        weights: WEIGHTS,
        databaseTopKey: 'test-user'
      },
      getters: { allMoviesAsArray: library },
      commit: vi.fn(),
      dispatch: vi.fn()
    }

    wrapper = shallowMount(RateMovie, {
      global: {
        mocks: {
          $store: mockStore,
          $route: { query: {} },
          $router: { push: pushSpy }
        },
        stubs: { Modal: true, ToggleableRating: true, StickinessInline: true }
      }
    })

    await wrapper.vm.$nextTick()
  })

  describe('rating math', () => {
    it('maps the store weights array into a name→weight lookup', () => {
      expect(wrapper.vm.weights).toEqual({
        love: 2.8,
        overall: 2,
        story: 1.25,
        direction: 1.1,
        imagery: 0.9,
        stickiness: 1.9,
        performance: 0.7,
        soundtrack: 0.3
      })
    })

    it('computes weightedTotal as the sum of each criterion times its weight', async () => {
      await wrapper.setData({
        love: 9,
        overall: 8,
        story: 7,
        direction: 8,
        imagery: 7,
        stickiness: 6,
        performance: 6,
        soundtrack: 5
      })
      // 9*2.8 + 8*2 + 7*1.25 + 8*1.1 + 7*0.9 + 6*1.9 + 6*0.7 + 5*0.3
      expect(wrapper.vm.weightedTotal).toBeCloseTo(82.15, 5)
    })

    it('defaults unset criteria to 5 in the rating computed', () => {
      // No criteria set → each parseFloat-defaulted field is 5.
      expect(wrapper.vm.rating.overall).toBe(5)
      expect(wrapper.vm.rating.love).toBe(5)
    })
  })

  describe('helpers', () => {
    it('movieYear extracts the release year', () => {
      expect(wrapper.vm.movieYear({ release_date: '1999-03-31' })).toBe(1999)
    })

    it('mostRecentRating picks the latest rating by date', () => {
      const movie = {
        ratings: [
          { calculatedTotal: 7, date: new Date('2021-01-01').getTime() },
          { calculatedTotal: 9, date: new Date('2023-06-01').getTime() },
          { calculatedTotal: 8, date: new Date('2022-01-01').getTime() }
        ]
      }
      expect(wrapper.vm.mostRecentRating(movie).calculatedTotal).toBe(9)
    })

    it('mostRecentRating returns null for an unrated movie', () => {
      expect(wrapper.vm.mostRecentRating({ ratings: [] })).toBeNull()
    })

    it('posterUrl prefers a custom poster path over the movie default', () => {
      const movie = { poster_path: '/default.jpg' }
      expect(wrapper.vm.posterUrl(movie, {})).toContain('/default.jpg')
      expect(wrapper.vm.posterUrl(movie, { customPosterPath: '/custom.jpg' })).toContain('/custom.jpg')
    })

    it('rateBannerUrl prefers the previous entry custom backdrop', () => {
      // No previous entry for id 555 → uses movieToRate.backdrop_path.
      expect(wrapper.vm.rateBannerUrl).toContain('/under-test-backdrop.jpg')
    })
  })

  describe('ranking', () => {
    it('sortByRating orders highest calculatedTotal first', () => {
      const arr = [ratedMovie(1, 'a', 5), ratedMovie(2, 'b', 9), ratedMovie(3, 'c', 7)]
      arr.sort(wrapper.vm.sortByRating)
      expect(arr.map((m) => m.ratings[0].calculatedTotal)).toEqual([9, 7, 5])
    })

    it('indexIfSortedIntoArray returns the insertion position', () => {
      const ranked = [...library].sort(wrapper.vm.sortByRating) // 9,8,6,4
      const incoming = ratedMovie(999, 'Seven Movie', 7)
      // 9,8,[7],6,4 → index 2
      expect(wrapper.vm.indexIfSortedIntoArray(incoming, ranked)).toBe(2)
    })

    it('exposes the correct neighbors around the movie being rated', async () => {
      // Current movie rates to 7 (via overall), landing between 8 and 6.
      await wrapper.setData({ overall: 7 })
      expect(wrapper.vm.movieIndex).toBe(2)
      expect(wrapper.vm.neighborAhead.movie.title).toBe('Eight Movie')
      expect(wrapper.vm.neighborTwoAhead.movie.title).toBe('Nine Movie')
      expect(wrapper.vm.neighborBehind.movie.title).toBe('Six Movie')
      expect(wrapper.vm.neighborTwoBehind.movie.title).toBe('Four Movie')
    })
  })

  describe('viewing tags', () => {
    it('toggleViewingTag adds then removes a tag', () => {
      const tag = { title: 'date-night' }
      expect(wrapper.vm.viewingTagChecked(tag)).toBe(false)
      wrapper.vm.toggleViewingTag(tag)
      expect(wrapper.vm.viewingTagChecked(tag)).toBe(true)
      expect(wrapper.vm.selectedViewingTagNames).toContain('date-night')
      wrapper.vm.toggleViewingTag(tag)
      expect(wrapper.vm.viewingTagChecked(tag)).toBe(false)
    })
  })

  describe('returnHome', () => {
    it('requests the just-rated movie as the home banner and routes home', () => {
      wrapper.vm.id = 555
      wrapper.vm.returnHome()

      expect(mockStore.commit).toHaveBeenCalledWith('setBannerRequest', { type: 'movie', movieId: 555 })
      expect(mockStore.commit).toHaveBeenCalledWith('setShowHeader', true)
      expect(pushSpy).toHaveBeenCalled()
      expect(pushSpy.mock.calls[0][0].path).toBe('/')
    })
  })
})

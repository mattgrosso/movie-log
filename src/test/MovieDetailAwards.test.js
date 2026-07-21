import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import MovieDetail from '@/components/MovieDetail.vue'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} }))
  }
}))

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 5, normalizedRating: 5 })),
  getAllRatings: vi.fn(() => [])
}))

vi.mock('@/services/ErrorLogService.js', () => ({ default: { error: vi.fn() } }))

function makeResult (overrides = {}) {
  return {
    dbKey: 'abc123',
    movie: {
      id: 42,
      title: 'Oppenheimer',
      release_date: '2023-07-19',
      runtime: 180,
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      genres: [],
      crew: [],
      ...overrides.movie
    },
    ratings: [{ calculatedTotal: 8.5, normalizedRating: 8, date: Date.now() }],
    ...overrides
  }
}

describe('MovieDetail - awards sections', () => {
  let wrapper
  let mockStore
  let pushSpy
  let dispatchSpy

  function mountWithSettings (settings) {
    pushSpy = vi.fn()
    dispatchSpy = vi.fn(() => Promise.resolve())
    mockStore = {
      state: {
        movieLog: {},
        settings,
        academyAwardWinners: {}
      },
      getters: { allMoviesAsArray: [], allMediaAsArray: [] },
      commit: vi.fn(),
      dispatch: dispatchSpy
    }

    return shallowMount(MovieDetail, {
      global: {
        mocks: {
          $store: mockStore,
          $route: { params: { tmdbId: '42' }, query: {} },
          $router: { push: pushSpy }
        },
        stubs: { ToggleableRating: true, Modal: true }
      }
    })
  }

  describe('personal awards (settings.personalAwards)', () => {
    beforeEach(async () => {
      wrapper = mountWithSettings({
        tags: { 'viewing-tags': {} },
        personalAwards: {
          2023: {
            categories: {
              bestPicture: {
                winner: { type: 'movie', movieId: 42 },
                nominees: [{ type: 'movie', movieId: 42 }, { type: 'movie', movieId: 99 }]
              },
              bestActor: {
                winner: null,
                nominees: [{ type: 'person', id: 'p1', name: 'Cillian Murphy', movieId: 42 }]
              },
              bestDirector: {
                winner: { type: 'person', id: 'd1', name: 'Someone Else', movieId: 7 },
                nominees: [{ type: 'person', id: 'd1', name: 'Someone Else', movieId: 7 }]
              }
            }
          }
        }
      })
      await wrapper.setData({ result: makeResult(), movie: makeResult().movie })
    })

    it('classifies a movieId match on the winner as a win', () => {
      expect(wrapper.vm.personalAwardWins).toEqual([
        { id: '2023-bestPicture', year: '2023', category: 'Best Picture', names: null }
      ])
    })

    it('classifies a movieId match in nominees (but not winner) as a nomination, carrying the nominee name', () => {
      expect(wrapper.vm.personalAwardNominations).toEqual([
        { id: '2023-bestActor', year: '2023', category: 'Best Actor', names: ['Cillian Murphy'] }
      ])
    })

    it('does not surface categories for a different movie', () => {
      const allIds = [...wrapper.vm.personalAwardWins, ...wrapper.vm.personalAwardNominations].map((a) => a.id)
      expect(allIds).not.toContain('2023-bestDirector')
    })

    it('openPersonalAwardsYear sets the daily-awards-year settings and navigates home', async () => {
      await wrapper.vm.openPersonalAwardsYear('2023')

      expect(dispatchSpy).toHaveBeenCalledWith('setDBValue', { path: 'settings/dailyAwardsYear', value: 2023 })
      expect(dispatchSpy).toHaveBeenCalledWith('setDBValue', { path: 'settings/awardsPromptState', value: 'forced' })
      expect(pushSpy).toHaveBeenCalledWith({ name: 'Home' })
    })
  })

  describe('other-ceremony awards (assets/javascript/otherAwards.js)', () => {
    beforeEach(async () => {
      wrapper = mountWithSettings({ tags: { 'viewing-tags': {} } })
      await wrapper.setData({ result: makeResult(), movie: makeResult().movie })
    })

    it('surfaces the real Golden Globe + BAFTA wins bundled in the static dataset for a known film', () => {
      const wins = wrapper.vm.otherAwardWins
      expect(wins.some((w) => w.ceremony === 'Golden Globe Awards')).toBe(true)
      expect(wins.some((w) => w.ceremony === 'BAFTA Awards')).toBe(true)
    })

    it('returns nothing for a movie absent from the static dataset', async () => {
      await wrapper.setData({ movie: { ...wrapper.vm.movie, title: 'Definitely Not A Real Award Movie Title', id: 999 } })
      expect(wrapper.vm.otherAwardWins).toEqual([])
      expect(wrapper.vm.otherAwardNominations).toEqual([])
    })
  })
})

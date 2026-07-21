import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import MovieDetail from '@/components/MovieDetail.vue'
import axios from 'axios'

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

  describe('personalAwardSectionName — uses the configured award name', () => {
    it('defaults to "Oscar" when unset', () => {
      wrapper = mountWithSettings({ tags: { 'viewing-tags': {} } })
      expect(wrapper.vm.personalAwardSectionName).toBe('Oscar')
    })

    it('reflects a custom configured name, stripped of a leading "The"', () => {
      wrapper = mountWithSettings({ tags: { 'viewing-tags': {} }, personalAwardName: 'The Groskers' })
      expect(wrapper.vm.personalAwardSectionName).toBe('Groskers')
    })
  })

  describe('totalAwardsCount', () => {
    it('sums wins + nominations across all three award groups', async () => {
      wrapper = mountWithSettings({
        tags: { 'viewing-tags': {} },
        personalAwards: {
          2023: {
            categories: {
              bestPicture: { winner: { type: 'movie', movieId: 42 }, nominees: [{ type: 'movie', movieId: 42 }] }
            }
          }
        }
      })
      await wrapper.setData({ result: makeResult(), movie: makeResult().movie, awardsData: [{ id: 1, category: 'Best Original Score', isActing: false, isWinner: true }] })

      const expected = wrapper.vm.personalAwardWins.length + wrapper.vm.personalAwardNominations.length +
        wrapper.vm.academyAwardWins.length + wrapper.vm.academyAwardNominations.length +
        wrapper.vm.otherAwardWins.length + wrapper.vm.otherAwardNominations.length
      expect(wrapper.vm.totalAwardsCount).toBe(expected)
      expect(wrapper.vm.totalAwardsCount).toBeGreaterThan(0)
    })
  })

  describe('goToWikipedia', () => {
    let openSpy

    beforeEach(async () => {
      wrapper = mountWithSettings({ tags: { 'viewing-tags': {} } })
      await wrapper.setData({ result: makeResult(), movie: makeResult().movie })
      openSpy = vi.spyOn(window, 'open').mockImplementation(() => {})
    })

    afterEach(() => {
      openSpy.mockRestore()
    })

    it('routes through Wikipedia\'s search "go" endpoint rather than a raw /wiki/ page URL', () => {
      wrapper.vm.goToWikipedia('81st Golden Globe Awards')
      expect(openSpy).toHaveBeenCalledWith(
        'https://en.wikipedia.org/wiki/Special:Search?search=81st%20Golden%20Globe%20Awards&go=Go',
        '_blank'
      )
    })

    it('falls back to the movie title when no query is given', () => {
      wrapper.vm.goToWikipedia()
      expect(openSpy).toHaveBeenCalledWith(
        'https://en.wikipedia.org/wiki/Special:Search?search=Oppenheimer&go=Go',
        '_blank'
      )
    })
  })

  describe('Awards section — collapsed by default', () => {
    it('starts collapsed and toggles open on click', async () => {
      wrapper = mountWithSettings({
        tags: { 'viewing-tags': {} },
        personalAwards: {
          2023: { categories: { bestPicture: { winner: { type: 'movie', movieId: 42 }, nominees: [] } } }
        }
      })
      await wrapper.setData({ result: makeResult(), movie: makeResult().movie })

      expect(wrapper.vm.isAwardsExpanded).toBe(false)
      expect(wrapper.find('.awards-body').exists()).toBe(false)

      await wrapper.find('.awards .section-toggle').trigger('click')

      expect(wrapper.vm.isAwardsExpanded).toBe(true)
      expect(wrapper.find('.awards-body').exists()).toBe(true)
    })
  })

  describe('Rating Shape section — collapsed by default', () => {
    it('starts collapsed and toggles open on click, only rendering the chart once expanded', async () => {
      wrapper = mountWithSettings({ tags: { 'viewing-tags': {} } })
      await wrapper.setData({ result: makeResult(), movie: makeResult().movie })

      expect(wrapper.vm.isRatingShapeExpanded).toBe(false)
      expect(wrapper.find('.radar-chart-wrapper').exists()).toBe(false)

      await wrapper.find('.rating-radar .section-toggle').trigger('click')

      expect(wrapper.vm.isRatingShapeExpanded).toBe(true)
      expect(wrapper.find('.radar-chart-wrapper').exists()).toBe(true)
    })
  })

  describe('loadMovieData does not leak Academy Award data across movies', () => {
    // Regression test: MovieDetail's component instance is REUSED (not
    // remounted) when navigating from one movie's page directly to
    // another's via router params — found while manually verifying the new
    // awards sections in the browser, where the "Other Ceremonies"/"My
    // Awards" work made the pre-existing bug obvious (the second movie kept
    // showing the FIRST movie's Academy Award wins/nominations).
    it('refetches and replaces awardsData when the route moves to a different movie', async () => {
      const movieA = { id: 42, title: 'Oppenheimer', release_date: '2023-07-19', runtime: 180, poster_path: '/a.jpg', genres: [], crew: [] };
      const movieB = { id: 99, title: 'Some Other Film', release_date: '2010-01-01', runtime: 100, poster_path: '/b.jpg', genres: [], crew: [] };

      axios.get.mockImplementation((url) => {
        if (url.includes('/awards/tmdb/42')) {
          return Promise.resolve({ data: [{ id: 1, category: 'Best Original Score', isActing: '0', isWinner: '1' }] });
        }
        if (url.includes('/awards/tmdb/99')) {
          return Promise.resolve({ data: [{ id: 2, category: 'Best Original Screenplay', isActing: '0', isWinner: '1' }] });
        }
        return Promise.resolve({ data: [] });
      });

      const mockStore = {
        state: { movieLog: {}, settings: { tags: { 'viewing-tags': {} } }, academyAwardWinners: {}, dbLoaded: true },
        getters: { allMediaAsArray: [{ dbKey: 'a', movie: movieA, ratings: [] }, { dbKey: 'b', movie: movieB, ratings: [] }] },
        commit: vi.fn(),
        dispatch: vi.fn()
      };

      const wrapper = shallowMount(MovieDetail, {
        global: {
          mocks: {
            $store: mockStore,
            $route: { params: { tmdbId: '42' }, query: {} },
            $router: { push: vi.fn() }
          },
          stubs: { ToggleableRating: true, Modal: true }
        }
      });

      await wrapper.vm.loadMovieData('42');
      expect(wrapper.vm.academyAwardWins.map((a) => a.category)).toEqual(['Best Original Score']);

      await wrapper.vm.loadMovieData('99');
      expect(wrapper.vm.academyAwardWins.map((a) => a.category)).toEqual(['Best Original Screenplay']);
    });
  });
})

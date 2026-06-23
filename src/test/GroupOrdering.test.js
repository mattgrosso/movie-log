import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Home from '@/components/Home.vue'

vi.mock('axios', () => ({
  default: { get: vi.fn() }
}))

vi.mock('lodash/debounce', () => ({
  default: vi.fn((fn) => fn)
}))

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 8.25, normalizedRating: 8 })),
  getAllRatings: vi.fn(() => [])
}))

// A movie that matches BOTH a title search and a keyword search for "star wars".
// Which group it lands in depends entirely on the group hierarchy order.
const makeMovies = () => ([
  {
    movie: {
      id: 1,
      title: 'Star Wars',
      release_date: '1977-05-25',
      genres: [{ name: 'Science Fiction' }],
      cast: [{ name: 'Mark Hamill' }],
      crew: [{ name: 'George Lucas', job: 'Director' }],
      production_companies: [{ name: 'Lucasfilm' }],
      // keywords (original TMDb casing) — flatKeywords is rebuilt from these
      keywords: [{ name: 'Star Wars' }, { name: 'space opera' }]
    },
    ratings: [{ calculatedTotal: 9.0, date: '2023-01-01' }],
    dbKey: 'movie-1'
  },
  {
    movie: {
      id: 2,
      title: 'The Empire Strikes Back',
      release_date: '1980-05-21',
      genres: [{ name: 'Science Fiction' }],
      cast: [{ name: 'Mark Hamill' }],
      crew: [{ name: 'Irvin Kershner', job: 'Director' }],
      production_companies: [{ name: 'Lucasfilm' }],
      keywords: [{ name: 'Star Wars' }, { name: 'rebellion' }]
    },
    ratings: [{ calculatedTotal: 9.5, date: '2023-02-01' }],
    dbKey: 'movie-2'
  }
])

const mountHome = (settings = {}) => {
  const mockMovies = makeMovies()
  const mockStore = {
    state: reactive({
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: { bestPicture: [] },
      settings: {
        normalizationTweak: 0.25,
        tieBreakTweak: 1,
        includeShorts: false,
        tags: { 'viewing-tags': {} },
        ...settings
      },
      filteredResults: [],
      homePageScrollPosition: 0,
      homePageSearchChips: [],
      homePageSearchValue: '',
      homePageNumberOfResults: 25,
      homePageNavigationIntent: null,
      homePageSortValue: null,
      homePageSortOrder: null,
      homePagePromoteGroup: null
    }),
    getters: {
      allMediaAsArray: mockMovies,
      allMoviesAsArray: mockMovies,
      allMediaSortedByRating: [...mockMovies].sort((a, b) => b.ratings[0].calculatedTotal - a.ratings[0].calculatedTotal)
    },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  const wrapper = mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: {
        DBGridLayoutSearchResult: {
          template: '<div data-testid="db-grid-result">{{ result.movie.title }}</div>',
          props: ['result', 'keywordCounts', 'allCounts', 'index', 'resultsAreFiltered', 'sortValue', 'activeQuickLinkList']
        },
        NoResults: true,
        StickinessModal: true,
        TweakModal: true,
        InsetBrowserModal: true
      }
    }
  })

  return { wrapper, mockStore }
}

describe('Grouped result hierarchy ordering', () => {
  let wrapper
  let mockStore

  beforeEach(async () => {
    ({ wrapper, mockStore } = mountHome())
    // Simulate a search for "star wars"
    wrapper.vm.searchValue = 'star wars'
    await wrapper.vm.$nextTick()
  })

  describe('default order', () => {
    it('splits movies into Title vs Keyword groups by default priority', () => {
      const groups = wrapper.vm.groupedByAllCategories
      const title = groups.find(g => g.category === 'title')
      const keyword = groups.find(g => g.category === 'keyword-genre')
      // "Star Wars" matches by title; "The Empire Strikes Back" only by keyword.
      expect(title.movies.map(m => m.movie.id)).toEqual([1])
      expect(keyword.movies.map(m => m.movie.id)).toEqual([2])
      // Title appears before Keywords at default order
      expect(groups.indexOf(title)).toBeLessThan(groups.indexOf(keyword))
    })

    it('groupOrder returns the default when no override is saved', () => {
      expect(wrapper.vm.groupOrder[0]).toBe('title')
      expect(wrapper.vm.groupOrder).toContain('keyword-genre')
    })
  })

  describe('manual reordering', () => {
    it('persists a daily override when moving a group', () => {
      // Move keyword-genre up. With only title+keyword present, this swaps them.
      wrapper.vm.moveGroupUp('keyword-genre')
      expect(mockStore.dispatch).toHaveBeenCalledWith('setDBValue', expect.objectContaining({
        path: 'settings/groupOrderOverride',
        value: expect.objectContaining({
          order: expect.any(Array),
          date: new Date().toDateString()
        })
      }))
    })

    it('moving a present group swaps it within the full master order', () => {
      // Present groups for this search are title then keyword-genre.
      // moveGroupUp on keyword-genre should put it before title in the master order.
      wrapper.vm.moveGroupUp('keyword-genre')
      const saved = mockStore.dispatch.mock.calls.at(-1)[1].value.order
      expect(saved.indexOf('keyword-genre')).toBeLessThan(saved.indexOf('title'))
      // Other master keys are preserved
      expect(saved).toContain('director')
      expect(saved).toContain('other')
    })

    it('re-evaluates groups after a reorder so dual-match movies move groups', async () => {
      // Make the commit mock apply setSettings like the real mutation, so the
      // optimistic local update in persistGroupOrder is reflected reactively.
      mockStore.commit.mockImplementation((mutation, value) => {
        if (mutation === 'setSettings') {
          mockStore.state.settings = value
        }
      })

      // Before: "Star Wars" (id 1) is in Title (default order)
      let groups = wrapper.vm.groupedByAllCategories
      expect(groups.find(g => g.category === 'title').movies.map(m => m.movie.id)).toContain(1)

      // Promote Keywords above Title
      wrapper.vm.moveGroupUp('keyword-genre')
      await wrapper.vm.$nextTick()

      // After: "Star Wars" should now be claimed by Keywords, not Title
      groups = wrapper.vm.groupedByAllCategories
      const keyword = groups.find(g => g.category === 'keyword-genre')
      const title = groups.find(g => g.category === 'title')
      expect(keyword.movies.map(m => m.movie.id)).toContain(1)
      expect(title ? title.movies.map(m => m.movie.id) : []).not.toContain(1)
    })
  })

  describe('reorderable groups panel list', () => {
    it('lists groups that could be shown, not just currently-rendered ones', async () => {
      mockStore.commit.mockImplementation((mutation, value) => {
        if (mutation === 'setSettings') mockStore.state.settings = value
      })

      // Default order: title=[1], keyword-genre=[2]; both present.
      const keys = wrapper.vm.reorderableGroups.map(g => g.category)
      expect(keys).toContain('title')
      expect(keys).toContain('keyword-genre')

      // Promote keyword above title — keyword now claims movie 1 too, emptying title.
      wrapper.vm.moveGroupUp('keyword-genre')
      await wrapper.vm.$nextTick()

      // Title is now empty in the rendered grid...
      const rendered = wrapper.vm.groupedByAllCategories.find(g => g.category === 'title')
      expect(rendered).toBeFalsy()

      // ...but it MUST still appear in the panel (with count 0) so it's recoverable.
      const panel = wrapper.vm.reorderableGroups
      const titleRow = panel.find(g => g.category === 'title')
      expect(titleRow).toBeTruthy()
      expect(titleRow.count).toBe(0)
      // keyword-genre is now first in the panel
      expect(panel[0].category).toBe('keyword-genre')
    })

    it('orders the panel list by the active group order', () => {
      const keys = wrapper.vm.reorderableGroups.map(g => g.category)
      // title precedes keyword-genre at default order
      expect(keys.indexOf('title')).toBeLessThan(keys.indexOf('keyword-genre'))
    })
  })

  describe('day-based expiry', () => {
    it('uses an override saved today', () => {
      const order = ['keyword-genre', 'title']
      const { wrapper: w } = mountHome({
        groupOrderOverride: { order, date: new Date().toDateString() }
      })
      expect(w.vm.groupOrder[0]).toBe('keyword-genre')
    })

    it('ignores an override saved on a previous day', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()
      const { wrapper: w } = mountHome({
        groupOrderOverride: { order: ['keyword-genre', 'title'], date: yesterday }
      })
      // Reverts to default
      expect(w.vm.groupOrder[0]).toBe('title')
    })

    it('appends missing master keys to a partial saved order', () => {
      const { wrapper: w } = mountHome({
        groupOrderOverride: { order: ['keyword-genre', 'title'], date: new Date().toDateString() }
      })
      // Saved keys come first, in saved order
      expect(w.vm.groupOrder.slice(0, 2)).toEqual(['keyword-genre', 'title'])
      // Every default key is still present
      expect(w.vm.groupOrder).toContain('director')
      expect(w.vm.groupOrder).toContain('company')
      expect(w.vm.groupOrder).toContain('other')
    })
  })
})

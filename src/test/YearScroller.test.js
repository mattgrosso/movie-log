import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Home from '@/components/Home.vue'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }))
vi.mock('lodash/uniq', () => ({ default: vi.fn((arr) => [...new Set(arr)]) }))
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((m) => ({ calculatedTotal: m?.ratings?.[0]?.calculatedTotal ?? 8, normalizedRating: 8, date: m?.ratings?.[0]?.date })),
  getAllRatings: vi.fn(() => [])
}))

// Four distinct release years, one movie each, plus a fifth movie sharing
// 2010 with the first — gives availableYears = [2020, 2015, 2010, 2005]
// which the scroller renders ascending, and a non-trivial "2010" result count to check filtering
// actually still works through the scroller. "Movie 2010 A" is also given
// a Crime genre so a year+genre combined-filter case has something real to
// narrow down to (mirrors the follow-up feature request's own example:
// "1972 and also... crime").
const makeMovies = () => ([
  {
    movie: { id: 1, title: 'Movie 2005', release_date: '2005-06-15', genres: [], cast: [], crew: [], production_companies: [], keywords: [] },
    ratings: [{ calculatedTotal: 8, date: '2023-01-01' }], dbKey: 'm-1'
  },
  {
    movie: { id: 2, title: 'Movie 2010 A', release_date: '2010-06-15', genres: [{ name: 'Crime' }], cast: [], crew: [], production_companies: [], keywords: [] },
    ratings: [{ calculatedTotal: 8, date: '2023-01-01' }], dbKey: 'm-2'
  },
  {
    movie: { id: 3, title: 'Movie 2010 B', release_date: '2010-09-01', genres: [], cast: [], crew: [], production_companies: [], keywords: [] },
    ratings: [{ calculatedTotal: 8, date: '2023-01-01' }], dbKey: 'm-3'
  },
  {
    movie: { id: 4, title: 'Movie 2015', release_date: '2015-06-15', genres: [{ name: 'Crime' }], cast: [], crew: [], production_companies: [], keywords: [] },
    ratings: [{ calculatedTotal: 8, date: '2023-01-01' }], dbKey: 'm-4'
  },
  {
    movie: { id: 5, title: 'Movie 2020', release_date: '2020-06-15', genres: [], cast: [], crew: [], production_companies: [], keywords: [] },
    ratings: [{ calculatedTotal: 8, date: '2023-01-01' }], dbKey: 'm-5'
  }
])

function mountHome () {
  const movies = makeMovies()
  const mockStore = {
    state: reactive({
      dbLoaded: true, databaseTopKey: 'test-user', currentLog: 'movieLog',
      DBSearchValue: '', DBSortValue: 'rating', academyAwardWinners: {},
      settings: { normalizationTweak: 0.25, tieBreakTweak: 1, includeShorts: false, tags: { 'viewing-tags': {} } },
      bannerUrl: null, bannerRequest: null, filteredResults: [],
      homePageScrollPosition: 0, homePageSearchChips: [], homePageSearchValue: '',
      homePageNumberOfResults: 25, homePageNavigationIntent: null,
      homePageSortValue: null, homePageSortOrder: null, homePagePromoteGroup: null
    }),
    getters: { allMediaAsArray: movies, allMoviesAsArray: movies, allMediaSortedByRating: movies },
    commit: vi.fn(), dispatch: vi.fn()
  }
  const wrapper = mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: { DBGridLayoutSearchResult: true, NoResults: true, StickinessModal: true, TweakModal: true, InsetBrowserModal: true }
    }
  })
  return { wrapper, movies }
}

describe('Year-scroller special case (feature request: "instead of showing all the chips across the bottom... lets me quickly travel between years")', () => {
  let wrapper

  beforeEach(() => {
    ({ wrapper } = mountHome())
  })

  it('is inactive with no chips at all', async () => {
    expect(wrapper.vm.hasActiveYearChip).toBe(false)
    expect(wrapper.find('.year-scroller').exists()).toBe(false)
  })

  it('replaces the normal chip badge with the year-scroller for a lone year chip', async () => {
    wrapper.vm.activeFilters = [{ id: 'year-1', type: 'year', value: '2010', display: '2010' }]
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.hasActiveYearChip).toBe(true)
    expect(wrapper.vm.activeYearChipValue).toBe(2010)
    expect(wrapper.find('.year-scroller').exists()).toBe(true)
    // The normal badge row for the year chip itself is gone (scoped to
    // the chip row itself — the Quick Links panel elsewhere on the page
    // also uses .text-bg-secondary for an unrelated purpose).
    expect(wrapper.find('.active-filters-section .badge.text-bg-secondary').exists()).toBe(false)
  })

  // Bug report: "I want the years to go ascending to the right... the next
  // year should be to the right of the current year." The scroller reads
  // left-to-right like a timeline; the "Add Filter" Year <select> keeps its
  // own newest-first order (see availableYearsAscending).
  it('lists every distinct year present in the library, ASCENDING, with the active one highlighted', async () => {
    wrapper.vm.activeFilters = [{ id: 'year-1', type: 'year', value: '2010', display: '2010' }]
    await wrapper.vm.$nextTick()

    const pills = wrapper.findAll('.year-scroller-pill')
    expect(pills.map((p) => p.text())).toEqual(['2005', '2010', '2015', '2020'])

    const activePill = pills.find((p) => p.text() === '2010')
    expect(activePill.classes()).toContain('btn-primary')
    pills.filter((p) => p.text() !== '2010').forEach((p) => {
      expect(p.classes()).toContain('btn-outline-secondary')
    })
  })

  it('leaves the "Add Filter" year dropdown newest-first, unlike the scroller', async () => {
    // Same source list, two different display orders on purpose - a picker
    // wants the most likely (recent) year first, a timeline reads L-to-R.
    expect(wrapper.vm.availableYears).toEqual([2020, 2015, 2010, 2005])
    expect(wrapper.vm.availableYearsAscending).toEqual([2005, 2010, 2015, 2020])
  })

  it('tapping a different year pill replaces the chip and updates the filtered results', async () => {
    wrapper.vm.activeFilters = [{ id: 'year-1', type: 'year', value: '2010', display: '2010' }]
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.paginatedSortedResults.length).toBe(2) // the two 2010 movies

    const pills = wrapper.findAll('.year-scroller-pill')
    await pills.find((p) => p.text() === '2015').trigger('click')

    expect(wrapper.vm.activeFilters).toHaveLength(1)
    expect(wrapper.vm.activeFilters[0]).toMatchObject({ type: 'year', value: '2015', display: '2015' })
    expect(wrapper.vm.paginatedSortedResults.length).toBe(1) // just Movie 2015
  })

  it('shows the scroller AND the other chip as a normal badge when a year is combined with another filter (follow-up: "I do want it to also be able to work with other filters")', async () => {
    wrapper.vm.activeFilters = [
      { id: 'year-1', type: 'year', value: '2010', display: '2010' },
      { id: 'genre-1', type: 'genre', value: 'Crime', display: 'Crime' }
    ]
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.hasActiveYearChip).toBe(true)
    expect(wrapper.find('.year-scroller').exists()).toBe(true)
    // Only the year chip is absorbed into the scroller — the genre chip
    // still renders as a normal badge.
    expect(wrapper.vm.otherActiveFilters).toEqual([{ id: 'genre-1', type: 'genre', value: 'Crime', display: 'Crime' }])
    const badge = wrapper.find('.active-filters-section .badge.text-bg-secondary')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Crime')
    // Both filters actually apply together (AND logic): only "Movie 2010 A"
    // is both 2010 AND Crime.
    expect(wrapper.vm.paginatedSortedResults.length).toBe(1)
    expect(wrapper.vm.paginatedSortedResults[0].movie.title).toBe('Movie 2010 A')

    // Tapping a different year keeps the genre chip intact rather than
    // clearing it.
    await wrapper.findAll('.year-scroller-pill').find((p) => p.text() === '2015').trigger('click')
    expect(wrapper.vm.activeFilters).toHaveLength(2)
    expect(wrapper.vm.activeFilters.find((f) => f.type === 'genre')).toMatchObject({ value: 'Crime' })
    expect(wrapper.vm.paginatedSortedResults.length).toBe(1)
    expect(wrapper.vm.paginatedSortedResults[0].movie.title).toBe('Movie 2015')
  })

  it('the scroller and other-chip badges appear on separate rows (scroller is full-width, badges wrap onto the line after it)', async () => {
    wrapper.vm.activeFilters = [
      { id: 'year-1', type: 'year', value: '2010', display: '2010' },
      { id: 'genre-1', type: 'genre', value: 'Crime', display: 'Crime' }
    ]
    await wrapper.vm.$nextTick()

    const html = wrapper.html()
    // The scroller comes before the other-filter badge in DOM order —
    // combined with .year-scroller's flex-basis: 100% (CSS, not
    // assertable directly here), that's what puts the badge on the row
    // below it rather than beside it.
    expect(html.indexOf('year-scroller')).toBeLessThan(html.indexOf('Crime'))
  })

  it('does NOT activate for a non-year chip, or for a yearRange (decade) chip', async () => {
    wrapper.vm.activeFilters = [{ id: 'director-1', type: 'director', value: 'Nolan', display: 'Nolan' }]
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.hasActiveYearChip).toBe(false)
    expect(wrapper.vm.otherActiveFilters).toEqual(wrapper.vm.activeFiltersMinusTemps)

    wrapper.vm.activeFilters = [{ id: 'yr-1', type: 'yearRange', value: { startYear: '2010', endYear: '2019' }, display: '2010s' }]
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.hasActiveYearChip).toBe(false)
    expect(wrapper.find('.year-scroller').exists()).toBe(false)
  })

  it('centers the newly-active pill into view whenever the active year changes (watched via activeYearChipValue)', async () => {
    // jsdom doesn't implement scrollIntoView at all by default (spyOn
    // requires the property to already exist) — define a no-op first,
    // then spy on it, so it's present (and observable) on every pill
    // however Vue happens to render/reuse the underlying DOM nodes across
    // updates.
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {}
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})

    // Same documented pattern as FuzzySuggestions.test.js: a state update
    // made inside a watcher's own nested $nextTick callback needs a THIRD
    // await beyond the two you'd naively expect — one for the watcher to
    // fire, one for its nested callback to run, one more for the DOM to
    // reflect anything that callback touched.
    wrapper.vm.activeFilters = [{ id: 'year-1', type: 'year', value: '2010', display: '2010' }]
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(scrollIntoView).toHaveBeenCalledWith({ inline: 'center', block: 'nearest' })
    // Called on the pill that's actually active (2010), not just any pill.
    const activeEl = wrapper.findAll('.year-scroller-pill').find((p) => p.text() === '2010').element
    expect(scrollIntoView.mock.instances[scrollIntoView.mock.instances.length - 1]).toBe(activeEl)

    scrollIntoView.mockClear()
    await wrapper.findAll('.year-scroller-pill').find((p) => p.text() === '2015').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(scrollIntoView).toHaveBeenCalledWith({ inline: 'center', block: 'nearest' })
    const newActiveEl = wrapper.findAll('.year-scroller-pill').find((p) => p.text() === '2015').element
    expect(scrollIntoView.mock.instances[scrollIntoView.mock.instances.length - 1]).toBe(newActiveEl)

    scrollIntoView.mockRestore()
  })
})

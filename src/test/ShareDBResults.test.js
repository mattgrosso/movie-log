import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { get } from 'firebase/database'
import ShareDBResults from '@/components/ShareDBResults.vue'

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn(() => 'ref'),
  child: vi.fn(() => 'child-ref'),
  get: vi.fn()
}))

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((result) => result.ratings && result.ratings[0])
}))

function result (id, overrides = {}) {
  return {
    movie: {
      id,
      title: `Movie ${id}`,
      release_date: '2010-01-01',
      poster_path: '/p.jpg',
      backdrop_path: '/b.jpg'
    },
    ratings: [{ calculatedTotal: id }],
    ...overrides
  }
}

function factory ({ routeParams = { userDBKey: 'user-1', shareKey: 'share-1' } } = {}) {
  const commit = vi.fn()
  const wrapper = mount(ShareDBResults, {
    global: {
      mocks: {
        $store: { commit },
        $route: { params: routeParams }
      }
    }
  })
  return { wrapper, commit }
}

describe('ShareDBResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hides the global header on mount and restores it on beforeRouteLeave', async () => {
    get.mockResolvedValue({ exists: () => false })
    const { wrapper, commit } = factory()
    await wrapper.vm.$nextTick()

    expect(commit).toHaveBeenCalledWith('setShowHeader', false)

    wrapper.vm.$options.beforeRouteLeave.call(wrapper.vm)
    expect(commit).toHaveBeenCalledWith('setShowHeader', true)
  })

  it('logs an error and renders no results when the share link does not exist', async () => {
    get.mockResolvedValue({ exists: () => false })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { wrapper } = factory()
    await flushPromises()

    expect(errorSpy).toHaveBeenCalledWith('No share data')
    expect(wrapper.vm.filteredResults).toEqual([])
    expect(wrapper.vm.showMoreButton).toBe(false)
    errorSpy.mockRestore()
  })

  it('loads the shared results and defaults to grid view', async () => {
    const results = [result(1), result(2)]
    get.mockResolvedValue({
      exists: () => true,
      val: () => ({ value: 'spielberg', sortValue: 'rating', sortOrder: 'bestOrNewestOnTop', results })
    })
    const { wrapper } = factory()
    await flushPromises()

    expect(wrapper.vm.gridView).toBe(true)
    expect(wrapper.find('.poster-grid').exists()).toBe(true)
    expect(wrapper.findAll('.poster-grid-item').length).toBe(2)
    expect(wrapper.find('.terms').exists()).toBe(true)
  })

  it('toggling gridView swaps to the table view', async () => {
    const results = [result(1)]
    get.mockResolvedValue({ exists: () => true, val: () => ({ results }) })
    const { wrapper } = factory()
    await flushPromises()

    await wrapper.find('.keyword-style-toggle').trigger('click')

    expect(wrapper.vm.gridView).toBe(false)
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr').length).toBe(1)
  })

  it('filters out results with no rating', async () => {
    const rated = result(1)
    const unrated = result(2, { ratings: [] })
    get.mockResolvedValue({ exists: () => true, val: () => ({ results: [rated, unrated] }) })
    const { wrapper } = factory()
    await flushPromises()

    expect(wrapper.vm.filteredResults).toEqual([rated])
  })

  it('derives the share banner from the first result\'s custom backdrop, falling back to the movie backdrop', async () => {
    const withCustom = result(1, { customBackdropPath: '/custom.jpg' })
    get.mockResolvedValue({ exists: () => true, val: () => ({ results: [withCustom] }) })
    const { wrapper } = factory()
    await flushPromises()

    expect(wrapper.vm.shareBannerUrl).toBe('https://image.tmdb.org/t/p/w500/custom.jpg')
  })

  it('caps filteredResults at numberOfResultsToShow and shows a More button beyond it', async () => {
    const results = Array.from({ length: 60 }, (_, i) => result(i))
    get.mockResolvedValue({ exists: () => true, val: () => ({ results }) })
    const { wrapper } = factory()
    await flushPromises()

    expect(wrapper.vm.filteredResults.length).toBe(50)
    expect(wrapper.vm.showMoreButton).toBe(true)

    wrapper.vm.addMoreResults()
    expect(wrapper.vm.numberOfResultsToShow).toBe(100)
    expect(wrapper.vm.filteredResults.length).toBe(60)
    expect(wrapper.vm.showMoreButton).toBe(false)
  })
})

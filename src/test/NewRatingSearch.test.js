import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import NewRatingSearch from '@/components/NewRatingSearch.vue'

vi.mock('axios', () => ({
  default: { get: vi.fn() }
}))

function factory (value = 'somemoviethatdoesnotexist', { isOnline = true } = {}) {
  const push = vi.fn()
  const commit = vi.fn()
  const wrapper = mount(NewRatingSearch, {
    props: { value },
    global: {
      mocks: {
        $store: { getters: { allMoviesAsArray: [] }, state: { isOnline }, commit, dispatch: vi.fn() },
        $router: { push }
      },
      stubs: { PickMedia: true }
    }
  })
  return { wrapper, push, commit }
}

describe('NewRatingSearch - no-results state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays on the "doesn\'t exist" message indefinitely - no auto-clear timer', async () => {
    const { wrapper } = factory()

    wrapper.vm.showNoResultsMessage()
    expect(wrapper.vm.noResults).toBe(true)

    await vi.advanceTimersByTimeAsync(60 * 1000) // well past the old 5s auto-clear

    expect(wrapper.vm.noResults).toBe(true)
  })

  it('does not emit start-new-search on its own', async () => {
    const { wrapper } = factory()

    wrapper.vm.showNoResultsMessage()
    await vi.advanceTimersByTimeAsync(60 * 1000)

    expect(wrapper.emitted('start-new-search')).toBeFalsy()
  })
})

describe('NewRatingSearch - offline rating fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the offline fallback immediately on mount, without attempting a TMDb search', async () => {
    const axios = (await import('axios')).default
    axios.get.mockClear()
    const { wrapper } = factory('Some Movie', { isOnline: false })

    await vi.advanceTimersByTimeAsync(2000)

    expect(wrapper.vm.offlineFallback).toBe(true)
    expect(axios.get).not.toHaveBeenCalled()
    expect(wrapper.find('.offline-fallback').exists()).toBe(true)
    expect(wrapper.find('.offline-fallback button').text()).toContain('Some Movie')
  })

  it('switches to the offline fallback if a fresh search term comes in while offline', async () => {
    const { wrapper } = factory('a', { isOnline: false })
    await wrapper.setProps({ value: 'a different title' })

    expect(wrapper.vm.offlineFallback).toBe(true)
  })

  it('falls back to the offline UI if the TMDb search itself fails while nominally online', async () => {
    const axios = (await import('axios')).default
    axios.get.mockRejectedValueOnce(new Error('network down'))
    const { wrapper } = factory('Some Movie', { isOnline: true })

    await vi.advanceTimersByTimeAsync(2000)
    await Promise.resolve()
    await Promise.resolve()

    expect(wrapper.vm.offlineFallback).toBe(true)
  })

  it('rateOffline builds a placeholder movieToRate and routes straight to /rate-movie, bypassing TMDb search entirely', async () => {
    const { wrapper, push, commit } = factory('Some Movie', { isOnline: false })
    await vi.advanceTimersByTimeAsync(2000)

    await wrapper.find('.offline-fallback button').trigger('click')

    expect(commit).toHaveBeenCalledWith('setMovieToRate', expect.objectContaining({
      title: 'Some Movie',
      release_date: null,
      poster_path: null,
      backdrop_path: null
    }))
    const [, media] = commit.mock.calls.find((call) => call[0] === 'setMovieToRate')
    expect(media.id).toMatch(/^offline-/)
    expect(push).toHaveBeenCalledWith('/rate-movie')
  })
})

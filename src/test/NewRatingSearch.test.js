import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import NewRatingSearch from '@/components/NewRatingSearch.vue'

vi.mock('axios', () => ({
  default: { get: vi.fn() }
}))

function factory (value = 'somemoviethatdoesnotexist') {
  return mount(NewRatingSearch, {
    props: { value },
    global: {
      mocks: {
        $store: { getters: { allMoviesAsArray: [] }, commit: vi.fn() },
        $router: { push: vi.fn() }
      },
      stubs: { PickMedia: true }
    }
  })
}

describe('NewRatingSearch - no-results state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays on the "doesn\'t exist" message indefinitely - no auto-clear timer', async () => {
    const wrapper = factory()

    wrapper.vm.showNoResultsMessage()
    expect(wrapper.vm.noResults).toBe(true)

    await vi.advanceTimersByTimeAsync(60 * 1000) // well past the old 5s auto-clear

    expect(wrapper.vm.noResults).toBe(true)
  })

  it('does not emit start-new-search on its own', async () => {
    const wrapper = factory()

    wrapper.vm.showNoResultsMessage()
    await vi.advanceTimersByTimeAsync(60 * 1000)

    expect(wrapper.emitted('start-new-search')).toBeFalsy()
  })
})

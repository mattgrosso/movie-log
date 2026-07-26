import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import App from '@/App.vue'

// App.vue registers its update-check listeners directly on document/window
// and (being the app root) never tears them down in beforeUnmount - fine in
// production (it's mounted exactly once for the app's lifetime), but real
// dispatchEvent calls would leak listeners across tests in this file since
// nothing ever unregisters a previous test's mount. Spying on
// addEventListener and invoking the captured handler directly sidesteps
// that: each test only ever exercises the ONE App instance it just mounted.
function factory () {
  const listeners = {}
  vi.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
    listeners[`document:${event}`] = handler
  })
  vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
    listeners[`window:${event}`] = handler
  })

  const store = {
    state: { dbLoaded: false, isOnline: true },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  shallowMount(App, {
    global: {
      mocks: {
        $store: store
      }
    }
  })

  return { listeners, store }
}

describe('App - service worker update checks', () => {
  let updateMock
  let getRegistrationMock

  beforeEach(() => {
    vi.useFakeTimers()
    updateMock = vi.fn().mockResolvedValue(undefined)
    getRegistrationMock = vi.fn().mockResolvedValue({ update: updateMock })
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: getRegistrationMock },
      configurable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    delete navigator.serviceWorker
  })

  it('checks for an update on visibilitychange when the page becomes visible', async () => {
    const { listeners } = factory()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })

    listeners['document:visibilitychange']()
    await vi.waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
  })

  it('does NOT check on visibilitychange when the page becomes hidden', async () => {
    const { listeners } = factory()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })

    listeners['document:visibilitychange']()
    await Promise.resolve()

    expect(getRegistrationMock).not.toHaveBeenCalled()
  })

  // iOS's visibilitychange unreliability for standalone/home-screen PWAs is
  // exactly why these two exist as independent fallback triggers.
  it('also checks for an update on window pageshow (iOS visibilitychange fallback)', async () => {
    const { listeners } = factory()

    listeners['window:pageshow']()
    await vi.waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
  })

  it('also checks for an update on window focus (iOS visibilitychange fallback)', async () => {
    const { listeners } = factory()

    listeners['window:focus']()
    await vi.waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
  })

  it('re-checks periodically as a backstop that does not depend on any lifecycle event', async () => {
    factory()

    expect(updateMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)
    expect(updateMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)
    expect(updateMock).toHaveBeenCalledTimes(2)
  })

  it('does not throw when the service worker API is unavailable', async () => {
    delete navigator.serviceWorker
    const { listeners } = factory()

    listeners['window:focus']()
    await Promise.resolve()
    // Nothing to assert beyond "didn't throw" - getRegistration simply isn't there.
  })

  it('swallows a failed update check instead of throwing', async () => {
    getRegistrationMock.mockRejectedValue(new Error('network error'))
    const { listeners } = factory()

    listeners['window:focus']()
    await vi.waitFor(() => expect(getRegistrationMock).toHaveBeenCalledTimes(1))
  })
})

describe('App - offline detection + pending-write flush wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('flips store.state.isOnline and dispatches a flush on the online event', () => {
    const { listeners, store } = factory()

    listeners['window:online']()

    expect(store.commit).toHaveBeenCalledWith('setIsOnline', true)
    expect(store.dispatch).toHaveBeenCalledWith('flushPendingWrites')
  })

  it('flips store.state.isOnline to false on the offline event, without dispatching a flush', () => {
    const { listeners, store } = factory()

    listeners['window:offline']()

    expect(store.commit).toHaveBeenCalledWith('setIsOnline', false)
    expect(store.dispatch).not.toHaveBeenCalledWith('flushPendingWrites')
  })

  it('attempts a flush from each of the iOS-reliability triggers too, not just the online event', () => {
    const { listeners, store } = factory()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })

    listeners['document:visibilitychange']()
    listeners['window:pageshow']()
    listeners['window:focus']()

    expect(store.dispatch).toHaveBeenCalledWith('flushPendingWrites')
    expect(store.dispatch.mock.calls.filter((call) => call[0] === 'flushPendingWrites')).toHaveLength(3)
  })

  it('attempts a flush on the periodic interval backstop too', async () => {
    const { store } = factory()

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)

    expect(store.dispatch).toHaveBeenCalledWith('flushPendingWrites')
  })
})

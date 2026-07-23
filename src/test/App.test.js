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

  shallowMount(App, {
    global: {
      mocks: {
        $store: { state: { dbLoaded: false } }
      }
    }
  })

  return listeners
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
    const listeners = factory()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })

    listeners['document:visibilitychange']()
    await vi.waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
  })

  it('does NOT check on visibilitychange when the page becomes hidden', async () => {
    const listeners = factory()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })

    listeners['document:visibilitychange']()
    await Promise.resolve()

    expect(getRegistrationMock).not.toHaveBeenCalled()
  })

  // iOS's visibilitychange unreliability for standalone/home-screen PWAs is
  // exactly why these two exist as independent fallback triggers.
  it('also checks for an update on window pageshow (iOS visibilitychange fallback)', async () => {
    const listeners = factory()

    listeners['window:pageshow']()
    await vi.waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
  })

  it('also checks for an update on window focus (iOS visibilitychange fallback)', async () => {
    const listeners = factory()

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
    const listeners = factory()

    listeners['window:focus']()
    await Promise.resolve()
    // Nothing to assert beyond "didn't throw" - getRegistration simply isn't there.
  })

  it('swallows a failed update check instead of throwing', async () => {
    getRegistrationMock.mockRejectedValue(new Error('network error'))
    const listeners = factory()

    listeners['window:focus']()
    await vi.waitFor(() => expect(getRegistrationMock).toHaveBeenCalledTimes(1))
  })
})

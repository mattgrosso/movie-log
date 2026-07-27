import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Only runs its register(...) call when NODE_ENV === 'production' - stub
// that so the module actually exercises its real logic here, and mock
// register-service-worker itself so we can capture the config object it's
// called with and invoke `updated()` directly, exactly like the real
// library would once a new service worker activates.
let capturedConfig
const registerMock = vi.fn((swUrl, config) => { capturedConfig = config })
vi.mock('register-service-worker', () => ({
  register: (...args) => registerMock(...args)
}))

vi.mock('@/services/ErrorLogService.js', () => ({ default: { error: vi.fn() } }))

const commitMock = vi.fn()
vi.mock('@/store/index', () => ({
  default: { commit: (...args) => commitMock(...args) }
}))

describe('registerServiceWorker - updated hook', () => {
  let originalNodeEnv

  beforeEach(async () => {
    vi.resetModules()
    registerMock.mockClear()
    commitMock.mockClear()
    capturedConfig = undefined
    originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    await import('@/registerServiceWorker.js')
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('registers the service worker', () => {
    expect(registerMock).toHaveBeenCalledTimes(1)
    expect(capturedConfig).toBeDefined()
  })

  it('flags updateAvailable instead of forcing a reload (bug fix: this used to call window.location.reload() unconditionally, yanking the page out from under whatever the user was doing - e.g. mid-run of the box office backfill button)', () => {
    const reloadSpy = vi.fn()
    const originalLocation = window.location
    delete window.location
    window.location = { ...originalLocation, reload: reloadSpy }

    capturedConfig.updated()

    expect(commitMock).toHaveBeenCalledWith('setUpdateAvailable', true)
    expect(reloadSpy).not.toHaveBeenCalled()

    window.location = originalLocation
  })
})

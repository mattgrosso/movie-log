import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Imports the REAL store module (same pattern as OfflineDataFallback.test.js)
// so flushPendingWrites/setMovieLogEntry/refreshPendingReconciliations'
// actual logic is exercised, not a hand-rolled copy. Firebase/axios/router/
// Sentry are mocked so importing store/index.js has no real side effects.
vi.mock('axios')
vi.mock('@sentry/vue')
vi.mock('@/router', () => ({ default: { push: vi.fn() } }))
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 0 }))
}))

const setMock = vi.fn(() => Promise.resolve())
vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn((db, path) => path),
  onValue: vi.fn(),
  set: (...args) => setMock(...args)
}))
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({}))
}))
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn()
}))
vi.mock('@/utils/offlineStore.js', () => ({
  loadSnapshot: vi.fn(() => Promise.resolve(null)),
  saveSnapshot: vi.fn()
}))

const listPendingWritesMock = vi.fn(() => Promise.resolve([]))
const removePendingWriteMock = vi.fn()
const updatePendingWriteMock = vi.fn()
vi.mock('@/utils/pendingWriteQueue.js', () => ({
  listPendingWrites: (...args) => listPendingWritesMock(...args),
  removePendingWrite: (...args) => removePendingWriteMock(...args),
  updatePendingWrite: (...args) => updatePendingWriteMock(...args)
}))

let store
let originalOnLine

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(async () => {
  vi.resetModules()
  setMock.mockClear()
  setMock.mockImplementation(() => Promise.resolve())
  listPendingWritesMock.mockReset().mockResolvedValue([])
  removePendingWriteMock.mockReset()
  updatePendingWriteMock.mockReset()

  const storeModule = await import('@/store/index.js')
  store = storeModule.default
  store.commit('setDevMode', true) // routes databaseTopKey through 'testing-database'

  originalOnLine = window.navigator.onLine
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

afterEach(() => {
  Object.defineProperty(window.navigator, 'onLine', { value: originalOnLine, configurable: true })
})

describe('flushPendingWrites', () => {
  it('does nothing when offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    listPendingWritesMock.mockResolvedValue([{ id: '1', type: 'write', dbEntry: { path: 'movieLog/a', value: {} } }])

    await store.dispatch('flushPendingWrites')

    expect(setMock).not.toHaveBeenCalled()
  })

  it('writes each queued entry and removes type "write" entries on success', async () => {
    listPendingWritesMock.mockResolvedValue([
      { id: '1', type: 'write', dbEntry: { path: 'movieLog/a', value: { movie: { id: 1 } } } },
      { id: '2', type: 'write', dbEntry: { path: 'movieLog/b', value: { movie: { id: 2 } } } }
    ])

    await store.dispatch('flushPendingWrites')

    expect(setMock).toHaveBeenCalledTimes(2)
    expect(setMock).toHaveBeenCalledWith('testing-database/movieLog/a', { movie: { id: 1 } })
    expect(setMock).toHaveBeenCalledWith('testing-database/movieLog/b', { movie: { id: 2 } })
    expect(removePendingWriteMock).toHaveBeenCalledWith('1')
    expect(removePendingWriteMock).toHaveBeenCalledWith('2')
  })

  it('marks a "placeholder" entry written but keeps it queued (for reconciliation), rather than removing it', async () => {
    listPendingWritesMock.mockResolvedValue([
      { id: '1', type: 'placeholder', status: 'unreconciled', dbEntry: { path: 'movieLog/a', value: {} } }
    ])

    await store.dispatch('flushPendingWrites')

    expect(removePendingWriteMock).not.toHaveBeenCalled()
    expect(updatePendingWriteMock).toHaveBeenCalledWith('1', { written: true })
  })

  it('records attempts/lastError on a failed write, without aborting the rest of the queue', async () => {
    setMock.mockImplementation((path) => {
      if (path === 'testing-database/movieLog/bad') {
        return Promise.reject(new Error('network down'))
      }
      return Promise.resolve()
    })
    listPendingWritesMock.mockResolvedValue([
      { id: 'bad', type: 'write', attempts: 1, dbEntry: { path: 'movieLog/bad', value: {} } },
      { id: 'good', type: 'write', dbEntry: { path: 'movieLog/good', value: {} } }
    ])

    await store.dispatch('flushPendingWrites')

    expect(updatePendingWriteMock).toHaveBeenCalledWith('bad', { attempts: 2, lastError: expect.stringContaining('network down') })
    expect(removePendingWriteMock).toHaveBeenCalledWith('good')
    expect(removePendingWriteMock).not.toHaveBeenCalledWith('bad')
  })

  it('bypasses setDBValue\'s same-path debounce - a queued flush still writes even right after a direct setDBValue save to the same path', async () => {
    await store.dispatch('setDBValue', { path: 'movieLog/x', value: { v: 1 } })
    expect(setMock).toHaveBeenCalledTimes(1)

    listPendingWritesMock.mockResolvedValue([
      { id: '1', type: 'write', dbEntry: { path: 'movieLog/x', value: { v: 2 } } }
    ])
    await store.dispatch('flushPendingWrites')

    expect(setMock).toHaveBeenCalledTimes(2)
    expect(setMock).toHaveBeenLastCalledWith('testing-database/movieLog/x', { v: 2 })
  })

  it('does not run two overlapping flush passes at once', async () => {
    let resolveFirstList
    // Only the FIRST call is held pending - refreshPendingReconciliations'
    // own internal listPendingWrites() call (at the end of the same flush
    // pass) should resolve immediately, not reuse the held promise.
    listPendingWritesMock.mockImplementationOnce(() => new Promise((resolve) => { resolveFirstList = resolve }))
    listPendingWritesMock.mockResolvedValue([])

    const firstFlush = store.dispatch('flushPendingWrites')
    const secondFlush = store.dispatch('flushPendingWrites') // should see isFlushingPendingWrites already true and no-op

    resolveFirstList([])
    await Promise.all([firstFlush, secondFlush])

    // The second, overlapping dispatch never got far enough to call
    // listPendingWrites at all - only the first pass (+ its own
    // refreshPendingReconciliations tail call) did.
    expect(listPendingWritesMock.mock.calls.length).toBe(2)
  })

  it('recomputes pendingReconciliations from unreconciled placeholder entries after a flush pass', async () => {
    listPendingWritesMock.mockResolvedValue([
      { id: '1', type: 'placeholder', status: 'unreconciled', dbEntry: { path: 'movieLog/a', value: {} } },
      { id: '2', type: 'placeholder', status: 'reconciled', dbEntry: { path: 'movieLog/b', value: {} } },
      { id: '3', type: 'write', dbEntry: { path: 'movieLog/c', value: {} } }
    ])

    await store.dispatch('flushPendingWrites')

    expect(store.state.pendingReconciliations).toHaveLength(1)
    expect(store.state.pendingReconciliations[0].id).toBe('1')
  })

  it('never hangs forever on a stuck write - a timed-out set() is treated as a failure so isFlushingPendingWrites always resets (bug fix)', async () => {
    vi.useFakeTimers()
    try {
      setMock.mockImplementation(() => new Promise(() => {})) // never resolves/rejects, simulating a hung connection
      listPendingWritesMock.mockResolvedValue([
        { id: 'stuck', type: 'write', dbEntry: { path: 'movieLog/stuck', value: {} } }
      ])

      const flushPromise = store.dispatch('flushPendingWrites')
      await vi.advanceTimersByTimeAsync(20000) // past the 15s write timeout
      await flushPromise

      expect(updatePendingWriteMock).toHaveBeenCalledWith('stuck', { attempts: 1, lastError: expect.stringContaining('timed out') })
      expect(store.state.isFlushingPendingWrites).toBe(false)

      // Confirms the guard is genuinely clear, not just that this action
      // returned - a second call would previously also have looked fine
      // even if the flag were stuck, since dispatch always resolves.
      listPendingWritesMock.mockResolvedValue([])
      await store.dispatch('flushPendingWrites')
      expect(listPendingWritesMock).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('writeDatabaseEntryNow', () => {
  it('writes the given entry directly, with no queue involvement at all, independent of isFlushingPendingWrites', async () => {
    // Simulates a general sweep already being mid-flight - this action must
    // not be blocked by that guard (unlike flushPendingWrites itself).
    store.commit('setIsFlushingPendingWrites', true)

    await store.dispatch('writeDatabaseEntryNow', { path: 'movieLog/x', value: { v: 1 } })

    expect(setMock).toHaveBeenCalledWith('testing-database/movieLog/x', { v: 1 })
    expect(listPendingWritesMock).not.toHaveBeenCalled()
    expect(removePendingWriteMock).not.toHaveBeenCalled()
    expect(updatePendingWriteMock).not.toHaveBeenCalled()
  })

  it('propagates a failure (including a timed-out write) so the caller can decide what to do, rather than silently swallowing it', async () => {
    setMock.mockImplementation(() => Promise.reject(new Error('nope')))

    await expect(store.dispatch('writeDatabaseEntryNow', { path: 'movieLog/z', value: {} })).rejects.toThrow('nope')
  })

  it('is unaffected by connectivity state at the Vuex level (callers check store.state.isOnline themselves before calling this)', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })

    await store.dispatch('writeDatabaseEntryNow', { path: 'movieLog/x', value: {} })

    expect(setMock).toHaveBeenCalled()
  })
})

describe('refreshPendingReconciliations', () => {
  it('is callable independently of flushPendingWrites (e.g. from initializeDB, regardless of connectivity)', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    listPendingWritesMock.mockResolvedValue([
      { id: '1', type: 'placeholder', status: 'unreconciled', dbEntry: { path: 'movieLog/a', value: {} } }
    ])

    await store.dispatch('refreshPendingReconciliations')

    expect(store.state.pendingReconciliations).toHaveLength(1)
  })
})

describe('setMovieLogEntry mutation', () => {
  it('applies a single entry to movieLog immediately, refreezing the object (movieLog is always frozen)', () => {
    store.commit('setMovieLog', { existing: { movie: { id: 1 } } })

    store.commit('setMovieLogEntry', { key: 'new-key', value: { movie: { id: 2 }, ratings: [] } })

    expect(store.state.movieLog['new-key']).toEqual({ movie: { id: 2 }, ratings: [] })
    expect(store.state.movieLog.existing).toEqual({ movie: { id: 1 } }) // untouched
    expect(Object.isFrozen(store.state.movieLog)).toBe(true)
  })
})

describe('initializeDB wiring', () => {
  it('dispatches both flushPendingWrites and refreshPendingReconciliations', async () => {
    listPendingWritesMock.mockResolvedValue([])

    await store.dispatch('initializeDB')
    await flushMicrotasks()

    // Both routes ultimately call listPendingWrites via the queue module.
    expect(listPendingWritesMock).toHaveBeenCalled()
  })
})

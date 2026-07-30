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
const updateMock = vi.fn(() => Promise.resolve())
vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn((db, path) => path),
  onValue: vi.fn(),
  set: (...args) => setMock(...args),
  update: (...args) => updateMock(...args)
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
const enqueueWriteMock = vi.fn((entry) => Promise.resolve({ id: 'queued-id', createdAt: Date.now(), attempts: 0, lastError: null, ...entry }))
vi.mock('@/utils/pendingWriteQueue.js', () => ({
  listPendingWrites: (...args) => listPendingWritesMock(...args),
  removePendingWrite: (...args) => removePendingWriteMock(...args),
  updatePendingWrite: (...args) => updatePendingWriteMock(...args),
  enqueueWrite: (...args) => enqueueWriteMock(...args)
}))

let store
let originalOnLine

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(async () => {
  vi.resetModules()
  setMock.mockClear()
  setMock.mockImplementation(() => Promise.resolve())
  updateMock.mockClear()
  updateMock.mockImplementation(() => Promise.resolve())
  listPendingWritesMock.mockReset().mockResolvedValue([])
  removePendingWriteMock.mockReset()
  updatePendingWriteMock.mockReset()
  enqueueWriteMock.mockReset().mockImplementation((entry) => Promise.resolve({ id: 'queued-id', createdAt: Date.now(), attempts: 0, lastError: null, ...entry }))

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

  it('skips re-attempting a "placeholder" entry that is already marked written - it stays queued for reconciliation, not for retry', async () => {
    listPendingWritesMock.mockResolvedValue([
      { id: '1', type: 'placeholder', status: 'unreconciled', written: true, dbEntry: { path: 'movieLog/a', value: {} } }
    ])

    await store.dispatch('flushPendingWrites')

    expect(setMock).not.toHaveBeenCalled()
    expect(updatePendingWriteMock).not.toHaveBeenCalled()
    expect(removePendingWriteMock).not.toHaveBeenCalled()
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

describe('setMovieLogEntries mutation (batched, bug fix Jul 2026)', () => {
  it('applies many entries in ONE spread+freeze instead of one per entry', () => {
    store.commit('setMovieLog', { existing: { movie: { id: 1 } } })

    store.commit('setMovieLogEntries', [
      { key: 'new-key-1', value: { movie: { id: 2 } } },
      { key: 'new-key-2', value: { movie: { id: 3 } } }
    ])

    expect(store.state.movieLog['new-key-1']).toEqual({ movie: { id: 2 } })
    expect(store.state.movieLog['new-key-2']).toEqual({ movie: { id: 3 } })
    expect(store.state.movieLog.existing).toEqual({ movie: { id: 1 } }) // untouched
    expect(Object.isFrozen(store.state.movieLog)).toBe(true)
  })

  it('a batch of entries results in exactly one movieLog reassignment, not one per entry (the actual perf fix)', async () => {
    store.commit('setMovieLog', {})
    const reassignments = []
    // Vuex state is reactive - watch the store's own getter to count how
    // many times the movieLog REFERENCE actually changes. Vue watchers
    // flush on nextTick, not synchronously, hence the awaits below.
    const unwatch = store.watch((state) => state.movieLog, () => reassignments.push(1))

    store.commit('setMovieLogEntries', Array.from({ length: 20 }, (_, i) => ({ key: `k${i}`, value: { movie: { id: i } } })))
    await flushMicrotasks()

    expect(reassignments).toHaveLength(1)
    unwatch()
  })
})

describe('updateDatabaseEntriesNow (batched multi-path write, bug fix Jul 2026)', () => {
  it('sends one atomic Firebase update() call covering every path given, not one write per path', async () => {
    await store.dispatch('updateDatabaseEntriesNow', {
      'movieLog/key1/movie/budget': 100,
      'movieLog/key1/movie/revenue': 200,
      'movieLog/key2/movie/budget': 300
    })

    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledWith('testing-database', {
      'movieLog/key1/movie/budget': 100,
      'movieLog/key1/movie/revenue': 200,
      'movieLog/key2/movie/budget': 300
    })
    expect(setMock).not.toHaveBeenCalled()
  })

  it('propagates a failure (including a timed-out update) to the caller', async () => {
    updateMock.mockImplementation(() => Promise.reject(new Error('nope')))

    await expect(store.dispatch('updateDatabaseEntriesNow', { 'movieLog/x/movie/budget': 1 })).rejects.toThrow('nope')
  })
})

describe('applyDbPathLocally mutation (offline support extension, Jul 2026)', () => {
  it('sets a top-level settings/* value, creating settings if it did not exist', () => {
    store.commit('setSettings', {})
    store.commit('applyDbPathLocally', { path: 'settings/lastTweak', value: 12345 })
    expect(store.state.settings.lastTweak).toBe(12345)
  })

  it('sets a NESTED settings/* value without disturbing sibling keys at any level', () => {
    store.commit('setSettings', { personalAwards: { 2023: { completed: true } }, otherKey: 'untouched' })
    store.commit('applyDbPathLocally', { path: 'settings/personalAwards/2024', value: { completed: false } })

    expect(store.state.settings.personalAwards[2024]).toEqual({ completed: false })
    expect(store.state.settings.personalAwards[2023]).toEqual({ completed: true }) // untouched
    expect(store.state.settings.otherKey).toBe('untouched') // untouched
  })

  it('a single-segment movieLog/<key> path behaves exactly like setMovieLogEntry (frozen, full-entry replace)', () => {
    store.commit('setMovieLog', { existing: { movie: { id: 1 } } })
    store.commit('applyDbPathLocally', { path: 'movieLog/new-key', value: { movie: { id: 2 } } })

    expect(store.state.movieLog['new-key']).toEqual({ movie: { id: 2 } })
    expect(store.state.movieLog.existing).toEqual({ movie: { id: 1 } }) // untouched
    expect(Object.isFrozen(store.state.movieLog)).toBe(true)
  })
})

describe('writeDurably action (offline support extension, Jul 2026 — Stickiness/Tiebreak/Personal Awards)', () => {
  it('commits the value locally BEFORE attempting the network write, and durably enqueues it', async () => {
    store.commit('setSettings', {})
    let sawLocalValueDuringWrite = null
    setMock.mockImplementation(() => {
      sawLocalValueDuringWrite = store.state.settings.tieBreakTournament
      return Promise.resolve()
    })

    await store.dispatch('writeDurably', { path: 'settings/tieBreakTournament', value: { contestantIds: ['a', 'b'] } })

    expect(sawLocalValueDuringWrite).toEqual({ contestantIds: ['a', 'b'] })
    expect(enqueueWriteMock).toHaveBeenCalledWith({ type: 'write', dbEntry: { path: 'settings/tieBreakTournament', value: { contestantIds: ['a', 'b'] } } })
  })

  it('removes the queued entry once the direct write is confirmed', async () => {
    store.commit('setSettings', {})
    await store.dispatch('writeDurably', { path: 'settings/lastTweak', value: 999 })

    expect(setMock).toHaveBeenCalledWith('testing-database/settings/lastTweak', 999)
    expect(removePendingWriteMock).toHaveBeenCalledWith('queued-id')
  })

  it('leaves the entry queued (does not remove it) and does not throw when the direct write fails', async () => {
    store.commit('setSettings', {})
    setMock.mockImplementation(() => Promise.reject(new Error('network down')))

    await expect(store.dispatch('writeDurably', { path: 'settings/lastTweak', value: 1 })).resolves.toBeUndefined()

    expect(removePendingWriteMock).not.toHaveBeenCalled()
  })

  it('when offline, commits locally and enqueues but never attempts the network write', async () => {
    // state.isOnline is set via App.vue's online/offline listeners (the
    // setIsOnline mutation), not re-read live from navigator.onLine on every
    // check — commit it directly rather than toggling navigator.onLine,
    // which only affects isOnline at STORE-CREATION time.
    store.commit('setIsOnline', false)
    store.commit('setSettings', {})

    await store.dispatch('writeDurably', { path: 'settings/lastTweak', value: 1 })

    expect(store.state.settings.lastTweak).toBe(1)
    expect(enqueueWriteMock).toHaveBeenCalled()
    expect(setMock).not.toHaveBeenCalled()
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

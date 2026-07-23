import { describe, it, expect, vi, beforeEach } from 'vitest'

// Imports the REAL store module (not a hand-rolled copy like VuexStore.test.js)
// so initializeDB's actual offline-fallback logic is exercised. Firebase/axios/
// router/Sentry are mocked so importing store/index.js has no real side effects.
vi.mock('axios')
vi.mock('@sentry/vue')
vi.mock('@/router', () => ({ default: { push: vi.fn() } }))
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 0 }))
}))

const onValueMock = vi.fn()
vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn((db, path) => path),
  onValue: (...args) => onValueMock(...args),
  set: vi.fn()
}))
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({}))
}))
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn()
}))

const loadSnapshotMock = vi.fn()
const saveSnapshotMock = vi.fn()
vi.mock('@/utils/offlineStore.js', () => ({
  loadSnapshot: (...args) => loadSnapshotMock(...args),
  saveSnapshot: (...args) => saveSnapshotMock(...args)
}))

let store

// A single `await Promise.resolve()` only flushes one microtask tick, which
// isn't always enough to drain a `.then()` chained onto a mocked promise
// resolution inside a Vuex action. A macrotask tick reliably drains all
// pending microtasks first.
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(async () => {
  vi.resetModules()
  onValueMock.mockReset()
  loadSnapshotMock.mockReset()
  saveSnapshotMock.mockReset()

  const storeModule = await import('@/store/index.js')
  store = storeModule.default

  // Route through devModeTopKey ('testing-database') so databaseTopKey
  // resolves without needing a real login flow.
  store.commit('setDevMode', true)
  // Skip the unrelated academyAwardWinners network branch for these tests.
  store.commit('setAcademyAwardWinners', { bestPicture: [] })
})

describe('initializeDB offline snapshot fallback', () => {
  it('loads movieLog from the cached snapshot when Firebase never responds (offline cold start)', async () => {
    let resolveCache
    loadSnapshotMock.mockImplementation((topKey, kind) => {
      if (kind === 'movieLog') {
        return new Promise((resolve) => { resolveCache = resolve })
      }
      return Promise.resolve(null)
    })

    await store.dispatch('initializeDB')

    expect(store.state.dbLoaded).toBe(false)

    resolveCache({ 'movie-1': { movie: { id: 1, title: 'Cached Movie' } } })
    await flushMicrotasks()

    expect(store.state.movieLog).toEqual({ 'movie-1': { movie: { id: 1, title: 'Cached Movie' } } })
    expect(store.state.dbLoaded).toBe(true)
  })

  it('prefers live Firebase data over the cache when both are available, and persists it', async () => {
    let resolveCache
    loadSnapshotMock.mockImplementation((topKey, kind) => {
      if (kind === 'movieLog') {
        return new Promise((resolve) => { resolveCache = resolve })
      }
      return Promise.resolve(null)
    })

    await store.dispatch('initializeDB')

    // Live listener responds first.
    const movieLogCall = onValueMock.mock.calls.find((call) => call[0] === 'testing-database/movieLog')
    const liveCallback = movieLogCall[1]
    liveCallback({ val: () => ({ 'movie-2': { movie: { id: 2, title: 'Live Movie' } } }) })

    expect(store.state.movieLog).toEqual({ 'movie-2': { movie: { id: 2, title: 'Live Movie' } } })
    expect(store.state.dbLoaded).toBe(true)
    expect(saveSnapshotMock).toHaveBeenCalledWith('testing-database', 'movieLog', { 'movie-2': { movie: { id: 2, title: 'Live Movie' } } })

    // The cache read resolving afterward must NOT clobber the already-live data.
    resolveCache({ 'movie-1': { movie: { id: 1, title: 'Stale Cached Movie' } } })
    await flushMicrotasks()

    expect(store.state.movieLog).toEqual({ 'movie-2': { movie: { id: 2, title: 'Live Movie' } } })
  })

  it('loads settings from the cached snapshot the same way', async () => {
    loadSnapshotMock.mockImplementation((topKey, kind) => {
      if (kind === 'settings') {
        return Promise.resolve({ includeShorts: true })
      }
      return Promise.resolve(null)
    })

    await store.dispatch('initializeDB')
    await flushMicrotasks()

    expect(store.state.settings).toEqual({ includeShorts: true })
  })

  it('does not attempt a live listener or cache read when no databaseTopKey is available', async () => {
    store.commit('setDevMode', false)

    await store.dispatch('initializeDB')

    expect(onValueMock).not.toHaveBeenCalled()
    expect(loadSnapshotMock).not.toHaveBeenCalled()
  })
})

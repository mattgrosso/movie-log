import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

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
  // Skip the unrelated academyAwardWinners/allAcademyAwards network
  // branches for these tests (movieLog/settings offline fallback, not
  // awards data) — the "full Academy Awards dataset" describe block below
  // explicitly resets allAcademyAwards back to [] per-test to exercise it.
  store.commit('setAcademyAwardWinners', { bestPicture: [] })
  store.commit('setAllAcademyAwards', [{ id: 'skip-in-unrelated-tests' }])
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

describe('initializeDB: full Academy Awards dataset (feature: "pull it down and store it locally so we can use it wherever we want to")', () => {
  beforeEach(() => {
    // The shared top-level beforeEach presets this to a non-empty array so
    // the unrelated movieLog/settings tests above skip this fetch entirely
    // — reset it back to empty here so each test in THIS block actually
    // exercises the fetch-once guard from a clean slate.
    store.commit('setAllAcademyAwards', [])
    axios.get.mockReset()
    // initializeDB unconditionally also calls loadSnapshot for movieLog and
    // settings (both empty by default in this store instance) — give every
    // kind a safe default so those unrelated calls don't blow up on a bare
    // reset mock; individual tests below override this for 'allAcademyAwards'
    // specifically where they need to.
    loadSnapshotMock.mockImplementation(() => Promise.resolve(null))
  })

  it('fetches the full, unfiltered /awards dataset and normalizes isWinner/isActing to real booleans', async () => {
    axios.get.mockImplementation((url) => {
      if (url === 'https://web-production-b8145.up.railway.app/awards') {
        return Promise.resolve({
          data: [
            { id: 1, category: 'Best Picture', tmdb: '100', year: 1994, isWinner: '1', isActing: '0' },
            { id: 2, category: 'Best Actor', tmdb: '200', year: 1994, isWinner: 'TRUE', isActing: '1' },
            { id: 3, category: 'Best Actor', tmdb: '201', year: 1994, isWinner: '0', isActing: '1' }
          ]
        })
      }
      return Promise.resolve({ data: [] })
    })

    await store.dispatch('initializeDB')
    await flushMicrotasks()

    // The bare endpoint, no ?category= filter — confirms this is a
    // genuinely separate fetch from the existing Best-Picture-only one.
    expect(axios.get).toHaveBeenCalledWith('https://web-production-b8145.up.railway.app/awards')
    expect(store.state.allAcademyAwards).toHaveLength(3)
    expect(store.state.allAcademyAwards[0]).toMatchObject({ category: 'Best Picture', isWinner: true, isActing: false })
    expect(store.state.allAcademyAwards[1]).toMatchObject({ category: 'Best Actor', isWinner: true, isActing: true })
    expect(store.state.allAcademyAwards[2]).toMatchObject({ category: 'Best Actor', isWinner: false, isActing: true })
    expect(saveSnapshotMock).toHaveBeenCalledWith('global', 'allAcademyAwards', store.state.allAcademyAwards)
  })

  it('falls back to the IndexedDB snapshot without clobbering already-arrived live data (same race as movieLog/settings)', async () => {
    let resolveCache
    loadSnapshotMock.mockImplementation((topKey, kind) => {
      if (kind === 'allAcademyAwards') return new Promise((resolve) => { resolveCache = resolve })
      return Promise.resolve(null)
    })
    axios.get.mockImplementation((url) => {
      if (url === 'https://web-production-b8145.up.railway.app/awards') {
        return Promise.resolve({ data: [{ id: 9, category: 'Best Picture', tmdb: '900', year: 2020, isWinner: '1', isActing: '0' }] })
      }
      return Promise.resolve({ data: [] })
    })

    await store.dispatch('initializeDB')
    await flushMicrotasks()
    expect(store.state.allAcademyAwards).toEqual([{ id: 9, category: 'Best Picture', tmdb: '900', year: 2020, isWinner: true, isActing: false }])

    // The cache read resolving afterward (slower than the live fetch) must
    // NOT clobber the already-arrived live data.
    resolveCache([{ id: 1, category: 'Stale', isWinner: true, isActing: false }])
    await flushMicrotasks()
    expect(store.state.allAcademyAwards).toEqual([{ id: 9, category: 'Best Picture', tmdb: '900', year: 2020, isWinner: true, isActing: false }])
  })

  it('does not re-fetch once already populated (fetch-once guard, same convention as academyAwardWinners)', async () => {
    store.commit('setAllAcademyAwards', [{ id: 1, category: 'Best Picture', isWinner: true }])
    axios.get.mockImplementation(() => Promise.resolve({ data: [] }))

    await store.dispatch('initializeDB')

    expect(axios.get).not.toHaveBeenCalledWith('https://web-production-b8145.up.railway.app/awards')
  })

  it('is not reset by resetLocalDB, unlike the per-account movieLog/settings/academyAwardWinners (this data is not user-specific)', async () => {
    const populated = [{ id: 1, category: 'Best Picture', isWinner: true }]
    store.commit('setAllAcademyAwards', populated)
    // resetLocalDB also clears academyAwardWinners, re-triggering ITS
    // (pre-existing, unrelated) Best-Picture fetch — resolve that one
    // immediately with empty data so it doesn't block this test; if the
    // guard under test were actually broken and the bare /awards endpoint
    // got hit too, this same empty response would overwrite
    // allAcademyAwards to [], correctly failing the assertion below rather
    // than hanging.
    axios.get.mockImplementation(() => Promise.resolve({ data: [] }))

    await store.dispatch('resetLocalDB')

    expect(store.state.allAcademyAwards).toEqual(populated)
  })
})

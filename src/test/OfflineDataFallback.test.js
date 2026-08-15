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
const queryMock = vi.fn((target, ...clauses) => ({ __query: target, clauses }))
const getMock = vi.fn(() => Promise.resolve({ val: () => null }))
vi.mock('firebase/database', () => ({
  serverTimestamp: () => ({ '.sv': 'timestamp' }),
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn((db, path) => path),
  onValue: (...args) => onValueMock(...args),
  set: vi.fn(),
  query: (...args) => queryMock(...args),
  orderByChild: (field) => ({ orderByChild: field }),
  startAt: (value) => ({ startAt: value }),
  get: (...args) => getMock(...args)
}))
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({}))
}))
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  OAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(),
  // Must invoke its callback: store/index.js's `authReady` promise only
  // settles from in here, and initializeDB awaits it.
  onAuthStateChanged: vi.fn((auth, callback) => { callback(null); return vi.fn() })
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
  getMock.mockReset().mockImplementation(() => Promise.resolve({ val: () => null }))
  queryMock.mockClear()
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

  describe('permission-denied reads are surfaced, not silent (locked-down rules)', () => {
    function movieLogListener () {
      const call = onValueMock.mock.calls.find(([path]) => path === 'testing-database/movieLog')
      return { deliver: call[1], cancel: call[2] }
    }

    it('a cancelled listener sets dbReadDenied and settles dbLoaded instead of hanging', async () => {
      loadSnapshotMock.mockResolvedValue(null)
      await store.dispatch('initializeDB')

      movieLogListener().cancel(new Error('permission_denied'))

      expect(store.state.dbReadDenied).toBe(true)
      expect(store.state.dbLoaded).toBe(true)
    })

    it('a denial does not clobber whatever the snapshot fallback already showed', async () => {
      loadSnapshotMock.mockImplementation((topKey, kind) => Promise.resolve(
        kind === 'movieLog' ? { cached: { movie: { id: 1, title: 'Cached Movie' } } } : null
      ))
      await store.dispatch('initializeDB')
      await flushMicrotasks()

      movieLogListener().cancel(new Error('permission_denied'))

      expect(store.state.movieLog.cached.movie.title).toBe('Cached Movie')
      expect(store.state.dbReadDenied).toBe(true)
    })

    it('signing back in re-attaches a fresh listener (bypassing the has-data guard) and the first good read clears the flag', async () => {
      loadSnapshotMock.mockImplementation((topKey, kind) => Promise.resolve(
        kind === 'movieLog' ? { cached: { movie: { id: 1, title: 'Cached Movie' } } } : null
      ))
      await store.dispatch('initializeDB')
      await flushMicrotasks()
      movieLogListener().cancel(new Error('permission_denied'))
      const listenersBefore = onValueMock.mock.calls.filter(([path]) => path === 'testing-database/movieLog').length

      // The login flow re-dispatches initializeDB once a session exists.
      await store.dispatch('initializeDB')
      const movieLogCalls = onValueMock.mock.calls.filter(([path]) => path === 'testing-database/movieLog')
      expect(movieLogCalls.length).toBe(listenersBefore + 1)

      movieLogCalls[movieLogCalls.length - 1][1]({ val: () => ({ live: { movie: { id: 2, title: 'Live Movie' } } }) })

      expect(store.state.dbReadDenied).toBe(false)
      expect(store.state.movieLog.live.movie.title).toBe('Live Movie')
    })
  })

  describe('delta sync shadow mode (phase 1: compare, act on neither)', () => {
    function fireMovieLog (data) {
      const call = onValueMock.mock.calls.find(([path]) => path === 'testing-database/movieLog')
      call[1]({ val: () => data })
    }
    const stamped = (title, updatedAt) => ({ movie: { id: title, title }, updatedAt })

    it('first launch records a lastSync baseline (max updatedAt received) without querying anything', async () => {
      loadSnapshotMock.mockResolvedValue(null)
      await store.dispatch('initializeDB')

      fireMovieLog({ a: stamped('A', 100), b: stamped('B', 250) })
      await flushMicrotasks()

      expect(getMock).not.toHaveBeenCalled()
      expect(saveSnapshotMock).toHaveBeenCalledWith('testing-database', 'deltaSyncMeta', expect.objectContaining({ lastSync: 250 }))
      expect(store.state.deltaShadowReport).toBeNull()
    })

    it('with a baseline: runs the delta query from lastSync, reconstructs, and reports identical when it matches', async () => {
      loadSnapshotMock.mockImplementation((topKey, kind) => Promise.resolve(
        kind === 'deltaSyncMeta' ? { lastSync: 100 }
          : kind === 'movieLog' ? { a: stamped('A', 50), b: stamped('B old', 100) }
            : null
      ))
      getMock.mockImplementation((target) => Promise.resolve({
        val: () => (target.__query ? { b: stamped('B new', 300) } : null)
      }))
      await store.dispatch('initializeDB')
      await flushMicrotasks()

      fireMovieLog({ a: stamped('A', 50), b: stamped('B new', 300) })
      await flushMicrotasks()

      const queryArg = getMock.mock.calls.find(([target]) => target.__query)[0]
      expect(queryArg.clauses).toEqual([{ orderByChild: 'updatedAt' }, { startAt: 100 }])
      expect(store.state.deltaShadowReport.identical).toBe(true)
      expect(store.state.deltaShadowReport.deltaEntryCount).toBe(1)
      expect(saveSnapshotMock).toHaveBeenCalledWith('testing-database', 'deltaSyncMeta', expect.objectContaining({ lastSync: 300 }))
    })

    it('reports divergence when the reconstruction misses something the full download has', async () => {
      loadSnapshotMock.mockImplementation((topKey, kind) => Promise.resolve(
        kind === 'deltaSyncMeta' ? { lastSync: 100 }
          : kind === 'movieLog' ? { a: stamped('A', 50) }
            : null
      ))
      // Delta returns nothing — but the full download has a NEW entry, so
      // the delta path would have silently omitted it. The exact failure
      // shape shadow mode exists to catch.
      getMock.mockImplementation(() => Promise.resolve({ val: () => null }))
      await store.dispatch('initializeDB')
      await flushMicrotasks()

      fireMovieLog({ a: stamped('A', 50), b: stamped('B missed', 300) })
      await flushMicrotasks()

      expect(store.state.deltaShadowReport.identical).toBe(false)
      expect(store.state.deltaShadowReport.missing).toEqual(['b'])
    })

    it('applies a newer tombstone during reconstruction, so a deletion synced by delta matches', async () => {
      loadSnapshotMock.mockImplementation((topKey, kind) => Promise.resolve(
        kind === 'deltaSyncMeta' ? { lastSync: 100 }
          : kind === 'movieLog' ? { a: stamped('A', 50), gone: stamped('Gone', 90) }
            : null
      ))
      getMock.mockImplementation((target) => Promise.resolve({
        val: () => (target.__query ? null : { gone: 200 })
      }))
      await store.dispatch('initializeDB')
      await flushMicrotasks()

      fireMovieLog({ a: stamped('A', 50) })
      await flushMicrotasks()

      expect(store.state.deltaShadowReport.identical).toBe(true)
    })

    it('runs the comparison once per session, not on every listener refire', async () => {
      loadSnapshotMock.mockImplementation((topKey, kind) => Promise.resolve(
        kind === 'deltaSyncMeta' ? { lastSync: 100 }
          : kind === 'movieLog' ? { a: stamped('A', 50) }
            : null
      ))
      getMock.mockImplementation(() => Promise.resolve({ val: () => null }))
      await store.dispatch('initializeDB')
      await flushMicrotasks()

      fireMovieLog({ a: stamped('A', 50) })
      await flushMicrotasks()
      const callsAfterFirst = getMock.mock.calls.length

      fireMovieLog({ a: stamped('A', 50) })
      await flushMicrotasks()

      expect(getMock.mock.calls.length).toBe(callsAfterFirst)
    })
  })

  it('does not attempt a live listener or cache read when no databaseTopKey is available', async () => {
    store.commit('setDevMode', false)

    await store.dispatch('initializeDB')

    expect(onValueMock).not.toHaveBeenCalled()
    expect(loadSnapshotMock).not.toHaveBeenCalled()
  })
})

// The Best Picture list is enriched with ONE TMDB call per winner (~98 of
// them, sequentially). It had no persistence at all, so every cold launch
// re-ran all 98 requests — by far the largest source of API traffic in the app.
describe('initializeDB: Best Picture enrichment is cached', () => {
  beforeEach(() => {
    store.commit('setAcademyAwardWinners', {})
    axios.get.mockReset()
    loadSnapshotMock.mockImplementation(() => Promise.resolve(null))
    store.commit('setAllAcademyAwards', [{ id: 'skip' }])
  })

  it('makes no TMDB calls at all when the snapshot already has the winners', async () => {
    loadSnapshotMock.mockImplementation((topKey, kind) => {
      if (kind === 'academyAwardWinners') {
        return Promise.resolve({ bestPicture: [{ id: 1, title: 'Cached Winner', academyAwardsYear: 1994 }] })
      }
      return Promise.resolve(null)
    })

    await store.dispatch('initializeDB')
    await flushMicrotasks()

    expect(store.state.academyAwardWinners.bestPicture).toHaveLength(1)
    const tmdbCalls = axios.get.mock.calls.filter(([url]) => url.includes('api.themoviedb.org'))
    expect(tmdbCalls).toHaveLength(0)
  })

  it('enriches and then caches when there is no snapshot', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('category=Best%20Picture')) {
        return Promise.resolve({ data: [
          { tmdb: '100', year: 1994, isWinner: '1' },
          { tmdb: '200', year: 1995, isWinner: '1' }
        ] })
      }
      if (url.includes('api.themoviedb.org')) {
        return Promise.resolve({ data: { id: 100, title: 'A Winner' } })
      }
      return Promise.resolve({ data: [] })
    })

    await store.dispatch('initializeDB')
    await flushMicrotasks()

    expect(store.state.academyAwardWinners.bestPicture).toHaveLength(2)
    expect(saveSnapshotMock).toHaveBeenCalledWith('global', 'academyAwardWinners', expect.any(Object))
  })

  it('does not cache an empty result, so a failed fetch is retried next launch', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('category=Best%20Picture')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })

    await store.dispatch('initializeDB')
    await flushMicrotasks()

    const cachedWinners = saveSnapshotMock.mock.calls.filter(([, kind]) => kind === 'academyAwardWinners')
    expect(cachedWinners).toHaveLength(0)
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

  // Deliberately NOT a race any more. It used to kick off the cache read and
  // the ~5.25MB network fetch together, so the snapshot only ever won a race to
  // first paint and the download happened on every launch regardless. Awaiting
  // the cache first is the whole cost fix.
  it('downloads nothing when the snapshot already has it', async () => {
    loadSnapshotMock.mockImplementation((topKey, kind) => {
      if (kind === 'allAcademyAwards') {
        return Promise.resolve([{ id: 1, category: 'Cached', isWinner: true, isActing: false }])
      }
      return Promise.resolve(null)
    })

    await store.dispatch('initializeDB')
    await flushMicrotasks()

    expect(store.state.allAcademyAwards).toEqual([{ id: 1, category: 'Cached', isWinner: true, isActing: false }])
    expect(axios.get).not.toHaveBeenCalledWith('https://web-production-b8145.up.railway.app/awards')
  })

  it('fetches and caches when the snapshot is empty', async () => {
    loadSnapshotMock.mockImplementation(() => Promise.resolve(null))
    axios.get.mockImplementation((url) => {
      if (url === 'https://web-production-b8145.up.railway.app/awards') {
        return Promise.resolve({ data: [{ id: 9, category: 'Best Picture', tmdb: '900', year: 2020, isWinner: '1', isActing: '0' }] })
      }
      return Promise.resolve({ data: [] })
    })

    await store.dispatch('initializeDB')
    await flushMicrotasks()

    expect(store.state.allAcademyAwards).toEqual([{ id: 9, category: 'Best Picture', tmdb: '900', year: 2020, isWinner: true, isActing: false }])
    expect(saveSnapshotMock).toHaveBeenCalledWith('global', 'allAcademyAwards', expect.any(Array))
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

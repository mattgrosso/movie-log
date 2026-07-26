import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import ReconcilePlaceholder from '@/components/ReconcilePlaceholder.vue'
import MediaResultGrid from '@/components/MediaResultGrid.vue'

vi.mock('axios', () => ({
  default: { get: vi.fn() }
}))

const listPendingWritesMock = vi.fn()
const enqueueWriteMock = vi.fn((entry) => Promise.resolve({ id: 'finalize-queued-1', attempts: 0, lastError: null, createdAt: Date.now(), ...entry }))
const removePendingWriteMock = vi.fn(() => Promise.resolve())
vi.mock('@/utils/pendingWriteQueue.js', () => ({
  listPendingWrites: (...args) => listPendingWritesMock(...args),
  enqueueWrite: (...args) => enqueueWriteMock(...args),
  removePendingWrite: (...args) => removePendingWriteMock(...args)
}))

const shapeTmdbMovieMock = vi.fn()
vi.mock('@/assets/javascript/AddRating.js', () => ({
  shapeTmdbMovie: (...args) => shapeTmdbMovieMock(...args)
}))

vi.mock('@/services/ErrorLogService.js', () => ({
  default: { error: vi.fn() }
}))

const QUEUE_ENTRY = {
  id: 'queue-1',
  type: 'placeholder',
  status: 'unreconciled',
  title: 'Remembered Movie',
  year: '2010',
  ratings: [{ id: 'offline-abc', title: 'Remembered Movie', love: 8 }],
  dbEntry: { path: 'movieLog/offline-key', value: { movie: { id: 'offline-abc', isPendingReconciliation: true }, ratings: [] } }
}

function factory ({ queueEntries = [QUEUE_ENTRY], isOnline = true, dbKey = 'offline-key' } = {}) {
  listPendingWritesMock.mockReset().mockResolvedValue(queueEntries)
  const commit = vi.fn()
  const dispatch = vi.fn(() => Promise.resolve())
  const push = vi.fn()

  const wrapper = shallowMount(ReconcilePlaceholder, {
    global: {
      mocks: {
        $store: { state: { isOnline }, commit, dispatch },
        $route: { params: { dbKey } },
        $router: { push }
      }
    }
  })

  return { wrapper, commit, dispatch, push }
}

describe('ReconcilePlaceholder', () => {
  beforeEach(async () => {
    const axios = (await import('axios')).default
    axios.get.mockReset().mockResolvedValue({ data: { results: [] } })
    enqueueWriteMock.mockClear()
    removePendingWriteMock.mockClear()
    shapeTmdbMovieMock.mockReset()
  })

  it('finds the matching queue entry by dbKey and pre-fills the search query', async () => {
    const { wrapper } = factory()
    await wrapper.vm.$nextTick()
    await Promise.resolve()
    await Promise.resolve()

    expect(wrapper.vm.queueEntry).toEqual(QUEUE_ENTRY)
    expect(wrapper.vm.query).toBe('Remembered Movie')
  })

  it('shows the "not found" state when no queue entry matches the route dbKey', async () => {
    const { wrapper } = factory({ queueEntries: [] })
    await wrapper.vm.$nextTick()
    await Promise.resolve()

    expect(wrapper.vm.queueEntry).toBeNull()
    expect(wrapper.find('.reconcile-content').exists()).toBe(false)
  })

  it('does not attempt a search while offline', async () => {
    const axios = (await import('axios')).default
    const { wrapper } = factory({ isOnline: false })
    await wrapper.vm.$nextTick()
    await Promise.resolve()

    expect(axios.get).not.toHaveBeenCalled()
  })

  describe('selectMatch', () => {
    it('finalizes the placeholder: shapes the real TMDb movie, commits it locally at the SAME dbKey, writes it directly (no queue involvement), and clears the placeholder queue entry', async () => {
      const finalMovie = { id: 603, title: 'The Matrix', poster_path: '/matrix.jpg', genres: [] }
      shapeTmdbMovieMock.mockResolvedValue(finalMovie)
      const { wrapper, commit, dispatch, push } = factory()
      await wrapper.vm.$nextTick()
      await Promise.resolve()
      await Promise.resolve()

      await wrapper.vm.selectMatch({ id: 603, title: 'The Matrix' })

      expect(shapeTmdbMovieMock).toHaveBeenCalledWith(603, QUEUE_ENTRY.ratings)
      expect(commit).toHaveBeenCalledWith('setMovieLogEntry', {
        key: 'offline-key',
        value: { movie: finalMovie, ratings: QUEUE_ENTRY.ratings }
      })
      // A direct, awaited write - not enqueue-then-background-flush (see
      // writeDatabaseEntryNow's comment in store/index.js for why this is
      // what guarantees the match is actually confirmed).
      expect(dispatch).toHaveBeenCalledWith('writeDatabaseEntryNow', {
        path: 'movieLog/offline-key', value: { movie: finalMovie, ratings: QUEUE_ENTRY.ratings }
      })
      expect(enqueueWriteMock).not.toHaveBeenCalled()
      expect(removePendingWriteMock).toHaveBeenCalledWith('queue-1')
      expect(dispatch).toHaveBeenCalledWith('refreshPendingReconciliations')
      expect(push).toHaveBeenCalledWith('/')
    })

    it('shows an error and does not navigate away if shaping the TMDb movie fails', async () => {
      shapeTmdbMovieMock.mockRejectedValue(new Error('network down'))
      const { wrapper, push } = factory()
      await wrapper.vm.$nextTick()
      await Promise.resolve()
      await Promise.resolve()

      await wrapper.vm.selectMatch({ id: 603, title: 'The Matrix' })

      expect(wrapper.vm.searchError).toBeTruthy()
      expect(push).not.toHaveBeenCalled()
      expect(removePendingWriteMock).not.toHaveBeenCalled()
    })

    it('shows an error, leaves the queue entry untouched, and does not navigate away if the direct write itself fails', async () => {
      const finalMovie = { id: 603, title: 'The Matrix', poster_path: '/matrix.jpg', genres: [] }
      shapeTmdbMovieMock.mockResolvedValue(finalMovie)
      const { wrapper, dispatch, push } = factory()
      dispatch.mockImplementation((action) => {
        if (action === 'writeDatabaseEntryNow') return Promise.reject(new Error('write failed'))
        return Promise.resolve()
      })
      await wrapper.vm.$nextTick()
      await Promise.resolve()
      await Promise.resolve()

      await wrapper.vm.selectMatch({ id: 603, title: 'The Matrix' })

      expect(wrapper.vm.searchError).toBeTruthy()
      expect(push).not.toHaveBeenCalled()
      expect(removePendingWriteMock).not.toHaveBeenCalled()
    })
  })

  describe('skip', () => {
    it('navigates home without touching the queue entry', async () => {
      const { wrapper, push } = factory()
      await wrapper.vm.$nextTick()
      await Promise.resolve()

      wrapper.vm.skip()

      expect(push).toHaveBeenCalledWith('/')
      expect(removePendingWriteMock).not.toHaveBeenCalled()
    })
  })

  it('renders a MediaResultGrid wired to selectMatch', async () => {
    const { wrapper } = factory({ isOnline: true })
    await wrapper.vm.$nextTick()
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(MediaResultGrid).exists()).toBe(true)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { enqueueWrite, listPendingWrites, removePendingWrite, updatePendingWrite } from '@/utils/pendingWriteQueue.js'

describe('pendingWriteQueue', () => {
  beforeEach(() => {
    indexedDB = new IDBFactory() // eslint-disable-line no-global-assign
  })

  it('returns an empty array when nothing has been queued', async () => {
    expect(await listPendingWrites()).toEqual([])
  })

  it('round-trips a queued write', async () => {
    const record = await enqueueWrite({ type: 'write', dbEntry: { path: 'movieLog/abc', value: { movie: { id: 1 } } } })

    expect(record.id).toBeTruthy()
    expect(record.createdAt).toBeTypeOf('number')
    expect(record.attempts).toBe(0)
    expect(record.lastError).toBeNull()

    const all = await listPendingWrites()
    expect(all).toHaveLength(1)
    expect(all[0].dbEntry.path).toBe('movieLog/abc')
  })

  it('lists entries oldest-first regardless of insertion/key order', async () => {
    const first = await enqueueWrite({ type: 'write', dbEntry: { path: 'movieLog/a', value: {} } })
    // Force a distinguishable createdAt without relying on real timing.
    await updatePendingWrite(first.id, { createdAt: 100 })
    const second = await enqueueWrite({ type: 'write', dbEntry: { path: 'movieLog/b', value: {} } })
    await updatePendingWrite(second.id, { createdAt: 50 })

    const all = await listPendingWrites()
    expect(all.map((entry) => entry.dbEntry.path)).toEqual(['movieLog/b', 'movieLog/a'])
  })

  it('dedupes repeated writes to the same path (type "write") by overwriting the existing entry in place', async () => {
    const first = await enqueueWrite({ type: 'write', dbEntry: { path: 'movieLog/abc', value: { version: 1 } } })
    const second = await enqueueWrite({ type: 'write', dbEntry: { path: 'movieLog/abc', value: { version: 2 } } })

    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(first.createdAt)

    const all = await listPendingWrites()
    expect(all).toHaveLength(1)
    expect(all[0].dbEntry.value.version).toBe(2)
  })

  it('does not dedupe placeholder entries by path - each is its own independent queue entry', async () => {
    await enqueueWrite({ type: 'placeholder', dbEntry: { path: 'movieLog/x', value: {} }, status: 'unreconciled' })
    await enqueueWrite({ type: 'placeholder', dbEntry: { path: 'movieLog/x', value: {} }, status: 'unreconciled' })

    const all = await listPendingWrites()
    expect(all).toHaveLength(2)
  })

  it('removes an entry by id', async () => {
    const record = await enqueueWrite({ type: 'write', dbEntry: { path: 'movieLog/abc', value: {} } })
    await removePendingWrite(record.id)

    expect(await listPendingWrites()).toEqual([])
  })

  it('merges a patch into an existing entry via updatePendingWrite', async () => {
    const record = await enqueueWrite({ type: 'write', dbEntry: { path: 'movieLog/abc', value: {} } })
    const updated = await updatePendingWrite(record.id, { attempts: 2, lastError: 'boom' })

    expect(updated.attempts).toBe(2)
    expect(updated.lastError).toBe('boom')
    expect(updated.dbEntry.path).toBe('movieLog/abc') // untouched fields preserved

    const all = await listPendingWrites()
    expect(all[0].attempts).toBe(2)
  })

  it('updatePendingWrite resolves null for a non-existent id', async () => {
    expect(await updatePendingWrite('does-not-exist', { attempts: 1 })).toBeNull()
  })

  it('resolves gracefully instead of throwing when IndexedDB is unavailable', async () => {
    const realIndexedDB = indexedDB
    indexedDB = undefined // eslint-disable-line no-global-assign

    await expect(enqueueWrite({ type: 'write', dbEntry: { path: 'movieLog/x', value: {} } })).resolves.toBeNull()
    await expect(listPendingWrites()).resolves.toEqual([])
    await expect(removePendingWrite('x')).resolves.toBeUndefined()
    await expect(updatePendingWrite('x', {})).resolves.toBeNull()

    indexedDB = realIndexedDB // eslint-disable-line no-global-assign
  })
})

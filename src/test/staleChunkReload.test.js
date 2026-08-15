import { describe, it, expect, vi } from 'vitest'
import { isStaleChunkError, handleRouterChunkError } from '@/utils/staleChunkReload.js'

function memoryStorage () {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  }
}

describe('isStaleChunkError', () => {
  it('recognizes webpack ChunkLoadError by name', () => {
    const error = new Error('Loading chunk awards failed.')
    error.name = 'ChunkLoadError'
    expect(isStaleChunkError(error)).toBe(true)
  })

  it('recognizes chunk failures by message across browser wordings', () => {
    expect(isStaleChunkError(new Error('Loading chunk 42 failed. (missing: https://x/js/awards.abc.js)'))).toBe(true)
    expect(isStaleChunkError(new Error('Loading CSS chunk games failed'))).toBe(true)
    expect(isStaleChunkError(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isStaleChunkError(new Error('Importing a module script failed.'))).toBe(true)
  })

  it('ignores ordinary errors and absent errors', () => {
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isStaleChunkError(null)).toBe(false)
  })
})

describe('handleRouterChunkError', () => {
  const chunkError = () => {
    const error = new Error('Loading chunk awards failed.')
    error.name = 'ChunkLoadError'
    return error
  }

  it('reloads once for a stale chunk on a route', () => {
    const reload = vi.fn()
    const storage = memoryStorage()

    const handled = handleRouterChunkError(chunkError(), { fullPath: '/awards?year=1997' }, storage, reload)

    expect(handled).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('never reload-loops: a second failure on the same route this session is left alone', () => {
    const reload = vi.fn()
    const storage = memoryStorage()

    handleRouterChunkError(chunkError(), { fullPath: '/awards' }, storage, reload)
    const second = handleRouterChunkError(chunkError(), { fullPath: '/awards' }, storage, reload)

    expect(second).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a different route gets its own single attempt', () => {
    const reload = vi.fn()
    const storage = memoryStorage()

    handleRouterChunkError(chunkError(), { fullPath: '/awards' }, storage, reload)
    handleRouterChunkError(chunkError(), { fullPath: '/watchlist' }, storage, reload)

    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('does not reload for non-chunk navigation errors', () => {
    const reload = vi.fn()

    const handled = handleRouterChunkError(new Error('Navigation cancelled'), { fullPath: '/x' }, memoryStorage(), reload)

    expect(handled).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('still reloads when storage is unavailable (reload beats a dead screen)', () => {
    const reload = vi.fn()
    const broken = {
      getItem () { throw new Error('denied') },
      setItem () { throw new Error('denied') }
    }

    expect(handleRouterChunkError(chunkError(), { fullPath: '/x' }, broken, reload)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

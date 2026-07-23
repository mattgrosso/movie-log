import { describe, it, expect, vi } from 'vitest'
import { collectImageUrls, warmImageCache, posterUrl, backdropUrl } from '@/assets/javascript/offlinePosterCache.js'

describe('posterUrl / backdropUrl', () => {
  it('builds the same size-specific urls collectImageUrls uses', () => {
    expect(posterUrl('/poster1.jpg')).toBe('https://image.tmdb.org/t/p/w342/poster1.jpg')
    expect(backdropUrl('/backdrop1.jpg')).toBe('https://image.tmdb.org/t/p/w500/backdrop1.jpg')
  })

  it('returns null for a missing path instead of a malformed url', () => {
    expect(posterUrl(null)).toBeNull()
    expect(posterUrl(undefined)).toBeNull()
    expect(backdropUrl(null)).toBeNull()
  })
})

describe('collectImageUrls', () => {
  it('builds a poster (w342) and backdrop (w500) url per movie', () => {
    const movieLog = {
      'movie-1': { movie: { id: 1, poster_path: '/poster1.jpg', backdrop_path: '/backdrop1.jpg' } }
    }

    const urls = collectImageUrls(movieLog)

    expect(urls).toContain('https://image.tmdb.org/t/p/w342/poster1.jpg')
    expect(urls).toContain('https://image.tmdb.org/t/p/w500/backdrop1.jpg')
    expect(urls).toHaveLength(2)
  })

  it('skips movies with no poster/backdrop and entries with no movie object', () => {
    const movieLog = {
      'movie-1': { movie: { id: 1 } },
      'movie-2': { notAMovie: true },
      'movie-3': { movie: { id: 3, poster_path: '/poster3.jpg' } }
    }

    const urls = collectImageUrls(movieLog)

    expect(urls).toEqual(['https://image.tmdb.org/t/p/w342/poster3.jpg'])
  })

  it('dedupes identical urls (two entries sharing the same poster)', () => {
    const movieLog = {
      'movie-1': { movie: { id: 1, poster_path: '/shared.jpg' } },
      'movie-2': { movie: { id: 2, poster_path: '/shared.jpg' } }
    }

    const urls = collectImageUrls(movieLog)

    expect(urls).toEqual(['https://image.tmdb.org/t/p/w342/shared.jpg'])
  })

  it('returns an empty array for an empty or missing movieLog', () => {
    expect(collectImageUrls({})).toEqual([])
    expect(collectImageUrls(undefined)).toEqual([])
  })
})

describe('warmImageCache', () => {
  it('fetches every url with mode: no-cors', async () => {
    const urls = ['https://image.tmdb.org/t/p/w342/a.jpg', 'https://image.tmdb.org/t/p/w342/b.jpg']
    const fetchFn = vi.fn().mockResolvedValue({})

    const result = await warmImageCache(urls, { fetchFn, concurrency: 2 })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(fetchFn).toHaveBeenCalledWith('https://image.tmdb.org/t/p/w342/a.jpg', { mode: 'no-cors' })
    expect(result).toEqual({ completed: 2, total: 2, failed: 0 })
  })

  it('reports progress incrementally via onProgress', async () => {
    const urls = ['a', 'b', 'c']
    const fetchFn = vi.fn().mockResolvedValue({})
    const progressCalls = []

    await warmImageCache(urls, { fetchFn, concurrency: 1, onProgress: (p) => progressCalls.push({ ...p }) })

    expect(progressCalls).toEqual([
      { completed: 1, total: 3, failed: 0 },
      { completed: 2, total: 3, failed: 0 },
      { completed: 3, total: 3, failed: 0 }
    ])
  })

  it('counts failures without stopping the rest of the batch', async () => {
    const urls = ['a', 'b', 'c']
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({})

    const result = await warmImageCache(urls, { fetchFn, concurrency: 1 })

    expect(result).toEqual({ completed: 3, total: 3, failed: 1 })
  })

  it('respects an AbortSignal and stops issuing new fetches', async () => {
    const urls = ['a', 'b', 'c', 'd', 'e']
    const controller = new AbortController()
    let calls = 0
    const fetchFn = vi.fn().mockImplementation(async () => {
      calls += 1
      if (calls === 2) {
        controller.abort()
      }
      return {}
    })

    const result = await warmImageCache(urls, { fetchFn, concurrency: 1, signal: controller.signal })

    expect(result.completed).toBeLessThan(urls.length)
  })

  it('handles an empty url list without error', async () => {
    const fetchFn = vi.fn()
    const result = await warmImageCache([], { fetchFn })

    expect(fetchFn).not.toHaveBeenCalled()
    expect(result).toEqual({ completed: 0, total: 0, failed: 0 })
  })

  it('caps concurrency at the number of urls when concurrency exceeds the list size', async () => {
    const urls = ['a', 'b']
    const fetchFn = vi.fn().mockResolvedValue({})

    const result = await warmImageCache(urls, { fetchFn, concurrency: 6 })

    expect(result).toEqual({ completed: 2, total: 2, failed: 0 })
  })
})

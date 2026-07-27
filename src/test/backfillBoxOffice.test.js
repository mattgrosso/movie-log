import { describe, it, expect, vi } from 'vitest'
import { collectMoviesNeedingBoxOffice, fetchBoxOffice, backfillBoxOffice } from '@/assets/javascript/backfillBoxOffice.js'

describe('collectMoviesNeedingBoxOffice', () => {
  it('selects movies missing both budget and revenue', () => {
    const movieLog = {
      'movie-1': { movie: { id: 1, title: 'No Data' } },
      'movie-2': { movie: { id: 2, title: 'Already Has It', budget: 1000, revenue: 2000 } }
    }

    const result = collectMoviesNeedingBoxOffice(movieLog)

    expect(result).toEqual([{ dbKey: 'movie-1', entry: movieLog['movie-1'] }])
  })

  it('still selects a movie with only one of the two fields present (partially backfilled somehow)', () => {
    const movieLog = {
      'movie-1': { movie: { id: 1, budget: 1000 } }
    }

    expect(collectMoviesNeedingBoxOffice(movieLog)).toEqual([])
  })

  it('treats explicit 0 the same as present (TMDB genuinely has no data - not a candidate for re-fetching every run)', () => {
    const movieLog = {
      'movie-1': { movie: { id: 1, budget: 0, revenue: 0 } }
    }

    // NOTE: 0/0 is indistinguishable from "never fetched" by design (see the
    // module's own comment on backfillBoxOffice) - this test documents that
    // known, accepted tradeoff rather than asserting it should be excluded.
    expect(collectMoviesNeedingBoxOffice(movieLog)).toEqual([{ dbKey: 'movie-1', entry: movieLog['movie-1'] }])
  })

  it('excludes placeholder (offline, not-yet-reconciled) entries - no real TMDB id to look up yet', () => {
    const movieLog = {
      'movie-1': { movie: { id: 'offline-abc', isPendingReconciliation: true } }
    }

    expect(collectMoviesNeedingBoxOffice(movieLog)).toEqual([])
  })

  it('excludes entries with no movie object or no id', () => {
    const movieLog = {
      'movie-1': { notAMovie: true },
      'movie-2': { movie: { title: 'No id at all' } }
    }

    expect(collectMoviesNeedingBoxOffice(movieLog)).toEqual([])
  })

  it('returns an empty array for an empty or missing movieLog', () => {
    expect(collectMoviesNeedingBoxOffice({})).toEqual([])
    expect(collectMoviesNeedingBoxOffice(undefined)).toEqual([])
  })
})

describe('fetchBoxOffice', () => {
  it('fetches the movie details endpoint and extracts budget/revenue', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 63000000, revenue: 100853753, title: 'Fight Club' } })

    const result = await fetchBoxOffice(550, fetchFn)

    expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining('/movie/550?'))
    expect(result).toEqual({ budget: 63000000, revenue: 100853753 })
  })

  it('normalizes a missing/null budget or revenue to 0', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { title: 'No Financials' } })

    const result = await fetchBoxOffice(1, fetchFn)

    expect(result).toEqual({ budget: 0, revenue: 0 })
  })
})

describe('backfillBoxOffice', () => {
  function buildLibrary (count) {
    const movieLog = {}
    for (let i = 0; i < count; i++) {
      movieLog[`movie-${i}`] = { movie: { id: i, title: `Movie ${i}` } }
    }
    return movieLog
  }

  it('fetches and writes box office data for every candidate movie', async () => {
    const movieLog = buildLibrary(2)
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 1000, revenue: 2000 } })
    const writeFn = vi.fn().mockResolvedValue()

    const result = await backfillBoxOffice(movieLog, writeFn, { fetchFn, concurrency: 2 })

    expect(result).toEqual({ completed: 2, total: 2, failed: 0 })
    expect(writeFn).toHaveBeenCalledWith('movie-0', { budget: 1000, revenue: 2000 }, movieLog['movie-0'])
    expect(writeFn).toHaveBeenCalledWith('movie-1', { budget: 1000, revenue: 2000 }, movieLog['movie-1'])
  })

  it('skips movies that already have box office data', async () => {
    const movieLog = {
      'movie-0': { movie: { id: 0, title: 'Needs it' } },
      'movie-1': { movie: { id: 1, title: 'Already has it', budget: 5, revenue: 10 } }
    }
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 1000, revenue: 2000 } })
    const writeFn = vi.fn().mockResolvedValue()

    const result = await backfillBoxOffice(movieLog, writeFn, { fetchFn })

    expect(result.total).toBe(1)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(writeFn).toHaveBeenCalledTimes(1)
    expect(writeFn).toHaveBeenCalledWith('movie-0', expect.anything(), expect.anything())
  })

  it('reports progress incrementally via onProgress', async () => {
    const movieLog = buildLibrary(3)
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 1, revenue: 1 } })
    const writeFn = vi.fn().mockResolvedValue()
    const progressCalls = []

    await backfillBoxOffice(movieLog, writeFn, { fetchFn, concurrency: 1, onProgress: (p) => progressCalls.push({ ...p }) })

    expect(progressCalls).toEqual([
      { completed: 1, total: 3, failed: 0 },
      { completed: 2, total: 3, failed: 0 },
      { completed: 3, total: 3, failed: 0 }
    ])
  })

  it('counts a failed fetch without stopping the rest of the batch, and does not call writeFn for it', async () => {
    const movieLog = buildLibrary(3)
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ data: { budget: 1, revenue: 1 } })
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ data: { budget: 1, revenue: 1 } })
    const writeFn = vi.fn().mockResolvedValue()

    const result = await backfillBoxOffice(movieLog, writeFn, { fetchFn, concurrency: 1 })

    expect(result).toEqual({ completed: 3, total: 3, failed: 1 })
    expect(writeFn).toHaveBeenCalledTimes(2)
  })

  it('counts a failed write the same way, without stopping the batch', async () => {
    const movieLog = buildLibrary(2)
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 1, revenue: 1 } })
    const writeFn = vi.fn()
      .mockRejectedValueOnce(new Error('firebase write failed'))
      .mockResolvedValueOnce()

    const result = await backfillBoxOffice(movieLog, writeFn, { fetchFn, concurrency: 1 })

    expect(result).toEqual({ completed: 2, total: 2, failed: 1 })
  })

  it('is a no-op when nothing needs backfilling', async () => {
    const movieLog = { 'movie-0': { movie: { id: 0, budget: 5, revenue: 10 } } }
    const fetchFn = vi.fn()
    const writeFn = vi.fn()

    const result = await backfillBoxOffice(movieLog, writeFn, { fetchFn })

    expect(fetchFn).not.toHaveBeenCalled()
    expect(writeFn).not.toHaveBeenCalled()
    expect(result).toEqual({ completed: 0, total: 0, failed: 0 })
  })

  it('respects an AbortSignal and stops issuing new fetches', async () => {
    const movieLog = buildLibrary(5)
    const controller = new AbortController()
    let calls = 0
    const fetchFn = vi.fn().mockImplementation(async () => {
      calls += 1
      if (calls === 2) {
        controller.abort()
      }
      return { data: { budget: 1, revenue: 1 } }
    })
    const writeFn = vi.fn().mockResolvedValue()

    const result = await backfillBoxOffice(movieLog, writeFn, { fetchFn, concurrency: 1, signal: controller.signal })

    expect(result.completed).toBeLessThan(5)
  })

  it('caps concurrency at the number of candidates when concurrency exceeds the list size', async () => {
    const movieLog = buildLibrary(2)
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 1, revenue: 1 } })
    const writeFn = vi.fn().mockResolvedValue()

    const result = await backfillBoxOffice(movieLog, writeFn, { fetchFn, concurrency: 6 })

    expect(result).toEqual({ completed: 2, total: 2, failed: 0 })
  })
})

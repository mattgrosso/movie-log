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

  it('fetches every candidate but writes in ONE batch when everything fits under batchSize (bug fix: not one write per movie)', async () => {
    const movieLog = buildLibrary(5)
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 1000, revenue: 2000 } })
    const writeBatchFn = vi.fn().mockResolvedValue()

    const result = await backfillBoxOffice(movieLog, writeBatchFn, { fetchFn, concurrency: 4, batchSize: 20 })

    expect(result).toEqual({ completed: 5, total: 5, failed: 0 })
    expect(fetchFn).toHaveBeenCalledTimes(5)
    expect(writeBatchFn).toHaveBeenCalledTimes(1)
    const batch = writeBatchFn.mock.calls[0][0]
    expect(batch).toHaveLength(5)
    expect(batch.map((b) => b.dbKey).sort()).toEqual(['movie-0', 'movie-1', 'movie-2', 'movie-3', 'movie-4'])
    expect(batch[0].boxOffice).toEqual({ budget: 1000, revenue: 2000 })
  })

  it('flushes a full batch as soon as batchSize is reached, without waiting for every candidate to finish', async () => {
    const movieLog = buildLibrary(25)
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 1, revenue: 1 } })
    const writeBatchFn = vi.fn().mockResolvedValue()

    const result = await backfillBoxOffice(movieLog, writeBatchFn, { fetchFn, concurrency: 1, batchSize: 10 })

    expect(result).toEqual({ completed: 25, total: 25, failed: 0 })
    // 25 candidates, batch size 10 -> two full batches of 10 flushed as they
    // fill, plus one final flush of the remaining 5.
    expect(writeBatchFn).toHaveBeenCalledTimes(3)
    const sizes = writeBatchFn.mock.calls.map((call) => call[0].length).sort((a, b) => a - b)
    expect(sizes).toEqual([5, 10, 10])
  })

  it('flushes a smaller, final partial batch at the end even if it never reached batchSize', async () => {
    const movieLog = buildLibrary(3)
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 1, revenue: 1 } })
    const writeBatchFn = vi.fn().mockResolvedValue()

    await backfillBoxOffice(movieLog, writeBatchFn, { fetchFn, concurrency: 1, batchSize: 20 })

    expect(writeBatchFn).toHaveBeenCalledTimes(1)
    expect(writeBatchFn.mock.calls[0][0]).toHaveLength(3)
  })

  it('skips movies that already have box office data', async () => {
    const movieLog = {
      'movie-0': { movie: { id: 0, title: 'Needs it' } },
      'movie-1': { movie: { id: 1, title: 'Already has it', budget: 5, revenue: 10 } }
    }
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 1000, revenue: 2000 } })
    const writeBatchFn = vi.fn().mockResolvedValue()

    const result = await backfillBoxOffice(movieLog, writeBatchFn, { fetchFn })

    expect(result.total).toBe(1)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(writeBatchFn).toHaveBeenCalledTimes(1)
    expect(writeBatchFn.mock.calls[0][0]).toHaveLength(1)
    expect(writeBatchFn.mock.calls[0][0][0].dbKey).toBe('movie-0')
  })

  it('reports progress incrementally via onProgress, once per fetch completion (not per batch flush)', async () => {
    const movieLog = buildLibrary(3)
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 1, revenue: 1 } })
    const writeBatchFn = vi.fn().mockResolvedValue()
    const progressCalls = []

    await backfillBoxOffice(movieLog, writeBatchFn, { fetchFn, concurrency: 1, batchSize: 20, onProgress: (p) => progressCalls.push({ ...p }) })

    expect(progressCalls).toEqual([
      { completed: 1, total: 3, failed: 0 },
      { completed: 2, total: 3, failed: 0 },
      { completed: 3, total: 3, failed: 0 }
    ])
  })

  it('counts a failed fetch without stopping the rest of the batch, and excludes it from the eventual write batch', async () => {
    const movieLog = buildLibrary(3)
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ data: { budget: 1, revenue: 1 } })
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ data: { budget: 1, revenue: 1 } })
    const writeBatchFn = vi.fn().mockResolvedValue()

    const result = await backfillBoxOffice(movieLog, writeBatchFn, { fetchFn, concurrency: 1, batchSize: 20 })

    expect(result).toEqual({ completed: 3, total: 3, failed: 1 })
    expect(writeBatchFn.mock.calls[0][0]).toHaveLength(2)
  })

  it('counts every movie in a batch as failed if the batch write itself fails, without stopping the run', async () => {
    const movieLog = buildLibrary(3)
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 1, revenue: 1 } })
    const writeBatchFn = vi.fn().mockRejectedValue(new Error('firebase update failed'))

    const result = await backfillBoxOffice(movieLog, writeBatchFn, { fetchFn, concurrency: 1, batchSize: 20 })

    expect(result).toEqual({ completed: 3, total: 3, failed: 3 })
  })

  it('is a no-op when nothing needs backfilling', async () => {
    const movieLog = { 'movie-0': { movie: { id: 0, budget: 5, revenue: 10 } } }
    const fetchFn = vi.fn()
    const writeBatchFn = vi.fn()

    const result = await backfillBoxOffice(movieLog, writeBatchFn, { fetchFn })

    expect(fetchFn).not.toHaveBeenCalled()
    expect(writeBatchFn).not.toHaveBeenCalled()
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
    const writeBatchFn = vi.fn().mockResolvedValue()

    const result = await backfillBoxOffice(movieLog, writeBatchFn, { fetchFn, concurrency: 1, signal: controller.signal })

    expect(result.completed).toBeLessThan(5)
  })

  it('caps concurrency at the number of candidates when concurrency exceeds the list size', async () => {
    const movieLog = buildLibrary(2)
    const fetchFn = vi.fn().mockResolvedValue({ data: { budget: 1, revenue: 1 } })
    const writeBatchFn = vi.fn().mockResolvedValue()

    const result = await backfillBoxOffice(movieLog, writeBatchFn, { fetchFn, concurrency: 6 })

    expect(result).toEqual({ completed: 2, total: 2, failed: 0 })
  })
})

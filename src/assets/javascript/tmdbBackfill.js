// Shared engine behind the Settings panel's per-movie TMDB backfills
// (box office, production countries).
//
// Extracted rather than copied: the concurrency + batched-write logic below
// is subtle enough that two independent copies would inevitably drift, and
// this codebase has been bitten by exactly that before (see the duplicated
// count maps that became entityCounts.js). Each backfill supplies only what's
// genuinely different — which movies still need it, what to fetch, and how to
// shape the result — and shares everything else.

/**
 * Run a per-movie backfill.
 *
 * @param candidates   [{ dbKey, entry }] — movies still needing this data
 * @param fetchOne     (entry) => Promise<value>
 * @param makeItem     (candidate, value) => batch item, shaped for writeBatchFn
 * @param writeBatchFn (batch) => Promise — persists a whole batch at once
 *
 * Fetches run with full `concurrency` (cheap, no local state touched), but
 * writes are accumulated and flushed in batches of `batchSize`. That split is
 * a bug fix, not a micro-optimisation: an earlier per-item design wrote once
 * per movie as each finished, which for a real library meant hundreds of
 * full-movieLog-copy-plus-reactivity cascades in quick succession — severe
 * enough to freeze and crash a real device's tab.
 *
 * Idempotent and safe to re-run: candidates are recomputed from current state
 * each time, so a partial run simply picks up where it left off with no
 * separate "already tried" bookkeeping.
 */
export async function runTmdbBackfill (candidates, { fetchOne, makeItem, writeBatchFn, concurrency = 4, batchSize = 20, onProgress, signal } = {}) {
  const total = candidates.length;
  let completed = 0;
  let failed = 0;
  let nextIndex = 0;
  let pending = [];

  // The grab-and-clear happens synchronously (no `await` before it), so this
  // is safe to call from several concurrent workers without a lock: whichever
  // call's synchronous section runs first empties `pending`, and any other
  // call in flight around the same moment sees it already empty and no-ops.
  // JS's run-to-completion semantics guarantee that.
  async function flush (force) {
    if (!pending.length) return;
    if (!force && pending.length < batchSize) return;
    const batch = pending;
    pending = [];
    try {
      await writeBatchFn(batch);
    } catch {
      failed += batch.length;
    }
  }

  async function worker () {
    while (nextIndex < candidates.length) {
      if (signal?.aborted) {
        break;
      }
      const candidate = candidates[nextIndex];
      nextIndex += 1;

      try {
        const value = await fetchOne(candidate.entry);
        pending.push(makeItem(candidate, value));
        await flush(false);
      } catch {
        failed += 1;
      }

      completed += 1;
      if (onProgress) {
        onProgress({ completed, total, failed });
      }
    }
  }

  const workerCount = Math.min(concurrency, candidates.length) || 1;
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  await flush(true); // whatever's left over, shorter than a full batch

  return { completed, total, failed };
}

// Shared eligibility check. An offline placeholder rating (see placeholderId.js)
// has no real TMDB id to look up until it's been reconciled.
export function hasRealTmdbId (entry) {
  const movie = entry?.movie;
  if (!movie || movie.isPendingReconciliation || movie.id == null) {
    return false;
  }
  return !(typeof movie.id === 'string' && !/^\d+$/.test(movie.id));
}

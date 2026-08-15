// Delta sync phase 1 — SHADOW MODE. Pure, store-free logic for
// reconstructing "what the library should look like" from the cached
// snapshot plus a changes-since-lastSync query, and diffing that against
// the full download the app still actually runs on. Nothing here alters
// what any user sees: the full download remains the source of truth, and
// this exists purely to prove (or disprove) that the delta path produces
// an identical library before phase 2 ever trusts it.
//
// Design rules carried in from docs/history/data-and-offline.md:
//   - lastSync is the maximum updatedAt actually RECEIVED, never a local
//     clock reading — clock skew stays out of it entirely.
//   - Tombstones are advisory, compared by time: apply a deletion only when
//     the tombstone is newer than the entry's own updatedAt, so re-rating a
//     previously deleted movie wins naturally on its newer stamp.

export const UPDATED_AT_FIELD = 'updatedAt';

// The maximum finite updatedAt across a library — the next lastSync after a
// full download. Null when nothing is stamped (nothing to delta from).
export function maxUpdatedAt (movieLog) {
  let max = null;
  Object.values(movieLog || {}).forEach((entry) => {
    const stamp = entry?.[UPDATED_AT_FIELD];
    if (Number.isFinite(stamp) && (max === null || stamp > max)) max = stamp;
  });
  return max;
}

// snapshot + delta + tombstones -> the library a delta-syncing client would
// hold. `deltaEntries` is keyed by dbKey (the query result); entries in it
// replace their snapshot counterparts wholesale (that's set()'s semantics
// on the write side). Tombstones delete only when strictly newer than the
// entry they'd remove.
export function reconstructFromDelta (snapshot, deltaEntries, tombstones = {}) {
  const result = { ...(snapshot || {}) };

  Object.entries(deltaEntries || {}).forEach(([dbKey, entry]) => {
    result[dbKey] = entry;
  });

  Object.entries(tombstones || {}).forEach(([dbKey, deletedAt]) => {
    if (!Number.isFinite(deletedAt)) return;
    const entry = result[dbKey];
    if (!entry) return;
    const entryStamp = entry?.[UPDATED_AT_FIELD];
    if (!Number.isFinite(entryStamp) || deletedAt > entryStamp) {
      delete result[dbKey];
    }
  });

  return result;
}

// Compares the reconstruction against the full download (the truth).
// Returns { identical, missing, stale, extra, compared } where the three
// arrays hold dbKeys, capped so a pathological divergence can't build a
// giant report. `stale` means the key exists on both sides but the entries
// differ (deep-compared via JSON with sorted keys, so property order can't
// fake a difference).
const EXAMPLE_CAP = 20;

function stableStringify (value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export function diffLibraries (fullDownload, reconstructed) {
  const missing = [];
  const stale = [];
  const extra = [];
  const expected = fullDownload || {};
  const actual = reconstructed || {};

  Object.keys(expected).forEach((dbKey) => {
    if (!(dbKey in actual)) {
      if (missing.length < EXAMPLE_CAP) missing.push(dbKey);
    } else if (stableStringify(expected[dbKey]) !== stableStringify(actual[dbKey])) {
      if (stale.length < EXAMPLE_CAP) stale.push(dbKey);
    }
  });
  Object.keys(actual).forEach((dbKey) => {
    if (!(dbKey in expected) && extra.length < EXAMPLE_CAP) extra.push(dbKey);
  });

  return {
    identical: !missing.length && !stale.length && !extra.length,
    missing,
    stale,
    extra,
    compared: Object.keys(expected).length
  };
}

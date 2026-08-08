// Change tracking for the movie library — phase 0 of delta sync.
//
// Today every cold launch re-downloads the whole movieLog (9.49 MB after the
// Aug 2026 trim), which is what makes Firebase cost scale with app opens
// rather than with users. The fix is to ask only for what changed since the
// last sync — which requires two things this module produces, and NOTHING
// currently reads:
//
//   1. `updatedAt` on every entry that's written, so a query can order by it.
//   2. A tombstone for every entry that's DELETED, because a "what changed"
//      query can only report presence — it can never report absence, so a
//      deleted movie would otherwise linger on every other device forever.
//
// This is deliberately write-only for now. If any of it is subtly wrong we
// find out while the consequence is a stray field, not a missing movie.
// See CLAUDE.md's Delta Sync section for phases 1-3.

export const MOVIE_LOG_ROOT = 'movieLog';
export const DELETIONS_ROOT = 'movieLogDeletions';
export const UPDATED_AT_FIELD = 'updatedAt';

const segmentsOf = (path) => String(path || '').split('/').filter(Boolean);

/** The movieLog key a path touches, or null if the path isn't under movieLog. */
export function movieLogKeyForPath (path) {
  const segments = segmentsOf(path);
  if (segments[0] !== MOVIE_LOG_ROOT || segments.length < 2) return null;
  return segments[1];
}

/** True for `movieLog/<key>` exactly — the whole entry, not a field inside it. */
export function isWholeEntryPath (path) {
  const segments = segmentsOf(path);
  return segments.length === 2 && segments[0] === MOVIE_LOG_ROOT;
}

/**
 * Whether a write removes an entire entry. `MovieDetail.deleteRating` writes
 * `movieLog/<key>` = null when you delete a movie's last rating, and that is
 * the one case that needs a tombstone rather than a timestamp.
 */
export function isEntryDeletion (path, value) {
  return isWholeEntryPath(path) && (value === null || value === undefined);
}

/**
 * How a single write should actually be performed once change tracking is
 * applied. Returns one of:
 *
 *   { kind: 'set',    path, value }   — unchanged, or with updatedAt injected
 *   { kind: 'update', updates }       — atomic multi-path write
 *
 * The three shapes, and why each is what it is:
 *
 * - Not under movieLog (settings, etc.): untouched. Only the library is synced
 *   incrementally; settings are small enough to always fetch whole.
 *
 * - A whole entry: `updatedAt` is injected into the value and it stays a
 *   `set()`. Ratings are the most critical write path in the app and set()'s
 *   replace-the-whole-entry semantics are what deleteRating and addRating both
 *   depend on, so this leaves that path's mechanics completely alone.
 *
 * - A field inside an entry (`movieLog/<key>/movie/budget`): becomes an atomic
 *   `update()` carrying both the field and the entry's `updatedAt`. It has to
 *   be one round trip — stamping separately after a successful write would
 *   mean a failure between the two leaves the entry changed but unstamped,
 *   which is invisible and would silently hide it from every future sync.
 *
 * - A deletion: an atomic `update()` that removes the entry AND writes the
 *   tombstone together, so there is no window where one exists without the
 *   other. Note it must NOT also stamp `updatedAt` — `movieLog/k` and
 *   `movieLog/k/updatedAt` overlap, which Firebase rejects outright, and if it
 *   didn't the entry would come back as a timestamp and nothing else.
 */
export function stampPlanForWrite (dbEntry, timestamp) {
  const { path, value } = dbEntry;
  const key = movieLogKeyForPath(path);

  if (!key) {
    return { kind: 'set', path, value };
  }

  if (isEntryDeletion(path, value)) {
    return {
      kind: 'update',
      updates: {
        [path]: null,
        [`${DELETIONS_ROOT}/${key}`]: timestamp
      }
    };
  }

  if (isWholeEntryPath(path)) {
    // A non-object here would mean someone is replacing an entry with a
    // scalar, which no call site does; pass it through rather than inventing
    // a shape for it.
    if (!value || typeof value !== 'object') return { kind: 'set', path, value };
    return { kind: 'set', path, value: { ...value, [UPDATED_AT_FIELD]: timestamp } };
  }

  return {
    kind: 'update',
    updates: {
      [path]: value,
      [`${MOVIE_LOG_ROOT}/${key}/${UPDATED_AT_FIELD}`]: timestamp
    }
  };
}

/**
 * The same treatment for a multi-path batch (updateDatabaseEntriesNow), where
 * one write can touch many different movies at once.
 *
 * Overlapping paths are the trap here: Firebase rejects an update containing
 * both `movieLog/k` and `movieLog/k/updatedAt`. So a batch entry that IS a
 * whole entry gets the timestamp injected into its value, and only the
 * remaining keys get a sibling `updatedAt` path.
 */
export function stampUpdatesForBatch (updates, timestamp) {
  const stamped = {};
  const keysNeedingSibling = new Set();
  const wholeEntryKeys = new Set();

  Object.entries(updates || {}).forEach(([path, value]) => {
    const key = movieLogKeyForPath(path);

    if (key && isEntryDeletion(path, value)) {
      stamped[path] = null;
      stamped[`${DELETIONS_ROOT}/${key}`] = timestamp;
      wholeEntryKeys.add(key);
      return;
    }

    if (key && isWholeEntryPath(path)) {
      stamped[path] = value && typeof value === 'object'
        ? { ...value, [UPDATED_AT_FIELD]: timestamp }
        : value;
      wholeEntryKeys.add(key);
      return;
    }

    stamped[path] = value;
    if (key) keysNeedingSibling.add(key);
  });

  keysNeedingSibling.forEach((key) => {
    if (wholeEntryKeys.has(key)) return;
    stamped[`${MOVIE_LOG_ROOT}/${key}/${UPDATED_AT_FIELD}`] = timestamp;
  });

  return stamped;
}

/**
 * Entries with no `updatedAt` yet, for the one-time backfill.
 *
 * Strictly speaking a delta sync doesn't NEED these — an unstamped entry is
 * simply never returned by a delta query, which is correct as long as the
 * local snapshot already holds it. Backfilling anyway removes a whole category
 * of "why is this movie invisible to sync" reasoning later, and costs one
 * batched pass.
 */
export function collectEntriesNeedingStamp (movieLog) {
  return Object.entries(movieLog || {})
    .filter(([, entry]) => !Number.isFinite(entry?.[UPDATED_AT_FIELD]))
    .map(([dbKey]) => ({ dbKey }));
}

/**
 * The multi-path update that backfills a batch of entries.
 *
 * The value here is a PLACEHOLDER and never reaches the server: naming a
 * movieLog path in a batch is what makes stampUpdatesForBatch attach that
 * entry's real server timestamp, which overwrites this key. Spelling the path
 * out anyway keeps the intent legible rather than relying on that side effect
 * being noticed.
 */
export function stampBackfillUpdates (candidates) {
  return (candidates || []).reduce((updates, { dbKey }) => {
    updates[`${MOVIE_LOG_ROOT}/${dbKey}/${UPDATED_AT_FIELD}`] = 0;
    return updates;
  }, {});
}

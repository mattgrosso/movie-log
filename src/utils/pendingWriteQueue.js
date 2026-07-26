// Durable queue of Firebase writes that couldn't be confirmed immediately
// (offline, or a flaky connection) — a sibling to offlineStore.js, not an
// extension of it. offlineStore.js is a whole-blob snapshot cache (read
// fallback); this is individually added/updated/removed entries with a
// different lifecycle, so it gets its own IndexedDB database rather than a
// second object store bolted onto offlineStore.js's (avoiding any
// onupgradeneeded migration risk to that already-shipped store).
//
// Every entry carries a ready-to-send `dbEntry: { path, value }`. Two kinds,
// discriminated by `type`, share this one queue because they need identical
// flush mechanics for that `dbEntry` — a single list drives both "silently
// retry this write" (either type) and "prompt the user to reconcile this"
// (type 'placeholder' only):
//   - 'write': a self-contained, ready-to-send write (re-rate updates, and
//     the finalized write after reconciliation).
//   - 'placeholder': the above, plus reconciliation metadata (title/year/
//     ratings/status) for a brand-new movie rated offline with no TMDB match
//     yet.
const DB_NAME = 'cinemaRollPendingWrites';
const DB_VERSION = 1;
const STORE_NAME = 'pendingWrites';

function openDB () {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function listAll (db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function getRecord (db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function putRecord (db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Adds a new pending write, or — for type 'write' — overwrites the existing
// entry targeting the same dbEntry.path so repeated offline edits to the
// same movie before the next flush collapse to a single write (the same
// outcome the online same-path debounce already gives, just durable across
// a reload). Returns the stored record, or null if IndexedDB is unavailable.
export async function enqueueWrite (entry) {
  try {
    const db = await openDB();

    let existingId = null;
    let existingCreatedAt = null;
    if (entry.type === 'write' && entry.dbEntry?.path) {
      const all = await listAll(db);
      const match = all.find((record) => record.type === 'write' && record.dbEntry?.path === entry.dbEntry.path);
      if (match) {
        existingId = match.id;
        existingCreatedAt = match.createdAt;
      }
    }

    const record = {
      attempts: 0,
      lastError: null,
      ...entry,
      id: existingId || crypto.randomUUID(),
      createdAt: existingCreatedAt || Date.now()
    };

    await putRecord(db, record);
    return record;
  } catch {
    return null;
  }
}

// Always resolves an array (never null/throws) so callers can iterate
// unconditionally. Sorted oldest-first — IndexedDB's getAll() returns
// records in primary-key order, and the key here is a random UUID, not an
// insertion-ordered value, so an explicit createdAt sort is what actually
// guarantees FIFO processing.
export async function listPendingWrites () {
  try {
    const db = await openDB();
    const all = await listAll(db);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function removePendingWrite (id) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best-effort only — see openDB's failure modes above.
  }
}

// Merges `patch` into the existing record (e.g. attempts/lastError/status).
// Resolves null if the record doesn't exist or IndexedDB is unavailable.
export async function updatePendingWrite (id, patch) {
  try {
    const db = await openDB();
    const existing = await getRecord(db, id);
    if (!existing) return null;

    const updated = { ...existing, ...patch };
    await putRecord(db, updated);
    return updated;
  } catch {
    return null;
  }
}

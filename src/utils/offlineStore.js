// Best-effort IndexedDB snapshot cache for movieLog/settings, used as a
// fallback when initializeDB's live Firebase onValue listener can't connect
// (offline cold start). Firebase RTDB's web SDK has no built-in disk
// persistence (unlike Firestore's enableIndexedDbPersistence), so this is a
// small hand-rolled substitute: every successful live read is snapshotted
// here, and a cold offline start reads the last snapshot back instead of
// hanging forever waiting for a socket that will never connect.
const DB_NAME = 'cinemaRollOffline';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

function openDB () {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function keyFor (topKey, kind) {
  return `${topKey}:${kind}`;
}

// Never throws — a cache-write failure (unsupported browser, quota, private
// browsing) should never interrupt the real live-data path that calls this.
export async function saveSnapshot (topKey, kind, data) {
  try {
    const db = await openDB();

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(data, keyFor(topKey, kind));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best-effort only — see comment above.
  }
}

// Resolves to null (not a rejection) on any failure or cache miss, so callers
// can treat "no snapshot available" and "snapshot lookup failed" the same way.
export async function loadSnapshot (topKey, kind) {
  try {
    const db = await openDB();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(keyFor(topKey, kind));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

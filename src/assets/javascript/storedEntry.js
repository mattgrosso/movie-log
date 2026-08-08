// What a movieLog entry should actually contain when it's written.
//
// Measured Aug 2026: the library was 15.2 MB and re-downloaded in full on every
// cold launch, which is what made Firebase cost scale with app opens rather
// than with users. Half of it was crew nobody reads, and ~1.8 MB was derived or
// dead fields being written back by accident.
//
// Pure and store-free so both the write paths and the one-time migration can
// share exactly one definition of "trimmed", and it can be tested directly.

// TMDB returns every credit — 91 people per film on average, including stunts,
// hairstylists and "Thanks". These are the job titles the app actually reads or
// searches on. Matching is by SUBSTRING, mirroring getCrewMember's own loose
// matching ('Photo' catches "Director of Photography").
//
// Screenplay/Story/Novel are NOT optional extras: 754 of 1,368 movies have no
// plain "Writer" credit at all, and FavoriteWriters + Home's crew grouping both
// key off those titles. Dropping them would have silently broken writer
// attribution for more than half the library.
export const KEPT_CREW_JOBS = [
  'Director',
  'Writer',
  'Screenplay',
  'Story',
  'Novel',
  'Composer',
  'Editor',
  'Photo',
  'Producer',
  'Production Design',
  'Costume Design',
  'Casting'
];

// Injected when READING (the store's getter adds dbKey, Home's search
// memoisation adds _search) and then written straight back by any code that
// spreads a whole entry. Never real stored data.
export const RUNTIME_ENTRY_FIELDS = ['dbKey', '_search'];

// Recomputed on load everywhere it's used, so storing it is pure redundancy —
// and a stored copy could only ever drift from custom/removed keywords.
export const DERIVED_MOVIE_FIELDS = ['flatKeywords'];

export function isKeptCrewJob (job) {
  const title = String(job || '');
  return KEPT_CREW_JOBS.some((kept) => title.includes(kept));
}

export function trimCrew (crew) {
  return Array.isArray(crew) ? crew.filter((person) => isKeptCrewJob(person?.job)) : crew;
}

/**
 * The version of an entry that should be persisted: runtime-only fields
 * removed, derived fields removed, crew trimmed.
 *
 * Returns a new object; never mutates the input, which matters because callers
 * are usually handing in live store state.
 */
export function entryForStorage (entry) {
  if (!entry || typeof entry !== 'object') return entry;

  const clean = { ...entry };
  RUNTIME_ENTRY_FIELDS.forEach((field) => delete clean[field]);

  if (clean.movie && typeof clean.movie === 'object') {
    clean.movie = { ...clean.movie };
    DERIVED_MOVIE_FIELDS.forEach((field) => delete clean.movie[field]);
    if (Array.isArray(clean.movie.crew)) {
      clean.movie.crew = trimCrew(clean.movie.crew);
    }
  }

  return clean;
}

/**
 * The multi-path update that trims one already-stored entry, for the one-time
 * migration.
 *
 * `null` is how Firebase's update() DELETES a path — that's the only way to
 * remove a field without rewriting (and risking clobbering) the whole entry.
 * Returns null when there's nothing to do, so the migration can skip it
 * entirely rather than writing a no-op.
 */
export function trimUpdatesFor (dbKey, entry) {
  const updates = {};
  const movie = entry?.movie || {};

  RUNTIME_ENTRY_FIELDS.forEach((field) => {
    if (entry && entry[field] !== undefined) updates[`movieLog/${dbKey}/${field}`] = null;
  });

  DERIVED_MOVIE_FIELDS.forEach((field) => {
    if (movie[field] !== undefined) updates[`movieLog/${dbKey}/movie/${field}`] = null;
  });

  if (Array.isArray(movie.crew)) {
    const trimmed = trimCrew(movie.crew);
    if (trimmed.length !== movie.crew.length) {
      updates[`movieLog/${dbKey}/movie/crew`] = trimmed;
    }
  }

  return Object.keys(updates).length ? updates : null;
}

/** Entries that would actually change, so an already-trimmed library is a no-op. */
export function collectEntriesNeedingTrim (movieLog) {
  return Object.entries(movieLog || {})
    .map(([dbKey, entry]) => ({ dbKey, entry, updates: trimUpdatesFor(dbKey, entry) }))
    .filter((candidate) => candidate.updates);
}

/**
 * Rewrite existing entries in place.
 *
 * `writeBatchFn(batch)` persists a whole batch — batched for the same reason
 * every other migration here is (see tmdbBackfill.js): writing per-entry across
 * a real library triggers hundreds of full-movieLog copies and reactivity
 * passes in quick succession, which is severe enough to crash a phone's tab.
 */
export async function trimStoredEntries (movieLog, writeBatchFn, { batchSize = 25, onProgress, signal } = {}) {
  const candidates = collectEntriesNeedingTrim(movieLog);
  const total = candidates.length;
  let completed = 0;
  let failed = 0;

  const report = () => onProgress && onProgress({ completed, total, failed });
  report();

  for (let index = 0; index < candidates.length; index += batchSize) {
    if (signal?.aborted) break;

    const batch = candidates.slice(index, index + batchSize);
    try {
      await writeBatchFn(batch);
    } catch {
      failed += batch.length;
    }
    completed += batch.length;
    report();
  }

  return { total, completed, failed };
}

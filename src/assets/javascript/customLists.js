// Custom Lists (Brian-survey B1, approved 2026-08-15; built overnight
// 2026-08-16). User-curated collections of movies from their own library —
// "Comfort Watches", "Show the Kids", "Best Endings". Distinct from viewing
// tags, which describe a single VIEWING (where/with whom); a list is a
// standing selection of MOVIES.
//
// Stored under settings/customLists/<listId>:
//   { id, name, createdAt, updatedAt, sortMode,
//     items: { <tmdbId>: { at, order } } }
//
// Items are an OBJECT MAP keyed by TMDB id, never an array: every add and
// remove is then a single leaf write (settings/customLists/<id>/items/<tmdbId>)
// with no read-modify-write of a whole array, and Firebase can't renumber
// anything underneath us. See .claude/rules/data-writes.md.

export const SORT_MODES = Object.freeze([
  { key: 'manual', label: 'My order' },
  { key: 'added', label: 'Recently added' },
  { key: 'rating', label: 'Highest rated' },
  { key: 'release', label: 'Newest release' },
  { key: 'title', label: 'A–Z' }
]);

const MAX_NAME = 60;

// Firebase keys can't contain . $ # [ ] / — and a stable, readable id makes
// the database browsable. Collisions get a numeric suffix.
export function makeListId (name, existingIds = []) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'list';
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function sanitizeListName (name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
}

// settings.customLists (an object map) -> array, newest-touched first.
export function normalizeLists (raw) {
  return Object.entries(raw || {})
    .filter(([, list]) => list && typeof list === 'object')
    .map(([id, list]) => ({
      id,
      name: list.name || id,
      note: list.note || '',
      createdAt: Number(list.createdAt) || 0,
      updatedAt: Number(list.updatedAt) || Number(list.createdAt) || 0,
      sortMode: SORT_MODES.some((mode) => mode.key === list.sortMode) ? list.sortMode : 'manual',
      items: list.items && typeof list.items === 'object' ? list.items : {}
    }))
    .sort((a, b) => (b.updatedAt - a.updatedAt) || a.name.localeCompare(b.name));
}

export function itemCount (list) {
  return Object.keys(list?.items || {}).length;
}

export function listContains (list, tmdbId) {
  if (tmdbId == null) return false;
  return Object.prototype.hasOwnProperty.call(list?.items || {}, String(tmdbId));
}

// The next manual-order slot: one past the current maximum, so a newly
// added movie lands at the end of a hand-ordered list.
export function nextOrder (list) {
  const orders = Object.values(list?.items || {})
    .map((item) => Number(item?.order))
    .filter(Number.isFinite);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

// Resolve a list's items to real library entries, in the list's sort order.
// Items whose movie is no longer in the library are dropped (rated movies
// can be deleted); `missing` reports how many, so the UI can offer a tidy-up
// instead of silently showing a shorter list.
export function resolveListEntries (list, entries, getRatingFn, { sortMode = null } = {}) {
  const byTmdbId = new Map();
  (entries || []).forEach((entry) => {
    const id = entry?.movie?.id;
    if (id != null) byTmdbId.set(String(id), entry);
  });

  const resolved = [];
  const missingIds = [];
  Object.entries(list?.items || {}).forEach(([tmdbId, item]) => {
    const entry = byTmdbId.get(String(tmdbId));
    if (!entry) { missingIds.push(tmdbId); return; }
    resolved.push({
      entry,
      tmdbId,
      addedAt: Number(item?.at) || 0,
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : 0,
      rating: getRatingFn ? (getRatingFn(entry)?.calculatedTotal ?? null) : null
    });
  });

  const mode = sortMode || list?.sortMode || 'manual';
  const byTitle = (a, b) => (a.entry.movie.title || '').localeCompare(b.entry.movie.title || '');
  const releaseYear = (row) => new Date(row.entry?.movie?.release_date ?? NaN).getTime() || 0;

  const sorters = {
    manual: (a, b) => (a.order - b.order) || byTitle(a, b),
    added: (a, b) => (b.addedAt - a.addedAt) || byTitle(a, b),
    rating: (a, b) => ((b.rating ?? -1) - (a.rating ?? -1)) || byTitle(a, b),
    release: (a, b) => (releaseYear(b) - releaseYear(a)) || byTitle(a, b),
    title: byTitle
  };
  resolved.sort(sorters[mode] || sorters.manual);

  return { rows: resolved, missing: missingIds.length, missingIds };
}

// Headline numbers for a list card: how many, average score, and the
// span of release years it covers.
export function listStats (rows) {
  const ratings = (rows || []).map((row) => row.rating).filter(Number.isFinite);
  const years = (rows || [])
    .map((row) => new Date(row.entry?.movie?.release_date ?? NaN).getFullYear())
    .filter(Number.isFinite);
  return {
    count: (rows || []).length,
    average: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null,
    earliest: years.length ? Math.min(...years) : null,
    latest: years.length ? Math.max(...years) : null
  };
}

// Manual reorder: returns { [tmdbId]: order } for the rows whose order
// actually changes, so the caller can write only those leaves. Moving the
// first row up (or the last down) is a no-op.
export function reorderUpdates (rows, tmdbId, direction) {
  const ordered = [...(rows || [])];
  const index = ordered.findIndex((row) => String(row.tmdbId) === String(tmdbId));
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ordered.length) return {};

  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  const updates = {};
  ordered.forEach((row, position) => {
    if (row.order !== position) updates[row.tmdbId] = position;
  });
  return updates;
}

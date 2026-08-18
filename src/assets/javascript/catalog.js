// The catalog: one index of everything in the library you could filter by.
//
// Phase 1 of the filter-system redesign (Matt, 2026-08-18: "from scratch, go
// ahead and design a full system as though I didn't already have anything...
// implement all four phases"). The founding observation: every recent filter
// bug — horror returning Spider-Man, the dropped genreId, "spiderman"
// resolving to the Spiderland company — was the same defect, identity as a
// string resolved late and differently by each consumer. The catalog is
// where identity is resolved ONCE.
//
// The second observation: most of the ids were already in the database.
// AddRating stores `genres`, `production_companies` and `keywords` as TMDB's
// own objects, ids included. The old count maps kept only the names, and the
// ids were then bought back at fetch time with /search calls — which is
// where Spiderland happened. An id taken from a film in the library cannot
// be an orphan: it is attached to at least the film it came from.
//
// Cast and crew are the deliberate exception: they are stored name-only
// (crew ids were half the database once), so people remain the one kind
// that still needs a runtime lookup, guarded by pickResolvedId.
//
// Counts are NOT recomputed here. entityCounts.js is the source of truth
// for how many films an entity accounts for — MovieDetail's (N) badges read
// it directly — and a catalog that counted its own way would eventually
// disagree with the badges. The catalog consumes those maps and adds the
// one thing they lack: identity.

import {
  countDirectors,
  countCastCrew,
  countGenres,
  countKeywords,
  countStudios
} from './entityCounts.js';
import { genreIdFor } from './tmdbGenres.js';
import { normalizeSearchText } from './searchFiltering.js';

// kind → the expectedType string createFilterByType understands, and the
// short word a suggestion row shows. One place, so the catalog's consumers
// can never disagree about the mapping.
export const CATALOG_KINDS = {
  director: { expectedType: 'director', label: 'director' },
  genre: { expectedType: 'genre', label: 'genre' },
  company: { expectedType: 'studios', label: 'studio' },
  cast: { expectedType: 'cast/crew', label: 'cast' },
  keyword: { expectedType: 'keyword', label: 'keyword' }
};

/**
 * name → TMDB id, from the objects already stored on each movie.
 *
 * Identity is collected from EVERY entry, shorts included, regardless of the
 * include-shorts setting: whether a film is counted is a display preference,
 * but the id a name refers to is a fact, and a keyword learned from a short
 * is still the right id for that keyword. First sighting wins — TMDB ids
 * for a given name do not change film to film.
 */
function collectStoredIds (entries) {
  const ids = { genre: {}, company: {}, keyword: {} };

  const learn = (kind, item) => {
    if (!item?.name || item.id == null) return;
    const norm = normalizeSearchText(item.name);
    if (norm && ids[kind][norm] === undefined) {
      ids[kind][norm] = item.id;
    }
  };

  (entries || []).forEach((result) => {
    const movie = result?.movie;
    if (!movie) return;
    (movie.genres || []).forEach((genre) => learn('genre', genre));
    (movie.production_companies || []).forEach((company) => learn('company', company));
    (movie.keywords || []).forEach((keyword) => learn('keyword', keyword));
  });

  return ids;
}

/**
 * Build the catalog for a library.
 *
 * Returns `{ entries, idFor }`:
 *  - `entries`: [{ kind, name, norm, count, tmdbId }] across every kind.
 *    tmdbId is null where the library genuinely has no id — people (stored
 *    name-only) and AI/custom keywords (never TMDB's to begin with).
 *  - `idFor(kind, name)`: the resolved id for a name, however it is cased
 *    or accented, or null. This is the lookup More from uses instead of
 *    /search for anything the library already knows.
 */
export function buildCatalog (entries, includeShorts = false) {
  // entityCounts assumes well-formed entries; a damaged one (a failed write,
  // a partial migration) should cost its own row, not the whole catalog.
  const library = (entries || []).filter((result) => result?.movie);
  const ids = collectStoredIds(library);

  const catalogEntries = [];
  const fromCounts = (counts, kind, resolveId) => {
    Object.keys(counts || {}).forEach((name) => {
      if (!name) return;
      const norm = normalizeSearchText(name);
      if (!norm) return;
      catalogEntries.push({
        kind,
        name,
        norm,
        count: counts[name] || 0,
        tmdbId: resolveId ? resolveId(norm, name) : null
      });
    });
  };

  fromCounts(countDirectors(library, includeShorts), 'director', null);
  // The static TMDB genre map is the primary source — it covers a genre the
  // library spells slightly differently — with the stored object's id as
  // the fallback for anything the map doesn't know.
  fromCounts(countGenres(library, includeShorts), 'genre',
    (norm, name) => genreIdFor(name) ?? ids.genre[norm] ?? null);
  fromCounts(countStudios(library, includeShorts), 'company',
    (norm) => ids.company[norm] ?? null);
  fromCounts(countCastCrew(library, includeShorts), 'cast', null);
  // Keyword counts come from flatKeywords (TMDB + AI + custom, minus
  // removed); ids only from TMDB's own. An AI keyword gets null, which is
  // honest: TMDB has never heard of it.
  fromCounts(countKeywords(library, includeShorts), 'keyword',
    (norm) => ids.keyword[norm] ?? null);

  return {
    entries: catalogEntries,
    // Identity answers come from the raw id maps, NOT the entries list: an
    // entity can be excluded from the offered entries (a short's studio,
    // with shorts hidden) while what its name refers to remains a fact.
    idFor (kind, name) {
      const norm = normalizeSearchText(String(name || ''));
      if (!norm) return null;
      if (kind === 'genre') return genreIdFor(name) ?? ids.genre[norm] ?? null;
      return ids[kind]?.[norm] ?? null;
    }
  };
}

/**
 * The catalog projected into what the search bar's typeahead ranks: one
 * entry per distinct name, deduped across kinds in priority order (a
 * director is also crew, and both build the same person chip — the more
 * specific word survives). Same output shape rankTypeahead has always
 * consumed, now carrying the id the eventual chip will need.
 */
export function typeaheadEntries (catalog) {
  const priority = ['director', 'genre', 'company', 'cast', 'keyword'];
  const seen = new Set();
  const projected = [];

  priority.forEach((kind) => {
    const meta = CATALOG_KINDS[kind];
    (catalog?.entries || [])
      .filter((entry) => entry.kind === kind)
      .forEach((entry) => {
        if (seen.has(entry.norm)) return;
        seen.add(entry.norm);
        projected.push({
          value: entry.name,
          norm: entry.norm,
          count: entry.count,
          expectedType: meta.expectedType,
          kind: meta.label,
          tmdbId: entry.tmdbId
        });
      });
  });

  return projected;
}

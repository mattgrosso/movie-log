import {
  movieYear,
  movieDecade,
  movieGenreNames,
  movieCastNames,
  movieDirectors,
  movieWriters,
  movieComposers,
  movieCinematographers,
  movieEditors,
  movieProducers
} from './gameUtils.js';

// Pure, store-free rules for the Clue Budget game: spend a fixed starting
// budget on clues about a hidden movie, then guess it before you're broke.
// See CLAUDE.md for the full design writeup (a friend's idea, relayed by
// the user) and the reasoning behind these specific costs.

export const STARTING_BUDGET = 100;

// Costs are hand-assigned by how identifying each clue TYPICALLY is, not
// computed from any rarity model — a real rarity model would need to know
// how common a given director/actor/etc. is across ALL of TMDB, not just
// this one player's library, which isn't data this app has. Roughly:
// weak/broad category info (decade, runtime, genre) is cheap; anything
// that's basically a direct fingerprint of a specific human or a memorable
// line of copy (director, cast, tagline) is expensive.
//
// The two multi-value clue types price their successive reveals in OPPOSITE
// directions, because they're revealed in different orders for different
// reasons:
//  - Keywords have no intrinsic per-item ranking (flatKeywords is just a
//    merged/deduped bag, TMDB + AI + custom), so cost only reflects reveal
//    ORDER — each additional keyword narrows the field further on top of
//    the ones already bought, so later reveals cost MORE.
//  - Cast IS intrinsically ranked — movie.cast is saved in TMDB's own
//    billing order, and billing order roughly tracks real-world fame/
//    recognizability. The top-billed actor is normally the single most
//    identifying piece of cast info on its own (bug report: "cast member
//    #1... should cost more than someone further down"), so cost tracks
//    BILLING, not reveal order — #1 is the most expensive, #4 the
//    cheapest, even though #1 is still always offered/bought first.
const KEYWORD_COSTS = [10, 15, 20];
const CAST_COSTS = [30, 25, 20, 15];
const CAST_LIMIT = CAST_COSTS.length;

// Builds every clue AVAILABLE for this movie (not yet purchased — the
// component tracks purchase state separately). Only includes a clue when
// the underlying data actually exists for this movie (e.g. no production
// company on file → no Production Company clue) — never a clue with
// nothing to show. `tagline` is passed in explicitly rather than read off
// the entry because it isn't persisted locally (see CLAUDE.md) and has to
// be fetched live from TMDB per round; omit it (or pass a falsy value)
// before that fetch resolves and it's simply not offered yet.
export function buildClueDeck (entry, { tagline } = {}) {
  const clues = [];

  const decade = movieDecade(entry);
  if (decade != null) clues.push({ key: 'decade', label: 'Decade', cost: 5, value: `${decade}s` });

  const runtime = entry?.movie?.runtime;
  if (runtime) clues.push({ key: 'runtime', label: 'Runtime', cost: 5, value: `~${runtime} min` });

  const genres = movieGenreNames(entry);
  if (genres.length) clues.push({ key: 'genres', label: genres.length > 1 ? 'Genres' : 'Genre', cost: 8, value: genres.join(', ') });

  const producers = movieProducers(entry);
  if (producers.length) clues.push({ key: 'producer', label: 'Producer', cost: 8, value: producers[0] });

  const year = movieYear(entry);
  if (year != null) clues.push({ key: 'year', label: 'Exact Year', cost: 10, value: String(year) });

  const companies = (entry?.movie?.production_companies || []).map((c) => c.name).filter(Boolean);
  if (companies.length) clues.push({ key: 'company', label: 'Production Company', cost: 10, value: companies[0] });

  const editors = movieEditors(entry);
  if (editors.length) clues.push({ key: 'editor', label: 'Editor', cost: 10, value: editors[0] });

  const keywords = (entry?.movie?.flatKeywords || []).filter(Boolean);
  keywords.slice(0, KEYWORD_COSTS.length).forEach((keyword, index) => {
    clues.push({ key: `keyword-${index}`, label: `Theme/Keyword #${index + 1}`, cost: KEYWORD_COSTS[index], value: keyword });
  });

  const composers = movieComposers(entry);
  if (composers.length) clues.push({ key: 'composer', label: 'Composer', cost: 12, value: composers[0] });

  const cinematographers = movieCinematographers(entry);
  if (cinematographers.length) clues.push({ key: 'cinematographer', label: 'Cinematographer', cost: 12, value: cinematographers[0] });

  if (tagline) clues.push({ key: 'tagline', label: 'Tagline', cost: 15, value: tagline });

  const writers = movieWriters(entry);
  if (writers.length) clues.push({ key: 'writer', label: writers.length > 1 ? 'Writers' : 'Writer', cost: 15, value: writers.join(', ') });

  const directors = movieDirectors(entry);
  if (directors.length) clues.push({ key: 'director', label: directors.length > 1 ? 'Directors' : 'Director', cost: 20, value: directors.join(', ') });

  const cast = movieCastNames(entry, CAST_LIMIT);
  cast.forEach((name, index) => {
    clues.push({ key: `cast-${index}`, label: `Cast Member #${index + 1}`, cost: CAST_COSTS[index], value: name });
  });

  return clues;
}

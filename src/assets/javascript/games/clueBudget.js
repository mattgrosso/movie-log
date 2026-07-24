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

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// --- Dynamic pricing -------------------------------------------------
//
// TMDB gives a real `popularity` score for PEOPLE (every cast/crew member
// on a movie's own /credits response) and, indirectly, for KEYWORDS and
// COMPANIES via how many movies share that keyword/company id
// (/discover/movie's total_results — TMDB doesn't expose a popularity
// field for either directly). The component fetches these live, once per
// round (ClueBudgetGame.vue); this module just turns a raw number into a
// price once it has one. All three curves are log-scaled on purpose —
// both popularity and movie-count have a long tail (a handful of huge
// values, everything else clustered low), so a linear scale would make
// almost every real value look identically cheap or identically expensive.

const PERSON_PRICE_MIN = 8;
const PERSON_PRICE_MAX = 35;

// Direct: more universally recognizable → costs more. log2(1+p) rather
// than log2(p) so a popularity of 0 (no signal at all) doesn't blow up.
export function priceFromPersonPopularity (popularity) {
  const p = Math.max(0, popularity || 0);
  return clamp(Math.round(5 + 4.5 * Math.log2(1 + p)), PERSON_PRICE_MIN, PERSON_PRICE_MAX);
}

const KEYWORD_PRICE_MIN = 8;
const KEYWORD_PRICE_MAX = 30;

// Inverse: shared by fewer movies → narrows the field more → costs more.
// The opposite direction from person pricing, on purpose.
export function priceFromKeywordRarity (movieCount) {
  const n = Math.max(1, movieCount || 1);
  return clamp(Math.round(32 - 1.9 * Math.log2(n)), KEYWORD_PRICE_MIN, KEYWORD_PRICE_MAX);
}

const COMPANY_PRICE_MIN = 6;
const COMPANY_PRICE_MAX = 25;

// Also inverse, same reasoning as keywords, but a visibly narrower/lower
// band and gentler slope — a company's movie COUNT is a prolificness
// proxy, not a fame score (a24 vs. Warner Bros. isn't really "less
// famous," just less prolific), so it's a noisier signal than the other
// two and priced with a bit less confidence baked in.
export function priceFromCompanyRarity (movieCount) {
  const n = Math.max(1, movieCount || 1);
  return clamp(Math.round(25 - 1.5 * Math.log2(n)), COMPANY_PRICE_MIN, COMPANY_PRICE_MAX);
}

// Highest popularity among a group (e.g. co-writers, co-directors) — if
// you'd recognize ANY one of them, the clue has done its job, so price by
// whichever name in the group is most identifying.
function maxPopularity (names, peoplePopularity) {
  const known = names.map((name) => peoplePopularity[name]).filter((p) => p != null);
  return known.length ? Math.max(...known) : null;
}

// --- Fallback (fixed) costs -------------------------------------------
//
// Used until the corresponding live data resolves (or if it never does —
// a failed fetch, or a keyword/person TMDB genuinely has no id/score for).
// Same hand-assigned tier reasoning as before dynamic pricing existed:
// weak/broad category info is cheap, anything close to a direct
// fingerprint is expensive. See CLAUDE.md for the full history, including
// why CAST_COSTS specifically prices #1 (top-billed) highest, not lowest.
const FALLBACK_KEYWORD_COSTS = [10, 15, 20];
const FALLBACK_CAST_COSTS = [30, 25, 20, 15];
const CAST_LIMIT = FALLBACK_CAST_COSTS.length;
const FALLBACK_COSTS = {
  producer: 8,
  company: 10,
  editor: 10,
  composer: 12,
  cinematographer: 12,
  tagline: 15,
  writer: 15,
  director: 20
};

// Builds every clue AVAILABLE for this movie (not yet purchased — the
// component tracks purchase state separately). Only includes a clue when
// the underlying data actually exists for this movie (e.g. no production
// company on file → no Production Company clue) — never a clue with
// nothing to show.
//
// `extras` carries everything that isn't persisted locally and has to be
// fetched live from TMDB per round (see ClueBudgetGame.vue):
//   - tagline: string. Omit/falsy → no Tagline clue offered at all yet.
//   - peoplePopularity: { [personName]: popularity } from the movie's own
//     /credits response. A name missing from this map just uses the
//     fallback cost for that clue — never blocks the clue from appearing.
//   - keywordMovieCounts: { [keywordString]: total_results } — only ever
//     populated for keywords that came from TMDB (have a resolvable
//     keyword id; AI/custom keywords don't and always use the fallback).
//   - companyMovieCount: total_results for the primary production company.
// Call buildClueDeck again as each extra resolves to refresh prices in
// place — the component re-merges rather than replacing already-purchased
// clues, so a price update never retroactively changes what was paid.
export function buildClueDeck (entry, extras = {}) {
  const { tagline, peoplePopularity = {}, keywordMovieCounts = {}, companyMovieCount } = extras;
  const clues = [];

  const decade = movieDecade(entry);
  if (decade != null) clues.push({ key: 'decade', label: 'Decade', cost: 5, value: `${decade}s` });

  const runtime = entry?.movie?.runtime;
  if (runtime) clues.push({ key: 'runtime', label: 'Runtime', cost: 5, value: `~${runtime} min` });

  const genres = movieGenreNames(entry);
  if (genres.length) clues.push({ key: 'genres', label: genres.length > 1 ? 'Genres' : 'Genre', cost: 8, value: genres.join(', ') });

  const producers = movieProducers(entry);
  if (producers.length) {
    const popularity = maxPopularity(producers, peoplePopularity);
    clues.push({ key: 'producer', label: 'Producer', cost: popularity != null ? priceFromPersonPopularity(popularity) : FALLBACK_COSTS.producer, value: producers[0] });
  }

  const year = movieYear(entry);
  if (year != null) clues.push({ key: 'year', label: 'Exact Year', cost: 10, value: String(year) });

  const companies = (entry?.movie?.production_companies || []).map((c) => c.name).filter(Boolean);
  if (companies.length) {
    clues.push({ key: 'company', label: 'Production Company', cost: companyMovieCount != null ? priceFromCompanyRarity(companyMovieCount) : FALLBACK_COSTS.company, value: companies[0] });
  }

  const editors = movieEditors(entry);
  if (editors.length) {
    const popularity = maxPopularity(editors, peoplePopularity);
    clues.push({ key: 'editor', label: 'Editor', cost: popularity != null ? priceFromPersonPopularity(popularity) : FALLBACK_COSTS.editor, value: editors[0] });
  }

  const keywords = (entry?.movie?.flatKeywords || []).filter(Boolean);
  keywords.slice(0, FALLBACK_KEYWORD_COSTS.length).forEach((keyword, index) => {
    const movieCount = keywordMovieCounts[keyword];
    const cost = movieCount != null ? priceFromKeywordRarity(movieCount) : FALLBACK_KEYWORD_COSTS[index];
    clues.push({ key: `keyword-${index}`, label: `Theme/Keyword #${index + 1}`, cost, value: keyword });
  });

  const composers = movieComposers(entry);
  if (composers.length) {
    const popularity = maxPopularity(composers, peoplePopularity);
    clues.push({ key: 'composer', label: 'Composer', cost: popularity != null ? priceFromPersonPopularity(popularity) : FALLBACK_COSTS.composer, value: composers[0] });
  }

  const cinematographers = movieCinematographers(entry);
  if (cinematographers.length) {
    const popularity = maxPopularity(cinematographers, peoplePopularity);
    clues.push({ key: 'cinematographer', label: 'Cinematographer', cost: popularity != null ? priceFromPersonPopularity(popularity) : FALLBACK_COSTS.cinematographer, value: cinematographers[0] });
  }

  if (tagline) clues.push({ key: 'tagline', label: 'Tagline', cost: FALLBACK_COSTS.tagline, value: tagline });

  const writers = movieWriters(entry);
  if (writers.length) {
    const popularity = maxPopularity(writers, peoplePopularity);
    clues.push({ key: 'writer', label: writers.length > 1 ? 'Writers' : 'Writer', cost: popularity != null ? priceFromPersonPopularity(popularity) : FALLBACK_COSTS.writer, value: writers.join(', ') });
  }

  const directors = movieDirectors(entry);
  if (directors.length) {
    const popularity = maxPopularity(directors, peoplePopularity);
    clues.push({ key: 'director', label: directors.length > 1 ? 'Directors' : 'Director', cost: popularity != null ? priceFromPersonPopularity(popularity) : FALLBACK_COSTS.director, value: directors.join(', ') });
  }

  const cast = movieCastNames(entry, CAST_LIMIT);
  cast.forEach((name, index) => {
    const popularity = peoplePopularity[name];
    const cost = popularity != null ? priceFromPersonPopularity(popularity) : FALLBACK_CAST_COSTS[index];
    clues.push({ key: `cast-${index}`, label: `Cast Member #${index + 1}`, cost, value: name });
  });

  return clues;
}

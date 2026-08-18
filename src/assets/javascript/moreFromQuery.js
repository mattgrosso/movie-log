// Turning the chips you're filtering by into one question for TMDB.
//
// "Sometimes I have more than one chip... right now I just searched for
// horror, and I searched for comedy. Can we filter the more from list for
// more than one chip?" (Matt, 2026-08-18).
//
// It couldn't: effectiveSearchFilter walked a priority list and returned the
// FIRST chip it found, so horror + comedy quietly became horror. The results
// list below was filtered by both; the suggestions row was not.
//
// The approach here is to ask TMDB the combined question rather than to
// fetch each chip and intersect the answers. /discover ANDs its constraints
// natively — `with_genres=27,35` means horror AND comedy — and that matters
// enormously: fetching horror's top 60 by popularity and comedy's top 60 and
// intersecting them usually yields NOTHING, even though TMDB knows hundreds
// of horror-comedies. Ask the right question and you get the right answer.
//
// The one thing /discover cannot do is free text. A `general` chip is a
// title search, so when one is present the text search leads and the other
// constraints are applied to its results however they can be — locally for
// genre and year, and by intersecting with a discover call for the rest.

/** Chip types /discover can express directly. */
const DISCOVERABLE = new Set(['genre', 'person', 'company', 'keyword', 'year', 'yearRange']);

/**
 * Sort the active chips into what can be asked of TMDB, what has to lead as
 * a text search, and what is ours alone.
 *
 * `tag` is a Cinema Roll concept — your own labels on your own library — so
 * TMDB has nothing to say about it. It filters the results list as always;
 * it simply cannot narrow a suggestion of something you have never seen.
 */
export function partitionFilters (filters) {
  const groups = {
    genres: [], people: [], companies: [], keywords: [],
    years: [], ranges: [], texts: [], local: []
  };

  (filters || []).forEach((filter) => {
    if (!filter?.type) return;

    switch (filter.type) {
      case 'genre': groups.genres.push(filter); break;
      case 'person': groups.people.push(filter); break;
      case 'company': groups.companies.push(filter); break;
      case 'keyword': groups.keywords.push(filter); break;
      case 'year': groups.years.push(filter); break;
      case 'yearRange': groups.ranges.push(filter); break;
      case 'general': groups.texts.push(filter); break;
      default: groups.local.push(filter); break;
    }
  });

  return groups;
}

export function hasDiscoverableFilters (groups) {
  return DISCOVERABLE.size > 0 && (
    groups.genres.length || groups.people.length || groups.companies.length ||
    groups.keywords.length || groups.years.length || groups.ranges.length
  ) > 0;
}

/**
 * The narrowest release window the year chips agree on. Two year chips that
 * contradict each other (1994 and 1997) have no overlap at all, which is
 * worth saying plainly rather than quietly returning one of them.
 *
 * @returns {{ gte: string|null, lte: string|null, impossible: boolean }}
 */
export function releaseWindow ({ years = [], ranges = [] } = {}) {
  let gte = null;
  let lte = null;

  const narrow = (from, to) => {
    if (from && (!gte || from > gte)) gte = from;
    if (to && (!lte || to < lte)) lte = to;
  };

  years.forEach((chip) => {
    const year = Number(chip?.value);
    if (!Number.isFinite(year)) return;
    narrow(`${year}-01-01`, `${year}-12-31`);
  });

  ranges.forEach((chip) => {
    const start = Number(chip?.value?.startYear);
    const end = Number(chip?.value?.endYear);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    narrow(`${start}-01-01`, `${end}-12-31`);
  });

  return { gte, lte, impossible: Boolean(gte && lte && gte > lte) };
}

/**
 * The /discover query for a whole set of chips.
 *
 * Ids come in already resolved — names are turned into TMDB ids by the
 * caller, which can cache those lookups. Comma means AND in every one of
 * these parameters, which is exactly what a stack of chips means.
 */
export function discoverParams ({
  genreIds = [], personIds = [], companyIds = [], keywordIds = [],
  window: releaseDates = {}, page = 1, minVotes = 50, notNewerThan = null
} = {}) {
  const params = {
    language: 'en-US',
    sort_by: 'popularity.desc',
    page,
    'vote_count.gte': minVotes,
    include_adult: false
  };

  if (genreIds.length) params.with_genres = genreIds.join(',');
  if (personIds.length) params.with_people = personIds.join(',');
  if (companyIds.length) params.with_companies = companyIds.join(',');
  if (keywordIds.length) params.with_keywords = keywordIds.join(',');

  if (releaseDates.gte) params['primary_release_date.gte'] = releaseDates.gte;

  // The chips' own upper bound wins over the section's general "nothing too
  // new" rule — asking for 2025 and being told about 2019 is not an answer.
  const upperBounds = [releaseDates.lte, notNewerThan].filter(Boolean);
  if (upperBounds.length) params['primary_release_date.lte'] = upperBounds.sort()[0];

  return params;
}

/**
 * Does a movie from a TEXT search satisfy the constraints we can check
 * without asking TMDB anything more? Genre ids and release dates ride along
 * on every search result; cast, company and keywords do not.
 */
export function matchesLocalConstraints (movie, { genreIds = [], window: releaseDates = {} } = {}) {
  if (!movie) return false;

  if (genreIds.length) {
    const on = movie.genre_ids || (movie.genres || []).map((genre) => genre?.id);
    if (!genreIds.every((id) => (on || []).includes(id))) return false;
  }

  const released = String(movie.release_date || '');
  if (releaseDates.gte && (!released || released < releaseDates.gte)) return false;
  if (releaseDates.lte && (!released || released > releaseDates.lte)) return false;

  return true;
}

/** Everything in `list` that also appears in `keep`, by TMDB id. */
export function intersectById (list, keep) {
  const ids = new Set((keep || []).map((movie) => movie?.id).filter((id) => id != null));
  return (list || []).filter((movie) => ids.has(movie?.id));
}

/**
 * What to call the section, given everything being filtered by. One chip
 * reads as it always did; several are joined, because "More from Horror +
 * Comedy" is the honest description of what is below it.
 */
export function describeFilters (filters) {
  const named = (filters || [])
    .map((filter) => filter?.display || filter?.value)
    .filter((label) => typeof label === 'string' && label.trim())
    .map((label) => label.trim());

  if (!named.length) return null;
  if (named.length === 1) return named[0];
  return `${named.slice(0, -1).join(', ')} + ${named[named.length - 1]}`;
}

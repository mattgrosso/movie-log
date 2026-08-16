// Pure search/filter/sort logic extracted from Home.vue so it can be unit-tested
// in isolation (no component mount required). These functions read NOTHING from
// `this` — every dependency (the current sort value/order, and a getRating-style
// rating accessor) is passed in explicitly. Home.vue keeps thin method wrappers
// that supply those from component state, so all existing call sites are unchanged.
//
// Behavior here is byte-for-byte the logic that previously lived on the component;
// the equivalence is guarded by SortResultsFast.test.js, ChipFiltering.test.js,
// QuickLinksFiltering.test.js (via the wrappers) plus searchFiltering.test.js
// (direct unit tests of these exports).

/**
 * Typographic punctuation → its plain ASCII equivalent.
 *
 * iOS substitutes a curly apostrophe (U+2019) as you type, while TMDB stores a
 * straight one, so "Adam’s Rib" typed on a phone matched nothing in a library
 * that definitely contained Adam's Rib (Matt, 2026-08-16). Dashes, quotes and
 * the ellipsis have the same split, so they're folded here too.
 *
 * Both sides of every comparison go through this — see `normalizeSearchText`.
 */
const SMART_PUNCTUATION = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"',
  '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-',
  '―': '-', '−': '-',
  '…': '...', ' ': ' '
};
const SMART_PUNCTUATION_PATTERN = new RegExp(`[${Object.keys(SMART_PUNCTUATION).join('')}]`, 'g');

/** Lowercase + fold typographic punctuation. Apply to stored text AND queries. */
export function normalizeSearchText (value) {
  if (typeof value !== 'string' || !value) return '';
  return value.replace(SMART_PUNCTUATION_PATTERN, (character) => SMART_PUNCTUATION[character]).toLowerCase();
}

/**
 * Precompute the normalized strings applyFilter needs so they aren't re-derived
 * per movie on every keystroke. Genre and company are intentionally left raw on
 * the movie — the `genre`/`company` filter types do exact case-sensitive equality.
 */
export function buildSearchFields (movie) {
  return {
    title: normalizeSearchText(movie.title),
    // Also NFD-normalized, for the accent-insensitive `general` title match.
    titleNormalized: movie.title
      ? normalizeSearchText(movie.title.normalize('NFD').replace(/[̀-ͯ]/g, ''))
      : '',
    keywords: (movie.flatKeywords || []).filter(Boolean).map(normalizeSearchText),
    genres: (movie.genres || []).filter(g => g.name).map(g => normalizeSearchText(g.name)),
    cast: (movie.cast || []).filter(p => p.name).map(p => normalizeSearchText(p.name)),
    // job kept original-case for the exact `=== 'Director'` check; jobLower for
    // the producer substring check.
    crew: (movie.crew || []).filter(p => p.name).map(p => ({
      name: normalizeSearchText(p.name),
      job: p.job || '',
      jobLower: normalizeSearchText(p.job)
    })),
    companies: (movie.production_companies || []).filter(c => c.name).map(c => normalizeSearchText(c.name))
  };
}

/** Inclusive list of year strings between a {startYear, endYear} range. */
export function getListOfYearsFromRange (yearRange) {
  if (!yearRange || typeof yearRange !== 'object' || !yearRange.startYear || !yearRange.endYear) {
    return [];
  }
  const years = [];
  for (let year = yearRange.startYear; year <= yearRange.endYear; year++) {
    years.push(year.toString());
  }
  return years;
}

/**
 * Does `result` match `filter`? Decorated library entries carry `_search`;
 * quick-link-sourced entries may not, so we build it on the fly when missing.
 */
export function applyFilter (result, filter) {
  const movie = result.movie;
  const s = result._search || buildSearchFields(movie);

  switch (filter.type) {
    case 'general': {
      const searchValue = normalizeSearchText(filter.value);
      return s.titleNormalized.includes(searchValue) ||
        s.keywords.some(keyword => keyword === searchValue) ||
        s.genres.some(genre => genre === searchValue) ||
        // A name-part (split on space) is always a substring of the full name,
        // so checking the full name covers part matches too.
        s.cast.some(name => name.includes(searchValue)) ||
        s.crew.some(person => person.name.includes(searchValue)) ||
        s.companies.some(company => company.includes(searchValue));
    }
    case 'person': {
      const filterValueLower = normalizeSearchText(filter.value);
      const inCast = s.cast.some(name =>
        name === filterValueLower || name.split(' ').slice(-1)[0] === filterValueLower
      );
      const inCrew = s.crew.some(person =>
        person.name === filterValueLower || person.name.split(' ').slice(-1)[0] === filterValueLower
      );
      return inCast || inCrew;
    }
    case 'year': {
      // Extract year directly from release_date string to avoid timezone issues.
      // Guard against entries with no release_date — an unguarded .substring would
      // throw and blank the entire filtered result set.
      if (!movie.release_date) return false;
      const movieYear = movie.release_date.substring(0, 4);
      return movieYear === filter.value;
    }
    case 'yearRange': {
      if (!movie.release_date) return false;
      const years = getListOfYearsFromRange(filter.value);
      return years.includes(movie.release_date.substring(0, 4));
    }
    case 'genre':
      return movie.genres && movie.genres.some(genre => genre.name === filter.value);

    case 'company':
      return movie.production_companies && movie.production_companies.some(company => company.name === filter.value);

    case 'keyword':
      return s.keywords.some(keyword => keyword === normalizeSearchText(filter.value));

    case 'tag':
      return result.ratings && result.ratings.some(rating =>
        rating.tags && rating.tags.some(tag => tag.title === filter.value)
      );

    case 'title':
      return s.title.includes(normalizeSearchText(filter.value));

    case 'director':
      return s.crew.some(person =>
        person.job === 'Director' && person.name.includes(normalizeSearchText(filter.value))
      );

    case 'producer':
      return s.crew.some(person =>
        person.jobLower.includes('producer') && person.name.includes(normalizeSearchText(filter.value))
      );

    case 'cast':
      return s.cast.some(name => name.includes(normalizeSearchText(filter.value)));

    default:
      return false;
  }
}

/**
 * The sort key value for `item`. `getRating(item)` returns the rating object
 * (the component passes its mostRecentRating, which wraps GetRating.js).
 */
export function getSortValue (item, key, getRating) {
  if (key === 'rating') {
    return getRating(item).calculatedTotal;
  } else if (key === 'release') {
    return new Date(item.movie.release_date);
  } else if (key === 'title') {
    return item.movie.title;
  } else if (key === 'watched') {
    const date = getRating(item).date || '3/22/1982';
    return new Date(date);
  } else if (key === 'views') {
    return item.ratings.length;
  } else {
    const keyScore = parseInt(getRating(item)[key]);
    const keysToCompare = ['direction', 'imagery', 'impression', 'love', 'performance', 'soundtrack', 'stickiness', 'story'];
    const isKeyScoreHighestScore = keysToCompare.some((keyToCompare) => {
      const keyToCompareScore = parseInt(getRating(item)[keyToCompare]);
      return keyToCompareScore >= keyScore;
    });
    return isKeyScoreHighestScore ? keyScore : 0;
  }
}

/**
 * Decorate-sort-undecorate sort. Computes each item's primary + secondary sort
 * value ONCE (one getRating per item for the common "rating" sort), then sorts
 * on the cached values with semantics identical to sortResults. Returns a NEW
 * array (does not mutate the input).
 */
export function sortResultsFast (array, { sortValue, sortOrder, getRating }) {
  const key = sortValue || 'rating';
  const bestOnTop = sortOrder === 'bestOrNewestOnTop';

  const decorated = array.map((item) => {
    const rating = getRating(item);
    const secondary = rating.calculatedTotal;
    const primary = key === 'rating' ? rating.calculatedTotal : getSortValue(item, key, getRating);
    return { item, primary, secondary };
  });

  decorated.sort((a, b) => {
    // Mirror sortResults exactly, including the quirk that === on two Date objects
    // is false (so date sorts skip the secondary tiebreak).
    if (a.primary === b.primary) {
      if (a.secondary < b.secondary) {
        return bestOnTop ? 1 : -1;
      }
      if (a.secondary > b.secondary) {
        return bestOnTop ? -1 : 1;
      }
      return 0;
    }
    if (a.primary < b.primary) {
      return bestOnTop ? 1 : -1;
    }
    if (a.primary > b.primary) {
      return bestOnTop ? -1 : 1;
    }
    return 0;
  });

  return decorated.map((d) => d.item);
}

/**
 * Reference comparator (the oracle sortResultsFast is tested against). Kept
 * identical to the legacy in-component comparator.
 */
export function sortResults (a, b, { sortValue, sortOrder, getRating }) {
  const sortValueA = getSortValue(a, sortValue || 'rating', getRating);
  const sortValueB = getSortValue(b, sortValue || 'rating', getRating);

  if (sortValueA === sortValueB) {
    const secondarySortValueA = getRating(a).calculatedTotal;
    const secondarySortValueB = getRating(b).calculatedTotal;

    if (secondarySortValueA < secondarySortValueB) {
      return sortOrder === 'bestOrNewestOnTop' ? 1 : -1;
    }
    if (secondarySortValueA > secondarySortValueB) {
      return sortOrder === 'bestOrNewestOnTop' ? -1 : 1;
    }
    return 0;
  }

  if (sortValueA < sortValueB) {
    return sortOrder === 'bestOrNewestOnTop' ? 1 : -1;
  }
  if (sortValueA > sortValueB) {
    return sortOrder === 'bestOrNewestOnTop' ? -1 : 1;
  }
  return 0;
}

/**
 * How many ranked "Did you mean?" suggestions (best first) fit on one line
 * next to the "Did you mean?: " label, given the search input's rendered
 * width. A character-count estimate, not pixel-exact text measurement -
 * Home.vue's .did-you-mean-inline backstops this with CSS overflow:hidden +
 * text-overflow:ellipsis, so the real requirement here is "don't wildly
 * overshoot," not perfect precision. Always returns at least 1 (when there's
 * at least one candidate) rather than 0, even if that one term doesn't
 * perfectly fit - showing nothing isn't better than a truncated suggestion.
 */
export function countDidYouMeanSuggestionsThatFit (candidates, maxWidthPx, avgCharWidthPx = 6) {
  if (!candidates.length || !maxWidthPx) {
    return candidates.length ? 1 : 0;
  }

  let used = 'Did you mean?: '.length * avgCharWidthPx;
  let count = 0;

  for (const candidate of candidates) {
    const separatorChars = count > 0 ? 2 : 0; // ", "
    const termWidth = (candidate.value.length + separatorChars) * avgCharWidthPx;
    if (count > 0 && used + termWidth > maxWidthPx) {
      break;
    }
    used += termWidth;
    count += 1;
  }

  return Math.max(count, 1);
}

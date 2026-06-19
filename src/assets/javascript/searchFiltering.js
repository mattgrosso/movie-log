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
 * Precompute the lowercased strings applyFilter needs so they aren't re-derived
 * per movie on every keystroke. Genre and company are intentionally NOT
 * lowercased — the `genre`/`company` filter types do exact case-sensitive equality.
 */
export function buildSearchFields (movie) {
  return {
    title: movie.title ? movie.title.toLowerCase() : '',
    // NFD-normalized for the accent-insensitive `general` title match.
    titleNormalized: movie.title
      ? movie.title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      : '',
    keywords: (movie.flatKeywords || []).filter(Boolean).map(k => k.toLowerCase()),
    genres: (movie.genres || []).filter(g => g.name).map(g => g.name.toLowerCase()),
    cast: (movie.cast || []).filter(p => p.name).map(p => p.name.toLowerCase()),
    // job kept original-case for the exact `=== 'Director'` check; jobLower for
    // the producer substring check.
    crew: (movie.crew || []).filter(p => p.name).map(p => ({
      name: p.name.toLowerCase(),
      job: p.job || '',
      jobLower: (p.job || '').toLowerCase()
    })),
    companies: (movie.production_companies || []).filter(c => c.name).map(c => c.name.toLowerCase())
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
      const searchValue = filter.value.toLowerCase();
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
      const filterValueLower = filter.value.toLowerCase();
      const inCast = s.cast.some(name =>
        name === filterValueLower || name.split(' ').slice(-1)[0] === filterValueLower
      );
      const inCrew = s.crew.some(person =>
        person.name === filterValueLower || person.name.split(' ').slice(-1)[0] === filterValueLower
      );
      return inCast || inCrew;
    }
    case 'year': {
      // Extract year directly from release_date string to avoid timezone issues
      const movieYear = movie.release_date.substring(0, 4);
      return movieYear === filter.value;
    }
    case 'yearRange': {
      const years = getListOfYearsFromRange(filter.value);
      return years.includes(movie.release_date.substring(0, 4));
    }
    case 'genre':
      return movie.genres && movie.genres.some(genre => genre.name === filter.value);

    case 'company':
      return movie.production_companies && movie.production_companies.some(company => company.name === filter.value);

    case 'keyword':
      return s.keywords.some(keyword => keyword === filter.value.toLowerCase());

    case 'tag':
      return result.ratings && result.ratings.some(rating =>
        rating.tags && rating.tags.some(tag => tag.title === filter.value)
      );

    case 'title':
      return s.title.includes(filter.value.toLowerCase());

    case 'director':
      return s.crew.some(person =>
        person.job === 'Director' && person.name.includes(filter.value.toLowerCase())
      );

    case 'producer':
      return s.crew.some(person =>
        person.jobLower.includes('producer') && person.name.includes(filter.value.toLowerCase())
      );

    case 'cast':
      return s.cast.some(name => name.includes(filter.value.toLowerCase()));

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

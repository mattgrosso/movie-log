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

// The text primitives live in searchText.js (Phase 3: the kind registry
// needs them without an import cycle); re-exported here so the many existing
// importers keep working unchanged.
import { normalizeSearchText, looseSearchText } from './searchText.js';
import { FILTER_KINDS, getListOfYearsFromRange } from './filterKinds.js';

export { normalizeSearchText, looseSearchText, getListOfYearsFromRange };

/**
 * Precompute the normalized strings applyFilter needs so they aren't re-derived
 * per movie on every keystroke.
 *
 * ONE form per name. Cast is deliberately untrimmed here (Six Degrees walks the
 * full billing list), so a second copy of every cast name is thousands of extra
 * strings held for the whole library at once — enough GC pressure to double the
 * cost of an unrelated library sort, measured. Names therefore keep their word
 * boundaries and rely on `normalizeSearchText` alone, which is why that folds
 * hyphens to spaces; only the title, one string per movie, also keeps a loose
 * form, and that's where run-together spellings ("spiderman") actually come up.
 */
export function buildSearchFields (movie) {
  return {
    title: normalizeSearchText(movie.title),
    titleLoose: looseSearchText(movie.title),
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

/**
 * Does `result` match `filter`? Decorated library entries carry `_search`;
 * quick-link-sourced entries may not, so we build it on the fly when missing.
 */
export function applyFilter (result, filter) {
  // One lookup, no switch: each kind's matcher lives in filterKinds.js,
  // beside everything else that kind knows how to do. An unknown type
  // matches nothing, as the old switch's default always did.
  const kind = FILTER_KINDS[filter.type];
  if (!kind) return false;

  return kind.matchLocal(result, filter, result._search || buildSearchFields(result.movie));
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

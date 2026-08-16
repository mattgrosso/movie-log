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
  // Every dash, including the plain ASCII one, becomes a space: it keeps the
  // word boundary a name needs ("Jean-Pierre" and "Jean Pierre" reach the same
  // string) instead of making the hyphen decide whether something is findable.
  '‐': ' ', '‑': ' ', '‒': ' ', '–': ' ', '—': ' ',
  '―': ' ', '−': ' ', '-': ' ',
  '…': '...', ' ': ' '
};
// Keys are escaped rather than concatenated raw: `-` inside a character class
// would otherwise read as a range.
const SMART_PUNCTUATION_PATTERN = new RegExp(
  `[${Object.keys(SMART_PUNCTUATION).map((character) => `\\${character}`).join('')}]`,
  'g'
);

// The combining-marks block, written as escapes: the literal characters are
// invisible in an editor and trivially broken by a stray keystroke.
const DIACRITICS = /[̀-ͯ]/g;

// Letters NFD does not decompose, because the accent is part of the glyph
// rather than a combining mark. Without these, "Lodz" never finds "Łódź".
const LETTER_FOLDS = {
  ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ħ: 'h', ı: 'i'
};
const LETTER_FOLD_PATTERN = new RegExp(`[${Object.keys(LETTER_FOLDS).join('')}]`, 'g');

const WHITESPACE_RUN = /\s+/g;
// Anything that isn't a letter or a number, unicode-aware: an `[^a-z0-9]` class
// would erase a non-Latin title entirely and make it unfindable.
const SEPARATORS = /[^\p{L}\p{N}]/gu;

// applyFilter runs once per movie, so a query is normalized ~1,400 times per
// keystroke with the same input every time. NFD + two regex passes is far from
// free at that rate, so remember the last answer — the call sites are loops
// over one query, which this turns into a single real computation.
let lastNormalizeInput = null;
let lastNormalizeOutput = '';
let lastLooseInput = null;
let lastLooseOutput = '';

/**
 * The canonical form for comparing search text: accents stripped, typographic
 * punctuation folded to ASCII, lowercased, whitespace collapsed and trimmed.
 *
 * Apply it to STORED text and QUERIES alike. Normalizing only one side is what
 * caused the Adam's Rib miss, and an earlier version of this file that stripped
 * accents from titles but not from what you typed meant "Amélie" — the correctly
 * spelled title — found nothing while "Amelie" worked.
 */
export function normalizeSearchText (value) {
  if (typeof value !== 'string' || !value) return '';
  if (value === lastNormalizeInput) return lastNormalizeOutput;

  const normalized = value
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(SMART_PUNCTUATION_PATTERN, (character) => SMART_PUNCTUATION[character])
    .toLowerCase()
    // After lowercasing, so only the lowercase forms need listing.
    .replace(LETTER_FOLD_PATTERN, (character) => LETTER_FOLDS[character])
    .replace(WHITESPACE_RUN, ' ')
    .trim();

  lastNormalizeInput = value;
  lastNormalizeOutput = normalized;
  return normalized;
}

/**
 * `normalizeSearchText` with every remaining separator removed, so punctuation
 * and spacing can't decide whether something is findable: "spider man",
 * "Spider-Man" and "spiderman" all collapse to `spiderman`, and "adams rib"
 * finds Adam's Rib. Used for the substring matches (title, cast, crew,
 * company); exact-equality matches (keyword, genre, whole-name person) keep the
 * spaced form, where word boundaries still carry meaning.
 */
export function looseSearchText (value) {
  if (typeof value !== 'string' || !value) return '';
  if (value === lastLooseInput) return lastLooseOutput;

  const loose = normalizeSearchText(value).replace(SEPARATORS, '');

  lastLooseInput = value;
  lastLooseOutput = loose;
  return loose;
}

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
      return s.titleLoose.includes(looseSearchText(filter.value)) ||
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
      if (!filterValueLower) return false;
      // Whole name, or the surname alone. Hyphens are already spaces by now, so
      // "jean pierre jeunet" reaches the same string as "Jean-Pierre Jeunet".
      const matches = (name) =>
        name === filterValueLower || name.split(' ').slice(-1)[0] === filterValueLower;

      return s.cast.some(matches) || s.crew.some(person => matches(person.name));
    }
    case 'year': {
      // Extract year directly from release_date string to avoid timezone issues.
      // Guard against entries with no release_date — an unguarded .substring would
      // throw and blank the entire filtered result set.
      if (!movie.release_date) return false;
      const movieYear = movie.release_date.substring(0, 4);
      // String(): a year chip built from a number would never match otherwise.
      return movieYear === String(filter.value);
    }
    case 'yearRange': {
      if (!movie.release_date) return false;
      const years = getListOfYearsFromRange(filter.value);
      return years.includes(movie.release_date.substring(0, 4));
    }
    // genre/company/keyword used to compare the RAW typed text against the raw
    // TMDB name, case-sensitively. A chip built from the library always matched,
    // so this looked fine — but typing "warner bros. pictures" yourself matched
    // nothing at all. They compare normalized now, against the precomputed
    // fields, which is both more forgiving and cheaper.
    case 'genre':
      return s.genres.some(genre => genre === normalizeSearchText(filter.value));

    case 'company':
      return s.companies.some(company => company === normalizeSearchText(filter.value));

    case 'keyword':
      return s.keywords.some(keyword => keyword === normalizeSearchText(filter.value));

    case 'tag': {
      // Tags are user-authored, so their capitalisation is a display choice,
      // not part of their identity.
      const tagValue = normalizeSearchText(filter.value);
      return Boolean(result.ratings) && result.ratings.some(rating =>
        rating.tags && rating.tags.some(tag => normalizeSearchText(tag.title) === tagValue)
      );
    }

    case 'title':
      // A value that normalizes to nothing leaves `includes('')` true, i.e. no
      // constraint — the whole library, not a blank screen (ChipFiltering).
      return s.titleLoose.includes(looseSearchText(filter.value));

    case 'director': {
      const value = normalizeSearchText(filter.value);
      return s.crew.some(person => person.job === 'Director' && person.name.includes(value));
    }
    case 'producer': {
      const value = normalizeSearchText(filter.value);
      return s.crew.some(person => person.jobLower.includes('producer') && person.name.includes(value));
    }
    case 'cast': {
      const value = normalizeSearchText(filter.value);
      return s.cast.some(name => name.includes(value));
    }

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

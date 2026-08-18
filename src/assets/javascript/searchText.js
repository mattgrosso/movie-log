// The text-comparison primitives everything search-shaped shares. Split out
// of searchFiltering.js in Phase 3 of the filter redesign so the kind
// registry (filterKinds.js) can use them without an import cycle:
// searchText ← filterKinds ← searchFiltering, one direction only.
// searchFiltering re-exports both functions, so existing importers are
// untouched.

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
  '…': '...', ' ': ' '
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

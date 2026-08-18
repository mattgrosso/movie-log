// Typeahead for the main search bar: the dimensions you could filter by,
// offered while you type.
//
// "We've added a lot of type ahead and fuzzy search features to our various
// inputs all over the app. Do you think it's something we could do to our
// main search input?" (Matt, 2026-08-18).
//
// This is NOT spell-check — didYouMeanSuggestions already does that, and it
// only speaks up after a search has returned nothing. The point of typing
// ahead is the CHIP TYPE. detectFilterType is an exact-match cascade: your
// text has to equal a director/genre/actor/studio/keyword in your library
// exactly, or you get a `general` chip. So "Villeneuve" becomes a title
// search for the word Villeneuve. Tapping a suggestion instead carries an
// `expectedType` into createFilterByType and builds the chip you meant — and
// a chip's type now decides real behaviour downstream (a genre chip carries
// its genreId into the More from discover call; a general chip becomes a
// title search).
//
// Two deliberate exclusions:
//
// 1. TITLES. The results list below the bar already matches titles live, so
//    suggesting them would spend a narrow one-line row telling you what is
//    already on screen. What the results CANNOT show you is that
//    "Villeneuve" is a director you can filter by. Titles stay in the
//    zero-results "Did you mean?" fallback, where they still earn their place.
//
// 2. FUSE. Measured on a 25,000-term index: a Fuse search costs ~29-41ms per
//    keystroke, while the prefix scan below costs ~3ms against precomputed
//    normalized strings. On a phone that difference is a stutter while
//    typing versus nothing at all. Fuzzy matching stays exactly where it
//    was, on the zero-results path, where one 40ms hit is invisible.
//
// The results are shown in a panel opening upward out of the input, the same
// shape the games use (CineplexityGame's is the closest — it opens upward for
// the same reason: on a phone the keyboard owns everything below the field).

import { normalizeSearchText } from './searchFiltering.js';

// Two characters is enough to be worth a suggestion and short enough to help
// before you've typed the hard part of a name.
export const TYPEAHEAD_MIN_CHARS = 2;

// A panel above the input holds a real list, so this is what fits in one
// without scrolling rather than what fits on one line of text.
export const TYPEAHEAD_MAX_SUGGESTIONS = 6;

/**
 * Flatten the library's count maps into one prefix-searchable index.
 *
 * `sources` are given in priority order, each `{ counts, expectedType, kind }`
 * where `counts` is a `{ name: filmCount }` map. Order matters because a
 * director is also crew: "Denis Villeneuve" appears in both countDirectors
 * and countCastCrew, and both build the same `person` chip, so the entry is
 * deduped by value and the first source wins the label.
 *
 * Normalized forms are precomputed here rather than per keystroke — the whole
 * build costs about as much as the Fuse index it sits beside (~56ms for
 * 25,000 terms) and Vue memoizes it until the library changes, which turns a
 * 16ms-per-keystroke cost into a 3ms one.
 */
export function buildTypeaheadIndex (sources) {
  const index = [];
  const seen = new Set();

  (sources || []).forEach(({ counts, expectedType, kind }) => {
    Object.keys(counts || {}).forEach((value) => {
      if (!value) return;

      const norm = normalizeSearchText(value);
      if (!norm || seen.has(norm)) return;

      seen.add(norm);
      index.push({ value, norm, count: counts[value] || 0, expectedType, kind });
    });
  });

  return index;
}

/**
 * Is `candidate` a better suggestion than `against`?
 *
 * Tier first (a term that starts with what you typed beats one that merely
 * contains a word starting with it), then how many of your films it covers —
 * the director you have eleven of should outrank the one you have one of —
 * then the shorter term, then alphabetically so the order is deterministic.
 */
function outranks (candidate, against) {
  if (!against) return true;
  if (candidate.tier !== against.tier) return candidate.tier < against.tier;
  if (candidate.count !== against.count) return candidate.count > against.count;
  if (candidate.value.length !== against.value.length) return candidate.value.length < against.value.length;
  return candidate.norm < against.norm;
}

/**
 * The best few suggestions for what has been typed so far.
 *
 * Keeps only the top `limit` as it scans rather than collecting every match
 * and sorting: a two-letter term can match thousands of names, and there is
 * no reason to allocate an array of them to show four.
 *
 * @param {Array} index from buildTypeaheadIndex
 * @param {string} rawTerm exactly what is in the input
 * @param {{ limit?: number, exclude?: string[] }} options `exclude` is the
 *   values already committed as chips — suggesting one of those does nothing.
 */
export function rankTypeahead (index, rawTerm, { limit = TYPEAHEAD_MAX_SUGGESTIONS, exclude = [] } = {}) {
  const term = normalizeSearchText(rawTerm || '');
  if (term.length < TYPEAHEAD_MIN_CHARS || !index?.length) {
    return [];
  }

  const excluded = new Set((exclude || []).map((value) => normalizeSearchText(value)).filter(Boolean));
  const wordStart = ` ${term}`;
  const best = [];

  for (let i = 0; i < index.length; i++) {
    const entry = index[i];
    const norm = entry.norm;

    // An exactly-typed term already detects to the right chip type on its
    // own, so offering it back is a suggestion to do nothing.
    if (norm === term || excluded.has(norm)) continue;

    let tier;
    if (norm.startsWith(term)) {
      tier = 0;
    } else if (norm.includes(wordStart)) {
      tier = 1;
    } else {
      continue;
    }

    const candidate = { ...entry, tier };
    if (best.length === limit && !outranks(candidate, best[best.length - 1])) {
      continue;
    }

    let at = best.length;
    while (at > 0 && outranks(candidate, best[at - 1])) at--;
    best.splice(at, 0, candidate);
    if (best.length > limit) best.pop();
  }

  return best;
}

/**
 * The right-hand label on a suggestion row: what kind of thing this is, and
 * how much of your library it accounts for — which is also why it is ranked
 * where it is.
 */
export function describeSuggestion (suggestion) {
  if (!suggestion?.kind) return '';
  const films = Number(suggestion.count) || 0;
  if (!films) return suggestion.kind;
  return `${suggestion.kind} · ${films} ${films === 1 ? 'film' : 'films'}`;
}

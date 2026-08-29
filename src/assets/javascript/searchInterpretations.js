// What a typed word could MEAN, as a list rather than a verdict.
//
// Matt, 2026-08-29: "I don't really understand why we have to have different
// types of searches. Like, why do we need a name search separate from a title
// search? Don't we have all those sections within our search results for
// exactly this reason?"
//
// He's right, and this module is what makes saying yes possible. The old
// `detectFilterType` cascade answered "what IS this word?" with exactly one
// answer and then filtered by it — so typing a word that happened to be an
// actor's surname committed a person chip, which both hid the films with that
// word in the title AND switched off the grouped sections that would have
// sorted the whole thing out.
//
// The fix separates two questions that were tangled together:
//
//   1. How do we FILTER? For anything typed, always a plain text search. The
//      grouped sections then answer "where did this match?" — Title, Director,
//      Cast, Producer, Companies, Keywords & Genres.
//   2. What could this word REFER TO? That's this module, and the answer is a
//      LIST. "Alice" is a word in three of his titles and also Mary Alice's
//      surname; both are true, and nothing has to choose.
//
// Question 2 is what keeps "More from TMDB" working — the feature that
// suggests unrated films — and in fact makes it better than it was. It needs
// TMDB ids, which a plain text chip doesn't carry, so it used to depend on
// the cascade having committed a typed chip. Now it reads interpretations
// instead, and because they're a list it can offer several ("More Thrillers",
// "More with Mary Alice") where the cascade could only ever guess one.
//
// Everything here comes out of `catalog.js`, which already resolved every
// name in the library to its TMDB id exactly once. No new index, no lookups.

import { normalizeSearchText } from './searchText.js';

// Everything that isn't a letter or a number, unicode-aware — the same class
// looseSearchText uses. Applied to an ALREADY-normalized string here, so this
// only has punctuation and spaces left to remove.
//
// Why interpretations compare loosely as well as exactly: `normalizeSearchText`
// folds dashes and curly quotes but deliberately keeps full stops, so the
// studio stored as "Warner Bros. Pictures" would not be recognised from the
// spelling anybody actually types. Both sides are stripped, so this stays an
// equality test — it forgives punctuation, it does not match on substrings.
const SEPARATORS = /[^\p{L}\p{N}]/gu;
const stripSeparators = (value) => String(value || '').replace(SEPARATORS, '');

// Which reading leads when a word names several things. Order is by how
// specific the thing is: a genre or a director is a sharper claim about a
// word than "somebody in the cast is called this".
const KIND_PRIORITY = ['genre', 'director', 'company', 'keyword', 'cast'];

// The two kinds whose entries are people's names, and so the only ones where
// a surname is a meaningful partial reading.
const PERSON_KINDS = new Set(['director', 'cast']);

/**
 * Everything `term` could refer to in this library, best reading first.
 *
 * Each interpretation is `{ kind, name, tmdbId, count, exact }` — the
 * catalog's own entry plus `exact`, which distinguishes "you typed this
 * entity's whole name" from "you typed a surname it ends with".
 *
 * A whole name always outranks a surname, because typing one is deliberate:
 * "Martin Scorsese" leads with the director, while "Scorsese" still finds
 * him but never claims you meant nothing else. Within each of those, the
 * entity that accounts for more of the library leads — the useful reading of
 * an ambiguous word is usually the one you have more of.
 */
export function interpretationsFor (catalog, term, { limit = 6 } = {}) {
  const norm = normalizeSearchText(String(term || ''));
  if (!norm) return [];

  const bare = stripSeparators(norm);
  const readings = [];
  (catalog?.entries || []).forEach((entry) => {
    if (!entry?.norm) return;
    if (entry.norm === norm || (bare && stripSeparators(entry.norm) === bare)) {
      readings.push({ ...entry, exact: true });
      return;
    }
    // A surname on its own, for people only. Guarded to multi-word names so
    // a one-word name can't match itself here and arrive twice.
    if (PERSON_KINDS.has(entry.kind)) {
      const words = entry.norm.split(' ');
      if (words.length > 1 && words[words.length - 1] === norm) {
        readings.push({ ...entry, exact: false });
      }
    }
  });

  // One person is often BOTH a director and cast (a director with a cameo),
  // and both readings build the same TMDB question. Keep the higher-priority
  // kind so the row reads "director" rather than "cast".
  const byName = new Map();
  readings.forEach((reading) => {
    const key = `${reading.kind === 'cast' || reading.kind === 'director' ? 'person' : reading.kind}:${reading.norm}`;
    const held = byName.get(key);
    if (!held || rank(reading) < rank(held)) byName.set(key, reading);
  });

  return [...byName.values()]
    .sort((a, b) =>
      (a.exact === b.exact ? 0 : (a.exact ? -1 : 1)) ||
      (KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind)) ||
      ((b.count || 0) - (a.count || 0)) ||
      String(a.name).localeCompare(String(b.name))
    )
    .slice(0, limit);
}

function rank (reading) {
  return (reading.exact ? 0 : 100) + KIND_PRIORITY.indexOf(reading.kind);
}

// A catalog kind → the chip type that asks TMDB the same question. `cast` and
// `director` both become `person`, which is what the discover layer wants: it
// asks TMDB "films with this person", not "films they directed".
const CHIP_TYPE_BY_KIND = {
  genre: 'genre',
  company: 'company',
  keyword: 'keyword',
  director: 'person',
  cast: 'person'
};

/**
 * An interpretation expressed as a filter, for the one consumer that needs a
 * typed question: TMDB discover.
 *
 * This is deliberately NOT added to the user's chips — it never changes what
 * is being filtered on screen. It exists so "More from" can ask a precise
 * question off the back of an imprecise search.
 *
 * A person carries no tmdbId (people are stored name-only in this library —
 * see catalog.js), so discover resolves those the way it always has.
 */
export function discoverFilterFor (interpretation) {
  const type = CHIP_TYPE_BY_KIND[interpretation?.kind];
  if (!type) return null;
  const filter = { type, value: interpretation.name };
  if (interpretation.tmdbId != null) filter.tmdbId = interpretation.tmdbId;
  if (type === 'genre' && interpretation.tmdbId != null) filter.genreId = interpretation.tmdbId;
  return filter;
}

/**
 * How a "More from" row should describe what it is offering.
 *
 * Named per kind rather than generically, because with several readings on
 * screen at once the label is the only thing telling them apart: "More
 * Thrillers" and "More with Mary Alice" both came from typing one word.
 */
export function describeInterpretation (interpretation) {
  if (!interpretation) return '';
  switch (interpretation.kind) {
    case 'genre': return `More ${interpretation.name}`;
    case 'director': return `More from ${interpretation.name}`;
    case 'cast': return `More with ${interpretation.name}`;
    case 'company': return `More from ${interpretation.name}`;
    case 'keyword': return `More ${interpretation.name}`;
    default: return `More like ${interpretation.name}`;
  }
}

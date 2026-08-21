// Pure helpers for resolve-bug-report.mjs, split out so tests can import
// them without executing the script itself.
//
// Email -> account top key, for the maintenance scripts.
//
// The app's own derivation lives in src/assets/javascript/databaseKey.js,
// which plain Node can't import (it uses webpack's JSON module support). So
// this reads the same databaseKeyCharacters.json those bytes come from —
// exactly the way generate-database-rules.mjs does — and applies the same
// transformation. src/test/bugResolutions.test.js asserts the two functions
// agree, so they cannot drift apart silently.
//
// Deliberately does NOT lowercase, same as the app: case-folding would derive
// a different key for any account whose email has an uppercase character.

import { createRequire } from 'module';

// createRequire rather than readFileSync(new URL(...)): vitest runs this
// file too (the equivalence test below the fold), and under its transform
// import.meta.url is not a scheme readFileSync accepts. require() resolves
// the same relative path identically in plain Node and in vitest.
const require = createRequire(import.meta.url);
const { characters, replacement } = require('../src/assets/javascript/databaseKeyCharacters.json');

export function emailToTopKey (email) {
  if (typeof email !== 'string' || !email) {
    return null;
  }
  return characters.reduce((key, character) => key.split(character).join(replacement), email);
}

/** The reporter's own words, shortened enough to quote back in a panel. */
export function snippetOf (transcript, limit = 280) {
  const text = (transcript || '').trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

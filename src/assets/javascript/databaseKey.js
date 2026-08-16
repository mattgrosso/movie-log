// Cinema Roll keys every user's data by their EMAIL ADDRESS, sanitized into a
// Firebase-legal path segment (Firebase RTDB keys can't contain `.`, `$`, `#`,
// `[`, `]`, or `/`). This is the single source of truth for that derivation.
//
// It used to be an inline `replaceAll(...)` duplicated in two places (the
// `setDatabaseTopKey` mutation and the login action) — identical today, but
// nothing kept them that way, and the whole security model now rests on the two
// agreeing, so they share this function instead.
//
// The database security rules perform this SAME transformation on
// `auth.token.email` to decide who may read a given branch. They are generated
// from the character list below by `scripts/generate-database-rules.mjs`
// precisely so the two can never drift apart. If you change this list, re-run
// that script.
//
// IMPORTANT: this list is intentionally much broader than Firebase strictly
// requires. It is what shipped, so real user data is already keyed by it, and
// narrowing it now would silently orphan every existing account. Treat it as
// frozen.
//
// The list lives in JSON rather than here so the rules generator — a plain Node
// script, which can't import this ES module — reads the very same bytes instead
// of keeping its own copy in step by hand.
import keyCharacters from './databaseKeyCharacters.json';

export const UNSAFE_KEY_CHARACTERS = keyCharacters.characters;
export const KEY_REPLACEMENT_CHARACTER = keyCharacters.replacement;

// Built from the list rather than written out, so the list stays authoritative.
// Every character is escaped, which is harmless for the alphanumeric-free set
// above and avoids any character-class edge cases (`-`, `[`, `]`, `^`).
const UNSAFE_KEY_PATTERN = new RegExp(
  `[${UNSAFE_KEY_CHARACTERS.map((character) => `\\${character}`).join('')}]`,
  'g'
);

/**
 * Turn an email address into the top-level Firebase key holding that user's
 * data. e.g. `someone@example.com` -> `someone-example-com`.
 *
 * Idempotent: every replaced character becomes `-`, and `-` itself maps to
 * `-`, so running it on an already-derived key returns that key unchanged.
 * The router guard relies on this when re-reading a stored key.
 *
 * Deliberately does NOT lowercase. Case-folding here would change the derived
 * key for any existing account whose email has an uppercase character, pointing
 * it at an empty database. Sign-in inputs are normalized to lowercase in the
 * login form instead, so new accounts are consistent without re-keying old
 * ones.
 */
/**
 * Accounts that exist for automated QA and must never appear to real users.
 *
 * `yarn mint-test-token` signs a browser in as the tester, and sharing now
 * defaults ON, so a single QA session published the tester into the Film Club
 * directory where Natalie found it and could send it a friend request
 * (2026-08-16). The account is legitimate — it just isn't a person.
 */
export const QA_ACCOUNT_KEYS = ['cinemaroll-tester-example-com'];

export function isQaAccountKey (key) {
  return QA_ACCOUNT_KEYS.includes(key);
}

/** Drop QA accounts from a directory-shaped `{ [accountKey]: value }` map. */
export function omitQaAccounts (directory) {
  return Object.fromEntries(
    Object.entries(directory || {}).filter(([key]) => !isQaAccountKey(key))
  );
}

export function emailToDatabaseKey (email) {
  if (typeof email !== 'string' || !email) {
    return null;
  }

  return email.replaceAll(UNSAFE_KEY_PATTERN, KEY_REPLACEMENT_CHARACTER);
}

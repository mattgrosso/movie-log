#!/usr/bin/env node
//
// Generates database.rules.json.
//
// Cinema Roll stores each user's library under a top-level key derived from
// their email address (see src/assets/javascript/databaseKey.js). The security
// rules have to perform that exact same transformation on `auth.token.email` to
// decide who may read a branch — and if the two ever disagree, users lose
// access to their own data.
//
// The rules language has no regex, only `String.replace(substring, replacement)`
// (which replaces every occurrence), so the transformation has to be written as
// a chain of calls. Generating that chain from the same character list the app
// uses is the only way to keep them provably in step.
//
// Usage:  node scripts/generate-database-rules.mjs
// Then:   npx firebase deploy --only database
//
// READ THE DEPLOY ORDER NOTE IN CLAUDE.md BEFORE DEPLOYING THESE RULES.

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

// databaseKey.js is an ES module built for webpack, which a plain Node script
// can't import in this (non-`type: module`) package — so the character list
// lives in JSON that both sides read. Not a copy: the very same bytes.
const keyCharacters = JSON.parse(
  readFileSync(join(repoRoot, 'src/assets/javascript/databaseKeyCharacters.json'), 'utf8')
);
const UNSAFE_KEY_CHARACTERS = keyCharacters.characters;
const REPLACEMENT = keyCharacters.replacement;

// Quote a single character for the rules language, choosing whichever quote
// style doesn't collide with it.
const quote = (character) => (character === "'" ? `"'"` : `'${character}'`);

// `-` -> `-` is a provable no-op, so it's skipped to keep the expression shorter.
const sanitizedAuthEmail = UNSAFE_KEY_CHARACTERS
  .filter((character) => character !== REPLACEMENT)
  .reduce(
    (expression, character) => `${expression}.replace(${quote(character)}, '${REPLACEMENT}')`,
    'auth.token.email'
  );

// A signed-in user owns exactly the branch named after their own email.
const ownsBranch = `auth != null && auth.token.email != null && $topKey === ${sanitizedAuthEmail}`;

// The dev-mode sandbox (state.devModeTopKey) isn't derived from anyone's email,
// so it needs its own rule. Scoped to the owner, matching the existing `isMatt`
// check that already hardcodes this key in Home.vue.
const OWNER_KEY = 'mattgrosso-gmail-com';
const isOwner = `auth != null && auth.token.email != null && ${sanitizedAuthEmail} === '${OWNER_KEY}'`;

const rules = {
  rules: {
    // Deny by default. Everything below is an explicit, narrow grant.
    '.read': false,
    '.write': false,

    // The in-app bug report button is rendered globally — including on the
    // login screen, before anyone has signed in — so reports have to be
    // writable without a session. Write-only: the pile can't be read back out
    // by clients. Triage goes through the Admin SDK, which bypasses rules.
    bugReports: {
      '.read': false,
      '.write': true
    },

    // Dev-mode sandbox. Owner only.
    'testing-database': {
      '.read': isOwner,
      '.write': isOwner
    },

    // One branch per user, named after their sanitized email address.
    $topKey: {
      '.read': ownsBranch,
      '.write': ownsBranch,

      // /share/:userDBKey/:shareKey is deliberately a logged-out route
      // (requiresLogin: false in the router), so a share link has to be
      // readable by someone with no session at all. Grants read on ONE share
      // at a time — the parent rule still keeps the branch, and the list of
      // which shares exist, private. Reading requires knowing the share key.
      sharedDBSearches: {
        $shareKey: {
          '.read': true
        }
      }
    }
  }
};

const banner = '// GENERATED FILE — edit scripts/generate-database-rules.mjs and re-run it.\n';
writeFileSync(join(repoRoot, 'database.rules.json'), banner + JSON.stringify(rules, null, 2) + '\n');

console.log('Wrote database.rules.json');
console.log(`  ${UNSAFE_KEY_CHARACTERS.length} characters in the key derivation`);
console.log('  Deploy with: npx firebase deploy --only database');

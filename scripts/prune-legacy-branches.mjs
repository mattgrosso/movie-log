// Removal of dead data from one account (--account=<db-key>, required).
// First run 2026-08-15 (Matt-approved) against mattgrosso-gmail-com;
// 2026-08-17 against testing-database, whose pre-prune clone of Matt's
// account was still 56% of the whole DB and re-downloaded by every backup.
// The dead branches, discovered while measuring the trim:
//   - tvLog (38MB): the TV experiment; `currentLog` no longer exists in the
//     store, so every `=== "tvLog"` gate in the app is permanently false.
//   - sharedDBSearches (33MB): share-a-search snapshots; the writing code
//     survives only in a stale .bak file, so the archive can only grow stale.
//     Old share links will stop resolving — accepted.
//   - settings/personalAwards/null: a legacy junk year key from April.
// Takes a fresh full backup first (backup-database.mjs); yarn restore-db can
// resurrect any of it.

import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { loadEnvLocal } from './loadEnvLocal.mjs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

loadEnvLocal();
const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
if (!keyPath) {
  console.error('Missing FIREBASE_ADMIN_KEY_PATH in .env.local.');
  process.exit(1);
}
initializeApp({
  credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))),
  databaseURL: 'https://movie-log-8c4d5-default-rtdb.firebaseio.com'
});
const db = getDatabase();

const accountArg = process.argv.find((a) => a.startsWith('--account='));
if (!accountArg || !accountArg.split('=')[1]) {
  console.error('Usage: node scripts/prune-legacy-branches.mjs --account=<db-key>');
  process.exit(1);
}
const ACCOUNT = accountArg.split('=')[1];
const TARGETS = [
  `${ACCOUNT}/tvLog`,
  `${ACCOUNT}/sharedDBSearches`,
  `${ACCOUNT}/settings/personalAwards/null`
];

console.log('Taking a fresh full backup first…');
execFileSync('node', [new URL('./backup-database.mjs', import.meta.url).pathname, '--quiet'], { stdio: 'inherit' });

for (const path of TARGETS) {
  const snapshot = await db.ref(path).once('value');
  if (!snapshot.exists()) {
    console.log(`- ${path}: already absent`);
    continue;
  }
  const size = (JSON.stringify(snapshot.val()).length / 1048576).toFixed(2);
  await db.ref(path).remove();
  console.log(`✔ removed ${path} (${size} MB)`);
}

const after = await db.ref(ACCOUNT).once('value');
console.log(`Account now ${(JSON.stringify(after.val()).length / 1048576).toFixed(2)} MB raw.`);
process.exit(0);

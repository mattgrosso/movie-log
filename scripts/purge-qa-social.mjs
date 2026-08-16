// Removes the QA tester account's social footprint from the live database.
//
//   node scripts/purge-qa-social.mjs           # show what would go
//   node scripts/purge-qa-social.mjs --delete  # actually delete
//
// Why (Natalie, 2026-08-16): "In the film club, I can see the cinema test user
// and I can invite them to be in my film club with me which shouldn't be
// possible." `yarn mint-test-token` signs a browser in as a real Firebase
// account, and sharing defaults ON, so a QA session published the tester as a
// findable person in everyone's Film Club.
//
// The code fix (isQaAccountKey guards in the store, omitQaAccounts on the way
// out in FilmClubScreen) stops it recurring and hides any row that already
// exists. This clears the rows the QA sessions already wrote.
//
// Requires FIREBASE_ADMIN_KEY_PATH in .env.local.

import { readFileSync } from 'fs';
import { loadEnvLocal } from './loadEnvLocal.mjs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const QA_KEYS = ['cinemaroll-tester-example-com'];
const BRANCHES = ['social/directory', 'social/profiles', 'social/friends', 'clubDirectory', 'clubFeed', 'clubInbox'];

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
const doDelete = process.argv.includes('--delete');

for (const qaKey of QA_KEYS) {
  for (const branch of BRANCHES) {
    const path = `${branch}/${qaKey}`;
    const value = (await db.ref(path).get()).val();
    if (value == null) continue;

    const summary = typeof value === 'object' ? `{${Object.keys(value).join(', ')}}` : String(value);
    if (doDelete) {
      await db.ref(path).set(null);
      console.log(`deleted  ${path}  was ${summary}`);
    } else {
      console.log(`would delete  ${path}  ${summary}`);
    }
  }

  // Anyone who befriended the tester before the fix keeps a dead friend.
  for (const branch of ['social/friends', 'social/requests']) {
    const all = (await db.ref(branch).get()).val() || {};
    for (const [owner, entries] of Object.entries(all)) {
      if (!entries || !entries[qaKey]) continue;
      const path = `${branch}/${owner}/${qaKey}`;
      if (doDelete) {
        await db.ref(path).set(null);
        console.log(`deleted  ${path}`);
      } else {
        console.log(`would delete  ${path}`);
      }
    }
  }
}

console.log(doDelete ? 'done.' : '\nDry run. Re-run with --delete to apply.');
process.exit(0);

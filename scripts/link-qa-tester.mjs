// Makes the QA tester a friend of a real account, one-way as far as the UI is
// concerned.
//
//   node scripts/link-qa-tester.mjs                    # show what would change
//   node scripts/link-qa-tester.mjs --link             # create the edges
//   node scripts/link-qa-tester.mjs --unlink           # remove them again
//   node scripts/link-qa-tester.mjs --link --account someone-example-com
//
// Why (Matt, 2026-08-16): "Can we make it so that the testing account is
// friends with me, but that I just don't see them in my friend's list? So,
// like, they can see me, but I can't see them. That way you could test
// things." Without this the tester has no friends, so the Film Club feed,
// club favourites, most-divisive and the whole per-friend comparison can't be
// rendered in a browser at all — only in tests.
//
// BOTH edges are written, deliberately. The database rules only allow reading
// a profile when each side lists the other:
//
//   social/profiles/$userKey/.read = ... friends/$userKey/me AND friends/me/$userKey
//
// so a genuinely one-sided edge would leave the tester unable to read
// anything. The one-way-ness is in the client instead: `socialFriendKeys`
// drops QA accounts, which hides the tester from the friends list, the club
// summary, the update badge and the profile fetch — while leaving the real
// account fully visible to the tester.
//
// Note `social/friends` is readable by any signed-in user, so this edge is not
// a secret; it just isn't shown.
//
// Requires FIREBASE_ADMIN_KEY_PATH in .env.local.

import { readFileSync } from 'fs';
import { loadEnvLocal } from './loadEnvLocal.mjs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const TESTER_KEY = 'cinemaroll-tester-example-com';
const DEFAULT_ACCOUNT = 'mattgrosso-gmail-com';

loadEnvLocal();
const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
if (!keyPath) {
  console.error('Missing FIREBASE_ADMIN_KEY_PATH in .env.local.');
  process.exit(1);
}

const args = process.argv.slice(2);
const accountIndex = args.indexOf('--account');
const account = accountIndex === -1 ? DEFAULT_ACCOUNT : args[accountIndex + 1];
const link = args.includes('--link');
const unlink = args.includes('--unlink');

if (link && unlink) {
  console.error('Pick one of --link or --unlink.');
  process.exit(1);
}
if (!account) {
  console.error('--account needs a database key, e.g. someone-example-com');
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))),
  databaseURL: 'https://movie-log-8c4d5-default-rtdb.firebaseio.com'
});

const db = getDatabase();
const edges = [
  `social/friends/${account}/${TESTER_KEY}`,
  `social/friends/${TESTER_KEY}/${account}`
];

// A friendship the app can't see is still worth sanity-checking: if the real
// account has never published a profile there is nothing for the tester to
// read, and the link would look broken rather than absent.
const profile = (await db.ref(`social/profiles/${account}`).get()).val();
if (!profile) {
  console.log(`NOTE: ${account} has no published profile yet — turn sharing on in Settings, or the tester will see a friend with no data.`);
}

for (const path of edges) {
  const exists = (await db.ref(path).get()).val() === true;

  if (link) {
    await db.ref(path).set(true);
    console.log(`${exists ? 'already set' : 'created  '}  ${path}`);
  } else if (unlink) {
    await db.ref(path).set(null);
    console.log(`${exists ? 'removed  ' : 'not set  '}  ${path}`);
  } else {
    console.log(`${exists ? 'exists       ' : 'would create '}  ${path}`);
  }
}

if (!link && !unlink) {
  console.log('\nDry run. Re-run with --link to apply, or --unlink to undo.');
} else if (link) {
  console.log(`\nDone. ${account} will not see the tester in their Film Club; the tester sees them normally.`);
}

process.exit(0);

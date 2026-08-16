// One-off QA helper: gives the tester account a linked Movie Hat so the
// watchlist's hat controls can be looked at in a browser. Writes only under
// the tester's own settings branch.
import { readFileSync } from 'fs';
import { loadEnvLocal } from './loadEnvLocal.mjs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

loadEnvLocal();
initializeApp({
  credential: cert(JSON.parse(readFileSync(process.env.FIREBASE_ADMIN_KEY_PATH, 'utf8'))),
  databaseURL: 'https://movie-log-8c4d5-default-rtdb.firebaseio.com'
});

const hats = process.argv.includes('--clear') ? null : [{ title: 'Dev Hat', dbKey: '-NP5mQsRfou1Hs4lRLwh' }];
await getDatabase().ref('cinemaroll-tester-example-com/settings/movieHat/hats').set(hats);
console.log('tester linked hats:', JSON.stringify(hats));
process.exit(0);

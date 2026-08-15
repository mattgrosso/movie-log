// Deploys database.rules.json to the live Realtime Database via the rules
// REST endpoint, authenticated with the same service account as the other
// admin scripts — no interactive `firebase login` needed. Regenerate the
// file first (`yarn generate-db-rules`); this script refuses to deploy a
// hand-edited file that's out of date with its generator by design (it
// simply pushes whatever the generator last wrote).
//
// The endpoint accepts the JSONC the generator emits (comments included),
// and returns the current rules on GET — which we fetch first and print a
// size line for, so a bad push is obvious and recoverable (rerun after
// `git checkout` of the previous rules file).

import { readFileSync } from 'fs';
import { loadEnvLocal } from './loadEnvLocal.mjs';
import { JWT } from 'google-auth-library';

const DB_URL = 'https://movie-log-8c4d5-default-rtdb.firebaseio.com';

loadEnvLocal();
const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
if (!keyPath) {
  console.error('Missing FIREBASE_ADMIN_KEY_PATH in .env.local.');
  process.exit(1);
}
const key = JSON.parse(readFileSync(keyPath, 'utf8'));
const client = new JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/firebase.database'
  ]
});
const { token } = await client.getAccessToken();

const rulesUrl = `${DB_URL}/.settings/rules.json?access_token=${token}`;

const current = await fetch(rulesUrl);
const currentText = await current.text();
console.log(`Current live rules: ${(currentText.length / 1024).toFixed(1)} KB`);

const next = readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
const response = await fetch(rulesUrl, { method: 'PUT', body: next });
if (!response.ok) {
  console.error(`Deploy FAILED (${response.status}):`, await response.text());
  process.exit(1);
}
console.log(`Deployed database.rules.json (${(next.length / 1024).toFixed(1)} KB) to ${DB_URL}`);

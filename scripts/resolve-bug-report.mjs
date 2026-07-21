// Marks one or more bug reports as resolved, so fetch-bug-reports.mjs stops
// surfacing them by default (see its own --all flag to see everything,
// resolved or not).
//
// Requires the same env var as fetch-bug-reports (read from .env.local via
// Node's native --env-file flag):
//   FIREBASE_ADMIN_KEY_PATH
//
// Run with: yarn resolve-bug-report <reportId> [reportId...]

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const databaseURL = 'https://movie-log-8c4d5-default-rtdb.firebaseio.com';
const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;

if (!keyPath) {
  console.error('Missing FIREBASE_ADMIN_KEY_PATH in .env.local.');
  process.exit(1);
}

const reportIds = process.argv.slice(2);
if (!reportIds.length) {
  console.error('Usage: yarn resolve-bug-report <reportId> [reportId...]');
  console.error('(report IDs are printed by `yarn fetch-bug-reports`, e.g. -Oxf9_3qcyXUHOzNoYD7)');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount), databaseURL });
const db = getDatabase();

for (const id of reportIds) {
  const reportRef = db.ref(`bugReports/${id}`);
  const snapshot = await reportRef.once('value');
  if (!snapshot.exists()) {
    console.error(`No report found with id ${id} - skipping.`);
    continue;
  }
  await reportRef.update({ resolved: true, resolvedAt: Date.now() });
  console.log(`Marked ${id} resolved.`);
}

process.exit(0);

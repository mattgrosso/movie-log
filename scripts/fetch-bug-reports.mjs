// Prints every UNRESOLVED bug report submitted via the in-app "Report a bug"
// button (src/components/BugReportButton.vue -> src/utils/bugReports.js),
// newest first. Uses the Firebase Admin SDK, which bypasses
// database.rules.json entirely (that file just leaves read/write wide open,
// same as the rest of this app's data) — this is simply the convenient
// read/triage path.
//
// Once triaged, mark a report resolved with `yarn resolve-bug-report
// <reportId>` (scripts/resolve-bug-report.mjs) so it stops showing up here.
//
// Requires one env var, read from .env.local via Node's native --env-file
// flag (no dotenv dependency needed — see package.json's
// "fetch-bug-reports" script):
//   FIREBASE_ADMIN_KEY_PATH - path to a service-account JSON key
//                              (Firebase Console -> Project Settings ->
//                              Service Accounts -> Generate new private key).
//                              Not committed to git.
//
// Run with: yarn fetch-bug-reports          (unresolved only)
//       or: yarn fetch-bug-reports --all    (everything, resolved or not)

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// Matches the databaseURL hardcoded in src/store/index.js — this app has one
// Firebase project, so there's nothing to configure per-environment.
const databaseURL = 'https://movie-log-8c4d5-default-rtdb.firebaseio.com';
const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;

if (!keyPath) {
  console.error('Missing FIREBASE_ADMIN_KEY_PATH in .env.local.');
  console.error('Firebase Console -> Project Settings -> Service Accounts -> Generate new private key.');
  process.exit(1);
}

const showAll = process.argv.includes('--all');

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount), databaseURL });

const snapshot = await getDatabase().ref('bugReports').once('value');
const reports = snapshot.val() || {};
const allEntries = Object.entries(reports).sort(
  ([, a], [, b]) => (b.createdAt || 0) - (a.createdAt || 0),
);
const entries = showAll ? allEntries : allEntries.filter(([, report]) => !report.resolved);
const resolvedCount = allEntries.length - allEntries.filter(([, report]) => !report.resolved).length;

if (!allEntries.length) {
  console.log('No bug reports yet.');
  process.exit(0);
}
if (!entries.length) {
  console.log(`No unresolved bug reports (${resolvedCount} resolved — rerun with --all to see them).`);
  process.exit(0);
}

for (const [id, report] of entries) {
  const when = report.createdAt ? new Date(report.createdAt).toISOString() : 'unknown time';
  const appState = typeof report.appState === 'string' ? JSON.parse(report.appState) : (report.appState || null);

  console.log('='.repeat(72));
  console.log(`report ${id} - ${when}${report.resolved ? ' [RESOLVED]' : ''}`);
  console.log(`reporter: ${report.reporterEmail || 'unknown'}`);
  console.log(`url: ${report.url || 'unknown'}`);
  console.log(`userAgent: ${report.userAgent || 'unknown'}`);
  console.log(`screenSize: ${report.screenSize || 'unknown'}${report.devicePixelRatio ? ` @${report.devicePixelRatio}x` : ''}`);
  console.log('---');
  console.log(report.transcript || '(empty)');
  if (appState) {
    console.log('--- app state at time of report ---');
    console.log(JSON.stringify(appState, null, 2));
  }
}

console.log('='.repeat(72));
console.log(`${entries.length} report(s) shown${showAll ? '' : ` (${resolvedCount} resolved report(s) hidden — rerun with --all to see them)`}.`);
process.exit(0);

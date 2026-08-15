// The rollback path for yarn backup-db snapshots.
//
//   yarn restore-db <backup-file> --account <key>           # DRY RUN (default)
//   yarn restore-db <backup-file> --account <key> --yes     # actually restore
//   yarn restore-db --list                                  # show snapshots
//
// Deliberately account-scoped: restoring one account's subtree is the
// realistic recovery ("we broke Natalie's library at 3pm"), and it can't
// clobber every OTHER account with older data as a full-root restore would.
// A full-root restore stays a deliberate two-step: run once per account.
//
// Dry run first, always: prints an entry-level diff summary (added /
// removed / changed movieLog entries, settings changed?) so you see exactly
// what rolling back means BEFORE anything is written. --yes performs it,
// and takes a fresh safety backup of the CURRENT state first, so even a
// restore is itself reversible.

import { readFileSync, readdirSync } from 'fs';
import { gunzipSync } from 'zlib';
import { homedir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { loadEnvLocal } from './loadEnvLocal.mjs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const BACKUP_DIR = join(homedir(), 'cinemaroll-backups');

const args = process.argv.slice(2);
if (args.includes('--list')) {
  const files = readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json.gz')).sort().reverse();
  files.forEach((f) => console.log(join(BACKUP_DIR, f)));
  process.exit(0);
}

const file = args.find((a) => !a.startsWith('--'));
const accountFlag = args.indexOf('--account');
const account = accountFlag !== -1 ? args[accountFlag + 1] : null;
const confirmed = args.includes('--yes');

if (!file || !account) {
  console.error('Usage: yarn restore-db <backup-file> --account <account-key> [--yes]');
  console.error('       yarn restore-db --list');
  process.exit(1);
}

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

const resolved = file.includes('/') ? file : join(BACKUP_DIR, file);
const backupRoot = JSON.parse(gunzipSync(readFileSync(resolved)).toString());
const backupAccount = backupRoot[account];
if (!backupAccount) {
  console.error(`Account '${account}' not found in ${resolved}.`);
  console.error(`Accounts present: ${Object.keys(backupRoot).filter((k) => k !== 'bugReports').join(', ')}`);
  process.exit(1);
}

const liveSnapshot = await db.ref(account).once('value');
const live = liveSnapshot.val() || {};

const stable = (v) => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
};

const liveLog = live.movieLog || {};
const backupLog = backupAccount.movieLog || {};
const added = Object.keys(backupLog).filter((k) => !(k in liveLog));
const removed = Object.keys(liveLog).filter((k) => !(k in backupLog));
const changed = Object.keys(backupLog).filter((k) => k in liveLog && stable(backupLog[k]) !== stable(liveLog[k]));
const settingsDiffer = stable(backupAccount.settings || null) !== stable(live.settings || null);

console.log(`Restore ${account} from ${resolved.split('/').pop()}`);
console.log(`  movieLog: ${Object.keys(liveLog).length} live -> ${Object.keys(backupLog).length} in backup`);
console.log(`  entries the restore would ADD BACK : ${added.length}${added.length ? '  (e.g. ' + added.slice(0, 3).map((k) => k.split('-').pop()).join(', ') + ')' : ''}`);
console.log(`  entries the restore would REMOVE   : ${removed.length}${removed.length ? '  (e.g. ' + removed.slice(0, 3).map((k) => k.split('-').pop()).join(', ') + ')' : ''}`);
console.log(`  entries the restore would OVERWRITE: ${changed.length}${changed.length ? '  (e.g. ' + changed.slice(0, 3).map((k) => k.split('-').pop()).join(', ') + ')' : ''}`);
console.log(`  settings subtree differs: ${settingsDiffer ? 'YES (would be overwritten)' : 'no'}`);

if (!confirmed) {
  console.log('\nDRY RUN — nothing written. Re-run with --yes to perform this restore.');
  process.exit(0);
}

// Safety backup of the CURRENT state before touching anything, so even a
// restore is reversible.
console.log('\nTaking safety backup of current state first…');
execFileSync('node', [join(new URL('.', import.meta.url).pathname, 'backup-database.mjs'), '--quiet', '--local-only'], { stdio: 'inherit' });

console.log(`Restoring ${account}…`);
await db.ref(account).set(backupAccount);
console.log('✔ restored. The affected user should relaunch the app (full download picks it up).');
process.exit(0);

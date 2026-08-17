// Full-database backup with offsite copy and retention.
//
//   yarn backup-db                # snapshot -> ~/cinemaroll-backups/ + S3
//   yarn backup-db --local-only   # skip the S3 upload
//   yarn backup-db --quiet        # one-line output (used by predeploy)
//   --skip-if-fresh[=hours]       # no-op if a snapshot newer than N hours
//                                 # (default 6) exists. Used by predeploy:
//                                 # every full read of the DB is billed RTDB
//                                 # egress, and deploy-per-stopping-point was
//                                 # producing 36-56 full downloads a day
//                                 # (~$4-7/day) in Aug 2026. Manual
//                                 # `yarn backup-db` never skips.
//
// Why this exists (Matt, 2026-08-15): "when we're messing with this...
// we're always a little bit nervous that we're gonna lose real data."
// So: every backup is a complete gzipped JSON export of the database root,
// timestamped, kept locally with retention (last 14 days + every
// first-of-month snapshot forever) AND uploaded to a private S3 bucket so a
// dead laptop can't take the backups with it. Restore path:
// scripts/restore-database.mjs (yarn restore-db).
//
// Requires FIREBASE_ADMIN_KEY_PATH in .env.local. S3 uses the same
// `personal-deploy` AWS profile the site deploy uses; if the bucket is
// missing or the upload fails, the local snapshot still stands and the
// failure is reported, never thrown.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { gzipSync } from 'zlib';
import { homedir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { loadEnvLocal } from './loadEnvLocal.mjs';
import { freshSnapshot } from './snapshotFreshness.mjs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const quiet = process.argv.includes('--quiet');
const localOnly = process.argv.includes('--local-only');
const log = (...args) => { if (!quiet) console.log(...args); };

const skipIfFreshArg = process.argv.find((a) => a === '--skip-if-fresh' || a.startsWith('--skip-if-fresh='));
const skipIfFreshHours = skipIfFreshArg
  ? Number(skipIfFreshArg.split('=')[1] ?? 6) || 6
  : null;

loadEnvLocal();
const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
if (!keyPath) {
  console.error('Missing FIREBASE_ADMIN_KEY_PATH in .env.local.');
  process.exit(1);
}
const databaseURL = 'https://movie-log-8c4d5-default-rtdb.firebaseio.com';
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))), databaseURL });
const db = getDatabase();

export const BACKUP_DIR = join(homedir(), 'cinemaroll-backups');
const S3_BUCKET = 'cinemaroll-db-backups';
const AWS_PROFILE = 'personal-deploy';

function timestampName () {
  // 2026-08-15T14-30-05 — filesystem-safe, sorts chronologically.
  return new Date().toISOString().replace(/\.\d+Z$/, '').replace(/:/g, '-');
}

// Retention: every snapshot from the last 14 days, plus the FIRST snapshot
// of each month forever (a ~2MB gz makes "forever" cheap). Never deletes
// the file it just wrote.
export function pruneLocal (dir, now = Date.now()) {
  const files = readdirSync(dir).filter((f) => /^db-\d{4}-\d{2}-\d{2}T.*\.json\.gz$/.test(f)).sort();
  // The first (oldest) snapshot of each month is kept forever.
  const seenMonths = new Set();
  const monthlyKept = new Set();
  for (const file of files) {
    const month = file.slice(3, 10); // YYYY-MM
    if (!seenMonths.has(month)) {
      seenMonths.add(month);
      monthlyKept.add(file);
    }
  }
  const cutoff = now - 14 * 24 * 60 * 60 * 1000;
  const removed = [];
  for (const file of files) {
    const date = new Date(file.slice(3, 13));
    if (date.getTime() >= cutoff) continue;
    if (monthlyKept.has(file)) continue;
    unlinkSync(join(dir, file));
    removed.push(file);
  }
  return removed;
}

async function main () {
  if (skipIfFreshHours !== null) {
    let existing = [];
    try { existing = readdirSync(BACKUP_DIR); } catch { /* no backups yet */ }
    const fresh = freshSnapshot(existing, skipIfFreshHours * 60 * 60 * 1000);
    if (fresh) {
      console.log(`db backup: skipped, ${fresh} is under ${skipIfFreshHours}h old`);
      process.exit(0);
    }
  }
  log('Reading full database…');
  const snapshot = await db.ref('/').once('value');
  const data = snapshot.val() || {};
  const accounts = Object.keys(data).filter((k) => k !== 'bugReports').length;
  const json = JSON.stringify(data);
  const gz = gzipSync(Buffer.from(json));

  mkdirSync(BACKUP_DIR, { recursive: true });
  const name = `db-${timestampName()}.json.gz`;
  const localPath = join(BACKUP_DIR, name);
  writeFileSync(localPath, gz);
  const mb = (gz.length / 1024 / 1024).toFixed(1);
  log(`✔ local: ${localPath} (${mb} MB gz, ${accounts} top-level accounts)`);

  const removed = pruneLocal(BACKUP_DIR);
  if (removed.length) log(`  pruned ${removed.length} old local snapshot(s) per retention`);

  if (!localOnly) {
    try {
      execFileSync('aws', ['s3', 'cp', localPath, `s3://${S3_BUCKET}/${name}`, '--profile', AWS_PROFILE], { stdio: 'pipe' });
      log(`✔ offsite: s3://${S3_BUCKET}/${name}`);
    } catch (error) {
      const detail = String(error.stderr || error.message).trim().split('\n').pop();
      console.error(`! S3 upload failed (local snapshot still safe): ${detail}`);
      console.error(`  (bucket '${S3_BUCKET}' may need creating: aws s3 mb s3://${S3_BUCKET} --profile ${AWS_PROFILE})`);
    }
  }

  if (quiet) console.log(`db backup: ${name} (${mb} MB)`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Backup failed:', error.message);
  process.exit(1);
});

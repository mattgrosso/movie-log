// Server-side runner for the one-time catch-up migrations that otherwise
// live behind manual Settings buttons ("Add change timestamps", "Slim down
// stored data", box office / production countries backfills). The app keeps
// all four of these current on every NEW rating — the buttons exist only to
// catch up data rated before each feature shipped, and most users will
// never click them ("I know that Seth isn't going to go click them"). This
// script clicks them for every account, via the Admin SDK.
//
// Usage:
//   yarn account-maintenance                      # audit only, read-only
//   yarn account-maintenance --apply-timestamps   # write missing updatedAt stamps
//   yarn account-maintenance --apply-tmdb         # backfill box office + countries (1 TMDB call/movie)
//   yarn account-maintenance --account <key>      # limit any mode to one account
//
// Both apply modes are ADDITIVE (leaf writes only, nothing deleted or
// replaced wholesale). The trim ("Slim down stored data") is deliberately
// NOT implemented here — it deletes fields, so a server-side run should
// port storedEntry.js's exact trimUpdatesFor logic and take per-account
// backups first; the audit just counts how much junk each account carries.
//
// Requires FIREBASE_ADMIN_KEY_PATH in .env.local (same as fetch-bug-reports).

import { readFileSync } from 'fs';
import { loadEnvLocal } from './loadEnvLocal.mjs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase, ServerValue } from 'firebase-admin/database';

// The src/ collectors can't be imported here — Node loads the repo's .js as
// CommonJS (no "type": "module"; the bundler is what makes their ESM syntax
// work in-app). These are line-for-line ports; if a collector changes,
// change it here too:
//   - collectEntriesNeedingStamp   -> src/assets/javascript/syncStamp.js
//   - collectEntriesNeedingTrim    -> src/assets/javascript/storedEntry.js (simplified to its trigger conditions)
//   - collectMoviesNeedingBoxOffice-> src/assets/javascript/backfillBoxOffice.js
//   - collectMoviesNeedingCountries-> src/assets/javascript/backfillProductionCountries.js
const hasRealTmdbId = (entry) => typeof entry?.movie?.id === 'number';

const collectEntriesNeedingStamp = (movieLog) =>
  Object.entries(movieLog || {})
    .filter(([, entry]) => !Number.isFinite(entry?.updatedAt))
    .map(([dbKey]) => ({ dbKey }));

// storedEntry.js's real trimUpdatesFor computes exact deletion paths; for
// the AUDIT we only need "does this entry still carry junk" — the runtime
// fields and the untrimmed-crew signal it keys off.
const RUNTIME_ENTRY_FIELDS = ['dbKey', '_search'];
const collectEntriesNeedingTrim = (movieLog) =>
  Object.entries(movieLog || {})
    .filter(([, entry]) =>
      RUNTIME_ENTRY_FIELDS.some((field) => entry?.[field] !== undefined) ||
      entry?.movie?.flatKeywords !== undefined)
    .map(([dbKey]) => ({ dbKey }));

const collectMoviesNeedingBoxOffice = (movieLog) =>
  Object.keys(movieLog || {})
    .map((dbKey) => ({ dbKey, entry: movieLog[dbKey] }))
    .filter(({ entry }) => hasRealTmdbId(entry) && !entry.movie.budget && !entry.movie.revenue);

const collectMoviesNeedingCountries = (movieLog) =>
  Object.keys(movieLog || {})
    .map((dbKey) => ({ dbKey, entry: movieLog[dbKey] }))
    .filter(({ entry }) => hasRealTmdbId(entry) && entry.movie.production_countries === undefined);

loadEnvLocal();
// The TMDB key lives in .env (build-time env), not .env.local — pull it in
// the same non-throwing way for the --apply-tmdb mode.
try {
  const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  envFile.split('\n').forEach((line) => {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  });
} catch {
  // .env missing is fine for audit/timestamps modes.
}

const databaseURL = 'https://movie-log-8c4d5-default-rtdb.firebaseio.com';
const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
if (!keyPath) {
  console.error('Missing FIREBASE_ADMIN_KEY_PATH in .env.local.');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))), databaseURL });
const db = getDatabase();

// Top-level keys that are not user accounts.
const NON_ACCOUNT_KEYS = new Set(['bugReports', 'testing-database']);

const applyTimestamps = process.argv.includes('--apply-timestamps');
const applyTmdb = process.argv.includes('--apply-tmdb');
const accountFlagIndex = process.argv.indexOf('--account');
const onlyAccount = accountFlagIndex !== -1 ? process.argv[accountFlagIndex + 1] : null;

const BATCH_SIZE = 100;
const TMDB_CONCURRENCY = 5;

// One /movie/{id} call carries budget/revenue AND countries/languages —
// the same endpoint both in-app backfills hit separately.
async function fetchTmdbFinancials (tmdbId) {
  const apiKey = process.env.VUE_APP_TMDB_API_KEY;
  const response = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`);
  if (!response.ok) throw new Error(`TMDB ${response.status} for ${tmdbId}`);
  const data = await response.json();
  return {
    budget: data.budget ?? 0,
    revenue: data.revenue ?? 0,
    production_countries: data.production_countries || [],
    spoken_languages: data.spoken_languages || []
  };
}

// Backfills box office and/or countries for one account through a small
// worker pool, writing batched multi-path updates. Every touched entry also
// gets a fresh updatedAt — a field changed without a stamp would be
// invisible to a future delta sync (the same one-atomic-write rule
// stampPlanForWrite enforces in-app).
async function tmdbBackfillAccount (accountKey, needBoxOffice, needCountries) {
  const byKey = new Map();
  needBoxOffice.forEach(({ dbKey, entry }) => byKey.set(dbKey, { entry, boxOffice: true, countries: false }));
  needCountries.forEach(({ dbKey, entry }) => {
    const existing = byKey.get(dbKey);
    if (existing) existing.countries = true;
    else byKey.set(dbKey, { entry, boxOffice: false, countries: true });
  });

  const work = [...byKey.entries()];
  let done = 0;
  let failed = 0;
  let pendingUpdates = {};
  let pendingCount = 0;

  const flush = async () => {
    if (!pendingCount) return;
    const updates = pendingUpdates;
    pendingUpdates = {};
    pendingCount = 0;
    await db.ref('/').update(updates);
  };

  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(TMDB_CONCURRENCY, work.length) }, async () => {
    while (nextIndex < work.length) {
      const [dbKey, { entry, boxOffice, countries }] = work[nextIndex++];
      try {
        const financials = await fetchTmdbFinancials(entry.movie.id);
        const base = `${accountKey}/movieLog/${dbKey}`;
        if (boxOffice) {
          pendingUpdates[`${base}/movie/budget`] = financials.budget;
          pendingUpdates[`${base}/movie/revenue`] = financials.revenue;
        }
        if (countries) {
          pendingUpdates[`${base}/movie/production_countries`] = financials.production_countries;
          pendingUpdates[`${base}/movie/spoken_languages`] = financials.spoken_languages;
        }
        pendingUpdates[`${base}/updatedAt`] = ServerValue.TIMESTAMP;
        pendingCount++;
        if (pendingCount >= 25) await flush();
      } catch (error) {
        failed++;
        console.error(`  ! ${dbKey} (${entry.movie?.title || 'unknown'}): ${error.message}`);
      }
      done++;
      if (done % 50 === 0) process.stdout.write(`  tmdb ${done}/${work.length}\r`);
    }
  });
  await Promise.all(workers);
  await flush();
  if (work.length) process.stdout.write('\n');
  return { attempted: work.length, failed };
}

async function stampAccount (accountKey, candidates) {
  let written = 0;
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const updates = {};
    batch.forEach(({ dbKey }) => {
      updates[`${accountKey}/movieLog/${dbKey}/updatedAt`] = ServerValue.TIMESTAMP;
    });
    await db.ref('/').update(updates);
    written += batch.length;
    process.stdout.write(`  stamped ${written}/${candidates.length}\r`);
  }
  if (candidates.length) process.stdout.write('\n');
  return written;
}

const rootSnap = await db.ref('/').once('value');
const root = rootSnap.val() || {};
const accountKeys = Object.keys(root)
  .filter((key) => !NON_ACCOUNT_KEYS.has(key))
  .filter((key) => !onlyAccount || key === onlyAccount);

console.log(`${accountKeys.length} account(s)${applyTimestamps ? ' — APPLYING timestamps' : ' — audit only'}\n`);

for (const accountKey of accountKeys) {
  const movieLog = root[accountKey]?.movieLog || {};
  const total = Object.keys(movieLog).length;
  const needStamp = collectEntriesNeedingStamp(movieLog);
  const needTrim = collectEntriesNeedingTrim(movieLog);
  const needBoxOffice = collectMoviesNeedingBoxOffice(movieLog);
  const needCountries = collectMoviesNeedingCountries(movieLog);

  console.log(`${accountKey}`);
  console.log(`  entries: ${total}`);
  console.log(`  missing updatedAt: ${needStamp.length}`);
  console.log(`  needing trim: ${needTrim.length}`);
  console.log(`  missing box office: ${needBoxOffice.length}`);
  console.log(`  missing countries: ${needCountries.length}`);

  if (applyTimestamps && needStamp.length) {
    const written = await stampAccount(accountKey, needStamp);
    console.log(`  ✔ wrote ${written} updatedAt stamps`);
  }
  if (applyTmdb && (needBoxOffice.length || needCountries.length)) {
    const { attempted, failed } = await tmdbBackfillAccount(accountKey, needBoxOffice, needCountries);
    console.log(`  ✔ tmdb backfill: ${attempted - failed}/${attempted} movies updated${failed ? ` (${failed} failed)` : ''}`);
  }
  console.log('');
}

process.exit(0);

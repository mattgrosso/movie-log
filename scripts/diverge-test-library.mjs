// Reshapes the QA tester's library so it is a plausible OTHER person rather
// than a byte-for-byte copy of the source account.
//
//   node scripts/diverge-test-library.mjs                 # show what it would do
//   node scripts/diverge-test-library.mjs --apply
//   node scripts/diverge-test-library.mjs --apply --keep 250 --from mattgrosso-gmail-com
//
// Why (Matt, 2026-08-16): "I do think you ought to go ahead and modify their
// testing database so it doesn't just match mine perfectly. That probably
// seems like a more useful testing database."
//
// A clone scores 10.0 alignment with a 0.0 average gap, which means Most
// divisive, Biggest disagreements, the criterion bars and the whole
// "they love these, you haven't rated them" list all correctly render
// nothing. None of those can be looked at in a browser until the two
// libraries actually disagree.
//
// Every decision here is a hash of the movie key, so re-running produces the
// SAME library: a QA fixture that changes under you is worse than no fixture.
// Nothing is random.
//
// What it produces, against a ~1,370-title source:
//   - about a fifth of the titles dropped entirely, so the source account has
//     loved films the tester has never rated
//   - about a fifth left exactly as they are, so there is real agreement
//   - the rest nudged, most of them slightly, roughly one in six by 3+ points
//     in one direction or the other — enough to fill a disagreements list
//   - a steady lean per criterion (story up, soundtrack down) so the
//     criterion comparison has a real signal rather than eight zeroes
//   - viewing dates spread across the last few weeks so the "3 hours ago /
//     2 days ago / a date" feed has something to show at every stage
//
// ONLY ever writes under the tester's own branch.
//
// Requires FIREBASE_ADMIN_KEY_PATH in .env.local.

import { readFileSync } from 'fs';
import { loadEnvLocal } from './loadEnvLocal.mjs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const TESTER_KEY = 'cinemaroll-tester-example-com';
const DEFAULT_SOURCE = 'mattgrosso-gmail-com';
const CRITERIA = ['love', 'overall', 'stickiness', 'story', 'direction', 'imagery', 'performance', 'soundtrack'];

// A steady lean per criterion, on top of the per-movie disagreement.
//
// Without this the fixture had nothing to say: shifting all eight criteria by
// the same amount per movie, half up and half down, averages out to roughly
// zero on every criterion — so "Where your tastes differ" correctly rendered
// eight bars of +-0.04 and the panel couldn't be judged at all. A tester who
// simply cares more about story and less about soundtrack exercises it.
const CRITERION_BIAS = {
  love: -0.4,
  overall: 0,
  stickiness: 0.5,
  story: 1.4,
  direction: 0.3,
  imagery: -0.9,
  performance: 0.2,
  soundtrack: -1.6
};

loadEnvLocal();
const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
if (!keyPath) {
  console.error('Missing FIREBASE_ADMIN_KEY_PATH in .env.local.');
  process.exit(1);
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1];
};
const source = valueAfter('--from', DEFAULT_SOURCE);
const keepTarget = Number(valueAfter('--keep', '300'));

if (source === TESTER_KEY) {
  console.error('Refusing to use the tester as its own source.');
  process.exit(1);
}

// FNV-1a: tiny, stable, and identical on every run — which is the whole point.
function hash (text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0);
}

// A stable [0, 1) value per key and purpose.
const roll = (key, salt) => (hash(`${salt}:${key}`) % 10000) / 10000;

const clampScore = (value) => Math.max(0, Math.min(10, Math.round(value * 100) / 100));

initializeApp({
  credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))),
  databaseURL: 'https://movie-log-8c4d5-default-rtdb.firebaseio.com'
});

const db = getDatabase();

const sourceLog = (await db.ref(`${source}/movieLog`).get()).val();
if (!sourceLog) {
  console.error(`${source} has no movieLog to work from.`);
  process.exit(1);
}

const keys = Object.keys(sourceLog);
// Keep the highest-rolling `keepTarget` keys: a deterministic subset that
// isn't just "the first N", so the kept titles are spread across the library.
const kept = keys
  .map((key) => ({ key, score: roll(key, 'keep') }))
  .sort((a, b) => b.score - a.score)
  .slice(0, Math.min(keepTarget, keys.length))
  .map((entry) => entry.key);

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const out = {};
const summary = { unchanged: 0, nudged: 0, strongly: 0, dropped: keys.length - kept.length };

kept.forEach((key, index) => {
  const entry = sourceLog[key];
  const ratings = Array.isArray(entry?.ratings) ? entry.ratings : [];
  if (!ratings.length) return;

  const agreement = roll(key, 'agree');
  // A fifth left alone; one in six pushed hard; the rest nudged gently.
  const delta = agreement < 0.2
    ? 0
    : agreement > 0.83
      ? (roll(key, 'dir') < 0.5 ? -1 : 1) * (2.5 + roll(key, 'mag') * 3)
      : (roll(key, 'dir') < 0.5 ? -1 : 1) * (roll(key, 'mag') * 1.2);

  if (delta === 0) summary.unchanged += 1;
  else if (Math.abs(delta) >= 2.5) summary.strongly += 1;
  else summary.nudged += 1;

  // The 40 most recent get dates inside the last three weeks, so the feed has
  // something at every stage of "3 hours ago / 2 days ago / a date".
  const recentIndex = index < 40 ? index : null;
  const watchedAt = recentIndex == null
    ? null
    : now - Math.round((recentIndex * 0.55 + roll(key, 'when') * 0.5) * DAY);

  out[key] = {
    ...entry,
    ratings: ratings.map((rating, ratingIndex) => {
      const shifted = { ...rating };
      CRITERIA.forEach((criterion) => {
        if (Number.isFinite(Number(shifted[criterion]))) {
          shifted[criterion] = clampScore(Number(shifted[criterion]) + delta + CRITERION_BIAS[criterion]);
        }
      });
      if (Number.isFinite(Number(shifted.calculatedTotal))) {
        shifted.calculatedTotal = clampScore(Number(shifted.calculatedTotal) + delta);
      }
      if (watchedAt && ratingIndex === ratings.length - 1) {
        shifted.date = watchedAt;
      }
      return shifted;
    })
  };
});

console.log(`source ${source}: ${keys.length} titles`);
console.log(`tester will hold ${Object.keys(out).length} of them`);
console.log(`  dropped entirely : ${summary.dropped}`);
console.log(`  identical scores : ${summary.unchanged}`);
console.log(`  nudged slightly  : ${summary.nudged}`);
console.log(`  strong disagree  : ${summary.strongly}`);

if (!apply) {
  console.log('\nDry run. Re-run with --apply to write it to the tester branch.');
  process.exit(0);
}

await db.ref(`${TESTER_KEY}/movieLog`).set(out);
console.log(`\nWrote ${Object.keys(out).length} titles to ${TESTER_KEY}/movieLog.`);
console.log('Open the app as the tester (yarn mint-test-token) to republish its profile.');
process.exit(0);

// Version bump + build as one atomic step for `yarn deploy`.
//
// Board item (2026-08-15): the old `build: update-version && build` wrote
// the bumped version to .env BEFORE building, so a failed build (v1.44.8's
// SCSS brace) or a mere verification build permanently consumed a version
// number — the patch number quietly sailed past 100 that way once.
//
// New contract:
//   - `yarn build` never bumps — it builds whatever version .env holds.
//     Check-builds are free.
//   - `yarn deploy` runs THIS: bump (VERSION_BUMP env or interactive
//     prompt, same as before), then build — and if the build fails, the
//     .env bump is rolled back byte-for-byte, so the version only ever
//     advances on a build that actually succeeded and is about to ship.

import { readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';

const envBefore = readFileSync('.env', 'utf8');

const bump = spawnSync('node', ['src/assets/javascript/version.js'], { stdio: 'inherit' });
if (bump.status !== 0) {
  process.exit(bump.status ?? 1);
}

const build = spawnSync('yarn', ['build'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (build.status !== 0) {
  writeFileSync('.env', envBefore);
  console.error('\n✗ Build failed — version bump rolled back (no gap number).');
  process.exit(build.status ?? 1);
}

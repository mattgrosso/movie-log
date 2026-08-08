// Loads .env.local into process.env for the admin scripts.
//
// These used to rely on Node's native `--env-file` flag, which needs Node
// 20.6+ — but this repo is pinned to Node 18.18 (.tool-versions, and CI's
// node-version: 18, both for the reasons documented in CLAUDE.md's ESLint 9
// and firebase-admin notes). So that flag failed outright with "bad option",
// making both scripts unrunnable.
//
// Deliberately a few lines rather than a dotenv dependency: this parses one
// gitignored file for one script family, and adding a runtime dep to the
// project for it would be out of proportion.
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');

export function loadEnvLocal () {
  if (!existsSync(envPath)) return;

  readFileSync(envPath, 'utf8').split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    const separator = line.indexOf('=');
    if (separator === -1) return;

    const key = line.slice(0, separator).trim();
    // Values may be quoted; a path with spaces is the realistic case here.
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');

    // A real environment variable wins, so a one-off override still works.
    if (!(key in process.env)) process.env[key] = value;
  });
}

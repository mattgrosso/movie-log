# Overnight notes — 2026-08-15

Matt asked for a first pass on everything left on the board, for morning
review. Everything below is committed, pushed to main, and (where
user-facing) deployed. Full suite green at every step; every feature has
tests.

## Shipped and live

| Version | What |
|---|---|
| v1.41.0 | **Watchlist screen** (`/watchlist`, bookmark-star button next to Games on Home): "Worth a rewatch" (local; margin-above-7 × √years-since-logged), "From directors/actors you love" (favorites derived from your ratings → TMDB filmographies, unseen-only, vote-weighted). Tapping an unseen movie enters the normal rating flow. Report **resolved**. |
| v1.42.0 | **Library Poster** (`/library-poster`, button at top of Settings): My top 100 / This year / Everything → canvas poster near 2:3 shape, share-sheet save (or long-press). Report **resolved**. |
| v1.42.1 | **"More like your favorites"** on the Watchlist — recommendations v1: TMDB `/recommendations` seeded by your five top-rated movies, same ranking pipeline. Report left **OPEN** on purpose: you said "we'll work out together," so this is a straw man to react to. The seeding/scoring swaps out without touching the screen. |

## Built, committed, deliberately NOT wired/run

- **`funFacts.js`** (+7 tests): time-in-the-dark, home decade, busiest
  month, genre-of-the-house, biggest day, deepest cut. UI placement is a
  design choice — recommendation and options in
  `docs/proposals/2026-08-15-social-sharing-and-fun-data.md`. Insights.vue
  untouched (3,000 untested lines, not a 3am file).
- **`--apply-trim`** in account-maintenance: the server-side "Slim down
  stored data" for everyone. Uses the REAL `storedEntry.js` logic (temp-copy
  import, cannot drift), auto-backs-up and verifies before touching
  anything, stamps `updatedAt` on every touched entry. **Staged, unrun** —
  it deletes fields, so it waits for you: `yarn account-maintenance
  --apply-trim` (add `--account <key>` to do one first).
- **Full account backups taken tonight**: all 27 accounts incl. Brian's →
  `~/cinemaroll-backups/2026-08-15/` (106 MB, each verified). Pre-trim
  safety net and a Brian-data snapshot in one.

## Written for discussion

- `docs/proposals/2026-08-15-social-sharing-and-fun-data.md` — social in
  three sizes (recommend: opt-in library-compare share links, which is ALSO
  Brian's list-comparison feature), the Brian interchange format, the
  compare-screen math that's buildable without him, fun-facts placement.

## Judgment calls to sanity-check in the morning

- **Rewatch scoring**: margin-above-threshold × √years. Tuned so quality
  beats sheer age; thresholds (rating ≥ 7, ≥ 1 year) are constants in
  `discover.js`, trivially tweakable.
- **Favorite people**: avg rating × log2(count+1), min 2 movies, top 3 each
  for directors/actors; actor credit = top-5 billing.
- **Watchlist ranking**: TMDB vote_average × log10(votes), min 50 votes —
  populist by design; niche gems lose. Easy dial.
- **Recommendations v1 is intentionally naive** (TMDB's own engine, pooled).
- The Watchlist screen costs ~12–17 TMDB calls per visit (no caching yet).

## Not touched, with reasons

- **Tiebreak report** — still open; hardening deployed earlier (v1.37.46),
  awaiting your next tournament or the forensic script.
- **Social/Brian implementation** — proposal-first; the account audit
  changed the picture (27 real users; Brian's 2,305 entries already here —
  ask him what they are before building an importer).
- **Delta-sync phase 2** — shadow reports need a few days of your launches.
- **Insights.vue wiring** of fun facts — daytime work.

## Loose ends from earlier tonight (unchanged)

Natalie's phone glance; shadow-mode browser test (needs your Google
popup click); phone check of Poster Zoom/Clue Budget CSS fixes.

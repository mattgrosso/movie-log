# Overnight session — 2026-07-21

Delete this file whenever — it's a one-time handoff note, not project documentation (that's all in `CLAUDE.md`, which has full technical detail on everything below).

## What shipped (3 commits on `main`)

1. **Bug report button** — floating bug icon, bottom-right, on every screen. Writes to Firebase (`bugReports`), with `yarn fetch-bug-reports` / `yarn resolve-bug-report <id>` to triage from the terminal. Same pattern as the button already in Thunderstone/Space Base.
2. **Personal awards + more ceremonies on a movie's own page** — MovieDetail's Awards section now has three parts: **My Awards** (your own PersonalAwardsModal picks — tap one to jump back into that year's modal and edit it), **Academy Awards** (unchanged, existing feature), and **Other Ceremonies** (Golden Globes Drama/Musical-Comedy/Director, BAFTA Best Film, Cannes Palme d'Or, Venice Golden Lion — ~1,490 entries).
3. **Games section** (`/games`) — four games built from your own rated library: **Rate-Off** (poster bracket tournament), **Higher or Lower** (streak-based score-guessing), **Reel Wordle** (daily guess-the-movie with Wordle-style clues), **Taste Quiz** (auto-generated trivia about your own viewing stats).

All 425 tests pass, lint is clean (0 errors, same 40 pre-existing warnings as before), and a real production build (`vue-cli-service build`) succeeds.

**Update**: you gave the go-ahead to boot the dev server, so I did — `yarn serve` is running (localhost:8081) and I clicked through all three features live using the `testing-database` dev-mode account (413 real movies). All three worked end to end (Rate-Off ran a full 16-bracket to a champion, Higher/Lower correctly tracked streaks and persisted a best streak to Firebase, Reel Wordle solved/lost/persisted correctly, the quiz generated real questions from the actual library, the awards sections showed correct data). **I also found and fixed one real bug this way**: MovieDetail's component instance gets reused (not remounted) when you click from one movie straight to another, and a stale-data guard meant the Academy Awards section kept showing the *previous* movie's wins/nominations instead of refetching for the new one. This bug predates tonight — it just happened to become obvious once the awards section had three visible parts to eyeball instead of one. Fixed and regression-tested (commit `1b0cfc8`). I did NOT get a chance to verify the mobile-width (narrow viewport) layout — the browser automation environment I had access to wouldn't resize the actual page viewport, only the OS window frame around it, so that's still worth a look on your phone.

## On the "Other Ceremonies" data — read this before trusting it blindly

I sourced it from Wikipedia's raw wikitext (not the rendered page, not an AI summary of the page — I actually hit an early accuracy problem with a fetch-and-summarize approach that quietly invented a wrong Best Picture winner, so I switched to parsing the real wikitext tables with a small script and spot-checked the output against what I know). It's solid but not perfect:

- ~1% of rows are noisy — a small number of BAFTA/Cannes rows have a director's name where a film title should be, from a handful of malformed table rows I couldn't cleanly parse. Harmless for matching (a person's name won't collide with a real movie title), but if you ever see something odd in the "Other Ceremonies" section, that's why.
- Berlin Film Festival (Golden Bear) was attempted and **dropped entirely** — its table had enough column-shift issues that I didn't trust the output. Not in the dataset at all.
- Matching a movie to this data is by normalized title + release year within ±1 (different ceremonies label "the film's year" slightly differently than TMDB's release date does). This is a heuristic, not a real ID lookup (Wikipedia doesn't carry TMDB ids) — a very rare remake/title-collision could theoretically mismatch, though I didn't hit one in testing.
- Scope is intentionally narrower than Oscars: Cannes and Venice are winners-only (their Wikipedia pages don't tabulate nominees the way the Globes/BAFTA do).

If you want more ceremonies or fuller nominee lists later, the parsing approach (raw wikitext, not rendered HTML) is documented in `CLAUDE.md` under "Personal Awards + Other Ceremonies on Movie Pages" — it's a reusable recipe, just needs someone to sit down and extend it carefully per-page.

## Streamlining / cleanliness things I noticed but didn't touch

Kept these out of scope tonight since they're unrelated to the three features you asked for and I wanted to keep the blast radius small on a night you're not around to catch a mistake. Flagging for later:

- **`MovieDetail.vue`'s `academyAwardWins` and `academyAwardNominations` computeds define the exact same 24-item `categoryOrder` array, verbatim, twice, right next to each other.** Easy one-line-constant extraction whenever someone's next in that file.
- **`Home.vue` is still huge** and `Insights.vue` (3,071 lines) + `LetterboxdScrapingService.js` (817 lines) are still at 0% test coverage — both already flagged in `CLAUDE.md` as known gaps, just re-confirming they're still the biggest coverage holes in the app.
- **`yarn build` doesn't run non-interactively** — `src/assets/javascript/version.js` prompts for a keypress to pick a semver bump, which throws (`process.stdin.setRawMode is not a function`) in a plain non-TTY shell. Fine for your normal terminal use, but if you ever want a scripted/CI deploy, that prompt needs a `--yes`/env-var bypass. I built with `npx vue-cli-service build` directly to route around it for my own verification.
- **Bundle size**: `chunk-vendors.js` is 796 KB (220 KB gzipped) and the Insights chunk is 404 KB — pre-existing, not something I made worse, but if load time ever becomes a complaint, that's where to look first (candidates: FullCalendar and Chart.js are fairly heavy and only used on a couple of screens).
- The existing Academy "Best Picture" quick-link data (fetched in `store/index.js`, Best-Picture-only, used for the "Best Picture" quick filter) and my new static "Other Ceremonies" dataset are two separate, unrelated data paths that happen to both be about awards. Nothing wrong with that today, but if you ever want a unified "Awards" browsing view across all ceremonies, that's the seam to reconcile.

## Games I designed but didn't build (also in `CLAUDE.md`)

Ran out of runway for these — noting them since they seemed genuinely fun and none are hard, just more UI than I had hours left for:

- **Movie Connections** — NYT Connections-style grouping puzzle: 16 movies from your library, find the 4 groups of 4 sharing a director/genre/decade/cast member. The hard part is guaranteeing a puzzle has exactly one valid grouping (avoiding accidental overlap between categories) — doable, just fiddly.
- **Six Degrees** — pick two random movies from your library, find the shortest cast/crew path between them (like Six Degrees of Kevin Bacon, but scoped to your own log). Needs a small graph-search module; straightforward once the graph is built.
- **Bracket filters** — let Rate-Off start from a scoped pool (one genre, one decade, one director, or an existing quick-link like "Annual Best") instead of always sampling the whole library.
- **Cross-device Reel Wordle** — right now the daily puzzle progress lives in `localStorage`, so it doesn't follow you between your phone and desktop. Firebase would fix that; I kept it local deliberately for tonight since it's genuinely disposable same-day state.

## Everything else — the broader "look for ways to improve this app" ask

Given the size of the three requested features, I spent the night's remaining time on those rather than a separate open-ended architecture audit. The items above are what surfaced naturally while I was in the relevant files. If you want a dedicated pass at "what else could be better" across the whole app (UX polish, more test coverage, the Home.vue/Insights.vue size issue, etc.), that's worth its own focused session — happy to dig in whenever.

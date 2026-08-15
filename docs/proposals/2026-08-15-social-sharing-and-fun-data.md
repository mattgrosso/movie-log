# Proposal: social, Brian-sharing, and where the fun data goes

Written overnight 2026-08-15 for morning discussion. Three open bug reports
feed this: "explore adding a social element," "a translation layer that will
allow me and my friend Brian to share our ratings," and "my friend Brian has
a method to compare two lists of movies." None of this is built — these are
options with recommendations.

## What tonight's account audit changes about the picture

- **There are ~27 real accounts**, not 3. Mostly tiny libraries (1–33
  movies), but five are substantive: Matt (1,372), Brian (2,305, dormant),
  Seth (327), Natalie (172), Carrie (140). A social feature has an actual
  audience already.
- **Brian's data is already in Cinema Roll.** Whatever produced those 2,305
  entries, a "translation layer" may be half-done — the comparison features
  below could run against his existing account data without any import
  work. Worth asking him what those entries are before designing an
  interchange format.
- **The locked-down rules (deployed tonight) deny all cross-account
  reads.** Every social feature now needs a deliberate sharing surface —
  which is a feature, not a bug: sharing becomes opt-in by construction.

## Social: three shapes, cheapest first

1. **Snapshot share links (mostly exists).** `sharedDBSearches` already has
   a public-read carve-out in the rules and a ShareDBResults screen. The
   social v1 could just be polish: "share my top 20," "share my year."
   Zero new infrastructure, no identity model, nothing live.

2. **Opt-in library compare (recommended).** A user taps "share my library
   with a friend" → writes a compact, read-only copy (title/tmdbId/rating/
   watchedAt — the interchange format below) to a public-read-by-key path
   `sharedLibraries/<shareKey>`, and sends the link. The recipient's app
   renders a compare screen: overlap, taste correlation on shared movies,
   biggest disagreements, "they loved it, you haven't seen it" lists. This
   IS Brian's list-comparison feature, generalized — one build serves both
   reports. No accounts-following-accounts model, no feeds, revocable by
   deleting the key.

3. **Real friends/feeds.** Mutual-follow model, per-friend rules, activity
   feeds. Big: needs an identity/consent model and either much smarter
   rules or a server. Not recommended until 2 proves people actually
   compare.

## The Brian interchange format (for whenever he answers)

A neutral JSON both apps can emit/ingest:

```json
{ "source": "cinema-roll", "exportedAt": "...", "ratings": [
  { "tmdbId": 550, "title": "Fight Club", "year": 1999,
    "rating10": 8.7, "watchedAt": "2024-06-15" }
] }
```

- `rating10` normalized 0–10; each app maps its own scale in/out.
- `tmdbId` is the join key; title+year is the fallback for entries TMDB
  can't match.
- Cinema Roll's exporter is trivial (the backup files from tonight are a
  superset). The importer is the real work (placeholder-style entries for
  unmatched movies?) — scope only after seeing Brian's format.
- **Ask Brian**: what his compare method actually computes, and what his
  app can export today.

## Compare-screen math (buildable blind, no Brian needed)

Given two rating lists joined on tmdbId: overlap counts, Pearson
correlation on shared movies ("taste compatibility 78%"), top-5 biggest
disagreements, each side's top-rated unseen-by-the-other. All pure,
testable, and reusable whether the second list arrives via share key,
interchange file, or Brian's existing account.

## Where the fun data goes (funFacts.js is built and tested, unwired)

Six facts are computed and proven: time-in-the-dark hours, home decade,
busiest month, genre of the house (watched-most vs rated-best), biggest
single day, deepest cut. Placement options:

1. **A "Fun facts" card row on the Watchlist screen** — cheap, visible, but
   dilutes that screen's purpose.
2. **A new section at the top of Insights** — the natural home, but
   Insights.vue is 3,000 untested lines; wiring in is fine, just wants
   daytime care.
3. **Year in Review enrichment** — seasonal, wouldn't be seen until
   December.

Recommendation: option 2, done as a self-contained child component so
Insights.vue only gains a tag.

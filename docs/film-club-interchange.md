# Film Club Interchange v1

A tiny contract that lets two different movie-logging apps share libraries,
so a friend on another app appears as an ordinary friend — same comparisons,
same recommendations — without either app knowing what the other is built on.

Written for Movie Log ↔ Cinema Roll, but nothing in it is specific to either.

---

## The idea

Each app **publishes** one JSON document describing a user's rated library,
at a URL only people they've shared it with can guess. Each app
**subscribes** by fetching a friend's URL and translating it.

No accounts, no OAuth, no shared database, no webhooks. If you can serve a
JSON file, you can join.

## Publishing

Serve a document at a stable, unguessable URL. Cinema Roll uses
`…/clubFeed/<accountKey>/<32-hex-secret>.json`, world-readable only at the
secret level so the URL itself is the capability. Anything equivalent is
fine.

```jsonc
{
  "format": "film-club/1",     // required, lets consumers version-check
  "source": "cinemaroll",      // free-form: which app produced this
  "name": "Matt Grosso",       // how this person should appear to friends
  "marker": 1786848790989,     // changes when the library changes
  "movieCount": 1372,
  "movies": [
    {
      "tmdbId": 568,           // required — TMDB id is the join key
      "title": "Apollo 13",
      "posterPath": "/tVeKscCm2fY1xDXZk8PgnZ87h9S.jpg",
      "year": 1995,
      "rating": 9.97,          // composite score, 0–10
      "criteria": {            // optional, all fields optional
        "love": 10, "overall": 9, "stickiness": 5, "story": 9,
        "direction": 9, "imagery": 8, "performance": 7, "soundtrack": 6
      },
      "viewings": [            // optional, newest first
        { "watchedAt": 1755302400000, "medium": "Theater" },
        { "watchedAt": 1580515200000 }
      ]
    }
  ]
}
```

Rules of the road:

- **`tmdbId` is the join key.** Titles and years are for display only.
- **`rating` is 0–10.** If your app uses stars, scale it; don't send stars.
- **`criteria` are named, not positional**, and every one is optional — send
  what you have. `stickiness` is the criterion Movie Log calls `impression`.
- **`watchedAt` is epoch milliseconds.** `medium` is free text ("Theater",
  "Bluray", "Netflix"); omit it rather than sending null.
- **`marker`** should change whenever the library does. A subscriber that
  has already seen a marker may stop reading. Any monotonic value works —
  Cinema Roll sends the publish time; Movie Log's existing global change
  marker would do fine.

## Subscribing

Fetch the URL, check `format`, translate into whatever your app renders.
Keep it defensive: skip movies without a usable `tmdbId` or `rating` rather
than failing the whole feed, and never let one unreachable friend break the
page.

## Consuming Movie Log without Movie Log doing anything

Cinema Roll's importer also reads **Movie Log's raw records as they already
exist**, so Brian doesn't have to implement the format above at all — if the
records are reachable, we adapt them:

```jsonc
{
  "movieId": "100402",
  "movie": {
    "title": "Captain America: The Winter Soldier",
    "year": 2014,
    "tmdb": { "id": 100402, "poster_path": "/l79…jpg" },
    "viewings": [
      { "date": "2019-08-17T07:00:00.000Z", "medium": "Bluray",
        "rating": 6.6965, "love": 2, "overall": 7, "impression": 1,
        "story": 8, "direction": 8, "imagery": 7, "performance": 6,
        "soundtrack": 7 }
    ]
  }
}
```

Mapping applied: `movieId`/`tmdb.id` → `tmdbId`, the most recent viewing's
`rating` → `rating`, `impression` → `stickiness`, `date` → `watchedAt`,
everything else by the same name. Either an array or an object map of these
records is accepted.

## The smallest possible ask

If you'd rather not write a publisher: expose your existing records at a
secret path your database rules make readable, and send that URL. That's it
— roughly five minutes of rules work, exposes nothing else, and Cinema Roll
handles the rest.

## Privacy notes

- The URL **is** the credential. Share it the way you'd share a private
  link, and rotate it by generating a new secret if it leaks.
- Publish only what you'd show a friend. Cinema Roll publishes the same
  tiers it shows in-app, and never publishes anything for a user who hasn't
  turned sharing on.
- Both directions are pull-only. Neither app can write to the other.

## Reference implementation

`src/assets/javascript/interchange.js` in Cinema Roll — publishing,
consuming, the Movie Log adapter, and format detection, all pure functions
with tests in `src/test/interchange.test.js` (including a golden fixture
captured from real Movie Log data).

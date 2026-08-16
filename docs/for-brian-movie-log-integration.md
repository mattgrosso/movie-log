# For Brian — connecting Movie Log and Cinema Roll

Hey Brian. Matt here (well, Matt's coding agent). Cinema Roll now has a
"Film Club" — friends, shared ratings, comparisons, recommendations from what
your friends love. We'd like Movie Log users to be able to join it, and Cinema
Roll users to be able to join Movie Log's circle, **without either of us
migrating anything or knowing what the other is built on**.

Cinema Roll's half is already built and deployed. Everything below is
implemented and live on our side, so you're implementing against something
real rather than a proposal.

**Everything you need to hand your coding agent is in the prompt at the bottom
of this document.** The sections above it are the human explanation.

---

## The shape of it

Three mechanisms, all dead simple, all pull-only. Neither app ever writes into
the other's database except to drop a request in a mailbox.

1. **A public directory.** Each app publishes a list of users who opted into
   cross-app discovery: handle, display name, and a request inbox URL.
   **Never a feed URL** — a feed URL is a capability, so it is exchanged only
   between two people who have agreed. This is what removes link-swapping:
   your users see mine in a list and vice versa.
2. **A connect inbox.** Each discoverable user has an inbox URL where another
   app can drop a "can I add you?" request. The recipient accepts inside their
   own app, in whatever UI they already have.
3. **A feed.** Once two people are connected, each reads the other's library
   from an unguessable URL exchanged during the handshake.

**No copying and pasting anything.** A user browses, taps Add, the other
person accepts in their own app, and both sides start pulling.

## Good news about our data

Our two apps are clearly descended from the same code. Your `viewings` and our
`ratings` carry the **same eight criteria**. The only naming difference we
found:

| Movie Log      | Cinema Roll   |
| -------------- | ------------- |
| `impression`   | `stickiness`  |

Everything else — `love`, `overall`, `story`, `direction`, `imagery`,
`performance`, `soundtrack`, plus `medium` for where a viewing happened — is
identical in name and meaning. Composite scores are 0–10 on both sides. That
means comparisons between our users are genuinely faithful, not approximate.

**You may not need to write a translator at all.** Our importer already reads
Movie Log's raw records (`{ movieId, movie: { title, year, tmdb: { id,
poster_path }, viewings: [...] } }`) exactly as your client caches them. If you
expose those as-is, we handle it.

---

## THE PROMPT

Everything below this line is written for your coding agent. Copy from here
down.

---

You are implementing cross-app social interoperability between Movie Log (the
app in this repository) and Cinema Roll, another movie-logging app. The goal:
a Movie Log user can be friends with a Cinema Roll user, seeing their ratings
and activity, without either app sharing a database or an account system.

Cinema Roll's half is already implemented and live. You are implementing Movie
Log's half against a fixed, working contract. Do not redesign the contract.

### Context about Movie Log you should verify against the codebase

- Firebase Realtime Database, project `movie-log-ae673`.
- A user's movie records look like:
  `{ movieId: "100402", movie: { title, year, ownership: [], tags: [],
     tmdb: { id, poster_path, ... },
     viewings: [{ date: ISO8601, medium: "Theater", rating: 6.6965,
                  starRating: 4.5, love, overall, impression, story,
                  direction, imagery, performance, soundtrack, tags: [] }] } }`
- `impression` is the criterion Cinema Roll calls `stickiness`. This is the
  only field whose name differs between the apps.
- `rating` is the 0–10 composite. `starRating` is a 0–5 display value —
  do not send `starRating` as `rating`.
- Users have @handles and a Friends list under a "Social / Your movie circle"
  area, and there is a global change marker (seen as `movieLogLastModified`
  / `appState.marker`) that changes when a library changes.

### Deliverable 1 — publish a public directory

Publish everyone who opts into cross-app discovery at a publicly readable
path. Cinema Roll uses `clubDirectory/<userKey>`, world-readable, each row
writable only by its owner:

```jsonc
{
  "bgoegan": {
    "handle": "bgoegan",
    "name": "Brian Goegan",
    "app": "movielog",
    "avatarUrl": "https://…/avatar.png",          // optional, https only
    "inboxUrl": "https://…/clubInbox/<key>/<code>.json"
  }
}
```

Rules:
- **Never put a feed URL in the directory.** Feeds are capabilities.
- Publish a row only for users who explicitly opted in — this is public.
- An array works as well as an object map; we normalise either.

Cinema Roll's directory is at
`https://movie-log-8c4d5-default-rtdb.firebaseio.com/clubDirectory.json`.
Fetch it to show Cinema Roll users inside Movie Log.

### Deliverable 2 — publish a feed

For each user who opts in, publish a JSON document at a stable, unguessable
URL. Recommended path: `clubFeed/<userKey>/<32-hex-secret>`, with database
rules making it readable **only at the secret level** (the parent must not be
readable, so the secret cannot be discovered by listing) and writable only by
its owner. Cinema Roll's rules for the equivalent node look like:

```jsonc
"clubFeed": {
  "$userKey": {
    ".read": false,
    ".write": "auth != null && $userKey === <sanitized auth email>",
    "$secret": { ".read": true }
  }
}
```

The document:

```jsonc
{
  "format": "film-club/1",   // required, exactly this string
  "source": "movielog",      // your app's name
  "name": "Brian Goegan",    // display name for the friend
  "marker": 1784890500460,   // changes whenever the library changes
  "movieCount": 103,
  "movies": [
    {
      "tmdbId": 100402,                    // REQUIRED. The join key. Number.
      "title": "Captain America: The Winter Soldier",
      "posterPath": "/l79VoTIPEXwo9zCTPTnpqdASvus.jpg",
      "year": 2014,
      "rating": 6.6965,                    // REQUIRED. 0–10 composite.
      "criteria": {                        // optional; any subset
        "love": 2, "overall": 7, "stickiness": 1, "story": 8,
        "direction": 8, "imagery": 7, "performance": 6, "soundtrack": 7
      },
      "viewings": [                        // optional; newest first
        { "watchedAt": 1566025200000, "medium": "Bluray" },
        { "watchedAt": 1398409200000, "medium": "Theater" }
      ]
    }
  ]
}
```

Rules for producing it:
- Use the **most recent** viewing for `rating` and `criteria`.
- Map `impression` → `stickiness`. Omit criteria you don't have rather than
  sending nulls.
- `watchedAt` is epoch **milliseconds** (your `date` is ISO 8601 — convert).
- Omit `medium` entirely when absent; don't send `null`.
- Skip records with no `tmdbId` or no usable composite rating rather than
  emitting partial rows.
- Set `marker` from your existing global change marker.

Alternatively — and this is genuinely fine — **expose your raw records** at a
secret path instead. Cinema Roll's importer detects and adapts them. If you do
that, you can skip the transformation entirely; the rest of this still applies.

### Deliverable 3 — a connect inbox

Create a path where someone on another app can drop a request. Cinema Roll's
equivalent, which you can copy:

```jsonc
"clubInbox": {
  "$userKey": {
    ".read": "<owner only>",
    "$inviteCode": {
      "$requestId": {
        // Create-only for strangers: a request can be added, but nothing
        // already in the inbox can be modified or deleted by an outsider.
        ".write": "!data.exists() || <owner>",
        ".validate": "newData.hasChildren(['name','app','feedUrl']) && newData.child('feedUrl').isString() && newData.child('feedUrl').val().length < 500 && newData.child('name').isString() && newData.child('name').val().length < 120"
      }
    }
  }
}
```

The `$inviteCode` in the path is a per-user random string. It means only
someone the user gave a link to can address them, and the user can rotate it
to cut off a leaked link.

A request posted into that path looks like:

```jsonc
{
  "name": "Matt Grosso",
  "app": "cinemaroll",
  "feedUrl": "https://…/clubFeed/<their-key>/<their-secret>.json",
  "replyInboxUrl": "https://…/clubInbox/<their-key>/<their-code>.json",
  "at": 1786848790989
}
```

Anyone with the invite link can write here, so **treat every field as
untrusted**: require `https://` URLs, cap lengths, ignore anything older than
~60 days, and never render raw HTML from `name`.

### Deliverable 4 — the two user-facing flows

**Accepting an incoming request.** Show pending inbox requests in your
existing Friends/People UI ("Matt Grosso on cinemaroll wants to connect —
Accept / Dismiss"). On accept:
1. Store their `feedUrl` as a friend in your system, flagged as external.
2. If they included `replyInboxUrl`, POST your own request object to it, so
   they get you as a friend without a second exchange.
3. Delete the request from your inbox.

**Sending a request.** Show Cinema Roll's directory inside your existing
"Find people" UI — ideally merged with your own results so a user doesn't have
to think about which app someone is on. Tapping Add POSTs a request to that
person's `inboxUrl` containing your own `feedUrl` and `replyInboxUrl`. Hide
people the user has already added or already asked.

Note that Firebase RTDB accepts `POST` to a `.json` path and auto-generates a
child key, which makes the inbox a single HTTP call with no SDK.

### Deliverable 5 — consuming a feed

Fetch a friend's `feedUrl`, check `format` starts with `film-club/`, and map
it into whatever your friends UI renders. `tmdbId` is the join key for
matching against your own library — not title, not year. Map `stickiness` →
`impression` on the way in.

Be defensive: skip movies missing `tmdbId` or `rating` rather than failing the
whole feed, and make sure one unreachable friend can't break the page. Poll on
a sensible interval and skip parsing when `marker` is unchanged from last time.

### Acceptance criteria

1. A user who opts into discovery appears in your public directory with a
   handle, name and inbox URL — and **no feed URL**.
2. Fetching a user's `feedUrl` unauthenticated returns a valid `film-club/1`
   document; fetching its parent path is denied.
3. Posting a well-formed request to that `inboxUrl` unauthenticated succeeds;
   modifying or deleting an existing request unauthenticated fails.
4. A malformed request (missing `feedUrl`, over-long `name`) is rejected by
   the database rules, not just the UI.
5. Accepting a request adds the sender as a friend and, when `replyInboxUrl`
   is present, causes the sender to receive a reciprocal request.
6. A friend added this way appears in the normal friends UI and their ratings
   render like any other friend's.
7. A Movie Log user can browse Cinema Roll users from within Movie Log and
   add one without copying any link.
8. Round trip: a movie rated 6.6965 with `impression: 1` on Movie Log arrives
   in Cinema Roll as `rating: 6.6965` with `stickiness: 1`, and vice versa.

### Reference implementation

Cinema Roll's half is all pure functions with tests, and is the normative
reference if anything here is ambiguous:
`src/assets/javascript/interchange.js` and `src/test/interchange.test.js`,
plus the full spec at `docs/film-club-interchange.md`. Ask Matt for a copy of
those files if useful — they include a golden fixture captured from real Movie
Log data, so the adapter is known to work against your actual shape.

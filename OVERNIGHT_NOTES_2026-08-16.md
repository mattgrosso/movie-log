# Overnight notes — night of 2026-08-15 → 16

You went to bed asking for a long project. I built **Custom Lists** (board item
T3 #5, the approved-but-held Brian-survey feature B1) end to end, then wired it
into the places it earns its keep. Everything below is shipped, live, and
QA'd in a real browser on the tester account.

**Versions: v1.58.0 → v1.58.3.** Full suite green at every commit (1,763 tests),
lint clean, one commit per logical chunk so any piece can be reverted alone.

---

## What Custom Lists is

Standing, hand-curated collections of movies from your own library — "Comfort
Watches", "Show the Kids", "Best Endings". Deliberately *not* the same thing as
viewing tags: a tag describes one **viewing** (where, with whom), a list is a
selection of **movies**.

### Where it lives
- **`/lists`** — index. Name a new list; each card shows a poster strip and
  "N films · X average · earliest–latest".
- **`/lists/:listId`** — the list. Rename in place, five sort modes (My order,
  Recently added, Highest rated, Newest release, A–Z), a typeahead that searches
  your library (and hides movies already in the list), up/down ordering, remove,
  and a two-tap delete.
- **MovieDetail** — a "Lists" row of membership chips; tap to add or remove.
- **Home quick links** (the lightning bolt) — a Lists section beside Tags.
  Tapping one drops a filter chip, so a list is browsable with all of Home's
  existing sorting/grouping/count-cycle machinery.
- **Insights → Overview** — a "Your Lists" card in the directory.
- **Film Club** — friends see your lists (name, size, up to six posters).

### Design decisions worth knowing
- **Items are an object map keyed by TMDB id**, not an array. Every add/remove is
  then a single leaf write (`settings/customLists/<id>/items/<tmdbId>`) with no
  read-modify-write, so two devices editing the same list can't clobber each
  other, and Firebase can't renumber anything underneath us.
- **Movies that leave your library are dropped from a list's display and
  counted** — the list tells you "1 movie is no longer in your library" instead
  of quietly getting shorter.
- **Reorder writes only the positions that actually change**, not the whole list.
- **Manual reorder is up/down buttons, not drag** — drag fights page scrolling on
  a touch-first PWA.
- **The Home filter chip carries its own membership snapshot**, which keeps
  `applyFilter` a pure function of `(result, filter)` with no store reach-in.
  Consequence: re-tap a list to pick up movies added since you applied the chip.
- **Shared lists never include per-movie scores** — name, count, posters only.
  Empty lists and lists whose movies are all gone aren't published at all.

---

## One bug I shipped and fixed (worth reading)

**v1.58.0 made every movie page render blank.** The MovieDetail chips referenced
`inList`/`toggleList` in the template, but the scripted edit that was supposed to
add those methods silently matched nothing — Python's `str.replace` no-ops rather
than erroring. **Lint and the production build both pass on a template calling a
method that doesn't exist**; the page just renders nothing.

Fixed in **v1.58.1**, and now guarded by mount tests that fail with the exact
production signature (`_ctx.inList is not a function`) when the methods are
removed. If you loaded the app in the window between those deploys and saw blank
movie pages, that was this, and it's gone.

Lesson I've adopted for the rest of the night: verify every scripted edit landed
(grep for the marker) rather than trusting the script's own "done" message.

---

## Verified live, not just in tests

On the tester account, through the real UI: created a list, added movies via the
typeahead, watched the stats update, reordered and confirmed the new order
persisted to Firebase, cycled all five sort modes, confirmed the MovieDetail chip
shows membership, filtered Home down to exactly the list's 2 movies, and read the
published social profile back out of the database to confirm the shared shape.

There's a "Comfort Watches" list on the **tester** account (Apollo 13, The
Godfather Part III) left in place as a live example. Your own account is
untouched — you'll start with no lists.

---

## Deliberately not done

- **No bulk "add these search results to a list"** — I wanted your read on the
  basic flow first; it's an easy addition if you want it.
- **No list notes in the UI.** The store action and data field exist
  (`setCustomListNote`, 280 chars) but nothing renders it yet.
- **No reordering of the lists themselves** on `/lists` — they sort by most
  recently touched, which felt right without asking.
- **Didn't touch the delta-sync phase-2 decision** (board T4 #7) — that wants
  your judgment and the shadow reports aren't due until ~Aug 18.
- **Didn't start the Node 20 chore** (board T4 #8) — it's a dependency-bumping
  job with real breakage potential, and I'd rather do that with you awake.

## Known thing that isn't mine

The tester account logs `[delta-shadow] delta reconstruction diverged` on every
load. I believe that's because the tester's data was seeded by the admin SDK
without `updatedAt` stamps, not a real sync bug — but confirm that before it
muddies the phase-2 go/no-go.

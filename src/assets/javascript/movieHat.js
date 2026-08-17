// Talking to Movie Hat from Cinema Roll.
//
// Movie Hat is a separate app with its own Firebase project, and it stays
// that way — Matt, 2026-08-16: "I love that it's a standalone app that I can
// let anybody who wants to use use... I don't wanna just bring it straight
// into cinema roll." What he does want is for the two to meet: send a movie
// (or a whole watchlist section) to a hat, and draw from a hat without
// leaving Cinema Roll.
//
// EVERY read and write to Movie Hat goes through this file. That is the
// point: the hats database is currently world-readable and world-writable
// over plain REST, and locking it down is coming. When it does, only this
// module changes.
//
// Movie Hat's own shape, which this deliberately conforms to rather than
// improves on:
//
//   hats/<hat title>/<dbKey>/
//     movies/<key>   → a raw TMDB movie + timeStamp, addedBy, note
//     history/<key>  → the same movie + dateDrawn
//     members/<key>  → an email address
//
// A draw is: pick uniformly at random, copy to history, delete from movies.
// It is destructive on purpose — that is what makes it a hat and not a
// shuffle button — so anything here that draws must do all three.

import { movieHatToken, emailToMemberKey } from './movieHatAuth.js';

export const HAT_DATABASE_URL = 'https://movie-hat-9c418-default-rtdb.firebaseio.com';

/** Firebase object-maps → arrays, carrying each child's key. Arrays pass through. */
export function asArray (map) {
  if (Array.isArray(map)) return map.filter(Boolean);
  if (!map || typeof map !== 'object') return [];
  return Object.keys(map).map((key) => ({ ...map[key], dbKey: key }));
}

/**
 * Every hat the given email is a member of, newest-looking first is not
 * meaningful here so they come back alphabetically.
 *
 * Reads the whole `hats` node, so this is for the one-off "find my hats"
 * setup step, never for day-to-day use.
 */
export function hatsForMember (allHats, email) {
  if (!allHats || !email) return [];
  const wanted = String(email).toLowerCase();

  return Object.entries(allHats)
    .flatMap(([title, byKey]) => Object.entries(byKey || {}).map(([dbKey, hat]) => ({ title, dbKey, hat })))
    .filter(({ hat }) => Object.values(hat?.members || {})
      .some((member) => String(member).toLowerCase() === wanted))
    .map(({ title, dbKey, hat }) => ({
      title,
      dbKey,
      movies: Object.keys(hat?.movies || {}).length,
      drawn: Object.keys(hat?.history || {}).length
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Movie Hat dedupes on the TMDB id, so this does too — Matt, 2026-08-16:
 * "if you try to add something to a hat, it should just notify you back that
 * it's already in there."
 */
export function alreadyInHat (hatMovies, tmdbId) {
  if (tmdbId == null) return false;
  return asArray(hatMovies).some((movie) => movie && String(movie.id) === String(tmdbId));
}

/**
 * A Cinema Roll library entry (or a raw TMDB result) → the payload Movie Hat
 * stores. It renders `title`, `poster_path`, `addedBy` and `note`, so those
 * have to be right; the rest rides along the way its own search results do.
 */
export function toHatMovie (source, { addedBy = null, note = null, now = Date.now() } = {}) {
  const movie = source?.movie || source;
  if (!movie || movie.id == null) return null;

  const payload = {
    id: movie.id,
    title: movie.title || '',
    poster_path: movie.poster_path || null,
    backdrop_path: movie.backdrop_path || null,
    release_date: movie.release_date || '',
    overview: movie.overview || '',
    vote_average: Number.isFinite(movie.vote_average) ? movie.vote_average : null,
    timeStamp: now,
    // Movie Hat shows this on the drawn-movie screen and in the share sheet.
    addedBy: addedBy || 'Cinema Roll'
  };

  if (note) payload.note = note;
  return payload;
}

/**
 * The draw itself. `random` is injected so a test can pin it — Movie Hat
 * uses lodash `sample`, which is this.
 */
export function pickFromHat (movies, random = Math.random) {
  const list = asArray(movies);
  if (!list.length) return null;
  return list[Math.floor(random() * list.length)];
}

/** What gets written to history when a movie is drawn. */
export function drawnRecord (movie, now = Date.now()) {
  if (!movie) return null;
  const record = { ...movie, dateDrawn: now };
  // dbKey is Movie Hat's own storage key for the movies node, not part of
  // the record — it writes the history entry without it.
  delete record.dbKey;
  return record;
}

// ---------------------------------------------------------------------------
// Network. Thin on purpose: the shapes above are where the thinking lives.
// ---------------------------------------------------------------------------

async function hatRequest (path, options = {}) {
  // Movie Hat is a different Firebase project, so this is ITS token, from
  // the second sign-in — a Cinema Roll token means nothing there. Null while
  // the rules are still open, which is why everything below keeps working
  // before anyone connects.
  const token = await movieHatToken();
  const separator = path.includes('?') ? '&' : '?';
  const url = token
    ? `${HAT_DATABASE_URL}/${path}${separator}auth=${encodeURIComponent(token)}`
    : `${HAT_DATABASE_URL}/${path}`;

  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`Movie Hat responded ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * The hats this address belongs to, from Movie Hat's own index.
 *
 * Was: download every hat in the database and filter client-side. That is
 * exactly what the lockdown makes impossible — you can't read hats you
 * aren't a member of — so it reads `userHats/<memberKey>` instead, which is
 * readable only by you.
 */
export async function fetchMyHats (email) {
  const memberKey = emailToMemberKey(email);
  if (!memberKey) return [];

  const mine = await hatRequest(`userHats/${memberKey}.json`);
  if (!mine) return [];

  // Deduped by hatKey: Movie Hat re-keys these entries from a safe form of
  // the TITLE to the hat's own key (2026-08-17), and a hat mid-re-key can
  // appear under both for one read. Reading entries by VALUE like this is
  // what makes that migration invisible here — don't start reading the key.
  const byKey = new Map();
  Object.values(mine)
    .filter((entry) => entry?.title)
    .forEach((entry) => {
      const key = entry.hatKey || `title:${entry.title}`;
      if (!byKey.has(key)) byKey.set(key, { title: entry.title, dbKey: entry.hatKey || null });
    });

  return [...byKey.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/** Every hat in the app. Only usable while the database is still open. */
export function fetchAllHats () {
  return hatRequest('hats.json');
}

/**
 * A hat's storage key. Movie Hat addresses hats by TITLE, with a generated
 * key underneath, and takes the first key it finds — mirrored here.
 */
export async function fetchHatKey (title) {
  // The title level is unreadable under the deployed rules — access is
  // granted per hat — so this is a legacy path that now answers "no idea"
  // instead of throwing. fetchMyHats supplies the key in normal use.
  try {
    const data = await hatRequest(`hats/${encodeURIComponent(title)}.json?shallow=true`);
    return data ? Object.keys(data)[0] : null;
  } catch {
    return null;
  }
}

export async function fetchHat (title, dbKey = null) {
  const key = dbKey || await fetchHatKey(title);
  if (!key) return null;

  const data = await hatRequest(`hats/${encodeURIComponent(title)}/${key}.json`);
  if (!data) return null;

  return {
    title,
    dbKey: key,
    movies: asArray(data.movies),
    history: asArray(data.history),
    members: Object.values(data.members || {})
  };
}

export function addMovieToHat (title, dbKey, payload) {
  return hatRequest(`hats/${encodeURIComponent(title)}/${dbKey}/movies.json`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Complete a draw: the movie lands in history and leaves the hat in ONE
 * write, so no failure can strand it in both places (or, worse, neither).
 *
 * This used to be a POST followed by a DELETE, ordered so that a failure
 * between them was at least recoverable. Movie Hat moved its own draw to a
 * multi-path PATCH on 2026-08-17; this matches it exactly, down to the
 * `drawn-<timestamp>` history key, so a draw looks the same whichever app
 * performed it.
 */
export async function commitDraw (title, dbKey, movie, now = Date.now()) {
  const record = drawnRecord(movie, now);
  const updates = { [`history/drawn-${record.dateDrawn}`]: record };

  if (movie.dbKey) {
    updates[`movies/${movie.dbKey}`] = null;
  }

  await hatRequest(`hats/${encodeURIComponent(title)}/${dbKey}.json`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });

  return movie;
}

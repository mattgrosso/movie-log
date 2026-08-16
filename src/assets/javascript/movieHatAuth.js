// Signing Cinema Roll into Movie Hat.
//
// Movie Hat is a different Firebase project, so a Cinema Roll ID token means
// nothing to it. Once Movie Hat's database rules require a signed-in member —
// which is the whole point of locking it down — Cinema Roll has to hold its
// own session there or every hat request is refused.
//
// So: a SECOND, named Firebase app pointing at Movie Hat's project, with its
// own Google sign-in. Matt, 2026-08-16, asked for exactly this ("second sign
// in in settings is fine"). One popup, once, and after that the session
// persists like any other.
//
// A named app keeps the two completely independent: signing into Movie Hat
// cannot disturb the Cinema Roll session, and signing out of Cinema Roll
// cannot disturb this one.
//
// The config below is Movie Hat's public web config, already shipped inside
// its own bundle — there is nothing secret in it.
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

const APP_NAME = 'movieHat';

const MOVIE_HAT_CONFIG = {
  apiKey: 'AIzaSyDlfyRC1BgoQ6UCPKsX-dvFC9HumeEwGjg',
  authDomain: 'movie-hat-9c418.firebaseapp.com',
  databaseURL: 'https://movie-hat-9c418-default-rtdb.firebaseio.com',
  projectId: 'movie-hat-9c418',
  storageBucket: 'movie-hat-9c418.appspot.com',
  messagingSenderId: '1061874698443',
  appId: '1:1061874698443:web:b2326dbc709a9237c2b34e'
};

/** Created on first use, never at import: nobody who ignores hats should pay for it. */
function movieHatApp () {
  const existing = getApps().find((app) => app.name === APP_NAME);
  return existing || initializeApp(MOVIE_HAT_CONFIG, APP_NAME);
}

export function movieHatAuth () {
  return getAuth(movieHatApp());
}

/** The signed-in Movie Hat account, or null. */
export function movieHatUser () {
  try {
    return movieHatAuth().currentUser;
  } catch {
    return null;
  }
}

/**
 * The ID token for Movie Hat requests, or null when not connected.
 *
 * Asked for per request rather than held, because getIdToken refreshes
 * itself as the hour-long token nears expiry.
 */
export async function movieHatToken () {
  try {
    const user = movieHatUser();
    return user ? await user.getIdToken() : null;
  } catch (error) {
    console.warn('Could not get a Movie Hat token', error);
    return null;
  }
}

/** Calls back with the Movie Hat user (or null) whenever it changes. */
export function watchMovieHatAuth (callback) {
  try {
    return onAuthStateChanged(movieHatAuth(), callback);
  } catch {
    callback(null);
    return () => {};
  }
}

/**
 * The one popup. Sign in with the same Google account that owns your hats —
 * the address is what Movie Hat's membership is keyed by.
 */
export async function connectMovieHat () {
  const provider = new GoogleAuthProvider();
  // Always offer the chooser: the Google account that owns your hats may not
  // be the one you're signed into Cinema Roll with.
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(movieHatAuth(), provider);
  return result?.user || null;
}

export function disconnectMovieHat () {
  return signOut(movieHatAuth());
}

/**
 * An email address as Movie Hat keys it.
 *
 * MIRRORS src/store/memberKey.mjs in the movie-hat repo, which is the source
 * of truth and also generates the database rules from the same list. If that
 * changes, this has to change with it.
 */
const UNSAFE_KEY_CHARACTERS = ['.', '$', '#', '[', ']', '/'];

export function emailToMemberKey (email) {
  if (typeof email !== 'string' || !email) return null;

  return UNSAFE_KEY_CHARACTERS.reduce(
    (key, character) => key.split(character).join('-'),
    email.trim().toLowerCase()
  );
}

import axios from 'axios';
import { createStore } from "vuex"
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, serverTimestamp, query, orderByChild, startAt, get } from "firebase/database";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import * as Sentry from "@sentry/vue";
import { getRating } from "../assets/javascript/GetRating";
import router from '@/router';
import ErrorLogService from "../services/ErrorLogService.js";
import { saveSnapshot, loadSnapshot } from "../utils/offlineStore.js";
import { maxUpdatedAt, reconstructFromDelta, diffLibraries, describeStaleEntry } from "../assets/javascript/deltaSync.js";
import { enqueueWrite, listPendingWrites, removePendingWrite, updatePendingWrite } from "../utils/pendingWriteQueue.js";
import { setValueAtPath } from "../utils/statePath.js";
import { stampPlanForWrite, stampUpdatesForBatch } from "../assets/javascript/syncStamp.js";
import { emailToDatabaseKey } from "../assets/javascript/databaseKey.js";
import { buildSocialProfile, socialSettingsWithDefaults, countNewFriendUpdates } from "../assets/javascript/social.js";
import { buildMirrorFeed } from "../assets/javascript/mirrorFeed.js";
import { pendingUpdates, reconcilePending } from "../assets/javascript/recommendationStats.js";

const sortByVoteCount = (a, b) => {
  if (a.vote_count < b.vote_count) {
    return 1;
  }
  if (a.vote_count > b.vote_count) {
    return -1;
  }

  return 0;
}

const mostRecentRating = (media) => {
  return getRating(media);
}

const sortByRating = (a, b) => {
  const sortValueA = mostRecentRating(a).calculatedTotal;
  const sortValueB = mostRecentRating(b).calculatedTotal;

  if (sortValueA < sortValueB) {
    return 1;
  }

  if (sortValueA > sortValueB) {
    return -1;
  }

  return 0;
}

const removeNaNAndUndefined = (obj) => {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        removeNaNAndUndefined(obj[key]);
      } else if (Number.isNaN(obj[key]) || obj[key] === undefined) {
        Sentry.captureMessage(`NaN or undefined value found in ${key}. The Object was ${JSON.stringify(obj)}`);
        delete obj[key];
      }
    }
  }
  return obj;
};

// Firebase RTDB's set() has no built-in timeout - while genuinely offline it
// resolves optimistically against the local cache (fine), but under a
// degraded/flaky connection (navigator.onLine still true, but the socket
// can't actually reach the server) it can stay pending INDEFINITELY, never
// resolving OR rejecting. Left unbounded, that hung promise would (a) block
// flushPendingWrites' one write forever and, worse, (b) keep
// isFlushingPendingWrites stuck true for the rest of the session, silently
// disabling every future flush attempt (a real data-loss bug - see the Jul
// 2026 bug report in CLAUDE.md's Offline Movie Rating section). Racing every
// write against a bounded timeout guarantees performDatabaseWrite always
// settles, so a stuck write becomes a recorded failure (retried on the next
// trigger) instead of a silent permanent stall.
const DATABASE_WRITE_TIMEOUT_MS = 15000;

const withTimeout = (promise, ms, errorMessage) => {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// Shared write core behind both setDBValue (debounced, direct UI saves) and
// flushPendingWrites (queued offline/retry saves, which deliberately bypass
// that debounce - a queued entry is already a single, deliberately-deduped
// write, see pendingWriteQueue.js's enqueueWrite).
//
// Every write to a movieLog entry also records WHEN, and every deletion of one
// leaves a tombstone, so a future sync can ask for only what changed. The
// timestamp is assigned by Firebase's server, not this device's clock, so a
// device with a wrong clock can't hide a movie from itself. See syncStamp.js.
const performDatabaseWrite = async (context, dbEntry) => {
  try {
    const plan = stampPlanForWrite(dbEntry, serverTimestamp());
    const root = context.getters.databaseTopKey;

    const write = plan.kind === 'update'
      ? update(ref(db, root), removeNaNAndUndefined({ ...plan.updates }))
      : set(ref(db, `${root}/${plan.path}`), removeNaNAndUndefined(plan.value));

    await withTimeout(
      write,
      DATABASE_WRITE_TIMEOUT_MS,
      `Database write timed out after ${DATABASE_WRITE_TIMEOUT_MS}ms: ${dbEntry.path}`
    );
  } catch (error) {
    console.error('Error setting database value:', error);
    ErrorLogService.error('Error setting database value:', dbEntry.path, error);
    throw error;
  }
};

// Re-tops a freshly-arrived server snapshot with any local writes that are
// still in flight (committed locally, not yet server-confirmed), so a
// snapshot that legitimately predates one of them can't momentarily revert
// it in the UI. `rootKey` is which top-level branch this snapshot is
// ('settings' or 'movieLog'); only in-flight paths under that branch apply.
// See the trackInFlightWrite mutation for the bug this fixes.
const reapplyInFlightWrites = (state, rootKey, data) => {
  const paths = Object.keys(state.inFlightWrites || {});
  if (!paths.length) return data;

  let result = data;
  paths.forEach((path) => {
    const segments = path.split('/').filter(Boolean);
    if (segments[0] !== rootKey || segments.length < 2) return;
    result = setValueAtPath(result, segments.slice(1), state.inFlightWrites[path]);
  });
  return result;
};

// Firebase
const firebaseConfig = {
  apiKey: process.env.VUE_APP_GOOGLE_API_KEY,
  authDomain: "movie-log-8c4d5.firebaseapp.com",
  databaseURL: "https://movie-log-8c4d5-default-rtdb.firebaseio.com",
  projectId: "movie-log-8c4d5",
  storageBucket: "movie-log-8c4d5.appspot.com",
  messagingSenderId: "84563192115",
  appId: "1:84563192115:web:121c681b37d284dcc93646",
  measurementId: "G-4K1Y42HFSL"
};

initializeApp(firebaseConfig);

// getAuth() MUST be called before getDatabase(), and at module load rather than
// lazily inside an action. The Realtime Database SDK picks up its auth-token
// provider from whatever is already registered on the app when it initialises;
// if Auth has never been instantiated it simply sends unauthenticated requests.
// That is invisible today (the database rules are open) but becomes a hard
// failure the moment those rules require `auth != null`.
const auth = getAuth();

const db = getDatabase();

// Firebase restores a persisted session asynchronously after page load. The
// router guard, meanwhile, decides you're logged in synchronously from
// localStorage — so without this, database listeners can be attached before the
// auth token exists. Anything that reads user data waits on this promise.
//
// Resolves with the restored user, or null if there is no live session.
let resolveAuthReady;
export const authReady = new Promise((resolve) => {
  resolveAuthReady = resolve;
});

onAuthStateChanged(auth, (user) => {
  // Only the FIRST callback settles the promise; later ones (sign-in, sign-out)
  // are ordinary state changes, and a promise can't be re-resolved anyway.
  resolveAuthReady(user);
});

export default createStore({
  state: {
    movieLog: {},
    settings: {},
    weights: [ // These values should all add up to 10 except that "stickiness" gets divided by 2 first
      { name: "love", weight: 2.8 },
      { name: "overall", weight: 2 },
      { name: "story", weight: 1.25 },
      { name: "direction", weight: 1.1 },
      { name: "imagery", weight: 0.9 },
      { name: "stickiness", weight: 1.9 },
      { name: "performance", weight: 0.7 },
      { name: "soundtrack", weight: 0.3 },
    ],
    academyAwardWinners: {},
    // The FULL raw Academy Awards dataset (every category, every year, wins
    // AND nominations — ~11k records from the same self-built film-awards-api
    // service `academyAwardWinners` above already uses, just the bare
    // `/awards` endpoint with no `category` filter, "let's just go ahead and
    // pull it down and store it locally so we can use it wherever we want").
    // Separate from `academyAwardWinners` (Best-Picture-only, TMDB-enriched
    // for the existing Home.vue "Best Picture" quick-link feature) rather
    // than replacing it — this is the raw, unenriched, ALL-category dataset
    // other features (e.g. the Connections game's awards category) can
    // synchronously filter/match against without a per-movie network call.
    allAcademyAwards: [],
    userEmail: null,
    databaseTopKey: null,
    newEntrySearchResults: [],
    movieToRate: {},
    DBSearchValue: null,
    DBSortValue: null,
    DBSortOrder: null,
    showHeader: true,
    // The "Cinema Roll" title overlay on the header banner - separate from
    // showHeader (which hides the whole header) since a game with its own
    // custom banner graphic may want the banner visible but its own
    // branding baked into the image instead of the usual overlay.
    hideHeaderLogo: false,
    goHome: false,
    // A small summary of Home.vue's LIVE filter/result state, published by
    // Home itself so in-app bug reports can actually show what was on
    // screen (see bugReports.js). Purely diagnostic - nothing reads it for
    // behaviour, and it is never persisted.
    homePageLiveState: null,
    devModeTopKey: 'testing-database',
    // devModeTopKey: 'natalierosegrosso-gmail-com',
    // devModeTopKey: 'carrieseltzer-gmail-com',
    // devModeTopKey: 'hopper-seth-gmail-com',
    // devModeTopKey: 'brianpatrick1-gmail-com',
    // Read once at store creation, then kept in reactive state — see the
    // `devMode` getter below for why it can't just re-read localStorage.
    devMode: localStorage.getItem('devMode') === 'true',
    dbLoaded: false,
    // True when the live movieLog/settings listener was CANCELLED by the
    // server (permission denied under the locked-down rules — wrong account,
    // dead session, or dev-mode pointing at a database this account can't
    // read). Drives LibraryAccessBanner's "your movies aren't gone"
    // guidance; cleared the moment a listener successfully delivers data.
    dbReadDenied: false,
    // Which account key the live movieLog/settings listeners are attached
    // for — the explicit "attach exactly once" guard. This replaced a
    // does-state-have-data check that a game screen's play-counter write
    // could fool by landing in settings before initializeDB ran (bug: the
    // Insights awards pane vanished because the settings listener never
    // attached and personalAwards never loaded).
    dbListenersAttachedFor: null,
    // True once REAL settings have arrived (snapshot or live) — not just
    // local write scraps. Gates the game recorders' read-modify-writes.
    settingsLoaded: false,
    // Latest delta-sync shadow-mode comparison (phase 1) — see
    // runDeltaShadowCheck. Null until a launch has a baseline to compare.
    deltaShadowReport: null,
    // Social layer (2026-08-15). Live inbox + friend edges via listeners;
    // directory and friend profiles fetched on demand. Shapes and the
    // publish-don't-peek design live in src/assets/javascript/social.js.
    socialRequests: {},
    socialEdges: {},
    socialDirectory: {},
    socialFriendProfiles: {},
    socialAttachedFor: null,
    // When the user last opened the Film Club — drives the rainbow chip's
    // new-updates badge. Mirrored to localStorage so it survives reloads.
    filmClubLastSeen: Number(localStorage.getItem('cinemaRoll.filmClub.lastSeen') || 0),
    filteredResults: [],
    // Header banner: Home resolves bannerUrl on arrival based on bannerRequest
    // (set by MovieDetail/RateMovie/search links). See Header.vue + Home.resolveBanner.
    bannerUrl: null,
    bannerRequest: null, // { type: 'movie', movieId } | { type: 'fromResults' } | null
    // Home page navigation state preservation
    homePageScrollPosition: 0,
    homePageSearchChips: [],
    homePageSearchValue: '',
    homePageNumberOfResults: 25,
    homePageNavigationIntent: null, // 'close' | 'search' | null
    homePageSortValue: null, // preserve sort value for 'close' navigation
    homePageSortOrder: null, // preserve sort order for 'close' navigation
    homePagePromoteGroup: null, // group key to promote to top when navigating from a clicked value
    // Simple save debouncing
    lastSavePath: null,
    lastSaveTime: 0,
    // Offline rating support: isOnline drives which entry points/paths are
    // reachable (see AddRating.js, RateMovie.vue, Home.vue), and is flipped
    // by App.vue's 'online'/'offline' listeners. isFlushingPendingWrites
    // guards flushPendingWrites against overlapping passes when its several
    // triggers (see App.vue) fire close together. pendingReconciliations
    // mirrors the pendingWriteQueue's unreconciled placeholder entries, kept
    // in Vuex so Home.vue can reactively show a "needs a match" banner.
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    // { [dbPath]: value } for writes committed locally but not yet confirmed
    // by the server — see the trackInFlightWrite mutation for why.
    inFlightWrites: {},
    isFlushingPendingWrites: false,
    pendingReconciliations: [],
    // Flipped by registerServiceWorker.js's `updated` hook once a new
    // version has installed and activated in the background. Deliberately
    // does NOT auto-reload (see UpdateAvailableBanner.vue's own comment for
    // the bug report this fixed) - an unconditional window.location.reload()
    // there used to yank the page out from under whatever the user was
    // doing (e.g. mid-way through the box office backfill button).
    updateAvailable: false,
  },
  getters: {
    allMediaAsArray: (state) => {
      if (!state.dbLoaded) {
        return [];
      }

      return Object.keys(state.movieLog).map((key) => {
        const movie = state.movieLog[key];
        movie.dbKey = key;
        return movie;
      });
    },
    allMoviesAsArray: (state) => {
      return Object.keys(state.movieLog).map((key) => {
        return state.movieLog[key];
      })
    },
    allMediaSortedByRating: (state, getters) => {
      return getters.allMediaAsArray.sort(sortByRating);
    },
    allMediaRatingsArray: (state, getters) => {
      return getters.allMediaAsArray.map((media) => {
        return mostRecentRating(media).calculatedTotal;
      });
    },
    databaseTopKey (state, getters) {
      return getters.devMode ? state.devModeTopKey : state.databaseTopKey;
    },
    // Social is keyed by the REAL signed-in account, never the dev-mode
    // sandbox — the database rules only allow writes under the key that
    // matches the auth token's email.
    socialUserKey (state) {
      return state.databaseTopKey;
    },
    socialSettings (state) {
      // Sharing is ON by default — the friend handshake is the real consent
      // gate (rules make unfriended profiles unreadable). Explicit false in
      // settings.social is the opt-out. See socialSettingsWithDefaults.
      return socialSettingsWithDefaults(state.settings?.social, state.userEmail);
    },
    // Friendship = BOTH edges exist. My friends are my outgoing edges that
    // the other side has reciprocated.
    socialFriendKeys (state, getters) {
      const me = getters.socialUserKey;
      if (!me) return [];
      const myEdges = state.socialEdges?.[me] || {};
      return Object.keys(myEdges).filter((key) => state.socialEdges?.[key]?.[me]);
    },
    // Requests I've sent that the other side hasn't accepted yet: my
    // outgoing edges with no reciprocal edge.
    // New friend ratings since the Film Club was last opened — only
    // mutual friends' profiles count (others aren't readable anyway).
    filmClubNewUpdateCount (state, getters) {
      const profiles = {};
      getters.socialFriendKeys.forEach((key) => {
        if (state.socialFriendProfiles?.[key]) profiles[key] = state.socialFriendProfiles[key];
      });
      return countNewFriendUpdates(profiles, state.filmClubLastSeen);
    },
    socialPendingSentKeys (state, getters) {
      const me = getters.socialUserKey;
      if (!me) return [];
      const myEdges = state.socialEdges?.[me] || {};
      return Object.keys(myEdges).filter((key) => !state.socialEdges?.[key]?.[me]);
    },
    // Backed by state.devMode (set via the setDevMode mutation), not a direct
    // localStorage read. A Vuex getter is a Vue computed under the hood: with
    // no reactive dependency (a bare `localStorage.getItem(...)` read touches
    // no observed state), it only evaluates once and then caches that value
    // forever, so toggling localStorage directly — from another tab, devtools,
    // or a differently-reloaded page — would never be picked up without a
    // full app reload. Routing state.devMode through here keeps it reactive.
    devMode (state) {
      return state.devMode;
    },
    weight (state) {
      return (name) => {
        return state.weights.find((weight) => weight.name === name).weight;
      }
    },
  },
  mutations: {
    setMovieLog (state, value) {
      state.movieLog = Object.freeze(value);
    },
    setSettings (state, value) {
      state.settings = value;
    },
    setAcademyAwardWinners (state, value) {
      state.academyAwardWinners = value
    },
    setSocialRequests (state, value) {
      state.socialRequests = value || {};
    },
    setSocialEdges (state, value) {
      state.socialEdges = value || {};
    },
    setSocialDirectory (state, value) {
      state.socialDirectory = value || {};
    },
    setSocialFriendProfile (state, { key, profile }) {
      state.socialFriendProfiles = { ...state.socialFriendProfiles, [key]: profile };
    },
    setSocialAttachedFor (state, value) {
      state.socialAttachedFor = value;
    },
    markFilmClubSeen (state) {
      state.filmClubLastSeen = Date.now();
      localStorage.setItem('cinemaRoll.filmClub.lastSeen', String(state.filmClubLastSeen));
    },
    setAllAcademyAwards (state, value) {
      state.allAcademyAwards = value;
    },
    setUserEmail (state, value) {
      state.userEmail = value;
    },
    setDatabaseTopKey (state, value) {
      state.databaseTopKey = emailToDatabaseKey(value);
    },
    setNewEntrySearchResults (state, value) {
      const results = [...value];
      const sorted = results.sort(sortByVoteCount);

      state.newEntrySearchResults = sorted;
    },
    setMovieToRate (state, movie) {
      state.movieToRate = movie;
    },
    // Applies a single movieLog write to local state immediately, regardless
    // of connectivity - the optimistic-commit half of offline rating support
    // (see AddRating.js). Without this, an offline write would only queue to
    // IndexedDB and wouldn't show up anywhere (grid, previous viewings, a
    // same-session re-edit) until the queue actually flushes. setMovieLog
    // freezes movieLog wholesale, so this rebuilds+refreezes a new object
    // rather than mutating the existing (frozen) one in place.
    setMovieLogEntry (state, { key, value }) {
      state.movieLog = Object.freeze({ ...state.movieLog, [key]: value });
    },
    // Batched counterpart to setMovieLogEntry - applies MANY entries in one
    // spread+freeze+reactivity-trigger instead of one per entry (bug fix,
    // Jul 2026: the box office backfill button called setMovieLogEntry once
    // per movie as each one completed - for a large library that's hundreds
    // of full movieLog copies + reactivity cascades in rapid succession,
    // severe enough to freeze/crash the tab on a real device. Batching
    // callers, e.g. backfillBoxOffice.js, cuts that down by the batch size).
    setMovieLogEntries (state, entries) {
      const updated = { ...state.movieLog };
      entries.forEach(({ key, value }) => { updated[key] = value; });
      state.movieLog = Object.freeze(updated);
    },
    // General-purpose counterpart to setMovieLogEntry/setMovieLogEntries for
    // any OTHER db path — settings/* (any depth: settings/lastTweak,
    // settings/personalAwards/2024, ...) and deeper movieLog/* paths that
    // aren't a plain full-entry replace. Added for the offline-support
    // extension to Stickiness/Tiebreak/Personal Awards (Jul 2026) — those
    // three write mostly to settings/*, which had NO local-optimistic-commit
    // mutation at all before this (unlike movieLog, which got one during the
    // original offline-rating work) - without it, an offline write to e.g.
    // settings/tieBreakTournament wouldn't show up anywhere until the queue
    // actually flushed. Reuses setMovieLogEntry's exact shape for the common
    // movieLog/<key> case (freeze + reactivity trigger) rather than routing
    // it through the generic recursive path, since that's already proven and
    // used by every existing movieLog writer.
    applyDbPathLocally (state, { path, value }) {
      const segments = (path || '').split('/').filter(Boolean);
      const [root, ...rest] = segments;
      if (!root || !rest.length) return;

      if (root === 'movieLog' && rest.length === 1) {
        state.movieLog = Object.freeze({ ...state.movieLog, [rest[0]]: value });
        return;
      }
      if (root === 'movieLog') {
        state.movieLog = Object.freeze(setValueAtPath(state.movieLog, rest, value));
        return;
      }
      if (root === 'settings') {
        state.settings = setValueAtPath(state.settings, rest, value);
      }
    },
    // Bug report (Jul 2026): "After I break a tie, I get the tie break
    // message again just for a second or two." A tiebreak fires several
    // writeDurably calls back to back (the tournament record, the movieLog
    // score adjustments, the settings/lastTweak quota stamp). Each one
    // commits locally first, but its Firebase set() was serialized BEHIND an
    // IndexedDB enqueue - so the first write reached the server while a
    // later one (lastTweak) hadn't been issued yet. The server's onValue
    // then fired with a snapshot that legitimately predated lastTweak, and
    // setSettings replaces settings WHOLESALE - clobbering the local commit
    // and flipping the quota check back to "due", which re-showed the
    // notice until the lastTweak write finally landed.
    //
    // These two mutations track a write from the moment it's committed
    // locally until the server confirms it, so an incoming snapshot can be
    // re-topped with anything still in flight (see reapplyInFlightWrites)
    // instead of momentarily reverting it.
    trackInFlightWrite (state, { path, value }) {
      state.inFlightWrites = { ...state.inFlightWrites, [path]: value };
    },
    untrackInFlightWrite (state, path) {
      const next = { ...state.inFlightWrites };
      delete next[path];
      state.inFlightWrites = next;
    },
    setIsOnline (state, value) {
      state.isOnline = value;
    },
    setIsFlushingPendingWrites (state, value) {
      state.isFlushingPendingWrites = value;
    },
    setPendingReconciliations (state, value) {
      state.pendingReconciliations = value;
    },
    setUpdateAvailable (state, value) {
      state.updateAvailable = value;
    },
    setDBSearchValue (state, value) {
      state.DBSearchValue = value;
    },
    setDBSortValue (state, value) {
      state.DBSortValue = value;
    },
    setDBSortOrder (state, value) {
      state.DBSortOrder = value;
    },
    setShowHeader (state, value) {
      state.showHeader = value;
    },
    setHideHeaderLogo (state, value) {
      state.hideHeaderLogo = value;
    },
    setGoHome (state, value) {
      state.goHome = value;
    },
    setHomePageLiveState (state, value) {
      state.homePageLiveState = value;
    },
    setDbLoaded (state, value) {
      state.dbLoaded = value;
    },
    setDbReadDenied (state, value) {
      state.dbReadDenied = value;
    },
    setDbListenersAttachedFor (state, value) {
      state.dbListenersAttachedFor = value;
    },
    setSettingsLoaded (state, value) {
      state.settingsLoaded = value;
    },
    setDeltaShadowReport (state, value) {
      state.deltaShadowReport = value;
    },
    // Persists to localStorage here too, so this is the one place that needs
    // to know devMode is backed by localStorage at all — callers just commit.
    setDevMode (state, value) {
      state.devMode = value;
      localStorage.setItem('devMode', value);
    },
    setFilteredResults (state, value) {
      state.filteredResults = value;
    },
    setBannerUrl (state, value) {
      state.bannerUrl = value;
    },
    setBannerRequest (state, value) {
      state.bannerRequest = value;
    },
    updateLastSave (state, { path, time }) {
      state.lastSavePath = path;
      state.lastSaveTime = time;
    },
    // Home page navigation state mutations
    setHomePageScrollPosition (state, value) {
      state.homePageScrollPosition = value;
    },
    setHomePageSearchChips (state, value) {
      state.homePageSearchChips = value;
    },
    setHomePageSearchValue (state, value) {
      state.homePageSearchValue = value;
    },
    setHomePageNumberOfResults (state, value) {
      state.homePageNumberOfResults = value;
    },
    setHomePageNavigationIntent (state, value) {
      state.homePageNavigationIntent = value;
    },
    setHomePageSortValue (state, value) {
      state.homePageSortValue = value;
    },
    setHomePageSortOrder (state, value) {
      state.homePageSortOrder = value;
    },
    setHomePagePromoteGroup (state, value) {
      state.homePagePromoteGroup = value;
    }
  },
  actions: {
    // Shared tail of EVERY sign-in method (Google, Apple, email/password).
    // A user's whole library is keyed by their email address, so this is the
    // one place that derives the key, persists it, and boots the database —
    // no provider gets to do that its own way.
    completeLogin (context, user) {
      const email = user?.email;

      if (!email) {
        // Every provider we enable returns an email (Apple's "Hide My Email"
        // returns a stable per-app relay address, which works fine as a key).
        // If one somehow doesn't, failing loudly is much safer than dropping
        // the user into an empty, wrongly-keyed database.
        ErrorLogService.error('Sign-in succeeded but returned no email address', user);
        throw new Error("Signed in, but no email address came back. Cinema Roll keys your library by email, so it can't continue.");
      }

      context.commit('setUserEmail', email);
      // NOTE: this used to `dispatch` — but setDatabaseTopKey is a MUTATION,
      // never an action, so that dispatch was a silent no-op and state.databaseTopKey
      // stayed null through login. It only worked because the router guard
      // re-read the key from localStorage on the very next navigation and
      // committed it there. Committing directly makes the flow correct rather
      // than accidentally correct.
      context.commit('setDatabaseTopKey', email);
      window.localStorage.setItem('databaseTopKey', emailToDatabaseKey(email));
      // Kept alongside the key so the "Signed in as ..." line survives a
      // reload. state.databaseTopKey is sanitized and can't be turned back
      // into an address, so the raw email has to be stored separately.
      window.localStorage.setItem('userEmail', email);
      context.dispatch('initializeDB');
      router.push('/');
    },
    async login (context) {
      // Kept under its original name so existing callers keep working.
      return context.dispatch('loginWithGoogle');
    },
    async loginWithGoogle (context) {
      const result = await signInWithPopup(getAuth(), new GoogleAuthProvider());
      context.dispatch('completeLogin', result.user);
    },
    async loginWithApple (context) {
      // Apple is an OAuth provider rather than a first-class one in the
      // Firebase SDK. The email scope is required — without it Apple returns
      // no address at all and completeLogin would (correctly) refuse.
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');

      const result = await signInWithPopup(getAuth(), provider);
      context.dispatch('completeLogin', result.user);
    },
    // Automated-testing sign-in: scripts/mint-test-token.mjs mints a
    // short-lived Admin-SDK custom token for the dedicated tester account,
    // and /#/login?testToken=... hands it here. Safe by construction: a
    // custom token only signs in the account it was minted for, minting
    // requires the admin key, and the database rules scope any account to
    // its own email-derived branch — so this can never reach real data.
    async loginWithTestToken (context, token) {
      const result = await signInWithCustomToken(getAuth(), token);
      context.dispatch('completeLogin', result.user);
    },
    async loginWithEmail (context, { email, password }) {
      const result = await signInWithEmailAndPassword(getAuth(), email, password);
      context.dispatch('completeLogin', result.user);
    },
    async signUpWithEmail (context, { email, password }) {
      const result = await createUserWithEmailAndPassword(getAuth(), email, password);

      // Fire and forget, and deliberately not enforced anywhere yet — a library
      // is keyed by email address, so being able to prove you own that address
      // matters. Firebase's "one account per email" setting is what actually
      // stops someone registering an address that's already in use; this is the
      // groundwork for tightening that later without blocking sign-ups now.
      sendEmailVerification(result.user).catch((error) => {
        ErrorLogService.error('Could not send verification email', error);
      });

      context.dispatch('completeLogin', result.user);
    },
    async sendPasswordReset (context, email) {
      await sendPasswordResetEmail(getAuth(), email);
    },
    async logout (context) {
      await signOut(getAuth());
      window.localStorage.removeItem('databaseTopKey');
      window.localStorage.removeItem('userEmail');
      context.commit('setUserEmail', null);
      context.commit('setDatabaseTopKey', null);
      await context.dispatch('resetLocalDB');
      router.push('/login');
    },
    // The router decides you're signed in synchronously from localStorage,
    // which is the only thing that ever gated access while the database rules
    // were open. Once they aren't, a stale key (session expired, password
    // changed, signed out on another device) would show an empty library with
    // no explanation. This reconciles the two once Firebase has had its say.
    async verifyRestoredSession (context) {
      const storedKey = window.localStorage.getItem('databaseTopKey');
      if (!storedKey) {
        return;
      }

      const user = await authReady;
      if (user) {
        // Keep the in-memory identity honest even if localStorage is stale —
        // the restored session is the authority on who you actually are.
        if (user.email && user.email !== context.state.userEmail) {
          context.commit('setUserEmail', user.email);
          window.localStorage.setItem('userEmail', user.email);
        }
        return;
      }

      // Only act when we can actually tell a revoked session apart from a
      // flaky one. Firebase restores sessions from local persistence without
      // a network, so this is belt-and-braces rather than strictly required.
      if (!context.state.isOnline) {
        return;
      }

      ErrorLogService.error('Stored login found but no Firebase session — signing out', { storedKey });
      await context.dispatch('logout');
    },
    async resetLocalDB (context) {
      context.commit('setMovieLog', {});
      context.commit('setSettings', {});
      context.commit('setAcademyAwardWinners', {});
      // allAcademyAwards deliberately NOT reset here — unlike movieLog/
      // settings/academyAwardWinners (all scoped to whichever account this
      // is switching to/from), the full awards dataset isn't user-specific
      // at all, so there's no reason to discard and re-fetch ~11k records
      // just because the active account changed.

      await context.dispatch('initializeDB');
    },
    async initializeDB (context) {
      if (!context.getters.databaseTopKey) {
        return;
      }

      // Wait for Firebase to restore (or rule out) a persisted session before
      // attaching any listener, so reads always carry an auth token. Harmless
      // while the database rules are open; load-bearing once they aren't.
      //
      // Deliberately NOT gated on the result: the offline path below has to
      // keep working from the IndexedDB snapshot even when there's no live
      // session to restore, and the router owns the "you're signed out, go to
      // /login" decision (see verifyRestoredSession).
      await authReady;

      const topKey = context.getters.databaseTopKey;

      // Attach the live listeners exactly once per account key. The old
      // guard asked "does state already have data?" — which broke the day
      // game screens started committing a play-counter into settings at
      // mount: that scrap of local data read as "already loaded," the
      // settings listener never attached, and the whole session ran
      // without personalAwards (the vanished Insights pane). An explicit
      // flag can't be fooled by local writes. dbReadDenied still forces a
      // re-attach after sign-in, since a cancelled listener never refires.
      const listenersLive = context.state.dbListenersAttachedFor === topKey && !context.state.dbReadDenied;
      if (!listenersLive) {
        context.commit('setDbListenersAttachedFor', topKey);
        // Offline fallback: Firebase RTDB's web SDK has no disk persistence
        // (unlike Firestore), so the onValue socket below never fires without
        // a live connection and dbLoaded would hang forever. Race it against
        // the last-synced IndexedDB snapshot so a cold offline start still
        // becomes usable. Whichever settles the UI first, the onValue
        // callback (which always fires once connected, cache hit or miss)
        // is the source of truth and overwrites/re-persists on arrival - the
        // dbLoaded guard just stops a slower cache read from clobbering
        // already-arrived live data.
        // Started once, shared by the offline-fallback race below AND the
        // delta-sync shadow check: the shadow comparison needs the snapshot
        // as it stood BEFORE this launch's live data re-persists it, and an
        // IndexedDB read transaction opened here sees the pre-overwrite
        // value regardless of when it resolves.
        const priorSnapshotPromise = loadSnapshot(topKey, 'movieLog').catch(() => null);
        let shadowCheckStarted = false;

        priorSnapshotPromise.then(async (cached) => {
          if (cached && !context.state.dbLoaded) {
            context.commit('setMovieLog', cached);
          }
          // Re-top the snapshot with anything still durably queued — the
          // snapshot only mirrors the last SERVER state, so without this a
          // movie rated offline vanished from view on relaunch (bug
          // report). Also covers a snapshot-less first session: the queue
          // entry alone is enough to show the rating.
          if (!context.state.dbLoaded) {
            await context.dispatch('replayPendingWrites', 'movieLog');
          }
          if (!context.state.dbLoaded && (cached || Object.keys(context.state.movieLog).length)) {
            context.commit('setDbLoaded', true);
          }
          return null;
        }).catch(() => {});

        onValue(ref(db, `${topKey}/movieLog`), (snapshot) => {
          const data = snapshot.val();

          if (data) {
            // Delta sync SHADOW check (phase 1): reconstruct the library
            // from prior-snapshot + delta query and diff it against this
            // full download, acting on neither. Once per session, and
            // dispatched BEFORE saveSnapshot below re-persists the fresh
            // data (the prior-snapshot read transaction is already open, so
            // ordering here is belt-and-braces, not load-bearing).
            if (!shadowCheckStarted) {
              shadowCheckStarted = true;
              context.dispatch('runDeltaShadowCheck', { fresh: data, priorSnapshotPromise, topKey });
            }
            // Same in-flight re-top as the settings listener below — a
            // tiebreak's score adjustments are movieLog writes, and a
            // snapshot predating them would otherwise briefly restore the
            // pre-tiebreak scores (re-showing the tie).
            context.commit('setMovieLog', reapplyInFlightWrites(context.state, 'movieLog', data));
            saveSnapshot(topKey, 'movieLog', data);
            // And the durable-queue re-top: on a reconnecting launch this
            // first server snapshot predates the background flush, so
            // without this the offline-made rating blinked out of the
            // library until the flush's own refire brought it back.
            context.dispatch('replayPendingWrites', 'movieLog');
          }
          context.commit('setDbReadDenied', false);
          context.commit('setDbLoaded', true);
        }, (error) => {
          // The listener was CANCELLED — under the locked-down rules that
          // means permission denied: a dead/wrong session, or dev mode
          // pointing at a database this account can't read. The library
          // isn't empty, this device just can't see it — surface that
          // (LibraryAccessBanner) instead of leaving a silent empty grid.
          console.error('movieLog listener cancelled:', error);
          ErrorLogService.error('movieLog listener cancelled:', error);
          context.commit('setDbReadDenied', true);
          // Whatever the snapshot fallback managed to show is all there is;
          // stop any loading state so the banner + cached view take over.
          context.commit('setDbLoaded', true);
        });

        loadSnapshot(topKey, 'settings').then(async (cached) => {
          // settingsLoaded (not key-counting) decides whether the snapshot
          // may apply: local write scraps can predate it. The snapshot
          // replaces them wholesale, and the queue replay below restores
          // them on top — they were durably enqueued by the same writes
          // that created them.
          if (cached && !context.state.settingsLoaded) {
            context.commit('setSettings', cached);
            context.commit('setSettingsLoaded', true);
            await context.dispatch('replayPendingWrites', 'settings');
          }
          return null;
        }).catch(() => {});

        onValue(ref(db, `${topKey}/settings`), (snapshot) => {
          const data = snapshot.val();

          if (data) {
            // Snapshot the raw server data offline, but show the version
            // re-topped with still-unconfirmed local writes (see
            // reapplyInFlightWrites) so a just-made change can't flicker back.
            context.commit('setSettings', reapplyInFlightWrites(context.state, 'settings', data));
            context.commit('setSettingsLoaded', true);
            saveSnapshot(topKey, 'settings', data);
            context.dispatch('replayPendingWrites', 'settings');
          }
        }, (error) => {
          // Same denial signal as the movieLog listener above (the rules
          // gate both identically); committing the flag twice is harmless.
          console.error('settings listener cancelled:', error);
          context.commit('setDbReadDenied', true);
        });
      }
      const academyAwardWinnersHasData = Boolean(Object.keys(context.state.academyAwardWinners).length);
      if (!academyAwardWinnersHasData) {
        // This block enriches ~98 Best Picture winners with a TMDB call EACH,
        // sequentially. It used to be guarded only on in-memory state, so every
        // cold launch re-ran all 98 requests — the single largest source of API
        // traffic in the app. The list changes once a year, so it caches like
        // movieLog/settings do, keyed 'global' because it isn't user-specific.
        const cached = await loadSnapshot('global', 'academyAwardWinners');
        if (cached && Object.keys(cached).length) {
          context.commit('setAcademyAwardWinners', cached);
        }
      }

      if (!Object.keys(context.state.academyAwardWinners).length) {
        try {
          const response = await axios.get(`https://web-production-b8145.up.railway.app/awards?category=Best%20Picture`);
          const data = response.data.map((item) => {
            return {
              ...item,
              isWinner: ['TRUE', '1', true].includes(item.isWinner)
            }
          }).filter((item) => item.isWinner);

          const bestPictureWinners = [];

          for (const movieEntry of data) {
            try {
              const movieResponse = await axios.get(`https://api.themoviedb.org/3/movie/${movieEntry.tmdb}?api_key=${process.env.VUE_APP_TMDB_API_KEY}`);
              bestPictureWinners.push({
                ...movieResponse.data,
                academyAwardsYear: movieEntry.year
              });
            } catch (error) {
              console.error(error);
              ErrorLogService.error('Error fetching movie data for Academy Award winner:', movieEntry, error);
            }
          }

          const winners = { bestPicture: bestPictureWinners };
          context.commit('setAcademyAwardWinners', winners);
          // Only cache a complete-looking result; a partial fetch shouldn't be
          // baked in as the answer for the next month.
          if (bestPictureWinners.length) {
            saveSnapshot('global', 'academyAwardWinners', winners);
          }
        } catch (error) {
          console.error('Failed to get awards data:', error);
          ErrorLogService.error('Failed to get awards data:', error);
        }
      }
      // Full, all-category, all-year Academy Awards dataset — "there aren't
      // that many Academy Awards, it'd be like one JSON thing we could pull
      // down... store it locally so we can use it wherever we want to."
      // ~11k raw records (wins AND nominations, every category since the
      // 1st ceremony), same self-built film-awards-api service as above,
      // just the bare /awards endpoint with no category filter — confirmed
      // live (curl) to return the complete dataset, ~5.5MB. NOT TMDB-enriched
      // per record (unlike academyAwardWinners' Best Picture list) — that
      // would mean a per-record TMDB fetch across ~11k rows, defeating the
      // "not that big" simplicity this is explicitly meant to have.
      // Consumers needing more than the raw tmdb id (e.g. a poster) already
      // have the movie's own local entry to fall back to when it's in the
      // library, or can look it up live for the rare case it isn't.
      const allAcademyAwardsHasData = context.state.allAcademyAwards.length > 0;
      if (!allAcademyAwardsHasData) {
        // ~5.25MB. This previously kicked off the cache read and the network
        // fetch TOGETHER, so the snapshot only ever won a race to first paint
        // — the download happened on every launch anyway. Awaiting the cache
        // first means a device that already has it downloads nothing.
        const cached = await loadSnapshot('global', 'allAcademyAwards');
        if (cached && cached.length) {
          context.commit('setAllAcademyAwards', cached);
        }
      }

      if (context.state.allAcademyAwards.length === 0) {
        try {
          const response = await axios.get('https://web-production-b8145.up.railway.app/awards');
          const data = (response.data || []).map((record) => ({
            ...record,
            isWinner: ['TRUE', '1', true].includes(record.isWinner),
            isActing: ['TRUE', '1', true].includes(record.isActing)
          }));
          context.commit('setAllAcademyAwards', data);
          if (data.length) {
            saveSnapshot('global', 'allAcademyAwards', data);
          }
        } catch (error) {
          console.error('Failed to get the full Academy Awards dataset:', error);
          ErrorLogService.error('Failed to get the full Academy Awards dataset:', error);
        }
      }

      // offline-killed session: flush if already online (no-ops otherwise),
      // and always refresh the reconciliation banner state regardless of
      // connectivity.
      context.dispatch('flushPendingWrites');
      context.dispatch('refreshPendingReconciliations');
    },
    // todo: should I delete this? Nothing is calling it but it seems like something I kind of need...
    async initiateNewDatabase (context) {
      if (!context.getters.databaseTopKey) {
        return;
      }

      const newDB = {
        movieLog: {},
        settings: {
          tags: {
            "viewing-tags": { title: "default viewing tag" },
          }
        }
      }

      set(ref(db, `${context.getters.databaseTopKey}`), newDB);

      context.dispatch('initializeDB');
    },
    async setDBValue (context, dbEntry) {
      const now = Date.now();
      const timeSinceLastSave = now - context.state.lastSaveTime;
      const isSamePath = context.state.lastSavePath === dbEntry.path;

      // Simple debounce: skip if saving same path within 1 second
      if (isSamePath && timeSinceLastSave < 1000) {
        return;
      }

      await performDatabaseWrite(context, dbEntry);
    },
    // Delta sync phase 1 — SHADOW MODE. Runs the real delta machinery on
    // every launch and reports whether it would have produced the same
    // library the full download did, while the app continues to run
    // entirely on the full download. Divergence is the thing this exists to
    // catch BEFORE phase 2 trusts the delta path — it logs loudly (console
    // + ErrorLogService, visible in the in-app error log) and stashes a
    // report in state; agreement logs quietly. Never throws: any failure
    // here (offline probe, missing meta, first run) just means "no
    // comparison this launch."
    async runDeltaShadowCheck (context, { fresh, priorSnapshotPromise, topKey }) {
      try {
        const meta = await loadSnapshot(topKey, 'deltaSyncMeta');
        const priorSnapshot = await priorSnapshotPromise;
        const newLastSync = maxUpdatedAt(fresh);

        if (meta?.lastSync != null && priorSnapshot) {
          // startAt is inclusive, so the boundary entry is re-fetched —
          // harmless (the merge replaces it with an identical copy) and
          // safer than +1 arithmetic against equal-stamp writes.
          const [deltaSnap, tombstoneSnap] = await Promise.all([
            get(query(ref(db, `${topKey}/movieLog`), orderByChild('updatedAt'), startAt(meta.lastSync))),
            get(ref(db, `${topKey}/movieLogDeletions`))
          ]);
          const deltaEntries = deltaSnap.val() || {};
          const reconstructed = reconstructFromDelta(priorSnapshot, deltaEntries, tombstoneSnap.val() || {});
          const report = {
            ...diffLibraries(fresh, reconstructed),
            deltaEntryCount: Object.keys(deltaEntries).length,
            lastSyncUsed: meta.lastSync,
            checkedAt: Date.now()
          };
          if (report.stale.length) {
            // Self-explaining divergences: stamps on both sides, whether the
            // delta query actually returned the key, and which fields differ.
            report.staleDetail = report.stale.map((dbKey) =>
              describeStaleEntry(fresh[dbKey], reconstructed[dbKey], deltaEntries, dbKey));
          }
          context.commit('setDeltaShadowReport', report);

          if (report.identical) {
            console.info(`[delta-shadow] identical: ${report.compared} entries reconstructed from snapshot + ${report.deltaEntryCount} delta entries`);
            ErrorLogService.info?.(`[delta-shadow] identical (${report.compared} entries, ${report.deltaEntryCount} via delta)`);
          } else {
            console.warn('[delta-shadow] DIVERGENCE:', report);
            ErrorLogService.error('[delta-shadow] delta reconstruction diverged from full download:', report);
          }
        }

        // Either way, this launch's full download is the new baseline.
        if (newLastSync != null) {
          await saveSnapshot(topKey, 'deltaSyncMeta', { lastSync: newLastSync, savedAt: Date.now() });
        }
      } catch (error) {
        // Shadow mode must never affect the real load path.
        console.warn('[delta-shadow] check skipped:', error);
      }
    },
    // Re-applies every still-queued durable write for `root` ('movieLog' or
    // 'settings') to LOCAL state, oldest first. Bug report: a movie rated
    // offline "seemed to appear... but when I closed the app and reopened
    // it, the rating was gone." The IndexedDB snapshot only ever mirrors the
    // last SERVER state (saveSnapshot fires from the live listener alone),
    // so an offline relaunch — or the first server snapshot after
    // reconnecting, arriving before the flush completes — showed the library
    // WITHOUT anything rated since the last sync, even though its durable
    // queue entry was sitting right there. Replaying the queue on top closes
    // that: local state = last known server state + everything still
    // pending. Safe to re-run any time: a queue entry is removed once the
    // server confirms it, so replaying can only re-assert values the server
    // hasn't caught up to yet (a written-but-unreconciled placeholder stays
    // queued, but its queued value matches what was written — idempotent).
    async replayPendingWrites (context, root) {
      const pending = await listPendingWrites();
      pending
        .filter((entry) => entry?.dbEntry?.path && entry.dbEntry.path.split('/')[0] === root)
        .forEach((entry) => context.commit('applyDbPathLocally', entry.dbEntry));
    },
    // Recomputes state.pendingReconciliations from the pendingWriteQueue -
    // cheap, purely local (IndexedDB) read, safe to call regardless of
    // connectivity so Home.vue's "needs a match" banner reflects reality
    // even before the next successful flush.
    async refreshPendingReconciliations (context) {
      const pending = await listPendingWrites();
      context.commit('setPendingReconciliations', pending.filter((entry) => entry.type === 'placeholder' && entry.status !== 'reconciled'));
    },
    // Processes the durable offline-write queue (see pendingWriteQueue.js) in
    // order once online: attempts each entry's write, removes 'write' entries
    // on success, marks 'placeholder' entries written (kept for
    // reconciliation), and records attempts/lastError on failure without
    // aborting the rest of the pass. Triggered from App.vue's 'online' event
    // + its other iOS-reliability triggers/interval, and once from
    // initializeDB on a cold start that's already online.
    async flushPendingWrites (context) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (context.state.isFlushingPendingWrites) return;
      if (!context.getters.databaseTopKey) return;

      context.commit('setIsFlushingPendingWrites', true);
      try {
        const pending = await listPendingWrites();

        for (const entry of pending) {
          if (!entry.dbEntry) continue;
          // A 'placeholder' entry stays queued (for reconciliation tracking)
          // even after its write already succeeded once - written:true means
          // there's nothing left to (re-)attempt here, only actual
          // reconciliation (ReconcilePlaceholder.vue) removes it. Without
          // this, an unreconciled placeholder would get redundantly
          // re-written to Firebase on every single background sweep for as
          // long as it sits unreconciled.
          if (entry.type === 'placeholder' && entry.written) continue;

          try {
            await performDatabaseWrite(context, entry.dbEntry);
            if (entry.type === 'write') {
              await removePendingWrite(entry.id);
            } else {
              await updatePendingWrite(entry.id, { written: true });
            }
          } catch (error) {
            await updatePendingWrite(entry.id, { attempts: (entry.attempts || 0) + 1, lastError: String(error) });
          }
        }

        await context.dispatch('refreshPendingReconciliations');
      } finally {
        context.commit('setIsFlushingPendingWrites', false);
      }
    },
    // Bug fix (Jul 2026), superseding an earlier fix that turned out to be
    // insufficient: AddRating.js originally routed EVERY save (online or
    // not) through the offline queue + a shared, guarded flush action. A
    // live incident showed the actual bug this created - a movie rated
    // normally, while online, vanished, because navigating home right after
    // triggers another background flush pass (via initializeDB), and
    // whichever pass's isFlushingPendingWrites guard "won" the race could
    // silently skip the brand-new entry with nothing left to retry it
    // before the app was closed. An interim fix (a dedicated, guard-free
    // flushSingleEntry action) closed that specific race but kept the same
    // fundamental shape: every online save STILL depended on a queue write
    // succeeding and a follow-up action running correctly.
    //
    // This action is the actual fix: a raw, direct write with NO queue
    // involvement at all - no dependency on IndexedDB succeeding, no shared
    // state, nothing another concurrent call could interfere with. When
    // online (the common case), AddRating.js/ReconcilePlaceholder.vue now
    // await THIS directly and only fall back to the durable queue if it
    // throws (a genuine failure/timeout) or the device is offline to begin
    // with - restoring the same "the write is confirmed before we tell the
    // user it succeeded" guarantee the app had before the offline-rating
    // feature existed, for the case that actually broke.
    async writeDatabaseEntryNow (context, dbEntry) {
      await performDatabaseWrite(context, dbEntry);
    },
    // General-purpose "offline-safe write" for the features that don't need
    // AddRating.js's placeholder/reconciliation machinery, just its core
    // durability guarantee (bug report, Jul 2026: "updates to the stickiness
    // rating and the tiebreaker values and any [Personal Awards] changes...
    // should be able to be done offline and then push to the database when
    // I'm back online"). Same overall shape as AddRating.js's write path -
    // optimistic local commit, THEN durably enqueue BEFORE attempting -
    // generalized via applyDbPathLocally so it isn't limited to movieLog/*
    // paths the way setMovieLogEntry is.
    //
    // Deliberately does NOT re-throw on a failed online attempt (unlike
    // AddRating.js's non-placeholder path) - none of these three callers had
    // dedicated per-write error UI before this, and their existing
    // try/catch+console.error/ErrorLogService handling is the right level of
    // visibility to preserve. The durable queue entry is the real safety net
    // either way; a failed attempt just means the background flush
    // (App.vue's triggers / initializeDB) retries it, same as offline.
    async writeDurably (context, dbEntry) {
      context.commit('applyDbPathLocally', dbEntry);
      context.commit('trackInFlightWrite', dbEntry);

      // Bug report ("I get the tie break message again just for a second or
      // two"): this used to `await enqueueWrite(...)` BEFORE issuing the
      // network write, which meant every Firebase set() sat behind an
      // IndexedDB open + full-queue scan + put. With several writeDurably
      // calls back to back (a tiebreak fires 3+), an early one could reach
      // the server and bounce back an onValue snapshot while a later one
      // hadn't even been sent yet. Kicking both off together keeps the same
      // durability (the IndexedDB record still lands regardless of what
      // happens to the network write) without the network write inheriting
      // IndexedDB's latency. trackInFlightWrite above covers the remaining
      // in-flight window.
      const queuedPromise = enqueueWrite({ type: 'write', dbEntry });

      try {
        // Offline: nothing to attempt, just make sure it's durably queued.
        if (!context.state.isOnline) {
          await queuedPromise;
          return;
        }

        await context.dispatch('writeDatabaseEntryNow', dbEntry);
        const queuedRecord = await queuedPromise;
        if (queuedRecord) await removePendingWrite(queuedRecord.id);
      } catch (error) {
        // Already durably queued regardless of this failure.
        await queuedPromise.catch(() => null);
        console.error('writeDurably: direct write failed, will retry via the background queue:', dbEntry.path, error);
      } finally {
        // Always untrack, including the offline path — otherwise
        // inFlightWrites would grow unboundedly across an offline session.
        // The local value still stands on its own (applyDbPathLocally
        // committed it) and the durable queue owns getting it to the server.
        context.commit('untrackInFlightWrite', dbEntry.path);
      }
    },
    // Atomic multi-path write via Firebase's update() (not set()) - `updates`
    // is a flat object whose keys are full paths relative to the account
    // root, e.g. { 'movieLog/key1/movie/budget': 100, 'movieLog/key2/movie/revenue': 200 }.
    // Lets a caller patch many different movies' individual fields in ONE
    // network round trip / ONE onValue listener refire, instead of one write
    // per field per movie - the remote-write half of the same batching fix
    // setMovieLogEntries is the local half of (see its own comment). Used
    // for bulk background patches (e.g. backfillBoxOffice.js) where
    // minimizing the NUMBER of separate writes matters far more than the
    // single-entry durability guarantees a user-authored rating needs.
    async updateDatabaseEntriesNow (context, updates) {
      // Same change tracking as performDatabaseWrite, but a batch can touch
      // many movies at once so each one gets its own updatedAt. See
      // stampUpdatesForBatch for the overlapping-path trap it avoids.
      const cleanedUpdates = removeNaNAndUndefined(stampUpdatesForBatch(updates, serverTimestamp()));
      await withTimeout(
        update(ref(db, context.getters.databaseTopKey), cleanedUpdates),
        DATABASE_WRITE_TIMEOUT_MS,
        `Database batch update timed out after ${DATABASE_WRITE_TIMEOUT_MS}ms`
      );
    },
    // ------------------------------------------------------------------
    // Watchlist learning: which recommendation sources actually earn
    // watches. Suggestions are recorded once; when a recorded movie later
    // appears in the library, its source gets the credit. See
    // recommendationStats.js.
    async recordWatchlistSuggestions (context, shownBySource) {
      const pending = context.state.settings?.watchlistLearning?.pending || {};
      const updates = pendingUpdates(pending, shownBySource);
      const entries = Object.entries(updates);
      if (!entries.length) return;

      await Promise.all(entries.map(([tmdbId, record]) =>
        context.dispatch('writeDurably', {
          path: `settings/watchlistLearning/pending/${tmdbId}`,
          value: record
        })
      ));
      // Count what was offered, so a source's hit RATE has a denominator.
      const counts = {};
      entries.forEach(([, record]) => { counts[record.source] = (counts[record.source] || 0) + 1; });
      await Promise.all(Object.entries(counts).map(([source, added]) => {
        const current = Number(context.state.settings?.watchlistLearning?.sources?.[source]?.suggested) || 0;
        return context.dispatch('writeDurably', {
          path: `settings/watchlistLearning/sources/${source}/suggested`,
          value: current + added
        });
      }));
    },
    // Credit sources whose suggestions have since been rated, and forget
    // suggestions that went stale. Safe to run on every watchlist visit.
    async reconcileWatchlistLearning (context, ratedTmdbIds) {
      const learning = context.state.settings?.watchlistLearning;
      if (!learning?.pending) return;
      const { hits, resolved, expired } = reconcilePending(learning.pending, ratedTmdbIds);

      await Promise.all(Object.entries(hits).map(([source, count]) => {
        const current = Number(learning.sources?.[source]?.hits) || 0;
        return context.dispatch('writeDurably', {
          path: `settings/watchlistLearning/sources/${source}/hits`,
          value: current + count
        });
      }));
      await Promise.all([...resolved, ...expired].map((tmdbId) =>
        context.dispatch('writeDurably', {
          path: `settings/watchlistLearning/pending/${tmdbId}`,
          value: null
        })
      ));
    },

    // ------------------------------------------------------------------
    // Magic Mirror feed. The mirror used to read the whole movieLog over
    // unauthenticated REST; the 2026-08-14 lockdown ended that. Rather than
    // reopening the library, publish a few KB of exactly what it renders to
    // mirrorFeed/<userKey>/<secret>, which the rules make world-readable at
    // the secret level only. No credentials live on the mirror.
    // The secret must never live in Cinema Roll's public bundle, so it is
    // generated per-user at runtime and stored with the user's settings.
    async ensureMirrorFeedKey (context) {
      const existing = context.state.settings?.mirrorFeedKey;
      if (typeof existing === 'string' && existing.length >= 16) return existing;
      const bytes = new Uint8Array(16);
      (window.crypto || window.msCrypto).getRandomValues(bytes);
      const key = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      await context.dispatch('writeDurably', { path: 'settings/mirrorFeedKey', value: key });
      return key;
    },
    async publishMirrorFeed (context) {
      const me = context.state.databaseTopKey;
      const secret = context.state.settings?.mirrorFeedKey;
      if (!me || !secret || !context.state.dbLoaded) return;
      const entries = context.getters.allMediaAsArray;
      if (!entries.length) return;
      const feed = buildMirrorFeed(entries, getRating);
      await set(ref(db, `mirrorFeed/${me}/${secret}`), feed);
    },

    // ------------------------------------------------------------------
    // Social layer. All writes land OUTSIDE the user's private branch, under
    // social/ — see src/assets/javascript/social.js and the database rules.
    attachSocialListeners (context) {
      const me = context.getters.socialUserKey;
      if (!me || context.state.socialAttachedFor === me) return;
      context.commit('setSocialAttachedFor', me);
      onValue(ref(db, `social/requests/${me}`), (snapshot) => {
        context.commit('setSocialRequests', snapshot.val());
      }, (error) => console.error('social requests listener cancelled:', error));
      onValue(ref(db, 'social/friends'), (snapshot) => {
        context.commit('setSocialEdges', snapshot.val());
        // Profiles feed the Film Club badge on Home, so they load wherever
        // the listeners attach — not just on the Film Club screen.
        context.dispatch('fetchFriendProfiles');
      }, (error) => console.error('social friends listener cancelled:', error));
    },
    // Publish (or refresh) my public profile + directory row. Safe to call
    // liberally — it no-ops unless social is enabled and the library is in.
    async publishSocialProfile (context) {
      const me = context.getters.socialUserKey;
      const social = context.getters.socialSettings;
      if (!me || !social.enabled || !context.state.settingsLoaded) return;
      const entries = context.getters.allMediaAsArray;
      if (!entries.length) return;
      const profile = buildSocialProfile(entries, getRating, {
        name: social.displayName || 'A Cinema Roll user',
        shareRatings: Boolean(social.shareRatings),
        shareCriteria: Boolean(social.shareRatings && social.shareCriteria)
      });
      await Promise.all([
        set(ref(db, `social/profiles/${me}`), profile),
        set(ref(db, `social/directory/${me}`), { name: profile.name })
      ]);
    },
    async unpublishSocialProfile (context) {
      const me = context.getters.socialUserKey;
      if (!me) return;
      await Promise.all([
        set(ref(db, `social/profiles/${me}`), null),
        set(ref(db, `social/directory/${me}`), null)
      ]);
    },
    async fetchSocialDirectory (context) {
      const snapshot = await get(ref(db, 'social/directory'));
      context.commit('setSocialDirectory', snapshot.val());
    },
    async sendFriendRequest (context, toKey) {
      const me = context.getters.socialUserKey;
      if (!me || !toKey || toKey === me) return;
      // Pre-commit my half of the friendship; theirs is created when they
      // accept. One dangling edge grants nothing.
      await set(ref(db, `social/friends/${me}/${toKey}`), true);
      await set(ref(db, `social/requests/${toKey}/${me}`), {
        name: context.getters.socialSettings.displayName || 'A Cinema Roll user',
        at: Date.now()
      });
    },
    async cancelFriendRequest (context, toKey) {
      const me = context.getters.socialUserKey;
      if (!me || !toKey) return;
      await Promise.all([
        set(ref(db, `social/friends/${me}/${toKey}`), null),
        set(ref(db, `social/requests/${toKey}/${me}`), null)
      ]);
    },
    async acceptFriendRequest (context, fromKey) {
      const me = context.getters.socialUserKey;
      if (!me || !fromKey) return;
      await set(ref(db, `social/friends/${me}/${fromKey}`), true);
      await set(ref(db, `social/requests/${me}/${fromKey}`), null);
      context.dispatch('fetchFriendProfiles');
    },
    async declineFriendRequest (context, fromKey) {
      const me = context.getters.socialUserKey;
      if (!me || !fromKey) return;
      await set(ref(db, `social/requests/${me}/${fromKey}`), null);
    },
    async removeFriend (context, friendKey) {
      const me = context.getters.socialUserKey;
      if (!me || !friendKey) return;
      await set(ref(db, `social/friends/${me}/${friendKey}`), null);
    },
    async fetchFriendProfiles (context) {
      const keys = context.getters.socialFriendKeys;
      await Promise.all(keys.map(async (key) => {
        try {
          const snapshot = await get(ref(db, `social/profiles/${key}`));
          context.commit('setSocialFriendProfile', { key, profile: snapshot.val() });
        } catch (error) {
          // A friend who hasn't published yet (or a permission race right
          // after acceptance) is expected — leave their profile absent.
          console.warn('could not fetch friend profile', key, error?.code || error);
        }
      }));
    },
  },
  modules: {
  }
})

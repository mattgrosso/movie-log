import axios from 'axios';
import { createStore } from "vuex"
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import * as Sentry from "@sentry/vue";
import { getRating } from "../assets/javascript/GetRating";
import router from '@/router';
import ErrorLogService from "../services/ErrorLogService.js";
import { saveSnapshot, loadSnapshot } from "../utils/offlineStore.js";
import { listPendingWrites, removePendingWrite, updatePendingWrite } from "../utils/pendingWriteQueue.js";

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
const performDatabaseWrite = async (context, dbEntry) => {
  try {
    const cleanedValue = removeNaNAndUndefined(dbEntry.value);
    await withTimeout(
      set(ref(db, `${context.getters.databaseTopKey}/${dbEntry.path}`), cleanedValue),
      DATABASE_WRITE_TIMEOUT_MS,
      `Database write timed out after ${DATABASE_WRITE_TIMEOUT_MS}ms: ${dbEntry.path}`
    );
  } catch (error) {
    console.error('Error setting database value:', error);
    ErrorLogService.error('Error setting database value:', dbEntry.path, error);
    throw error;
  }
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

const db = getDatabase();

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
    devModeTopKey: 'testing-database',
    // devModeTopKey: 'natalierosegrosso-gmail-com',
    // devModeTopKey: 'carrieseltzer-gmail-com',
    // devModeTopKey: 'hopper-seth-gmail-com',
    // devModeTopKey: 'brianpatrick1-gmail-com',
    // Read once at store creation, then kept in reactive state — see the
    // `devMode` getter below for why it can't just re-read localStorage.
    devMode: localStorage.getItem('devMode') === 'true',
    dbLoaded: false,
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
    isFlushingPendingWrites: false,
    pendingReconciliations: [],
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
    setAllAcademyAwards (state, value) {
      state.allAcademyAwards = value;
    },
    setUserEmail (state, value) {
      state.userEmail = value;
    },
    setDatabaseTopKey (state, value) {
      state.databaseTopKey = value.replaceAll(/[-!$%@^&*()_+|~=`{}[\]:";'<>?,./]/g, "-");
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
    setIsOnline (state, value) {
      state.isOnline = value;
    },
    setIsFlushingPendingWrites (state, value) {
      state.isFlushingPendingWrites = value;
    },
    setPendingReconciliations (state, value) {
      state.pendingReconciliations = value;
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
    setDbLoaded (state, value) {
      state.dbLoaded = value;
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
    async login (context) {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();

      try {
        const result = await signInWithPopup(auth, provider);
        // Handle the result.
        if (result) {
          const userData = result.user;

          context.commit('setUserEmail', userData.email);

          if (context.state.userEmail) {
            context.dispatch('setDatabaseTopKey', context.state.userEmail);
            window.localStorage.setItem('databaseTopKey', context.state.userEmail.replaceAll(/[-!$%@^&*()_+|~=`{}[\]:";'<>?,./]/g, "-"));
            context.dispatch('initializeDB');
            router.push('/');
          } else {
            console.error("Login attempted but the user data didn't work");
            ErrorLogService.error("Login attempted but the user data didn't work", userData);
          }
        }
      } catch (error) {
        console.error(error);
        ErrorLogService.error('Error during login:', error);
      }
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
      const topKey = context.getters.databaseTopKey;

      const movieLogHasData = Boolean(Object.keys(context.state.movieLog).length);
      if (!movieLogHasData) {
        // Offline fallback: Firebase RTDB's web SDK has no disk persistence
        // (unlike Firestore), so the onValue socket below never fires without
        // a live connection and dbLoaded would hang forever. Race it against
        // the last-synced IndexedDB snapshot so a cold offline start still
        // becomes usable. Whichever settles the UI first, the onValue
        // callback (which always fires once connected, cache hit or miss)
        // is the source of truth and overwrites/re-persists on arrival - the
        // dbLoaded guard just stops a slower cache read from clobbering
        // already-arrived live data.
        loadSnapshot(topKey, 'movieLog').then((cached) => {
          if (cached && !context.state.dbLoaded) {
            context.commit('setMovieLog', cached);
            context.commit('setDbLoaded', true);
          }
          return null;
        }).catch(() => {});

        onValue(ref(db, `${topKey}/movieLog`), (snapshot) => {
          const data = snapshot.val();

          if (data) {
            context.commit('setMovieLog', data);
            saveSnapshot(topKey, 'movieLog', data);
          }
          context.commit('setDbLoaded', true);
        });
      }
      const settingsHasData = Boolean(Object.keys(context.state.settings).length);
      if (!settingsHasData) {
        loadSnapshot(topKey, 'settings').then((cached) => {
          if (cached && !Object.keys(context.state.settings).length) {
            context.commit('setSettings', cached);
          }
          return null;
        }).catch(() => {});

        onValue(ref(db, `${topKey}/settings`), (snapshot) => {
          const data = snapshot.val();

          if (data) {
            context.commit('setSettings', data);
            saveSnapshot(topKey, 'settings', data);
          }
        });
      }
      const academyAwardWinnersHasData = Boolean(Object.keys(context.state.academyAwardWinners).length);
      if (!academyAwardWinnersHasData) {
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

          context.commit('setAcademyAwardWinners', { bestPicture: bestPictureWinners });
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
        // Not user-specific, so a single fixed cache key rather than
        // per-account topKey — same IndexedDB snapshot mechanism
        // movieLog/settings already use for offline cold starts, applied
        // here mainly to avoid re-downloading ~5.5MB from scratch on every
        // single session once it's already been fetched once on this device.
        loadSnapshot('global', 'allAcademyAwards').then((cached) => {
          if (cached && !context.state.allAcademyAwards.length) {
            context.commit('setAllAcademyAwards', cached);
          }
          return null;
        }).catch(() => {});

        try {
          const response = await axios.get('https://web-production-b8145.up.railway.app/awards');
          const data = response.data.map((item) => {
            return {
              ...item,
              isWinner: ['TRUE', '1', true].includes(item.isWinner),
              isActing: ['TRUE', '1', true].includes(item.isActing)
            };
          });
          context.commit('setAllAcademyAwards', data);
          saveSnapshot('global', 'allAcademyAwards', data);
        } catch (error) {
          console.error('Failed to get full awards dataset:', error);
          ErrorLogService.error('Failed to get full awards dataset:', error);
        }
      }

      // Covers a cold start with leftover queue items from a previously
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
    // Bug fix (Jul 2026): attempts ONE specific queue entry's write directly,
    // completely bypassing flushPendingWrites' isFlushingPendingWrites guard.
    // AddRating.js/ReconcilePlaceholder.vue call this (awaited) immediately
    // after enqueueing a fresh write, so the save is actually attempted
    // before the caller proceeds - dispatching the SHARED flushPendingWrites
    // there instead was the root cause of a real data-loss bug: if another
    // flush pass (e.g. from initializeDB firing on the very next navigation)
    // was already mid-flight, its isFlushingPendingWrites guard silently
    // skipped the brand-new entry, and nothing else was scheduled to retry
    // it until some unrelated later trigger happened to fire - if the user
    // reloaded before that, the rating never reached Firebase at all, even
    // though it had briefly appeared locally via the optimistic commit.
    // A concurrent flushPendingWrites pass MAY also pick up this same entry
    // (harmless - writing the same data twice is idempotent, and removing an
    // already-removed queue entry is a no-op in pendingWriteQueue.js).
    async flushSingleEntry (context, entry) {
      if (!entry || !entry.dbEntry) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (!context.getters.databaseTopKey) return;

      try {
        await performDatabaseWrite(context, entry.dbEntry);
        if (entry.type === 'write') {
          await removePendingWrite(entry.id);
        } else {
          await updatePendingWrite(entry.id, { written: true });
        }
        context.dispatch('refreshPendingReconciliations');
      } catch (error) {
        await updatePendingWrite(entry.id, { attempts: (entry.attempts || 0) + 1, lastError: String(error) });
      }
    },
    // This action adds a TV show to the list of recently rated TV shows in the user's settings.
  },
  modules: {
  }
})

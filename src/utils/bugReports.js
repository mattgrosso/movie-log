import { getDatabase, ref as dbRef, push, set, serverTimestamp } from 'firebase/database';

// Same "report a bug without breaking your flow" pattern used in the
// thunderstone/space-base repos, adapted to Cinema Roll's Vuex store (not
// Pinia) and its single shared Firebase project (no cross-repo RTDB, so no
// namespacing needed — this is just "bugReports"). Unlike those repos,
// Cinema Roll's database.rules.json is wide open (`.read`/`.write: true`)
// and login is Google OAuth (not anonymous), so there's no auth dance here —
// just write the report.
function buildAppStateSummary (store, route) {
  const state = store.state;

  return {
    route: route?.fullPath || window.location.hash,
    devMode: localStorage.getItem('devMode') === 'true',
    dbLoaded: state.dbLoaded,
    movieCount: state.movieLog ? Object.keys(state.movieLog).length : 0,
    sortValue: state.DBSortValue,
    sortOrder: state.DBSortOrder,
    // NOTE: these three are the PERSISTED NAVIGATION fields (saved by
    // Home's beforeRouteLeave, cleared again by its mounted() restore) -
    // NOT what Home is actually filtering by right now. They were the only
    // search-ish state in the store, so early reports used them; a report
    // filed from Home will almost always show them empty/stale regardless
    // of what's on screen. Kept for continuity with older reports, but read
    // `homeLive` below for the real answer.
    searchValue: state.homePageSearchValue,
    searchChips: state.homePageSearchChips,
    numberOfResultsShown: state.homePageNumberOfResults,
    // Home's LIVE filter/result state, published by Home itself (see its
    // liveDebugState watcher). Added after an "the entire list of movies is
    // empty" report that couldn't be diagnosed, because nothing in the
    // snapshot could distinguish "no results matched the active filter"
    // from "the list genuinely failed to render".
    homeLive: state.homePageLiveState || null
  };
}

export async function submitBugReport (store, transcript, route) {
  const text = (transcript || '').trim();
  if (!text) throw new Error('Describe what happened before sending.');

  const db = getDatabase();
  const report = {
    createdAt: serverTimestamp(),
    transcript: text,
    reporterEmail: store.state.userEmail || null,
    url: window.location.href,
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio || 1,
    // Stringified, not a raw nested object — RTDB silently drops empty-object
    // keys on write, so a plain object here can lose fields with no warning.
    appState: JSON.stringify(buildAppStateSummary(store, route)),
  };

  await set(push(dbRef(db, 'bugReports')), report);
}

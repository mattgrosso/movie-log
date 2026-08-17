// Vue Router's scrollBehavior. Blanket policy since 2026-08-17: every
// navigation lands at the top of the new page.
//
// It used to be the other way round — scoped to games and the Trophy Case,
// with everything else inheriting whatever scroll position the previous page
// happened to have. That was a consequence of Home doing its own scroll
// restoration and a blanket rule fighting it, and it left most of the app
// arriving mid-page. Matt, once the navigation rework made the rest of it
// consistent: "I would like to enforce a blanket policy that whenever you
// navigate to a new page, it should scroll to the top."
//
// THE ONE EXCEPTION, in his words: "if you start on the Home Screen, click a
// poster to go to a movie detail page, and then click back, it should return
// you to where it was scrolled on the home page." So arriving at Home *from a
// movie detail page* returns false and leaves Home in charge of restoring the
// position it saved on the way out. Arriving at Home from anywhere else —
// Insights, the games hub, a deep link — scrolls to the top like everything
// else.
//
// That distinction is why this keys off `from` rather than off the stored
// navigation intent. Both routes back from MovieDetail are used: the explicit
// close button pushes '/' with intent 'close', while BackLink calls
// router.back() and sets no intent at all. Intent alone therefore can't tell
// "came back from a movie" from "came to Home from Insights" — both look like
// null. The previous route can.
//
// `behavior: 'instant'` is REQUIRED, not a preference. The app sets
// `scroll-behavior: smooth` on <html>, and with that in effect a plain
// window.scrollTo({top: 0}) silently does nothing at all in this app —
// verified live: the position stayed exactly where it was, while the same
// call with behavior:'instant' worked immediately. (Vue Router passes
// whatever this returns straight through to window.scrollTo, so the override
// belongs here.)

const MOVIE_DETAIL = /^\/movie\//;

export function isMovieDetailPath (path) {
  return MOVIE_DETAIL.test(path || '');
}

export function isHomePath (path) {
  return path === '/';
}

/**
 * Home is the only screen that restores a scroll position, and only when you
 * arrived from a movie's detail page. Shared with Home.vue so the router and
 * the component can't drift into disagreeing about when that happens.
 */
export function shouldRestoreHomeScroll (to, from) {
  return isHomePath(to?.path) && isMovieDetailPath(from?.path);
}

export function appScrollBehavior (to, from) {
  if (shouldRestoreHomeScroll(to, from)) return false;
  return { top: 0, behavior: 'instant' };
}

// `from` is only readable in a navigation guard, which runs BEFORE the target
// component mounts; scrollBehavior runs after. Home needs the answer in
// mounted(), so the guard records it here on the way through.
let cameFromMovie = false;

export function rememberNavigationSource (to, from) {
  cameFromMovie = shouldRestoreHomeScroll(to, from);
}

export function arrivedFromMovieDetail () {
  return cameFromMovie;
}

// Tests only — the flag is module state and would otherwise leak between them.
export function resetNavigationSource () {
  cameFromMovie = false;
}

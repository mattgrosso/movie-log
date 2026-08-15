// Vue Router's scrollBehavior, deliberately scoped to GAME routes only.
//
// The app has never had a global scrollBehavior, because Home.vue does its
// own scroll restoration (returning from a movie's detail page puts you back
// exactly where you were in the grid) and a blanket "always scroll to top"
// would fight it. That left every other route inheriting whatever scroll
// position the previous page had — harmless almost everywhere, but a real
// problem for the games: arriving at Reel Wordle from a scrolled-down Home
// opened the game halfway down its own page.
//
// GamesHub.selectGame used to work around this with its own
// window.scrollTo(0) before pushing, which fixed exactly one entry path (a
// hub tile) and missed the rest — Home's Games button, BackLink between the
// hub and a game, a deep link, the header banner. Handling it here covers
// every entry path at once, and is the only mechanism (that manual call is
// gone).
//
// The Trophy Case gets the same treatment (bug report: "When I enter the
// trophy case the page needs to scroll back to the top") — it's reached
// from a scrolled Home/MovieDetail and, like the games, has no scroll
// state of its own worth keeping.
//
// Returning `false` for everything else means "leave the scroll position
// alone", i.e. exactly the pre-existing behaviour for non-game routes —
// including Home's own restoration, which stays in charge of itself.
// `behavior: 'instant'` is REQUIRED here, not a preference. The app sets
// `scroll-behavior: smooth` on <html>, and with that in effect a plain
// window.scrollTo({top: 0}) silently does nothing at all in this app —
// verified live: the position stayed exactly where it was, and a
// window.scrollTo(0, 300) didn't move either, while the same call with
// behavior:'instant' worked immediately. (Vue Router passes whatever this
// returns straight through to window.scrollTo, so the override belongs
// here.) The GamesHub workaround this replaced happened to pass 'instant'
// too, which is why it worked and a first cut of this function did not.
export function gameAwareScrollBehavior (to) {
  if (to?.path?.startsWith('/games') || to?.path?.startsWith('/trophy-case')) {
    return { top: 0, behavior: 'instant' };
  }
  return false;
}

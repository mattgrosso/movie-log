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
// Returning `false` for everything else means "leave the scroll position
// alone", i.e. exactly the pre-existing behaviour for non-game routes —
// including Home's own restoration, which stays in charge of itself.
export function gameAwareScrollBehavior (to) {
  if (to?.path?.startsWith('/games')) {
    return { top: 0 };
  }
  return false;
}

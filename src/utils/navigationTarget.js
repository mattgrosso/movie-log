// Where the back link on any screen should actually go.
//
// Matt, 2026-08-16: "sometimes there's a back button, sometimes there's a home
// button, sometimes you land somewhere from a place, but then the button that
// you think might take you back actually takes you home instead of back."
//
// He was describing the real behaviour: nearly every back link in the app was
// a hard `$router.push` to a FIXED destination. Game Stats always said "Games"
// even when you'd arrived from Insights; Library Poster always said "Home";
// Trophy Case pushed you home rather than back where you were.
//
// The rule now: go back to where you came from, and if there is nowhere to go
// back to — a deep link, a cold PWA launch, a hard refresh — fall back to the
// screen's declared parent. The label always names the place it will actually
// take you, so the button can't lie.

/** The path portion, with query and hash discarded — `/movie/42?x=1` → `/movie/42`. */
export function pathOf (location) {
  if (typeof location !== 'string' || !location) return '';
  return location.split('#')[0].split('?')[0];
}

/**
 * @param {string|null} backPath   where history says the previous entry is
 * @param {string} currentPath     the route being viewed
 * @param {string} parentPath      this route's declared parent
 * @param {(path: string) => string} titleFor  a path → screen-name lookup
 * @param {string[]} avoid         paths that are never a sensible "back"
 * @returns {{ path: string, label: string, useBack: boolean }}
 */
export function navigationTarget ({
  backPath,
  currentPath,
  parentPath = '/',
  titleFor = () => 'Back',
  avoid = []
} = {}) {
  const back = pathOf(backPath);
  const current = pathOf(currentPath);
  const avoided = avoid.map(pathOf);

  // Going "back" to the page you're already on is a no-op that looks broken;
  // so is being sent back to the login screen you just came through.
  const usable = Boolean(back) && back !== current && !avoided.includes(back);

  const path = usable ? back : parentPath;

  return {
    path,
    label: titleFor(path) || 'Back',
    // Prefer history over a push even though both land in the same place: a
    // real back keeps the forward entry and restores the scroll position the
    // router already saved for it.
    useBack: usable
  };
}

/**
 * Follow a target produced by `navigationTarget`. Prefers real history so the
 * forward entry and the saved scroll position survive.
 */
export function followNavigationTarget (router, target) {
  if (!router || !target) return;
  if (target.useBack) {
    router.back();
  } else {
    router.push(target.path);
  }
}

/** The common case: work out where back goes for a route, and go there. */
export function goBackFrom (router, route, { avoid = ['/login'] } = {}) {
  const target = navigationTarget({
    backPath: router.options?.history?.state?.back,
    currentPath: route?.fullPath,
    parentPath: route?.meta?.parent || '/',
    titleFor: (path) => router.resolve(path)?.meta?.title,
    avoid
  });
  followNavigationTarget(router, target);
  return target;
}

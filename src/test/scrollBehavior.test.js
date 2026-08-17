import { describe, it, expect, beforeEach } from 'vitest';
import {
  appScrollBehavior,
  shouldRestoreHomeScroll,
  rememberNavigationSource,
  arrivedFromMovieDetail,
  resetNavigationSource
} from '@/router/scrollBehavior.js';

// Pure functions, so they're testable without importing the real router
// (which pulls in store/index.js and initialises Firebase at module load).
describe('appScrollBehavior', () => {
  const TOP = { top: 0, behavior: 'instant' };

  // "I would like to enforce a blanket policy that whenever you navigate to a
  // new page, it should scroll to the top." (2026-08-17)
  it('scrolls to the top on every ordinary navigation', () => {
    [
      ['/insights', '/'],
      ['/movie/123', '/'],
      ['/games/wordle', '/games'],
      ['/games', '/'],
      ['/trophy-case', '/movie/5'],
      ['/watchlist', '/insights'],
      ['/year-in-review', '/stats'],
      ['/film-club', '/'],
      ['/rate-movie', '/movie/9']
    ].forEach(([to, from]) => {
      expect(appScrollBehavior({ path: to }, { path: from })).toEqual(TOP);
    });
  });

  // The one exception, in Matt's words: "if you start on the Home Screen,
  // click a poster to go to a movie detail page, and then click back, it
  // should return you to where it was scrolled on the home page."
  it('leaves Home alone when you come back from a movie detail page', () => {
    expect(appScrollBehavior({ path: '/' }, { path: '/movie/197' })).toBe(false);
  });

  // The exception is exactly that narrow. Reaching Home any other way is an
  // ordinary navigation and gets the top of the page.
  it('scrolls Home to the top when you arrive from anywhere else', () => {
    ['/insights', '/games', '/trophy-case', '/watchlist', '/film-club', '/stats'].forEach((from) => {
      expect(appScrollBehavior({ path: '/' }, { path: from })).toEqual(TOP);
    });
  });

  it('scrolls to the top on a fresh load, where there is no previous route', () => {
    expect(appScrollBehavior({ path: '/' }, undefined)).toEqual(TOP);
    expect(appScrollBehavior({ path: '/' }, {})).toEqual(TOP);
  });

  // Regression guard for a live-verified failure: without behavior:'instant'
  // the app's `scroll-behavior: smooth` on <html> makes the resulting
  // window.scrollTo a silent no-op, so an earlier cut of this shipped doing
  // nothing at all. See the module's own comment.
  it("always requests 'instant' - CSS smooth scrolling makes the default a no-op here", () => {
    expect(appScrollBehavior({ path: '/games/timeline' }, { path: '/' }).behavior).toBe('instant');
  });

  it('does not throw on a missing or malformed target', () => {
    expect(appScrollBehavior(undefined, undefined)).toEqual(TOP);
    expect(appScrollBehavior({}, {})).toEqual(TOP);
  });
});

describe('shouldRestoreHomeScroll', () => {
  it('is true only for Home reached from a movie detail page', () => {
    expect(shouldRestoreHomeScroll({ path: '/' }, { path: '/movie/1' })).toBe(true);
    expect(shouldRestoreHomeScroll({ path: '/' }, { path: '/insights' })).toBe(false);
    expect(shouldRestoreHomeScroll({ path: '/insights' }, { path: '/movie/1' })).toBe(false);
  });
});

// `from` is only readable in a navigation guard, which runs before the target
// component mounts; scrollBehavior runs after it. Home needs the answer in
// mounted(), so the guard records it.
describe('navigation source recording', () => {
  beforeEach(() => resetNavigationSource());

  it('starts false, so a cold load never restores a stale position', () => {
    expect(arrivedFromMovieDetail()).toBe(false);
  });

  it('remembers a return to Home from a movie detail page', () => {
    rememberNavigationSource({ path: '/' }, { path: '/movie/197' });
    expect(arrivedFromMovieDetail()).toBe(true);
  });

  it('clears once you navigate to Home any other way', () => {
    rememberNavigationSource({ path: '/' }, { path: '/movie/197' });
    rememberNavigationSource({ path: '/' }, { path: '/insights' });
    expect(arrivedFromMovieDetail()).toBe(false);
  });
});

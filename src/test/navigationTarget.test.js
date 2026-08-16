import { describe, it, expect, vi } from 'vitest';
import { navigationTarget, pathOf, goBackFrom } from '@/utils/navigationTarget.js';

// Matt, 2026-08-16: "our navigation within the app is a bit scattershot...
// sometimes you land somewhere from a place, but then the button that you
// think might take you back actually takes you home instead of back."

const TITLES = {
  '/': 'Home',
  '/insights': 'Insights',
  '/games': 'Games',
  '/film-club': 'Film Club'
};
const titleFor = (path) => TITLES[path];

describe('pathOf', () => {
  it('discards query and hash so /awards?year=1997 matches /awards', () => {
    expect(pathOf('/awards?year=1997')).toBe('/awards');
    expect(pathOf('/movie/42#cast')).toBe('/movie/42');
    expect(pathOf('/insights')).toBe('/insights');
  });

  it('is null-safe', () => {
    expect(pathOf(null)).toBe('');
    expect(pathOf(undefined)).toBe('');
    expect(pathOf(42)).toBe('');
  });
});

describe('navigationTarget', () => {
  it('returns where you came from, named', () => {
    const target = navigationTarget({
      backPath: '/insights',
      currentPath: '/games/stats',
      parentPath: '/games',
      titleFor
    });

    expect(target).toEqual({ path: '/insights', label: 'Insights', useBack: true });
  });

  // Deep link, cold PWA launch, hard refresh — history.state.back is null.
  it('falls back to the declared parent when there is no history', () => {
    const target = navigationTarget({
      backPath: null,
      currentPath: '/games/stats',
      parentPath: '/games',
      titleFor
    });

    expect(target).toEqual({ path: '/games', label: 'Games', useBack: false });
  });

  // The awards year strip replaces the route as you step through years, so
  // "back" can end up pointing at the page you're already on.
  it('ignores a back entry that is the page you are already looking at', () => {
    const target = navigationTarget({
      backPath: '/awards?year=1997',
      currentPath: '/awards?year=2001',
      parentPath: '/insights',
      titleFor
    });

    expect(target.useBack).toBe(false);
    expect(target.path).toBe('/insights');
  });

  it('never sends you back through the login screen', () => {
    const target = navigationTarget({
      backPath: '/login',
      currentPath: '/',
      parentPath: '/',
      titleFor,
      avoid: ['/login']
    });

    expect(target.useBack).toBe(false);
    expect(target.label).toBe('Home');
  });

  it('says "Back" rather than nothing when a route has no title', () => {
    const target = navigationTarget({
      backPath: '/somewhere-unnamed',
      currentPath: '/games',
      titleFor: () => undefined
    });

    expect(target.label).toBe('Back');
  });

  it('defaults the parent to Home', () => {
    expect(navigationTarget({ backPath: null, currentPath: '/games' }).path).toBe('/');
  });
});

describe('goBackFrom', () => {
  function router (back) {
    return {
      back: vi.fn(),
      push: vi.fn(),
      options: { history: { state: { back } } },
      resolve: (path) => ({ meta: { title: TITLES[path] } })
    };
  }

  it('uses history when there is history', () => {
    const instance = router('/film-club');
    const route = { fullPath: '/film-club/brian', meta: { parent: '/film-club' } };

    const target = goBackFrom(instance, route);

    expect(instance.back).toHaveBeenCalled();
    expect(instance.push).not.toHaveBeenCalled();
    expect(target.label).toBe('Film Club');
  });

  it('pushes the parent when there is none', () => {
    const instance = router(null);
    const route = { fullPath: '/film-club/brian', meta: { parent: '/film-club' } };

    goBackFrom(instance, route);

    expect(instance.push).toHaveBeenCalledWith('/film-club');
    expect(instance.back).not.toHaveBeenCalled();
  });
});

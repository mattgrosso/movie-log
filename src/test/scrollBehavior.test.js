import { describe, it, expect } from 'vitest';
import { gameAwareScrollBehavior } from '@/router/scrollBehavior.js';

// Pure function, so it's testable without importing the real router (which
// pulls in store/index.js and initialises Firebase at module load).
describe('gameAwareScrollBehavior', () => {
  it('scrolls to the top when entering the games hub', () => {
    expect(gameAwareScrollBehavior({ path: '/games' })).toEqual({ top: 0 });
  });

  it('scrolls to the top when entering any individual game', () => {
    ['/games/wordle', '/games/six-degrees', '/games/trivia', '/games/clue-budget'].forEach((path) => {
      expect(gameAwareScrollBehavior({ path })).toEqual({ top: 0 });
    });
  });

  // Everything else keeps the app's pre-existing behaviour of not touching
  // the scroll position - most importantly Home, which restores its own
  // (returning from a movie detail page puts you back in the grid).
  it('leaves every other route alone, including Home and movie detail', () => {
    ['/', '/insights', '/movie/123', '/rate-movie', '/trophy-case'].forEach((path) => {
      expect(gameAwareScrollBehavior({ path })).toBe(false);
    });
  });

  it('does not throw on a missing or malformed target', () => {
    expect(gameAwareScrollBehavior(undefined)).toBe(false);
    expect(gameAwareScrollBehavior({})).toBe(false);
  });
});

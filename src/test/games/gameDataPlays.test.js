import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import gameDataMixin from '@/mixins/gameData.js';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 5 }))
}));

// A bare component carrying only the mixin — recordGamePlay fires from the
// mixin's own created(), so this exercises exactly what every real game
// inherits without dragging in any one game's UI.
const DummyGame = { name: 'DummyGame', mixins: [gameDataMixin], template: '<div/>' };

function mountAt (path, settings = {}, dispatch = vi.fn()) {
  return mount(DummyGame, {
    global: {
      mocks: {
        $store: { state: { settings }, getters: { allMediaAsArray: [] }, dispatch },
        $route: { path }
      }
    }
  });
}

describe('gameData.recordGamePlay (bug report: order the games menu by sessions played)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('records the first visit to a game as one play session', () => {
    const dispatch = vi.fn();
    mountAt('/games/timeline', {}, dispatch);
    expect(dispatch).toHaveBeenCalledWith('writeDurably', { path: 'settings/games/plays/timeline', value: 1 });
  });

  it('increments an existing count by exactly one per mount', () => {
    const dispatch = vi.fn();
    mountAt('/games/timeline', { games: { plays: { timeline: 7 } } }, dispatch);
    expect(dispatch).toHaveBeenCalledWith('writeDurably', { path: 'settings/games/plays/timeline', value: 8 });
  });

  it('does not count visiting the hub itself', () => {
    const dispatch = vi.fn();
    mountAt('/games', {}, dispatch);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('no-ops without a route (most game tests mount without one)', () => {
    const dispatch = vi.fn();
    mount(DummyGame, {
      global: { mocks: { $store: { state: { settings: {} }, getters: { allMediaAsArray: [] }, dispatch } } }
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('tolerates a mock store with no dispatch at all', () => {
    expect(() => mount(DummyGame, {
      global: {
        mocks: {
          $store: { state: {}, getters: { allMediaAsArray: [] } },
          $route: { path: '/games/wordle' }
        }
      }
    })).not.toThrow();
  });
});

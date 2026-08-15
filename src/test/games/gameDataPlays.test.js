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

describe('gameData.recordGameRound (feature: per-game history with statistics)', () => {
  it('appends a timestamped record with the game\'s own metrics', () => {
    const dispatch = vi.fn();
    const wrapper = mountAt('/games/clue-budget', { games: { history: { 'clue-budget': [{ at: 1, won: false, saved: 0 }] } } }, dispatch);
    dispatch.mockClear();

    wrapper.vm.recordGameRound({ won: true, saved: 40 });

    const call = dispatch.mock.calls.find(([, entry]) => entry.path === 'settings/games/history/clue-budget');
    expect(call).toBeTruthy();
    const written = call[1].value;
    expect(written).toHaveLength(2);
    expect(written[1]).toMatchObject({ won: true, saved: 40 });
    expect(written[1].at).toEqual(expect.any(Number));
  });

  it('caps the stored history at 50 records', () => {
    const dispatch = vi.fn();
    const long = Array.from({ length: 50 }, (_, i) => ({ at: i }));
    const wrapper = mountAt('/games/timeline', { games: { history: { timeline: long } } }, dispatch);
    dispatch.mockClear();

    wrapper.vm.recordGameRound({ streak: 9 });

    const call = dispatch.mock.calls.find(([, entry]) => entry.path === 'settings/games/history/timeline');
    expect(call[1].value).toHaveLength(50);
    expect(call[1].value[49]).toMatchObject({ streak: 9 });
    expect(call[1].value[0].at).toBe(1);
  });

  it('no-ops without a route, same as the other recorders', () => {
    const dispatch = vi.fn();
    const wrapper = mount(DummyGame, {
      global: { mocks: { $store: { state: { settings: {} }, getters: { allMediaAsArray: [] }, dispatch } } }
    });
    dispatch.mockClear();
    wrapper.vm.recordGameRound({ streak: 1 });
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('recorders defer until real settings load (bug: an at-mount write hid the Insights awards pane and read empty counters)', () => {
  it('holds the play write while settingsLoaded is false, then records against the REAL counter once loaded', async () => {
    const { reactive } = await import('vue');
    const dispatch = vi.fn();
    const state = reactive({ settings: {}, settingsLoaded: false });
    const wrapper = mount(DummyGame, {
      global: { mocks: { $store: { state, getters: { allMediaAsArray: [] }, dispatch }, $route: { path: '/games/timeline' } } }
    });

    expect(dispatch).not.toHaveBeenCalled(); // deferred, not dropped

    // Real settings arrive with an existing counter, THEN the write fires.
    state.settings = { games: { plays: { timeline: 7 } } };
    state.settingsLoaded = true;
    await wrapper.vm.$nextTick();

    expect(dispatch).toHaveBeenCalledWith('writeDurably', { path: 'settings/games/plays/timeline', value: 8 });
  });

  it('records immediately when the store has no settingsLoaded field at all (mock stores, older tests)', () => {
    const dispatch = vi.fn();
    mountAt('/games/timeline', {}, dispatch);
    expect(dispatch).toHaveBeenCalledWith('writeDurably', { path: 'settings/games/plays/timeline', value: 1 });
  });
});

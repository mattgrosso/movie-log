import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import GameStatsScreen from '@/components/games/GameStatsScreen.vue';

function factory (games = {}, { back = null } = {}) {
  const pushSpy = vi.fn();
  const backSpy = vi.fn();
  const wrapper = mount(GameStatsScreen, {
    global: {
      mocks: {
        $store: { state: { settings: { games } }, dispatch: vi.fn(), commit: vi.fn() },
        $router: {
          push: pushSpy,
          back: backSpy,
          options: { history: { state: { back } } },
          resolve: (path) => ({ meta: { title: path === '/insights' ? 'Insights' : 'Games' } })
        },
        $route: { path: '/games/stats', fullPath: '/games/stats', meta: { parent: '/games' } }
      }
    }
  });
  return { wrapper, pushSpy, backSpy };
}

// Feature request: "add a history for each game with some good statistics
// on how they've gone."
describe('GameStatsScreen', () => {
  it('shows an empty state before any round has been recorded', () => {
    const { wrapper } = factory({});
    expect(wrapper.find('.no-stats').exists()).toBe(true);
    expect(wrapper.findAll('.game-stats-card')).toHaveLength(0);
  });

  it('renders a card per game with data — stats lines plus a newest-first recent-rounds strip', () => {
    const { wrapper } = factory({
      plays: { 'clue-budget': 6 },
      history: {
        'clue-budget': [
          { at: 1, won: false, saved: 0 },
          { at: 2, won: true, saved: 40 }
        ]
      }
    });

    const card = wrapper.find('.game-stats-card');
    expect(card.text()).toContain('Clue Budget');
    expect(card.text()).toContain('6 sessions');
    expect(card.text()).toContain('Win rate');
    expect(card.text()).toContain('50%');

    const chips = card.findAll('.round-chip').map((chip) => chip.text());
    expect(chips).toEqual(['won · $40 left', 'broke']); // newest first
  });

  it('a game with sessions but no recorded rounds yet explains itself instead of showing nothing', () => {
    const { wrapper } = factory({ plays: { wordle: 3 } });

    const card = wrapper.find('.game-stats-card');
    expect(card.text()).toContain('Reel Wordle');
    expect(card.find('.game-stats-pending').exists()).toBe(true);
  });

  it('orders cards most-played first and hides untouched games entirely', () => {
    const { wrapper } = factory({
      plays: { stamp: 2, timeline: 9 },
      history: {}
    });

    const names = wrapper.findAll('.game-stats-name').map((el) => el.text());
    expect(names).toEqual(['Timeline', 'Stamp']);
  });

  it('falls back to the games hub when there is no history', async () => {
    const { wrapper, pushSpy } = factory({});
    await wrapper.find('.back-link').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/games');
  });

  // This screen is linked from Insights as well as from Games, and the link
  // used to say "Games" and go there either way (Matt, 2026-08-16).
  it('returns to Insights when that is where you came from', async () => {
    const { wrapper, backSpy, pushSpy } = factory({}, { back: '/insights' });

    expect(wrapper.find('.back-link').text()).toBe('Insights');
    await wrapper.find('.back-link').trigger('click');
    expect(backSpy).toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });
});

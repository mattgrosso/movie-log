import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import GamesHub from '@/components/games/GamesHub.vue';
import { LAST_PLAYED_KEY } from '@/mixins/gameData.js';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 5 }))
}));

function entry (id) {
  return {
    dbKey: `key-${id}`,
    ratings: [{ calculatedTotal: 5 }],
    movie: { id, title: `Movie ${id}`, poster_path: '/p.jpg', release_date: '2010-01-01' }
  };
}

function factory (movieCount) {
  const pushSpy = vi.fn();
  const wrapper = mount(GamesHub, {
    global: {
      mocks: {
        $store: { getters: { allMediaAsArray: Array.from({ length: movieCount }, (_, i) => entry(i)) } },
        $router: { push: pushSpy }
      }
    }
  });
  return { wrapper, pushSpy };
}

describe('GamesHub', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('clears the "last played game" record on mount (bug report: backing out to the hub should reset it)', () => {
    window.localStorage.setItem(LAST_PLAYED_KEY, '/games/wordle');
    factory(10);
    expect(window.localStorage.getItem(LAST_PLAYED_KEY)).toBeNull();
  });

  it('shows a gate message when the library is too small', () => {
    const { wrapper } = factory(2);
    expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
    expect(wrapper.findAll('.game-tile').length).toBe(0);
  });

  it('lists all games once there is enough data', () => {
    const { wrapper } = factory(10);
    expect(wrapper.findAll('.game-tile').length).toBe(4);
  });

  it('navigates to the chosen game route on tap', async () => {
    const { wrapper, pushSpy } = factory(10);
    await wrapper.findAll('.game-tile')[0].trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/games/higher-lower');
  });
});

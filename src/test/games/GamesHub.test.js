import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import GamesHub from '@/components/games/GamesHub.vue';
import { LAST_PLAYED_KEY } from '@/mixins/gameData.js';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 5 }))
}));

// The "not enough movies" gate now renders NewRatingSearch (suggestionsMode),
// which fetches TMDB popular movies in its own mounted() hook.
vi.mock('axios', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { results: [] } })) }
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

  it('offers "help me get started" quick-pick suggestions on the gate (bug report: no way forward for a new user)', () => {
    const { wrapper } = factory(2);
    // NewRatingSearch renders its own loading spinner synchronously before
    // the (mocked) TMDB fetch resolves - just confirm the component mounted
    // inside the gate rather than asserting on its post-fetch content.
    expect(wrapper.find('.not-enough-movies .new-rating-search').exists()).toBe(true);
  });

  it('lists all games once there is enough data', () => {
    const { wrapper } = factory(10);
    expect(wrapper.findAll('.game-tile').length).toBe(6);
  });

  it('navigates to the chosen game route on tap', async () => {
    const { wrapper, pushSpy } = factory(10);
    await wrapper.findAll('.game-tile')[0].trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/games/higher-lower');
  });

  it('scrolls to top before navigating (bug report: chosen game kept the hub\'s scroll position)', async () => {
    const { wrapper } = factory(10);
    await wrapper.findAll('.game-tile')[0].trigger('click');
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });
});

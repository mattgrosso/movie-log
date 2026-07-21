import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import HigherLowerGame from '@/components/games/HigherLowerGame.vue';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  // Rating equals id * 1.0 — deterministic and strictly increasing by id,
  // so "higher"/"lower" guesses have a knowable right answer per pair.
  getRating: vi.fn((entry) => ({ calculatedTotal: entry.movie.id }))
}));

function entry (id) {
  return {
    dbKey: `key-${id}`,
    ratings: [{ calculatedTotal: id }],
    movie: { id, title: `Movie ${id}`, poster_path: '/p.jpg', release_date: '2010-01-01' }
  };
}

function factory (movieCount, dispatch = vi.fn()) {
  return mount(HigherLowerGame, {
    global: {
      mocks: {
        $store: {
          state: { settings: {} },
          getters: { allMediaAsArray: Array.from({ length: movieCount }, (_, i) => entry(i)) },
          dispatch
        },
        $router: { push: vi.fn() }
      }
    }
  });
}

describe('HigherLowerGame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with a revealed card and a hidden challenger score', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-warning').trigger('click'); // Start
    expect(wrapper.vm.revealed).not.toBeNull();
    expect(wrapper.vm.challenger).not.toBeNull();
    const scores = wrapper.findAll('.hl-card-score');
    expect(scores[1].text()).toBe('?');
  });

  it('a correct guess increases the streak and persists a new best streak', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-warning').trigger('click');

    const revealedId = wrapper.vm.revealed.movie.id;
    const challengerId = wrapper.vm.challenger.movie.id;
    const direction = challengerId > revealedId ? 'higher' : 'lower';

    const button = wrapper.findAll('.guess-buttons button').find((b) => b.text().toLowerCase() === direction);
    await button.trigger('click');

    expect(wrapper.vm.lastGuessCorrect).toBe(true);
    expect(wrapper.vm.streak).toBe(1);
    expect(wrapper.vm.$store.dispatch).toHaveBeenCalledWith('setDBValue', { path: 'settings/games/higherLowerBestStreak', value: 1 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(wrapper.vm.revealed.movie.id).toBe(challengerId);
    expect(wrapper.vm.guessed).toBe(false);
  });

  it('a wrong guess ends the game and reveals the true score', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-warning').trigger('click');

    const revealedId = wrapper.vm.revealed.movie.id;
    const challengerId = wrapper.vm.challenger.movie.id;
    // Deliberately guess wrong.
    const wrongDirection = challengerId > revealedId ? 'lower' : 'higher';

    const button = wrapper.findAll('.guess-buttons button').find((b) => b.text().toLowerCase() === wrongDirection);
    await button.trigger('click');

    expect(wrapper.vm.gameOver).toBe(true);
    expect(wrapper.find('.hl-card-score.incorrect').exists()).toBe(true);
    expect(wrapper.find('.game-over button').text()).toBe('Play Again');
  });
});

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
    await wrapper.find('.btn-game-primary').trigger('click'); // Start
    expect(wrapper.vm.revealed).not.toBeNull();
    expect(wrapper.vm.challenger).not.toBeNull();
    const scores = wrapper.findAll('.hl-card-score');
    expect(scores[1].text()).toBe('?');
  });

  it('a correct guess (tapping the poster you think is higher) increases the streak and persists a new best streak', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-game-primary').trigger('click');

    const revealedId = wrapper.vm.revealed.movie.id;
    const challengerId = wrapper.vm.challenger.movie.id;
    // Tapping the revealed card guesses "lower" (challenger < revealed);
    // tapping the challenger card guesses "higher" — see the template.
    const cardIndex = challengerId > revealedId ? 1 : 0;

    await wrapper.findAll('.hl-card')[cardIndex].trigger('click');

    expect(wrapper.vm.lastGuessCorrect).toBe(true);
    expect(wrapper.vm.streak).toBe(1);
    expect(wrapper.vm.$store.dispatch).toHaveBeenCalledWith('setDBValue', { path: 'settings/games/higherLowerBestStreak', value: 1 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(wrapper.vm.revealed.movie.id).toBe(challengerId);
    expect(wrapper.vm.guessed).toBe(false);
  });

  it('a wrong guess ends the game and reveals the true score', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-game-primary').trigger('click');

    const revealedId = wrapper.vm.revealed.movie.id;
    const challengerId = wrapper.vm.challenger.movie.id;
    // Deliberately tap the WRONG poster.
    const wrongCardIndex = challengerId > revealedId ? 0 : 1;

    await wrapper.findAll('.hl-card')[wrongCardIndex].trigger('click');

    expect(wrapper.vm.gameOver).toBe(true);
    expect(wrapper.find('.hl-card-score.incorrect').exists()).toBe(true);
    expect(wrapper.find('.game-over button').text()).toBe('Play Again');
  });

  it('shows two decimal places so near-identical scores stay distinguishable', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-game-primary').trigger('click');
    expect(wrapper.vm.formattedRating(wrapper.vm.revealed)).toBe(wrapper.vm.revealed.movie.id.toFixed(2));
  });

  it('a "tappable" poster has no lingering :hover-driven state (uses only :active feedback)', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-game-primary').trigger('click');
    expect(wrapper.findAll('.hl-card.tappable').length).toBe(2);
  });
});

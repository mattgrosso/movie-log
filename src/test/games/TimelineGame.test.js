import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import TimelineGame from '@/components/games/TimelineGame.vue';
import { isValidPlacement, correctSlotIndex } from '@/assets/javascript/games/timeline.js';

// Distinct, mid-month years so shuffled pool order never produces an
// accidental tie between the two initial timeline slots — see CLAUDE.md's
// documented Jan-1/UTC test pitfall for why mid-month dates are used.
function entry (id, year) {
  return {
    dbKey: `key-${id}`,
    ratings: [{ calculatedTotal: 5 }],
    movie: { id, title: `Movie ${id}`, poster_path: '/p.jpg', release_date: `${year}-06-15` }
  };
}

function factory (movies, dispatch = vi.fn()) {
  return mount(TimelineGame, {
    global: {
      mocks: {
        $store: {
          state: { settings: {} },
          getters: { allMediaAsArray: movies },
          dispatch,
          commit: vi.fn()
        },
        $router: { push: vi.fn() }
      }
    }
  });
}

function tenMovies () {
  return Array.from({ length: 10 }, (_, i) => entry(i, 1970 + i * 5));
}

describe('TimelineGame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a not-enough-movies message when the library is small', () => {
    const wrapper = factory(Array.from({ length: 3 }, (_, i) => entry(i, 2000 + i)));
    expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
  });

  it('starts with one seed card already on the timeline and a distinct mystery card', async () => {
    const wrapper = factory(tenMovies());
    await wrapper.find('.btn-game-primary').trigger('click');

    expect(wrapper.vm.timeline).toHaveLength(1);
    expect(wrapper.vm.mysteryCard).toBeTruthy();
    expect(wrapper.vm.mysteryCard.dbKey).not.toBe(wrapper.vm.timeline[0].dbKey);
    // Year hidden until guessed.
    expect(wrapper.find('.mystery-year').text()).toBe('?');
  });

  it('a correct guess inserts the card into the timeline, grows the streak, and persists a new best', async () => {
    const wrapper = factory(tenMovies());
    await wrapper.find('.btn-game-primary').trigger('click');

    const correctSlot = correctSlotIndex(wrapper.vm.timeline, wrapper.vm.mysteryCard);
    const gaps = wrapper.findAll('.timeline-gap');
    await gaps[correctSlot].trigger('click');

    expect(wrapper.vm.lastGuessCorrect).toBe(true);
    expect(wrapper.vm.revealed).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);

    expect(wrapper.vm.timeline).toHaveLength(2);
    expect(wrapper.vm.streak).toBe(1);
    expect(wrapper.vm.mysteryCard).toBeTruthy();
    expect(wrapper.vm.revealed).toBe(false);
    expect(wrapper.vm.$store.dispatch).toHaveBeenCalledWith('setDBValue', { path: 'settings/games/timelineBestStreak', value: 1 });
  });

  it('an incorrect guess ends the game, reveals the true year, and highlights where it actually belonged', async () => {
    const wrapper = factory(tenMovies());
    await wrapper.find('.btn-game-primary').trigger('click');

    // With exactly one seed card there are two slots (0 and 1) — find the
    // WRONG one (distinct years guarantee exactly one of the two is wrong).
    const wrongSlot = [0, 1].find((slot) => !isValidPlacement(wrapper.vm.timeline, slot, wrapper.vm.mysteryCard));
    const gaps = wrapper.findAll('.timeline-gap');
    await gaps[wrongSlot].trigger('click');

    expect(wrapper.vm.gameOver).toBe(true);
    expect(wrapper.vm.lastGuessCorrect).toBe(false);
    expect(wrapper.find('.mystery-year.incorrect').exists()).toBe(true);
    expect(wrapper.text()).toContain('Not quite');

    const correctSlot = correctSlotIndex(wrapper.vm.timeline, wrapper.vm.mysteryCard);
    expect(gaps[correctSlot].classes()).toContain('correct-gap');

    // Game over — no further guesses accepted, and no incorrect state
    // shouldn't have touched the best-streak dispatch.
    expect(wrapper.vm.$store.dispatch).not.toHaveBeenCalledWith('setDBValue', expect.objectContaining({ path: 'settings/games/timelineBestStreak' }));
  });

  it('"Play Again" resets the streak and starts a fresh timeline', async () => {
    const wrapper = factory(tenMovies());
    await wrapper.find('.btn-game-primary').trigger('click');
    const wrongSlot = [0, 1].find((slot) => !isValidPlacement(wrapper.vm.timeline, slot, wrapper.vm.mysteryCard));
    await wrapper.findAll('.timeline-gap')[wrongSlot].trigger('click');
    expect(wrapper.vm.gameOver).toBe(true);

    await wrapper.find('.game-over .btn-game-primary').trigger('click');

    expect(wrapper.vm.gameOver).toBe(false);
    expect(wrapper.vm.streak).toBe(0);
    expect(wrapper.vm.timeline).toHaveLength(1);
  });

  it('treats a tie year as a correct placement on either side of the matching boundary', async () => {
    const wrapper = factory(tenMovies());
    await wrapper.find('.btn-game-primary').trigger('click');

    // Force a deterministic tie scenario directly, bypassing the random
    // shuffle — timeline logic itself (including ties) is covered
    // exhaustively in timeline.test.js; this just guards the component
    // actually accepts what isValidPlacement says is valid.
    wrapper.vm.timeline = [entry('a', 2000)];
    wrapper.vm.mysteryCard = entry('b', 2000);
    await wrapper.vm.$nextTick();

    await wrapper.findAll('.timeline-gap')[0].trigger('click');
    expect(wrapper.vm.lastGuessCorrect).toBe(true);
  });

  it('ends the game with a positive message after placing the whole library', async () => {
    // Exactly the minimum library size (5) so the run can end on the very
    // last card without an unbounded number of guesses in the test.
    const wrapper = factory(Array.from({ length: 5 }, (_, i) => entry(i, 1970 + i * 10)));
    await wrapper.find('.btn-game-primary').trigger('click');

    for (let i = 0; i < 4; i++) {
      if (wrapper.vm.gameOver) break;
      const slot = correctSlotIndex(wrapper.vm.timeline, wrapper.vm.mysteryCard);
      await wrapper.findAll('.timeline-gap')[slot].trigger('click');
      await vi.advanceTimersByTimeAsync(1000);
    }

    expect(wrapper.vm.ranOutOfMovies).toBe(true);
    expect(wrapper.vm.gameOver).toBe(true);
    expect(wrapper.text()).toContain("You've placed your whole library!");
  });
});

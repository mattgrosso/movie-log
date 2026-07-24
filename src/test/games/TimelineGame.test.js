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
    // No title/year text under the mystery card — just the poster (bug
    // report: "lose the title... and the question mark from below it").
    expect(wrapper.find('.mystery-title').exists()).toBe(false);
    expect(wrapper.find('.mystery-year').exists()).toBe(false);
    expect(wrapper.find('.mystery-card').classes()).not.toContain('correct');
    expect(wrapper.find('.mystery-card').classes()).not.toContain('incorrect');
    // The timeline row renders before the mystery card in the DOM (bug
    // report: "have the actual streak we're building be above the card").
    const html = wrapper.html();
    expect(html.indexOf('timeline-row')).toBeLessThan(html.indexOf('mystery-card'));
  });

  it('a correct guess inserts the card into the timeline, grows the streak, and persists a new best', async () => {
    const wrapper = factory(tenMovies());
    await wrapper.find('.btn-game-primary').trigger('click');

    const correctSlot = correctSlotIndex(wrapper.vm.timeline, wrapper.vm.mysteryCard);
    const gaps = wrapper.findAll('.timeline-gap');
    await gaps[correctSlot].trigger('click');

    expect(wrapper.vm.lastGuessCorrect).toBe(true);
    expect(wrapper.vm.revealed).toBe(true);
    expect(wrapper.find('.mystery-card').classes()).toContain('correct');

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
    expect(wrapper.find('.mystery-card').classes()).toContain('incorrect');
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

  it('shows a compact streak/best line rather than a prominent top row (bug report: "we don\'t need the streak and best to be the top item")', async () => {
    const wrapper = factory(tenMovies());
    await wrapper.find('.btn-game-primary').trigger('click');

    expect(wrapper.find('.streak-row').exists()).toBe(false);
    expect(wrapper.find('.streak-line').text()).toBe('Streak 0 · Best 0');
    // The status line (not the streak line) is the first thing rendered.
    const html = wrapper.html();
    expect(html.indexOf('status-line')).toBeLessThan(html.indexOf('streak-line'));
  });

  describe('custom header banner (a graphic made for this game, same pattern as the other 4)', () => {
    it('sets the header banner to the custom graphic and hides the "Cinema Roll" logo on mount', () => {
      const wrapper = factory(tenMovies());
      const lastBannerCall = wrapper.vm.$store.commit.mock.calls.find((call) => call[0] === 'setBannerUrl');
      expect(lastBannerCall[1]).toContain('timeline-banner');
      expect(wrapper.vm.$store.commit).toHaveBeenCalledWith('setHideHeaderLogo', true);
    });

    it('restores the previous banner and un-hides the logo on unmount', () => {
      const store = {
        state: { settings: {}, bannerUrl: 'https://example.com/some-movie-backdrop.jpg' },
        getters: { allMediaAsArray: tenMovies() },
        dispatch: vi.fn(),
        commit: vi.fn()
      };
      const wrapper = mount(TimelineGame, { global: { mocks: { $store: store, $router: { push: vi.fn() } } } });
      wrapper.unmount();

      const calls = store.commit.mock.calls.filter((call) => call[0] === 'setBannerUrl');
      expect(calls[calls.length - 1][1]).toBe('https://example.com/some-movie-backdrop.jpg');
      expect(store.commit).toHaveBeenCalledWith('setHideHeaderLogo', false);
    });
  });
});

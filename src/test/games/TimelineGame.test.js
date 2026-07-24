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
    // A safety net, not just the per-test cleanup below — if a test in the
    // describe block below fails partway through (an assertion throws),
    // its own trailing vi.restoreAllMocks() never runs, leaking the
    // stubbed getBoundingClientRect into whatever test runs next in the
    // same file/worker.
    vi.restoreAllMocks();
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

  describe('the 3-step placement animation (bug report: "slide into the space of the plus sign slot, once it\'s there... expand out... then... the two new plus sign slots grow")', () => {
    // jsdom reports every element's geometry as zero by default — the
    // fromRect/toRect guard in guess() already covers that (exercised
    // implicitly by every other passing test above, where the whole
    // animated branch is skipped). Stub real, DIFFERING rects here
    // specifically to exercise the sequence: the mystery card (large,
    // bottom of the page) as the "from" position vs. the tapped gap
    // (small, up in the timeline row) as the "to" position.
    function stubRects () {
      const mysteryRect = { width: 143, height: 214, left: 100, top: 500 };
      const gapRect = { width: 34, height: 126, left: 20, top: 200 };
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
        return this.classList.contains('mystery-card') ? mysteryRect : gapRect;
      });
      return { mysteryRect, gapRect };
    }

    it('step 1: slides+shrinks a clone from the mystery card to the tapped gap\'s own position, hiding the real mystery card the whole sequence', async () => {
      const wrapper = factory(tenMovies());
      await wrapper.find('.btn-game-primary').trigger('click');
      const { mysteryRect, gapRect } = stubRects();

      const correctSlot = correctSlotIndex(wrapper.vm.timeline, wrapper.vm.mysteryCard);
      await wrapper.findAll('.timeline-gap')[correctSlot].trigger('click');

      // After the pre-flight pause, the flying clone exists at the
      // mystery card's OWN rect (not yet moved), with no transition —
      // and the real mystery-card is already hidden for the whole
      // sequence, not just this first step.
      await vi.advanceTimersByTimeAsync(400);
      expect(wrapper.vm.isPlacing).toBe(true);
      expect(wrapper.vm.flyingCard).toBeTruthy();
      expect(wrapper.vm.flyingCardAnimating).toBe(false);
      expect(wrapper.find('.mystery-card').exists()).toBe(false);
      expect(wrapper.find('.flying-card').exists()).toBe(true);
      expect(wrapper.vm.flyingCard.style.left).toBe(`${mysteryRect.left}px`);
      expect(wrapper.vm.flyingCard.style.top).toBe(`${mysteryRect.top}px`);

      // Two animation frames later (needed to guarantee a real committed
      // paint of the "from" state before flipping — a single forced
      // reflow isn't reliable enough for an element set up this same
      // tick), it flips to the gap's rect WITH the animating class,
      // which is what actually drives the CSS transition.
      await vi.advanceTimersByTimeAsync(50);
      expect(wrapper.vm.flyingCard.style.left).toBe(`${gapRect.left}px`);
      expect(wrapper.vm.flyingCard.style.top).toBe(`${gapRect.top}px`);
      expect(wrapper.vm.flyingCardAnimating).toBe(true);

      vi.restoreAllMocks();
    });

    it('step 2: once seated, the clone is replaced by the poster living INSIDE the real tapped gap, which then widens to the full card size', async () => {
      const wrapper = factory(tenMovies());
      await wrapper.find('.btn-game-primary').trigger('click');
      stubRects();

      const correctSlot = correctSlotIndex(wrapper.vm.timeline, wrapper.vm.mysteryCard);
      await wrapper.findAll('.timeline-gap')[correctSlot].trigger('click');

      // Advanced in checkpoints (pre-pause, then the step-1 flip's two
      // rAFs, then the full step-1 wait) rather than one combined sum —
      // landing a single big jump exactly on a boundary where a fired
      // timer's continuation immediately schedules new rAFs is a real
      // flakiness risk; separate calls give the fake-timer queue a chance
      // to fully settle between each.
      await vi.advanceTimersByTimeAsync(400);
      await vi.advanceTimersByTimeAsync(50);
      await vi.advanceTimersByTimeAsync(wrapper.vm.stepDurationMs);
      // Past the full step-1 duration: the clone is gone, replaced by the
      // real gap hosting the poster — still narrow at first.
      expect(wrapper.vm.flyingCard).toBeNull();
      expect(wrapper.vm.placingGapIndex).toBe(correctSlot);
      expect(wrapper.vm.placingPosterUrl).toBeTruthy();
      expect(wrapper.vm.placingWide).toBe(false);
      const placingEl = wrapper.find('.timeline-gap.placing-gap');
      expect(placingEl.exists()).toBe(true);
      expect(placingEl.classes()).not.toContain('wide');
      expect(placingEl.find('img').exists()).toBe(true);
      // Still isPlacing -- the mystery card must not reappear mid-sequence.
      expect(wrapper.vm.isPlacing).toBe(true);
      expect(wrapper.find('.mystery-card').exists()).toBe(false);

      // A frame later, it widens to the final card size.
      await vi.advanceTimersByTimeAsync(50);
      expect(wrapper.vm.placingWide).toBe(true);
      expect(wrapper.find('.timeline-gap.placing-gap').classes()).toContain('wide');

      vi.restoreAllMocks();
    });

    // Step 3 is triggered by step 2's own wait() resolving, which chains
    // straight into setting up step 3's rAFs in the SAME continuation —
    // driving this through the full click + coarse advanceTimersByTimeAsync
    // chain makes the "just entered, still collapsed" window (which only
    // lasts two rAFs) unreliable to freeze on, since a single advance call
    // can end up sweeping through a just-scheduled rAF pair as part of
    // settling the timer that triggered them. Testing the named helper
    // directly sidesteps that entirely and is more precise anyway.
    it('growInNewGaps: the two new flanking gaps grow in from 0 width instead of popping in', async () => {
      const wrapper = factory(tenMovies());
      await wrapper.find('.btn-game-primary').trigger('click');

      const promise = wrapper.vm.growInNewGaps(0);
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.enteringGapIndices).toEqual([0, 1]);
      const gaps = wrapper.findAll('.timeline-gap');
      expect(gaps[0].classes()).toContain('entering');
      expect(gaps[1].classes()).toContain('entering');

      await vi.advanceTimersByTimeAsync(50);
      expect(wrapper.vm.enteringGapIndices).toEqual([]);
      expect(wrapper.findAll('.timeline-gap')[0].classes()).not.toContain('entering');

      await vi.advanceTimersByTimeAsync(wrapper.vm.stepDurationMs);
      await promise;
    });

    it('runs the full sequence end to end: card lands in the timeline, streak grows, best streak persists, next mystery card is ready', async () => {
      const wrapper = factory(tenMovies());
      await wrapper.find('.btn-game-primary').trigger('click');
      stubRects();

      const correctSlot = correctSlotIndex(wrapper.vm.timeline, wrapper.vm.mysteryCard);
      await wrapper.findAll('.timeline-gap')[correctSlot].trigger('click');

      // One generous lump-sum advance covering the pre-pause plus all 3
      // steps' rAFs and waits — unlike the per-step tests above, this one
      // only cares about the settled END state, so the exact granularity
      // of intermediate advances doesn't matter here.
      await vi.advanceTimersByTimeAsync(400 + wrapper.vm.stepDurationMs * 3 + 200);

      expect(wrapper.vm.flyingCard).toBeNull();
      expect(wrapper.vm.placingGapIndex).toBeNull();
      expect(wrapper.vm.enteringGapIndices).toEqual([]);
      expect(wrapper.vm.isPlacing).toBe(false);
      expect(wrapper.vm.timeline).toHaveLength(2);
      expect(wrapper.vm.streak).toBe(1);
      expect(wrapper.vm.mysteryCard).toBeTruthy();
      expect(wrapper.vm.revealed).toBe(false);
      expect(wrapper.vm.$store.dispatch).toHaveBeenCalledWith('setDBValue', { path: 'settings/games/timelineBestStreak', value: 1 });

      vi.restoreAllMocks();
    });
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

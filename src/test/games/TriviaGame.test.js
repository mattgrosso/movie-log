import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import TriviaGame from '@/components/games/TriviaGame.vue';
import axios from 'axios';

vi.mock('axios', () => ({
  default: { post: vi.fn() }
}));

function factsFor (id) {
  return [`Hard fact about movie ${id}.`, `Second fact ${id}.`, `Third fact ${id}.`, `Fourth fact ${id}.`, `Easy giveaway fact ${id}.`];
}

function defaultAxiosImpl (url, body) {
  return Promise.resolve({ data: { facts: factsFor(body.title.replace('Movie ', '')) } });
}

function entry (id) {
  return {
    dbKey: `key-${id}`,
    ratings: [{ calculatedTotal: 5 }],
    movie: { id, title: `Movie ${id}`, poster_path: '/p.jpg', release_date: '1994-06-15' }
  };
}

function tenMovies () {
  return Array.from({ length: 10 }, (_, i) => entry(i));
}

function factory (movies, dispatch = vi.fn()) {
  return mount(TriviaGame, {
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

describe('TriviaGame', () => {
  beforeEach(() => {
    axios.post.mockReset();
    axios.post.mockImplementation(defaultAxiosImpl);
    // Fixtures reuse the same dbKeys across tests, so persisted state from
    // one test can leak into and change the outcome of the next one in
    // this file — same gotcha documented for Connections/Reel Wordle/Six
    // Degrees' own test files.
    window.localStorage.clear();
  });

  it('shows a not-enough-movies message when the library is small', async () => {
    const wrapper = factory(Array.from({ length: 3 }, (_, i) => entry(i)));
    await flushPromises();
    expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
  });

  it('starts a round automatically on mount and shows just the first (hardest) fact', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    expect(wrapper.vm.loading).toBe(false);
    expect(wrapper.vm.loadError).toBe(false);
    expect(wrapper.vm.target).toBeTruthy();
    expect(wrapper.vm.facts).toHaveLength(5);
    expect(wrapper.vm.revealedCount).toBe(1);
    expect(wrapper.findAll('.fact-row')).toHaveLength(1);
    expect(wrapper.find('.fact-row').text()).toContain(wrapper.vm.facts[0]);
  });

  it('a wrong guess reveals the next fact instead of ending the round', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    const targetId = wrapper.vm.target.movie.id;
    const wrongEntry = wrapper.vm.eligibleGameEntries.find((e) => e.movie.id !== targetId);
    wrapper.vm.submitGuess(wrongEntry);
    await flushPromises();

    expect(wrapper.vm.status).toBe('playing');
    expect(wrapper.vm.revealedCount).toBe(2);
    expect(wrapper.findAll('.fact-row')).toHaveLength(2);
  });

  it('"Next Clue" reveals the next fact without requiring a guess, and disables once every fact is shown', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    for (let i = 0; i < 4; i++) {
      await wrapper.find('.playing-actions button').trigger('click');
    }
    expect(wrapper.vm.revealedCount).toBe(5);
    expect(wrapper.find('.playing-actions button').attributes('disabled')).toBeDefined();
  });

  it('a correct guess wins, shows the poster/title, and persists a new best', async () => {
    const dispatch = vi.fn();
    const wrapper = factory(tenMovies(), dispatch);
    await flushPromises();

    const targetId = wrapper.vm.target.movie.id;
    const correctEntry = wrapper.vm.eligibleGameEntries.find((e) => e.movie.id === targetId);
    wrapper.vm.submitGuess(correctEntry);
    await flushPromises();

    expect(wrapper.vm.status).toBe('won');
    expect(dispatch).toHaveBeenCalledWith('setDBValue', { path: 'settings/games/triviaBestFactsUsed', value: 1 });
    expect(wrapper.find('.result-banner').text()).toContain(`Movie ${targetId}`);
    expect(wrapper.find('.reveal-poster').exists()).toBe(true);
  });

  it('does not overwrite an existing better best with a worse one', async () => {
    const dispatch = vi.fn();
    const wrapper = mount(TriviaGame, {
      global: {
        mocks: {
          $store: {
            state: { settings: { games: { triviaBestFactsUsed: 1 } } },
            getters: { allMediaAsArray: tenMovies() },
            dispatch,
            commit: vi.fn()
          },
          $router: { push: vi.fn() }
        }
      }
    });
    await flushPromises();

    // Burn through every clue before guessing, so this round's score (5) is
    // worse than the existing best (1).
    for (let i = 0; i < 4; i++) {
      await wrapper.find('.playing-actions button').trigger('click');
    }
    const targetId = wrapper.vm.target.movie.id;
    wrapper.vm.submitGuess(wrapper.vm.eligibleGameEntries.find((e) => e.movie.id === targetId));
    await flushPromises();

    expect(dispatch).not.toHaveBeenCalledWith('setDBValue', expect.objectContaining({ path: 'settings/games/triviaBestFactsUsed' }));
  });

  it('"Reveal Answer" ends the round without a score', async () => {
    const dispatch = vi.fn();
    const wrapper = factory(tenMovies(), dispatch);
    await flushPromises();

    await wrapper.find('.playing-actions button:last-child').trigger('click');

    expect(wrapper.vm.status).toBe('revealed');
    expect(wrapper.vm.revealedCount).toBe(5);
    expect(dispatch).not.toHaveBeenCalledWith('setDBValue', expect.objectContaining({ path: 'settings/games/triviaBestFactsUsed' }));
    expect(wrapper.find('.result-banner').classes()).toContain('revealed');
  });

  it('"New Round" after winning starts a fresh round, excluding the just-finished target', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    const firstTargetId = wrapper.vm.target.movie.id;
    wrapper.vm.submitGuess(wrapper.vm.eligibleGameEntries.find((e) => e.movie.id === firstTargetId));
    await flushPromises();

    await wrapper.find('.result-banner button').trigger('click');
    await flushPromises();

    expect(wrapper.vm.status).toBe('playing');
    expect(wrapper.vm.revealedCount).toBe(1);
    expect(wrapper.vm.target.movie.id).not.toBe(firstTargetId);
  });

  it('shows a retry state when the trivia fetch fails, and "Try Again" retries the same target', async () => {
    axios.post.mockRejectedValueOnce(new Error('network down'));
    const wrapper = factory(tenMovies());
    await flushPromises();

    expect(wrapper.vm.loadError).toBe(true);
    expect(wrapper.vm.loading).toBe(false);
    const stuckTargetId = wrapper.vm.target.movie.id;

    axios.post.mockImplementation(defaultAxiosImpl);
    await wrapper.find('.error-actions button').trigger('click');
    await flushPromises();

    expect(wrapper.vm.loadError).toBe(false);
    expect(wrapper.vm.target.movie.id).toBe(stuckTargetId);
    expect(wrapper.vm.facts).toHaveLength(5);
  });

  it('ignores a stale in-flight fetch if a newer round was started in the meantime', async () => {
    let resolveFirst;
    axios.post.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    const wrapper = factory(tenMovies());

    axios.post.mockImplementation(defaultAxiosImpl);
    wrapper.vm.startNewRound();
    await flushPromises();

    resolveFirst({ data: { facts: ['A stale fact that should never appear.'] } });
    await flushPromises();

    expect(wrapper.vm.facts).not.toContain('A stale fact that should never appear.');
  });

  describe('progress persistence (bug report: "went to the home screen and then came back it reset")', () => {
    it('restores an in-progress round across a remount, without re-fetching', async () => {
      const wrapper = factory(tenMovies());
      await flushPromises();
      await wrapper.find('.playing-actions button').trigger('click'); // Next Clue
      expect(wrapper.vm.revealedCount).toBe(2);

      const { target, facts, revealedCount } = wrapper.vm;
      wrapper.unmount();
      axios.post.mockClear();

      const wrapper2 = factory(tenMovies());
      await flushPromises();

      expect(wrapper2.vm.target.dbKey).toBe(target.dbKey);
      expect(wrapper2.vm.facts).toEqual(facts);
      expect(wrapper2.vm.revealedCount).toBe(revealedCount);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('does NOT resume a round that was already won', async () => {
      const wrapper = factory(tenMovies());
      await flushPromises();
      const targetId = wrapper.vm.target.movie.id;
      wrapper.vm.submitGuess(wrapper.vm.eligibleGameEntries.find((e) => e.movie.id === targetId));
      await flushPromises();
      wrapper.unmount();

      const wrapper2 = factory(tenMovies());
      await flushPromises();

      expect(wrapper2.vm.status).toBe('playing');
      expect(wrapper2.vm.revealedCount).toBe(1);
    });

    it('does NOT resume a round that was already revealed (given up on)', async () => {
      const wrapper = factory(tenMovies());
      await flushPromises();
      await wrapper.find('.playing-actions button:last-child').trigger('click'); // Reveal Answer
      expect(wrapper.vm.status).toBe('revealed');
      wrapper.unmount();

      const wrapper2 = factory(tenMovies());
      await flushPromises();

      expect(wrapper2.vm.status).toBe('playing');
      expect(wrapper2.vm.revealedCount).toBe(1);
    });

    it('"New Round" overwrites stale saved progress rather than leaving the old round resumable', async () => {
      const wrapper = factory(tenMovies());
      await flushPromises();
      const firstTargetId = wrapper.vm.target.movie.id;
      await wrapper.find('.playing-actions button').trigger('click'); // Next Clue, revealedCount -> 2

      wrapper.vm.startNewRound();
      await flushPromises();
      const secondTargetId = wrapper.vm.target.movie.id;
      wrapper.unmount();

      const wrapper2 = factory(tenMovies());
      await flushPromises();

      expect(wrapper2.vm.target.movie.id).toBe(secondTargetId);
      expect(wrapper2.vm.revealedCount).toBe(1);
      // Not a strict guarantee across every possible library, but confirms
      // this specific restore didn't accidentally resurrect the abandoned
      // first round's target+progress.
      if (secondTargetId !== firstTargetId) {
        expect(wrapper2.vm.target.movie.id).not.toBe(firstTargetId);
      }
    });

    it('falls back to a fresh round when the saved target movie is no longer eligible', async () => {
      const wrapper = factory(tenMovies());
      await flushPromises();
      const targetId = wrapper.vm.target.movie.id;
      wrapper.unmount();

      // Same library MINUS the previously-saved target (as if it were
      // unrated or otherwise dropped since).
      const wrapper2 = factory(tenMovies().filter((e) => e.movie.id !== targetId));
      await flushPromises();

      expect(wrapper2.vm.status).toBe('playing');
      expect(wrapper2.vm.target.movie.id).not.toBe(targetId);
      expect(wrapper2.vm.facts).toHaveLength(5);
    });
  });

  describe('custom header banner (same pattern as the other games)', () => {
    it('sets the header banner to the custom graphic and hides the "Cinema Roll" logo on mount', () => {
      const wrapper = factory(tenMovies());
      const lastBannerCall = wrapper.vm.$store.commit.mock.calls.find((call) => call[0] === 'setBannerUrl');
      expect(lastBannerCall[1]).toContain('trivia-banner');
      expect(wrapper.vm.$store.commit).toHaveBeenCalledWith('setHideHeaderLogo', true);
    });

    it('restores the previous banner and un-hides the logo on unmount', () => {
      const store = { state: { settings: {}, bannerUrl: 'https://example.com/some-movie-backdrop.jpg' }, getters: { allMediaAsArray: tenMovies() }, dispatch: vi.fn(), commit: vi.fn() };
      const wrapper = mount(TriviaGame, { global: { mocks: { $store: store, $router: { push: vi.fn() } } } });
      wrapper.unmount();

      const calls = store.commit.mock.calls.filter((call) => call[0] === 'setBannerUrl');
      expect(calls[calls.length - 1][1]).toBe('https://example.com/some-movie-backdrop.jpg');
      expect(store.commit).toHaveBeenCalledWith('setHideHeaderLogo', false);
    });
  });
});

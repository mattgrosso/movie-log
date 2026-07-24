import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ClueBudgetGame from '@/components/games/ClueBudgetGame.vue';
import axios from 'axios';

vi.mock('axios', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { tagline: 'A test tagline.' } })) }
}));

function entry (id, overrides = {}) {
  return {
    dbKey: `key-${id}`,
    ratings: [{ calculatedTotal: 5 }],
    movie: {
      id,
      title: `Movie ${id}`,
      poster_path: '/p.jpg',
      release_date: '1994-06-15',
      runtime: 120,
      genres: [{ name: 'Drama' }],
      cast: [{ name: 'Cast One' }, { name: 'Cast Two' }],
      crew: [{ name: 'Some Director', job: 'Director' }],
      production_companies: [{ name: 'A24' }],
      flatKeywords: ['heist'],
      ...overrides
    }
  };
}

function factory (movies, dispatch = vi.fn()) {
  return mount(ClueBudgetGame, {
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
  return Array.from({ length: 10 }, (_, i) => entry(i));
}

describe('ClueBudgetGame', () => {
  beforeEach(() => {
    axios.get.mockClear();
    axios.get.mockResolvedValue({ data: { tagline: 'A test tagline.' } });
  });

  it('shows a not-enough-movies message when the library is small', () => {
    const wrapper = factory(Array.from({ length: 3 }, (_, i) => entry(i)));
    expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
  });

  it('starts a round with a full $100 budget, a full clue deck, and fetches the tagline', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    expect(wrapper.vm.target).toBeTruthy();
    expect(wrapper.vm.budget).toBe(100);
    expect(wrapper.vm.status).toBe('playing');
    expect(wrapper.vm.purchasedKeys).toEqual([]);
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining(`/movie/${wrapper.vm.target.movie.id}?`));
    // The tagline fetch resolved and folded into the deck.
    expect(wrapper.vm.clueDeck.find((c) => c.key === 'tagline')?.value).toBe('A test tagline.');
  });

  it('buying a clue deducts its cost from the budget and moves it to the purchased list', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    const clue = wrapper.vm.availableClues.find((c) => c.key === 'decade');
    const before = wrapper.vm.budget;
    await wrapper.findAll('.clue-chip').find((c) => c.text().includes('Decade')).trigger('click');

    expect(wrapper.vm.budget).toBe(before - clue.cost);
    expect(wrapper.vm.purchasedKeys).toContain('decade');
    expect(wrapper.find('.purchased-clues').text()).toContain('Decade');
  });

  it('does not allow buying the same clue twice or a clue costing more than the remaining budget', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    const clue = wrapper.vm.availableClues[0];
    wrapper.vm.buyClue(clue);
    const afterFirst = wrapper.vm.budget;
    wrapper.vm.buyClue(clue); // already purchased — no-op
    expect(wrapper.vm.budget).toBe(afterFirst);

    wrapper.vm.buyClue({ key: 'nonexistent', cost: 99999, label: 'x', value: 'x' });
    expect(wrapper.vm.budget).toBe(afterFirst);
  });

  it('spending down to exactly $0 across purchases ends the round in a loss, revealing the poster', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();
    wrapper.vm.budget = 5;
    wrapper.vm.buyClue({ key: 'test', cost: 5, label: 'Test', value: 'x' });

    expect(wrapper.vm.budget).toBe(0);
    expect(wrapper.vm.status).toBe('lost');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.reveal-poster').exists()).toBe(true);
    expect(wrapper.text()).toContain(wrapper.vm.target.movie.title);
  });

  it('"Reveal Poster" always costs everything remaining, regardless of how much is left', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    await wrapper.find('.poster-chip').trigger('click');

    expect(wrapper.vm.budget).toBe(0);
    expect(wrapper.vm.status).toBe('lost');
  });

  it('guessing the correct movie (via the suggestions dropdown) wins and persists a new best if it beats the old one', async () => {
    const dispatch = vi.fn();
    const wrapper = factory(tenMovies(), dispatch);
    await flushPromises();
    wrapper.vm.buyClue({ key: 'test', cost: 30, label: 'Test', value: 'x' }); // budget now 70

    wrapper.vm.submitGuess(wrapper.vm.target);

    expect(wrapper.vm.status).toBe('won');
    expect(dispatch).toHaveBeenCalledWith('setDBValue', { path: 'settings/games/clueBudgetBestSavings', value: 70 });
  });

  it('guessing the WRONG movie does not end the round', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();
    const wrong = wrapper.vm.eligibleGameEntries.find((e) => e.dbKey !== wrapper.vm.target.dbKey);

    wrapper.vm.submitGuess(wrong);

    expect(wrapper.vm.status).toBe('playing');
  });

  it('does not overwrite a better (higher-savings) best score with a worse one', async () => {
    // The existing best must be present in $store.state from the start —
    // bestSavings is a Vue computed, and this mock $store is a plain object
    // (not made reactive), so a mutation to it AFTER mount would never
    // invalidate an already-cached computed read.
    const dispatch = vi.fn();
    const movies = tenMovies();
    const wrapper = mount(ClueBudgetGame, {
      global: {
        mocks: {
          $store: {
            state: { settings: { games: { clueBudgetBestSavings: 90 } } },
            getters: { allMediaAsArray: movies },
            dispatch,
            commit: vi.fn()
          },
          $router: { push: vi.fn() }
        }
      }
    });
    await flushPromises();
    wrapper.vm.buyClue({ key: 'test', cost: 50, label: 'Test', value: 'x' }); // budget now 50, worse than 90

    wrapper.vm.submitGuess(wrapper.vm.target);

    expect(dispatch).not.toHaveBeenCalledWith('setDBValue', expect.objectContaining({ path: 'settings/games/clueBudgetBestSavings' }));
  });

  it('"New Round" resets the budget, clears purchases, and fetches a fresh tagline for a different movie', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();
    const firstTarget = wrapper.vm.target;
    wrapper.vm.buyClue({ key: 'test', cost: 30, label: 'Test', value: 'x' });
    axios.get.mockClear();

    wrapper.vm.startNewRound();
    await flushPromises();

    expect(wrapper.vm.budget).toBe(100);
    expect(wrapper.vm.purchasedKeys).toEqual([]);
    expect(wrapper.vm.status).toBe('playing');
    expect(wrapper.vm.target.dbKey).not.toBe(firstTarget.dbKey);
    expect(axios.get).toHaveBeenCalled();
  });

  it('suggestion list filters by typed substring', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();
    wrapper.vm.guessInput = 'movie 3';
    wrapper.vm.onInput();
    expect(wrapper.vm.suggestions.map((e) => e.movie.title)).toEqual(['Movie 3']);
  });

  describe('custom header banner (a graphic made for this game, same pattern as the other 5)', () => {
    it('sets the header banner to the custom graphic and hides the "Cinema Roll" logo on mount', () => {
      const wrapper = factory(tenMovies());
      const lastBannerCall = wrapper.vm.$store.commit.mock.calls.find((call) => call[0] === 'setBannerUrl');
      expect(lastBannerCall[1]).toContain('clue-budget-banner');
      expect(wrapper.vm.$store.commit).toHaveBeenCalledWith('setHideHeaderLogo', true);
    });

    it('restores the previous banner and un-hides the logo on unmount', () => {
      const store = { state: { settings: {}, bannerUrl: 'https://example.com/some-movie-backdrop.jpg' }, getters: { allMediaAsArray: tenMovies() }, dispatch: vi.fn(), commit: vi.fn() };
      const wrapper = mount(ClueBudgetGame, { global: { mocks: { $store: store, $router: { push: vi.fn() } } } });
      wrapper.unmount();

      const calls = store.commit.mock.calls.filter((call) => call[0] === 'setBannerUrl');
      expect(calls[calls.length - 1][1]).toBe('https://example.com/some-movie-backdrop.jpg');
      expect(store.commit).toHaveBeenCalledWith('setHideHeaderLogo', false);
    });
  });
});

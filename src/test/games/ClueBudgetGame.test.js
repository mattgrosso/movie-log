import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ClueBudgetGame from '@/components/games/ClueBudgetGame.vue';
import axios from 'axios';

// Dispatches based on which TMDB endpoint is being hit, matching the real
// component's three-fetch pattern (movie+credits, discover-by-keyword,
// discover-by-company). Individual tests override specific pieces via
// axios.get.mockImplementation when they need particular values.
function defaultAxiosImpl (url) {
  if (url.includes('/discover/movie')) {
    return Promise.resolve({ data: { total_results: 500 } });
  }
  return Promise.resolve({
    data: {
      tagline: 'A test tagline.',
      credits: {
        cast: [{ name: 'Cast One', popularity: 40 }, { name: 'Cast Two', popularity: 5 }],
        crew: [{ name: 'Some Director', job: 'Director', popularity: 20 }]
      }
    }
  });
}

vi.mock('axios', () => ({
  default: { get: vi.fn() }
}));

// These fixtures carry only a calculatedTotal, not the individual criteria
// the real weighted math needs, so the real getRating returns NaN for them
// (which buildClueDeck correctly refuses to offer as a Your Rating clue).
// Mock it so the rating-clue path is exercised against a realistic value.
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 7.5 }))
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
      production_companies: [{ id: 999, name: 'A24' }],
      keywords: [{ id: 111, name: 'heist' }],
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

// Fixtures reuse dbKeys, so persisted state leaks between tests without
// this — the documented games-testing trap.
beforeEach(() => {
  window.localStorage.clear();
});

describe('ClueBudgetGame', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockImplementation(defaultAxiosImpl);
  });

  it('shows a not-enough-movies message when the library is small', () => {
    const wrapper = factory(Array.from({ length: 3 }, (_, i) => entry(i)));
    expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
  });

  it('starts a round with a full $100 budget, a full clue deck, and fetches live TMDB data', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    expect(wrapper.vm.target).toBeTruthy();
    expect(wrapper.vm.budget).toBe(100);
    expect(wrapper.vm.status).toBe('playing');
    expect(wrapper.vm.purchasedClues).toEqual([]);
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining(`/movie/${wrapper.vm.target.movie.id}?`));
    // Tagline resolved and folded into the deck.
    expect(wrapper.vm.clueDeck.find((c) => c.key === 'tagline')?.value).toBe('A test tagline.');
  });

  it('fetches real popularity for cast/crew (via append_to_response=credits) and prices those clues from it', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('append_to_response=credits'));
    const directorClue = wrapper.vm.clueDeck.find((c) => c.key === 'director');
    const cast0 = wrapper.vm.clueDeck.find((c) => c.key === 'cast-0'); // popularity 40
    const cast1 = wrapper.vm.clueDeck.find((c) => c.key === 'cast-1'); // popularity 5
    // Real popularity, not the old fixed fallback values.
    expect(directorClue.cost).not.toBe(20);
    expect(cast0.cost).toBeGreaterThan(cast1.cost); // more popular costs more
  });

  it('fetches keyword rarity for keywords with a resolvable TMDB id, and prices that clue from it', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('with_keywords=111')) return Promise.resolve({ data: { total_results: 4 } }); // rare
      return defaultAxiosImpl(url);
    });
    const wrapper = factory(tenMovies());
    await flushPromises();

    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('with_keywords=111'));
    const keywordClue = wrapper.vm.clueDeck.find((c) => c.key === 'keyword-0');
    expect(keywordClue.cost).not.toBe(10); // not the fallback — a rare keyword prices high
    expect(keywordClue.cost).toBeGreaterThan(20);
  });

  it('does not fetch keyword rarity for a keyword with no matching TMDB id (AI/custom keyword)', async () => {
    const movies = [entry(0, { keywords: [], flatKeywords: ['a made-up ai keyword'] })];
    const wrapper = factory(movies);
    await flushPromises();

    expect(axios.get).not.toHaveBeenCalledWith(expect.stringContaining('with_keywords'));
    expect(wrapper.vm.clueDeck.find((c) => c.key === 'keyword-0').cost).toBe(10); // fallback
  });


  it('a clue bought BEFORE live data resolves keeps its fallback price even after the deck later updates', async () => {
    // Never resolves during this test — buyClue happens while everything
    // is still on fallback pricing.
    axios.get.mockImplementation(() => new Promise(() => {}));
    const wrapper = factory(tenMovies());
    await wrapper.vm.$nextTick();

    const directorClue = wrapper.vm.clueDeck.find((c) => c.key === 'director');
    expect(directorClue.cost).toBe(20); // fallback, nothing has resolved yet
    wrapper.vm.buyClue(directorClue);

    expect(wrapper.vm.purchasedClues[0].cost).toBe(20);
    expect(wrapper.vm.budget).toBe(80);
  });

  it('buying a clue deducts its cost from the budget and moves it to the purchased list', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    const clue = wrapper.vm.availableClues.find((c) => c.key === 'decade');
    const before = wrapper.vm.budget;
    await wrapper.findAll('.clue-chip').find((c) => c.text().includes('Decade')).trigger('click');

    expect(wrapper.vm.budget).toBe(before - clue.cost);
    expect(wrapper.vm.purchasedClues.map((c) => c.key)).toContain('decade');
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

    await wrapper.find('.give-up-clue').trigger('click');

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

  it('guessing the WRONG movie does not end the round, but DOES say so and costs $10 (bug reports: "no real feedback" + "each wrong guess costs $10")', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();
    const wrong = wrapper.vm.eligibleGameEntries.find((e) => e.dbKey !== wrapper.vm.target.dbKey);

    wrapper.vm.submitGuess(wrong);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.status).toBe('playing');
    expect(wrapper.vm.lastGuessFeedback).toContain(wrong.movie.title);
    expect(wrapper.vm.lastGuessFeedback).toContain('$10');
    const feedback = wrapper.find('.guess-feedback');
    expect(feedback.classes()).toContain('visible');
    expect(feedback.text()).toContain(wrong.movie.title);

    expect(wrapper.vm.budget).toBe(90);
  });

  it('a wrong guess that spends the last of the budget ends the round in a loss', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();
    const wrong = wrapper.vm.eligibleGameEntries.find((e) => e.dbKey !== wrapper.vm.target.dbKey);
    wrapper.vm.budget = 10;

    wrapper.vm.submitGuess(wrong);

    expect(wrapper.vm.budget).toBe(0);
    expect(wrapper.vm.status).toBe('lost');
    expect(window.localStorage.getItem('cinemaRoll.clueBudget.current')).toBeNull();
  });

  it('a wrong guess persists the reduced budget, so a resumed round cannot refund it', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();
    const wrong = wrapper.vm.eligibleGameEntries.find((e) => e.dbKey !== wrapper.vm.target.dbKey);

    wrapper.vm.submitGuess(wrong);

    const saved = JSON.parse(window.localStorage.getItem('cinemaRoll.clueBudget.current'));
    expect(saved.budget).toBe(90);
  });

  it('clears the wrong-guess message as soon as the player starts typing again', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();
    const wrong = wrapper.vm.eligibleGameEntries.find((e) => e.dbKey !== wrapper.vm.target.dbKey);
    wrapper.vm.submitGuess(wrong);
    expect(wrapper.vm.lastGuessFeedback).toBeTruthy();

    wrapper.vm.guessInput = 'mov';
    wrapper.vm.onInput();

    expect(wrapper.vm.lastGuessFeedback).toBeNull();
  });

  // Feature request: "we should add my rating as a buyable clue on the
  // trivia budget game."
  it('offers the player\'s own rating as a buyable clue, available from the first render (no fetch needed)', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    const ratingClue = wrapper.vm.clueDeck.find((c) => c.key === 'yourRating');
    expect(ratingClue).toBeTruthy();
    expect(ratingClue.label).toBe('Your Rating');
    expect(Number(ratingClue.value)).toBeCloseTo(wrapper.vm.gameRatingFor(wrapper.vm.target));
    expect(ratingClue.cost).toBeGreaterThan(0);
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

  it('"New Round" resets the budget, clears purchases, and fetches fresh live data for a different movie', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();
    const firstTarget = wrapper.vm.target;
    wrapper.vm.buyClue({ key: 'test', cost: 30, label: 'Test', value: 'x' });
    axios.get.mockClear();

    wrapper.vm.startNewRound();
    await flushPromises();

    expect(wrapper.vm.budget).toBe(100);
    expect(wrapper.vm.purchasedClues).toEqual([]);
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

  // Regression guard for a real bug found while building the Trivia game:
  // this.target !== roundTarget compared a reactive-proxy-wrapped read
  // against the raw object captured before assignment, which never matches
  // once Vue actually wraps the value — silently discarding every live
  // fetch below and leaving every clue on its static fallback price. No
  // prior test exercised the SUCCESS path (only the fallback-pricing
  // shape), so this was never caught. Fixed by comparing entryKey(...)
  // instead of object identity.
  it('live TMDB data actually merges into the clue deck once the fetches resolve', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    expect(wrapper.vm.liveExtras.tagline).toBe('A test tagline.');
    expect(wrapper.vm.liveExtras.peoplePopularity).toEqual({ 'Cast One': 40, 'Cast Two': 5, 'Some Director': 20 });
    expect(wrapper.vm.liveExtras.keywordMovieCounts).toEqual({ heist: 500 });
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

describe('ClueBudgetGame - round history (feature: game stats)', () => {
  function routedFactory () {
    const dispatch = vi.fn();
    const wrapper = mount(ClueBudgetGame, {
      global: {
        mocks: {
          $store: { state: { settings: {} }, getters: { allMediaAsArray: tenMovies() }, dispatch, commit: vi.fn() },
          $router: { push: vi.fn() },
          $route: { path: '/games/clue-budget' }
        }
      }
    });
    return { wrapper, dispatch };
  }

  it('a win records {won, saved} into settings/games/history', async () => {
    const { wrapper, dispatch } = routedFactory();
    await flushPromises();
    wrapper.vm.buyClue(wrapper.vm.availableClues.find((c) => c.key === 'decade'));

    wrapper.vm.submitGuess(wrapper.vm.target);

    const call = dispatch.mock.calls.find(([, entry]) => entry?.path === 'settings/games/history/clue-budget');
    expect(call).toBeTruthy();
    const lastRecord = call[1].value[call[1].value.length - 1];
    expect(lastRecord).toMatchObject({ won: true, saved: wrapper.vm.budget });
  });

  it('going broke records a loss', async () => {
    const { wrapper, dispatch } = routedFactory();
    await flushPromises();

    wrapper.vm.revealPoster();

    const call = dispatch.mock.calls.find(([, entry]) => entry?.path === 'settings/games/history/clue-budget');
    expect(call[1].value[call[1].value.length - 1]).toMatchObject({ won: false, saved: 0 });
  });
});

describe('ClueBudgetGame - purchased-card widths (feedback: long taglines made the cards squat)', () => {
  it('a tagline card is always full width; short facts stay compact; long genre lists widen', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    wrapper.vm.buyClue({ key: 'tagline', label: 'Tagline', cost: 15, value: 'Short.' });
    wrapper.vm.buyClue({ key: 'decade', label: 'Decade', cost: 5, value: '1990s' });
    wrapper.vm.buyClue({ key: 'genres', label: 'Genres', cost: 8, value: 'Action, Adventure, Sci-Fi' });
    await wrapper.vm.$nextTick();

    const cards = wrapper.findAll('.purchased-clue');
    const byLabel = (label) => cards.find((card) => card.text().includes(label));
    expect(byLabel('Tagline').classes()).toContain('wide'); // even a short tagline: sentences get the row
    expect(byLabel('Decade').classes()).not.toContain('wide');
    expect(byLabel('Genres').classes()).toContain('wide'); // 25 chars of genre list
  });
});

describe('ClueBudgetGame - persistence across navigation (bug report: "when I jumped over to my database and came back it reset the game")', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockImplementation(defaultAxiosImpl);
  });

  it('restores the in-progress round: same movie, remaining budget, and purchased clues at their paid price', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();
    const target = wrapper.vm.target;
    const clue = wrapper.vm.availableClues.find((c) => c.key === 'decade');
    wrapper.vm.buyClue(clue);
    const budgetAfter = wrapper.vm.budget;
    wrapper.unmount();

    const revisit = factory(tenMovies());
    await flushPromises();

    expect(revisit.vm.target.dbKey).toBe(target.dbKey);
    expect(revisit.vm.budget).toBe(budgetAfter);
    expect(revisit.vm.purchasedClues.map((c) => c.key)).toEqual(['decade']);
    expect(revisit.vm.purchasedClues[0].cost).toBe(clue.cost);
    expect(revisit.find('.purchased-clues').text()).toContain('Decade');
  });

  it('a finished round clears the save and is never resumed', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();
    wrapper.vm.buyClue(wrapper.vm.availableClues[0]);
    expect(window.localStorage.getItem('cinemaRoll.clueBudget.current')).toBeTruthy();

    wrapper.vm.submitGuess(wrapper.vm.target);

    expect(window.localStorage.getItem('cinemaRoll.clueBudget.current')).toBeNull();
  });

  it('losing (revealing the poster) also clears the save', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();
    wrapper.vm.buyClue(wrapper.vm.availableClues[0]);

    wrapper.vm.revealPoster();

    expect(window.localStorage.getItem('cinemaRoll.clueBudget.current')).toBeNull();
  });

  it('falls back to a fresh round when the saved movie is no longer in the library', async () => {
    window.localStorage.setItem('cinemaRoll.clueBudget.current', JSON.stringify({
      targetKey: 'key-gone', budget: 60, purchasedClues: [{ key: 'decade', label: 'Decade', cost: 5, value: '1990s' }]
    }));
    const wrapper = factory(tenMovies());
    await flushPromises();

    expect(wrapper.vm.budget).toBe(100);
    expect(wrapper.vm.purchasedClues).toEqual([]);
    expect(wrapper.vm.target).toBeTruthy();
  });

  it('ignores a corrupt save rather than crashing', async () => {
    window.localStorage.setItem('cinemaRoll.clueBudget.current', '{not json');
    const wrapper = factory(tenMovies());
    await flushPromises();

    expect(wrapper.vm.status).toBe('playing');
    expect(wrapper.vm.budget).toBe(100);
  });
});

describe('ClueBudgetGame - a deck small enough to fit a phone', () => {
  // Bug report: at four across the chips were too small to tap, but three
  // across only fits if the deck is short enough. Rather than shrink the
  // buttons, the least-identifying clues were cut.
  it('no longer offers the clues that were dropped', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    const keys = wrapper.vm.clueDeck.map((c) => c.key);
    ['company', 'editor', 'producer'].forEach((key) => {
      expect(keys).not.toContain(key);
    });
  });

  it('stops requesting company rarity, since nothing prices off it now', async () => {
    factory(tenMovies());
    await flushPromises();

    expect(axios.get.mock.calls.some(([url]) => url.includes('with_companies='))).toBe(false);
  });

  it('keeps the deck to fifteen clues at most, which is five rows of three', async () => {
    // A typical round offers fewer: tagline is often absent and crew
    // credits run 85-96% complete across the library.
    const wrapper = factory(tenMovies());
    await flushPromises();

    expect(wrapper.vm.clueDeck.length).toBeLessThanOrEqual(15);
  });
});

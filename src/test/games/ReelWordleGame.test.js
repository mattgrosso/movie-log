import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ReelWordleGame from '@/components/games/ReelWordleGame.vue';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((entry) => ({ calculatedTotal: entry.movie.id }))
}));

function entry (id, overrides = {}) {
  return {
    dbKey: `key-${id}`,
    ratings: [{ calculatedTotal: id }],
    movie: {
      id,
      title: `Movie ${id}`,
      poster_path: '/p.jpg',
      release_date: `${2000 + id}-01-01`,
      runtime: 100 + id,
      crew: [{ name: `Director ${id}`, job: 'Director' }],
      genres: [{ name: 'Drama' }],
      ...overrides
    }
  };
}

function factory (movieCount) {
  return mount(ReelWordleGame, {
    global: {
      mocks: {
        $store: { state: {}, getters: { allMediaAsArray: Array.from({ length: movieCount }, (_, i) => entry(i)) }, commit: vi.fn() },
        $router: { push: vi.fn() }
      }
    }
  });
}

describe('ReelWordleGame', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows a gate message when there are no eligible movies', () => {
    const wrapper = factory(0);
    expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
  });

  it('a correct guess wins immediately and reveals the poster', async () => {
    const wrapper = factory(10);
    const target = wrapper.vm.target;
    await wrapper.vm.submitGuess(target);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.status).toBe('won');
    expect(wrapper.find('.result-banner.won').exists()).toBe(true);
    expect(wrapper.findAll('.clue-row.correct').length).toBe(1);
  });

  it('a wrong guess is recorded with directional clues and does not end the game early', async () => {
    const wrapper = factory(10);
    const target = wrapper.vm.target;
    const wrong = wrapper.vm.eligibleGameEntries.find((e) => e.dbKey !== target.dbKey);
    await wrapper.vm.submitGuess(wrong);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.status).toBe('playing');
    expect(wrapper.vm.guesses.length).toBe(1);
    expect(wrapper.vm.guesses[0].isCorrect).toBe(false);
  });

  it('never loses — guesses are unlimited, and clues about the target unlock progressively instead', async () => {
    const wrapper = factory(20)
    const target = wrapper.vm.target;
    const wrongOnes = wrapper.vm.eligibleGameEntries.filter((e) => e.dbKey !== target.dbKey).slice(0, 12);
    expect(wrongOnes.length).toBe(12);

    for (const wrongEntry of wrongOnes) {
      await wrapper.vm.submitGuess(wrongEntry);
    }
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.status).toBe('playing');
    expect(wrapper.vm.guesses.length).toBe(12);
    // 12 wrong guesses / CLUE_INTERVAL(4) = 3 clues unlocked (target has 4 available).
    expect(wrapper.vm.activeClues.length).toBe(3);
    expect(wrapper.findAll('.target-clues li').length).toBe(3);
  });

  it('score is guesses used minus clues used, shown on a win', async () => {
    const wrapper = factory(20);
    const target = wrapper.vm.target;
    const wrongOnes = wrapper.vm.eligibleGameEntries.filter((e) => e.dbKey !== target.dbKey).slice(0, 4);
    for (const wrongEntry of wrongOnes) {
      await wrapper.vm.submitGuess(wrongEntry);
    }
    expect(wrapper.vm.activeClues.length).toBe(1);

    await wrapper.vm.submitGuess(target);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.guesses.length).toBe(5);
    expect(wrapper.vm.score).toBe(4); // 5 guesses - 1 clue
    expect(wrapper.find('.result-banner.won').text()).toContain('score: 4');
  });

  it('shows the guessed movie\'s own release year next to its title (bug report: "next to the title on the card that shows up after I guess")', async () => {
    const wrapper = factory(10)
    const target = wrapper.vm.target
    await wrapper.vm.submitGuess(target)
    await wrapper.vm.$nextTick()

    // Derived the same way the app computes it (new Date(...).getFullYear())
    // rather than hardcoded, to sidestep this repo's documented Jan-1/UTC
    // fixture pitfall rather than assume a specific offset.
    const expectedYear = new Date(target.movie.release_date).getFullYear()
    const title = wrapper.find('.clue-row.correct .clue-title')
    expect(title.text()).toContain(target.movie.title)
    expect(title.text()).toContain(`(${expectedYear})`)
  })

  it('fills in the actual value on a decade/director/genre match instead of just a checkmark', async () => {
    const wrapper = factory(10);
    const target = wrapper.vm.target;
    // The fixture gives every movie its own distinct director/decade, so no
    // OTHER movie can match target on those — guess the target itself to
    // exercise the "match" rendering path deterministically.
    await wrapper.vm.submitGuess(target);
    await wrapper.vm.$nextTick();

    const row = wrapper.find('.clue-row.correct');
    expect(row.text()).toContain(`Director ${target.movie.id}`);
    expect(row.text()).toContain('Drama');
  });

  it('renders exactly one fixed-width cell per category per guess (no wrap, no scroll) — a long director/genre name truncates instead of pushing to a 2nd line', async () => {
    const wrapper = factory(10);
    const target = wrapper.vm.target;
    await wrapper.vm.submitGuess(target);
    await wrapper.vm.$nextTick();

    const row = wrapper.find('.clue-row.correct');
    // 6 categories: year, decade, director, genres, runtime, rating.
    expect(row.findAll('.clue-cell').length).toBe(6);
    const cellsWrapper = row.find('.clue-cells');
    expect(cellsWrapper.attributes('style') || '').not.toContain('min-width');
    row.findAll('.clue-value').forEach((value) => {
      expect(value.classes()).not.toContain('clue-chip'); // the flex-wrap design this replaced
    });
  });

  it('"New Puzzle" can be tapped any number of times — no cap, no cooldown — and always resets/re-persists', async () => {
    const wrapper = factory(10);
    const firstTarget = wrapper.vm.target;
    await wrapper.vm.submitGuess(wrapper.vm.eligibleGameEntries.find((e) => e.dbKey !== firstTarget.dbKey));
    expect(wrapper.vm.guesses.length).toBe(1);

    // Tap through several rounds in a row — nothing gates repeated use.
    for (let i = 0; i < 5; i++) {
      await wrapper.find('.new-puzzle-btn').trigger('click');
      expect(wrapper.vm.guesses.length).toBe(0);
      expect(wrapper.vm.target).not.toBeNull();
    }

    const raw = window.localStorage.getItem('cinemaRoll.reelWordle.current');
    expect(JSON.parse(raw)).toEqual({ targetKey: wrapper.vm.target.dbKey, guessedKeys: [] });
  });

  it('never repeats the immediately-previous target on consecutive "New Puzzle" taps when alternatives exist', async () => {
    const wrapper = factory(10);
    const before = wrapper.vm.target.dbKey;
    await wrapper.find('.new-puzzle-btn').trigger('click');
    expect(wrapper.vm.target.dbKey).not.toBe(before);
  });

  it('persists progress across a remount, resuming the SAME in-progress puzzle', async () => {
    const wrapper = factory(10);
    const target = wrapper.vm.target;
    const wrong = wrapper.vm.eligibleGameEntries.find((e) => e.dbKey !== target.dbKey);
    await wrapper.vm.submitGuess(wrong);

    const second = factory(10);
    expect(second.vm.target.dbKey).toBe(target.dbKey);
    expect(second.vm.guesses.length).toBe(1);
    expect(second.vm.guesses[0].entryKey).toBe(wrong.dbKey);
  });

  it('renders the input pinned above the guess history, with the newest guess pushing older ones down (bug report: "input should stay at the top")', async () => {
    const wrapper = factory(10);
    const wrong = wrapper.vm.eligibleGameEntries.find((e) => e.dbKey !== wrapper.vm.target.dbKey);
    await wrapper.vm.submitGuess(wrong);
    await wrapper.vm.$nextTick();

    const html = wrapper.html();
    const gridIndex = html.indexOf('clue-grid');
    const formIndex = html.indexOf('guess-form');
    expect(gridIndex).toBeGreaterThan(-1);
    expect(formIndex).toBeGreaterThan(-1);
    expect(formIndex).toBeLessThan(gridIndex);
  });

  it('displays guesses newest-first while keeping the underlying guesses array chronological (append-order)', async () => {
    const wrapper = factory(10);
    const target = wrapper.vm.target;
    const [first, second] = wrapper.vm.eligibleGameEntries.filter((e) => e.dbKey !== target.dbKey).slice(0, 2);

    await wrapper.vm.submitGuess(first);
    await wrapper.vm.submitGuess(second);
    await wrapper.vm.$nextTick();

    // Underlying data: chronological (first guessed, first in the array).
    expect(wrapper.vm.guesses.map((g) => g.entryKey)).toEqual([first.dbKey, second.dbKey]);
    // Display: newest first — the most recent guess should appear before
    // the older one in the rendered HTML.
    const html = wrapper.html();
    expect(html.indexOf(second.movie.title)).toBeLessThan(html.indexOf(first.movie.title));
  });

  it('suggestion list filters by typed substring and excludes already-guessed movies', async () => {
    const wrapper = factory(10);
    await wrapper.vm.submitGuess(wrapper.vm.eligibleGameEntries[0]);
    wrapper.vm.guessInput = 'movie';
    wrapper.vm.onInput();
    expect(wrapper.vm.suggestions.some((e) => e.dbKey === wrapper.vm.eligibleGameEntries[0].dbKey)).toBe(false);
  });

  it('does NOT resume a solved puzzle - a remount starts a fresh one instead (bug report, applied from Six Degrees: "it should just be a new game")', async () => {
    const wrapper = factory(10);
    const target = wrapper.vm.target;
    await wrapper.vm.submitGuess(target);
    expect(wrapper.vm.status).toBe('won');

    const second = factory(10);
    expect(second.vm.status).toBe('playing');
    expect(second.vm.guesses).toHaveLength(0);
  });

  describe('custom header banner (a graphic made for this game, same pattern as Six Degrees)', () => {
    it('sets the header banner to the custom graphic and hides the "Cinema Roll" logo on mount', () => {
      const wrapper = factory(10);
      const lastBannerCall = wrapper.vm.$store.commit.mock.calls.find((call) => call[0] === 'setBannerUrl');
      expect(lastBannerCall[1]).toContain('reel-wordle-banner');
      expect(wrapper.vm.$store.commit).toHaveBeenCalledWith('setHideHeaderLogo', true);
    });

    it('restores the previous banner and un-hides the logo on unmount', () => {
      const store = { state: { bannerUrl: 'https://example.com/some-movie-backdrop.jpg' }, getters: { allMediaAsArray: Array.from({ length: 10 }, (_, i) => entry(i)) }, commit: vi.fn() };
      const wrapper = mount(ReelWordleGame, { global: { mocks: { $store: store, $router: { push: vi.fn() } } } });
      wrapper.unmount();

      const calls = store.commit.mock.calls.filter((call) => call[0] === 'setBannerUrl');
      expect(calls[calls.length - 1][1]).toBe('https://example.com/some-movie-backdrop.jpg');
      expect(store.commit).toHaveBeenCalledWith('setHideHeaderLogo', false);
    });
  });
});

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
        $store: { getters: { allMediaAsArray: Array.from({ length: movieCount }, (_, i) => entry(i)) }, commit: vi.fn() },
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

  it('loses after 6 wrong guesses and reveals the answer', async () => {
    const wrapper = factory(10);
    const target = wrapper.vm.target;
    const wrongOnes = wrapper.vm.eligibleGameEntries.filter((e) => e.dbKey !== target.dbKey).slice(0, 6);
    expect(wrongOnes.length).toBe(6);

    for (const wrongEntry of wrongOnes) {
      await wrapper.vm.submitGuess(wrongEntry);
    }
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.status).toBe('lost');
    expect(wrapper.find('.result-banner.lost').text()).toContain(target.movie.title);
  });

  it('persists guesses across a remount (same day)', async () => {
    const wrapper = factory(10);
    const target = wrapper.vm.target;
    const wrong = wrapper.vm.eligibleGameEntries.find((e) => e.dbKey !== target.dbKey);
    await wrapper.vm.submitGuess(wrong);

    const second = factory(10);
    expect(second.vm.guesses.length).toBe(1);
    expect(second.vm.guesses[0].entryKey).toBe(wrong.dbKey);
  });

  it('suggestion list filters by typed substring and excludes already-guessed movies', async () => {
    const wrapper = factory(10);
    await wrapper.vm.submitGuess(wrapper.vm.eligibleGameEntries[0]);
    wrapper.vm.guessInput = 'movie';
    wrapper.vm.onInput();
    expect(wrapper.vm.suggestions.some((e) => e.dbKey === wrapper.vm.eligibleGameEntries[0].dbKey)).toBe(false);
  });
});

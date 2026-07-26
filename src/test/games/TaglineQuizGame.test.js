import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import TaglineQuizGame from '@/components/games/TaglineQuizGame.vue';
import axios from 'axios';

vi.mock('axios', () => ({
  default: { get: vi.fn() }
}));

function defaultAxiosImpl (url) {
  const match = /\/movie\/(\d+)\?/.exec(url);
  const id = match ? Number(match[1]) : null;
  return Promise.resolve({ data: { tagline: `Tagline for movie ${id}.` } });
}

function entry (id) {
  return {
    dbKey: `key-${id}`,
    ratings: [{ calculatedTotal: 5 }],
    movie: { id, title: `Movie ${id}`, poster_path: '/p.jpg', release_date: '1994-06-15' }
  };
}

function factory (movies, dispatch = vi.fn()) {
  return mount(TaglineQuizGame, {
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

describe('TaglineQuizGame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    axios.get.mockReset();
    axios.get.mockImplementation(defaultAxiosImpl);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a not-enough-movies message when the library is small', async () => {
    const wrapper = factory(Array.from({ length: 3 }, (_, i) => entry(i)));
    await flushPromises();
    expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
  });

  it('starts a round automatically on mount: shows a tagline and 4 options including the target', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    expect(wrapper.vm.loading).toBe(false);
    expect(wrapper.vm.tagline).toBeTruthy();
    expect(wrapper.vm.target).toBeTruthy();
    expect(wrapper.vm.options).toHaveLength(4);
    expect(wrapper.vm.options.map((o) => o.movie.id)).toContain(wrapper.vm.target.movie.id);
    expect(wrapper.findAll('.tq-option')).toHaveLength(4);
    expect(wrapper.find('.tagline-text').text()).toContain(`Tagline for movie ${wrapper.vm.target.movie.id}`);
  });

  it('a correct guess shows a checkmark badge, grows the streak, persists a new best, and starts a fresh round after a delay', async () => {
    const dispatch = vi.fn();
    const wrapper = factory(tenMovies(), dispatch);
    await flushPromises();

    const targetId = wrapper.vm.target.movie.id;
    const correctOption = wrapper.findAll('.tq-option').find((opt) => opt.find('img').attributes('alt') === `Movie ${targetId}`);
    await correctOption.trigger('click');

    expect(wrapper.vm.lastGuessCorrect).toBe(true);
    expect(wrapper.vm.streak).toBe(1);
    expect(dispatch).toHaveBeenCalledWith('setDBValue', { path: 'settings/games/taglineQuizBestStreak', value: 1 });
    const badge = wrapper.find('.tq-guess-badge');
    expect(badge.classes()).toContain('correct');
    expect(badge.find('.bi-check-lg').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(900);
    await flushPromises();

    // A new round has started — still playing, tagline/options refreshed.
    expect(wrapper.vm.gameOver).toBe(false);
    expect(wrapper.vm.revealed).toBe(false);
    expect(wrapper.vm.tagline).toBeTruthy();
  });

  it('a wrong guess shows an X on the tapped poster, a checkmark on the real answer, and ends the run', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    const targetId = wrapper.vm.target.movie.id;
    const wrongOption = wrapper.findAll('.tq-option').find((opt) => opt.find('img').attributes('alt') !== `Movie ${targetId}`);
    await wrongOption.trigger('click');

    expect(wrapper.vm.lastGuessCorrect).toBe(false);
    expect(wrapper.vm.gameOver).toBe(true);

    const badges = wrapper.findAll('.tq-guess-badge');
    expect(badges).toHaveLength(2); // the wrong tap + the revealed correct one
    expect(wrongOption.find('.tq-guess-badge').classes()).toContain('incorrect');
    const correctOption = wrapper.findAll('.tq-option').find((opt) => opt.find('img').attributes('alt') === `Movie ${targetId}`);
    expect(correctOption.find('.tq-guess-badge').classes()).toContain('correct');

    expect(wrapper.find('.game-over button').text()).toBe('Play Again');
  });

  it('"Play Again" resets the streak (but continuing after a correct guess does NOT reset it) and starts a fresh round', async () => {
    const wrapper = factory(tenMovies());
    await flushPromises();

    // Win one round first, so there's a real, non-zero streak to reset.
    const firstTargetId = wrapper.vm.target.movie.id;
    const correctOption = wrapper.findAll('.tq-option').find((opt) => opt.find('img').attributes('alt') === `Movie ${firstTargetId}`);
    await correctOption.trigger('click');
    await vi.advanceTimersByTimeAsync(900);
    await flushPromises();
    expect(wrapper.vm.streak).toBe(1); // confirms advancing after a win does NOT reset the streak

    // Now lose, and confirm the streak is still intact right up until
    // "Play Again" is actually tapped.
    const secondTargetId = wrapper.vm.target.movie.id;
    const wrongOption = wrapper.findAll('.tq-option').find((opt) => opt.find('img').attributes('alt') !== `Movie ${secondTargetId}`);
    await wrongOption.trigger('click');
    expect(wrapper.vm.gameOver).toBe(true);
    expect(wrapper.vm.streak).toBe(1);

    await wrapper.find('.game-over .btn-game-primary').trigger('click');
    await flushPromises();

    expect(wrapper.vm.gameOver).toBe(false);
    expect(wrapper.vm.streak).toBe(0);
    expect(wrapper.vm.tagline).toBeTruthy();
  });

  it('shows a friendly retry state when no movie in the library has a usable tagline', async () => {
    axios.get.mockImplementation(() => Promise.resolve({ data: { tagline: '' } }));
    const wrapper = factory(tenMovies());
    await flushPromises();

    expect(wrapper.vm.noTaglineFound).toBe(true);
    expect(wrapper.vm.loading).toBe(false);
    expect(wrapper.text()).toContain("Couldn't find a movie with a tagline");
    expect(wrapper.find('.game-over button').text()).toBe('Try Again');
  });

  it('ignores a stale in-flight fetch if a newer round was started in the meantime', async () => {
    let resolveFirst;
    axios.get.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    const wrapper = factory(tenMovies());

    // First round's fetch is still pending — start a second round before it
    // resolves (simulating a fast double-tap of "Try Again"/a rapid restart).
    axios.get.mockImplementation(defaultAxiosImpl);
    wrapper.vm.startNewRound();
    await flushPromises();

    // Now let the FIRST (stale) fetch resolve.
    resolveFirst({ data: { tagline: 'A stale tagline that should never appear.' } });
    await flushPromises();

    expect(wrapper.vm.tagline).not.toBe('A stale tagline that should never appear.');
  });
});

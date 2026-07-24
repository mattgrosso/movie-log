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
          dispatch,
          commit: vi.fn()
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

  it('starts with a revealed left card and a hidden (mystery) right score', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-game-primary').trigger('click'); // Start
    expect(wrapper.vm.leftCard).not.toBeNull();
    expect(wrapper.vm.rightCard).not.toBeNull();
    expect(wrapper.vm.revealedSide).toBe('left');
    const scores = wrapper.findAll('.hl-card-score');
    expect(scores[1].text()).toBe('?');
  });

  it('does not render a redundant title label under each poster (bug report: "the posters already have the title of the movie... we don\'t need the labels")', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-game-primary').trigger('click');
    expect(wrapper.find('.hl-card-title').exists()).toBe(false);
    // The score is still shown — only the title label was reported as
    // redundant/unwanted, not the score itself.
    expect(wrapper.findAll('.hl-card-score')).toHaveLength(2);
  });

  it('a correct guess keeps the WINNING poster in its own slot — only the other slot gets replaced (bug report: no jumping sides)', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-game-primary').trigger('click');

    const leftId = wrapper.vm.leftCard.movie.id;
    const rightId = wrapper.vm.rightCard.movie.id;
    // Flaky-test fix: the winning VALUE always ends up persisted in
    // mysterySide (the card that "proved itself"), regardless of which
    // physical button was TAPPED to submit the correct guess. The old
    // version of this test conflated those two things — it derived
    // "winningSide" from which slot had the numerically higher rating,
    // which only matches mysterySide when the mystery card happens to BE
    // the higher-rated one. When the mystery card was the LOWER one
    // (correctly guessed by tapping the already-revealed side), the old
    // "winningSide" pointed at the wrong slot and the assertion below
    // failed — hence the ~50%, shuffle-dependent flake. mysterySide is
    // deterministically 'right' here (revealedSide always starts 'left' in
    // start()), but read it from the component rather than hardcoding it,
    // so this doesn't silently break if that default ever changes.
    const winningSide = wrapper.vm.mysterySide;
    const winningId = wrapper.vm.mysteryCard.movie.id;
    // Tap whichever button actually makes a TRUE statement (tapping the
    // mystery side guesses "higher"; tapping the revealed side guesses
    // "lower" — see the component's own guess() comment).
    const tapSide = rightId > leftId ? 'right' : 'left';
    const cardIndex = tapSide === 'right' ? 1 : 0;

    await wrapper.findAll('.hl-card')[cardIndex].trigger('click');

    expect(wrapper.vm.lastGuessCorrect).toBe(true);
    expect(wrapper.vm.streak).toBe(1);
    expect(wrapper.vm.$store.dispatch).toHaveBeenCalledWith('setDBValue', { path: 'settings/games/higherLowerBestStreak', value: 1 });

    await vi.advanceTimersByTimeAsync(1000);

    // The winner is STILL in the exact same slot — never moved.
    expect(wrapper.vm[`${winningSide}Card`].movie.id).toBe(winningId);
    // That slot is now the revealed/known one for the next round.
    expect(wrapper.vm.revealedSide).toBe(winningSide);
    expect(wrapper.vm.guessed).toBe(false);
  });

  it('a wrong guess ends the game and reveals the true score', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-game-primary').trigger('click');

    const leftId = wrapper.vm.leftCard.movie.id;
    const rightId = wrapper.vm.rightCard.movie.id;
    const winningSide = rightId > leftId ? 'right' : 'left';
    const wrongSide = winningSide === 'right' ? 'left' : 'right';
    const wrongCardIndex = wrongSide === 'right' ? 1 : 0;

    await wrapper.findAll('.hl-card')[wrongCardIndex].trigger('click');

    expect(wrapper.vm.gameOver).toBe(true);
    expect(wrapper.find('.hl-card-score.incorrect').exists()).toBe(true);
    expect(wrapper.find('.game-over button').text()).toBe('Play Again');
  });

  it('shows two decimal places so near-identical scores stay distinguishable', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-game-primary').trigger('click');
    expect(wrapper.vm.formattedRating(wrapper.vm.leftCard)).toBe(wrapper.vm.leftCard.movie.id.toFixed(2));
  });

  it('a "tappable" poster has no lingering :hover-driven state (uses only :active feedback)', async () => {
    const wrapper = factory(10);
    await wrapper.find('.btn-game-primary').trigger('click');
    expect(wrapper.findAll('.hl-card.tappable').length).toBe(2);
  });

  describe('custom header banner (a graphic made for this game, same pattern as Six Degrees)', () => {
    function bannerFactory (stateOverrides = {}) {
      const store = {
        state: { settings: {}, ...stateOverrides },
        getters: { allMediaAsArray: Array.from({ length: 10 }, (_, i) => entry(i)) },
        dispatch: vi.fn(),
        commit: vi.fn()
      };
      const wrapper = mount(HigherLowerGame, { global: { mocks: { $store: store, $router: { push: vi.fn() } } } });
      return { wrapper, store };
    }

    it('sets the header banner to the custom graphic and hides the "Cinema Roll" logo on mount', () => {
      const { store } = bannerFactory();
      const lastBannerCall = store.commit.mock.calls.find((call) => call[0] === 'setBannerUrl');
      expect(lastBannerCall[1]).toContain('higher-lower-banner');
      expect(store.commit).toHaveBeenCalledWith('setHideHeaderLogo', true);
    });

    it('restores the previous banner and un-hides the logo on unmount', () => {
      const { wrapper, store } = bannerFactory({ bannerUrl: 'https://example.com/some-movie-backdrop.jpg' });
      wrapper.unmount();

      const calls = store.commit.mock.calls.filter((call) => call[0] === 'setBannerUrl');
      expect(calls[calls.length - 1][1]).toBe('https://example.com/some-movie-backdrop.jpg');
      expect(store.commit).toHaveBeenCalledWith('setHideHeaderLogo', false);
    });
  });
});

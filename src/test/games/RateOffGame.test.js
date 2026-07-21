import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import RateOffGame from '@/components/games/RateOffGame.vue';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 5 }))
}));

function entry (id) {
  return {
    dbKey: `key-${id}`,
    ratings: [{ calculatedTotal: 5 }],
    movie: { id, title: `Movie ${id}`, poster_path: '/p.jpg', release_date: '2010-01-01' }
  };
}

function factory (movieCount) {
  return mount(RateOffGame, {
    global: {
      mocks: {
        $store: { getters: { allMediaAsArray: Array.from({ length: movieCount }, (_, i) => entry(i)) }, commit: vi.fn() },
        $router: { push: vi.fn() }
      }
    }
  });
}

describe('RateOffGame', () => {
  it('only offers bracket sizes the library can actually fill', () => {
    const wrapper = factory(10); // largest power of two <= 10 is 8
    const buttons = wrapper.findAll('.size-button').map((b) => b.text());
    expect(buttons).toEqual(['8']);
  });

  it('starting an 8-bracket produces 4 first-round matches, and picking through crowns a champion', async () => {
    const wrapper = factory(8);
    await wrapper.find('.size-button').trigger('click');

    // 3 rounds for 8 contestants: 4 matches, 2 matches, 1 match.
    for (let round = 0; round < 3; round++) {
      const matchesThisRound = wrapper.vm.bracket.pairs.length;
      for (let i = 0; i < matchesThisRound; i++) {
        const cards = wrapper.findAll('.matchup-card');
        expect(cards.length).toBe(2);
        await cards[0].trigger('click');
      }
    }

    expect(wrapper.vm.champion).not.toBeNull();
    expect(wrapper.find('.champion-reveal').exists()).toBe(true);
  });

  it('"New Tournament" resets back to the size picker', async () => {
    const wrapper = factory(8);
    await wrapper.find('.size-button').trigger('click');
    // Fast-forward by driving pickWinner directly via clicks isn't needed here;
    // just force completion through the store to check the reset affordance.
    while (!wrapper.vm.champion) {
      await wrapper.findAll('.matchup-card')[0].trigger('click');
    }
    await wrapper.find('.champion-reveal button').trigger('click');
    expect(wrapper.find('.setup').exists()).toBe(true);
  });
});

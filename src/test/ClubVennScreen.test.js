import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import ClubVenn from '@/components/ClubVenn.vue';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((media) => ({ calculatedTotal: media?.ratings?.[0]?.calculatedTotal ?? 0 }))
}));

function movie (id, title, rating) {
  return {
    dbKey: `k${id}`,
    ratings: [{ calculatedTotal: rating, date: '2026-03-01' }],
    movie: { id, title, poster_path: `/${id}.jpg`, release_date: '2001-06-15' }
  };
}

function profileWith (name, ratings) {
  return { name, counts: { titles: Object.keys(ratings).length }, ratings };
}

function factory ({ profiles = {}, myEntries = [] } = {}) {
  const push = vi.fn();
  const wrapper = shallowMount(ClubVenn, {
    global: {
      mocks: {
        $store: {
          state: { settings: {} },
          getters: {
            allMoviesAsArray: myEntries,
            filmClubProfiles: profiles
          },
          dispatch: vi.fn(() => Promise.resolve())
        },
        $router: { push }
      }
    }
  });
  return { wrapper, push };
}

const PROFILES = {
  seth: profileWith('Seth', {
    1: { r: 9, t: 'Heat', p: '/1.jpg' },
    3: { r: 8.5, t: 'Ronin', p: '/3.jpg' }
  }),
  nat: profileWith('Nat', {
    1: { r: 7, t: 'Heat', p: '/1.jpg' },
    4: { r: 9, t: 'Clue', p: '/4.jpg' }
  })
};

describe('ClubVenn', () => {
  it('seeds the picker with you plus the first two friends', () => {
    const { wrapper } = factory({ profiles: PROFILES, myEntries: [movie(1, 'Heat', 8), movie(2, 'Cats', 4)] });

    expect(wrapper.vm.selectedKeys).toEqual(['you', 'seth', 'nat']);
    expect(wrapper.findAll('.cv-chip.selected')).toHaveLength(3);
  });

  it('caps the selection at three by dropping the oldest pick', () => {
    const { wrapper } = factory({ profiles: PROFILES, myEntries: [movie(1, 'Heat', 8)] });

    wrapper.vm.togglePerson('you'); // deselect
    wrapper.vm.togglePerson('you'); // reselect: now seth, nat, you
    wrapper.vm.togglePerson('seth'); // deselect seth
    wrapper.vm.togglePerson('seth'); // reselect: nat, you, seth
    expect(wrapper.vm.selectedKeys).toEqual(['nat', 'you', 'seth']);
  });

  it('lists only occupied regions and opens one from the legend', async () => {
    const { wrapper } = factory({ profiles: PROFILES, myEntries: [movie(1, 'Heat', 8), movie(2, 'Cats', 4)] });
    await wrapper.vm.$nextTick();

    // Movie 1 is in all three libraries; movie 2 only mine; 3 only Seth;
    // 4 only Nat. No pair-exclusive region is occupied.
    const labels = wrapper.findAll('.cv-legend-row .cv-legend-name').map((node) => node.text());
    expect(labels).toContain('You, Seth & Nat');
    expect(labels).not.toContain('You & Seth');

    const rows = wrapper.findAll('.cv-legend-row');
    const shared = rows[rows.length - 1];
    await shared.trigger('click');
    expect(wrapper.find('.cv-section-title').text()).toBe('You, Seth & Nat');
    expect(wrapper.findAll('.cv-poster-card')).toHaveLength(1);
  });

  it('re-cuts the same circles under the loved lens', async () => {
    const { wrapper } = factory({ profiles: PROFILES, myEntries: [movie(1, 'Heat', 8), movie(2, 'Cats', 4)] });

    wrapper.vm.setLens('loved');
    await wrapper.vm.$nextTick();

    // Nat's 7 on Heat fails the lens, so the triple region empties and
    // Heat becomes a You & Seth film. Cats (4) disappears entirely.
    const labels = wrapper.findAll('.cv-legend-row .cv-legend-name').map((node) => node.text());
    expect(labels).toContain('You & Seth');
    expect(labels).not.toContain('You, Seth & Nat');
    expect(labels).not.toContain('Only You');
  });

  it('navigates only for films in your own library; the rest get a hat ribbon', async () => {
    const { wrapper, push } = factory({ profiles: PROFILES, myEntries: [movie(1, 'Heat', 8)] });
    await wrapper.vm.$nextTick();

    // "Only Seth" (movie 3) — not in my library.
    wrapper.vm.selectRegion('seth');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'SendToHat' }).exists()).toBe(true);
    await wrapper.find('.cv-poster-card').trigger('click');
    expect(push).not.toHaveBeenCalled();

    // The shared region (movie 1) — in my library: navigates, no hat.
    wrapper.vm.selectRegion('you|seth|nat');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'SendToHat' }).exists()).toBe(false);
    await wrapper.find('.cv-poster-card').trigger('click');
    expect(push).toHaveBeenCalledWith('/movie/1');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import DBGridLayoutSearchResult from '@/components/DBGridLayoutSearchResult.vue';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 8, normalizedRating: 8, date: Date.now() })),
  getAllRatings: vi.fn(() => [])
}));

function makeResult (overrides = {}) {
  return {
    dbKey: 'abc123',
    movie: {
      id: 42,
      title: 'Test Movie',
      poster_path: '/p.jpg',
      release_date: '2020-01-01',
      ...overrides.movie
    },
    ratings: [{ calculatedTotal: 8, date: Date.now() }],
    ...overrides
  };
}

function mountGridItem (result, storeOverrides = {}) {
  return shallowMount(DBGridLayoutSearchResult, {
    props: { result, index: 0 },
    global: {
      mocks: {
        $store: {
          state: {
            settings: {},
            academyAwardWinners: {},
            ...storeOverrides.state
          },
          getters: {
            allMediaSortedByRating: [],
            allMediaAsArray: [],
            moviesWithPersonalAwardWins: new Set(),
            bestPictureWinnerIds: new Set(),
            ...storeOverrides.getters
          },
          commit: vi.fn(),
          dispatch: vi.fn()
        },
        $route: { query: {} },
        $router: { push: vi.fn() }
      },
      stubs: { Modal: true, InsetBrowserModal: true, ToggleableRating: true }
    }
  });
}

describe('DBGridLayoutSearchResult award badge', () => {
  it('shows no badge when the movie has no wins anywhere', () => {
    const wrapper = mountGridItem(makeResult());
    expect(wrapper.find('.award-badge').exists()).toBe(false);
  });

  it('shows the badge when the movie has a personal award win', () => {
    const wrapper = mountGridItem(makeResult(), {
      getters: { moviesWithPersonalAwardWins: new Set([42]) }
    });
    expect(wrapper.find('.award-badge').exists()).toBe(true);
  });

  it('shows the badge when the movie is a cached Best Picture winner', () => {
    const wrapper = mountGridItem(makeResult(), {
      getters: { bestPictureWinnerIds: new Set([42]) }
    });
    expect(wrapper.find('.award-badge').exists()).toBe(true);
  });

  it('shows the badge when the movie has a win in the static other-ceremonies dataset', () => {
    // "Parasite" (2019) is a real Palme d'Or winner in the bundled dataset —
    // see otherAwards.test.js for the same fixture used to test that module.
    const wrapper = mountGridItem(makeResult({ movie: { id: 99, title: 'Parasite', release_date: '2019-05-30' } }));
    expect(wrapper.find('.award-badge').exists()).toBe(true);
  });

  it('does not show the badge for a movie with only a nomination, not a win', () => {
    // "The Irishman" (2019) has a Golden Globe NOMINATION in the bundled
    // dataset (see otherAwards.test.js), no win, and isn't a personal or
    // Best Picture winner in this fixture — badge should stay hidden.
    const wrapper = mountGridItem(makeResult({ movie: { id: 100, title: 'The Irishman', release_date: '2019-11-01' } }));
    expect(wrapper.find('.award-badge').exists()).toBe(false);
  });
});

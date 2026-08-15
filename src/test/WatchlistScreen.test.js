import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import WatchlistScreen from '@/components/WatchlistScreen.vue';
import axios from 'axios';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((entry) => ({ calculatedTotal: entry.ratings[0]?.calculatedTotal }))
}));

const YEARS = 365.25 * 24 * 3600 * 1000;
const yearsAgo = (y) => Date.now() - y * YEARS;

function entry (id, title, { rating = 8.5, watched = yearsAgo(4), crew = [], cast = [] } = {}) {
  return {
    dbKey: `key-${id}`,
    movie: { id, title, poster_path: '/p.jpg', crew, cast },
    ratings: [{ calculatedTotal: rating, date: watched }]
  };
}

// Two loved movies each from one director and one actor, so both people
// clear favoritePeople's minMovies threshold.
function library () {
  const dir = [{ job: 'Director', name: 'Fave Director' }];
  const cast = [{ name: 'Fave Actor' }];
  return [
    entry(1, 'Old Favorite A', { crew: dir, cast }),
    entry(2, 'Old Favorite B', { crew: dir, cast }),
    entry(3, 'Recent One', { watched: yearsAgo(0.1) })
  ];
}

function tmdbImpl (url) {
  if (url.includes('/search/person')) {
    return Promise.resolve({ data: { results: [{ id: 777 }] } });
  }
  if (url.includes('/person/777/movie_credits')) {
    return Promise.resolve({
      data: {
        crew: [
          { id: 90, title: 'Unseen Gem', job: 'Director', release_date: '2018-06-15', vote_count: 5000, vote_average: 8.1 },
          { id: 1, title: 'Already Rated', job: 'Director', release_date: '2010-06-15', vote_count: 9000, vote_average: 8.4 }
        ],
        cast: [
          { id: 91, title: 'Unseen Performance', order: 1, release_date: '2019-06-15', vote_count: 4000, vote_average: 7.9 },
          { id: 92, title: 'Deep Cameo', order: 40, release_date: '2019-06-15', vote_count: 4000, vote_average: 7.9 }
        ]
      }
    });
  }
  return Promise.reject(new Error(`unexpected url ${url}`));
}

function factory ({ isOnline = true, movies = library() } = {}) {
  const pushSpy = vi.fn();
  const commitSpy = vi.fn();
  const wrapper = mount(WatchlistScreen, {
    global: {
      mocks: {
        $store: {
          state: { isOnline },
          getters: { allMoviesAsArray: movies },
          commit: commitSpy,
          dispatch: vi.fn()
        },
        $router: { push: pushSpy }
      }
    }
  });
  return { wrapper, pushSpy, commitSpy };
}

describe('WatchlistScreen (request: watchlists from my ratings + movies to consider rewatching)', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockImplementation(tmdbImpl);
  });

  it('shows loved-but-long-unwatched movies in the rewatch row, and not recent ones', async () => {
    const { wrapper } = factory();
    await flushPromises();

    const names = wrapper.findAll('.rewatch-name').map((n) => n.text());
    expect(names).toContain('Old Favorite A');
    expect(names).not.toContain('Recent One');
  });

  it('tapping a rewatch card opens that movie', async () => {
    const { wrapper, pushSpy } = factory();
    await flushPromises();

    await wrapper.find('.rewatch-card').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith(expect.stringMatching(/^\/movie\//));
  });

  it('builds the director and actor sections from TMDB, excluding rated movies and deep cameos', async () => {
    const { wrapper } = factory();
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('From directors you love');
    expect(text).toContain('Based on Fave Director');
    expect(text).toContain('Unseen Gem');
    expect(text).not.toContain('Already Rated');
    expect(text).toContain('Unseen Perfor'); // MediaResultGrid truncates >15 chars
    expect(text).not.toContain('Deep Cameo');
  });

  it('selecting a watchlist movie hands off to the normal rating flow', async () => {
    const { wrapper, pushSpy, commitSpy } = factory();
    await flushPromises();

    const card = wrapper.findAll('.media-result-grid .card').find((c) => c.text().includes('Unseen Gem'));
    await card.trigger('click');

    expect(commitSpy).toHaveBeenCalledWith('setMovieToRate', expect.objectContaining({ id: 90 }));
    expect(pushSpy).toHaveBeenCalledWith('/rate-movie');
  });

  it('offline: keeps the rewatch list, hides the TMDB sections, says why, and fetches nothing', async () => {
    const { wrapper } = factory({ isOnline: false });
    await flushPromises();

    expect(wrapper.findAll('.rewatch-card').length).toBeGreaterThan(0);
    expect(wrapper.text()).not.toContain('From directors you love');
    expect(wrapper.find('.watchlist-offline-note').exists()).toBe(true);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('a failed person lookup degrades to the other people instead of erroring the screen', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/search/person') && url.includes('Fave%20Director')) {
        return Promise.reject(new Error('network'));
      }
      return tmdbImpl(url);
    });
    const { wrapper } = factory();
    await flushPromises();

    expect(wrapper.text()).toContain('Unseen Perfor'); // actor section still built (grid truncates)
  });
});

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

function entry (id, title, { rating = 8.5, watched = yearsAgo(6), crew = [], cast = [] } = {}) {
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
  if (url.includes('/recommendations')) {
    return Promise.resolve({
      data: {
        results: [
          { id: 95, title: 'Similar Pick', release_date: '2021-06-15', vote_count: 8000, vote_average: 8.0 },
          { id: 1, title: 'Already Rated', release_date: '2010-06-15', vote_count: 9000, vote_average: 8.4 }
        ]
      }
    });
  }
  if (url.includes('/search/person')) {
    // TMDB always returns a gender (1 female, 2 male, 0 unspecified), and the
    // performer rows are split on it — a mock without one made every gendered
    // row come back empty.
    return Promise.resolve({ data: { results: [{ id: 777, gender: 2 }] } });
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

function factory ({ isOnline = true, movies = library(), dispatch = vi.fn() } = {}) {
  const pushSpy = vi.fn();
  const commitSpy = vi.fn();
  const wrapper = mount(WatchlistScreen, {
    global: {
      mocks: {
        $store: {
          state: { isOnline },
          getters: { allMoviesAsArray: movies },
          commit: commitSpy,
          dispatch
        },
        $router: { push: pushSpy }
      }
    }
  });
  return { wrapper, pushSpy, commitSpy, dispatch };
}

// Cards are poster-only now, so a card's accessible name is where the title
// lives (Matt, 2026-08-16: "posters are better than text").
const cardNames = (wrapper) => wrapper.findAll('.watchlist-card').map((card) => card.attributes('aria-label'));

describe('WatchlistScreen (request: watchlists from my ratings + movies to consider rewatching)', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockImplementation(tmdbImpl);
  });

  it('shows loved-but-long-unwatched movies in the rewatch row, and not recent ones', async () => {
    const { wrapper } = factory();
    await flushPromises();

    // Posters carry the identity now, so the title is the image's alt text
    // rather than a caption under it (Matt, 2026-08-16: "posters are better
    // than text").
    const names = cardNames(wrapper);
    expect(names).toContain('Old Favorite A');
    expect(names).not.toContain('Recent One');
  });

  it('tapping a rewatch card opens that movie', async () => {
    const { wrapper, pushSpy } = factory();
    await flushPromises();

    await wrapper.find('.watchlist-card').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith(expect.stringMatching(/^\/movie\//));
  });

  it('builds the director and actor sections from TMDB, excluding rated movies and deep cameos', async () => {
    const { wrapper } = factory();
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('From directors you love');
    expect(text).toContain('Based on Fave Director');

    const names = cardNames(wrapper);
    expect(names).toContain('Unseen Gem');
    expect(names).toContain('Unseen Performance');
    expect(names).not.toContain('Already Rated');
    expect(names).not.toContain('Deep Cameo');
  });

  it('pools TMDB recommendations from your top-rated movies into "More like your favorites"', async () => {
    const { wrapper } = factory();
    await flushPromises();

    expect(wrapper.text()).toContain('More like your favorites');

    const names = cardNames(wrapper);
    expect(names).toContain('Similar Pick');
    expect(names).not.toContain('Already Rated');
  });

  it('selecting a watchlist movie hands off to the normal rating flow', async () => {
    const { wrapper, pushSpy, commitSpy } = factory();
    await flushPromises();

    const card = wrapper.findAll('.watchlist-card')
      .find((candidate) => candidate.attributes('aria-label') === 'Unseen Gem');
    await card.trigger('click');

    expect(commitSpy).toHaveBeenCalledWith('setMovieToRate', expect.objectContaining({ id: 90 }));
    expect(pushSpy).toHaveBeenCalledWith('/rate-movie');
  });

  it('offline: keeps the rewatch list, hides the TMDB sections, says why, and fetches nothing', async () => {
    const { wrapper } = factory({ isOnline: false });
    await flushPromises();

    expect(wrapper.findAll('.watchlist-card').length).toBeGreaterThan(0);
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

// The learning loop is best-effort bookkeeping that runs after the lists are
// already on screen. It used to be two bare awaits in a row, so when
// reconciling threw — it was handed a Set where it expected an array, on
// every visit after the first — recording never ran again either, and the
// whole loop silently froze.
describe('WatchlistScreen learning loop', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockImplementation(tmdbImpl);
  });

  it('hands reconcile the rated ids and then records what it showed', async () => {
    const { dispatch } = factory();
    await flushPromises();

    const actions = dispatch.mock.calls.map(([action]) => action);
    expect(actions).toContain('reconcileWatchlistLearning');
    expect(actions).toContain('recordWatchlistSuggestions');

    // Whatever shape it is, reconcile has to be able to iterate it.
    const [, rated] = dispatch.mock.calls.find(([a]) => a === 'reconcileWatchlistLearning');
    expect(() => Array.from(rated)).not.toThrow();
  });

  it('still records suggestions when reconciling blows up', async () => {
    const dispatch = vi.fn((action) => {
      if (action === 'reconcileWatchlistLearning') return Promise.reject(new Error('boom'));
      return Promise.resolve();
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    factory({ dispatch });
    await flushPromises();

    expect(dispatch.mock.calls.map(([action]) => action)).toContain('recordWatchlistSuggestions');
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it('does not fail the page when recording blows up', async () => {
    const dispatch = vi.fn((action) => (
      action === 'recordWatchlistSuggestions'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve()
    ));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { wrapper } = factory({ dispatch });
    await flushPromises();

    // The lists are assigned before the learning loop runs, so they survive.
    expect(wrapper.findAll('.watchlist-card').length).toBeGreaterThan(0);
    errors.mockRestore();
  });
});

// "There should be a separate one for actors and actresses, and a third one
// for actors and actresses combined who I like more than most people."
// (2026-08-17) The library doesn't store gender — storedEntry.js trims it —
// so it comes from the same /search/person call the credits lookup already
// makes, and the id is reused rather than searched for twice.
describe('WatchlistScreen performer sections', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockImplementation(tmdbImpl);
  });

  it('splits performers by the gender TMDB reports', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/search/person')) {
        const female = url.includes('Fave%20Actor');
        return Promise.resolve({ data: { results: [{ id: 777, gender: female ? 1 : 2 }] } });
      }
      return tmdbImpl(url);
    });

    const { wrapper } = factory();
    await flushPromises();

    // Non-empty first: `every` on an empty array passes vacuously and would
    // have let a broken split through.
    expect(wrapper.vm.actressNames.map((p) => p.name)).toEqual(['Fave Actor']);
    expect(wrapper.vm.actressNames.every((p) => p.gender === 1)).toBe(true);
    expect(wrapper.vm.actorNames).toEqual([]);
  });

  // TMDB reports 0 for "not specified", and such a person belongs in neither
  // row. The row simply doesn't render rather than showing them wrongly.
  it('leaves ungendered people out of both gendered rows', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/search/person')) {
        return Promise.resolve({ data: { results: [{ id: 777, gender: 0 }] } });
      }
      return tmdbImpl(url);
    });

    const { wrapper } = factory();
    await flushPromises();

    expect(wrapper.vm.actressNames).toEqual([]);
    expect(wrapper.vm.actorNames).toEqual([]);
    expect(wrapper.text()).not.toContain('From actresses you love');
  });

  it('reuses the id it resolved instead of searching for the same name twice', async () => {
    const { wrapper } = factory();
    await flushPromises();

    const searches = axios.get.mock.calls
      .map(([url]) => url)
      .filter((url) => url.includes('/search/person') && url.includes('Fave%20Actor'));

    // One in the gender pass; the credits lookup takes the id from it.
    expect(searches).toHaveLength(1);
    expect(wrapper.vm.actorNames.every((p) => p.id === 777)).toBe(true);
  });
});

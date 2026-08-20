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

function factory ({ isOnline = true, movies = library(), dispatch = vi.fn(), movieHatMovieIds = {} } = {}) {
  const pushSpy = vi.fn();
  const commitSpy = vi.fn();
  const wrapper = mount(WatchlistScreen, {
    global: {
      mocks: {
        $store: {
          state: { isOnline, movieHatMovieIds },
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


// Bug report, 2026-08-19: "In any watchlist, if a movie is already present in
// one of my hats, it should not appear as a suggestion so that includes the
// rewatch watchlist. That includes any recommendations we have who includes
// all the years anything where we have a watchlist if I've already put it in a
// hat I don't need to be suggested that movie anymore."
describe('films already in a hat are not suggested again', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockImplementation(tmdbImpl);
  });

  it('drops a hatted film from the rewatch row', async () => {
    const before = factory({});
    await flushPromises();
    expect(cardNames(before.wrapper)).toContain('Old Favorite A');

    // Same library, but that film is now sitting in a hat.
    const after = factory({ movieHatMovieIds: { 1: true } });
    await flushPromises();

    expect(cardNames(after.wrapper)).not.toContain('Old Favorite A');
    // The rest of the row is untouched.
    expect(cardNames(after.wrapper)).toContain('Old Favorite B');
  });

  it('drops a hatted film from the TMDB-derived rows too', async () => {
    const before = factory({});
    await flushPromises();
    expect(cardNames(before.wrapper)).toContain('Similar Pick');

    // 95 is the recommendation's TMDB id, not a library dbKey — the rule has
    // to work on raw TMDB results as well as rated entries.
    const after = factory({ movieHatMovieIds: { 95: true } });
    await flushPromises();

    expect(cardNames(after.wrapper)).not.toContain('Similar Pick');
  });

  it('loads the hat contents itself rather than waiting for a button to mount', () => {
    const dispatch = vi.fn();
    factory({ dispatch });

    expect(dispatch).toHaveBeenCalledWith('ensureMovieHatContents');
  });

  it('suggests everything as normal when no hats hold anything', async () => {
    const { wrapper } = factory({ movieHatMovieIds: {} });
    await flushPromises();

    expect(cardNames(wrapper)).toContain('Old Favorite A');
  });
});

// Bug report, 2026-08-19: "How did you choose which years to include in the
// get it to 10 watchlist... it seems like an arbitrary number of lists. Maybe
// there's a way to combine those into a single list with like a year selector
// above it... and then, if you could see on each one of those selectors, how
// close we actually are so I can look at any given year."
describe('the "get a year to 10" picker', () => {
  // 1997 needs 1 more, 2003 needs 3, 1962 needs 9. Under the old rules 1962
  // was dropped outright (beyond a reach of 4).
  const yearMovie = (id, year) => ({
    dbKey: `y${id}`,
    movie: { id, title: `M${id}`, poster_path: '/p.jpg', release_date: `${year}-06-15`, runtime: 100, crew: [], cast: [] },
    ratings: [{ calculatedTotal: 7, date: yearsAgo(6) }]
  });

  const yearLibrary = () => [
    ...Array.from({ length: 9 }, (_, i) => yearMovie(i + 1, 1997)),
    ...Array.from({ length: 7 }, (_, i) => yearMovie(100 + i, 2003)),
    yearMovie(200, 1962)
  ];

  // Each year's discover call answers with a film named for the year asked
  // for, so which year is on screen is unambiguous.
  const discoverImpl = (url) => {
    const match = url.match(/primary_release_year=(\d{4})/);
    if (match) {
      return Promise.resolve({
        data: {
          results: [
            { id: Number(`9${match[1]}`), title: `Pick from ${match[1]}`, poster_path: '/p.jpg', release_date: `${match[1]}-03-10`, vote_count: 5000, vote_average: 8.2 }
          ]
        }
      });
    }
    return tmdbImpl(url);
  };

  const yearsAsked = () => axios.get.mock.calls
    .map(([url]) => url.match(/primary_release_year=(\d{4})/)?.[1])
    .filter(Boolean);

  beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockImplementation(discoverImpl);
  });

  it('offers every unfinished year in one selector, each labelled with how far off it is', async () => {
    const { wrapper } = factory({ movies: yearLibrary() });
    await flushPromises();

    const tabs = wrapper.findAll('.year-tab');
    expect(tabs.map((tab) => tab.find('.year-tab-year').text())).toEqual(['1997', '2003', '1962']);
    expect(tabs.map((tab) => tab.find('.year-tab-gap').text())).toEqual(['1 to go', '3 to go', '9 to go']);

    // One section, not one per year — the whole point of the report.
    expect(wrapper.findAll('.year-picker')).toHaveLength(1);
    expect(wrapper.text()).toContain('Get a year to 10');
  });

  it('opens on the closest-to-done year and fetches only that one', async () => {
    const { wrapper } = factory({ movies: yearLibrary() });
    await flushPromises();

    expect(wrapper.find('.year-tab.active .year-tab-year').text()).toBe('1997');
    expect(yearsAsked()).toEqual(['1997']);
    expect(cardNames(wrapper)).toContain('Pick from 1997');
    expect(cardNames(wrapper)).not.toContain('Pick from 2003');
  });

  it('tapping another year swaps the list to that year, fetching it on demand', async () => {
    const { wrapper } = factory({ movies: yearLibrary() });
    await flushPromises();

    await wrapper.findAll('.year-tab')[2].trigger('click');
    await flushPromises();

    expect(wrapper.find('.year-tab.active .year-tab-year').text()).toBe('1962');
    expect(yearsAsked()).toEqual(['1997', '1962']);
    expect(cardNames(wrapper)).toContain('Pick from 1962');
    expect(cardNames(wrapper)).not.toContain('Pick from 1997');
    expect(wrapper.text()).toContain('9 to go for awards');
  });

  it('going back to a year already looked at costs no second request', async () => {
    const { wrapper } = factory({ movies: yearLibrary() });
    await flushPromises();

    await wrapper.findAll('.year-tab')[1].trigger('click');
    await flushPromises();
    await wrapper.findAll('.year-tab')[0].trigger('click');
    await flushPromises();

    expect(yearsAsked()).toEqual(['1997', '2003']);
    expect(cardNames(wrapper)).toContain('Pick from 1997');
  });

  it('shows no picker at all when every year is either finished or untouched', async () => {
    const { wrapper } = factory();
    await flushPromises();

    expect(wrapper.find('.year-picker').exists()).toBe(false);
    expect(yearsAsked()).toEqual([]);
  });
});

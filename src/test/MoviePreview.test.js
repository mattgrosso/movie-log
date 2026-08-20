import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import MoviePreview from '@/components/MoviePreview.vue';
import axios from 'axios';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

// Bug report, 2026-08-20: "If a movie is presented in a watchlist or in film
// club and it's one that I have not yet rated... just clicking the poster
// should pull up some kind of a summary of the movie so that I can
// investigate further."
const DETAILS = {
  id: 90,
  title: 'Unseen Gem',
  poster_path: '/g.jpg',
  overview: 'A quiet film about a loud man.',
  release_date: '2018-06-15',
  runtime: 114,
  vote_average: 7.8,
  genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }],
  // Appended onto the details call rather than fetched separately.
  credits: {
    crew: [
      { job: 'Producer', name: 'Some Producer' },
      { job: 'Director', name: 'Real Director' }
    ],
    cast: [
      { name: 'Second Billed', order: 1 },
      { name: 'Top Billed', order: 0 },
      { name: 'Third Billed', order: 2 }
    ]
  },
  release_dates: {
    results: [{ iso_3166_1: 'US', release_dates: [{ certification: '' }, { certification: 'R' }] }]
  }
};

const PROVIDERS = {
  results: {
    US: {
      link: 'https://tmdb/watch/90',
      flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg' }]
    }
  }
};

// Faithful to TMDB on the point that matters here: `credits` and
// `release_dates` come back ONLY when append_to_response asks for them. A mock
// that hands them over regardless would let the director/cast/certification
// tests pass against a component that never requested them — which is exactly
// how this suite behaved until it was checked by reverting the fix.
const impl = ({ details = DETAILS, providers = PROVIDERS } = {}) => (url) => {
  if (url.includes('/watch/providers')) {
    return providers ? Promise.resolve({ data: providers }) : Promise.reject(new Error('nope'));
  }
  if (!details) return Promise.reject(new Error('nope'));

  const appended = (url.match(/append_to_response=([^&]*)/)?.[1] || '').split(',').filter(Boolean);
  const body = { ...details };
  ['credits', 'release_dates'].forEach((key) => {
    if (!appended.includes(key)) delete body[key];
  });
  return Promise.resolve({ data: body });
};

const factory = (movie = { id: 90, title: 'Unseen Gem' }, { filmClubProfiles = {} } = {}) =>
  mount(MoviePreview, {
    props: { movie },
    global: {
      stubs: { teleport: true },
      mocks: { $store: { getters: { filmClubProfiles } } }
    }
  });

// Lookups are cached per TMDB id for the life of the page (module scope, so it
// survives an unmount — a row invites tapping the same poster twice). That
// cache is shared by every test in this file, so any test wanting DIFFERENT
// data for a movie has to use an id of its own.
let nextId = 1000;
const freshId = () => (nextId += 1);

describe('MoviePreview', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockImplementation(impl());
  });

  afterEach(() => {
    // The sheet holds <html>/<body> overflow while open; a leaked lock would
    // make every later test's document unscrollable.
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  });

  it('renders nothing until a movie is set', () => {
    const wrapper = factory(null);

    expect(wrapper.find('.mp-sheet').exists()).toBe(false);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('shows the summary a suggestion row cannot: overview, runtime, genres, score', async () => {
    const wrapper = factory();
    await flushPromises();

    expect(wrapper.find('.mp-title').text()).toBe('Unseen Gem');
    expect(wrapper.find('.mp-overview').text()).toBe('A quiet film about a loud man.');
    expect(wrapper.find('.mp-genres').text()).toBe('Drama, Crime');
    expect(wrapper.find('.mp-score').text()).toContain('7.8');
  });

  // "Let's add director and cast and some other pertinent details to the
  // unrated movie drawer" (2026-08-20).
  describe('who made it and what it is rated', () => {
    it('names the director and the top-billed cast, in billing order', async () => {
      const wrapper = factory();
      await flushPromises();

      const people = wrapper.findAll('.mp-people').map((p) => p.text());
      expect(people[0]).toContain('Director');
      expect(people[0]).toContain('Real Director');
      expect(wrapper.find('.mp-cast').text()).toContain('Top Billed, Second Billed, Third Billed');
    });

    it('pluralises the label for a co-directed film and keeps both names', async () => {
      const id = freshId();
      axios.get.mockImplementation(impl({
        details: {
          ...DETAILS,
          id,
          credits: { crew: [{ job: 'Director', name: 'Joel' }, { job: 'Director', name: 'Ethan' }], cast: [] }
        }
      }));
      const wrapper = factory({ id, title: 'Unseen Gem' });
      await flushPromises();

      const directors = wrapper.find('.mp-people').text();
      expect(directors).toContain('Directors');
      expect(directors).toContain('Joel, Ethan');
    });

    it('puts the content rating alongside the year and runtime', async () => {
      const wrapper = factory();
      await flushPromises();

      expect(wrapper.find('.mp-fact-line').text()).toBe('2018 · 114 min · R');
    });

    it('leaves the rating out entirely when TMDB has none, rather than showing a gap', async () => {
      const id = freshId();
      axios.get.mockImplementation(impl({
        details: { ...DETAILS, id, release_dates: { results: [] } }
      }));
      const wrapper = factory({ id, title: 'Unseen Gem' });
      await flushPromises();

      expect(wrapper.find('.mp-fact-line').text()).toBe('2018 · 114 min');
    });

    it('asks for credits and certification on the existing details call, not two more requests', async () => {
      const id = freshId();
      axios.get.mockImplementation(impl({ details: { ...DETAILS, id } }));
      factory({ id, title: 'Unseen Gem' });
      await flushPromises();

      const urls = axios.get.mock.calls.map(([url]) => url);
      expect(urls).toHaveLength(2);
      expect(urls.some((url) => url.includes('append_to_response=credits,release_dates'))).toBe(true);
    });
  });

  // The app's own signal, and it costs no request — the club profiles are
  // already in memory.
  describe('what the film club made of it', () => {
    const profiles = {
      a: { name: 'Natalie', ratings: { 90: { r: 9.2 } } },
      b: { name: 'Brian', ratings: { 90: { r: 8.44 } } },
      c: { name: 'Seth', ratings: { 12: { r: 7 } } }
    };

    it('lists the friends who have rated it, best first, at the app precision', async () => {
      const wrapper = factory({ id: 90, title: 'Unseen Gem' }, { filmClubProfiles: profiles });
      await flushPromises();

      const chips = wrapper.findAll('.mp-club-chip').map((chip) => chip.text());
      expect(chips).toEqual(['Natalie 9.20', 'Brian 8.44']);
    });

    it('shows nothing at all when nobody in the club has seen it', async () => {
      const wrapper = factory({ id: 90, title: 'Unseen Gem' }, { filmClubProfiles: { c: profiles.c } });
      await flushPromises();

      expect(wrapper.find('.mp-club').exists()).toBe(false);
    });

    it('survives a bare store, which several mounts stub', async () => {
      const wrapper = mount(MoviePreview, {
        props: { movie: { id: 90, title: 'Unseen Gem' } },
        global: { stubs: { teleport: true }, mocks: { $store: {} } }
      });
      await flushPromises();

      expect(wrapper.find('.mp-club').exists()).toBe(false);
      expect(wrapper.find('.mp-title').text()).toBe('Unseen Gem');
    });
  });

  // "Can I actually watch it" is half of deciding whether to bother, so it is
  // in the same sheet rather than behind a second tap.
  it('shows where it is streaming, in the same sheet', async () => {
    const wrapper = factory();
    await flushPromises();

    expect(wrapper.find('.mp-logo').attributes('alt')).toBe('Netflix');
    // TMDB requires the JustWatch credit wherever availability is displayed.
    expect(wrapper.find('.mp-credit').text()).toContain('JustWatch');
  });

  it('offers rating as a deliberate second step, handing back the original source object', async () => {
    const source = { id: 90, title: 'Unseen Gem', fromRow: true };
    const wrapper = factory({ id: 90, title: 'Unseen Gem', source });
    await flushPromises();

    await wrapper.find('.mp-rate').trigger('click');

    expect(wrapper.emitted('rate')[0]).toEqual([source]);
  });

  it('closes on the backdrop and on the X', async () => {
    const wrapper = factory();
    await flushPromises();

    await wrapper.find('.mp-close').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);

    await wrapper.find('.mp-backdrop').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(2);
  });

  // One failing half must not blank the other.
  it('still shows the summary when availability fails', async () => {
    const id = freshId();
    axios.get.mockImplementation(impl({ details: { ...DETAILS, id }, providers: null }));
    const wrapper = factory({ id, title: 'Unseen Gem' });
    await flushPromises();

    expect(wrapper.find('.mp-overview').exists()).toBe(true);
    expect(wrapper.find('.mp-logo').exists()).toBe(false);
  });

  it('says so when the details cannot be loaded at all', async () => {
    axios.get.mockImplementation(impl({ details: null, providers: null }));
    const wrapper = factory({ id: freshId(), title: 'Unseen Gem' });
    await flushPromises();

    expect(wrapper.find('.mp-status').text()).toContain("Couldn't load");
  });

  // TMDB's 0 means "nobody has voted", not "everybody hated it".
  it('treats a zero vote average as no score rather than a 0.0', async () => {
    const id = freshId();
    axios.get.mockImplementation(impl({ details: { ...DETAILS, id, vote_average: 0 } }));
    const wrapper = factory({ id, title: 'Unseen Gem' });
    await flushPromises();

    expect(wrapper.find('.mp-score').exists()).toBe(false);
  });

  it('caches per movie, so tapping the same poster twice costs one lookup', async () => {
    const wrapper = factory();
    await flushPromises();
    const afterFirst = axios.get.mock.calls.length;

    await wrapper.setProps({ movie: null });
    await wrapper.setProps({ movie: { id: 90, title: 'Unseen Gem' } });
    await flushPromises();

    expect(axios.get.mock.calls.length).toBe(afterFirst);
    expect(wrapper.find('.mp-overview').exists()).toBe(true);
  });

  // The row this opens from scrolls sideways; a sheet that lets the page
  // behind it move was already reported once for WhereToWatch.
  it('holds the page still while it is open, and lets go on close', async () => {
    const wrapper = factory();
    await flushPromises();

    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');

    await wrapper.setProps({ movie: null });

    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('');
  });

  it('does not leave the page locked if it is torn down while open', async () => {
    const wrapper = factory();
    await flushPromises();
    expect(document.documentElement.style.overflow).toBe('hidden');

    wrapper.unmount();

    expect(document.documentElement.style.overflow).toBe('');
  });
});

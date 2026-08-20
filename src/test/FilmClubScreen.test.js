import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import FilmClubScreen from '@/components/FilmClubScreen.vue';
import SettingsSection from '@/components/SettingsSection.vue';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((media) => ({ calculatedTotal: media?.ratings?.[0]?.calculatedTotal ?? 0 }))
}));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function myMovie (id, title, rating) {
  return {
    dbKey: `k${id}`,
    ratings: [{ calculatedTotal: rating, date: Date.now() - DAY }],
    movie: { id, title, poster_path: `/${id}.jpg`, release_date: '2001-06-15' }
  };
}

function factory ({ profiles = {}, myEntries = [] } = {}) {
  return shallowMount(FilmClubScreen, {
    global: {
      stubs: { SettingsSection: false, BackLink: true },
      mocks: {
        $store: {
          state: {
            settings: {},
            federatedDirectory: [],
            federatedDirectoryLoading: false,
            socialDirectory: {},
            socialRequests: {},
            clubInbox: {}
          },
          getters: {
            socialSettings: { enabled: true, displayName: 'Matt' },
            crossAppDiscoveryEnabled: false,
            allMoviesAsArray: myEntries,
            filmClubProfiles: profiles,
            filmClubFriends: Object.entries(profiles).map(([key, profile]) => ({
              key, name: profile.name, profile, external: false
            })),
            socialFriendKeys: Object.keys(profiles),
            socialUserKey: 'me',
            socialPendingSentKeys: []
          },
          dispatch: vi.fn(() => Promise.resolve()),
          commit: vi.fn()
        },
        $route: { query: {} },
        $router: { push: vi.fn() }
      }
    }
  });
}

const PROFILES = {
  brian: {
    name: 'Brian',
    counts: { titles: 2 },
    ratings: { 1: { r: 9 }, 2: { r: 3 } },
    recent: [{ id: 1, t: 'Heat', p: '/1.jpg', r: 9, at: Date.now() - 3 * HOUR }]
  }
};

describe('FilmClubScreen', () => {
  // "I have to scroll pretty far down before I can, like, select a friend and
  // look at what they've got going on." (Matt, 2026-08-16)
  it('puts the friends list above the club-wide lists', () => {
    const wrapper = factory({ profiles: PROFILES, myEntries: [myMovie(1, 'Heat', 8), myMovie(2, 'Cats', 9)] });
    const titles = wrapper.findAll('.cs-section-title').map((title) => title.text());

    const friends = titles.indexOf('Friends');
    const favorites = titles.indexOf('Club favorites');

    expect(friends).toBeGreaterThanOrEqual(0);
    expect(favorites).toBeGreaterThan(friends);
  });

  it('keeps the recently-watched feed at the very top', () => {
    const wrapper = factory({ profiles: PROFILES, myEntries: [myMovie(1, 'Heat', 8)] });
    const titles = wrapper.findAll('.cs-section-title').map((title) => title.text());

    expect(titles[0]).toBe('Recently watched');
  });

  it('says how long ago each viewing was', () => {
    const wrapper = factory({ profiles: PROFILES, myEntries: [myMovie(1, 'Heat', 8)] });

    expect(wrapper.find('.cs-poster-when').text()).toBe('3 hours ago');
    expect(wrapper.vm.watchedAgo(null)).toBeNull();
  });

  // "It feels like it takes up too much space vertically. Let's give that its
  // own little section in a independent scrolling."
  it('scrolls the club favorites and most-divisive lists in place', () => {
    const wrapper = factory({ profiles: PROFILES, myEntries: [myMovie(1, 'Heat', 8), myMovie(2, 'Cats', 9)] });

    expect(wrapper.findAll('.cs-scroll-list').length).toBe(2);
  });

  // "The sections about... finding friends in other apps, and finding people
  // [should] be somehow their own, like, maybe collapsible accordion."
  it('collapses the finding-people sections, and leaves Friends open', () => {
    const wrapper = factory({ profiles: PROFILES, myEntries: [myMovie(1, 'Heat', 8)] });
    const accordions = wrapper.findAllComponents(SettingsSection);

    expect(accordions.map((section) => section.props('title')))
      .toEqual(['Friends on other apps', 'Find people']);
    accordions.forEach((section) => {
      expect(section.props('collapsible')).toBe(true);
      expect(section.props('startOpen')).toBe(false);
    });

    // Friends is a plain section, not one of the accordions.
    expect(wrapper.findAll('.cs-section-title').map((t) => t.text())).toContain('Friends');
  });
});

// "Clicking a poster on the recent friends feed takes me to that movie in my
// db. But if I haven't seen that movie, it should instead take me nowhere.
// But we should have the universal 'add to hat' button on it so I can add it
// to a hat." (2026-08-17)
//
// MovieDetail is a pure lookup in YOUR library, so a friend's film you've
// never rated rendered an empty page rather than saying anything useful.
describe('FilmClubScreen feed taps', () => {
  const seenAndUnseen = {
    brian: {
      name: 'Brian',
      counts: { titles: 2 },
      ratings: { 1: { r: 9 }, 7: { r: 8 } },
      recent: [
        { id: 1, t: 'Heat', p: '/1.jpg', r: 9, at: Date.now() - 2 * HOUR },
        { id: 7, t: 'Unseen By Me', p: '/7.jpg', r: 8, at: Date.now() - 3 * HOUR }
      ]
    }
  };

  function feedScreen () {
    return factory({ profiles: seenAndUnseen, myEntries: [myMovie(1, 'Heat', 8)] });
  }

  it('opens a movie that is in your library', () => {
    const wrapper = feedScreen();
    const push = wrapper.vm.$router.push;

    wrapper.vm.openFeedItem({ id: 1, t: 'Heat' });

    expect(push).toHaveBeenCalledWith('/movie/1');
  });

  // Bug report, 2026-08-20: "if it's one that I have not yet rated... just
  // clicking the poster should pull up some kind of a summary of the movie so
  // that I can investigate further." This used to do nothing at all — a dead
  // poster — because MovieDetail is a local lookup and would render an empty
  // page for a film you've never rated.
  it('opens a summary for a movie you have never rated, rather than nothing at all', () => {
    const wrapper = feedScreen();
    const push = wrapper.vm.$router.push;

    wrapper.vm.openFeedItem({ id: 7, t: 'Unseen By Me', p: '/u.jpg' });

    expect(wrapper.vm.previewing).toMatchObject({ id: 7, title: 'Unseen By Me', poster_path: '/u.jpg' });
    // Still not navigating — the empty detail page is what this avoids.
    expect(push).not.toHaveBeenCalled();
  });

  it('hands the summary a hat-shaped movie, so rating from it has real fields', () => {
    const wrapper = feedScreen();

    wrapper.vm.openFeedItem({ id: 7, t: 'Unseen By Me', p: '/u.jpg' });

    expect(wrapper.vm.previewing.source).toMatchObject({ id: 7, title: 'Unseen By Me', poster_path: '/u.jpg' });
  });

  it('rating from the summary closes it and hands off to the rating flow', () => {
    const wrapper = feedScreen();
    const push = wrapper.vm.$router.push;
    const commit = wrapper.vm.$store.commit;

    wrapper.vm.openFeedItem({ id: 7, t: 'Unseen By Me', p: '/u.jpg' });
    wrapper.vm.rateFromPreview(wrapper.vm.previewing.source);

    expect(commit).toHaveBeenCalledWith('setMovieToRate', expect.objectContaining({ id: 7 }));
    expect(push).toHaveBeenCalledWith('/rate-movie');
    expect(wrapper.vm.previewing).toBeNull();
  });

  it('knows which feed items are in your library', () => {
    const wrapper = feedScreen();

    expect(wrapper.vm.inMyLibrary(1)).toBe(true);
    expect(wrapper.vm.inMyLibrary(7)).toBe(false);
    expect(wrapper.vm.inMyLibrary(null)).toBe(false);
  });

  // A feed item is a bare {id,t,p}, not a library entry — toHatMovie takes
  // either, but it reads TMDB field names.
  it('converts a feed item into something the hat understands', () => {
    const wrapper = feedScreen();

    expect(wrapper.vm.hatMovieFor({ id: 7, t: 'Unseen By Me', p: '/7.jpg' }))
      .toMatchObject({ id: 7, title: 'Unseen By Me', poster_path: '/7.jpg' });
  });

  // Two decimals, always (bug report 2026-08-18). 8.25 used to render as
  // "8.3" here, which is a score Brian never gave anything.
  it('labels the hat note with who watched it and what they gave it', () => {
    const wrapper = feedScreen();

    expect(wrapper.vm.feedNote({ friendName: 'Brian', r: 8.25 }))
      .toBe('Brian watched this (8.25)');
    expect(wrapper.vm.feedNote({ friendName: 'Brian', r: null }))
      .toBe('Brian watched this');
  });
});

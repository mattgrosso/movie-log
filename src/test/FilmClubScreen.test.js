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

import {
  describe, it, expect, vi
} from 'vitest';
import { mount } from '@vue/test-utils';
import Home from '@/components/Home.vue';

// Two bug reports from 2026-08-22, both about the personal-awards prompt.
//
// Natalie: "Yesterday I changed my personal award number so that I only need
// three movies and I haven't gotten a pop-up because even though I know that
// for example 1997 has three movies." The setting was honoured everywhere
// except the gate that decides whether the prompt appears at all, which
// carried its own hardcoded `>= 10`.
//
// Matt: "Is it just once a day... I'm just curious if I will see more than one
// prompt for personal awards per day and maybe that's a setting we ought to be
// able to do kind of like we do for tiebreakers. Maybe we ought to go ahead
// and set that for stickiness and personal awards."
vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }));
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((media) => {
    const rating = (media?.ratings && media.ratings[0]) || {};
    return { ...rating, calculatedTotal: rating.calculatedTotal ?? 8, normalizedRating: 8 };
  }),
  getAllRatings: vi.fn(() => [])
}));

const HOUR = 60 * 60 * 1000;
const LONG_AGO = new Date(Date.now() - 60 * 24 * HOUR).toISOString();

// A feature-length 1997 film, rated long ago (so it also sits in the
// stickiness queue, which the stickiness cases below need).
const film = (id) => ({
  dbKey: `k-${id}`,
  movie: {
    id,
    title: `Film ${id}`,
    release_date: '1997-06-15',
    runtime: 110,
    genres: [{ name: 'Drama' }],
    cast: [],
    crew: [],
    production_companies: [],
    keywords: []
  },
  ratings: [{ calculatedTotal: 8, date: LONG_AGO }]
});

// Exactly three — Natalie's number, and well under the default ten.
const THREE_FROM_1997 = [film(1), film(2), film(3)];

function mountHome ({ library = THREE_FROM_1997, settings = {} } = {}) {
  const store = {
    state: {
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: { bestPicture: [] },
      settings: {
        normalizationTweak: 0.25,
        tieBreakTweak: 1,
        includeShorts: false,
        tags: { 'viewing-tags': {} },
        lastTweak: 1,
        ...settings
      },
      filteredResults: [],
      homePageScrollPosition: 0,
      homePageSearchChips: [],
      homePageSearchValue: '',
      homePageNumberOfResults: 25,
      homePageNavigationIntent: null,
      homePageSortValue: null,
      homePageSortOrder: null,
      homePagePromoteGroup: null
    },
    getters: {
      allMediaAsArray: library, allMoviesAsArray: library, allMediaSortedByRating: library
    },
    commit: vi.fn(),
    dispatch: vi.fn()
  };

  return mount(Home, {
    global: {
      mocks: { $store: store, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: {
        DBGridLayoutSearchResult: true,
        NoResults: true,
        StickinessModal: true,
        TweakModal: true,
        InsetBrowserModal: true
      }
    }
  });
}

describe('the awards prompt honours the year threshold setting', () => {
  it('offers a three-film year once the threshold is lowered to three', () => {
    const wrapper = mountHome({ settings: { awardsYearThreshold: 3 } });

    expect(wrapper.vm.shouldShowAwardsModal).toBe(true);
  });

  it('leaves that same year alone at the default ten', () => {
    const wrapper = mountHome();

    expect(wrapper.vm.shouldShowAwardsModal).toBe(false);
  });

  it('a raised threshold puts a year back out of reach', () => {
    const wrapper = mountHome({ settings: { awardsYearThreshold: 4 } });

    expect(wrapper.vm.shouldShowAwardsModal).toBe(false);
  });
});

describe('how often the awards prompt may appear', () => {
  const eligible = (extra) => ({ awardsYearThreshold: 3, ...extra });

  it('defaults to one a day', () => {
    const justNow = mountHome({ settings: eligible({ lastAwardsPromptAt: Date.now() - HOUR }) });
    expect(justNow.vm.shouldShowAwardsModal).toBe(false);

    const yesterday = mountHome({ settings: eligible({ lastAwardsPromptAt: Date.now() - 25 * HOUR }) });
    expect(yesterday.vm.shouldShowAwardsModal).toBe(true);
  });

  it('three a day spaces them eight hours apart', () => {
    const settings = { awardsPromptsPerDay: 3, lastAwardsPromptAt: Date.now() - 9 * HOUR };
    expect(mountHome({ settings: eligible(settings) }).vm.shouldShowAwardsModal).toBe(true);

    const tooSoon = { awardsPromptsPerDay: 3, lastAwardsPromptAt: Date.now() - 2 * HOUR };
    expect(mountHome({ settings: eligible(tooSoon) }).vm.shouldShowAwardsModal).toBe(false);
  });

  it('zero turns the prompt off entirely', () => {
    const wrapper = mountHome({ settings: eligible({ awardsPromptsPerDay: 0 }) });

    expect(wrapper.vm.shouldShowAwardsModal).toBe(false);
  });

  // Every existing account carries only the date string, so it has to keep
  // meaning what it always meant without a migration.
  it('still reads a legacy completion stamped today as "already done today"', () => {
    const wrapper = mountHome({
      settings: eligible({ lastAwardCompletionDate: new Date().toDateString() })
    });

    expect(wrapper.vm.shouldShowAwardsModal).toBe(false);
  });
});

describe('how often the stickiness prompt may appear', () => {
  it('is unlimited unless the user sets a number', () => {
    const wrapper = mountHome({ settings: { lastStickinessPromptAt: Date.now() } });

    expect(wrapper.vm.resultsThatNeedStickiness.length).toBeGreaterThan(0);
    expect(wrapper.vm.activeModalType).toBe('stickiness');
  });

  it('holds off once a daily cap has been used up', () => {
    const wrapper = mountHome({
      settings: { stickinessPromptsPerDay: 1, lastStickinessPromptAt: Date.now() - HOUR }
    });

    // Still films waiting — the quota is what is holding the prompt back.
    expect(wrapper.vm.resultsThatNeedStickiness.length).toBeGreaterThan(0);
    expect(wrapper.vm.activeModalType).not.toBe('stickiness');
  });

  it('comes back once the interval has passed', () => {
    const wrapper = mountHome({
      settings: { stickinessPromptsPerDay: 1, lastStickinessPromptAt: Date.now() - 25 * HOUR }
    });

    expect(wrapper.vm.activeModalType).toBe('stickiness');
  });
});

import {
  describe, it, expect, vi, beforeEach
} from 'vitest';
import { shallowMount, mount } from '@vue/test-utils';
import MovieDetail from '@/components/MovieDetail.vue';
import Home from '@/components/Home.vue';

// Matt, 2026-08-19, after Natalie's tag report: "My concern is that clicking on
// any item on a movie detail page may lead to this same problem. Can you please
// make sure that all the links on a movie detail page that force a search
// trigger the search properly?"
//
// So this drives EVERY search-triggering link on the detail page end to end:
// click the link on a real MovieDetail, take what it actually commits, hand
// that to a real Home, and check the movie you clicked from comes back along
// with its genuine siblings — and that a decoy sharing only the WORD does not.
//
// The two paths differ, which is the whole reason the tag one broke alone:
//   - searchFor()    → a free-text search (chips cleared) + a promoted group.
//   - searchForTag() → a real typed chip, type 'tag'.
vi.mock('axios', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: {} })), post: vi.fn(() => Promise.resolve({ data: {} })) }
}));
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }));
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((media) => {
    const r = (media?.ratings && media.ratings[0]) || {};
    return { ...r, calculatedTotal: r.calculatedTotal ?? 5, normalizedRating: r.normalizedRating ?? 5 };
  }),
  getAllRatings: vi.fn(() => [])
}));
// ErrorLogService is deliberately NOT mocked: Home calls more of its surface
// than MovieDetail does (getLogs among them), and a partial stub fails the
// mount outright. The real one just collects entries in memory.

// The movie every link is clicked FROM.
const SUBJECT = {
  dbKey: 'subject',
  movie: {
    id: 42,
    title: 'Nightfall Over Kyoto',
    release_date: '1995-05-20',
    genres: [{ name: 'Thriller' }],
    cast: [{ name: 'Ada Lumen', character: 'Ada' }],
    crew: [
      { name: 'Jane Director', job: 'Director' },
      { name: 'Joe Writer', job: 'Writer' },
      { name: 'Mel Composer', job: 'Original Music Composer' },
      { name: 'Ed Cutter', job: 'Editor' },
      { name: 'Phil Lens', job: 'Director of Photography' },
      { name: 'Pat Money', job: 'Producer' }
    ],
    production_companies: [{ name: 'Lantern Pictures' }],
    keywords: [{ name: 'heist' }]
  },
  ratings: [{ calculatedTotal: 8.5, date: '2023-01-01', tags: [{ title: 'DARK' }] }]
};

// A genuine sibling: shares every dimension with SUBJECT, shares no words with
// it in any other field.
const SIBLING = {
  dbKey: 'sibling',
  movie: {
    id: 43,
    title: 'The Quiet Sun',
    release_date: '1995-08-01',
    genres: [{ name: 'Thriller' }],
    cast: [{ name: 'Ada Lumen', character: 'Ada' }],
    crew: [
      { name: 'Jane Director', job: 'Director' },
      { name: 'Joe Writer', job: 'Writer' },
      { name: 'Mel Composer', job: 'Original Music Composer' },
      { name: 'Ed Cutter', job: 'Editor' },
      { name: 'Phil Lens', job: 'Director of Photography' },
      { name: 'Pat Money', job: 'Producer' }
    ],
    production_companies: [{ name: 'Lantern Pictures' }],
    keywords: [{ name: 'heist' }]
  },
  ratings: [{ calculatedTotal: 7.5, date: '2023-02-01', tags: [{ title: 'DARK' }] }]
};

// Shares NOTHING but words in its title. Must never come back for any link.
const DECOY = {
  dbKey: 'decoy',
  movie: {
    id: 44,
    title: 'Heist of the Lantern Thriller: Ada Jane Joe Mel Ed Phil Pat',
    release_date: '2011-01-01',
    genres: [{ name: 'Comedy' }],
    cast: [{ name: 'Nobody Else', character: 'Nobody' }],
    crew: [{ name: 'Someone Different', job: 'Director' }],
    production_companies: [{ name: 'Other Studio' }],
    keywords: [{ name: 'unrelated' }]
  },
  ratings: [{ calculatedTotal: 6, date: '2023-03-01', tags: [] }]
};

const LIBRARY = [SUBJECT, SIBLING, DECOY];

function detailPage () {
  const commits = [];
  const store = {
    state: { movieLog: {}, settings: { tags: { 'viewing-tags': {} } }, academyAwardWinners: {} },
    getters: { allMoviesAsArray: LIBRARY, allMediaAsArray: LIBRARY },
    commit: vi.fn((name, payload) => commits.push([name, payload])),
    dispatch: vi.fn()
  };
  const wrapper = shallowMount(MovieDetail, {
    global: {
      mocks: { $store: store, $route: { params: { tmdbId: '42' }, query: {} }, $router: { push: vi.fn() } },
      stubs: { ToggleableRating: true, Modal: true }
    }
  });
  return { wrapper, commits };
}

// Replays what the detail page committed onto a real Home, the way the router
// hand-off does, and returns the titles actually rendered.
async function renderHomeFrom (commits) {
  const committed = Object.fromEntries(commits);
  const store = {
    state: {
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: { bestPicture: [] },
      settings: {
        normalizationTweak: 0.25, tieBreakTweak: 1, includeShorts: false, tags: { 'viewing-tags': {} }
      },
      filteredResults: [],
      homePageScrollPosition: 0,
      homePageSearchChips: committed.setHomePageSearchChips || [],
      homePageSearchValue: committed.setHomePageSearchValue || '',
      homePageNumberOfResults: 25,
      homePageNavigationIntent: committed.setHomePageNavigationIntent || null,
      homePageSortValue: null,
      homePageSortOrder: null,
      homePagePromoteGroup: committed.setHomePagePromoteGroup || null
    },
    getters: {
      allMediaAsArray: LIBRARY, allMoviesAsArray: LIBRARY, allMediaSortedByRating: LIBRARY
    },
    commit: vi.fn(),
    dispatch: vi.fn()
  };

  const home = mount(Home, {
    global: {
      mocks: { $store: store, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: {
        DBGridLayoutSearchResult: {
          template: '<div data-testid="r">{{ result.movie.title }}</div>',
          props: ['result', 'keywordCounts', 'allCounts', 'index', 'resultsAreFiltered', 'sortValue', 'activeQuickLinkList']
        },
        NoResults: true, StickinessModal: true, TweakModal: true, InsetBrowserModal: true
      }
    }
  });

  // A free-text hand-off runs through updateSearchValue, exactly as typing
  // does — setting inputValue alone only fills the box (see Home's mounted,
  // and the Insights bug report it cites).
  const incoming = committed.setHomePageSearchValue;
  if (incoming) {
    home.vm.inputValue = incoming;
    home.vm.updateSearchValue(incoming);
  }
  await home.vm.$nextTick();
  await home.vm.$nextTick();

  return home.findAll('[data-testid="r"]').map((n) => n.text());
}

// Every link on the page that forces a search, as (label, how it is clicked).
const LINKS = [
  ['director', (vm) => vm.searchFor('Jane Director', 'director')],
  ['cast', (vm) => vm.searchFor('Ada Lumen', 'cast')],
  ['genre', (vm) => vm.searchFor('Thriller', 'genre')],
  ['keyword', (vm) => vm.searchFor('heist', 'keyword')],
  ['company', (vm) => vm.searchFor('Lantern Pictures', 'company')],
  ['writer', (vm) => vm.searchFor('Joe Writer', 'writer')],
  ['composer', (vm) => vm.searchFor('Mel Composer', 'composer')],
  ['editor', (vm) => vm.searchFor('Ed Cutter', 'editor')],
  ['cinematographer', (vm) => vm.searchFor('Phil Lens', 'photo')],
  ['producer', (vm) => vm.searchFor('Pat Money', 'producer')],
  ['tag', (vm) => vm.searchForTag('DARK')]
];

describe('every search link on a movie detail page', () => {
  let page;

  beforeEach(async () => {
    page = detailPage();
    await page.wrapper.setData({ result: SUBJECT, movie: SUBJECT.movie });
  });

  it.each(LINKS)('%s finds the movies that really share it', async (label, click) => {
    click(page.wrapper.vm);
    const rendered = await renderHomeFrom(page.commits);

    expect(rendered, `${label}: the movie you clicked from`).toContain('Nightfall Over Kyoto');
    expect(rendered, `${label}: its genuine sibling`).toContain('The Quiet Sun');
  });

  it.each(LINKS)('%s does not drag in a title that merely says the word', async (label, click) => {
    click(page.wrapper.vm);
    const rendered = await renderHomeFrom(page.commits);

    // The decoy shares only words in its title — no genre, cast, crew,
    // company, keyword or tag in common with the subject.
    expect(rendered.join(' | '), `${label}: decoy leaked in`)
      .not.toContain('Heist of the Lantern Thriller');
  });

  it('sends a tag as a typed chip, and everything else as a free-text search', () => {
    const tagPage = detailPage();
    tagPage.wrapper.setData({ result: SUBJECT, movie: SUBJECT.movie });
    tagPage.wrapper.vm.searchForTag('DARK');
    const tagCommits = Object.fromEntries(tagPage.commits);

    expect(tagCommits.setHomePageSearchChips).toEqual([
      expect.objectContaining({ type: 'tag', value: 'DARK' })
    ]);
    expect(tagCommits.setHomePageSearchValue).toBe('');

    const genrePage = detailPage();
    genrePage.wrapper.setData({ result: SUBJECT, movie: SUBJECT.movie });
    genrePage.wrapper.vm.searchFor('Thriller', 'genre');
    const genreCommits = Object.fromEntries(genrePage.commits);

    // Chips CLEARED and a plain term set — this is why the tag link was the
    // only one that hit the grouping bug.
    expect(genreCommits.setHomePageSearchChips).toEqual([]);
    expect(genreCommits.setHomePageSearchValue).toBe('Thriller');
  });
});

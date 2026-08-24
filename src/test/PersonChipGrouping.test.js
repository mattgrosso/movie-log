import {
  describe, it, expect, vi, beforeEach
} from 'vitest';
import { mount } from '@vue/test-utils';
import Home from '@/components/Home.vue';
import {
  personNameMatcher, crewRoleKey, personRolesFor, groupByPersonRole
} from '@/assets/javascript/personRoleGroups.js';

// Bug report from Matt, 2026-08-23: "I'm afraid that we've lost our sections
// in the search results. I've searched for Stephen Spielberg and his
// direction, acting, and production are all smooshed."
//
// His diagnostics: chips ["person:Steven Spielberg"], resultsMatched 45,
// grouped: false. Grouping had been switched off for every typed chip by
// d4580ec, which was fixing Natalie's tag:DARK report — that commit even
// predicted this complaint in its own message.
//
// The reason grouping had to go was that it RE-SEARCHED the chip's bare value
// across Title / Director / Cast / Producer / Company / Keywords, which showed
// films the chip itself excluded. So the fix for people is not "turn it back
// on": it's to partition the flat results instead of searching again. The
// fixtures below are built so that a re-search would be caught — a film TITLED
// after the person, which he had nothing to do with.

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('lodash/debounce', () => ({ default: vi.fn((fn) => fn) }));
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 8.25, normalizedRating: 8 })),
  getAllRatings: vi.fn(() => [])
}));

const movie = (id, title, { cast = [], crew = [] } = {}) => ({
  movie: {
    id,
    title,
    release_date: '1999-05-05',
    genres: [{ name: 'Drama' }],
    cast: cast.map((name) => ({ name, character: 'Role' })),
    crew,
    production_companies: [{ name: 'A Studio' }],
    flatKeywords: []
  },
  ratings: [{ calculatedTotal: 8.5, date: '2023-01-01', tags: [] }],
  dbKey: `movie-${id}`
});

const SPIELBERG = 'Steven Spielberg';

const DIRECTED = movie(1, 'Jaws', { crew: [{ name: SPIELBERG, job: 'Director' }] });
// Both roles on one film. Which section claims it is a priority decision.
const DIRECTED_AND_PRODUCED = movie(2, 'Schindler\'s List', {
  crew: [{ name: SPIELBERG, job: 'Director' }, { name: SPIELBERG, job: 'Producer' }]
});
const PRODUCED = movie(3, 'Back to the Future', {
  crew: [{ name: SPIELBERG, job: 'Executive Producer' }]
});
const ACTED = movie(4, 'Austin Powers', { cast: [SPIELBERG] });
// The trap: his name is the TITLE, and he is not in it. A re-search puts this
// on screen; a partition cannot.
const NAMED_AFTER_HIM = movie(5, 'Spielberg: A Retrospective', {
  crew: [{ name: 'Susan Lacy', job: 'Director' }]
});
const UNRELATED = movie(6, 'The Quiet Sun', {
  crew: [{ name: 'Some Director', job: 'Director' }]
});

const mockMovies = [DIRECTED, DIRECTED_AND_PRODUCED, PRODUCED, ACTED, NAMED_AFTER_HIM, UNRELATED];

function mountHome () {
  const mockStore = {
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
        tags: { 'viewing-tags': {} }
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
      allMediaAsArray: mockMovies,
      allMoviesAsArray: mockMovies,
      allMediaSortedByRating: mockMovies
    },
    commit: vi.fn(),
    dispatch: vi.fn()
  };

  return mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: {
        DBGridLayoutSearchResult: {
          template: '<div data-testid="db-grid-result">{{ result.movie.title }}</div>',
          props: ['result', 'keywordCounts', 'allCounts', 'index', 'resultsAreFiltered', 'sortValue', 'activeQuickLinkList']
        },
        NoResults: true,
        StickinessModal: true,
        TweakModal: true,
        InsetBrowserModal: true
      }
    }
  });
}

describe('personNameMatcher', () => {
  // The direction matters: it's the CREDITED name that gets reduced to a
  // surname, so a "Spielberg" chip finds Steven Spielberg's credits. A chip
  // carrying the full name matches the full credit. (Same as
  // FILTER_KINDS.person — it has to be, or the sections would partition a
  // different set than the one on screen.)
  it('matches the whole credited name, or its surname against a one-word chip', () => {
    expect(personNameMatcher('Steven Spielberg')('steven spielberg')).toBe(true);
    expect(personNameMatcher('Spielberg')('steven spielberg')).toBe(true);
  });

  // Substring matching is what the free-text groups use, and it is wrong here:
  // it would put Harrison Ford's films under a John Ford chip.
  it('does not match a different person who shares a surname', () => {
    const matches = personNameMatcher('John Ford');
    expect(matches('harrison ford')).toBe(false);
  });

  it('is safe on an empty value', () => {
    expect(personNameMatcher('')('anyone')).toBe(false);
    expect(personNameMatcher(null)('anyone')).toBe(false);
  });
});

describe('crewRoleKey', () => {
  it('reads the common credits', () => {
    expect(crewRoleKey('Director')).toBe('director');
    expect(crewRoleKey('Executive Producer')).toBe('producer');
    expect(crewRoleKey('Screenplay')).toBe('writer');
    expect(crewRoleKey('Original Music Composer')).toBe('music');
    expect(crewRoleKey('Film Editor')).toBe('editor');
  });

  // The ordering trap. Both contain "Director" as a word.
  it('does not read a photography or casting credit as directing', () => {
    expect(crewRoleKey('Director of Photography')).toBe('cinematographer');
    expect(crewRoleKey('Casting Director')).toBe('crew');
  });

  it('falls back to Crew for anything unrecognised', () => {
    expect(crewRoleKey('Best Boy')).toBe('crew');
    expect(crewRoleKey('')).toBe('crew');
  });
});

describe('personRolesFor', () => {
  it('collects every role one person holds on a film', () => {
    expect([...personRolesFor(DIRECTED_AND_PRODUCED, SPIELBERG)].sort())
      .toEqual(['director', 'producer']);
  });

  it('finds nobody in a film they had nothing to do with', () => {
    expect(personRolesFor(NAMED_AFTER_HIM, SPIELBERG).size).toBe(0);
  });
});

describe('groupByPersonRole', () => {
  const order = ['title', 'director', 'cast', 'producer', 'company'];
  const group = (results) => groupByPersonRole(results, SPIELBERG, { order });

  it('splits one person into their roles', () => {
    const sections = group([DIRECTED, PRODUCED, ACTED]);
    expect(sections.map((s) => s.category)).toEqual(['director', 'cast', 'producer']);
    expect(sections.map((s) => s.categoryDisplay)).toEqual(['Director', 'Cast', 'Producer']);
  });

  // The property that makes this safe: it is a PARTITION. Every film in,
  // exactly once, and nothing that wasn't handed in.
  it('places every film exactly once', () => {
    const input = [DIRECTED, DIRECTED_AND_PRODUCED, PRODUCED, ACTED];
    const placed = group(input).flatMap((s) => s.movies);
    expect(placed).toHaveLength(input.length);
    expect(new Set(placed).size).toBe(input.length);
  });

  it('gives a multi-role film to the highest-priority section', () => {
    const sections = group([DIRECTED_AND_PRODUCED]);
    expect(sections).toHaveLength(1);
    expect(sections[0].category).toBe('director');
  });

  it('follows a reordered group order', () => {
    const sections = groupByPersonRole([DIRECTED_AND_PRODUCED], SPIELBERG, {
      order: ['producer', 'director']
    });
    expect(sections[0].category).toBe('producer');
  });

  it('never invents a film that was not handed to it', () => {
    const titles = group([DIRECTED]).flatMap((s) => s.movies).map((m) => m.movie.title);
    expect(titles).not.toContain('Spielberg: A Retrospective');
  });

  it('is safe on junk', () => {
    expect(groupByPersonRole([], SPIELBERG, { order })).toEqual([]);
    expect(groupByPersonRole(null, SPIELBERG, { order })).toEqual([]);
    expect(groupByPersonRole([DIRECTED], '', { order })).toEqual([]);
  });
});

describe('a person chip', () => {
  let wrapper;

  beforeEach(async () => {
    wrapper = mountHome();
    await wrapper.vm.$nextTick();
    wrapper.vm.activeFilters.push({
      id: 'person-1', type: 'person', value: SPIELBERG, display: SPIELBERG
    });
    await wrapper.vm.$nextTick();
  });

  // The report, asserted the way he wrote it.
  it('splits his direction, acting and production into sections', () => {
    const sections = wrapper.vm.groupedByAllCategories;
    expect(sections).not.toBe(null);
    expect(sections.map((s) => s.categoryDisplay)).toEqual(['Director', 'Cast', 'Producer']);
  });

  it('still shows every film the flat filter found, and no more', () => {
    const flat = wrapper.vm.unifiedFilteredResults.length;
    const grouped = wrapper.vm.groupedByAllCategories.flatMap((s) => s.movies).length;
    expect(grouped).toBe(flat);
  });

  // The regression the wholesale switch-off was protecting against. Grouping
  // is back on for people, so this has to be re-proved, not assumed.
  it('does not leak the documentary merely named after him', () => {
    const rendered = wrapper.findAll('[data-testid="db-grid-result"]').map((n) => n.text());
    expect(rendered).not.toContain('Spielberg: A Retrospective');
    expect(rendered).toContain('Jaws');
  });
});

// The tag fix must survive all of this: people are the exception, not the
// new rule.
describe('the chips that still must not group', () => {
  it.each([
    ['tag', 'DARK'],
    ['genre', 'Drama'],
    ['keyword', 'heist'],
    ['company', 'A Studio']
  ])('a %s chip stays flat', async (type, value) => {
    const wrapper = mountHome();
    await wrapper.vm.$nextTick();
    wrapper.vm.activeFilters.push({
      id: `${type}-1`, type, value, display: value
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.groupedByAllCategories).toBe(null);
  });
});

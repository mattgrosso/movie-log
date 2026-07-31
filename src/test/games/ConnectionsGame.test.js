import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import ConnectionsGame from '@/components/games/ConnectionsGame.vue';
import { buildCandidateCategories } from '@/assets/javascript/games/connectionsGenerator.js';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 5 }))
}));

// The "not enough movies" gate now renders NewRatingSearch (suggestionsMode),
// which fetches TMDB popular movies in its own mounted() hook.
vi.mock('axios', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { results: [] } })) }
}));

function entry ({ id, director, genre, year, cast = [] }) {
  return {
    dbKey: `key-${id}`,
    ratings: [{ calculatedTotal: 5 }],
    movie: {
      id,
      title: `Movie ${id}`,
      poster_path: '/p.jpg',
      release_date: `${year}-06-15`,
      crew: [{ name: director, job: 'Director' }],
      genres: [{ name: genre }],
      cast: cast.map((name) => ({ name }))
    }
  };
}

// Same clean, non-overlapping 4x4 fixture shape as connectionsGenerator.test.js.
function buildSolvableLibrary () {
  const entries = [];
  for (let i = 0; i < 4; i++) entries.push(entry({ id: `a-${i}`, director: 'Director A', genre: 'Drama', year: 2000 + i, cast: [`Actor A${i}`] }));
  for (let i = 0; i < 4; i++) entries.push(entry({ id: `b-${i}`, director: `Solo Director ${i}`, genre: 'Science Fiction', year: 2010 + i, cast: [`Actor B${i}`] }));
  for (let i = 0; i < 4; i++) entries.push(entry({ id: `c-${i}`, director: `Another Director ${i}`, genre: `Unique Genre ${i}`, year: 1990 + i, cast: [`Actor C${i}`] }));
  for (let i = 0; i < 4; i++) entries.push(entry({ id: `d-${i}`, director: `Yet Another Director ${i}`, genre: `Different Genre ${i}`, year: 2020 + i, cast: ['Shared Star'] }));
  return entries;
}

function factory (mediaEntries) {
  return mount(ConnectionsGame, {
    global: {
      mocks: {
        $store: { state: {}, getters: { allMediaAsArray: mediaEntries }, commit: vi.fn() },
        $router: { push: vi.fn() }
      }
    }
  });
}

describe('ConnectionsGame', () => {
  // Fixtures across tests in this file reuse the same dbKeys
  // (buildSolvableLibrary is identical every call), so persisted state from
  // one test could otherwise leak into and change the outcome of the next
  // one — same guard ReelWordleGame's/SixDegreesGame's tests use for the
  // same reason.
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows a gate message when the library cannot support a full puzzle', () => {
    const wrapper = factory([]);
    expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
  });

  it('offers "help me get started" quick-pick suggestions on the gate (bug report)', () => {
    const wrapper = factory([]);
    expect(wrapper.find('.not-enough-movies .new-rating-search').exists()).toBe(true);
  });

  it('renders 16 tiles across 4 unsolved categories on a solvable library', () => {
    const library = buildSolvableLibrary();
    const wrapper = factory(library);
    expect(wrapper.vm.puzzle).not.toBeNull();
    expect(wrapper.findAll('.tile').length).toBe(16);
    expect(wrapper.vm.puzzle.categories).toHaveLength(4);
  });

  it('toggling exactly the 4 tiles of a real category (via the same toggleTile a click calls) and submitting solves it', async () => {
    const wrapper = factory(buildSolvableLibrary());
    const category = wrapper.vm.puzzle.categories[0];

    category.keys.forEach((key) => wrapper.vm.toggleTile(key));
    expect(wrapper.vm.selectedKeys.slice().sort()).toEqual(category.keys.slice().sort());
    wrapper.vm.submitGuess();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.solvedLabels).toContain(category.label);
    expect(wrapper.vm.mistakes).toBe(0);
    expect(wrapper.find('.solved-group').exists()).toBe(true);
  });

  it('a wrong guess (4 tiles spanning more than one category) counts as a mistake', async () => {
    const wrapper = factory(buildSolvableLibrary());
    const [catA, catB] = wrapper.vm.puzzle.categories;
    wrapper.vm.selectedKeys = [catA.keys[0], catA.keys[1], catB.keys[0], catB.keys[1]];
    wrapper.vm.submitGuess();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.mistakes).toBe(1);
    expect(wrapper.vm.solvedLabels).toEqual([]);
  });

  it('a wrong guess reports how many of the 4 picks actually belonged together, and labels which ones', async () => {
    const wrapper = factory(buildSolvableLibrary());
    const [catA, catB] = wrapper.vm.puzzle.categories;
    // 2 from catA, 2 from catB -> best overlap is 2.
    wrapper.vm.selectedKeys = [catA.keys[0], catA.keys[1], catB.keys[0], catB.keys[1]];
    wrapper.vm.submitGuess();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.lastGuessFeedback).toBe('2 of those share group 1 — now labeled below.');
    expect(wrapper.find('.guess-feedback').text()).toBe('2 of those share group 1 — now labeled below.');

    // The two overlapping tiles are labeled with that group number...
    expect(wrapper.vm.tileHints[catA.keys[0]].number).toBe(1);
    expect(wrapper.vm.tileHints[catA.keys[1]].number).toBe(1);
    // ...and the other two picks (from the OTHER category) are not.
    expect(wrapper.vm.tileHints[catB.keys[0]]).toBeUndefined();
    const badge = wrapper.findAll('.tile-hint-badge');
    expect(badge.length).toBe(2);
    expect(badge[0].text()).toBe('1');
  });

  it('a second wrong guess touching a DIFFERENT category gets its own hint number, and re-touching the first extends it', async () => {
    const wrapper = factory(buildSolvableLibrary());
    const [catA, catB, catC] = wrapper.vm.puzzle.categories;

    // Guess 1: unambiguously touches catA (3 of 4 from catA, 1 from catB).
    wrapper.vm.selectedKeys = [catA.keys[0], catA.keys[1], catA.keys[2], catB.keys[0]];
    wrapper.vm.submitGuess();

    // Guess 2: unambiguously touches catB (3 of 4 from catB, 1 from catC).
    wrapper.vm.selectedKeys = [catB.keys[0], catB.keys[1], catB.keys[2], catC.keys[0]];
    wrapper.vm.submitGuess();

    expect(wrapper.vm.categoryHintNumbers[catA.label]).toBe(1);
    expect(wrapper.vm.categoryHintNumbers[catB.label]).toBe(2);

    // Guess 3: reveals catA's 4th member (tied 2-2 with catC, but catA was
    // discovered first so it wins the tie) — extends group 1, no new number.
    wrapper.vm.selectedKeys = [catA.keys[3], catA.keys[0], catC.keys[1], catC.keys[2]];
    wrapper.vm.submitGuess();

    expect(wrapper.vm.tileHints[catA.keys[3]].number).toBe(1);
    expect(wrapper.vm.categoryHintNumbers[catA.label]).toBe(1);
  });

  it('selecting/deselecting a tile clears any stale guess feedback', async () => {
    const wrapper = factory(buildSolvableLibrary());
    const [catA, catB] = wrapper.vm.puzzle.categories;
    wrapper.vm.selectedKeys = [catA.keys[0], catA.keys[1], catB.keys[0], catB.keys[1]];
    wrapper.vm.submitGuess();
    expect(wrapper.vm.lastGuessFeedback).toBeTruthy();

    wrapper.vm.toggleTile(wrapper.vm.remainingTiles[0].key);
    expect(wrapper.vm.lastGuessFeedback).toBeNull();
  });

  it('has no guess limit — many wrong guesses in a row never end the game (bug report: "get rid of the limited number of guesses")', async () => {
    const wrapper = factory(buildSolvableLibrary());
    const [catA, catB] = wrapper.vm.puzzle.categories;
    const wrongGuess = [catA.keys[0], catA.keys[1], catB.keys[0], catB.keys[1]];

    for (let i = 0; i < 10; i++) {
      wrapper.vm.selectedKeys = wrongGuess;
      wrapper.vm.submitGuess();
    }
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.mistakes).toBe(10);
    expect(wrapper.vm.status).toBe('playing');
    expect(wrapper.vm.solvedLabels).toEqual([]);
    // Still playable — a real correct guess afterward still solves it.
    wrapper.vm.selectedKeys = [...catA.keys];
    wrapper.vm.submitGuess();
    expect(wrapper.vm.solvedLabels).toContain(catA.label);
  });

  it('winning shows the win banner once every category is solved', async () => {
    const wrapper = factory(buildSolvableLibrary());
    for (const category of wrapper.vm.puzzle.categories) {
      wrapper.vm.selectedKeys = [...category.keys];
      wrapper.vm.submitGuess();
    }
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.status).toBe('won');
    expect(wrapper.find('.result-banner.won').exists()).toBe(true);
  });

  it('toggling a tile past 4 selections is a no-op', () => {
    const wrapper = factory(buildSolvableLibrary());
    const keys = wrapper.vm.remainingTiles.slice(0, 5).map((t) => t.key);
    keys.forEach((key) => wrapper.vm.toggleTile(key));
    expect(wrapper.vm.selectedKeys).toHaveLength(4);
  });

  it('shows a generic category-kind legend up front, without spoiling this puzzle\'s actual 4 categories', () => {
    const wrapper = factory(buildSolvableLibrary());
    const legend = wrapper.find('.category-legend').text();
    expect(legend).toContain('Decade');
    expect(legend).toContain('Genre');
    expect(legend).toContain('Director');
    expect(legend).toContain('Cast');
    expect(legend).toContain('Keyword');
  });

  it('tiles no longer show a title caption below the poster', () => {
    const wrapper = factory(buildSolvableLibrary());
    expect(wrapper.find('.tile-title').exists()).toBe(false);
  });

  it('a solved group is colored by its difficulty tier', async () => {
    const wrapper = factory(buildSolvableLibrary());
    const category = wrapper.vm.puzzle.categories[0];
    category.keys.forEach((key) => wrapper.vm.toggleTile(key));
    wrapper.vm.submitGuess();
    await wrapper.vm.$nextTick();

    const group = wrapper.find('.solved-group');
    expect(group.attributes('style')).toContain('border-color');
  });

  it('a solved group keeps showing its 4 posters (not just a text summary) — bug report: "the posters just seemed to vanish"', async () => {
    const wrapper = factory(buildSolvableLibrary());
    const category = wrapper.vm.puzzle.categories[0];
    category.keys.forEach((key) => wrapper.vm.toggleTile(key));
    wrapper.vm.submitGuess();
    await wrapper.vm.$nextTick();

    const group = wrapper.find('.solved-group');
    expect(group.findAll('.solved-tile').length).toBe(4);
    expect(group.findAll('.solved-tile img').length).toBe(4);
    // Solving those tiles removes them from the still-playing grid below.
    const remainingKeys = wrapper.vm.remainingTiles.map((t) => t.key);
    category.keys.forEach((key) => expect(remainingKeys).not.toContain(key));
  });

  it('adds another solved-group row each time a category is solved, all staying visible', async () => {
    const wrapper = factory(buildSolvableLibrary());
    const [catA, catB] = wrapper.vm.puzzle.categories;

    wrapper.vm.selectedKeys = [...catA.keys];
    wrapper.vm.submitGuess();
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.solved-group').length).toBe(1);

    wrapper.vm.selectedKeys = [...catB.keys];
    wrapper.vm.submitGuess();
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.solved-group').length).toBe(2);
    // The first group's posters are still there, not replaced.
    expect(wrapper.findAll('.solved-tile img').length).toBe(8);
  });

  describe('awards category wiring (feature request: "let\'s say it\'s wins only, and let\'s include Academy Awards and personal awards"; kept separate per follow-up — "they should be separate. So only match movies within each award")', () => {
    function awardWinners (idPrefix, count, year) {
      return Array.from({ length: count }, (_, i) => entry({ id: `${idPrefix}-${i}`, director: `${idPrefix}D${i}`, genre: `${idPrefix}G${i}`, year: year + i }));
    }

    // Real puzzle generation only keeps 4 of potentially many candidate
    // categories (buildSolvableLibrary alone already offers several tier-3
    // candidates — director, cast, awards all share a tier), so whether
    // "awards" specifically wins its slot in any ONE random puzzle isn't
    // deterministic without a seeded rng the component doesn't expose.
    // These tests instead confirm the WIRING — that the component derives
    // awardsData from the store correctly and feeds it all the way through
    // to a real candidate — by calling the pure buildCandidateCategories
    // directly with the component's own derived state, same as
    // connectionsGenerator.test.js does at the unit level.
    it('builds awardsData.allAcademyAwards from the store so "Won Best Picture (Academy)" is a real candidate', () => {
      const bpWinners = awardWinners('bp', 4, 1985);
      const library = [...buildSolvableLibrary(), ...bpWinners];
      const allAcademyAwards = bpWinners.map((e) => ({ id: `${e.movie.id}-bp`, tmdb: String(e.movie.id), category: 'Best Picture', isWinner: true }));
      const wrapper = mount(ConnectionsGame, {
        global: {
          mocks: {
            $store: {
              state: { settings: {}, allAcademyAwards },
              getters: { allMediaAsArray: library },
              commit: vi.fn()
            },
            $router: { push: vi.fn() }
          }
        }
      });

      expect(wrapper.vm.awardsData.allAcademyAwards).toEqual(allAcademyAwards);
      const candidates = buildCandidateCategories(wrapper.vm.eligibleGameEntries, wrapper.vm.awardsData);
      const category = candidates.find((c) => c.label === 'Won Best Picture (Academy)');
      expect(category).toBeTruthy();
      expect(category.movies).toHaveLength(4);
    });

    it('builds awardsData from settings.personalAwards so "Won Best Director (The Groskers)" is a real candidate, kept separate from any Academy category', () => {
      const winners = awardWinners('pd', 4, 1995);
      const library = [...buildSolvableLibrary(), ...winners];
      const personalAwards = {};
      winners.forEach((e, i) => { personalAwards[2000 + i] = { categories: { bestDirector: { winner: { movieId: e.movie.id } } } }; });

      const wrapper = mount(ConnectionsGame, {
        global: {
          mocks: {
            $store: {
              // Bug report: the personal-award label used to read a
              // generic "(Personal)" - it now uses the user's OWN name for
              // their awards, read from settings.personalAwardName.
              state: { settings: { personalAwards, personalAwardName: 'Groskers' } },
              getters: { allMediaAsArray: library },
              commit: vi.fn()
            },
            $router: { push: vi.fn() }
          }
        }
      });

      const candidates = buildCandidateCategories(wrapper.vm.eligibleGameEntries, wrapper.vm.awardsData);
      const category = candidates.find((c) => c.label === 'Won Best Director (The Groskers)');
      expect(category).toBeTruthy();
      expect(category.movies).toHaveLength(4);
      expect(candidates.some((c) => c.label === 'Won Best Director (Academy)')).toBe(false);
    });

    it('tolerates missing awards data entirely (cold direct navigation before it loads) without throwing', () => {
      const library = buildSolvableLibrary();
      const wrapper = mount(ConnectionsGame, {
        global: {
          mocks: {
            $store: { state: {}, getters: { allMediaAsArray: library }, commit: vi.fn() },
            $router: { push: vi.fn() }
          }
        }
      });

      expect(wrapper.vm.puzzle).not.toBeNull();
      expect(wrapper.vm.awardsData.allAcademyAwards).toEqual([]);
      expect(wrapper.vm.awardsData.personalAwards).toEqual({});
    });

    it('shows "Awards" in the category-kind legend', () => {
      const wrapper = factory(buildSolvableLibrary());
      expect(wrapper.text()).toContain('Awards');
    });
  });

  describe('progress persistence (bug report: "I had like one match going and then today I opened it... it was gone and it reset")', () => {
    it('restores a solved category, mistakes, and hints across a remount', async () => {
      const library = buildSolvableLibrary();
      const wrapperA = factory(library);
      const category = wrapperA.vm.puzzle.categories[0];
      category.keys.forEach((key) => wrapperA.vm.toggleTile(key));
      wrapperA.vm.submitGuess();
      await wrapperA.vm.$nextTick();
      expect(wrapperA.vm.solvedLabels).toContain(category.label);

      const [otherA, otherB] = wrapperA.vm.puzzle.categories.filter((c) => c.label !== category.label);
      wrapperA.vm.selectedKeys = [otherA.keys[0], otherA.keys[1], otherB.keys[0], otherB.keys[1]];
      wrapperA.vm.submitGuess();
      await wrapperA.vm.$nextTick();
      expect(wrapperA.vm.mistakes).toBe(1);

      // A brand new mount (fresh component instance) against the SAME
      // library (same dbKeys), so restoration can re-resolve every tile.
      const wrapperB = factory(library);
      expect(wrapperB.vm.solvedLabels).toEqual(wrapperA.vm.solvedLabels);
      expect(wrapperB.vm.mistakes).toBe(1);
      expect(wrapperB.vm.categoryHintNumbers).toEqual(wrapperA.vm.categoryHintNumbers);
      expect(wrapperB.vm.puzzle.categories).toEqual(wrapperA.vm.puzzle.categories);
      expect(wrapperB.vm.puzzle.tiles.map((t) => t.key)).toEqual(wrapperA.vm.puzzle.tiles.map((t) => t.key));
    });

    it('does NOT resume a fully solved (won) puzzle — starts a fresh one instead', async () => {
      const library = buildSolvableLibrary();
      const wrapperA = factory(library);
      for (const category of wrapperA.vm.puzzle.categories) {
        category.keys.forEach((key) => wrapperA.vm.toggleTile(key));
        wrapperA.vm.submitGuess();
        await wrapperA.vm.$nextTick();
      }
      expect(wrapperA.vm.status).toBe('won');

      const wrapperB = factory(library);
      expect(wrapperB.vm.status).toBe('playing');
      expect(wrapperB.vm.solvedLabels).toEqual([]);
    });

    it('"New Puzzle" overwrites the saved state rather than leaving stale progress behind', async () => {
      const library = buildSolvableLibrary();
      const wrapperA = factory(library);
      const category = wrapperA.vm.puzzle.categories[0];
      category.keys.forEach((key) => wrapperA.vm.toggleTile(key));
      wrapperA.vm.submitGuess();
      await wrapperA.vm.$nextTick();
      expect(wrapperA.vm.solvedLabels).toHaveLength(1);

      wrapperA.vm.start();
      expect(wrapperA.vm.solvedLabels).toEqual([]);

      const wrapperB = factory(library);
      expect(wrapperB.vm.solvedLabels).toEqual([]);
    });

    it("falls back to a fresh puzzle if a saved tile's movie is no longer eligible", () => {
      const library = buildSolvableLibrary();
      const wrapperA = factory(library);
      expect(wrapperA.vm.puzzle).not.toBeNull();

      // Remount against a library whose dbKeys don't match anything saved —
      // every persisted tile key is now unresolvable.
      const differentLibrary = buildSolvableLibrary().map((e) => ({ ...e, dbKey: `other-${e.dbKey}` }));
      const wrapperB = factory(differentLibrary);
      expect(wrapperB.vm.puzzle).not.toBeNull();
      expect(wrapperB.vm.solvedLabels).toEqual([]);
      expect(wrapperB.vm.mistakes).toBe(0);
    });

    it('recovers once the library finishes loading, instead of permanently stranding on "not enough movies" (the same empty-graph race Six Degrees had)', async () => {
      const getters = reactive({ allMediaAsArray: [] });
      const wrapper = mount(ConnectionsGame, {
        global: { mocks: { $store: { getters, state: {}, commit: vi.fn() }, $router: { push: vi.fn() } } }
      });
      expect(wrapper.vm.puzzle).toBeNull();

      getters.allMediaAsArray = buildSolvableLibrary();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.puzzle).not.toBeNull();
    });
  });

  describe('custom header banner (a graphic made for this game, same pattern as Six Degrees)', () => {
    it('sets the header banner to the custom graphic and hides the "Cinema Roll" logo on mount', () => {
      const wrapper = factory(buildSolvableLibrary());
      const lastBannerCall = wrapper.vm.$store.commit.mock.calls.find((call) => call[0] === 'setBannerUrl');
      expect(lastBannerCall[1]).toContain('connections-banner');
      expect(wrapper.vm.$store.commit).toHaveBeenCalledWith('setHideHeaderLogo', true);
    });

    it('restores the previous banner and un-hides the logo on unmount', () => {
      const store = { state: { bannerUrl: 'https://example.com/some-movie-backdrop.jpg' }, getters: { allMediaAsArray: buildSolvableLibrary() }, commit: vi.fn() };
      const wrapper = mount(ConnectionsGame, { global: { mocks: { $store: store, $router: { push: vi.fn() } } } });
      wrapper.unmount();

      const calls = store.commit.mock.calls.filter((call) => call[0] === 'setBannerUrl');
      expect(calls[calls.length - 1][1]).toBe('https://example.com/some-movie-backdrop.jpg');
      expect(store.commit).toHaveBeenCalledWith('setHideHeaderLogo', false);
    });
  });
});

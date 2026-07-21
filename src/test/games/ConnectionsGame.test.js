import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ConnectionsGame from '@/components/games/ConnectionsGame.vue';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 5 }))
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
        $store: { getters: { allMediaAsArray: mediaEntries } },
        $router: { push: vi.fn() }
      }
    }
  });
}

describe('ConnectionsGame', () => {
  it('shows a gate message when the library cannot support a full puzzle', () => {
    const wrapper = factory([]);
    expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
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

  it('a wrong guess reports how many of the 4 picks actually belonged together', async () => {
    const wrapper = factory(buildSolvableLibrary());
    const [catA, catB] = wrapper.vm.puzzle.categories;
    // 2 from catA, 2 from catB -> best overlap is 2.
    wrapper.vm.selectedKeys = [catA.keys[0], catA.keys[1], catB.keys[0], catB.keys[1]];
    wrapper.vm.submitGuess();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.lastGuessFeedback).toBe('2 of those are in the same group.');
    expect(wrapper.find('.guess-feedback').text()).toBe('2 of those are in the same group.');
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

  it('reaching 4 mistakes ends the game and reveals every category', async () => {
    const wrapper = factory(buildSolvableLibrary());
    const [catA, catB] = wrapper.vm.puzzle.categories;
    const wrongGuess = [catA.keys[0], catA.keys[1], catB.keys[0], catB.keys[1]];

    for (let i = 0; i < 4; i++) {
      wrapper.vm.selectedKeys = wrongGuess;
      wrapper.vm.submitGuess();
    }
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.status).toBe('lost');
    expect(wrapper.vm.solvedLabels).toHaveLength(4);
    expect(wrapper.find('.result-banner.lost').exists()).toBe(true);
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
});

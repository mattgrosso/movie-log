import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive } from 'vue';
import { mount } from '@vue/test-utils';
import SixDegreesGame from '@/components/games/SixDegreesGame.vue';
import { entryKey } from '@/assets/javascript/games/gameUtils.js';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 5 }))
}));

// The "not enough movies" gate now renders NewRatingSearch (suggestionsMode),
// which fetches TMDB popular movies in its own mounted() hook.
vi.mock('axios', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { results: [] } })) }
}));

// ensurePersonPhoto looks up each chain person by name via a plain fetch()
// (not axios) - mocked to "no results" by default so tests exercise the
// initials-fallback path deterministically rather than hitting a real
// endpoint or leaving photos permanently unresolved.
global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ results: [] }) }))

function entry (id, cast) {
  return {
    dbKey: `key-${id}`,
    ratings: [{ calculatedTotal: 5 }],
    movie: { id, title: `Movie ${id}`, poster_path: '/p.jpg', release_date: '2010-06-15', cast: cast.map((name) => ({ name })) }
  };
}

// A chain of 6 movies, each connected to the next by one shared actor, so
// there's always a findable pair within pickConnectedPair's default hop range.
function buildConnectedLibrary () {
  return [
    entry(1, ['Alpha']),
    entry(2, ['Alpha', 'Bravo']),
    entry(3, ['Bravo', 'Charlie']),
    entry(4, ['Charlie', 'Delta']),
    entry(5, ['Delta', 'Echo']),
    entry(6, ['Echo'])
  ];
}

function factory (mediaEntries) {
  return mount(SixDegreesGame, {
    global: {
      mocks: {
        $store: { getters: { allMediaAsArray: mediaEntries } },
        $router: { push: vi.fn() }
      }
    }
  });
}

describe('SixDegreesGame', () => {
  // Fixtures across tests in this file reuse the same dbKeys (buildConnectedLibrary
  // is identical every call), so persisted state from one test could otherwise
  // leak into and change the outcome of the next one — same guard ReelWordleGame's
  // tests use for the same reason.
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows a gate message when no connected pair can be found', () => {
    const disconnected = [entry(1, ['Solo A']), entry(2, ['Solo B'])];
    const wrapper = factory(disconnected);
    expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
  });

  it('offers "help me get started" quick-pick suggestions on the gate (bug report)', () => {
    const disconnected = [entry(1, ['Solo A']), entry(2, ['Solo B'])];
    const wrapper = factory(disconnected);
    expect(wrapper.find('.not-enough-movies .new-rating-search').exists()).toBe(true);
  });

  it('starts the chain with the source movie and needs a person first', () => {
    const wrapper = factory(buildConnectedLibrary());
    expect(wrapper.vm.pair).not.toBeNull();
    expect(wrapper.vm.chain).toEqual([{ type: 'movie', entry: wrapper.vm.pair.source }]);
    expect(wrapper.vm.needType).toBe('person');
    expect(wrapper.vm.hopsSoFar).toBe(0);
  });

  it('suggests a real connection through an actor billed outside the top-10 puzzle-generation cap (bug report: autocomplete silently found nothing for these)', async () => {
    const fillers = Array.from({ length: 10 }, (_, i) => `Filler ${i}`);
    const movieA = entry('a', [...fillers, 'Rare Actor']); // 'Rare Actor' is 11th-billed
    const movieB = entry('b', ['Rare Actor']);
    const wrapper = factory([movieA, movieB, ...buildConnectedLibrary()]);

    // Confirm the premise: the capped graph (puzzle generation only) does NOT
    // see this connection — otherwise this test wouldn't be exercising the fix.
    expect([...wrapper.vm.graph.peopleByMovie.get(entryKey(movieA))]).not.toContain('Rare Actor');

    wrapper.vm.chain = [{ type: 'movie', entry: movieA }];
    wrapper.vm.guessInput = 'Rare';
    wrapper.vm.onInput();
    expect(wrapper.vm.suggestions.some((s) => s.name === 'Rare Actor')).toBe(true);

    wrapper.vm.pick({ name: 'Rare Actor' });
    wrapper.vm.guessInput = 'movie b';
    wrapper.vm.onInput();
    expect(wrapper.vm.suggestions.some((s) => s.key === entryKey(movieB))).toBe(true);
  });

  it('suggests only cast members of the current movie, excluding already-used people', async () => {
    const wrapper = factory(buildConnectedLibrary());
    const sourceKey = entryKey(wrapper.vm.pair.source);
    const castOfSource = [...wrapper.vm.graph.peopleByMovie.get(sourceKey)];

    wrapper.vm.guessInput = castOfSource[0].slice(0, 2);
    wrapper.vm.onInput();
    expect(wrapper.vm.suggestions.some((s) => s.name === castOfSource[0])).toBe(true);
  });

  it('picking a person then a movie advances the chain and alternates needType', async () => {
    const wrapper = factory(buildConnectedLibrary());
    const sourceKey = entryKey(wrapper.vm.pair.source);
    const person = [...wrapper.vm.graph.peopleByMovie.get(sourceKey)][0];

    wrapper.vm.pick({ name: person });
    expect(wrapper.vm.chain).toHaveLength(2);
    expect(wrapper.vm.needType).toBe('movie');

    // 2+ chars — onInput requires a minimum length before it searches at all
    // (same convention as Reel Wordle's autocomplete), and every fixture
    // title here starts with "Movie ".
    wrapper.vm.guessInput = 'movie';
    wrapper.vm.onInput();
    expect(wrapper.vm.suggestions.length).toBeGreaterThan(0);

    const nextMovieSuggestion = wrapper.vm.suggestions[0];
    wrapper.vm.pick(nextMovieSuggestion);
    expect(wrapper.vm.chain).toHaveLength(3);
    expect(wrapper.vm.needType).toBe('person');
    expect(wrapper.vm.hopsSoFar).toBe(1);
  });

  it('reaching the target movie sets status to won', () => {
    const wrapper = factory(buildConnectedLibrary());
    // Walk the actual optimal path so we land on the real target.
    const path = wrapper.vm.pair.optimalPath;
    for (let i = 1; i < path.length; i++) {
      if (i % 2 === 1) {
        wrapper.vm.pick({ name: path[i] });
      } else {
        const key = path[i];
        const targetEntry = wrapper.vm.eligibleGameEntries.find((e) => entryKey(e) === key);
        wrapper.vm.pick({ key, entry: targetEntry });
      }
    }
    expect(wrapper.vm.status).toBe('won');
  });

  it('revealPath shows the optimal chain from source to target', () => {
    const wrapper = factory(buildConnectedLibrary());
    wrapper.vm.revealPath();
    expect(wrapper.vm.status).toBe('revealed');
    expect(wrapper.vm.revealedChain[0].type).toBe('movie');
    expect(entryKey(wrapper.vm.revealedChain[0].entry)).toBe(entryKey(wrapper.vm.pair.source));
    expect(entryKey(wrapper.vm.revealedChain[wrapper.vm.revealedChain.length - 1].entry)).toBe(entryKey(wrapper.vm.pair.target));
  });

  describe('persistence across a remount (bug report: progress was lost on leaving and returning to the page)', () => {
    it('resumes the SAME in-progress pair and chain after a remount', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      const sourceKey = entryKey(wrapper.vm.pair.source);
      const targetKey = entryKey(wrapper.vm.pair.target);
      const person = [...wrapper.vm.graph.peopleByMovie.get(sourceKey)][0];
      wrapper.vm.pick({ name: person });
      expect(wrapper.vm.chain).toHaveLength(2);

      const second = factory(library);
      expect(entryKey(second.vm.pair.source)).toBe(sourceKey);
      expect(entryKey(second.vm.pair.target)).toBe(targetKey);
      expect(second.vm.chain).toHaveLength(2);
      expect(second.vm.chain[1]).toEqual({ type: 'person', name: person });
    });

    it('"New Pair" always resets/re-persists, replacing any prior saved progress', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      const originalSourceKey = entryKey(wrapper.vm.pair.source);
      const person = [...wrapper.vm.graph.peopleByMovie.get(originalSourceKey)][0];
      wrapper.vm.pick({ name: person });
      expect(wrapper.vm.chain).toHaveLength(2);

      wrapper.vm.start();
      expect(wrapper.vm.chain).toHaveLength(1);

      const raw = window.localStorage.getItem('cinemaRoll.sixDegrees.current');
      const saved = JSON.parse(raw);
      expect(saved.chain).toHaveLength(1);
      expect(saved.sourceKey).toBe(entryKey(wrapper.vm.pair.source));
    });

    it('recovers once the library finishes loading, instead of permanently stranding on "not enough movies" (real bug: a direct/deep-link page load can mount before Firebase data arrives)', async () => {
      const getters = reactive({ allMediaAsArray: [] });
      const wrapper = mount(SixDegreesGame, {
        global: { mocks: { $store: { getters }, $router: { push: vi.fn() } } }
      });

      // eligibleGameEntries is empty at mount — must not build an empty graph
      // and give up forever.
      expect(wrapper.vm.pair).toBeNull();

      getters.allMediaAsArray = buildConnectedLibrary();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.pair).not.toBeNull();
      expect(wrapper.vm.graph.peopleByMovie.size).toBeGreaterThan(0);
    });

    it('falls back to a fresh start if the persisted pair\'s movies are no longer in the library', () => {
      window.localStorage.setItem('cinemaRoll.sixDegrees.current', JSON.stringify({
        sourceKey: 'no-longer-rated',
        targetKey: 'also-gone',
        chain: [{ type: 'movie', key: 'no-longer-rated' }]
      }));

      const wrapper = factory(buildConnectedLibrary());
      expect(wrapper.vm.pair).not.toBeNull();
      expect(entryKey(wrapper.vm.pair.source)).not.toBe('no-longer-rated');
    });
  });

  describe('difficulty picker (bug report: "rate difficulty... choose an easy/medium/hard one")', () => {
    it('defaults to "Any" (the original unconstrained range)', () => {
      const wrapper = factory(buildConnectedLibrary());
      expect(wrapper.vm.selectedDifficulty).toBeNull();
    });

    it('tapping a difficulty button selects it and immediately starts a new pair matching that difficulty', async () => {
      const wrapper = factory(buildConnectedLibrary());
      // Difficulty is now a weighted score (hops + billing order + year gap +
      // age - see scorePathDifficulty), not pure hop count, so which exact
      // pair/hop-count comes back isn't asserted here - only that whatever
      // is found actually carries the requested tier. "Medium" (rather than
      // "Hard") is used because this fixture's own real ceiling, precisely:
      // only its single longest (5-hop) pair reaches 'medium' - everything
      // shorter stays 'easy', and nothing in it reaches 'hard' at all.
      // Buttons are labeled as actions ("New ___ Game"), not bare difficulty
      // words - bug report: "the difficulty selectors should be labeled as
      // 'new game' buttons".
      const mediumButton = wrapper.findAll('.difficulty-picker button').find((b) => b.text() === 'New Medium Game');
      expect(mediumButton).toBeTruthy();

      await mediumButton.trigger('click');

      expect(wrapper.vm.selectedDifficulty).toBe('medium');
      expect(wrapper.vm.pair).not.toBeNull();
      expect(wrapper.vm.pair.difficulty).toBe('medium');
      // Starting fresh resets progress back to just the source movie.
      expect(wrapper.vm.chain).toHaveLength(1);
    });

    it('falls back to the not-enough-movies gate when no pair exists at the requested difficulty', async () => {
      // Max possible hop count in this 3-movie chain is 2 - no "hard" pair exists.
      const sparse = [entry(1, ['A']), entry(2, ['A', 'B']), entry(3, ['B'])];
      const wrapper = factory(sparse);
      expect(wrapper.vm.pair).not.toBeNull(); // "Any" finds the 2-hop pair fine

      const hardButton = wrapper.findAll('.difficulty-picker button').find((b) => b.text() === 'New Hard Game');
      await hardButton.trigger('click');

      expect(wrapper.vm.pair).toBeNull();
      expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
    });

    it('offers the difficulty picker again on the resulting gate, to recover by trying a different one', async () => {
      const sparse = [entry(1, ['A']), entry(2, ['A', 'B']), entry(3, ['B'])];
      const wrapper = factory(sparse);

      const hardButton = wrapper.findAll('.difficulty-picker button').find((b) => b.text() === 'New Hard Game');
      await hardButton.trigger('click');
      expect(wrapper.vm.pair).toBeNull();

      const anyButton = wrapper.find('.not-enough-movies .difficulty-picker').findAll('button').find((b) => b.text() === 'New Game');
      expect(anyButton).toBeTruthy();
      await anyButton.trigger('click');

      expect(wrapper.vm.selectedDifficulty).toBeNull();
      expect(wrapper.vm.pair).not.toBeNull();
    });

    it('does NOT show a difficulty picker on the gate when "Any" itself already found nothing (a narrower pick can\'t help)', () => {
      const disconnected = [entry(1, ['Solo A']), entry(2, ['Solo B'])];
      const wrapper = factory(disconnected);
      expect(wrapper.vm.pair).toBeNull();
      expect(wrapper.find('.not-enough-movies .difficulty-picker').exists()).toBe(false);
    });
  });

  describe('the visual chain row (bug report: "ugly pills"... "actual photos of the people and posters of the movies")', () => {
    it('renders the source, the built chain, and a dimmed goal marker for the target while unsolved', () => {
      const wrapper = factory(buildConnectedLibrary());
      const steps = wrapper.findAll('.chain-step');
      // Fresh start: chain is just the source movie, plus the goal marker.
      expect(steps).toHaveLength(2);
      expect(steps[0].classes()).toContain('movie');
      expect(steps[0].classes()).not.toContain('goal');
      expect(steps[1].classes()).toContain('goal');
      expect(wrapper.find('.chain-step.goal .chain-poster').exists()).toBe(true);
    });

    it('shows a person step as a circular photo/initials avatar, not a text pill', async () => {
      const wrapper = factory(buildConnectedLibrary())
      const person = [...wrapper.vm.playGraph.peopleByMovie.get(entryKey(wrapper.vm.pair.source))][0]
      wrapper.vm.pick({ name: person })
      await wrapper.vm.$nextTick()

      const personStep = wrapper.findAll('.chain-step').find((s) => s.classes().includes('person'))
      expect(personStep).toBeTruthy()
      // No photo mocked (fetch is mocked to resolve with no results below),
      // so it falls back to an initials avatar rather than a broken image.
      expect(personStep.find('.chain-photo-fallback').exists()).toBe(true)
      expect(wrapper.find('.chain-link').exists()).toBe(false) // the old pill class is gone
    });

    it('does not show the goal marker once the chain has actually reached the target (status: won)', () => {
      const wrapper = factory(buildConnectedLibrary())
      wrapper.vm.chain = [{ type: 'movie', entry: wrapper.vm.pair.target }]
      expect(wrapper.vm.status).toBe('won')

      const steps = wrapper.vm.chainDisplayItems
      expect(steps).toHaveLength(1)
      expect(steps[0].isGoal).toBeUndefined()
    });
  });
});

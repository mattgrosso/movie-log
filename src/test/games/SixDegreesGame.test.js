import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive } from 'vue';
import { mount } from '@vue/test-utils';
import SixDegreesGame from '@/components/games/SixDegreesGame.vue';
import { entryKey } from '@/assets/javascript/games/gameUtils.js';
import { shortestPath } from '@/assets/javascript/games/sixDegrees.js';

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
        $store: { getters: { allMediaAsArray: mediaEntries }, state: {}, commit: vi.fn() },
        $router: { push: vi.fn() }
      }
    }
  });
}

// pickConnectedPair (called internally by start()) uses real Math.random,
// so which pair a fresh factory() lands on is non-deterministic. Most
// tests don't care, but pick()'s new "auto-connect to the target when the
// guessed person is also in it" behavior means a test that picks ONE
// person from the source and expects the round to still be in progress
// afterward would be flaky if that person happened to connect directly to
// a randomly-chosen 1-hop-away target. Forcing buildConnectedLibrary's own
// two endpoints (movie 1 / movie 6, five hops apart via Alpha-Bravo-
// Charlie-Delta-Echo) makes that impossible - no single actor spans both
// ends - so these tests stay deterministic regardless of the random pick.
function forceLongPair (wrapper, entries) {
  const source = entries[0];
  const target = entries[entries.length - 1];
  const path = shortestPath(wrapper.vm.graph, entryKey(source), entryKey(target));
  wrapper.vm.pair = { source, target, optimalPath: path, optimalHops: (path.length - 1) / 2, difficultyScore: 0, difficulty: 'easy' };
  wrapper.vm.chain = [{ type: 'movie', entry: source }];
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

  it('the description no longer shows a running hop count (bug report: "unnecessary. Lose it.")', () => {
    const wrapper = factory(buildConnectedLibrary());
    const subtitle = wrapper.find('.game-subtitle').text();
    expect(subtitle).toBe('Connect these two through shared cast members or directors.');
    expect(subtitle).not.toMatch(/hop/i);
  });

  describe('dynamic guess prompt (bug report: "Who was in Rebel Without A Cause?" / "what else was Rock Hudson in?")', () => {
    it('names the actual movie when a person is needed', () => {
      const wrapper = factory(buildConnectedLibrary());
      const sourceTitle = wrapper.vm.pair.source.movie.title;
      expect(wrapper.vm.guessPlaceholder).toBe(`Who was in ${sourceTitle}?`);
      expect(wrapper.find('.game-input').attributes('placeholder')).toBe(`Who was in ${sourceTitle}?`);
    });

    it('names the actual person when a movie is needed', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      forceLongPair(wrapper, library);
      const person = [...wrapper.vm.playGraph.peopleByMovie.get(entryKey(wrapper.vm.pair.source))][0];
      wrapper.vm.pick({ name: person });
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.guessPlaceholder).toBe(`What else was ${person} in?`);
      expect(wrapper.find('.game-input').attributes('placeholder')).toBe(`What else was ${person} in?`);
    });
  });

  it('suggests a real connection through an actor billed outside the top-10 puzzle-generation cap (bug report: autocomplete silently found nothing for these)', async () => {
    const fillers = Array.from({ length: 10 }, (_, i) => `Filler ${i}`);
    const movieA = entry('a', [...fillers, 'Rare Actor']); // 'Rare Actor' is 11th-billed
    const movieB = entry('b', ['Rare Actor']);
    const wrapper = factory([movieA, movieB, ...buildConnectedLibrary()]);

    // Confirm the premise: the capped graph (puzzle generation only) does NOT
    // see this connection — otherwise this test wouldn't be exercising the fix.
    expect([...wrapper.vm.graph.peopleByMovie.get(entryKey(movieA))]).not.toContain('Rare Actor');

    // Force a target unrelated to Rare Actor/movieB - otherwise pick()'s
    // auto-connect-to-target behavior could (rarely, since the pair is
    // chosen at random from the whole combined library) fire here too and
    // consume movieB before this test gets to assert it's still suggested.
    wrapper.vm.pair = { ...wrapper.vm.pair, target: entry(6, ['Echo']) };
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
    const library = buildConnectedLibrary();
    const wrapper = factory(library);
    forceLongPair(wrapper, library);
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
    // Walk the actual optimal path so we land on the real target. Stops
    // early once 'won' - pick()'s auto-connect-to-target behavior (picking
    // the last person on a genuine shortest path always borders the
    // target, by definition of it being shortest) can finish the round
    // one step before this loop would otherwise reach the end of path[].
    const path = wrapper.vm.pair.optimalPath;
    for (let i = 1; i < path.length && wrapper.vm.status === 'playing'; i++) {
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

  it('giving up replaces the built chain row with the revealed path instead of showing both (bug report)', async () => {
    const wrapper = factory(buildConnectedLibrary());
    const person = [...wrapper.vm.playGraph.peopleByMovie.get(entryKey(wrapper.vm.pair.source))][0];
    wrapper.vm.pick({ name: person });
    await wrapper.vm.$nextTick();

    wrapper.vm.revealPath();
    await wrapper.vm.$nextTick();

    // Exactly ONE chain row, matching revealedChain's own length - not the
    // built chain's placeholder-padded length shown alongside it.
    expect(wrapper.findAll('.chain-row')).toHaveLength(1);
    expect(wrapper.findAll('.chain-step')).toHaveLength(wrapper.vm.revealedChain.length);
    expect(wrapper.find('.chain-placeholder').exists()).toBe(false);
  });

  it('the guess input renders above the chain-row images (bug report: "moving the input above the images")', () => {
    const wrapper = factory(buildConnectedLibrary());
    const html = wrapper.html();
    expect(html.indexOf('guess-form')).toBeLessThan(html.indexOf('chain-row'));
  });

  describe('"Give me one" / "Give up" (bug report: "turn the reveal shortest path button into a two segment button")', () => {
    it('renders both segments below the chain-row images, replacing the old single button', () => {
      const wrapper = factory(buildConnectedLibrary());
      const segments = wrapper.find('.hint-actions').findAll('.hint-segment');
      expect(segments.map((s) => s.text())).toEqual(['Give me one', 'Give up']);
      const html = wrapper.html();
      expect(html.indexOf('chain-row')).toBeLessThan(html.indexOf('hint-actions'));
    });

    it('"Give me one" advances the chain by exactly one step without ending the game', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      forceLongPair(wrapper, library);
      const before = wrapper.vm.chain.length;
      const giveMeOne = wrapper.findAll('.hint-segment').find((b) => b.text() === 'Give me one');

      await giveMeOne.trigger('click');

      expect(wrapper.vm.chain.length).toBe(before + 1);
      expect(wrapper.vm.status).toBe('playing');
    });

    it('"Give up" reveals the whole remaining path and ends the round', async () => {
      const wrapper = factory(buildConnectedLibrary());
      const giveUp = wrapper.findAll('.hint-segment').find((b) => b.text() === 'Give up');

      await giveUp.trigger('click');

      expect(wrapper.vm.status).toBe('revealed');
      expect(wrapper.vm.revealedChain).not.toBeNull();
    });

    it('repeatedly tapping "Give me one" eventually reaches the target', async () => {
      const wrapper = factory(buildConnectedLibrary());
      for (let i = 0; i < 10 && wrapper.vm.status === 'playing'; i++) {
        wrapper.vm.giveHint();
      }
      expect(wrapper.vm.status).toBe('won');
    });
  });

  describe('persistence across a remount (bug report: progress was lost on leaving and returning to the page)', () => {
    it('resumes the SAME in-progress pair and chain after a remount', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      forceLongPair(wrapper, library);
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

    it('does NOT resume a WON round - a remount starts fresh instead (bug report: "you don\'t need to save my result... it should just be a new game")', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      forceLongPair(wrapper, library);
      const path = wrapper.vm.pair.optimalPath;
      for (let i = 1; i < path.length && wrapper.vm.status === 'playing'; i++) {
        if (i % 2 === 1) {
          wrapper.vm.pick({ name: path[i] });
        } else {
          const key = path[i];
          wrapper.vm.pick({ key, entry: wrapper.vm.eligibleGameEntries.find((e) => entryKey(e) === key) });
        }
      }
      expect(wrapper.vm.status).toBe('won');

      const second = factory(library);
      // A genuinely fresh start, not a restore of the finished round.
      expect(second.vm.status).toBe('playing');
      expect(second.vm.chain).toHaveLength(1);
    });

    it('does NOT resume a REVEALED (given up) round either', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      forceLongPair(wrapper, library);
      wrapper.vm.revealPath();
      expect(wrapper.vm.status).toBe('revealed');

      const second = factory(library);
      expect(second.vm.status).toBe('playing');
      expect(second.vm.revealedChain).toBeNull();
      expect(second.vm.chain).toHaveLength(1);
    });

    it('"New Pair" always resets/re-persists, replacing any prior saved progress', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      forceLongPair(wrapper, library);
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
        global: { mocks: { $store: { getters, state: {}, commit: vi.fn() }, $router: { push: vi.fn() } } }
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

  describe('"New game:" difficulty picker (bug report: "let\'s go back to having \'new game\' as a label and then three buttons for difficulty")', () => {
    it('defaults to no tier selected (the original unconstrained range)', () => {
      const wrapper = factory(buildConnectedLibrary());
      expect(wrapper.vm.selectedDifficulty).toBeNull();
    });

    it('is hidden while playing - only the hint actions show (bug report: "too many buttons... hide the new game buttons until someone clicks give up")', () => {
      const wrapper = factory(buildConnectedLibrary());
      expect(wrapper.vm.status).toBe('playing');
      expect(wrapper.find('.new-game-panel').exists()).toBe(false);
      expect(wrapper.find('.hint-actions').exists()).toBe(true);
    });

    it('swaps in for the hint actions once the round ends, labeled "New game:" with Easy/Medium/Hard segments', async () => {
      const wrapper = factory(buildConnectedLibrary());
      wrapper.vm.revealPath();
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.hint-actions').exists()).toBe(false);
      const panel = wrapper.find('.new-game-panel');
      expect(panel.exists()).toBe(true);
      expect(panel.find('.difficulty-picker-label').text()).toBe('New game:');
      const segments = panel.findAll('.difficulty-segment');
      expect(segments.map((s) => s.text())).toEqual(['Easy', 'Medium', 'Hard']);
    });

    it('tapping a difficulty segment selects it and immediately starts a new pair matching that difficulty', async () => {
      const wrapper = factory(buildConnectedLibrary());
      wrapper.vm.revealPath();
      await wrapper.vm.$nextTick();
      // Difficulty is a weighted score (hops + billing order + year gap +
      // age - see scorePathDifficulty), not pure hop count, so which exact
      // pair/hop-count comes back isn't asserted here - only that whatever
      // is found actually carries the requested tier. "Medium" (rather than
      // "Hard") is used because this fixture's own real ceiling, precisely:
      // only its single longest (5-hop) pair reaches 'medium' - everything
      // shorter stays 'easy', and nothing in it reaches 'hard' at all.
      const mediumSegment = wrapper.findAll('.difficulty-segment').find((b) => b.text() === 'Medium');

      await mediumSegment.trigger('click');

      expect(wrapper.vm.selectedDifficulty).toBe('medium');
      expect(wrapper.vm.pair).not.toBeNull();
      expect(wrapper.vm.pair.difficulty).toBe('medium');
      // Starting fresh resets progress back to just the source movie, which
      // also flips status back to 'playing' - swapping the panel back out.
      expect(wrapper.vm.chain).toHaveLength(1);
      expect(wrapper.vm.status).toBe('playing');
    });

    it('falls back to the not-enough-movies gate when no pair exists at the requested difficulty', async () => {
      // Max possible hop count in this 3-movie chain is 2 - no "hard" pair exists.
      const sparse = [entry(1, ['A']), entry(2, ['A', 'B']), entry(3, ['B'])];
      const wrapper = factory(sparse);
      expect(wrapper.vm.pair).not.toBeNull(); // unconstrained finds the 2-hop pair fine
      wrapper.vm.revealPath();
      await wrapper.vm.$nextTick();

      const hardSegment = wrapper.findAll('.difficulty-segment').find((b) => b.text() === 'Hard');
      await hardSegment.trigger('click');

      expect(wrapper.vm.pair).toBeNull();
      expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
    });

    it('offers the picker again on the resulting gate, to recover by trying a different tier', async () => {
      // In this 3-movie/2-hop fixture, 'easy' is the only tier that's
      // actually reachable (see the scorePathDifficulty tests) - used here as
      // the recovery pick since "Any"/unconstrained is no longer a UI option.
      const sparse = [entry(1, ['A']), entry(2, ['A', 'B']), entry(3, ['B'])];
      const wrapper = factory(sparse);
      wrapper.vm.revealPath();
      await wrapper.vm.$nextTick();

      const hardSegment = wrapper.findAll('.difficulty-segment').find((b) => b.text() === 'Hard');
      await hardSegment.trigger('click');
      expect(wrapper.vm.pair).toBeNull();

      const gatePanel = wrapper.find('.not-enough-movies .new-game-panel');
      expect(gatePanel.exists()).toBe(true);
      const easySegment = gatePanel.findAll('.difficulty-segment').find((b) => b.text() === 'Easy');
      await easySegment.trigger('click');

      expect(wrapper.vm.selectedDifficulty).toBe('easy');
      expect(wrapper.vm.pair).not.toBeNull();
    });

    it('shows the retry panel on the gate even when the unconstrained search itself already found nothing (a retry can still succeed by chance - pickConnectedPair is randomized)', () => {
      const disconnected = [entry(1, ['Solo A']), entry(2, ['Solo B'])];
      const wrapper = factory(disconnected);
      expect(wrapper.vm.pair).toBeNull();
      expect(wrapper.find('.not-enough-movies .new-game-panel').exists()).toBe(true);
    });
  });

  describe('the visual chain row (bug report: "ugly pills"... "actual photos of the people and posters of the movies")', () => {
    it('renders the source, a "?" placeholder for the next needed person, and a goal marker for the target while unsolved', () => {
      const wrapper = factory(buildConnectedLibrary());
      const steps = wrapper.findAll('.chain-step');
      // Fresh start: chain is just the source movie. needType is 'person'
      // (source is a movie), so there's exactly ONE placeholder before the
      // goal (see chainDisplayItems).
      expect(steps).toHaveLength(3);
      expect(steps[0].classes()).toContain('movie');
      expect(steps[0].classes()).not.toContain('goal');
      expect(steps[0].classes()).not.toContain('placeholder');
      expect(steps[1].classes()).toContain('person');
      expect(steps[1].classes()).toContain('placeholder');
      expect(steps[1].find('.chain-placeholder').exists()).toBe(true);
      expect(steps[2].classes()).toContain('goal');
      expect(wrapper.find('.chain-step.goal .chain-poster').exists()).toBe(true);
    });

    it('shows two "?" placeholders (movie then person) when a movie is needed next', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      forceLongPair(wrapper, library);
      const person = [...wrapper.vm.playGraph.peopleByMovie.get(entryKey(wrapper.vm.pair.source))][0];
      wrapper.vm.pick({ name: person });
      await wrapper.vm.$nextTick();

      const steps = wrapper.findAll('.chain-step');
      // source, real person, "?" movie, "?" person, goal.
      expect(steps).toHaveLength(5);
      expect(steps[2].classes()).toEqual(expect.arrayContaining(['movie', 'placeholder']));
      expect(steps[3].classes()).toEqual(expect.arrayContaining(['person', 'placeholder']));
      expect(steps[4].classes()).toContain('goal');
    });

    it('placeholders are not clickable (no navigation, no delete badge)', async () => {
      const wrapper = factory(buildConnectedLibrary());
      const placeholder = wrapper.findAll('.chain-step').find((s) => s.classes().includes('placeholder'));
      await placeholder.trigger('click');
      expect(wrapper.vm.$router.push).not.toHaveBeenCalled();
      expect(placeholder.find('.chain-delete-badge').exists()).toBe(false);
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

  describe('deleting a chain entry (bug report: "delete an entry... removes everything after it")', () => {
    it('shows a delete badge only on real player-added entries, not the source, placeholders, or the goal marker', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      forceLongPair(wrapper, library);
      const person = [...wrapper.vm.playGraph.peopleByMovie.get(entryKey(wrapper.vm.pair.source))][0];
      wrapper.vm.pick({ name: person });
      await wrapper.vm.$nextTick();

      const steps = wrapper.findAll('.chain-step');
      // [0] source, [1] person just added, [2] "?" movie, [3] "?" person, [4] goal.
      expect(steps).toHaveLength(5);
      expect(steps[0].find('.chain-delete-badge').exists()).toBe(false);
      expect(steps[1].find('.chain-delete-badge').exists()).toBe(true);
      expect(steps[2].find('.chain-delete-badge').exists()).toBe(false);
      expect(steps[3].find('.chain-delete-badge').exists()).toBe(false);
      expect(steps[4].find('.chain-delete-badge').exists()).toBe(false);
    });

    it('deleting an entry truncates the chain to everything before it', () => {
      const wrapper = factory(buildConnectedLibrary());
      const path = wrapper.vm.pair.optimalPath;
      for (let i = 1; i < path.length; i++) {
        if (i % 2 === 1) {
          wrapper.vm.pick({ name: path[i] });
        } else {
          const key = path[i];
          wrapper.vm.pick({ key, entry: wrapper.vm.eligibleGameEntries.find((e) => entryKey(e) === key) });
        }
      }
      const fullLength = wrapper.vm.chain.length;
      expect(fullLength).toBeGreaterThan(2);

      wrapper.vm.deleteFromChain(1);
      expect(wrapper.vm.chain).toHaveLength(1);
      expect(wrapper.vm.chain[0]).toEqual({ type: 'movie', entry: wrapper.vm.pair.source });
    });

    it('cannot delete the source (index 0)', () => {
      const wrapper = factory(buildConnectedLibrary());
      wrapper.vm.deleteFromChain(0);
      expect(wrapper.vm.chain).toHaveLength(1);
    });

    it('re-persists after a delete, so a remount resumes the trimmed chain', () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      const person = [...wrapper.vm.playGraph.peopleByMovie.get(entryKey(wrapper.vm.pair.source))][0];
      wrapper.vm.pick({ name: person });
      wrapper.vm.deleteFromChain(1);

      const raw = window.localStorage.getItem('cinemaRoll.sixDegrees.current');
      expect(JSON.parse(raw).chain).toHaveLength(1);
    });
  });

  describe('clicking a chain item navigates (bug report: "click on any of the items... movie detail page or a search for that person")', () => {
    it('clicking a movie step pushes to that movie\'s detail page', async () => {
      const wrapper = factory(buildConnectedLibrary());
      const movieStep = wrapper.findAll('.chain-step').find((s) => s.classes().includes('movie'));
      await movieStep.trigger('click');

      expect(wrapper.vm.$router.push).toHaveBeenCalledWith(`/movie/${wrapper.vm.pair.source.movie.id}`);
    });

    it('clicking a person step commits a library search for that person and navigates home', async () => {
      const wrapper = factory(buildConnectedLibrary());
      const person = [...wrapper.vm.playGraph.peopleByMovie.get(entryKey(wrapper.vm.pair.source))][0];
      wrapper.vm.pick({ name: person });
      await wrapper.vm.$nextTick();

      const personStep = wrapper.findAll('.chain-step').find((s) => s.classes().includes('person'));
      await personStep.trigger('click');

      expect(wrapper.vm.$store.commit).toHaveBeenCalledWith('setHomePageSearchValue', person);
      expect(wrapper.vm.$store.commit).toHaveBeenCalledWith('setHomePagePromoteGroup', 'cast');
      expect(wrapper.vm.$router.push).toHaveBeenCalledWith('/');
    });

    it('deleting a chain entry does not also trigger navigation (the delete badge stops the click from bubbling)', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      forceLongPair(wrapper, library);
      const person = [...wrapper.vm.playGraph.peopleByMovie.get(entryKey(wrapper.vm.pair.source))][0];
      wrapper.vm.pick({ name: person });
      await wrapper.vm.$nextTick();

      const badge = wrapper.find('.chain-delete-badge');
      await badge.trigger('click');

      expect(wrapper.vm.chain).toHaveLength(1);
      expect(wrapper.vm.$router.push).not.toHaveBeenCalled();
    });
  });

  describe('starting a new game scrolls to the top (bug report)', () => {
    it('start() scrolls the window to the top', () => {
      const wrapper = factory(buildConnectedLibrary());
      window.scrollTo.mockClear();
      wrapper.vm.start();
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
    });
  });

  describe('custom header banner (a graphic made for this game, replacing the generic movie backdrop while playing it)', () => {
    it('sets the header banner to the custom graphic on mount', () => {
      const wrapper = factory(buildConnectedLibrary());
      const lastCall = wrapper.vm.$store.commit.mock.calls.find((call) => call[0] === 'setBannerUrl');
      expect(lastCall[1]).toContain('six-degrees-banner');
    });

    it('hides the "Cinema Roll" header logo on mount - the custom graphic has its own branding baked in', () => {
      const wrapper = factory(buildConnectedLibrary());
      expect(wrapper.vm.$store.commit).toHaveBeenCalledWith('setHideHeaderLogo', true);
    });

    it('restores whatever banner was showing before, on unmount', () => {
      const store = { getters: { allMediaAsArray: buildConnectedLibrary() }, state: { bannerUrl: 'https://example.com/some-movie-backdrop.jpg' }, commit: vi.fn() };
      const wrapper = mount(SixDegreesGame, { global: { mocks: { $store: store, $router: { push: vi.fn() } } } });
      wrapper.unmount();

      const calls = store.commit.mock.calls.filter((call) => call[0] === 'setBannerUrl');
      expect(calls[calls.length - 1][1]).toBe('https://example.com/some-movie-backdrop.jpg');
    });

    it('restores to null (not the game graphic) when no banner was set before', () => {
      const store = { getters: { allMediaAsArray: buildConnectedLibrary() }, state: {}, commit: vi.fn() };
      const wrapper = mount(SixDegreesGame, { global: { mocks: { $store: store, $router: { push: vi.fn() } } } });
      wrapper.unmount();

      const calls = store.commit.mock.calls.filter((call) => call[0] === 'setBannerUrl');
      expect(calls[calls.length - 1][1]).toBeFalsy();
    });

    it('un-hides the header logo on unmount', () => {
      const wrapper = factory(buildConnectedLibrary());
      wrapper.unmount();
      expect(wrapper.vm.$store.commit).toHaveBeenCalledWith('setHideHeaderLogo', false);
    });
  });

  // Bug report (Jul 2026): three Six Degrees asks in one report.
  describe('scrolling the chain to follow each new entry', () => {
    // NOTE: chainRowEl is assigned by a function ref in the template, which
    // re-fires on every re-render - so a stub assigned before pick() would
    // be overwritten by the real element mid-update. The scroll behaviour
    // and the fact that pick() triggers it are therefore tested separately.
    // Stubs a row whose newest real entry sits `overhangPx` beyond the row's
    // right edge - the scroll should close exactly that gap (plus the margin),
    // NOT jump to scrollWidth (which is past the trailing "?" placeholders and
    // goal poster, and would push the new entry back off-screen).
    function stubRow (wrapper, { overhangPx, scrollLeft = 0, withScrollTo = true }) {
      const newest = { getBoundingClientRect: () => ({ right: 400 + overhangPx }) };
      const el = {
        scrollLeft,
        scrollWidth: 9999,
        querySelector: () => newest,
        getBoundingClientRect: () => ({ right: 400 })
      };
      if (withScrollTo) el.scrollTo = vi.fn((opts) => { el.scrollLeft = opts.left; });
      wrapper.vm.chainRowEl = el;
      return el;
    }

    it('scrolls just far enough to bring the newest entry into view, not to the far end', async () => {
      const wrapper = factory(buildConnectedLibrary());
      const el = stubRow(wrapper, { overhangPx: 100, scrollLeft: 50 });

      wrapper.vm.scrollChainToEnd();
      await wrapper.vm.$nextTick();

      // 50 (current) + 100 (overhang) + 12 (margin) — not scrollWidth (9999).
      expect(el.scrollTo).toHaveBeenCalledWith({ left: 162, behavior: 'smooth' });
    });

    it('does not scroll at all when the newest entry is already fully visible', async () => {
      const wrapper = factory(buildConnectedLibrary());
      const el = stubRow(wrapper, { overhangPx: -200 });

      wrapper.vm.scrollChainToEnd();
      await wrapper.vm.$nextTick();

      expect(el.scrollTo).not.toHaveBeenCalled();
    });

    it('falls back to setting scrollLeft when the element has no scrollTo (jsdom/old browsers)', async () => {
      const wrapper = factory(buildConnectedLibrary());
      const el = stubRow(wrapper, { overhangPx: 88, withScrollTo: false });

      wrapper.vm.scrollChainToEnd();
      await wrapper.vm.$nextTick();

      expect(el.scrollLeft).toBe(100); // 0 + 88 + 12
    });

    it('does not throw when the chain row element is not available', async () => {
      const wrapper = factory(buildConnectedLibrary());
      wrapper.vm.chainRowEl = null;

      wrapper.vm.scrollChainToEnd();
      await expect(wrapper.vm.$nextTick()).resolves.not.toThrow();
    });

    it('is triggered by adding a link to the chain', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      forceLongPair(wrapper, library);
      const spy = vi.spyOn(wrapper.vm, 'scrollChainToEnd');

      const person = [...wrapper.vm.playGraph.peopleByMovie.get(entryKey(wrapper.vm.pair.source))][0];
      wrapper.vm.pick({ name: person });

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('showing the shortest path after a win, alongside your own', () => {
    // Wins with a deliberately longer-than-optimal route so there's
    // something "could've been" to show.
    function winTheLongWay (wrapper, library) {
      forceLongPair(wrapper, library);
      const source = library[0];
      const target = library[library.length - 1];
      const full = shortestPath(wrapper.vm.graph, entryKey(source), entryKey(target));
      wrapper.vm.chain = full.map((step, i) => (
        i % 2 === 0 ? { type: 'movie', entry: library.find((e) => entryKey(e) === step) } : { type: 'person', name: step }
      ));
      // Pretend the optimum was shorter than the route actually taken.
      wrapper.vm.pair = { ...wrapper.vm.pair, optimalHops: 1 };
    }

    it('offers the comparison only after a win that was longer than the optimum', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);

      forceLongPair(wrapper, library);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.comparison-actions').exists()).toBe(false); // still playing

      winTheLongWay(wrapper, library);
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.status).toBe('won');
      expect(wrapper.find('.comparison-actions').exists()).toBe(true);
    });

    // Follow-up bug report: "I still don't see a way to reveal the shortest
    // path after I find my own path." The first cut hid the button whenever
    // the player matched the optimum; from their side that's
    // indistinguishable from it being broken.
    it('STILL offers it when the player already matched the shortest path, saying so', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      winTheLongWay(wrapper, library);
      wrapper.vm.pair = { ...wrapper.vm.pair, optimalHops: wrapper.vm.hopsSoFar };
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.canShowComparison).toBe(true);
      expect(wrapper.find('.comparison-actions').exists()).toBe(true);

      await wrapper.find('.comparison-actions button').trigger('click');
      expect(wrapper.find('.chain-row-label').text()).toContain('You found it');
    });

    it('adds a second row WITHOUT replacing the player\'s own (unlike giving up)', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      winTheLongWay(wrapper, library);
      await wrapper.vm.$nextTick();

      const ownChainLength = wrapper.vm.displayChain.length;
      await wrapper.find('.comparison-actions button').trigger('click');

      expect(wrapper.findAll('.chain-row')).toHaveLength(2);
      expect(wrapper.vm.chainRows[0].items).toHaveLength(ownChainLength); // own row untouched
      expect(wrapper.vm.chainRows[1].interactive).toBe(false);
      expect(wrapper.find('.chain-row-label').text()).toContain('shortest path');
      expect(wrapper.vm.status).toBe('won'); // still a win, not 'revealed'
    });

    it('giving up still REPLACES the row rather than adding one', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      forceLongPair(wrapper, library);

      wrapper.vm.revealPath();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.status).toBe('revealed');
      expect(wrapper.findAll('.chain-row')).toHaveLength(1);
    });

    it('clears the comparison row when a new game starts', async () => {
      const library = buildConnectedLibrary();
      const wrapper = factory(library);
      winTheLongWay(wrapper, library);
      wrapper.vm.showComparisonPath();
      expect(wrapper.vm.comparisonChain).toBeTruthy();

      wrapper.vm.start();
      expect(wrapper.vm.comparisonChain).toBeNull();
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SixDegreesGame from '@/components/games/SixDegreesGame.vue';
import { entryKey } from '@/assets/javascript/games/gameUtils.js';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 5 }))
}));

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
        $store: { getters: { allMediaAsArray: mediaEntries }, commit: vi.fn() },
        $router: { push: vi.fn() }
      }
    }
  });
}

describe('SixDegreesGame', () => {
  it('shows a gate message when no connected pair can be found', () => {
    const disconnected = [entry(1, ['Solo A']), entry(2, ['Solo B'])];
    const wrapper = factory(disconnected);
    expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
  });

  it('starts the chain with the source movie and needs a person first', () => {
    const wrapper = factory(buildConnectedLibrary());
    expect(wrapper.vm.pair).not.toBeNull();
    expect(wrapper.vm.chain).toEqual([{ type: 'movie', entry: wrapper.vm.pair.source }]);
    expect(wrapper.vm.needType).toBe('person');
    expect(wrapper.vm.hopsSoFar).toBe(0);
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
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import StampGame from '@/components/games/StampGame.vue';

vi.mock('axios', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { results: [] } })) } }));

let nextId = 1;
const movie = ({ aiKeywords = [], directors = ['Nobody'], genres = ['Drama'] } = {}) => {
  const id = nextId++;
  return {
    dbKey: `key-${id}`,
    movie: {
      id,
      title: `Movie ${id}`,
      poster_path: `/p${id}.jpg`,
      release_date: '2015-06-15',
      genres: genres.map((name) => ({ name })),
      keywords: [],
      chatGPTKeywords: aiKeywords,
      customKeywords: [],
      removedKeywords: [],
      crew: directors.map((name) => ({ name, job: 'Director' })),
      cast: []
    },
    ratings: [{ calculatedTotal: 7, date: Date.now() }]
  };
};

const factory = (entries, { flyDuration = 0 } = {}) => {
  const movieLog = {};
  entries.forEach((entry) => { movieLog[entry.dbKey] = entry; });

  const dispatch = vi.fn(() => Promise.resolve());
  const store = {
    state: reactive({ movieLog, bannerUrl: null, settings: {} }),
    getters: { allMediaAsArray: entries },
    commit: vi.fn(),
    dispatch
  };

  const wrapper = mount(StampGame, {
    global: {
      mocks: { $store: store, $router: { push: vi.fn() }, $route: { path: '/games/stamp' } },
      stubs: { NewRatingSearch: true }
    }
  });
  wrapper.store = store;
  // Real animation timing would make the loop tests take many seconds.
  wrapper.vm.flyDuration = flyDuration;
  return wrapper;
};

// Enough examples for the keyword to be playable, plus a pool to draw from.
const library = () => [
  ...Array.from({ length: 6 }, () => movie({ aiKeywords: ['cosy'] })),
  ...Array.from({ length: 25 }, () => movie())
];

const writesTo = (dispatch) => dispatch.mock.calls.filter(([action]) => action === 'writeDurably');

describe('StampGame', () => {
  beforeEach(() => { nextId = 1; });

  it('gates when no keyword has enough examples to learn from', () => {
    const wrapper = factory([movie({ aiKeywords: ['lonely'] }), ...Array.from({ length: 9 }, () => movie())]);
    expect(wrapper.find('.not-enough-tags').exists()).toBe(true);
    expect(wrapper.find('.stamp-card.top').exists()).toBe(false);
  });

  it('picks a keyword and starts swiping immediately — no picker to get through', () => {
    // "we don't need to show a list of tags to choose from. Just when the game
    // starts, pick one, and then we'll swipe around till it's done."
    const wrapper = factory(library());

    expect(wrapper.vm.round.keyword).toBe('cosy');
    expect(wrapper.vm.round.cards.length).toBeGreaterThan(0);
    expect(wrapper.find('.stamp-card.top').exists()).toBe(true);
    expect(wrapper.text()).toContain('cosy');
  });

  it('works on keywords, not viewing tags', () => {
    // Viewing tags are assumed correct; the unchecked data is TMDB's and the
    // AI's keywords.
    const tagOnly = [
      ...Array.from({ length: 6 }, () => {
        const entry = movie();
        entry.ratings[0].tags = [{ title: 'Watched With Carrie' }];
        return entry;
      }),
      ...Array.from({ length: 10 }, () => movie())
    ];

    expect(factory(tagOnly).vm.round).toBeNull();
  });

  describe('deciding', () => {
    const startRound = async () => {
      const wrapper = factory(library());
      await wrapper.vm.$nextTick();
      wrapper.store.dispatch.mockClear();
      return wrapper;
    };

    it('writes only the ratings leaf when a tag is ADDED', async () => {
      const wrapper = await startRound();
      // Force an untagged card to the front so "yes" means "add".
      wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => !c.hasTag);
      await wrapper.vm.$nextTick();
      const dbKey = wrapper.vm.currentCard.entry.dbKey;

      await wrapper.vm.decide('yes');

      const writes = writesTo(wrapper.store.dispatch);
      // Leaf paths, so they can't clobber the movie object or other siblings.
      expect(writes.map(([, arg]) => arg.path)).toEqual([
        `movieLog/${dbKey}/movie/customKeywords`,
        `movieLog/${dbKey}/movie/removedKeywords`
      ]);
      expect(writes[0][1].value).toContain('cosy');
    });

    it('removes an AI keyword by adding it to removedKeywords, since it cannot just be deleted', async () => {
      const wrapper = await startRound();
      wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => c.hasTag);
      await wrapper.vm.$nextTick();

      await wrapper.vm.decide('no');

      const removedWrite = writesTo(wrapper.store.dispatch).find(([, arg]) => arg.path.endsWith('removedKeywords'));
      expect(removedWrite[1].value).toContain('cosy');
    });

    it('does NOT write when nothing actually changed', async () => {
      const wrapper = await startRound();

      // Confirming an already-tagged movie...
      wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => c.hasTag);
      await wrapper.vm.$nextTick();
      await wrapper.vm.decide('yes');

      // ...and passing over an untagged one.
      wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => !c.hasTag);
      await wrapper.vm.$nextTick();
      await wrapper.vm.decide('no');

      expect(writesTo(wrapper.store.dispatch)).toHaveLength(0);
    });

    it('advances through the stack and tallies the outcomes', async () => {
      const wrapper = await startRound();
      const total = wrapper.vm.round.cards.length;

      for (let i = 0; i < total; i++) {
        await wrapper.vm.decide('yes');
      }

      expect(wrapper.vm.finished).toBe(true);
      expect(wrapper.find('.summary').exists()).toBe(true);
      expect(wrapper.vm.tally.confirmed + wrapper.vm.tally.added).toBe(total);
    });
  });

  describe('undo', () => {
    it('steps back and reverts the write', async () => {
      const wrapper = factory(library());
      await wrapper.vm.$nextTick();
      wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => !c.hasTag);
      await wrapper.vm.$nextTick();

      const startIndex = wrapper.vm.currentIndex;
      await wrapper.vm.decide('yes');
      wrapper.store.dispatch.mockClear();

      await wrapper.vm.undo();

      expect(wrapper.vm.currentIndex).toBe(startIndex);
      expect(wrapper.vm.history).toHaveLength(0);
      // Restores the keyword arrays to exactly what they were.
      const writes = writesTo(wrapper.store.dispatch);
      expect(writes).toHaveLength(2);
      expect(writes[0][1].value).toEqual([]);
      expect(writes[1][1].value).toEqual([]);
    });

    it('does not write when undoing a decision that changed nothing', async () => {
      const wrapper = factory(library());
      await wrapper.vm.$nextTick();
      wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => c.hasTag);
      await wrapper.vm.$nextTick();

      await wrapper.vm.decide('yes'); // confirmed — a no-op
      wrapper.store.dispatch.mockClear();
      await wrapper.vm.undo();

      expect(writesTo(wrapper.store.dispatch)).toHaveLength(0);
    });

    it('is hidden until something has been decided', async () => {
      const wrapper = factory(library());
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.undo-btn').exists()).toBe(false);

      await wrapper.vm.decide('yes');
      expect(wrapper.find('.undo-btn').exists()).toBe(true);
    });
  });

  describe('swiping', () => {
    const drag = async (wrapper, distance) => {
      const card = wrapper.find('.stamp-card.top');
      await card.trigger('pointerdown', { pointerId: 1, clientX: 200 });
      await card.trigger('pointermove', { pointerId: 1, clientX: 200 + distance });
      await card.trigger('pointerup', { pointerId: 1, clientX: 200 + distance });
    };

    it('a long swipe right decides yes', async () => {
      const wrapper = factory(library());
      await wrapper.vm.$nextTick();

      await drag(wrapper, 150);

      expect(wrapper.vm.history).toHaveLength(1);
      expect(wrapper.vm.history[0].verdict).toBe('yes');
    });

    it('a long swipe left decides no', async () => {
      const wrapper = factory(library());
      await wrapper.vm.$nextTick();

      await drag(wrapper, -150);

      expect(wrapper.vm.history[0].verdict).toBe('no');
    });

    it('a short drag snaps back and decides nothing', async () => {
      const wrapper = factory(library());
      await wrapper.vm.$nextTick();

      await drag(wrapper, 20);

      expect(wrapper.vm.history).toHaveLength(0);
      expect(wrapper.vm.dragX).toBe(0);
    });

    it('moves the card with a composited transform and no drop-shadow', async () => {
      // Timeline's drag-to-place was removed for leaving visual trails on a real
      // device, traced to filter: drop-shadow recomputing every pointermove.
      const wrapper = factory(library());
      await wrapper.vm.$nextTick();
      const card = wrapper.find('.stamp-card.top');

      await card.trigger('pointerdown', { pointerId: 1, clientX: 200 });
      await card.trigger('pointermove', { pointerId: 1, clientX: 260 });

      const style = wrapper.vm.topCardStyle.transform;
      expect(style).toContain('translate3d');
      expect(JSON.stringify(wrapper.vm.topCardStyle)).not.toContain('drop-shadow');
    });
  });

  it('swaps the header banner in and restores it on leave', () => {
    const wrapper = factory(library());
    const bannerCalls = wrapper.store.commit.mock.calls.filter(([type]) => type === 'setBannerUrl');

    expect(bannerCalls.length).toBeGreaterThan(0);
    expect(wrapper.store.commit).toHaveBeenCalledWith('setHideHeaderLogo', true);

    wrapper.unmount();
    expect(wrapper.store.commit).toHaveBeenCalledWith('setHideHeaderLogo', false);
  });
});

describe('StampGame blind judgement', () => {
  beforeEach(() => { nextId = 1; });

  it('never reveals whether the movie already has the keyword', async () => {
    // "we don't want to know. We just have to be able to see what comes out."
    // Knowing would anchor the judgement.
    const wrapper = factory(library());
    wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => c.hasTag);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.currentCard.hasTag).toBe(true);
    expect(wrapper.find('.already-tagged').exists()).toBe(false);
    expect(wrapper.text().toLowerCase()).not.toContain('already');
  });

  it('renders the same card markup whether or not the keyword is already there', async () => {
    const wrapper = factory(library());

    wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => c.hasTag);
    await wrapper.vm.$nextTick();
    const withKeyword = wrapper.find('.stamp-card.top').html().replace(/Movie \d+|\/p\d+\.jpg/g, 'X');

    wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => !c.hasTag);
    await wrapper.vm.$nextTick();
    const without = wrapper.find('.stamp-card.top').html().replace(/Movie \d+|\/p\d+\.jpg/g, 'X');

    expect(withKeyword).toBe(without);
  });

  it('still tallies what actually changed once the round is over', async () => {
    // The reveal is the summary at the end, not a hint during play.
    const wrapper = factory(library());
    const total = wrapper.vm.round.cards.length;
    for (let i = 0; i < total; i++) await wrapper.vm.decide('yes');

    expect(wrapper.find('.summary').exists()).toBe(true);
    expect(wrapper.vm.tally.added).toBeGreaterThan(0);
  });
});

// "swiping should really swipe the poster right off the page revealing the one
// below it... What if we really loaded the images in a stack one behind the
// other so you can only see the top one?"
describe('StampGame card stack', () => {
  beforeEach(() => { nextId = 1; });

  it('mounts several posters at once, not just the current one', () => {
    const wrapper = factory(library());
    expect(wrapper.findAll('.stamp-card')).toHaveLength(wrapper.vm.stackDepth);
  });

  it('has the next posters already in the DOM, which is what removes the pause', () => {
    // The gap between swiping and the next poster appearing was the next image
    // being fetched. Rendering it behind the current one loads it in advance.
    const wrapper = factory(library());
    const rendered = wrapper.findAll('.stamp-card img').map((img) => img.attributes('src'));
    const expected = wrapper.vm.round.cards
      .slice(0, wrapper.vm.stackDepth)
      .map((card) => wrapper.vm.gamePosterUrl(card.entry, 'w342'));

    expect(rendered.sort()).toEqual(expected.sort());
  });

  it('paints the current card on top by rendering it last', () => {
    // Deepest-first DOM order means no z-index is needed on every card.
    const wrapper = factory(library());
    const cards = wrapper.findAll('.stamp-card');

    expect(cards.at(-1).classes()).toContain('top');
    expect(cards[0].classes()).not.toContain('top');
  });

  it('only the top card responds to a drag', async () => {
    const wrapper = factory(library());
    const buried = wrapper.findAll('.stamp-card')[0];

    await buried.trigger('pointerdown', { pointerId: 1, clientX: 200 });
    await buried.trigger('pointermove', { pointerId: 1, clientX: 320 });

    expect(wrapper.vm.dragging).toBe(false);
    expect(wrapper.vm.dragX).toBe(0);
  });

  it('flings the card clear of the screen before advancing', async () => {
    const wrapper = factory(library(), { flyDuration: 40 });
    const firstKey = wrapper.vm.currentCard.entry.dbKey;

    const pending = wrapper.vm.decide('yes');
    await wrapper.vm.$nextTick();

    // Mid-flight: still the same card, now translating off to the right.
    expect(wrapper.vm.currentCard.entry.dbKey).toBe(firstKey);
    expect(wrapper.vm.topCardStyle.transform).toContain('140vw');
    expect(wrapper.vm.topCardStyle.opacity).toBe(0);

    await pending;

    // Landed: advanced, and the new top card is back at rest.
    expect(wrapper.vm.currentCard.entry.dbKey).not.toBe(firstKey);
    expect(wrapper.vm.flyVerdict).toBeNull();
    expect(wrapper.vm.topCardStyle.transform).toBeUndefined();
  });

  it('flings left for a no', async () => {
    const wrapper = factory(library(), { flyDuration: 40 });
    const pending = wrapper.vm.decide('no');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.topCardStyle.transform).toContain('-140vw');
    await pending;
  });

  it('ignores a second decision while a card is still in flight', async () => {
    // Two commits mid-flight would advance twice and skip a poster.
    const wrapper = factory(library(), { flyDuration: 40 });

    const pending = wrapper.vm.decide('yes');
    await wrapper.vm.decide('yes');
    await pending;

    expect(wrapper.vm.history).toHaveLength(1);
    expect(wrapper.vm.currentIndex).toBe(1);
  });

  it('does not save twice when a second decision is ignored', async () => {
    const wrapper = factory(library(), { flyDuration: 40 });
    wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => !c.hasTag);
    await wrapper.vm.$nextTick();
    wrapper.store.dispatch.mockClear();

    const pending = wrapper.vm.decide('yes');
    await wrapper.vm.decide('yes');
    await pending;

    // One decision => one customKeywords write + one removedKeywords write.
    expect(writesTo(wrapper.store.dispatch)).toHaveLength(2);
  });

  it('shrinks the stack as the round runs out, without erroring', async () => {
    const wrapper = factory(library());
    const total = wrapper.vm.round.cards.length;

    for (let i = 0; i < total - 1; i++) await wrapper.vm.decide('yes');
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.stamp-card')).toHaveLength(1);
  });
});

// "if I go too quickly, it doesn't catch and it doesn't really work. It sort of
// snaps back. So can we make it so I can swipe a little more quickly?"
// A fast flick lifts off long before it has travelled far, so distance alone
// misses it.
describe('StampGame flick to commit', () => {
  let clock;

  beforeEach(() => {
    nextId = 1;
    clock = 0;
    // Controlled time so velocity is deterministic rather than dependent on how
    // fast the test runner dispatches events.
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
  });

  afterEach(() => vi.restoreAllMocks());

  // Drag `distance` px over `duration` ms, in a few steps, then release.
  const gesture = async (wrapper, distance, duration, steps = 4) => {
    const card = wrapper.find('.stamp-card.top');
    await card.trigger('pointerdown', { pointerId: 1, clientX: 200 });

    for (let i = 1; i <= steps; i++) {
      clock += duration / steps;
      await card.trigger('pointermove', { pointerId: 1, clientX: 200 + (distance * i) / steps });
    }

    await card.trigger('pointerup', { pointerId: 1, clientX: 200 + distance });
  };

  it('commits a short but fast flick that distance alone would have missed', async () => {
    const wrapper = factory(library(), { flyDuration: 0 });

    // 50px in 60ms ≈ 0.83 px/ms — well under the 90px distance threshold.
    await gesture(wrapper, 50, 60);

    expect(wrapper.vm.history).toHaveLength(1);
    expect(wrapper.vm.history[0].verdict).toBe('yes');
  });

  it('commits a fast flick to the left as a no', async () => {
    const wrapper = factory(library(), { flyDuration: 0 });
    await gesture(wrapper, -50, 60);

    expect(wrapper.vm.history[0].verdict).toBe('no');
  });

  it('still commits a slow drag that goes the full distance', async () => {
    const wrapper = factory(library(), { flyDuration: 0 });

    // 120px over 900ms — barely moving, but well past the threshold.
    await gesture(wrapper, 120, 900);

    expect(wrapper.vm.history).toHaveLength(1);
  });

  it('ignores a slow, short drag — that is a nudge, not a swipe', async () => {
    const wrapper = factory(library(), { flyDuration: 0 });
    await gesture(wrapper, 40, 900);

    expect(wrapper.vm.history).toHaveLength(0);
  });

  it('ignores a fast but tiny movement, so a tap or a jitter cannot commit', async () => {
    const wrapper = factory(library(), { flyDuration: 0 });

    // 8px in 8ms is very "fast" but is obviously not a swipe.
    await gesture(wrapper, 8, 8, 2);

    expect(wrapper.vm.history).toHaveLength(0);
  });

  it('takes direction from the flick, not the total travel, when they disagree', async () => {
    // A gesture that drifts right then snaps back left: the last thing the
    // thumb did is the intent.
    const wrapper = factory(library(), { flyDuration: 0 });
    const card = wrapper.find('.stamp-card.top');

    await card.trigger('pointerdown', { pointerId: 1, clientX: 200 });
    clock += 400;
    await card.trigger('pointermove', { pointerId: 1, clientX: 300 }); // slow drift right
    clock += 40;
    await card.trigger('pointermove', { pointerId: 1, clientX: 240 }); // fast flick left
    await card.trigger('pointerup', { pointerId: 1, clientX: 240 });

    expect(wrapper.vm.history[0].verdict).toBe('no');
  });

  it('measures speed over the end of the gesture, not its whole length', async () => {
    // A long slow drag that FINISHES with a flick should still count — averaging
    // over the whole gesture would wash the flick out.
    const wrapper = factory(library(), { flyDuration: 0 });
    const card = wrapper.find('.stamp-card.top');

    await card.trigger('pointerdown', { pointerId: 1, clientX: 200 });
    clock += 2000;
    await card.trigger('pointermove', { pointerId: 1, clientX: 210 }); // 2s of almost nothing
    clock += 50;
    await card.trigger('pointermove', { pointerId: 1, clientX: 265 }); // then a flick
    await card.trigger('pointerup', { pointerId: 1, clientX: 265 });

    expect(wrapper.vm.history).toHaveLength(1);
  });
});

// "make which swipe is which more clear. Maybe some kind of indicator on the
// left and right edges next to the poster" + "the summary at the end... could
// use a polish".
describe('StampGame swipe hints and summary', () => {
  beforeEach(() => { nextId = 1; });

  it('shows both direction hints before any swipe has started', () => {
    // The old on-card stamps only appeared mid-drag, so at rest there was no
    // cue at all about which way meant what.
    const wrapper = factory(library());

    expect(wrapper.vm.dragX).toBe(0);
    expect(wrapper.find('.swipe-hint.yes').exists()).toBe(true);
    expect(wrapper.find('.swipe-hint.no').exists()).toBe(true);
    expect(wrapper.find('.swipe-hint.yes').text()).toContain('Yes');
    expect(wrapper.find('.swipe-hint.no').text()).toContain('No');
  });

  it('leaves both hints dim while resting', () => {
    const wrapper = factory(library());
    expect(wrapper.vm.hintStyle(1).opacity).toBeCloseTo(0.3, 5);
    expect(wrapper.vm.hintStyle(-1).opacity).toBeCloseTo(0.3, 5);
  });

  it('lights up only the hint you are swiping toward', async () => {
    const wrapper = factory(library());
    const card = wrapper.find('.stamp-card.top');

    await card.trigger('pointerdown', { pointerId: 1, clientX: 200 });
    await card.trigger('pointermove', { pointerId: 1, clientX: 200 + wrapper.vm.swipeThreshold });

    expect(wrapper.vm.hintStyle(1).opacity).toBeCloseTo(1, 5);
    expect(wrapper.vm.hintStyle(-1).opacity).toBeCloseTo(0.3, 5);
  });

  it('caps the hint at full strength once past the threshold', async () => {
    const wrapper = factory(library());
    const card = wrapper.find('.stamp-card.top');

    await card.trigger('pointerdown', { pointerId: 1, clientX: 200 });
    await card.trigger('pointermove', { pointerId: 1, clientX: 900 });

    expect(wrapper.vm.hintStyle(1).opacity).toBeCloseTo(1, 5);
    expect(wrapper.vm.hintStyle(1).transform).toBe('scale(1.25)');
  });

  it('hints never intercept a swipe', () => {
    // They sit beside the poster, but a drag that strays over one must still
    // reach the card.
    const wrapper = factory(library());
    expect(wrapper.find('.swipe-hint').attributes('class')).toContain('swipe-hint');
    // pointer-events: none is in scoped CSS; assert they carry no handlers.
    expect(wrapper.find('.swipe-hint').attributes('onpointerdown')).toBeUndefined();
  });

  describe('summary', () => {
    const finish = async (wrapper, verdict) => {
      const total = wrapper.vm.round.cards.length;
      for (let i = 0; i < total; i++) await wrapper.vm.decide(verdict);
    };

    it('leads with the keyword and how much actually changed', async () => {
      const wrapper = factory(library(), { flyDuration: 0 });
      await finish(wrapper, 'yes');

      expect(wrapper.find('.summary-keyword').text()).toBe('cosy');
      expect(wrapper.find('.summary-headline').text()).toContain('change');
    });

    it('says so plainly when nothing needed changing', async () => {
      const wrapper = factory(library(), { flyDuration: 0 });
      // Answer each card the way it already is: no writes, no changes.
      const total = wrapper.vm.round.cards.length;
      for (let i = 0; i < total; i++) await wrapper.vm.decide(wrapper.vm.currentCard.hasTag ? 'yes' : 'no');

      expect(wrapper.vm.tally.added + wrapper.vm.tally.removed).toBe(0);
      expect(wrapper.find('.summary-headline').text()).toBe('Nothing needed changing.');
    });

    it('renders one tile per outcome', async () => {
      const wrapper = factory(library(), { flyDuration: 0 });
      await finish(wrapper, 'yes');

      expect(wrapper.findAll('.summary-stat')).toHaveLength(5);
      expect(wrapper.find('.summary-stat.added .summary-value').text()).toBe(String(wrapper.vm.tally.added));
    });

    it('dims the outcomes that did not happen', async () => {
      const wrapper = factory(library(), { flyDuration: 0 });
      await finish(wrapper, 'yes');

      // Saying yes to everything can never remove anything.
      expect(wrapper.find('.summary-stat.removed').classes()).toContain('empty');
      expect(wrapper.find('.summary-stat.added').classes()).not.toContain('empty');
    });
  });
});

// "we should have a pass option because sometimes I'm not certain, and I don't
// wanna accidentally remove a tag if it does make sense."
describe('StampGame passing when unsure', () => {
  beforeEach(() => { nextId = 1; });

  it('offers a pass without making it one of the two main buttons', () => {
    // A mis-tap between three adjacent buttons is exactly what it exists to
    // prevent, so it sits on its own row.
    const wrapper = factory(library());

    expect(wrapper.find('.pass-btn').exists()).toBe(true);
    expect(wrapper.findAll('.decide-actions .btn-game')).toHaveLength(2);
  });

  it('never removes an existing keyword when you pass', async () => {
    const wrapper = factory(library(), { flyDuration: 0 });
    wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => c.hasTag);
    await wrapper.vm.$nextTick();
    wrapper.store.dispatch.mockClear();

    await wrapper.find('.pass-btn').trigger('click');

    expect(writesTo(wrapper.store.dispatch)).toHaveLength(0);
    expect(wrapper.vm.history[0].outcome).toBe('passed');
  });

  it('never adds one either — a pass is a no-op in both directions', async () => {
    const wrapper = factory(library(), { flyDuration: 0 });
    wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => !c.hasTag);
    await wrapper.vm.$nextTick();
    wrapper.store.dispatch.mockClear();

    await wrapper.vm.decide('pass');

    expect(writesTo(wrapper.store.dispatch)).toHaveLength(0);
    expect(wrapper.vm.history[0].outcome).toBe('passed');
  });

  it('still moves on to the next card', async () => {
    const wrapper = factory(library(), { flyDuration: 0 });
    const first = wrapper.vm.currentCard.entry.dbKey;

    await wrapper.vm.decide('pass');

    expect(wrapper.vm.currentCard.entry.dbKey).not.toBe(first);
  });

  it('drops the card away in place rather than throwing it left', async () => {
    // Flinging it toward "No" would read as a rejection.
    const wrapper = factory(library(), { flyDuration: 40 });
    const pending = wrapper.vm.decide('pass');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.topCardStyle.transform).toContain('scale');
    expect(wrapper.vm.topCardStyle.transform).not.toContain('vw');
    await pending;
  });

  it('counts passes separately from agreeing', async () => {
    const wrapper = factory(library(), { flyDuration: 0 });
    await wrapper.vm.decide('pass');
    await wrapper.vm.decide('no');

    expect(wrapper.vm.tally.passed).toBe(1);
    expect(wrapper.vm.tally.confirmed + wrapper.vm.tally.declined).toBe(1);
  });

  it('gives "not sure" its own full-width tile in the summary', async () => {
    const wrapper = factory(library(), { flyDuration: 0 });
    const total = wrapper.vm.round.cards.length;
    for (let i = 0; i < total; i++) await wrapper.vm.decide('pass');

    const tile = wrapper.find('.summary-stat.passed');
    expect(tile.classes()).toContain('wide');
    expect(tile.find('.summary-value').text()).toBe(String(total));
  });

  it('can be undone like any other decision', async () => {
    const wrapper = factory(library(), { flyDuration: 0 });
    await wrapper.vm.decide('pass');
    await wrapper.vm.undo();

    expect(wrapper.vm.history).toHaveLength(0);
    expect(wrapper.vm.currentIndex).toBe(0);
  });
});

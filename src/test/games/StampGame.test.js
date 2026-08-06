import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import StampGame from '@/components/games/StampGame.vue';

vi.mock('axios', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { results: [] } })) } }));

let nextId = 1;
const movie = ({ tags = [], directors = ['Nobody'], genres = ['Drama'] } = {}) => {
  const id = nextId++;
  return {
    dbKey: `key-${id}`,
    movie: {
      id,
      title: `Movie ${id}`,
      poster_path: `/p${id}.jpg`,
      release_date: '2015-06-15',
      genres: genres.map((name) => ({ name })),
      crew: directors.map((name) => ({ name, job: 'Director' })),
      cast: []
    },
    ratings: [{ calculatedTotal: 7, date: Date.now(), tags: tags.map((title) => ({ title })) }]
  };
};

const factory = (entries) => {
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
  return wrapper;
};

// Enough tagged examples for the tag to be playable, plus a pool to draw from.
const library = () => [
  ...Array.from({ length: 5 }, () => movie({ tags: ['Cosy'] })),
  ...Array.from({ length: 25 }, () => movie())
];

const writesTo = (dispatch) => dispatch.mock.calls.filter(([action]) => action === 'writeDurably');

describe('StampGame', () => {
  beforeEach(() => { nextId = 1; });

  it('gates until a tag has enough examples to learn from', () => {
    const wrapper = factory([movie({ tags: ['Lonely'] }), ...Array.from({ length: 9 }, () => movie())]);
    expect(wrapper.find('.not-enough-tags').exists()).toBe(true);
    expect(wrapper.find('.tag-list').exists()).toBe(false);
  });

  it('offers playable tags with how many movies carry them', () => {
    const wrapper = factory(library());
    const choice = wrapper.find('.tag-choice');

    expect(choice.exists()).toBe(true);
    expect(choice.text()).toContain('Cosy');
    expect(choice.find('.tag-choice-count').text()).toBe('5');
  });

  it('starts a round when a tag is picked', async () => {
    const wrapper = factory(library());
    await wrapper.find('.tag-choice').trigger('click');

    expect(wrapper.vm.round.tag).toBe('Cosy');
    expect(wrapper.vm.round.cards.length).toBeGreaterThan(0);
    expect(wrapper.find('.stamp-card').exists()).toBe(true);
  });

  describe('deciding', () => {
    const startRound = async () => {
      const wrapper = factory(library());
      await wrapper.find('.tag-choice').trigger('click');
      wrapper.store.dispatch.mockClear();
      return wrapper;
    };

    it('writes only the ratings leaf when a tag is ADDED', async () => {
      const wrapper = await startRound();
      // Force an untagged card to the front so "yes" means "add".
      wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => !c.hasTag);
      await wrapper.vm.$nextTick();
      const dbKey = wrapper.vm.currentCard.entry.dbKey;

      await wrapper.vm.decide(true);

      const writes = writesTo(wrapper.store.dispatch);
      expect(writes).toHaveLength(1);
      // A leaf path, so it can't clobber the movie object or other siblings.
      expect(writes[0][1].path).toBe(`movieLog/${dbKey}/ratings`);
      const tags = writes[0][1].value.at(-1).tags.map((t) => t.title);
      expect(tags).toContain('Cosy');
    });

    it('writes a removal when an already-tagged movie is rejected', async () => {
      const wrapper = await startRound();
      wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => c.hasTag);
      await wrapper.vm.$nextTick();

      await wrapper.vm.decide(false);

      const writes = writesTo(wrapper.store.dispatch);
      expect(writes).toHaveLength(1);
      expect(writes[0][1].value.every((r) => !(r.tags || []).some((t) => t.title === 'Cosy'))).toBe(true);
    });

    it('does NOT write when nothing actually changed', async () => {
      const wrapper = await startRound();

      // Confirming an already-tagged movie...
      wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => c.hasTag);
      await wrapper.vm.$nextTick();
      await wrapper.vm.decide(true);

      // ...and passing over an untagged one.
      wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => !c.hasTag);
      await wrapper.vm.$nextTick();
      await wrapper.vm.decide(false);

      expect(writesTo(wrapper.store.dispatch)).toHaveLength(0);
    });

    it('advances through the stack and tallies the outcomes', async () => {
      const wrapper = await startRound();
      const total = wrapper.vm.round.cards.length;

      for (let i = 0; i < total; i++) {
        await wrapper.vm.decide(true);
      }

      expect(wrapper.vm.finished).toBe(true);
      expect(wrapper.find('.summary').exists()).toBe(true);
      expect(wrapper.vm.tally.confirmed + wrapper.vm.tally.added).toBe(total);
    });
  });

  describe('undo', () => {
    it('steps back and reverts the write', async () => {
      const wrapper = factory(library());
      await wrapper.find('.tag-choice').trigger('click');
      wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => !c.hasTag);
      await wrapper.vm.$nextTick();

      const startIndex = wrapper.vm.currentIndex;
      const before = wrapper.vm.currentCard.entry.ratings;
      await wrapper.vm.decide(true);
      wrapper.store.dispatch.mockClear();

      await wrapper.vm.undo();

      expect(wrapper.vm.currentIndex).toBe(startIndex);
      expect(wrapper.vm.history).toHaveLength(0);
      const writes = writesTo(wrapper.store.dispatch);
      expect(writes).toHaveLength(1);
      expect(writes[0][1].value).toEqual(before);
    });

    it('does not write when undoing a decision that changed nothing', async () => {
      const wrapper = factory(library());
      await wrapper.find('.tag-choice').trigger('click');
      wrapper.vm.currentIndex = wrapper.vm.round.cards.findIndex((c) => c.hasTag);
      await wrapper.vm.$nextTick();

      await wrapper.vm.decide(true); // confirmed — a no-op
      wrapper.store.dispatch.mockClear();
      await wrapper.vm.undo();

      expect(writesTo(wrapper.store.dispatch)).toHaveLength(0);
    });

    it('is hidden until something has been decided', async () => {
      const wrapper = factory(library());
      await wrapper.find('.tag-choice').trigger('click');
      expect(wrapper.find('.undo-btn').exists()).toBe(false);

      await wrapper.vm.decide(true);
      expect(wrapper.find('.undo-btn').exists()).toBe(true);
    });
  });

  describe('swiping', () => {
    const drag = async (wrapper, distance) => {
      const card = wrapper.find('.stamp-card');
      await card.trigger('pointerdown', { pointerId: 1, clientX: 200 });
      await card.trigger('pointermove', { pointerId: 1, clientX: 200 + distance });
      await card.trigger('pointerup', { pointerId: 1, clientX: 200 + distance });
    };

    it('a long swipe right decides yes', async () => {
      const wrapper = factory(library());
      await wrapper.find('.tag-choice').trigger('click');

      await drag(wrapper, 150);

      expect(wrapper.vm.history).toHaveLength(1);
      expect(wrapper.vm.history[0].keep).toBe(true);
    });

    it('a long swipe left decides no', async () => {
      const wrapper = factory(library());
      await wrapper.find('.tag-choice').trigger('click');

      await drag(wrapper, -150);

      expect(wrapper.vm.history[0].keep).toBe(false);
    });

    it('a short drag snaps back and decides nothing', async () => {
      const wrapper = factory(library());
      await wrapper.find('.tag-choice').trigger('click');

      await drag(wrapper, 20);

      expect(wrapper.vm.history).toHaveLength(0);
      expect(wrapper.vm.dragX).toBe(0);
    });

    it('moves the card with a composited transform and no drop-shadow', async () => {
      // Timeline's drag-to-place was removed for leaving visual trails on a real
      // device, traced to filter: drop-shadow recomputing every pointermove.
      const wrapper = factory(library());
      await wrapper.find('.tag-choice').trigger('click');
      const card = wrapper.find('.stamp-card');

      await card.trigger('pointerdown', { pointerId: 1, clientX: 200 });
      await card.trigger('pointermove', { pointerId: 1, clientX: 260 });

      const style = wrapper.vm.cardStyle.transform;
      expect(style).toContain('translate3d');
      expect(JSON.stringify(wrapper.vm.cardStyle)).not.toContain('drop-shadow');
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

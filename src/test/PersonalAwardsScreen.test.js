import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import PersonalAwardsScreen from '@/components/PersonalAwardsScreen.vue';
import PersonalAwardsModal from '@/components/PersonalAwardsModal.vue';

const DEFAULT_LIBRARY = [{ dbKey: 'k', movie: { id: 1, title: 'M', keywords: [{ name: 'kw' }] }, ratings: [] }];

function libraryForYears (yearCounts) {
  return Object.entries(yearCounts).flatMap(([year, count]) =>
    Array.from({ length: count }, (_, i) => ({
      dbKey: `${year}-${i}`,
      movie: { id: `${year}-${i}`, title: `M${i}`, release_date: `${year}-06-15`, runtime: 100, keywords: [] },
      ratings: []
    }))
  );
}

function factory (query = {}, settings = {}, library = DEFAULT_LIBRARY) {
  const pushSpy = vi.fn();
  const replaceSpy = vi.fn();
  const backSpy = vi.fn();
  const wrapper = shallowMount(PersonalAwardsScreen, {
    global: {
      mocks: {
        $store: {
          state: { settings },
          getters: { allMoviesAsArray: library }
        },
        $router: { push: pushSpy, back: backSpy, replace: replaceSpy },
        $route: { query }
      }
    }
  });
  return { wrapper, pushSpy, backSpy, replaceSpy };
}

// Feedback: the awards modal "always feels a little bit janky... maybe it
// would feel better if it was just a full page." /awards is that page.
describe('PersonalAwardsScreen', () => {
  it('renders the awards component in page mode, auto-opened, with the year from the URL', () => {
    const { wrapper } = factory({ year: '1997' }, { personalAwardName: 'Grosker' });
    const modal = wrapper.findComponent(PersonalAwardsModal);

    expect(modal.props('pageMode')).toBe(true);
    expect(modal.props('autoOpen')).toBe(true);
    expect(modal.props('selectedYear')).toBe(1997);
    expect(modal.props('personalAwardName')).toBe('Grosker');
    expect(modal.props('allEntriesWithFlatKeywordsAdded')[0].movie.flatKeywords).toEqual(['kw']);
  });

  it('tolerates a missing year (the component picks its own first eligible year)', () => {
    const { wrapper } = factory({});
    expect(wrapper.findComponent(PersonalAwardsModal).props('selectedYear')).toBeNull();
  });

  it('closing leaves the page (Home fallback when there is no history to go back to)', () => {
    const { wrapper, pushSpy, backSpy } = factory({ year: '1997' });
    wrapper.findComponent(PersonalAwardsModal).vm.$emit('closed');
    // jsdom starts with history.length === 1, so this exercises the fallback.
    expect(backSpy.mock.calls.length + pushSpy.mock.calls.length).toBeGreaterThan(0);
    if (pushSpy.mock.calls.length) expect(pushSpy).toHaveBeenCalledWith('/');
  });
  // "I'm not sure how to get to my awards view. If I wanna just look at a
  // single year's awards... a similar kind of side to side scrollable list of
  // years at the top of the awards page." (2026-08-16)
  describe('year strip', () => {
    const library = libraryForYears({ 1994: 12, 1997: 12, 2001: 12 });

    it('lists every eligible year, oldest first', () => {
      const { wrapper } = factory({ year: '1997' }, {}, library);

      expect(wrapper.findAll('.awards-year-pill').map((pill) => pill.find('.awards-year-label').text()))
        .toEqual(['1994', '1997', '2001']);
    });

    it('marks the year being viewed', async () => {
      const { wrapper } = factory({ year: '1997' }, {}, library);
      wrapper.findComponent(PersonalAwardsModal).vm.$emit('yearChanged', 1997);
      await wrapper.vm.$nextTick();

      const selected = wrapper.findAll('.awards-year-pill').filter((pill) => pill.classes('selected'));
      expect(selected).toHaveLength(1);
      expect(selected[0].find('.awards-year-label').text()).toBe('1997');
    });

    // The modal, not the URL, decides the year on a bare /awards.
    it('follows the year the modal reports even with no year in the URL', async () => {
      const { wrapper } = factory({}, {}, library);
      wrapper.findComponent(PersonalAwardsModal).vm.$emit('yearChanged', 2001);
      await wrapper.vm.$nextTick();

      const selected = wrapper.findAll('.awards-year-pill').filter((pill) => pill.classes('selected'));
      expect(selected[0].find('.awards-year-label').text()).toBe('2001');
    });

    it('shows progress per year: a trophy when complete, a count when partway', () => {
      const settings = {
        personalAwards: {
          1994: { completed: true },
          1997: { categories: { a: { nominees: [{ movieId: 1 }], winner: { movieId: 1 } } } }
        }
      };
      const { wrapper } = factory({ year: '1997' }, settings, library);
      const [completed, partial, untouched] = wrapper.findAll('.awards-year-pill');

      expect(completed.classes()).toContain('completed');
      expect(completed.find('.bi-trophy-fill').exists()).toBe(true);
      expect(partial.classes()).toContain('started');
      expect(partial.find('.awards-year-progress').text()).toBe('1/13');
      expect(untouched.classes()).not.toContain('started');
    });

    it('replaces the route rather than stacking history when you pick a year', async () => {
      const { wrapper, replaceSpy } = factory({ year: '1997' }, {}, library);
      wrapper.findComponent(PersonalAwardsModal).vm.$emit('yearChanged', 1997);
      await wrapper.vm.$nextTick();

      await wrapper.findAll('.awards-year-pill')[2].trigger('click');
      expect(replaceSpy).toHaveBeenCalledWith({ path: '/awards', query: { year: 2001 } });

      // Tapping the year you're already on is a no-op, not a redundant nav.
      replaceSpy.mockClear();
      await wrapper.findAll('.awards-year-pill')[1].trigger('click');
      expect(replaceSpy).not.toHaveBeenCalled();
    });
  });

  // Replaced by the page itself plus the year strip above it.
  it('no longer renders the old awards-results browser', () => {
    const { wrapper } = factory({ year: '1997' });
    expect(wrapper.find('.awards-results-panel').exists()).toBe(false);
  });
});

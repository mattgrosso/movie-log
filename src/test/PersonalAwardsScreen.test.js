import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import PersonalAwardsScreen from '@/components/PersonalAwardsScreen.vue';
import PersonalAwardsModal from '@/components/PersonalAwardsModal.vue';

function factory (query = {}, settings = {}) {
  const pushSpy = vi.fn();
  const backSpy = vi.fn();
  const wrapper = shallowMount(PersonalAwardsScreen, {
    global: {
      mocks: {
        $store: {
          state: { settings },
          getters: { allMoviesAsArray: [{ dbKey: 'k', movie: { id: 1, title: 'M', keywords: [{ name: 'kw' }] }, ratings: [] }] }
        },
        $router: { push: pushSpy, back: backSpy },
        $route: { query }
      }
    }
  });
  return { wrapper, pushSpy, backSpy };
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
});

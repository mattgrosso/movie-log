import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import DrawFromHat from '@/components/DrawFromHat.vue';

vi.mock('@/services/ErrorLogService.js', () => ({ default: { error: vi.fn() } }));

const HATS = [{ title: 'Just Matt', dbKey: 'k1' }, { title: 'Whole family', dbKey: 'k2' }];

function factory ({ hats = HATS, result = null, summaries = [] } = {}) {
  const push = vi.fn();
  const dispatch = vi.fn((action) => {
    if (action === 'loadMovieHatSummaries') return Promise.resolve(summaries);
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  });
  const wrapper = mount(DrawFromHat, {
    global: {
      mocks: {
        $store: { state: { movieHatSummaries: summaries }, getters: { linkedMovieHats: hats }, dispatch },
        $router: { push }
      }
    }
  });
  return { wrapper, dispatch, push };
}

async function drawFrom (wrapper, index = 0) {
  await wrapper.findAll('.hat-draw')[index].trigger('click');
  await wrapper.vm.$nextTick();
  await wrapper.vm.$nextTick();
}

describe('DrawFromHat', () => {
  it('stays out of the way until a hat is linked', () => {
    const { wrapper } = factory({ hats: [] });

    expect(wrapper.find('.draw-from-hat').exists()).toBe(false);
  });

  it('shows a card per linked hat and draws from the one pressed', async () => {
    const { wrapper, dispatch } = factory({
      result: { movie: { id: 550, title: 'Fight Club' }, hat: 'Whole family', remaining: 12 }
    });

    expect(wrapper.findAll('.hat-name').map((title) => title.text()))
      .toEqual(['Just Matt', 'Whole family']);

    await drawFrom(wrapper, 1);
    expect(dispatch).toHaveBeenCalledWith('drawFromMovieHat', { title: 'Whole family', dbKey: 'k2' });
  });

  // "A section lower down that shows each hat with the most recently drawn
  // movie, the total number of movies in the hat, and a button to draw."
  it('shows how many are waiting and what came out last', () => {
    const { wrapper } = factory({
      summaries: [{
        title: 'Just Matt',
        dbKey: 'k1',
        waiting: 128,
        lastDrawn: { title: 'Heat', poster_path: '/h.jpg', dateDrawn: Date.now() - 3 * 60 * 60 * 1000 }
      }]
    });
    const card = wrapper.findAll('.hat-card')[0];

    expect(card.find('.hat-waiting').text()).toBe('128 waiting');
    expect(card.find('.hat-last-text').text()).toContain('Heat');
    expect(card.find('.hat-last-text').text()).toContain('3 hours ago');
    expect(card.find('.hat-last-poster').attributes('alt')).toBe('Heat');
  });

  it('asks for the hat summaries when it appears', () => {
    const { dispatch } = factory({});
    expect(dispatch).toHaveBeenCalledWith('loadMovieHatSummaries');
  });

  // Settings arrive after mount. Loading in mounted() fetched an empty list
  // once and never retried, so every card sat on "…" forever.
  it('waits for the linked hats to arrive before loading them', async () => {
    const { wrapper, dispatch } = factory({ hats: [] });
    expect(dispatch).not.toHaveBeenCalledWith('loadMovieHatSummaries');

    wrapper.vm.$options.watch.hats.handler.call(wrapper.vm, HATS);
    expect(dispatch).toHaveBeenCalledWith('loadMovieHatSummaries');
  });

  it('refreshes the cards after a draw, since the count just changed', async () => {
    const { wrapper, dispatch } = factory({
      result: { movie: { id: 1, title: 'Heat' }, hat: 'Just Matt', remaining: 5 }
    });
    dispatch.mockClear();

    await drawFrom(wrapper);

    expect(dispatch).toHaveBeenCalledWith('loadMovieHatSummaries');
  });

  it('says so when a hat could not be loaded, rather than showing a wrong count', () => {
    const { wrapper } = factory({ summaries: [{ title: 'Just Matt', dbKey: 'k1', error: true }] });

    expect(wrapper.findAll('.hat-waiting')[0].text()).toBe("couldn't load");
  });

  it('shows what was drawn, who put it in, and what is left', async () => {
    const { wrapper } = factory({
      result: {
        movie: { id: 550, title: 'Fight Club', poster_path: '/f.jpg', addedBy: 'Natalie', note: 'For Friday' },
        hat: 'Just Matt',
        remaining: 127
      }
    });

    await drawFrom(wrapper);

    expect(wrapper.find('.drawn-title').text()).toBe('Fight Club');
    expect(wrapper.text()).toContain('Added by Natalie');
    expect(wrapper.find('.drawn-note').text()).toBe('For Friday');
    expect(wrapper.text()).toContain('127 left in Just Matt');
  });

  // "I don't want drawing from inside cinema roll to take me straight into
  // rating the movie because... I'll have to watch the movie first."
  it('does not push you into rating the movie', async () => {
    const { wrapper, push } = factory({
      result: { movie: { id: 550, title: 'Fight Club' }, hat: 'Just Matt', remaining: 3 }
    });

    await drawFrom(wrapper);

    expect(push).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toMatch(/rate/i);
  });

  it('looks the film up only when asked', async () => {
    const { wrapper, push } = factory({
      result: { movie: { id: 550, title: 'Fight Club' }, hat: 'Just Matt', remaining: 3 }
    });

    await drawFrom(wrapper);
    await wrapper.find('.drawn-link').trigger('click');

    expect(push).toHaveBeenCalledWith('/movie/550');
  });

  it('says so when the hat is empty', async () => {
    const { wrapper } = factory({ result: { movie: null, hat: 'Just Matt', remaining: 0 } });

    await drawFrom(wrapper);

    expect(wrapper.find('.draw-message').text()).toBe('Just Matt is empty. Which is sad.');
    expect(wrapper.find('.drawn').exists()).toBe(false);
  });

  it('reports a failure rather than showing a phantom draw', async () => {
    const { wrapper } = factory({ result: new Error('offline') });

    await drawFrom(wrapper);

    expect(wrapper.find('.draw-message').text()).toBe("Couldn't reach Just Matt.");
    expect(wrapper.find('.draw-message').classes()).toContain('draw-message-error');
    expect(wrapper.find('.drawn').exists()).toBe(false);
  });
});

// "I'd rather just see the whole history from that hat because that's all
// available... let's make it another scrollable list [and] maintain the draw
// button somewhere." (2026-08-17)
//
// The first cut appended the strip to a card that was a flex ROW of poster +
// body, so it landed as a squeezed third column — "the layout on the hat
// displays where you're showing the history is all busted". The card is a
// vertical block now, and the strip is a full-width sibling of the last-drawn
// row rather than a third item beside it.
describe('DrawFromHat history strip', () => {
  const HOUR = 60 * 60 * 1000;

  const withHistory = [{
    title: 'Dev Hat',
    dbKey: 'k1',
    waiting: 12,
    lastDrawn: { title: 'Newest', poster_path: '/n.jpg', dateDrawn: Date.now() - HOUR },
    history: [
      { id: 1, title: 'Newest', poster_path: '/n.jpg', dateDrawn: Date.now() - HOUR },
      { id: 2, title: 'Older', poster_path: '/o.jpg', dateDrawn: Date.now() - 50 * HOUR },
      { id: 3, title: 'Oldest', poster_path: null, dateDrawn: Date.now() - 900 * HOUR }
    ]
  }];

  it('shows every drawn movie, and says how many', async () => {
    const { wrapper } = factory({ hats: [{ title: 'Dev Hat', dbKey: 'k1' }], summaries: withHistory });
    await flushPromises();

    expect(wrapper.findAll('.hat-history-card')).toHaveLength(3);
    expect(wrapper.find('.hat-history-title').text()).toContain('3');
  });

  it('keeps the strip out of the last-drawn row so it can run full width', async () => {
    const { wrapper } = factory({ hats: [{ title: 'Dev Hat', dbKey: 'k1' }], summaries: withHistory });
    await flushPromises();

    // A child of the card, a sibling of .hat-last — not inside it.
    expect(wrapper.find('.hat-card > .hat-history').exists()).toBe(true);
    expect(wrapper.find('.hat-last .hat-history').exists()).toBe(false);
  });

  it('still offers the draw button alongside the history', async () => {
    const { wrapper } = factory({ hats: [{ title: 'Dev Hat', dbKey: 'k1' }], summaries: withHistory });
    await flushPromises();

    expect(wrapper.find('.hat-draw').exists()).toBe(true);
  });

  // One draw is the lastDrawn card already shown above it; a strip of one is
  // just the same poster twice.
  it('stays hidden until there is more than one draw to show', async () => {
    const { wrapper } = factory({
      hats: [{ title: 'Dev Hat', dbKey: 'k1' }],
      summaries: [{ ...withHistory[0], history: [withHistory[0].history[0]] }]
    });
    await flushPromises();

    expect(wrapper.find('.hat-history').exists()).toBe(false);
  });
});

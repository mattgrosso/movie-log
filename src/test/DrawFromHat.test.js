import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DrawFromHat from '@/components/DrawFromHat.vue';

vi.mock('@/services/ErrorLogService.js', () => ({ default: { error: vi.fn() } }));

const HATS = [{ title: 'Just Matt', dbKey: 'k1' }, { title: 'Whole family', dbKey: 'k2' }];

function factory ({ hats = HATS, result = null } = {}) {
  const push = vi.fn();
  const dispatch = vi.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)));
  const wrapper = mount(DrawFromHat, {
    global: { mocks: { $store: { getters: { linkedMovieHats: hats }, dispatch }, $router: { push } } }
  });
  return { wrapper, dispatch, push };
}

async function drawFrom (wrapper, index = 0) {
  await wrapper.findAll('.draw-button')[index].trigger('click');
  await wrapper.vm.$nextTick();
  await wrapper.vm.$nextTick();
}

describe('DrawFromHat', () => {
  it('stays out of the way until a hat is linked', () => {
    const { wrapper } = factory({ hats: [] });

    expect(wrapper.find('.draw-from-hat').exists()).toBe(false);
  });

  it('offers a button per linked hat and draws from the one pressed', async () => {
    const { wrapper, dispatch } = factory({
      result: { movie: { id: 550, title: 'Fight Club' }, hat: 'Whole family', remaining: 12 }
    });

    expect(wrapper.findAll('.draw-button').map((button) => button.text()))
      .toEqual(['Just Matt', 'Whole family']);

    await drawFrom(wrapper, 1);
    expect(dispatch).toHaveBeenCalledWith('drawFromMovieHat', { title: 'Whole family', dbKey: 'k2' });
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

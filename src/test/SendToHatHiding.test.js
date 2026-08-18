// "It would be nice if the hat icon button only appeared on movies that
// aren't already in one of my hats" (2026-08-17).
//
// The send-time check remains the authority; this is only about not
// offering a button that would just tell you "already in there".
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SendToHat from '../components/SendToHat.vue';

const HATS = [{ title: 'Just Matt', dbKey: 'hat-key' }];

function mountButton ({ movies, inHats = {}, hats = HATS } = {}) {
  const dispatch = vi.fn(() => Promise.resolve({ added: [], skipped: [] }));
  const commit = vi.fn();

  return {
    dispatch,
    commit,
    wrapper: mount(SendToHat, {
      props: { movies, variant: 'icon' },
      global: {
        mocks: {
          $store: {
            state: { movieHatMovieIds: inHats },
            getters: { linkedMovieHats: hats },
            dispatch,
            commit
          }
        },
        stubs: { teleport: true }
      }
    })
  };
}

const entry = (id) => ({ movie: { id, title: `Movie ${id}` } });

describe('SendToHat visibility', () => {
  it('offers the button for a movie that is not in any hat', () => {
    const { wrapper } = mountButton({ movies: entry(550), inHats: { 999: true } });
    expect(wrapper.find('.send-to-hat').exists()).toBe(true);
  });

  it('hides itself for a movie already waiting in a hat', () => {
    const { wrapper } = mountButton({ movies: entry(550), inHats: { 550: true } });
    expect(wrapper.find('.send-to-hat').exists()).toBe(false);
  });

  it('accepts a raw TMDB movie as well as a library entry', () => {
    const { wrapper } = mountButton({ movies: { id: 550, title: 'Fight Club' }, inHats: { 550: true } });
    expect(wrapper.find('.send-to-hat').exists()).toBe(false);
  });

  it('keeps a whole-list button while ANY of its movies is still missing', () => {
    const { wrapper } = mountButton({
      movies: [entry(1), entry(2), entry(3)],
      inHats: { 1: true, 2: true }
    });
    expect(wrapper.find('.send-to-hat').exists()).toBe(true);
  });

  it('hides a whole-list button once every movie in it is accounted for', () => {
    const { wrapper } = mountButton({
      movies: [entry(1), entry(2)],
      inHats: { 1: true, 2: true }
    });
    expect(wrapper.find('.send-to-hat').exists()).toBe(false);
  });

  it('still shows when nothing is known yet — an empty cache must not hide everything', () => {
    const { wrapper } = mountButton({ movies: entry(550), inHats: {} });
    expect(wrapper.find('.send-to-hat').exists()).toBe(true);
  });

  it('shows nothing at all when no hats are linked, as before', () => {
    const { wrapper } = mountButton({ movies: entry(550), hats: [] });
    expect(wrapper.find('.send-to-hat').exists()).toBe(false);
  });

  it('asks for the hat contents once when it renders', () => {
    const { dispatch } = mountButton({ movies: entry(550) });
    expect(dispatch).toHaveBeenCalledWith('ensureMovieHatContents');
  });

  it('does not ask when there are no hats to read', () => {
    const { dispatch } = mountButton({ movies: entry(550), hats: [] });
    expect(dispatch).not.toHaveBeenCalledWith('ensureMovieHatContents');
  });
});

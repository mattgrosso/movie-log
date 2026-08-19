import {
  describe, it, expect, vi
} from 'vitest';
import { mount } from '@vue/test-utils';
import WatchlistRow from '@/components/WatchlistRow.vue';

// Bug report, 2026-08-19: "sometimes a poster has an add to hat button.
// Sometimes it has an X button sometimes it has both... It should always be in
// the top right corner no matter where that is in the app and the X specific
// to the watchlist, let's move that down lower make it very small, but make it
// part of the text below the poster... it's awkward that the X button is
// sometimes on the right and sometimes on the left and sometimes it's a hat
// button sometimes it's an X button."
//
// The cause was one strip holding both controls under space-between: with the
// X present the hat was pushed LEFT, without it the hat sat RIGHT. So the hat
// moved depending on which row you were looking at.
const item = (key, title) => ({
  key,
  title,
  poster: `https://image.tmdb.org/t/p/w342/${key}.jpg`,
  meta: '8.44 · 3 years ago',
  source: { dbKey: key, movie: { id: 1, title } }
});

const factory = (props = {}) => mount(WatchlistRow, {
  props: { items: [item('a', 'A Film')], ...props },
  global: {
    mocks: {
      $store: { getters: { linkedMovieHats: [{ title: 'Just Matt', dbKey: 'k1' }] }, dispatch: vi.fn() }
    },
    stubs: { teleport: true }
  }
});

describe('watchlist poster controls', () => {
  it('keeps the hat button in the same strip whether or not the row is puntable', () => {
    const withX = factory({ puntable: true });
    const withoutX = factory({ puntable: false });

    // The strip that pins to the corner holds ONLY the hat now, so its
    // contents — and therefore the hat's position — can't shift between rows.
    expect(withX.find('.watchlist-card-actions').findAll('button')).toHaveLength(1);
    expect(withoutX.find('.watchlist-card-actions').findAll('button')).toHaveLength(1);
  });

  it('puts the punt X in the meta line under the poster, not over the artwork', () => {
    const wrapper = factory({ puntable: true });

    expect(wrapper.find('.watchlist-meta .punt-btn').exists()).toBe(true);
    expect(wrapper.find('.watchlist-card-actions .punt-btn').exists()).toBe(false);
  });

  it('shows no X at all on a row that cannot be punted', () => {
    const wrapper = factory({ puntable: false });

    expect(wrapper.find('.punt-btn').exists()).toBe(false);
    expect(wrapper.find('.watchlist-meta').text()).toContain('8.44');
  });

  it('still emits punt with the original source when the X is tapped', async () => {
    const wrapper = factory({ puntable: true });

    await wrapper.find('.punt-btn').trigger('click');

    expect(wrapper.emitted('punt')).toHaveLength(1);
    expect(wrapper.emitted('punt')[0][0]).toEqual(item('a', 'A Film').source);
  });

  it('does not also fire the card tap when the X is used', async () => {
    // .stop on the button — otherwise punting would navigate to the movie.
    const wrapper = factory({ puntable: true });

    await wrapper.find('.punt-btn').trigger('click');

    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('still renders the meta line when a puntable item has no meta text', () => {
    const wrapper = mount(WatchlistRow, {
      props: { items: [{ ...item('b', 'B Film'), meta: null }], puntable: true },
      global: {
        mocks: {
          $store: { getters: { linkedMovieHats: [{ title: 'Just Matt', dbKey: 'k1' }] }, dispatch: vi.fn() }
        },
        stubs: { teleport: true }
      }
    });

    // The X lives in that line, so the line has to exist even with no caption.
    expect(wrapper.find('.punt-btn').exists()).toBe(true);
    expect(wrapper.find('.watchlist-meta-text').exists()).toBe(false);
  });
});

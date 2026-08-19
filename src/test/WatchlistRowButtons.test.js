import {
  describe, it, expect, vi
} from 'vitest';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import WatchlistRow from '@/components/WatchlistRow.vue';

const rowSource = readFileSync(join(process.cwd(), 'src/components/WatchlistRow.vue'), 'utf8');

// The declarations directly on a selector, comments stripped so the rule
// can't be satisfied by its own prose.
const ruleFor = (selector) => {
  const start = rowSource.indexOf(`${selector} {`);
  expect(start, `${selector} should exist in WatchlistRow.vue`).toBeGreaterThan(-1);
  const body = rowSource.slice(start, rowSource.indexOf('}', start));
  return body.replace(/\/\*[\s\S]*?\*\//g, '');
};

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
  metaLines: ['8.44', '3 years ago'],
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
    // Two deliberate lines, not one string left to wrap.
    expect(wrapper.findAll('.watchlist-meta-line').map((n) => n.text())).toEqual(['8.44', '3 years ago']);
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

  it('keeps the X tap target clear of the poster above it', () => {
    // jsdom performs no layout (.claude/rules/testing.md), so this asserts
    // the declaration that governs the outcome, read from the stylesheet —
    // the same approach searchBoltStacking.test.js takes for a paint-order
    // rule that can only be expressed in CSS.
    //
    // Measured live on 1.88.1: centring the 40px target on the caption with
    // -12px top and bottom put it over the poster's bottom 8px, an invisible
    // control sitting on the artwork. That is the BackLink edge-strip bug
    // (an unseen overlay eating real taps) rebuilt by hand.
    const puntRule = ruleFor('.punt-btn');

    expect(puntRule).toContain('height: 40px');
    // A negative TOP margin is what climbed onto the poster.
    expect(puntRule).not.toMatch(/margin-top:\s*-/);
    expect(puntRule).not.toMatch(/margin:\s*-/);
  });

  // Bug report, 2026-08-19: "I like the new position for the X on the
  // watchlist posters, but... since now it always stacks the two lines no
  // matter how wide the content might be let's have the X on the right and
  // then have two lines of text separated by a hard return."
  describe('the caption', () => {
    it('renders each line as its own row rather than one wrapping string', () => {
      const wrapper = factory({ puntable: true });

      expect(wrapper.findAll('.watchlist-meta-line').map((n) => n.text()))
        .toEqual(['8.44', '3 years ago']);
    });

    it('keeps the X beside the caption block, not inside a line of it', () => {
      const wrapper = factory({ puntable: true });

      expect(wrapper.find('.watchlist-meta > .punt-btn').exists()).toBe(true);
      expect(wrapper.find('.watchlist-meta-line .punt-btn').exists()).toBe(false);
    });

    it('handles a single-line caption without inventing a blank second line', () => {
      const wrapper = mount(WatchlistRow, {
        props: { items: [{ ...item('c', 'C Film'), metaLines: ['92% match'] }], puntable: false },
        global: {
          mocks: {
            $store: { getters: { linkedMovieHats: [{ title: 'Just Matt', dbKey: 'k1' }] }, dispatch: vi.fn() }
          },
          stubs: { teleport: true }
        }
      });

      expect(wrapper.findAll('.watchlist-meta-line').map((n) => n.text())).toEqual(['92% match']);
    });

    it('drops empty lines rather than rendering gaps', () => {
      const wrapper = mount(WatchlistRow, {
        props: { items: [{ ...item('d', 'D Film'), metaLines: ['8.10', null, ''] }], puntable: false },
        global: {
          mocks: {
            $store: { getters: { linkedMovieHats: [{ title: 'Just Matt', dbKey: 'k1' }] }, dispatch: vi.fn() }
          },
          stubs: { teleport: true }
        }
      });

      expect(wrapper.findAll('.watchlist-meta-line')).toHaveLength(1);
    });
  });

  it('still renders the meta line when a puntable item has no meta text', () => {
    const wrapper = mount(WatchlistRow, {
      props: { items: [{ ...item('b', 'B Film'), metaLines: [] }], puntable: true },
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

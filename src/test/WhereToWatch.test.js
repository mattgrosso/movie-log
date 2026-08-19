import {
  describe, it, expect, vi, beforeEach
} from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import axios from 'axios';
import WhereToWatch from '@/components/WhereToWatch.vue';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

const provider = (id, name, priority) => ({
  provider_id: id,
  provider_name: name,
  logo_path: `/${id}.jpg`,
  display_priority: priority
});

const respondWith = (regionData) => {
  axios.get.mockResolvedValue({ data: { id: 1, results: { US: regionData } } });
};

// The sheet teleports to <body>; stubbing teleport keeps these assertions
// about behaviour rather than about where the node landed (same approach as
// SendToHat.test.js).
const factory = (movie) => mount(WhereToWatch, {
  props: { movie },
  global: { stubs: { teleport: true } }
});

describe('WhereToWatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The component caches per movie id for the life of the module, so every
    // test uses its own id — otherwise the second test to ask about a movie
    // gets the first one's answer and never calls axios at all.
    axios.get.mockResolvedValue({ data: { results: {} } });
  });

  it('renders nothing until a movie is handed to it', () => {
    const wrapper = factory(null);

    expect(wrapper.find('.wtw-sheet').exists()).toBe(false);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('lists the providers by group once the lookup lands', async () => {
    respondWith({
      link: 'https://www.themoviedb.org/movie/101/watch?locale=US',
      flatrate: [provider(8, 'Netflix', 0)],
      rent: [provider(2, 'Apple TV', 1)]
    });
    const wrapper = factory({ id: 101, title: 'Heat' });
    await flushPromises();

    expect(wrapper.find('.wtw-title').text()).toBe('Heat');
    expect(wrapper.findAll('.wtw-group-label').map((l) => l.text())).toEqual(['Streaming', 'Rent']);
    expect(wrapper.findAll('.wtw-logo').map((n) => n.attributes('alt'))).toEqual(['Netflix', 'Apple TV']);
    expect(wrapper.find('.wtw-link').attributes('href'))
      .toBe('https://www.themoviedb.org/movie/101/watch?locale=US');
  });

  it('asks TMDB for that movie id', async () => {
    respondWith({ flatrate: [provider(8, 'Netflix', 0)] });
    factory({ id: 102, title: 'Heat' });
    await flushPromises();

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toContain('/movie/102/watch/providers');
  });

  it('says so plainly when nothing carries it', async () => {
    respondWith({ link: 'https://example.com' });
    const wrapper = factory({ id: 103, title: 'Obscure' });
    await flushPromises();

    expect(wrapper.find('.wtw-status').text()).toContain('Not streaming, renting or selling anywhere');
    expect(wrapper.findAll('.wtw-logo')).toHaveLength(0);
  });

  it('reports a failed lookup instead of claiming nothing carries it', async () => {
    // The two states read identically to a user if you conflate them, and
    // one of them is wrong.
    axios.get.mockRejectedValue(new Error('network'));
    const wrapper = factory({ id: 104, title: 'Heat' });
    await flushPromises();

    expect(wrapper.find('.wtw-status').text()).toContain("Couldn't check");
  });

  it('retries after a failure rather than caching it', async () => {
    axios.get.mockRejectedValueOnce(new Error('network'));
    const wrapper = factory({ id: 105, title: 'Heat' });
    await flushPromises();
    expect(wrapper.find('.wtw-status').text()).toContain("Couldn't check");

    respondWith({ flatrate: [provider(8, 'Netflix', 0)] });
    await wrapper.setProps({ movie: null });
    await wrapper.setProps({ movie: { id: 105, title: 'Heat' } });
    await flushPromises();

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(wrapper.findAll('.wtw-logo').map((n) => n.attributes('alt'))).toEqual(['Netflix']);
  });

  it('only asks once for a movie it has already looked up', async () => {
    respondWith({ flatrate: [provider(8, 'Netflix', 0)] });
    const wrapper = factory({ id: 106, title: 'Heat' });
    await flushPromises();

    await wrapper.setProps({ movie: null });
    await wrapper.setProps({ movie: { id: 106, title: 'Heat' } });
    await flushPromises();

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(wrapper.findAll('.wtw-logo').map((n) => n.attributes('alt'))).toEqual(['Netflix']);
  });

  it('ignores a slow answer for a poster you have already moved on from', async () => {
    // Tap poster A, tap poster B before A lands: A's providers must not be
    // painted under B's title.
    let resolveA;
    axios.get.mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }));
    const wrapper = factory({ id: 107, title: 'Slow one' });

    respondWith({ flatrate: [provider(9, 'Second answer', 0)] });
    await wrapper.setProps({ movie: { id: 108, title: 'Second one' } });
    await flushPromises();

    resolveA({ data: { results: { US: { flatrate: [provider(1, 'First answer', 0)] } } } });
    await flushPromises();

    expect(wrapper.find('.wtw-title').text()).toBe('Second one');
    expect(wrapper.findAll('.wtw-logo').map((n) => n.attributes('alt'))).toEqual(['Second answer']);
  });

  // Bug report, 2026-08-19: "It shows me the streaming platforms is good but
  // it's way too big and spread out. Just the icons would be fine in the
  // various categories and it's a appears to be like a modal like a slide up
  // modal, but I can still scroll the content behind it so it should probably
  // prevent that."
  describe('compact icon layout', () => {
    it('shows logos without the name captions under them', async () => {
      respondWith({ flatrate: [provider(8, 'Netflix', 0), provider(9, 'Hulu', 1)] });
      const wrapper = factory({ id: 201, title: 'Heat' });
      await flushPromises();

      expect(wrapper.findAll('.wtw-logo')).toHaveLength(2);
      expect(wrapper.find('.wtw-provider-name').exists()).toBe(false);
    });

    it('keeps the name reachable on the icon itself', async () => {
      respondWith({ flatrate: [provider(8, 'Netflix', 0)] });
      const wrapper = factory({ id: 202, title: 'Heat' });
      await flushPromises();

      const logo = wrapper.find('.wtw-logo');
      expect(logo.attributes('alt')).toBe('Netflix');
      expect(logo.attributes('title')).toBe('Netflix');
    });

    it('still keeps the category labels', async () => {
      respondWith({ flatrate: [provider(8, 'Netflix', 0)], rent: [provider(2, 'Apple TV', 1)] });
      const wrapper = factory({ id: 203, title: 'Heat' });
      await flushPromises();

      expect(wrapper.findAll('.wtw-group-label').map((l) => l.text())).toEqual(['Streaming', 'Rent']);
    });

    it('shows a provider that has no logo rather than dropping it', async () => {
      axios.get.mockResolvedValue({
        data: {
          results: {
            US: {
              flatrate: [{ provider_id: 42, provider_name: 'Obscure Channel', logo_path: null, display_priority: 0 }]
            }
          }
        }
      });
      const wrapper = factory({ id: 204, title: 'Heat' });
      await flushPromises();

      const blank = wrapper.find('.wtw-logo-blank');
      expect(blank.exists()).toBe(true);
      expect(blank.text()).toBe('O');
      expect(blank.attributes('title')).toBe('Obscure Channel');
    });
  });

  describe('background scroll', () => {
    // <html> is the scrolling element in this app, so locking <body> alone
    // left the computed overflow-y on <html> at `visible` — the element a
    // finger actually scrolls was never constrained. Measured on the deployed
    // page; the first version of these tests asserted only the body style and
    // passed against exactly that. jsdom cannot scroll, so the closest honest
    // assertion here is that BOTH elements are held.
    const overflows = () => ({
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow
    });
    const clearOverflows = () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };

    it('locks the real scrolling element, not just the body', async () => {
      clearOverflows();
      respondWith({ flatrate: [provider(8, 'Netflix', 0)] });
      const wrapper = factory({ id: 205, title: 'Heat' });
      await flushPromises();

      expect(overflows()).toEqual({ html: 'hidden', body: 'hidden' });

      await wrapper.setProps({ movie: null });

      expect(overflows()).toEqual({ html: '', body: '' });
    });

    it('restores whatever the page had set, not a blanket empty string', async () => {
      clearOverflows();
      document.documentElement.style.overflow = 'auto';
      document.body.style.overflow = 'scroll';
      respondWith({ flatrate: [provider(8, 'Netflix', 0)] });
      const wrapper = factory({ id: 206, title: 'Heat' });
      await flushPromises();
      expect(overflows()).toEqual({ html: 'hidden', body: 'hidden' });

      await wrapper.setProps({ movie: null });

      expect(overflows()).toEqual({ html: 'auto', body: 'scroll' });
      clearOverflows();
    });

    it('does not leave the app locked if it unmounts while open', async () => {
      clearOverflows();
      respondWith({ flatrate: [provider(8, 'Netflix', 0)] });
      const wrapper = factory({ id: 207, title: 'Heat' });
      await flushPromises();
      expect(overflows()).toEqual({ html: 'hidden', body: 'hidden' });

      // The watchlist screen going away mid-sheet would otherwise leave the
      // whole app unscrollable with nothing on screen to explain it.
      wrapper.unmount();

      expect(overflows()).toEqual({ html: '', body: '' });
    });

    it('never locks for a sheet that was never opened', () => {
      clearOverflows();
      factory(null);

      expect(overflows()).toEqual({ html: '', body: '' });
    });
  });

  it('emits close from the close button', async () => {
    respondWith({ flatrate: [provider(8, 'Netflix', 0)] });
    const wrapper = factory({ id: 109, title: 'Heat' });
    await flushPromises();

    await wrapper.find('.wtw-close').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('credits JustWatch, as TMDB requires wherever this data is shown', async () => {
    respondWith({ flatrate: [provider(8, 'Netflix', 0)] });
    const wrapper = factory({ id: 110, title: 'Heat' });
    await flushPromises();

    expect(wrapper.find('.wtw-credit').text()).toContain('JustWatch');
  });
});

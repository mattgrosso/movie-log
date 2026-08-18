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
    expect(wrapper.findAll('.wtw-provider-name').map((n) => n.text())).toEqual(['Netflix', 'Apple TV']);
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
    expect(wrapper.findAll('.wtw-provider')).toHaveLength(0);
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
    expect(wrapper.findAll('.wtw-provider-name').map((n) => n.text())).toEqual(['Netflix']);
  });

  it('only asks once for a movie it has already looked up', async () => {
    respondWith({ flatrate: [provider(8, 'Netflix', 0)] });
    const wrapper = factory({ id: 106, title: 'Heat' });
    await flushPromises();

    await wrapper.setProps({ movie: null });
    await wrapper.setProps({ movie: { id: 106, title: 'Heat' } });
    await flushPromises();

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(wrapper.findAll('.wtw-provider-name').map((n) => n.text())).toEqual(['Netflix']);
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
    expect(wrapper.findAll('.wtw-provider-name').map((n) => n.text())).toEqual(['Second answer']);
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

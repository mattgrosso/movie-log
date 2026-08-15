import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LibraryPoster from '@/components/LibraryPoster.vue';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((entry) => ({ calculatedTotal: entry.ratings[0]?.calculatedTotal ?? 5 }))
}));

function entry (id, rating = 8) {
  return {
    dbKey: `key-${id}`,
    movie: { id, title: `Movie ${id}`, poster_path: `/p${id}.jpg` },
    ratings: [{ calculatedTotal: rating, date: '2024-06-15T12:00:00' }]
  };
}

function factory (movieCount = 12) {
  const movies = Array.from({ length: movieCount }, (_, i) => entry(i, 5 + (i % 5)));
  const wrapper = mount(LibraryPoster, {
    global: {
      mocks: {
        $store: { state: {}, getters: { allMoviesAsArray: movies }, dispatch: vi.fn(), commit: vi.fn() },
        $router: { push: vi.fn() }
      }
    }
  });
  return wrapper;
}

// jsdom has no real canvas — drawing is exercised only up to the guard.
// The selection/layout logic these controls drive is covered directly in
// posterArtifact.test.js.
describe('LibraryPoster', () => {
  it('offers the three selections and defaults to the top-100 mode', () => {
    const wrapper = factory();

    const labels = wrapper.findAll('.poster-mode').map((b) => b.text());
    expect(labels).toEqual(['My top 100', 'This year', 'Everything']);
    expect(wrapper.find('.poster-mode.selected').text()).toBe('My top 100');
    expect(wrapper.text()).toContain('12 movies');
  });

  it('switching modes recomputes the selection and grid label', async () => {
    const wrapper = factory(12);

    await wrapper.findAll('.poster-mode')[1].trigger('click'); // This year
    expect(wrapper.find('.poster-mode.selected').text()).toBe('This year');
    // 2024 watches are not this year, so the selection empties and the
    // generate button disables rather than building a blank poster.
    expect(wrapper.text()).toContain('0 movies');
    expect(wrapper.find('.generate-btn').attributes('disabled')).toBeDefined();
  });

  it('surfaces a friendly error when the canvas cannot be used (instead of hanging on Building…)', async () => {
    const wrapper = factory();

    await wrapper.find('.generate-btn').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    // jsdom's getContext returns null, which must land in the error path.
    expect(wrapper.vm.generating).toBe(false);
    expect(wrapper.find('.poster-error').exists()).toBe(true);
  });
});

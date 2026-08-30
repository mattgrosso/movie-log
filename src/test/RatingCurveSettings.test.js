import {
  describe, it, expect, vi, beforeEach
} from 'vitest';
import { mount } from '@vue/test-utils';
import RatingCurveSettings from '@/components/RatingCurveSettings.vue';

// Matt, 2026-08-24: "the ratings table should be inside of a collapsible
// accordion. So it's not always visible, just when I need it. And we should
// also add a graph that shows the adjusted curve and the actual curve on the
// same line chart."
//
// The split: the chart is the at-a-glance answer to "does this feel skewed?"
// and stays on screen; the eleven-row table is reference and collapses.

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((entry) => ({ calculatedTotal: entry?.score ?? 5 })),
  getAllRatings: vi.fn(() => [])
}));

const entry = (dbKey, title, score) => ({ dbKey, score, movie: { title, poster_path: null } });

const LIBRARY = [
  entry('top', 'Coco', 10),
  entry('high', 'The Fugitive', 8),
  entry('mid', 'The Game', 5),
  entry('low', 'Wicked', 3),
  entry('floor', 'Porky\'s', 0)
];

function factory (settings = {}) {
  return mount(RatingCurveSettings, {
    global: {
      // chart.js needs a real canvas, which jsdom doesn't provide; the chart's
      // DATA is tested directly in curvePreview.test.js.
      stubs: { LineChart: { template: '<div data-testid="curve-chart"></div>' } },
      mocks: {
        $store: {
          state: {
            settings: {
              normalizationTweak: 0.25,
              normalizationAnchors: { ten: 'top', five: 'mid' },
              ...settings
            }
          },
          getters: { allMoviesAsArray: LIBRARY },
          dispatch: vi.fn()
        }
      }
    }
  });
}

describe('the curve preview', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = factory();
  });

  it('shows the chart without being asked', () => {
    expect(wrapper.find('[data-testid="curve-chart"]').exists()).toBe(true);
  });

  it('keeps the per-rating table collapsed until you want it', () => {
    expect(wrapper.find('.ladder-table').exists()).toBe(false);
    expect(wrapper.find('.ladder-toggle').attributes('aria-expanded')).toBe('false');
  });

  it('opens and closes the table on tap', async () => {
    await wrapper.find('.ladder-toggle').trigger('click');
    expect(wrapper.find('.ladder-table').exists()).toBe(true);
    expect(wrapper.find('.ladder-toggle').attributes('aria-expanded')).toBe('true');

    await wrapper.find('.ladder-toggle').trigger('click');
    expect(wrapper.find('.ladder-table').exists()).toBe(false);
  });

  it('lists a row per rating once opened, worst-scoring movie named', async () => {
    await wrapper.find('.ladder-toggle').trigger('click');
    const rows = wrapper.findAll('.ladder-table tbody tr');
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0].find('.ladder-grade').text()).toBe('10');
  });

  it('plots movie counts against the rating, one bar of the axis per rating', () => {
    const { labels, datasets } = wrapper.vm.curveChartData;
    expect(labels).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(datasets).toHaveLength(2);
    expect(datasets.map((d) => d.label)).toEqual(['Your real ratings', 'After the curve']);
    // Y counts movies now, so it must not be pinned to a 0-10 ceiling.
    expect(wrapper.vm.curveChartOptions.scales.y.max).toBeUndefined();
    expect(wrapper.vm.curveChartOptions.scales.y.beginAtZero).toBe(true);
  });

  // Two lines carrying the same numbers would draw one line and say nothing,
  // and asserting only the labels would never notice. Each dataset has to be
  // the series it claims to be. The anchors here are deliberately set to BEND
  // the curve — with the default ones this fixture's two bells are identical,
  // which would make the assertion vacuous.
  it('plots the real spread and the curved spread as genuinely different lines', () => {
    const bent = factory({ normalizationAnchors: { ten: 'top', five: 'high' } });
    const [raw, curved] = bent.vm.curveChartData.datasets;
    const points = bent.vm.curvePoints;

    expect(raw.data).toEqual(points.map((point) => point.actual));
    expect(curved.data).toEqual(points.map((point) => point.adjusted));
    expect(raw.data).not.toEqual(curved.data);
  });

  // The whole reason the preview exists: this figure is what explained the
  // surprise, and it should be in front of him when it's true.
  it('warns when the five-anchor has pushed most of the library under a 5', () => {
    const high = factory({ normalizationAnchors: { ten: 'top', five: 'high' } });
    expect(high.vm.lowShare).toBeGreaterThanOrEqual(40);
    expect(high.find('.ladder-warning').exists()).toBe(true);
  });

  it('stays quiet when the spread is reasonable', () => {
    const low = factory({ normalizationAnchors: { ten: 'top', five: 'floor' } });
    expect(low.find('.ladder-warning').exists()).toBe(false);
  });
});

// Natalie, 2026-08-30: "I try edit on my five in the library settings to change
// my normalization, it just crashes and removes all the normalized settings
// from the screen."
//
// The pickers had NO component test at all, so when the curve-chart rewrite
// (47c58d1) swallowed pickerPool/pickerCandidates in a neighbouring hunk, the
// suite stayed green while every anchor poster was a dead tap. These mount the
// picker for real: a computed-only assertion would have missed it too, because
// the template's own `pickerCandidates.length` is half of what threw.
describe('the anchor pickers', () => {
  it('opens the five-picker on tapping the current five, without throwing', async () => {
    const wrapper = factory();
    const fivePoster = wrapper.findAll('.anchor-slot')[1].find('.anchor-poster');

    await fivePoster.trigger('click');

    expect(wrapper.vm.picking).toBe('five');
    expect(wrapper.find('.anchor-picker').exists()).toBe(true);
    expect(wrapper.findAll('.picker-card').length).toBeGreaterThan(0);
  });

  it('opens the ten-picker on tapping the current ten', async () => {
    const wrapper = factory();
    await wrapper.findAll('.anchor-slot')[0].find('.anchor-poster').trigger('click');

    expect(wrapper.vm.picking).toBe('ten');
    expect(wrapper.findAll('.picker-card').length).toBeGreaterThan(0);
  });

  // The rule the five-picker exists to enforce: a five at or above the ten
  // inverts the curve.
  it('offers only movies scoring below the ten-anchor when picking a five', async () => {
    const wrapper = factory();
    await wrapper.findAll('.anchor-slot')[1].find('.anchor-poster').trigger('click');

    const titles = wrapper.findAll('.picker-card').map((card) => card.find('.picker-name').text());
    expect(titles).not.toContain('Coco'); // the 10 itself
    expect(titles).toContain('The Fugitive');
    expect(titles).toEqual([...titles].sort((a, b) => {
      const score = (t) => LIBRARY.find((e) => e.movie.title === t).score;
      return score(b) - score(a);
    }));
  });

  it('narrows the pool as you type', async () => {
    const wrapper = factory();
    await wrapper.findAll('.anchor-slot')[0].find('.anchor-poster').trigger('click');
    await wrapper.find('.picker-search').setValue('fugitive');

    const titles = wrapper.findAll('.picker-card').map((card) => card.find('.picker-name').text());
    expect(titles).toEqual(['The Fugitive']);
  });

  it('writes the chosen movie as the anchor and closes the picker', async () => {
    const wrapper = factory();
    await wrapper.findAll('.anchor-slot')[1].find('.anchor-poster').trigger('click');
    await wrapper.findAll('.picker-card')[0].trigger('click');

    expect(wrapper.vm.$store.dispatch).toHaveBeenCalledWith('writeDurably', {
      path: 'settings/normalizationAnchors/five',
      value: 'high'
    });
    expect(wrapper.find('.anchor-picker').exists()).toBe(false);
  });

  // An empty slot reaches the picker by a different button, and that path was
  // equally dead.
  it('opens the picker from an empty slot too', async () => {
    const wrapper = factory({ normalizationAnchors: { ten: 'top' } });
    await wrapper.findAll('.anchor-slot')[1].find('.anchor-choose').trigger('click');

    expect(wrapper.vm.picking).toBe('five');
    expect(wrapper.findAll('.picker-card').length).toBeGreaterThan(0);
  });
});

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

  it('feeds the chart both lines on the same scale', () => {
    const { datasets } = wrapper.vm.curveChartData;
    expect(datasets).toHaveLength(2);
    expect(datasets.map((d) => d.label)).toEqual(['Raw score', 'After the curve']);
    expect(wrapper.vm.curveChartOptions.scales.y).toMatchObject({ min: 0, max: 10 });
  });

  // Two lines carrying the same numbers would draw one line and say nothing,
  // and asserting only the labels would never notice. Each dataset has to be
  // the series it claims to be.
  it('plots the raw scores and the curved values as genuinely different lines', () => {
    const [raw, curved] = wrapper.vm.curveChartData.datasets;
    const points = wrapper.vm.curvePoints;

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

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import WorldMap from '@/components/WorldMap.vue';

const point = (over = {}) => ({ name: 'Paris', lat: 48.85, lon: 2.35, type: 'filming', id: 'Q90', ...over });

describe('WorldMap', () => {
  it('renders the land outline', () => {
    const wrapper = mount(WorldMap, { props: { points: [] } });
    expect(wrapper.findAll('path.land').length).toBeGreaterThan(50);
  });

  it('plots one dot per point, classed by type', () => {
    const wrapper = mount(WorldMap, {
      props: { points: [point(), point({ name: 'Tokyo', type: 'narrative' })] }
    });

    expect(wrapper.findAll('circle.place-dot')).toHaveLength(2);
    expect(wrapper.findAll('circle.place-dot.filming')).toHaveLength(1);
    expect(wrapper.findAll('circle.place-dot.narrative')).toHaveLength(1);
  });

  describe('projection', () => {
    // Equirectangular over the 20000x10000 grid. Getting lat/lon the wrong way
    // round is the classic mistake here, so the poles and prime meridian are
    // pinned explicitly rather than trusted.
    const at = (lat, lon) => {
      const wrapper = mount(WorldMap, { props: { points: [point({ lat, lon })] } });
      const dot = wrapper.find('circle.place-dot');
      return { x: Number(dot.attributes('cx')), y: Number(dot.attributes('cy')) };
    };

    it('puts 0,0 at the centre', () => {
      expect(at(0, 0)).toEqual({ x: 10000, y: 5000 });
    });

    it('puts the north pole at the top and the south pole at the bottom', () => {
      expect(at(90, 0).y).toBe(0);
      expect(at(-90, 0).y).toBe(10000);
    });

    it('puts the antimeridian at each edge', () => {
      expect(at(0, -180).x).toBe(0);
      expect(at(0, 180).x).toBe(20000);
    });

    it('places a real city where it belongs — west and north of centre', () => {
      const paris = at(48.85, 2.35);
      expect(paris.x).toBeGreaterThan(10000); // just east of Greenwich
      expect(paris.y).toBeLessThan(5000); // northern hemisphere
    });
  });

  it('ignores points with missing or non-numeric coordinates', () => {
    const wrapper = mount(WorldMap, {
      props: { points: [point(), { name: 'Nowhere', type: 'filming' }, point({ lat: null })] }
    });

    expect(wrapper.findAll('circle.place-dot')).toHaveLength(1);
  });

  it('shows a label on tap and emits the point', async () => {
    const wrapper = mount(WorldMap, { props: { points: [point()] } });

    expect(wrapper.find('text.label-text').exists()).toBe(false);
    await wrapper.find('circle.place-dot').trigger('click');

    expect(wrapper.find('text.label-text').text()).toBe('Paris');
    expect(wrapper.emitted('select')[0][0]).toMatchObject({ name: 'Paris' });
  });

  it('tapping the same dot again hides the label and emits null', async () => {
    const wrapper = mount(WorldMap, { props: { points: [point()] } });
    const dot = wrapper.find('circle.place-dot');

    await dot.trigger('click');
    await dot.trigger('click');

    expect(wrapper.find('text.label-text').exists()).toBe(false);
    expect(wrapper.emitted('select')[1][0]).toBeNull();
  });

  it('flips a label to the left rather than letting it overflow the right edge', async () => {
    const wrapper = mount(WorldMap, {
      props: { points: [point({ name: 'A very long place name indeed', lon: 179, lat: 0 })] }
    });
    await wrapper.find('circle.place-dot').trigger('click');

    const box = wrapper.find('rect.label-bg');
    const x = Number(box.attributes('x'));
    const width = Number(box.attributes('width'));

    expect(x).toBeLessThan(19900);
    expect(x + width).toBeLessThanOrEqual(20000);
  });

  it('keeps a label inside the VISIBLE window, not the full projection space', async () => {
    // The display viewBox crops the empty polar caps, so clamping to the full
    // 0..1000 projection height would let a far-north label sit off-screen.
    const wrapper = mount(WorldMap, { props: { points: [point({ lat: 82, lon: 0 })] } });
    await wrapper.find('circle.place-dot').trigger('click');

    const [, top, , height] = wrapper.find('svg').attributes('viewBox').split(' ').map(Number);
    const box = wrapper.find('rect.label-bg');
    const y = Number(box.attributes('y'));
    // The RENDERED height, not the raw grid value — the label is drawn at the
    // zoom-scaled size, and that's what the clamp uses.
    const renderedHeight = Number(box.attributes('height'));

    expect(y).toBeGreaterThanOrEqual(top);
    expect(y + renderedHeight).toBeLessThanOrEqual(top + height);
  });

  it('projects against the full world grid even though the view is cropped', () => {
    // Deriving the projection size from the cropped viewBox would skew every
    // point northward — this pins that they stay separate.
    const wrapper = mount(WorldMap, { props: { points: [point({ lat: 0, lon: 0 })] } });
    expect(Number(wrapper.find('circle.place-dot').attributes('cy'))).toBe(5000);
  });

  it('gives every point a distinct key, even for the same place in both roles', () => {
    // A place that is both filmed-in and set-in renders twice; duplicate keys
    // would make Vue drop one of them.
    const wrapper = mount(WorldMap, {
      props: { points: [point({ type: 'filming' }), point({ type: 'narrative' })] }
    });

    expect(wrapper.findAll('circle.place-dot')).toHaveLength(2);
  });

  // Bug report: "the tiny little points on the map are way too small to
  // actually click on." Sizes used to be in grid units, so a dot rendered at
  // radius/20000 of the container — about 1.6 real pixels on a phone.
  describe('dot sizing, in real pixels', () => {
    // r is in grid units; this converts back to the CSS pixels a user sees.
    const renderedPx = (wrapper, selector) => {
      const [, , visibleWidth] = wrapper.find('svg').attributes('viewBox').split(' ').map(Number);
      const r = Number(wrapper.find(selector).attributes('r'));
      return r / visibleWidth * wrapper.vm.containerWidth;
    };

    it('renders a dot at its stated pixel size', () => {
      const wrapper = mount(WorldMap, { props: { points: [point()], dotRadius: 7 } });
      expect(renderedPx(wrapper, 'circle.place-dot')).toBeCloseTo(7, 5);
    });

    it('is the same real size zoomed in as zoomed out', () => {
      const tight = mount(WorldMap, {
        props: { points: [point({ lat: 51.5, lon: -0.13 }), point({ name: 'Oxford', lat: 51.75, lon: -1.26 })] }
      });
      const world = mount(WorldMap, { props: { points: [point()], fit: false } });

      expect(renderedPx(tight, 'circle.place-dot')).toBeCloseTo(renderedPx(world, 'circle.place-dot'), 5);
    });

    it('is big enough to actually tap', () => {
      const wrapper = mount(WorldMap, { props: { points: [point()] } });
      // The visible dot is deliberately small; the invisible target under it is
      // what has to be thumb-sized.
      expect(renderedPx(wrapper, 'circle.place-hit') * 2).toBeGreaterThanOrEqual(32);
    });

    it('puts a much larger invisible tap target under each dot', () => {
      const wrapper = mount(WorldMap, { props: { points: [point()] } });

      const hit = Number(wrapper.find('circle.place-hit').attributes('r'));
      const dot = Number(wrapper.find('circle.place-dot').attributes('r'));
      expect(hit).toBeGreaterThan(dot * 2);
    });

    it('selects the point when the tap target is hit, not just the dot', async () => {
      const wrapper = mount(WorldMap, { props: { points: [point()] } });
      await wrapper.find('circle.place-hit').trigger('click');

      expect(wrapper.emitted('select')[0][0]).toMatchObject({ name: 'Paris' });
    });
  });

  describe('auto-fit zoom', () => {
    const viewBoxOf = (wrapper) => wrapper.find('svg').attributes('viewBox').split(' ').map(Number);

    it('zooms in on a tight cluster instead of showing the whole world', () => {
      const wrapper = mount(WorldMap, {
        props: { points: [point({ lat: 51.5, lon: -0.13 }), point({ name: 'Oxford', lat: 51.75, lon: -1.26 })] }
      });

      const [, , width] = viewBoxOf(wrapper);
      expect(width).toBeLessThan(20000);
    });

    it('still contains every point after zooming', () => {
      const points = [
        point({ lat: 51.5, lon: -0.13 }),
        point({ name: 'Paris', lat: 48.85, lon: 2.35 }),
        point({ name: 'Madrid', lat: 40.4, lon: -3.7 })
      ];
      const wrapper = mount(WorldMap, { props: { points } });
      const [x, y, width, height] = viewBoxOf(wrapper);

      wrapper.findAll('circle.place-dot').forEach((dot) => {
        const cx = Number(dot.attributes('cx'));
        const cy = Number(dot.attributes('cy'));
        expect(cx).toBeGreaterThanOrEqual(x);
        expect(cx).toBeLessThanOrEqual(x + width);
        expect(cy).toBeGreaterThanOrEqual(y);
        expect(cy).toBeLessThanOrEqual(y + height);
      });
    });

    it('keeps dots a constant apparent size as it zooms', () => {
      // Sizes are in CSS pixels, converted to grid units through the current
      // zoom — so the grid-unit radius grows as the view narrows, and the real
      // rendered size stays put.
      const zoomed = mount(WorldMap, { props: { points: [point()] } });
      const [, , zoomedWidth] = viewBoxOf(zoomed);
      const expected = 7 * (zoomedWidth / zoomed.vm.containerWidth);

      expect(Number(zoomed.find('circle.place-dot').attributes('r'))).toBeCloseTo(expected, 5);
    });

    it('falls back to the whole-world view when there is nothing to fit', () => {
      const wrapper = mount(WorldMap, { props: { points: [] } });
      expect(wrapper.find('svg').attributes('viewBox')).toBe('0 333 20000 7889');
    });

    it('can be turned off', () => {
      const wrapper = mount(WorldMap, { props: { points: [point()], fit: false } });
      expect(wrapper.find('svg').attributes('viewBox')).toBe('0 333 20000 7889');
    });
  });
});

describe('WorldMap context layers', () => {
  const point = (over = {}) => ({ name: 'Paris', lat: 48.85, lon: 2.35, type: 'filming', id: 'Q90', ...over });

  it('draws country borders', () => {
    const wrapper = mount(WorldMap, { props: { points: [], fit: false } });
    expect(wrapper.findAll('path.border').length).toBeGreaterThan(100);
  });

  it('hides city labels at world zoom, where they would be clutter', () => {
    const wrapper = mount(WorldMap, { props: { points: [], fit: false } });
    expect(wrapper.findAll('g.city')).toHaveLength(0);
  });

  it('shows city labels once zoomed in', () => {
    // Two nearby points force a tight box.
    const wrapper = mount(WorldMap, {
      props: { points: [point({ lat: 34.05, lon: -118.24 }), point({ name: 'San Diego', lat: 32.7, lon: -117.16 })] }
    });

    const cities = wrapper.findAll('g.city');
    expect(cities.length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('Los Angeles');
  });

  it('only labels cities inside the current view', () => {
    const wrapper = mount(WorldMap, {
      props: { points: [point({ lat: 34.05, lon: -118.24 }), point({ name: 'San Diego', lat: 32.7, lon: -117.16 })] }
    });

    const [left, top, width, height] = wrapper.find('svg').attributes('viewBox').split(' ').map(Number);
    wrapper.findAll('g.city circle').forEach((dot) => {
      const x = Number(dot.attributes('cx'));
      const y = Number(dot.attributes('cy'));
      expect(x).toBeGreaterThanOrEqual(left);
      expect(x).toBeLessThanOrEqual(left + width);
      expect(y).toBeGreaterThanOrEqual(top);
      expect(y).toBeLessThanOrEqual(top + height);
    });
  })

  it('caps how many city labels it will draw', () => {
    const wrapper = mount(WorldMap, {
      props: { points: [point({ lat: 50, lon: 5 }), point({ name: 'Berlin', lat: 52.5, lon: 13.4 })] }
    });
    expect(wrapper.findAll('g.city').length).toBeLessThanOrEqual(wrapper.vm.maxVisibleCities);
  })

  it('sizes city labels in real pixels too, like everything else on the map', () => {
    const wrapper = mount(WorldMap, {
      props: { points: [point({ lat: 34.05, lon: -118.24 }), point({ name: 'San Diego', lat: 32.7, lon: -117.16 })] }
    });

    const expected = wrapper.vm.cityDotRadius * wrapper.vm.unitsPerPixel;
    expect(Number(wrapper.find('g.city circle').attributes('r'))).toBeCloseTo(expected, 5);
  })
})

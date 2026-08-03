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
    // Equirectangular over a 2000x1000 viewBox. Getting lat/lon the wrong way
    // round is the classic mistake here, so the poles and prime meridian are
    // pinned explicitly rather than trusted.
    const at = (lat, lon) => {
      const wrapper = mount(WorldMap, { props: { points: [point({ lat, lon })] } });
      const dot = wrapper.find('circle.place-dot');
      return { x: Number(dot.attributes('cx')), y: Number(dot.attributes('cy')) };
    };

    it('puts 0,0 at the centre', () => {
      expect(at(0, 0)).toEqual({ x: 1000, y: 500 });
    });

    it('puts the north pole at the top and the south pole at the bottom', () => {
      expect(at(90, 0).y).toBe(0);
      expect(at(-90, 0).y).toBe(1000);
    });

    it('puts the antimeridian at each edge', () => {
      expect(at(0, -180).x).toBe(0);
      expect(at(0, 180).x).toBe(2000);
    });

    it('places a real city where it belongs — west and north of centre', () => {
      const paris = at(48.85, 2.35);
      expect(paris.x).toBeGreaterThan(1000); // just east of Greenwich
      expect(paris.y).toBeLessThan(500); // northern hemisphere
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

    expect(x).toBeLessThan(1990);
    expect(x + width).toBeLessThanOrEqual(2000);
  });

  it('keeps a label inside the VISIBLE window, not the full projection space', async () => {
    // The display viewBox crops the empty polar caps, so clamping to the full
    // 0..1000 projection height would let a far-north label sit off-screen.
    const wrapper = mount(WorldMap, { props: { points: [point({ lat: 82, lon: 0 })] } });
    await wrapper.find('circle.place-dot').trigger('click');

    const [, top, , height] = wrapper.find('svg').attributes('viewBox').split(' ').map(Number);
    const y = Number(wrapper.find('rect.label-bg').attributes('y'));

    expect(y).toBeGreaterThanOrEqual(top);
    expect(y + wrapper.vm.labelHeight).toBeLessThanOrEqual(top + height);
  });

  it('projects against the full world grid even though the view is cropped', () => {
    // Deriving the projection size from the cropped viewBox would skew every
    // point northward — this pins that they stay separate.
    const wrapper = mount(WorldMap, { props: { points: [point({ lat: 0, lon: 0 })] } });
    expect(Number(wrapper.find('circle.place-dot').attributes('cy'))).toBe(500);
  });

  it('gives every point a distinct key, even for the same place in both roles', () => {
    // A place that is both filmed-in and set-in renders twice; duplicate keys
    // would make Vue drop one of them.
    const wrapper = mount(WorldMap, {
      props: { points: [point({ type: 'filming' }), point({ type: 'narrative' })] }
    });

    expect(wrapper.findAll('circle.place-dot')).toHaveLength(2);
  });

  it('honours a custom dot radius, at the un-zoomed scale', () => {
    const wrapper = mount(WorldMap, { props: { points: [point()], dotRadius: 3, fit: false } });
    expect(wrapper.find('circle.place-dot').attributes('r')).toBe('3');
  });

  describe('auto-fit zoom', () => {
    const viewBoxOf = (wrapper) => wrapper.find('svg').attributes('viewBox').split(' ').map(Number);

    it('zooms in on a tight cluster instead of showing the whole world', () => {
      const wrapper = mount(WorldMap, {
        props: { points: [point({ lat: 51.5, lon: -0.13 }), point({ name: 'Oxford', lat: 51.75, lon: -1.26 })] }
      });

      const [, , width] = viewBoxOf(wrapper);
      expect(width).toBeLessThan(2000);
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
      // Dots are sized in viewBox units, so without compensation a 5x zoom
      // would render 5x bigger dots.
      const zoomed = mount(WorldMap, { props: { points: [point()] } });
      const [, , zoomedWidth] = viewBoxOf(zoomed);
      const expected = 9 * (zoomedWidth / 2000);

      expect(Number(zoomed.find('circle.place-dot').attributes('r'))).toBeCloseTo(expected, 5);
    });

    it('falls back to the whole-world view when there is nothing to fit', () => {
      const wrapper = mount(WorldMap, { props: { points: [] } });
      expect(wrapper.find('svg').attributes('viewBox')).toBe('0 33 2000 789');
    });

    it('can be turned off', () => {
      const wrapper = mount(WorldMap, { props: { points: [point()], fit: false } });
      expect(wrapper.find('svg').attributes('viewBox')).toBe('0 33 2000 789');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CoverageMap from '@/components/CoverageMap.vue';

const WORLD = {
  width: 360,
  height: 180,
  viewBox: '0 0 360 180',
  countries: [
    { iso: 'AA', name: 'Alpha', rings: [[190, 70, 200, 70, 200, 80, 190, 80]] },
    { iso: 'BB', name: 'Beta', rings: [[210, 70, 220, 70, 220, 80, 210, 80]] },
    { iso: 'CC', name: 'Gamma', rings: [[160, 90, 170, 90, 165, 100]] }
  ]
};

const BASE = '#33475b';

const mountMap = (props = {}) => mount(CoverageMap, { props: { world: WORLD, ...props } });

// Gestures are tracked on the window once they start, so a detached mount
// would never hear a move: these mount into the document and clean up.
const mountAttached = (props = {}) => mount(CoverageMap, { props: { world: WORLD, ...props }, attachTo: document.body });
const pointer = (type, { pointerId, clientX = 0, clientY = 0 }) => {
  const event = new MouseEvent(type, { clientX, clientY, bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
};

const fillOf = (wrapper, iso) => wrapper.find(`path[data-iso="${iso}"]`).attributes('style');

describe('CoverageMap', () => {
  it('draws one path per country', () => {
    const wrapper = mountMap();
    expect(wrapper.findAll('path.country')).toHaveLength(3);
    // A square window on the 360×180 world, the world centred in it.
    expect(wrapper.find('svg').attributes('viewBox')).toBe('0 -90 360 360');
  });

  it('leaves an unvisited country the base colour', () => {
    const wrapper = mountMap({ counts: { AA: 4 } });
    expect(fillOf(wrapper, 'BB')).toContain(`fill: ${BASE}`);
    expect(wrapper.find('path[data-iso="BB"]').classes()).not.toContain('counted');
    expect(wrapper.find('path[data-iso="AA"]').classes()).toContain('counted');
  });

  it('gives the most-visited country the strongest shade', () => {
    const wrapper = mountMap({ counts: { AA: 1, BB: 40, CC: 3 } });
    const ramp = wrapper.vm.ramp;
    expect(fillOf(wrapper, 'BB')).toContain(ramp[ramp.length - 1]);
    expect(fillOf(wrapper, 'AA')).toContain(ramp[0]);
    expect(fillOf(wrapper, 'AA')).not.toContain(BASE);
  });

  it('spreads a small library across the ramp too', () => {
    const wrapper = mountMap({ counts: { AA: 1, BB: 2 } });
    const ramp = wrapper.vm.ramp;
    expect(fillOf(wrapper, 'BB')).toContain(ramp[ramp.length - 1]);
    expect(fillOf(wrapper, 'AA')).not.toContain(ramp[ramp.length - 1]);
  });

  it('emits the tapped country, and null when tapped again', async () => {
    const wrapper = mountMap({ counts: { AA: 2 } });
    await wrapper.find('path[data-iso="AA"]').trigger('click');
    expect(wrapper.emitted('select')[0][0]).toMatchObject({ iso: 'AA', name: 'Alpha' });

    await wrapper.setProps({ selectedIso: 'AA' });
    expect(wrapper.find('path[data-iso="AA"]').classes()).toContain('selected');
    await wrapper.find('path[data-iso="AA"]').trigger('click');
    expect(wrapper.emitted('select')[1][0]).toBeNull();
  });

  it('shows a five-step legend', () => {
    expect(mountMap().findAll('.legend-swatch')).toHaveLength(5);
  });
});

// Zoom (Matt, 2026-09-08: "I'd like to be able to zoom in on the map").
describe('CoverageMap zoom', () => {
  const view = (wrapper) => wrapper.find('svg').attributes('viewBox').split(' ').map(Number);

  it('starts on the whole world in a square window, with zoom-out and reset disabled', () => {
    const wrapper = mountMap();
    expect(view(wrapper)).toEqual([0, -90, 360, 360]);
    expect(wrapper.find('rect.ocean').attributes('height')).toBe('360');
    expect(wrapper.find('[aria-label="Zoom out"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[aria-label="Whole world"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('svg').classes()).not.toContain('zoomed');
  });

  it('the buttons zoom about the centre, clamp to the world, and reset', async () => {
    const wrapper = mountMap();
    await wrapper.find('[aria-label="Zoom in"]').trigger('click');
    const [x, y, w, h] = view(wrapper);
    expect(w).toBeCloseTo(200, 5);
    expect(h).toBeCloseTo(200, 5);
    expect(x).toBeCloseTo(80, 5);
    expect(y).toBeCloseTo(-10, 5);
    expect(wrapper.find('svg').classes()).toContain('zoomed');

    await wrapper.find('[aria-label="Zoom out"]').trigger('click');
    await wrapper.find('[aria-label="Zoom out"]').trigger('click');
    expect(view(wrapper)).toEqual([0, -90, 360, 360]);

    for (let i = 0; i < 12; i++) await wrapper.find('[aria-label="Zoom in"]').trigger('click');
    expect(view(wrapper)[2]).toBeCloseTo(30, 5); // MAX_SCALE 12
    await wrapper.find('[aria-label="Whole world"]').trigger('click');
    expect(view(wrapper)).toEqual([0, -90, 360, 360]);
  });

  it('a one-finger drag pans only once zoomed, and does not select', async () => {
    const wrapper = mountAttached();
    const svg = wrapper.find('svg').element;
    svg.dispatchEvent(pointer('pointerdown', { pointerId: 1, clientX: 100, clientY: 50 }));
    window.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 140, clientY: 50 }));
    window.dispatchEvent(pointer('pointerup', { pointerId: 1, clientX: 140, clientY: 50 }));
    await wrapper.vm.$nextTick();
    expect(view(wrapper)).toEqual([0, -90, 360, 360]); // page scroll, not a pan

    wrapper.vm.zoomBy(2);
    await wrapper.vm.$nextTick();
    const before = view(wrapper);
    svg.dispatchEvent(pointer('pointerdown', { pointerId: 1, clientX: 100, clientY: 50 }));
    window.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 60, clientY: 50 }));
    // The click a drag ends with must not toggle a selection.
    await wrapper.find('path[data-iso="AA"]').trigger('click');
    window.dispatchEvent(pointer('pointerup', { pointerId: 1, clientX: 60, clientY: 50 }));
    await wrapper.vm.$nextTick();
    expect(view(wrapper)[0]).toBeGreaterThan(before[0]);
    expect(wrapper.emitted('select')).toBeUndefined();
    wrapper.unmount();
  });

  it('a tap still selects', async () => {
    const wrapper = mountAttached();
    const svg = wrapper.find('svg').element;
    svg.dispatchEvent(pointer('pointerdown', { pointerId: 1, clientX: 100, clientY: 50 }));
    window.dispatchEvent(pointer('pointerup', { pointerId: 1, clientX: 101, clientY: 50 }));
    await wrapper.find('path[data-iso="AA"]').trigger('click');
    expect(wrapper.emitted('select')[0][0]).toMatchObject({ iso: 'AA' });
    wrapper.unmount();
  });

  it('a pinch zooms in, and keeps reading after the fingers leave the box', async () => {
    const wrapper = mountAttached();
    const svg = wrapper.find('svg').element;
    svg.dispatchEvent(pointer('pointerdown', { pointerId: 1, clientX: 100, clientY: 50 }));
    svg.dispatchEvent(pointer('pointerdown', { pointerId: 2, clientX: 140, clientY: 50 }));
    // The second finger moves on well past the map; the event reaches the
    // window, not the svg.
    window.dispatchEvent(pointer('pointermove', { pointerId: 2, clientX: 300, clientY: 400 }));
    await wrapper.vm.$nextTick();
    expect(view(wrapper)[2]).toBeLessThan(360);
    window.dispatchEvent(pointer('pointerup', { pointerId: 2, clientX: 300, clientY: 400 }));
    window.dispatchEvent(pointer('pointerup', { pointerId: 1, clientX: 100, clientY: 50 }));
    expect(wrapper.vm.tracking).toBeFalsy();
    wrapper.unmount();
  });

  it('labels countries only when they are wide enough on screen', async () => {
    const wrapper = mountMap();
    expect(wrapper.findAll('.country-label')).toHaveLength(0);
    wrapper.vm.containerWidth = 360;
    // Zoom 12x about Alpha's own centre: one grid unit is now 12px, so
    // Alpha (10 units wide, 120px) fits a label; Beta, 15 units east, is
    // outside the 30-unit window.
    wrapper.vm.zoomAt(12, { x: 195, y: 75 });
    await wrapper.vm.$nextTick();
    const labels = wrapper.findAll('.country-label').map((n) => n.text());
    expect(labels).toEqual(['Alpha']);
  });
});

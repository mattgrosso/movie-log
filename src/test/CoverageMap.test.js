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

const fillOf = (wrapper, iso) => wrapper.find(`path[data-iso="${iso}"]`).attributes('style');

describe('CoverageMap', () => {
  it('draws one path per country', () => {
    const wrapper = mountMap();
    expect(wrapper.findAll('path.country')).toHaveLength(3);
    expect(wrapper.find('svg').attributes('viewBox')).toBe('0 0 360 180');
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

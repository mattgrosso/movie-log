import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

// Leaflet needs real layout and a real canvas, neither of which jsdom provides,
// so the library is mocked and the assertions are about how WE drive it —
// which tile URL, the required attribution, the zoom we pick, and teardown.
const mapInstance = {
  remove: vi.fn(),
  setView: vi.fn()
};
const markerInstance = { addTo: vi.fn(() => markerInstance), setLatLng: vi.fn() };
const tileLayerInstance = { addTo: vi.fn(() => tileLayerInstance) };

const mapMock = vi.fn(() => mapInstance);
const tileLayerMock = vi.fn(() => tileLayerInstance);
const circleMarkerMock = vi.fn(() => markerInstance);

vi.mock('leaflet', () => ({
  default: {
    map: (...args) => mapMock(...args),
    tileLayer: (...args) => tileLayerMock(...args),
    circleMarker: (...args) => circleMarkerMock(...args)
  }
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

const LocationDetailMap = (await import('@/components/LocationDetailMap.vue')).default;

const location = (over = {}) => ({
  name: 'Palais Galliera',
  lat: 48.8656,
  lon: 2.2967,
  type: 'filming',
  id: 'Q1234',
  ...over
});

const mountMap = (props = {}) => mount(LocationDetailMap, { props: { location: location(), ...props } });

describe('LocationDetailMap', () => {
  beforeEach(() => vi.clearAllMocks());

  it('centres on the location', () => {
    mountMap();
    expect(mapMock.mock.calls[0][1].center).toEqual([48.8656, 2.2967]);
  });

  it('uses OpenStreetMap tiles', () => {
    mountMap();
    expect(tileLayerMock.mock.calls[0][0]).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  });

  it('credits OpenStreetMap, which their tile policy requires', () => {
    mountMap();
    expect(tileLayerMock.mock.calls[0][1].attribution).toContain('OpenStreetMap');
  });

  it('leaves scroll-wheel zoom off so it cannot hijack page scrolling', () => {
    mountMap();
    expect(mapMock.mock.calls[0][1].scrollWheelZoom).toBe(false);
  });

  describe('choosing an initial zoom from how precise the point is', () => {
    // A country or state centroid is an arbitrary spot in the middle of a
    // landmass — dropping someone at street level there would be misleading.
    const zoomFor = (lat, lon) => {
      mountMap({ location: location({ lat, lon }) });
      return mapMock.mock.calls[0][1].zoom;
    };

    it('stays well back for a coarse, country-level point', () => {
      expect(zoomFor(32, -6)).toBeLessThanOrEqual(7);
    });

    it('goes to district level for a middling one', () => {
      expect(zoomFor(34.05, -118.24)).toBeGreaterThan(7);
      expect(zoomFor(34.05, -118.24)).toBeLessThan(16);
    });

    it('goes to street level for a genuinely precise one', () => {
      expect(zoomFor(48.86555556, 2.29666667)).toBeGreaterThanOrEqual(16);
    });
  });

  it('uses a circle marker rather than Leaflet\'s default icon', () => {
    // The default marker is a PNG referenced by relative path, which breaks
    // under webpack unless the asset paths are patched.
    mountMap();
    expect(circleMarkerMock).toHaveBeenCalled();
    expect(circleMarkerMock.mock.calls[0][1].fillColor).toBe('#f0ad4e');
  });

  it('colours the marker by location type, matching the overview map', () => {
    mountMap({ location: location({ type: 'narrative' }) });
    expect(circleMarkerMock.mock.calls[0][1].fillColor).toBe('#6ec1e4');
  });

  it('moves the existing map when the location changes, rather than rebuilding', async () => {
    const wrapper = mountMap();
    mapMock.mockClear();

    await wrapper.setProps({ location: location({ name: 'Tangier', lat: 35.76, lon: -5.8 }) });

    expect(mapMock).not.toHaveBeenCalled();
    expect(mapInstance.setView).toHaveBeenCalledWith([35.76, -5.8], expect.any(Number));
    expect(markerInstance.setLatLng).toHaveBeenCalledWith([35.76, -5.8]);
  });

  it('shows the place name and emits close', async () => {
    const wrapper = mountMap();

    expect(wrapper.find('.detail-name').text()).toBe('Palais Galliera');
    await wrapper.find('.detail-close').trigger('click');

    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('tears the map down on unmount', () => {
    mountMap().unmount();
    expect(mapInstance.remove).toHaveBeenCalled();
  });
});

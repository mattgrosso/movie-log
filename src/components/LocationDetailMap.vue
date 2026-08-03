<template>
  <div class="location-detail-map">
    <div class="detail-header">
      <span class="detail-name">{{ location.name }}</span>
      <button type="button" class="detail-close" aria-label="Close map" @click="$emit('close')">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>
    <div ref="mapEl" class="detail-canvas"></div>
  </div>
</template>

<script>
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Street-level view of ONE location, on real OpenStreetMap tiles.
//
// This deliberately sits alongside WorldMap rather than replacing it: the SVG
// map is good at "everywhere this movie went, at a glance" and works offline;
// this is good at "where exactly is that one", and needs a connection. Tapping
// a dot on the overview opens this.
//
// OSM tile policy (operations.osmfoundation.org/policies/tiles) — what it
// requires of us, all satisfied here:
//   - visible attribution: Leaflet's own control, configured below
//   - normal interactive viewing only, no bulk/offline prefetching. The service
//     worker's runtimeCaching rules are host-specific (TMDB images, Google
//     fonts) so tiles are never precached — do NOT add a broad image rule.
//   - no SLA: tiles can stop working with no notice, so nothing here is
//     load-bearing for the rest of the page.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default {
  name: 'LocationDetailMap',
  props: {
    location: {
      type: Object,
      required: true
    }
  },
  emits: ['close'],
  data () {
    return {
      map: null
    };
  },
  computed: {
    centre () {
      return [this.location.lat, this.location.lon];
    },
    // A country or state centroid is an arbitrary point in the middle of a
    // landmass, so dropping the user at street level there would be actively
    // misleading. Wikidata tells us how precise each point is via the number of
    // decimals it carries, which is a good enough proxy without another query.
    initialZoom () {
      const decimals = (value) => {
        const text = String(value);
        return text.includes('.') ? text.split('.')[1].length : 0;
      };
      const precision = Math.max(decimals(this.location.lat), decimals(this.location.lon));

      if (precision <= 1) return 7; // region-ish
      if (precision <= 3) return 12; // town/district
      return 16; // a real address
    }
  },
  watch: {
    // MovieDetail keeps this component mounted and swaps the location when a
    // different dot is tapped, so moving the map is cheaper (and less jarring)
    // than tearing it down and rebuilding.
    location () {
      if (this.map) {
        this.map.setView(this.centre, this.initialZoom);
        this.marker.setLatLng(this.centre);
      }
    }
  },
  mounted () {
    this.map = L.map(this.$refs.mapEl, {
      center: this.centre,
      zoom: this.initialZoom,
      // Scroll-wheel zoom hijacks page scrolling on a trackpad, which is
      // hostile on a page you're mostly scrolling through. Pinch and the
      // buttons still work.
      scrollWheelZoom: false
    });

    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(this.map);

    // A circle marker rather than L.marker: Leaflet's default marker icon is a
    // PNG referenced by relative path, which breaks under webpack unless the
    // asset paths are patched. A circle needs no assets and matches the dots on
    // the overview map anyway.
    this.marker = L.circleMarker(this.centre, {
      radius: 9,
      color: '#14202b',
      weight: 2,
      fillColor: this.location.type === 'narrative' ? '#6ec1e4' : '#f0ad4e',
      fillOpacity: 1
    }).addTo(this.map);
  },
  beforeUnmount () {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
};
</script>

<style lang="scss" scoped>
  .location-detail-map {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 6px;
    margin-top: 0.5rem;
    overflow: hidden;
  }

  .detail-header {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    padding: 0.4rem 0.6rem;
  }

  .detail-name {
    color: #eee;
    font-size: 0.85rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-close {
    background: none;
    border: none;
    color: #adb5bd;
    flex-shrink: 0;
    line-height: 1;
    padding: 0.2rem 0.3rem;

    // Mobile-first: press feedback only, no :hover (see CLAUDE.md).
    &:active {
      transform: scale(0.92);
    }
  }

  .detail-canvas {
    height: 240px;
    width: 100%;
  }
</style>

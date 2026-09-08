<template>
  <div ref="wrapper" class="coverage-map">
    <!-- A SQUARE stage, not the world's own 2.5:1 strip (Matt, 2026-09-08:
         "the image is so short vertically that when I pinch to zoom, I can
         only zoom a tiny bit before my fingers leave that box"). The home
         view is a square window on the grid with the world centred in it;
         the ocean fills the rest. Pointer moves are read from the window
         once a gesture starts, so fingers that wander off the box still
         count. -->
    <svg
      :viewBox="viewBoxString"
      class="coverage-map-svg"
      :class="{ zoomed: isZoomed }"
      role="img"
      :aria-label="ariaLabel"
      @pointerdown="onPointerDown"
      @wheel="onWheel"
    >
      <rect class="ocean" :x="home.x" :y="home.y" :width="home.w" :height="home.h"/>
      <path
        v-for="country in world.countries"
        :key="country.iso || country.name"
        :d="pathFor(country)"
        class="country"
        :class="{ selected: isSelected(country), counted: countFor(country) > 0 }"
        :style="{ fill: fillFor(country) }"
        :data-iso="country.iso || ''"
        @click="onCountryClick(country)"
      />
      <!-- Country names once there's room for them. Labels beat geometry:
           a shaded blob means nothing, a shaded blob called "Portugal"
           means everything. Only countries wide enough on screen get one,
           so the world view stays clean and a zoomed view fills in. -->
      <text
        v-for="label in visibleLabels"
        :key="`label-${label.key}`"
        :x="label.x"
        :y="label.y"
        class="country-label"
        :style="{ fontSize: `${px(LABEL_FONT_PX)}px` }"
        text-anchor="middle"
      >{{ label.name }}</text>
    </svg>
    <div class="coverage-controls">
      <div class="coverage-legend">
        <span class="legend-word">fewer</span>
        <span v-for="(colour, index) in ramp" :key="index" class="legend-swatch" :style="{ background: colour }"></span>
        <span class="legend-word">more</span>
      </div>
      <div class="zoom-buttons">
        <button type="button" class="zoom-button" aria-label="Zoom in" @click="zoomBy(ZOOM_STEP)"><i class="bi bi-plus-lg"></i></button>
        <button type="button" class="zoom-button" aria-label="Zoom out" :disabled="!isZoomed" @click="zoomBy(1 / ZOOM_STEP)"><i class="bi bi-dash-lg"></i></button>
        <button type="button" class="zoom-button" aria-label="Whole world" :disabled="!isZoomed" @click="resetView"><i class="bi bi-globe2"></i></button>
      </div>
    </div>
  </div>
</template>

<script>
import { pathFor } from '../assets/javascript/countryLookup.js';

// Natural Earth 50m country polygons, pre-projected at build time
// (scripts/generate-world-countries.mjs). Shaded by count — a choropleth,
// never dots — and zoomable (Matt, 2026-09-08: "I'd like to be able to zoom
// in on the map"): pinch, drag once zoomed, the buttons, ctrl+wheel on a
// desktop. The world data arrives as a prop so Insights can load it lazily.
const BASE = '#33475b';
const STEPS = 5;
const MAX_SCALE = 12;
const ZOOM_STEP = 1.8;
// Pointer travel under this many CSS pixels is a tap, not a drag.
const TAP_SLOP_PX = 8;
const LABEL_FONT_PX = 11;
// A country narrower than this on screen gets no label — it wouldn't fit.
const LABEL_MIN_WIDTH_PX = 44;

const hexToRgb = (hex) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mix = (from, to, t) => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})`;
};

const parseViewBox = (text) => {
  const [x, y, w, h] = String(text || '0 0 1 1').split(/\s+/).map(Number);
  return { x, y, w, h };
};

// The world's own viewBox (polar caps cropped) squared up: same width, the
// height made equal, and the crop centred vertically in it.
const squareHome = (world) => {
  const crop = parseViewBox(world.viewBox);
  return { x: crop.x, y: crop.y + (crop.h - crop.w) / 2, w: crop.w, h: crop.w };
};

export default {
  name: 'CoverageMap',
  props: {
    counts: { type: Object, default: () => ({}) },
    accent: { type: String, default: '#f0ad4e' },
    selectedIso: { type: String, default: null },
    ariaLabel: { type: String, default: 'Map of the world shaded by how many of your films touch each country' },
    world: { type: Object, required: true }
  },
  emits: ['select'],
  data () {
    return {
      ZOOM_STEP,
      LABEL_FONT_PX,
      view: squareHome(this.world),
      // Rendered width in CSS pixels — what turns pixel sizes into grid
      // units. Measured after mount; the default only stands in for jsdom.
      containerWidth: 360,
      pointers: new Map(),
      gesture: null
    };
  },
  computed: {
    home () {
      return squareHome(this.world);
    },
    viewBoxString () {
      const { x, y, w, h } = this.view;
      return `${x} ${y} ${w} ${h}`;
    },
    scale () {
      return this.home.w / this.view.w;
    },
    isZoomed () {
      return this.scale > 1.001;
    },
    // One CSS pixel in grid units at the current zoom and width.
    unitsPerPixel () {
      return this.view.w / (this.containerWidth || 360);
    },
    ramp () {
      return Array.from({ length: STEPS }, (_, i) => mix(BASE, this.accent, 0.3 + (0.7 * i) / (STEPS - 1)));
    },
    // Quantile breakpoints over the non-zero counts, so three countries and
    // ninety both spread across the whole ramp instead of huddling at one end.
    breakpoints () {
      const values = Object.values(this.counts || {}).filter((n) => n > 0).sort((a, b) => a - b);
      if (!values.length) return [];
      const last = values.length - 1;
      return Array.from({ length: STEPS - 1 }, (_, i) => values[Math.min(last, Math.ceil((values.length * (i + 1)) / STEPS))]);
    },
    // Where each country's name goes: the middle of its biggest ring's box.
    // Computed once per world; the boxes double as the label-fit test.
    labelPoints () {
      return (this.world.countries || []).map((country) => {
        let best = null;
        (country.rings || []).forEach((ring) => {
          let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
          for (let i = 0; i < ring.length; i += 2) {
            minX = Math.min(minX, ring[i]); maxX = Math.max(maxX, ring[i]);
            minY = Math.min(minY, ring[i + 1]); maxY = Math.max(maxY, ring[i + 1]);
          }
          const box = { minX, maxX, minY, maxY, width: maxX - minX };
          if (!best || box.width > best.width) best = box;
        });
        return best && {
          key: country.iso || country.name,
          name: country.name,
          x: (best.minX + best.maxX) / 2,
          y: (best.minY + best.maxY) / 2,
          width: best.width
        };
      }).filter(Boolean);
    },
    visibleLabels () {
      const { x, y, w, h } = this.view;
      const minWidthUnits = this.px(LABEL_MIN_WIDTH_PX);
      return this.labelPoints.filter((label) =>
        label.width >= minWidthUnits &&
        label.x >= x && label.x <= x + w && label.y >= y && label.y <= y + h
      );
    }
  },
  watch: {
    world () {
      this.resetView();
    }
  },
  mounted () {
    this.measure();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this.$refs.wrapper);
    } else {
      window.addEventListener('resize', this.measure);
    }
  },
  beforeUnmount () {
    this.stopTracking();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    } else {
      window.removeEventListener('resize', this.measure);
    }
  },
  methods: {
    pathFor,
    measure () {
      const width = this.$refs.wrapper?.offsetWidth;
      if (width) this.containerWidth = width;
    },
    px (pixels) {
      return pixels * this.unitsPerPixel;
    },
    countFor (country) {
      return (country.iso && this.counts?.[country.iso]) || 0;
    },
    fillFor (country) {
      const count = this.countFor(country);
      if (!count) return BASE;
      let step = 0;
      while (step < this.breakpoints.length && count >= this.breakpoints[step]) step += 1;
      return this.ramp[Math.min(step, STEPS - 1)];
    },
    isSelected (country) {
      return Boolean(this.selectedIso) && country.iso === this.selectedIso;
    },
    onCountryClick (country) {
      // A click that ended a drag or a pinch is not a tap on a country.
      if (this.gesture?.moved) return;
      this.$emit('select', this.isSelected(country) ? null : country);
    },

    // --- The view --------------------------------------------------------
    // Everything below edits `view` (the SVG viewBox) and clamps it: never
    // wider than the whole world, never past its edges, never past MAX_SCALE.
    clampView (next) {
      const home = this.home;
      const w = Math.min(home.w, Math.max(home.w / MAX_SCALE, next.w));
      const h = w * (home.h / home.w);
      const x = Math.min(home.x + home.w - w, Math.max(home.x, next.x));
      const y = Math.min(home.y + home.h - h, Math.max(home.y, next.y));
      return { x, y, w, h };
    },
    // Zoom by `factor` keeping the grid point `about` fixed on screen.
    zoomAt (factor, about) {
      const { x, y, w, h } = this.view;
      const ax = about ? about.x : x + w / 2;
      const ay = about ? about.y : y + h / 2;
      this.view = this.clampView({ x: ax - (ax - x) / factor, y: ay - (ay - y) / factor, w: w / factor, h: h / factor });
    },
    zoomBy (factor) {
      this.zoomAt(factor, null);
    },
    resetView () {
      this.view = squareHome(this.world);
    },
    panBy (dxPixels, dyPixels) {
      const { x, y, w, h } = this.view;
      const k = this.unitsPerPixel;
      this.view = this.clampView({ x: x - dxPixels * k, y: y - dyPixels * k, w, h });
    },
    // Screen (client) coordinates → grid units.
    toGrid (clientX, clientY) {
      const rect = this.$el.querySelector('svg').getBoundingClientRect();
      const width = rect.width || this.containerWidth;
      const height = rect.height || (width * this.view.h / this.view.w);
      return {
        x: this.view.x + ((clientX - rect.left) / width) * this.view.w,
        y: this.view.y + ((clientY - rect.top) / height) * this.view.h
      };
    },

    // --- Gestures ---------------------------------------------------------
    // One pointer: a tap (selects, via the path's own click) or, once
    // zoomed, a drag. Two pointers: a pinch about their midpoint. The
    // gesture records whether it moved, so the click that follows a drag is
    // ignored rather than selecting whatever the finger lifted off.
    onPointerDown (event) {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = [...this.pointers.values()];
      this.gesture = {
        moved: this.gesture?.moved || false,
        last: points.length === 1 ? points[0] : null,
        pinch: points.length === 2 ? this.pinchState(points) : null
      };
      // Track on the window for the rest of the gesture: a pinch that starts
      // in the box keeps zooming after the fingers leave it. (Pointer capture
      // alone was not holding on the phone.)
      if (!this.tracking) {
        this.tracking = true;
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('pointercancel', this.onPointerUp);
      }
    },
    stopTracking () {
      if (!this.tracking) return;
      this.tracking = false;
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerUp);
    },
    onPointerMove (event) {
      if (!this.pointers.has(event.pointerId) || !this.gesture) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = [...this.pointers.values()];

      if (points.length >= 2) {
        const now = this.pinchState(points);
        const before = this.gesture.pinch || now;
        const factor = before.distance > 0 ? now.distance / before.distance : 1;
        if (Math.abs(factor - 1) > 0.002 || before.mid.x !== now.mid.x || before.mid.y !== now.mid.y) {
          this.zoomAt(factor, this.toGrid(before.mid.x, before.mid.y));
          this.panBy(now.mid.x - before.mid.x, now.mid.y - before.mid.y);
          this.gesture.moved = true;
        }
        this.gesture.pinch = now;
        return;
      }

      const last = this.gesture.last;
      if (!last) { this.gesture.last = points[0]; return; }
      const dx = points[0].x - last.x;
      const dy = points[0].y - last.y;
      if (!this.gesture.moved && Math.hypot(dx, dy) < TAP_SLOP_PX) return;
      // At 1x there is nowhere to pan; a one-finger drag is the page
      // scrolling (touch-action: pan-y), and must stay that.
      if (!this.isZoomed) return;
      this.gesture.moved = true;
      this.panBy(dx, dy);
      this.gesture.last = points[0];
    },
    onPointerUp (event) {
      this.pointers.delete(event.pointerId);
      if (!this.pointers.size) {
        this.stopTracking();
        // Keep `moved` for the click event that follows a drag, then clear.
        const moved = this.gesture?.moved;
        this.gesture = moved ? { moved: true } : null;
        if (moved) setTimeout(() => { this.gesture = null; }, 0);
      } else {
        const points = [...this.pointers.values()];
        this.gesture.last = points.length === 1 ? points[0] : null;
        this.gesture.pinch = points.length === 2 ? this.pinchState(points) : null;
      }
    },
    pinchState ([a, b]) {
      return { distance: Math.hypot(b.x - a.x, b.y - a.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    },
    // A trackpad pinch arrives as a wheel event with ctrlKey; a plain wheel
    // is the page scrolling and is left alone.
    onWheel (event) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.01);
      this.zoomAt(factor, this.toGrid(event.clientX, event.clientY));
    }
  }
};
</script>

<style lang="scss" scoped>
  .coverage-map {
    width: 100%;
  }

  .coverage-map-svg {
    aspect-ratio: 1 / 1;
    display: block;
    height: auto;
    // At 1x a finger on the map scrolls the page; the browser owns vertical
    // panning and pinches reach us. Once zoomed the map owns every touch.
    touch-action: pan-y;
    width: 100%;

    &.zoomed {
      cursor: grab;
      touch-action: none;
    }
  }

  .ocean {
    fill: #14202b;
  }

  .country {
    cursor: pointer;
    stroke: #22323f;
    stroke-width: 1;
    // Strokes are in grid units; without this they'd thicken as the map zooms.
    vector-effect: non-scaling-stroke;

    // Mobile-first: press feedback only, never :hover (see vue-ui.md).
    &:active {
      opacity: 0.75;
    }

    &.selected {
      stroke: #fff;
      stroke-width: 2;
    }
  }

  .country-label {
    fill: #e8eef4;
    font-weight: 600;
    paint-order: stroke;
    pointer-events: none;
    stroke: #14202b;
    stroke-linejoin: round;
    stroke-width: 0.25em;
    user-select: none;
  }

  .coverage-controls {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
  }

  .coverage-legend {
    align-items: center;
    display: flex;
    gap: 0.3rem;
  }

  .legend-swatch {
    border-radius: 2px;
    display: inline-block;
    height: 10px;
    width: 22px;
  }

  .legend-word {
    // #b9b9b9 on the app's dark panels is ~8:1; .text-muted would fail here.
    color: #b9b9b9;
    font-size: 0.72rem;
    margin: 0 0.25rem;
  }

  .zoom-buttons {
    display: flex;
    gap: 0.3rem;
  }

  .zoom-button {
    align-items: center;
    background: #161616;
    border: 1px solid #2e2e2e;
    border-radius: 6px;
    color: #eee;
    display: flex;
    font-size: 0.9rem;
    height: 34px;
    justify-content: center;
    width: 34px;

    &:disabled {
      color: #6f6f6f;
    }

    &:active:not(:disabled) {
      opacity: 0.7;
    }
  }
</style>

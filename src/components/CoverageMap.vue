<template>
  <div class="coverage-map">
    <svg :viewBox="world.viewBox" class="coverage-map-svg" role="img" :aria-label="ariaLabel">
      <rect class="ocean" x="0" y="0" :width="world.width" :height="world.height"/>
      <path
        v-for="country in world.countries"
        :key="country.iso || country.name"
        :d="pathFor(country)"
        class="country"
        :class="{ selected: isSelected(country), counted: countFor(country) > 0 }"
        :style="{ fill: fillFor(country) }"
        :data-iso="country.iso || ''"
        @click="select(country)"
      />
    </svg>
    <div class="coverage-legend">
      <span class="legend-word">fewer</span>
      <span v-for="(colour, index) in ramp" :key="index" class="legend-swatch" :style="{ background: colour }"></span>
      <span class="legend-word">more</span>
    </div>
  </div>
</template>

<script>
import worldCountries from '../assets/data/worldCountries.json';
import { pathFor } from '../assets/javascript/countryLookup.js';

// Natural Earth 110m country polygons, pre-projected at build time
// (scripts/generate-world-countries.mjs). Shaded by count, never zoomed: a
// shaded country is legible at any size, which is what the old dot map wasn't.
const BASE = '#33475b';
const STEPS = 5;

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

export default {
  name: 'CoverageMap',
  props: {
    counts: { type: Object, default: () => ({}) },
    accent: { type: String, default: '#f0ad4e' },
    selectedIso: { type: String, default: null },
    ariaLabel: { type: String, default: 'Map of the world shaded by how many of your films touch each country' },
    // Injectable so tests can hand in a three-country world.
    world: { type: Object, default: () => worldCountries }
  },
  emits: ['select'],
  computed: {
    // Base plus STEPS shades toward the accent; the lightest step is
    // deliberately well clear of the base so ONE film still reads as a visit.
    ramp () {
      return Array.from({ length: STEPS }, (_, i) => mix(BASE, this.accent, 0.3 + (0.7 * i) / (STEPS - 1)));
    },
    // Quantile breakpoints over the non-zero counts, so three countries and
    // ninety both spread across the whole ramp instead of huddling at one end.
    breakpoints () {
      const values = Object.values(this.counts || {}).filter((n) => n > 0).sort((a, b) => a - b);
      if (!values.length) return [];
      // Ranks are rounded UP so the smallest count is never its own
      // breakpoint — the least-visited country always takes the first step.
      const last = values.length - 1;
      return Array.from({ length: STEPS - 1 }, (_, i) => values[Math.min(last, Math.ceil((values.length * (i + 1)) / STEPS))]);
    }
  },
  methods: {
    pathFor,
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
    select (country) {
      this.$emit('select', this.isSelected(country) ? null : country);
    }
  }
};
</script>

<style lang="scss" scoped>
  .coverage-map {
    width: 100%;
  }

  .coverage-map-svg {
    display: block;
    height: auto;
    width: 100%;
  }

  .ocean {
    fill: #14202b;
  }

  .country {
    cursor: pointer;
    stroke: #22323f;
    stroke-width: 1;
    // Strokes are in grid units; without this they'd scale with the container.
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

  .coverage-legend {
    align-items: center;
    display: flex;
    gap: 0.3rem;
    justify-content: center;
    margin-top: 0.5rem;
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
</style>

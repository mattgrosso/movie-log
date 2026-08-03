<template>
  <div ref="wrapper" class="world-map">
    <svg :viewBox="viewBox" class="world-map-svg" role="img" :aria-label="ariaLabel">
      <rect class="ocean" x="0" y="0" :width="width" :height="height"/>

      <path
        v-for="(path, index) in worldMap.land"
        :key="`land-${index}`"
        :d="path"
        class="land"
      />

      <!-- State/province lines are drawn under country lines and more faintly,
           so the two read as a hierarchy rather than competing. They earn their
           weight here because Wikidata often gives a US STATE as a film's
           location, and "Colorado" should land inside a visible outline. -->
      <path
        v-for="(path, index) in worldMap.stateBorders"
        :key="`state-${index}`"
        :d="path"
        class="state-border"
      />

      <path
        v-for="(path, index) in worldMap.borders"
        :key="`border-${index}`"
        :d="path"
        class="border"
      />

      <!-- City labels, only once we're zoomed in far enough for them to be
           useful rather than clutter. They're what make a close-in map
           readable: a dot off the coast of California means nothing, a dot
           next to "Los Angeles" means everything. -->
      <g v-for="city in visibleCities" :key="`city-${city.name}-${city.x}`" class="city">
        <circle :cx="city.x" :cy="city.y" :r="px(cityDotRadius)"/>
        <text
          :x="city.x + px(cityLabelOffset)"
          :y="city.y + px(cityFontSize) * 0.35"
          :style="{ fontSize: `${px(cityFontSize)}px` }"
        >{{ city.name }}</text>
      </g>

      <g
        v-for="point in plottedPoints"
        :key="point.key"
      >
        <!-- Invisible, much larger tap target sitting under the visible dot.
             The dot itself is only ~7px across, which is nowhere near a usable
             touch target (bug report: "the tiny little points on the map are
             way too small to actually click on"). -->
        <circle
          :cx="point.x"
          :cy="point.y"
          :r="px(tapTargetRadius)"
          class="place-hit"
          @click="select(point)"
        />
        <circle
          :cx="point.x"
          :cy="point.y"
          :r="px(dotRadius)"
          class="place-dot"
          :class="point.type"
          @click="select(point)"
        />
        <!-- Rendered above every dot so an active label is never covered by a
             neighbouring dot drawn later in the list. -->
        <template v-if="selectedKey === point.key">
          <rect
            :x="labelBox(point).x"
            :y="labelBox(point).y"
            :width="labelBox(point).width"
            :height="px(labelHeight)"
            class="label-bg"
            :rx="px(4)"
          />
          <text
            :x="labelBox(point).x + px(labelPadding)"
            :y="labelBox(point).y + px(labelHeight) * 0.7"
            class="label-text"
            :style="{ fontSize: `${px(labelFontSize)}px` }"
          >{{ point.name }}</text>
        </template>
      </g>
    </svg>
  </div>
</template>

<script>
import worldMap from '../assets/data/worldMap.json';
import { fitViewBox } from '../assets/javascript/mapViewBox.js';

// Natural Earth 50m land, country borders and city labels, pre-projected to
// SVG paths at build time (public domain — see
// scripts/generate-world-map-data.mjs).
//
// Deliberately not a tile-based map: no new runtime dependency, no API key, no
// tile-server usage policy to respect, and it keeps working offline — which
// this app supports properly and shouldn't regress.
export default {
  name: 'WorldMap',
  props: {
    points: {
      type: Array,
      default: () => []
    },
    // Insights plots the whole library at once and wants smaller dots than a
    // single movie's handful of places.
    //
    // In CSS PIXELS, not grid units. Grid units were the original design and
    // were badly wrong: a radius of 90 renders as 90/20000 of the container, so
    // ~1.6px on a phone — visible, but impossible to tap.
    dotRadius: {
      type: Number,
      default: 7
    },
    ariaLabel: {
      type: String,
      default: 'World map'
    },
    // Zoom to the tightest box containing every point, rather than always
    // showing the whole world.
    fit: {
      type: Boolean,
      default: true
    }
  },
  emits: ['select'],
  data () {
    return {
      selectedKey: null,
      // All in CSS pixels — see the dotRadius prop.
      tapTargetRadius: 18,
      labelHeight: 26,
      labelPadding: 6,
      labelFontSize: 15,
      cityFontSize: 11,
      cityDotRadius: 3,
      cityLabelOffset: 7,
      // Rendered width of the map in CSS pixels, which is what converts pixel
      // sizes into the grid units SVG actually draws in. Measured after mount;
      // the default only stands in for that first tick (and for jsdom, which
      // has no layout at all).
      containerWidth: 360,
      // Above this fraction of the world, city labels are noise rather than
      // orientation, so they're hidden entirely.
      cityZoomThreshold: 0.6,
      maxVisibleCities: 30
    };
  },
  computed: {
    worldMap () {
      return worldMap;
    },
    // The DISPLAY window.
    //
    // With points to show, this zooms to the tightest sensible box containing
    // all of them. With none — or with `fit` off — it falls back to the stored
    // world view, which is itself deliberately narrower than the projection
    // space: it crops the empty polar caps (Antarctica and the high Arctic are
    // ~20% of an equirectangular map's height and never hold a film location).
    viewBox () {
      if (!this.fit) {
        return worldMap.viewBox;
      }

      return fitViewBox(this.plottedPoints, {
        width: this.width,
        height: this.height,
        fallback: worldMap.viewBox
      });
    },
    // How zoomed in we are, 1 = whole world. Only used for deciding WHAT to
    // draw (city labels), not how big — see unitsPerPixel for that.
    zoomScale () {
      return this.visibleWidth / this.width;
    },
    // One CSS pixel expressed in grid units at the current zoom and container
    // size. Everything drawn on top of the map is sized through this, so a dot
    // is the same number of real pixels whether you're looking at the whole
    // world on a phone or one city on a desktop.
    unitsPerPixel () {
      return this.visibleWidth / (this.containerWidth || 360);
    },
    // The PROJECTION space, which is always the full -180..180 / 90..-90 grid.
    // Kept separate from viewBox on purpose — deriving these from the cropped
    // window would silently skew every plotted point.
    width () {
      return worldMap.width;
    },
    height () {
      return worldMap.height;
    },
    visibleLeft () {
      return Number(this.viewBox.split(' ')[0]);
    },
    visibleTop () {
      return Number(this.viewBox.split(' ')[1]);
    },
    visibleWidth () {
      return Number(this.viewBox.split(' ')[2]);
    },
    visibleHeight () {
      return Number(this.viewBox.split(' ')[3]);
    },
    visibleCities () {
      if (this.zoomScale > this.cityZoomThreshold) {
        return [];
      }

      const right = this.visibleLeft + this.visibleWidth;
      const bottom = this.visibleTop + this.visibleHeight;
      // Roughly a label's width — enough to stop two names sitting on top of
      // each other without doing real text measurement.
      const minGap = this.px(this.cityFontSize) * 6;

      const chosen = [];
      // worldMap.cities is pre-sorted by importance, so taking them in order
      // means the ones that survive the spacing check are the notable ones.
      for (const [name, x, y] of worldMap.cities) {
        if (chosen.length >= this.maxVisibleCities) break;
        if (x < this.visibleLeft || x > right || y < this.visibleTop || y > bottom) continue;
        const crowded = chosen.some(
          (other) => Math.abs(other.x - x) < minGap && Math.abs(other.y - y) < minGap / 3
        );
        if (crowded) continue;
        chosen.push({ name, x, y });
      }

      return chosen;
    },
    plottedPoints () {
      return this.points
        .filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lon))
        .map((point, index) => ({
          ...point,
          // Two different places can share a name, and the same place can be
          // both a filming and a narrative location, so the key has to include
          // the index to stay unique.
          key: `${point.id || point.name}-${point.type}-${index}`,
          ...this.project(point.lon, point.lat)
        }));
    }
  },
  mounted () {
    this.measure();
    // The map is fluid-width, so its pixel size changes on rotate/resize and
    // every pixel-sized thing on it has to be recomputed.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this.$refs.wrapper);
    } else {
      window.addEventListener('resize', this.measure);
    }
  },
  beforeUnmount () {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    } else {
      window.removeEventListener('resize', this.measure);
    }
  },
  methods: {
    measure () {
      const width = this.$refs.wrapper?.offsetWidth;
      // jsdom reports 0 for everything; keep the default rather than dividing
      // the map into nothing.
      if (width) {
        this.containerWidth = width;
      }
    },
    // CSS pixels -> grid units, so anything drawn on top of the map keeps a
    // constant real size however far in we are and however wide the container.
    px (pixels) {
      return pixels * this.unitsPerPixel;
    },
    // Equirectangular, matching the projection the paths were baked with.
    // Simple and undistorted enough at this size; the alternative projections
    // only start to matter on a map you can pan around freely.
    project (lon, lat) {
      return {
        x: (lon + 180) / 360 * this.width,
        y: (90 - lat) / 180 * this.height
      };
    },
    labelBox (point) {
      // Character-width estimate rather than real text measurement — same
      // approach (and same reasoning) as the "Did you mean?" fit logic: it
      // only has to be close, and erring wide is the safe direction.
      const estimatedWidth = point.name.length * this.px(this.labelFontSize) * 0.55 +
                             this.px(this.labelPadding) * 2;
      const gap = this.px(this.dotRadius + 4);
      const rawX = point.x + gap;
      const rightEdge = this.visibleLeft + this.visibleWidth;

      return {
        // Flip to the left of the dot rather than overflow the right edge.
        x: rawX + estimatedWidth > rightEdge ? point.x - gap - estimatedWidth : rawX,
        // Clamped to the VISIBLE window, not the full projection space, or a
        // label near the edge of a zoomed-in box would be cut off.
        y: Math.min(
          Math.max(point.y - this.px(this.labelHeight) / 2, this.visibleTop),
          this.visibleTop + this.visibleHeight - this.px(this.labelHeight)
        ),
        width: estimatedWidth
      };
    },
    select (point) {
      this.selectedKey = this.selectedKey === point.key ? null : point.key;
      this.$emit('select', this.selectedKey ? point : null);
    }
  }
};
</script>

<style lang="scss" scoped>
  .world-map {
    width: 100%;
  }

  .world-map-svg {
    display: block;
    height: auto;
    width: 100%;
  }

  .ocean {
    fill: #14202b;
  }

  .land {
    fill: #33475b;
    stroke: #22323f;
    stroke-width: 1;
    // Strokes are in grid units too, so without this they'd thicken as the map
    // zooms in.
    vector-effect: non-scaling-stroke;
  }

  .border {
    fill: none;
    stroke: #5b7186;
    stroke-dasharray: 4 3;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .state-border {
    fill: none;
    stroke: #44586b;
    stroke-dasharray: 2 4;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .city {
    circle {
      fill: #8fa3b8;
    }

    text {
      fill: #c6d2de;
      font-weight: 500;
      // Purely decorative context; taps are meant for the movie's own dots.
      pointer-events: none;
    }
  }

  .place-hit {
    cursor: pointer;
    fill: transparent;
  }

  .place-dot {
    cursor: pointer;
    // The transparent circle underneath is what catches the tap; without this
    // the visible dot would swallow taps meant for its own larger target only
    // where they overlap, which is fine — but pointer-events on both keeps the
    // centre responsive regardless of stacking.
    pointer-events: auto;
    stroke: #14202b;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;

    // Mobile-first: press feedback only, never :hover — this app has no
    // reliable pointer device and sticky :hover on iOS is a documented problem.
    &:active {
      stroke: #fff;
    }
  }

  .place-dot.filming {
    fill: #f0ad4e;
  }

  .place-dot.narrative {
    fill: #6ec1e4;
  }

  .label-bg {
    fill: rgba(0, 0, 0, 0.82);
  }

  .label-text {
    fill: #fff;
    font-weight: 600;
  }
</style>

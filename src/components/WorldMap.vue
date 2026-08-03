<template>
  <div class="world-map">
    <svg :viewBox="viewBox" class="world-map-svg" role="img" :aria-label="ariaLabel">
      <rect class="ocean" x="0" y="0" :width="width" :height="height"/>

      <path
        v-for="(path, index) in landPaths"
        :key="`land-${index}`"
        :d="path"
        class="land"
      />

      <g
        v-for="point in plottedPoints"
        :key="point.key"
      >
        <circle
          :cx="point.x"
          :cy="point.y"
          :r="scaledDotRadius"
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
            :height="scaledLabelHeight"
            class="label-bg"
            rx="4"
          />
          <text
            :x="labelBox(point).x + scaledLabelPadding"
            :y="labelBox(point).y + scaledLabelHeight * 0.7"
            class="label-text"
            :style="{ fontSize: `${scaledLabelFontSize}px` }"
          >{{ point.name }}</text>
        </template>
      </g>
    </svg>
  </div>
</template>

<script>
import worldLand from '../assets/data/worldLand.json';
import { fitViewBox } from '../assets/javascript/mapViewBox.js';

// Natural Earth 110m land, pre-projected to SVG paths at build time (public
// domain). Deliberately not a tile-based map: no new runtime dependency, no
// API key, no tile-server usage policy to respect, and it keeps working
// offline — which this app supports properly and shouldn't regress.
export default {
  name: 'WorldMap',
  props: {
    points: {
      type: Array,
      default: () => []
    },
    // Insights plots the whole library at once and wants smaller dots than a
    // single movie's handful of places.
    dotRadius: {
      type: Number,
      default: 9
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
      labelHeight: 34,
      labelPadding: 8,
      labelFontSize: 24
    };
  },
  computed: {
    landPaths () {
      return worldLand.paths;
    },
    // The DISPLAY window.
    //
    // With points to show, this zooms to the tightest sensible box containing
    // all of them (bug report: the full-globe view was too far out to read).
    // With none — or with `fit` off — it falls back to the stored world view,
    // which is itself deliberately narrower than the projection space: it crops
    // the empty polar caps (Antarctica and the high Arctic are ~20% of an
    // equirectangular map's height and essentially never hold a film location).
    viewBox () {
      if (!this.fit) {
        return worldLand.viewBox;
      }

      return fitViewBox(this.plottedPoints, {
        width: this.width,
        height: this.height,
        fallback: worldLand.viewBox
      });
    },
    // How zoomed in we are, 1 = whole world. Dots and labels are sized in
    // viewBox units, so without this they'd balloon as the box shrinks — a
    // 5x zoom would render 5x bigger dots. Scaling by this keeps their
    // apparent size on screen roughly constant at any zoom.
    zoomScale () {
      return this.visibleWidth / this.width;
    },
    scaledDotRadius () {
      return this.dotRadius * this.zoomScale;
    },
    scaledLabelHeight () {
      return this.labelHeight * this.zoomScale;
    },
    scaledLabelFontSize () {
      return this.labelFontSize * this.zoomScale;
    },
    scaledLabelPadding () {
      return this.labelPadding * this.zoomScale;
    },
    visibleLeft () {
      return Number(this.viewBox.split(' ')[0]);
    },
    visibleWidth () {
      return Number(this.viewBox.split(' ')[2]);
    },
    // The PROJECTION space, which is always the full -180..180 / 90..-90 grid.
    // Kept separate from viewBox on purpose — deriving these from the cropped
    // window would silently skew every plotted point.
    width () {
      return worldLand.width;
    },
    height () {
      return worldLand.height;
    },
    visibleTop () {
      return Number(this.viewBox.split(' ')[1]);
    },
    visibleHeight () {
      return Number(this.viewBox.split(' ')[3]);
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
  methods: {
    // Equirectangular, matching the projection the land paths were baked with.
    // Simple and undistorted enough at this size; the alternative projections
    // only start to matter on a map you can zoom.
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
      const estimatedWidth = point.name.length * this.scaledLabelFontSize * 0.55 + this.scaledLabelPadding * 2;
      const gap = this.scaledDotRadius + 4 * this.zoomScale;
      const rawX = point.x + gap;
      const rightEdge = this.visibleLeft + this.visibleWidth;

      return {
        // Flip to the left of the dot rather than overflow the right edge.
        x: rawX + estimatedWidth > rightEdge ? point.x - gap - estimatedWidth : rawX,
        // Clamped to the VISIBLE window, not the full projection space, or a
        // label near the edge of a zoomed-in box would be cut off.
        y: Math.min(
          Math.max(point.y - this.scaledLabelHeight / 2, this.visibleTop),
          this.visibleTop + this.visibleHeight - this.scaledLabelHeight
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
    vector-effect: non-scaling-stroke;
  }

  .place-dot {
    cursor: pointer;
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

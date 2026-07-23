<template>
  <!-- Bug report: "I should be able to swipe left from the left edge of the
       screen in order to trigger the same back behavior." A thin fixed strip
       along the left edge, independent of BackLink's own absolute
       positioning below - touchmove is left un-preventDefault'd (and bound
       .passive) so it never blocks normal vertical scrolling underneath it. -->
  <div
    class="back-link-edge-swipe"
    @touchstart="onTouchStart"
    @touchmove.passive="() => {}"
    @touchend="onTouchEnd"
  ></div>
  <div class="back-link" @click="$emit('click')" role="button" :aria-label="`Back to ${label}`">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-left-fill" viewBox="0 0 16 16">
      <path d="m3.86 8.753 5.482 4.796c.646.566 1.658.106 1.658-.753V3.204a1 1 0 0 0-1.659-.753l-5.48 4.796a1 1 0 0 0 0 1.506z"/>
    </svg>
    <span>{{ label }}</span>
  </div>
</template>

<script>
// Every game screen (and the games hub) uses this as its sole top-of-page
// affordance, matching the "Home"/"Games" caret pattern MovieDetail/RateMovie/
// Insights use elsewhere. Unlike MovieDetail/RateMovie (which hide the global
// Header entirely), this follows Insights.vue's approach instead: the global
// Header stays visible, and the link is lifted up over it purely via CSS
// (position:absolute with no positioned ancestor anywhere up the tree — see
// Insights.vue's .home-link — escapes to the page's initial containing block
// rather than the component's own top of content, landing it up in the
// Header's space). No store interaction needed here at all.
export default {
  name: 'BackLink',
  props: {
    label: { type: String, default: 'Home' }
  },
  emits: ['click'],
  data () {
    return {
      touchStartX: null,
      touchStartY: null
    };
  },
  methods: {
    onTouchStart (event) {
      const touch = event.touches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
    },
    onTouchEnd (event) {
      if (this.touchStartX === null) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;
      this.touchStartX = null;
      this.touchStartY = null;

      // A real edge swipe: mostly horizontal (not a vertical scroll) and far
      // enough to be intentional (not a stray tap on the thin strip).
      if (deltaX > 60 && Math.abs(deltaY) < 50) {
        this.$emit('click');
      }
    }
  }
};
</script>

<style scoped>
.back-link-edge-swipe {
  bottom: 0;
  left: 0;
  position: fixed;
  top: 0;
  width: 20px;
  z-index: 500;
}

.back-link {
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  color: #eee;
  column-gap: 4px;
  cursor: pointer;
  display: flex;
  left: 6px;
  padding: 4px 10px;
  position: absolute;
  top: 6px;
}

.back-link:active {
  opacity: 0.7;
}
</style>

<template>
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
// Insights use elsewhere (see CLAUDE.md's "Unified Home/Back Affordance").
// Those pages hide the global Header themselves; centralizing that toggle
// here means every BackLink usage gets it automatically instead of each of
// the 7 game components needing its own created()/beforeUnmount() pair —
// previously none of them hid the header, so the global "Cinema Roll" bar
// rendered above this link instead of it standing alone at the top.
export default {
  name: 'BackLink',
  props: {
    label: { type: String, default: 'Home' }
  },
  emits: ['click'],
  created () {
    this.$store.commit('setShowHeader', false);
  },
  beforeUnmount () {
    this.$store.commit('setShowHeader', true);
  }
};
</script>

<style scoped>
.back-link {
  align-items: center;
  color: #eee;
  column-gap: 4px;
  cursor: pointer;
  display: flex;
  padding: 12px;
}

.back-link:active {
  opacity: 0.7;
}
</style>

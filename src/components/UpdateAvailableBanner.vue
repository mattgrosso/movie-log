<template>
  <div v-if="$store.state.updateAvailable" class="update-available-banner">
    <span>A new version of Cinema Roll is available.</span>
    <button class="btn btn-sm btn-dark" @click="reload">Refresh</button>
  </div>
</template>

<script>
// Shows once registerServiceWorker.js flags that a new version has finished
// installing in the background - deliberately a manual prompt, not an
// automatic reload (see that file's own comment on the bug report this
// fixes: an unconditional window.location.reload() there used to yank the
// page out from under whatever the user was doing, most visibly breaking
// the long-running box office backfill button mid-run). Rendered globally
// from App.vue (same "always visible regardless of route/login state"
// treatment as BugReportButton.vue), in normal document flow right below
// the header so it pushes content down rather than overlaying/covering
// anything - this only appears rarely and briefly, so a small layout shift
// is preferable to fixed-position z-index/overlap juggling with the
// per-page back-link affordances.
export default {
  name: 'UpdateAvailableBanner',
  methods: {
    reload () {
      window.location.reload();
    }
  }
}
</script>

<style scoped>
.update-available-banner {
  align-items: center;
  background-color: #ffc107;
  color: #000;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  text-align: center;
}
</style>

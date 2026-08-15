<template>
  <div v-if="$store.state.updateAvailable" class="update-available-banner">
    <span v-if="updating">Updating&hellip;</span>
    <span v-else>A new version of Cinema Roll is available.</span>
    <button class="btn btn-sm btn-dark" :disabled="updating" @click="reload">
      {{ updating ? 'One moment' : 'Refresh' }}
    </button>
  </div>
</template>

<script>
// Shows once App.vue's deploy check (or registerServiceWorker's updated()
// hook) flags a new version - deliberately a manual prompt, not an
// automatic reload (see registerServiceWorker.js's comment on the bug an
// unconditional reload caused: it yanked the page out from under
// long-running work like the box office backfill). Rendered globally from
// App.vue (same "always visible regardless of route/login state" treatment
// as BugReportButton.vue), in normal document flow right below the header
// so it pushes content down rather than overlaying anything.
export default {
  name: 'UpdateAvailableBanner',
  data () {
    return {
      updating: false
    };
  },
  methods: {
    async reload () {
      if (this.updating) return;
      this.updating = true;
      await this.waitForNewWorker();
      window.location.reload();
    },
    // Bug report: tapping Refresh on a non-home page reloaded into a broken
    // site. The banner appears the instant the deploy-check notices new
    // bundle names on the server - usually while the new service worker is
    // still mid-install. A plain reload at that moment is served the OLD
    // cached app by the OLD worker; seconds later the new worker activates
    // (skipWaiting + clientsClaim), purges the old precache, and the old
    // app's lazy route chunks 404 - blank screen. Waiting here until no
    // install is in flight means the reload lands on the NEW app instead.
    // Capped at 15s so a stalled install can't strand the button; the
    // router's stale-chunk guard (staleChunkReload.js) is the backstop.
    async waitForNewWorker () {
      try {
        const registration = await navigator.serviceWorker?.getRegistration?.();
        if (!registration) return;
        // Kick a check in case none is in flight yet, but don't let a
        // failed fetch block the reload.
        await registration.update().catch(() => {});
        const deadline = Date.now() + 15000;
        while ((registration.installing || registration.waiting) && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      } catch {
        // Any surprise here must never eat the reload itself.
      }
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

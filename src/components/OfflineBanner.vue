<template>
  <div v-if="!$store.state.isOnline" class="offline-banner">
    <i class="bi bi-wifi-off"></i>
    <span>You're offline — changes save to this device and sync when you're back.</span>
  </div>
</template>

<script>
// Bug report: "we should have some sort of indication on the screen to show
// that people [are] in an off-line mode." Driven by the same store.isOnline
// flag AddRating's write path branches on, so what the banner says matches
// what the save path will actually do. Rendered globally from App.vue in
// normal document flow, same treatment (and same reasoning) as
// UpdateAvailableBanner.vue directly above it.
export default {
  name: 'OfflineBanner'
}
</script>

<style scoped>
.offline-banner {
  align-items: center;
  background-color: #343a40;
  color: #ffc107;
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  padding: 0.4rem 1rem;
  font-size: 0.8rem;
  text-align: center;
}
</style>

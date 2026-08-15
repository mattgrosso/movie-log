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
import { reloadForUpdate } from '../utils/appUpdate.js';

// Shows once App.vue's deploy check flags a new version. Since 2026-08-15
// updates normally apply THEMSELVES at a quiet moment (App.vue's
// auto-update watcher, feedback: "the user shouldn't have to take an
// action") — this banner is the visible state while waiting and the manual
// fallback whenever a quiet moment never comes (typing, mid-game, modal
// open). Rendered globally from App.vue in normal document flow.
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
      await reloadForUpdate();
    },
    // The wait-out-the-install logic lives in utils/appUpdate.js now,
    // shared with App.vue's automatic update path.
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

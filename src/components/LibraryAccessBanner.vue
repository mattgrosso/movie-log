<template>
  <div v-if="$store.state.dbReadDenied" class="library-access-banner">
    <p class="access-headline">
      <i class="bi bi-shield-lock"></i>
      Your movies aren't gone — this device just can't read them right now.
    </p>
    <p v-if="devModeInTheWay" class="access-detail">
      Dev mode is pointing the app at the shared testing database, which this
      account can't access. Turn dev mode off in Settings and your library
      will come right back.
    </p>
    <p v-else-if="$store.state.userEmail" class="access-detail">
      You're signed in as <strong>{{ $store.state.userEmail }}</strong>. Your
      library lives under the account you originally rated movies with — sign
      in with that one and everything will reappear.
    </p>
    <p v-else class="access-detail">
      Sign in with the account you rate movies with and your library will
      reappear.
    </p>
    <button v-if="!devModeInTheWay" type="button" class="btn btn-sm btn-warning" @click="$router.push('/login')">
      Go to sign-in
    </button>
  </div>
</template>

<script>
// Guidance for the scariest-looking non-problem the locked-down database
// rules can produce: a device whose live listener was cancelled (permission
// denied) shows an empty or frozen library, which reads as "my movies are
// gone" when nothing was touched. Driven by store.dbReadDenied (set by the
// listeners' error callbacks in initializeDB); rendered globally from
// App.vue like OfflineBanner/UpdateAvailableBanner. Signing back in
// re-dispatches initializeDB, which re-attaches a fresh listener and clears
// the flag on the first successful read — so this banner removes itself.
export default {
  name: 'LibraryAccessBanner',
  computed: {
    devModeInTheWay () {
      // Dev mode routes reads at the shared testing database, which only
      // the owner account can access under the tightened rules — for anyone
      // else that's the whole explanation, and signing in again won't help.
      return Boolean(this.$store.getters?.devMode);
    }
  }
}
</script>

<style scoped>
.library-access-banner {
  background-color: #343a40;
  border-bottom: 2px solid #ffc107;
  color: #eee;
  padding: 0.75rem 1rem;
  text-align: center;
}

.access-headline {
  color: #ffc107;
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0 0 0.35rem;
}

.access-detail {
  color: #ccc;
  font-size: 0.8rem;
  margin: 0 0 0.5rem;
}
</style>

<template>
  <div class="cinema-roll">
    <!-- Invisible scroll-to-top trigger area -->
    <div class="scroll-to-top-trigger" @click.stop="scrollToTop"></div>
    <AppHeader/>
    <UpdateAvailableBanner/>
    <router-view></router-view>
    <AppFooter v-if="$store.state.dbLoaded"/>
    <BugReportButton/>
  </div>
</template>

<script>
import AppFooter from "./components/Footer.vue";
import AppHeader from "./components/Header.vue";
import BugReportButton from "./components/BugReportButton.vue";
import UpdateAvailableBanner from "./components/UpdateAvailableBanner.vue";

export default {
  name: "Cinema-Roll",
  components: {
    AppFooter,
    AppHeader,
    BugReportButton,
    UpdateAvailableBanner
  },
  methods: {
    scrollToTop () {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    },
    async checkForServiceWorkerUpdate () {
      if (!('serviceWorker' in navigator)) {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
        }
      } catch {
        // Best-effort - a failed check just means we try again on the next
        // trigger rather than blocking anything the user is doing.
      }
    },
    // Offline rating support: attempt a queue flush whenever we might have
    // just regained connectivity. Cheap/no-op if actually still offline
    // (flushPendingWrites checks navigator.onLine itself), so it's safe to
    // call from every trigger below rather than just the 'online' event -
    // same reasoning as checkForServiceWorkerUpdate needing four independent
    // triggers instead of trusting any single browser event.
    attemptPendingWritesFlush () {
      this.$store.dispatch('flushPendingWrites');
    },
    handleOnline () {
      this.$store.commit('setIsOnline', true);
      this.attemptPendingWritesFlush();
    },
    handleOffline () {
      this.$store.commit('setIsOnline', false);
    }
  },
  async mounted () {
    // Reconcile the router's localStorage-based "you're signed in" assumption
    // against whether Firebase actually restored a session. Fire and forget —
    // it resolves itself once auth settles and must not delay first paint.
    this.$store.dispatch('verifyRestoredSession');

    // visibilitychange alone is unreliable on iOS, particularly for a
    // home-screen-installed PWA - it's a long-standing WebKit quirk that it
    // sometimes just doesn't fire when the app is brought back to the
    // foreground (varies by iOS version, which is why this can silently work
    // on one iPhone and never on another). pageshow and window focus are
    // more consistent there, and the interval is a backstop that doesn't
    // depend on any lifecycle event firing at all - between the three, an
    // update gets picked up even if any single trigger fails to fire.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkForServiceWorkerUpdate();
        this.attemptPendingWritesFlush();
      }
    });
    window.addEventListener('pageshow', () => {
      this.checkForServiceWorkerUpdate();
      this.attemptPendingWritesFlush();
    });
    window.addEventListener('focus', () => {
      this.checkForServiceWorkerUpdate();
      this.attemptPendingWritesFlush();
    });
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    setInterval(() => {
      this.checkForServiceWorkerUpdate();
      this.attemptPendingWritesFlush();
    }, 30 * 60 * 1000);
  },
}
</script>

<style lang="scss">
  body {
    font-family: "Roboto Condensed", sans-serif;

    &.no-scroll {
      overflow: hidden;
    }
  }

  .cinema-roll {
    min-height: 100vh;
    width: 100%;
    max-width: 100%;
    // Clip any stray horizontal overflow so the page can never scroll sideways.
    // On the installed iOS PWA a brief horizontal overflow (e.g. an image
    // rendering at natural width before CSS constrains it) latches the layout
    // viewport wider than the screen; that stuck viewport then makes every
    // screen's 100vh-based vertical layout stop a few % short of the bottom
    // (cutting off the submit / poster buttons) until the app is force-quit.
    // Clipping here prevents the latch — fixes the sideways scroll AND the
    // cumulative bottom cut-off together. Vertical page scroll is unaffected
    // (the document, not this element, is the vertical scroll container).
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
  }

  .cinema-roll > router-view {
    flex: 1 1 auto;
    width: 100%;
  }

  .scroll-to-top-trigger {
    position: fixed;
    top: 0;
    left: 75px;
    right: 75px;
    height: 40px;
    z-index: 9999;
    background: transparent;
    cursor: pointer;
    -webkit-tap-highlight-color: rgba(255, 255, 255, 0.1);
    touch-action: manipulation;

    /* Only show on mobile devices */
    @media (min-width: 768px) {
      display: none;
    }
  }
</style>

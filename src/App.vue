<template>
  <div class="cinema-roll">
    <!-- Invisible scroll-to-top trigger area -->
    <div class="scroll-to-top-trigger" @click.stop="scrollToTop"></div>
    <AppHeader/>
    <router-view></router-view>
    <AppFooter v-if="$store.state.dbLoaded"/>
  </div>
</template>

<script>
import AppFooter from "./components/Footer.vue";
import AppHeader from "./components/Header.vue";

export default {
  name: "Cinema-Roll",
  components: {
    AppFooter,
    AppHeader
  },
  methods: {
    scrollToTop () {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  },
  async mounted () {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        console.log('App is now in the foreground');

        // Check for service worker update
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.update();
          }
        }
      }
    });
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

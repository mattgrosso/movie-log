<template>
  <div class="cinema-roll">
    <!-- Invisible scroll-to-top trigger area -->
    <div class="scroll-to-top-trigger" @click="scrollToTop"></div>
    <Header/>
    <router-view></router-view>
    <Footer v-if="$store.state.dbLoaded"/>
  </div>
</template>

<script>
import Footer from "./components/Footer.vue";
import Header from "./components/Header.vue";

export default {
  name: "Cinema-Roll",
  components: {
    Footer,
    Header
  },
  methods: {
    scrollToTop() {
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
    left: 0;
    width: 100%;
    height: 44px; /* iOS status bar height */
    z-index: 9999;
    background: transparent;
    cursor: pointer;
    
    /* Only show on mobile devices */
    @media (min-width: 768px) {
      display: none;
    }
    
    /* Add subtle visual feedback on touch */
    -webkit-tap-highlight-color: rgba(255, 255, 255, 0.1);
    touch-action: manipulation;
  }
</style>

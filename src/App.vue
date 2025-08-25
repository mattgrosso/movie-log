<template>
  <div class="cinema-roll">
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
</style>

<template>
  <div class="movie-log">
    <Header/>
    <router-view></router-view>
    <Footer/>
  </div>
</template>

<script>
import Footer from "./components/Footer.vue";
import Header from "./components/Header.vue";

export default {
  name: "Movie-Log",
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
  }
</style>

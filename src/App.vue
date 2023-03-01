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
  }
}
</script>

<style lang="scss">
  body {
    font-family: "Roboto Condensed", sans-serif;
  }
</style>

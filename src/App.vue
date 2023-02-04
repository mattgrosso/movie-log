<template>
  <div class="movie-log">
    <Header></Header>
    <div v-if="showHome" class="home">
      <button @click="test">Click Me!</button>
      <NewRatingSearch></NewRatingSearch>
      <hr>
      <SearchDatabase></SearchDatabase>
      <hr>
      <QuickSearch></QuickSearch>
    </div>
    <Footer></Footer>
  </div>
</template>

<script>
import axios from 'axios';

import Header from "./components/Header.vue"
import NewRatingSearch from "./components/NewRatingSearch.vue";
import SearchDatabase from "./components/SearchDatabase.vue";
import QuickSearch from "./components/QuickSearch.vue";
import Footer from "./components/Footer.vue";

export default {
  name: "Movie-Log",
  components: {
    Header,
    NewRatingSearch,
    SearchDatabase,
    QuickSearch,
    Footer
  },
  data() {
    return {
      database: [],
      showHome: true
    }
  },
  async mounted() {
    const resp = await axios.get(
      "https://movie-log-8c4d5-default-rtdb.firebaseio.com/movieLog.json"
    );

    this.database = resp.data;
  }
}
</script>

<style>
  body {
    font-family: "Roboto Condensed", sans-serif;
  }

  hr {
    border-top: 1px solid;
    margin: 0 10%;
    opacity: 0.3;
  }
</style>

<template>
  <div class="movie-log">
    <Header/>
    <div v-if="isVisible('home')" class="home">
      <NewRatingSearch @newEntrySearch="newEntrySearch"/>
      <hr>
      <SearchDatabase/>
      <hr>
      <QuickSearch/>
    </div>
    <div v-if="isVisible('pick-a-movie')" class="pick-a-movie">
      <PickAMovie :newEntrySearchResults="newEntrySearchResults" @rateMovie="rateMovie"/>
    </div>
    <div v-if="isVisible('rate-movie')" class="rate">
      <RateMovie :movieToRate="movieToRate"/>
    </div>
    <Footer/>
  </div>
</template>

<script>
import axios from 'axios';

import Header from "./components/Header.vue"
import NewRatingSearch from "./components/NewRatingSearch.vue";
import SearchDatabase from "./components/SearchDatabase.vue";
import QuickSearch from "./components/QuickSearch.vue";
import PickAMovie from "./components/PickAMovie.vue";
import RateMovie from "./components/RateMovie.vue";
import Footer from "./components/Footer.vue";

export default {
  name: "Movie-Log",
  components: {
    Header,
    NewRatingSearch,
    SearchDatabase,
    QuickSearch,
    PickAMovie,
    RateMovie,
    Footer
  },
  data () {
    return {
      database: [],
      newEntrySearchResults: null,
      movieToRate: null,
      visible: "home"
    }
  },
  async mounted () {
    const resp = await axios.get(
      "https://movie-log-8c4d5-default-rtdb.firebaseio.com/movieLog.json"
    );

    this.database = resp.data;
  },
  methods: {
    show (pane) {
      this.visible = pane;
    },
    isVisible (pane) {
      if (this.visible === pane) {
        return true;
      } else {
        return false;
      }
    },
    newEntrySearch (data) {
      this.show("pick-a-movie");
      this.newEntrySearchResults = data.results;
    },
    rateMovie (movie) {
      this.show("rate-movie");
      this.movieToRate = movie;
    }
  },
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

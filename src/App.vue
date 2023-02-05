<template>
  <div class="movie-log">
    <Header @openSettings="toggleSettings"/>
    <Settings
      :showSettings="showSettings"
      :settings="settings"
      @addNewTag="addNewTag"
      @removeTag="removeTag"
      @updateWeight="updateWeight"
    />
    <div v-show="isVisible('home')" class="home">
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
      <RateMovie
        :movieToRate="movieToRate"
        :settings="settings"
        @addNewTag="addNewTag"
        @addRating="addRating"
      />
    </div>
    <Footer/>
  </div>
</template>

<script>
import axios from 'axios';
import cheerio from "cheerio";

import Header from "./components/Header.vue";
import Settings from "./components/Settings.vue";
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
    Settings,
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
      settings: {},
      newEntrySearchResults: null,
      movieToRate: null,
      visible: "home",
      showSettings: false
    }
  },
  async mounted () {
    await this.getMovieDatabase();
    await this.getSettings();
  },
  methods: {
    async getMovieDatabase () {
      const movies = await axios.get(
        "https://movie-log-8c4d5-default-rtdb.firebaseio.com/movieLog.json"
      );

      this.database = movies.data;
    },
    async getSettings () {
      const settings = await axios.get(
        "https://movie-log-8c4d5-default-rtdb.firebaseio.com/settings.json"
      );

      this.settings = settings.data;
    },
    show (pane) {
      this.previouslyVisible = this.visible;
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
    },
    toggleSettings () {
      if (this.showSettings) {
        this.showSettings = false;
      } else {
        this.showSettings = true;
      }
    },
    async addNewTag (tag) {
      await axios.post(
        "https://movie-log-8c4d5-default-rtdb.firebaseio.com/settings/tags.json",
        tag
      );

      this.getSettings();
    },
    async removeTag (tagIndex) {
      await axios.delete(
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/settings/tags/${tagIndex}.json`
      );

      this.getSettings();
    },
    async updateWeight (payload) {
      await axios.patch(
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/settings/weights/${payload.index}.json`,
        payload.weight
      );

      this.getSettings();
    },
    async getTMDBData (id) {
      const apiKey = process.env.VUE_APP_TMDB_API_KEY;

      const dataResp = await axios.get(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}`);
      const data = dataResp.data;
      
      const creditsResp = await axios.get(`https://api.themoviedb.org/3/movie/${id}/credits?api_key=${apiKey}`);
      const credits = creditsResp.data;

      return {
        ...data,
        ...credits
      }
    },
    parseScrapedAwards (string) {
      return string.replace(/ {2}/g, "").split("\n").filter((str) => str);
    },
    async getIMDBData (id) {
      const resp = await axios.get(`https://fast-refuge-34363.herokuapp.com/www.imdb.com/title/${id}/awards`);

      const $ = cheerio.load(resp.data);

      const oscarWins = $("h3:contains('Oscar [Winner]')").parent().next().text();
      const oscarNoms = $("h3:contains('Oscar [Nominee]')").parent().next().text();

      const BAFTAWins = $("h3:contains('BAFTA Film Award [Winner]')").parent().next().text();
      const BAFTANoms = $("h3:contains('BAFTA Film Award [Nominee]')").parent().next().text();
      
      const GoldGlobeWins = $("h3:contains('Golden Globe [Winner]')").parent().next().text();
      const GoldGlobeNoms = $("h3:contains('Golden Globe [Nominee]')").parent().next().text();

      return {
        oscarWins: this.parseScrapedAwards(oscarWins),
        oscarNoms: this.parseScrapedAwards(oscarNoms),
        BAFTAWins: this.parseScrapedAwards(BAFTAWins),
        BAFTANoms: this.parseScrapedAwards(BAFTANoms),
        GoldGlobeWins: this.parseScrapedAwards(GoldGlobeWins),
        GoldGlobeNoms: this.parseScrapedAwards(GoldGlobeNoms)
      };
    },
    async addRating (rating) {
      const tmdbData = await this.getTMDBData(rating.id);
      const imdbData = await this.getIMDBData(tmdbData.imdb_id);

      const movieWithRating = {
        movie: tmdbData,
        awards: imdbData,
        ratings: [rating]
      }

      // Right here I need to post this movieWithRating to the database.
      // I also need to detect if this movie has been previously rated.
      // If it has been previously rated, I'll need to update the existing entry
      // Also, I'll want to display that data at the bottom of the rate page.
      console.log('movieWithRating: ', movieWithRating);
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

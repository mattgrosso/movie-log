<template>
  <div class="movie-log">
    <div v-show="!googleLogin" class="login">
      <h1>Welcome to Movie Log</h1>
      <h2 class="fs-6 mb-5">Please sign in with Google</h2>
      <GoogleLogin :callback="login" prompt auto-login/>
    </div>
    <div v-show="googleLogin" class="content">
      <Header
        :database="database"
        :posterLayout="posterLayout"
        @openSettings="toggleSettings"
        @showHome="show('home')"
      />
      <Settings
        :settings="settings"
        :showSettings="showSettings"
        @addNewTag="addNewTag"
        @posterLayoutSwitched="posterLayoutSwitched"
        @removeTag="removeTag"
        @updateWeight="updateWeight"
        @uploadRatings="uploadRatings"
      />
      <div v-show="isVisible('home')" class="home">
        <NewRatingSearch @newEntrySearch="newEntrySearch"/>
        <hr>
        <SearchDatabase @dBSearch="dBSearch"/>
        <hr>
        <QuickSearch @dBSearch="dBSearch"/>
      </div>
      <div v-if="isVisible('pick-a-movie')" class="pick-a-movie">
        <PickAMovie :newEntrySearchResults="newEntrySearchResults" @rateMovie="rateMovie"/>
      </div>
      <div v-if="isVisible('rate-movie')" class="rate">
        <RateMovie
          :database="database"
          :movieToRate="movieToRate"
          :settings="settings"
          @addNewTag="addNewTag"
          @addRating="addRating"
        />
      </div>
      <div v-if="isVisible('db-search-results')" class="db-search-results">
        <DBSearchResults
          :database="database"
          :initialSortValue="dBSortValue"
          :initialValue="dBSearchValue"
          @clearSearch="dBSearchValue = null"
          @reRateMovie="rateMovie"
          @search="dBSearch"
        />
      </div>
      <Footer/>
    </div>
  </div>
</template>

<script>
import { decodeCredential } from 'vue3-google-login'
import axios from 'axios';
import cheerio from "cheerio";

import DBSearchResults from "./components/DBSearchResults.vue";
import Footer from "./components/Footer.vue";
import Header from "./components/Header.vue";
import NewRatingSearch from "./components/NewRatingSearch.vue";
import PickAMovie from "./components/PickAMovie.vue";
import QuickSearch from "./components/QuickSearch.vue";
import RateMovie from "./components/RateMovie.vue";
import SearchDatabase from "./components/SearchDatabase.vue";
import Settings from "./components/Settings.vue";

export default {
  name: "Movie-Log",
  components: {
    DBSearchResults,
    Footer,
    Header,
    NewRatingSearch,
    PickAMovie,
    QuickSearch,
    RateMovie,
    SearchDatabase,
    Settings
  },
  data () {
    return {
      database: {},
      databaseTopKey: null,
      dBSearchValue: "",
      dBSortValue: "",
      googleLogin: null,
      movieToRate: null,
      newEntrySearchResults: null,
      posterLayout: true,
      settings: {},
      showSettings: false,
      visible: "home"
    }
  },
  methods: {
    async login (resp) {
      const userData = decodeCredential(resp.credential)
      this.googleLogin = userData;
      this.databaseTopKey = this.createDBTopKey(userData.email);
      // this.databaseTopKey = this.createDBTopKey("mattgrosso+testing@gmail.com");
      await this.getDatabase();
      this.posterLayout = this.settings.posterLayout.grid;
    },
    createDBTopKey (email) {
      return email.replaceAll(/[-!$%@^&*()_+|~=`{}[\]:";'<>?,./]/g, "-");
    },
    async getDatabase () {
      const database = await axios.get(
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${this.databaseTopKey}.json`
      );

      if (database.data) {
        this.database = database.data.movieLog ? database.data.movieLog : {};
        this.settings = database.data.settings;
      } else {
        await this.initiateNewDatabase();
      }
    },
    async getMovieDatabase () {
      const movies = await axios.get(
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${this.databaseTopKey}/movieLog.json`
      );

      this.database = movies.data;
    },
    async getSettings () {
      const settings = await axios.get(
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${this.databaseTopKey}/settings.json`
      );

      this.settings = settings.data;
    },
    async initiateNewDatabase () {
      const newDB = {
        settings: {
          posterLayout: { grid: true },
          tags: [{ title: "default tag" }],
          weights: [
            { name: "direction", weight: 1.015 },
            { name: "imagery", weight: 0.9 },
            { name: "impression", weight: 1.9 },
            { name: "love", weight: 2.985 },
            { name: "overall", weight: 2.05 },
            { name: "performance", weight: 0.65 },
            { name: "soundtrack", weight: 0.2 },
            { name: "story", weight: 1.25 }
          ]
        }
      }

      await axios.put(
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${this.databaseTopKey}.json`,
        newDB
      );

      await this.getDatabase();
    },
    show (pane) {
      this.previouslyVisible = this.visible;
      this.visible = pane;
      window.scroll({
        top: top,
        behavior: 'smooth'
      })
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
      if (this.previouslyRated(movie.id)) {
        this.movieToRate = this.findMovieInDatabase(movie.id);
      } else {
        this.movieToRate = { movie };
      }

      this.show("rate-movie");
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
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${this.databaseTopKey}/settings/tags.json`,
        tag
      );

      this.getSettings();
    },
    async removeTag (tagIndex) {
      await axios.delete(
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${this.databaseTopKey}/settings/tags/${tagIndex}.json`
      );

      this.getSettings();
    },
    async updateWeight (payload) {
      await axios.patch(
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${this.databaseTopKey}/settings/weights/${payload.index}.json`,
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
    previouslyRated (id) {
      if (!this.database) {
        return false;
      }

      const ids = Object.keys(this.database).map((key) => this.database[key].movie.id);

      return ids.includes(id);
    },
    findMovieInDatabase (id) {
      const keys = Object.keys(this.database);
      const movies = keys.map((key) => {
        return {
          ...this.database[key],
          index: key
        }
      })

      const movie = movies.find((movie) => movie.movie.id === id);

      return this.database[movie.index];
    },
    findKeyForMovieInDatabase (id) {
      const keys = Object.keys(this.database);
      const movies = keys.map((key) => {
        return {
          ...this.database[key],
          key
        }
      })

      const movie = movies.find((movie) => movie.movie.id === id);

      if (movie) {
        return movie.key;
      } else {
        return false;
      }
    },
    async addRating (ratings) {
      const tmdbData = await this.getTMDBData(ratings[0].id);
      const imdbData = await this.getIMDBData(tmdbData.imdb_id);

      const movieWithRating = {
        movie: tmdbData,
        awards: imdbData,
        ratings: ratings
      }

      const key = this.findKeyForMovieInDatabase(ratings[0].id);

      if (key) {
        await axios.patch(
          `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${this.databaseTopKey}/movieLog/${key}.json`,
          movieWithRating
        );
      } else {
        await axios.post(
          `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${this.databaseTopKey}/movieLog.json`,
          movieWithRating
        );
      }

      this.getMovieDatabase();

      this.show("home");
    },
    dBSearch (value, sortValue) {
      this.dBSearchValue = `${value}`;
      if (sortValue) {
        this.dBSortValue = `${sortValue}`;
      }
      this.show("db-search-results");
    },
    async uploadRatings (ratings) {
      for (const rating of ratings) {
        await this.addRating(rating);
      }

      this.showSettings = false;
    },
    async posterLayoutSwitched (value) {
      const layoutSetting = {grid: value}
      await axios.patch(
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${this.databaseTopKey}/settings/posterLayout.json`,
        layoutSetting
      );

      this.getSettings();
      this.posterLayout = value;
    }
  }
}
</script>

<style lang="scss">
  body {
    font-family: "Roboto Condensed", sans-serif;
  }

  hr {
    border-top: 1px solid;
    margin: 0 10%;
    opacity: 0.3;
  }

  .login {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    margin: 30vh 24px;
  }
</style>

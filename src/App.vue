<template>
  <div class="movie-log">
    <div v-show="!googleLogin" class="login">
      <h1 class="col-12 text-center">Welcome to Movie Log</h1>
      <h2 class="col-12 text-center fs-6 mb-5">Please sign in with Google</h2>
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
        :uploadPercentage="uploadPercentage"
        @addNewTag="addNewTag"
        @posterLayoutSwitched="posterLayoutSwitched"
        @devModeSwitched="devModeSwitched"
        @removeTag="removeTag"
        @updateWeight="updateWeight"
        @uploadRatings="uploadRatings"
      />
      <router-view></router-view>
      <!-- <Home 
        v-show="isVisible('home')"
        @newEntrySearch="newEntrySearch"
        @dBSearch="dBSearch"
      />
      <PickAMovie
        v-if="isVisible('pick-a-movie')"
        :newEntrySearchResults="newEntrySearchResults"
        @rateMovie="rateMovie"
      />
      <RateMovie
        v-if="isVisible('rate-movie')"
        :database="database"
        :movieToRate="movieToRate"
        :settings="settings"
        @addNewTag="addNewTag"
        @addRating="addRating"
      />
      <DBSearchResults
        v-if="isVisible('db-search-results')"
        :database="database"
        :initialSortValue="dBSortValue"
        :initialValue="dBSearchValue"
        @clearSearch="dBSearchValue = null"
        @reRateMovie="rateMovie"
        @search="dBSearch"
      /> -->
      <Footer/>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import cheerio from "cheerio";

import Footer from "./components/Footer.vue";
import Header from "./components/Header.vue";
import Settings from "./components/Settings.vue";

export default {
  name: "Movie-Log",
  components: {
    Footer,
    Header,
    Settings
  },
  data () {
    return {
      database: {},
      databaseTopKey: null,
      dBSearchValue: "",
      dBSortValue: "",
      movieToRate: null,
      newEntrySearchResults: null,
      posterLayout: true,
      settings: {},
      showSettings: false,
      visible: "home",
      uploadPercentage: 0
    }
  },
  computed: {
    googleLogin () {
      return this.$store.state.googleLogin;
    }
  },
  methods: {
    async login (resp) {
      this.$store.dispatch('login', resp);
    },
    createDBTopKey (email) {
      return email.replaceAll(/[-!$%@^&*()_+|~=`{}[\]:";'<>?,./]/g, "-");
    },
    async getDatabase () {
      await this.$store.dispatch('getDatabase');
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
      this.$store.dispatch('initiateNewDatabase');
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
    dBSearch (value, sortValue) {
      this.dBSearchValue = `${value}`;
      if (sortValue) {
        this.dBSortValue = `${sortValue}`;
      }
      this.show("db-search-results");
    },
    async uploadRatings (ratings) {
      const total = ratings.length;
      let count = 0;

      for (const rating of ratings) {
        await this.addRating(rating, true);
        count = count + 1;
        this.uploadPercentage = count / total;
      }

      this.getMovieDatabase();
      this.show("home");
      this.showSettings = false;
    },
    async posterLayoutSwitched (value) {
      const layoutSetting = { grid: value }

      if (this.databaseTopKey) {
        await axios.patch(
          `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${this.databaseTopKey}/settings/posterLayout.json`,
          layoutSetting
        );
      }

      this.getSettings();
      this.posterLayout = value;
      this.showSettings = false;
    },
    async devModeSwitched (devMode) {
      if (devMode) {
        this.databaseTopKey = "testing-database";
      } else {
        this.databaseTopKey = this.createDBTopKey(this.googleLogin.email);
      }

      await this.getDatabase();
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

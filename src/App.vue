<template>
  <div class="movie-log">
    <div v-if="!googleLogin" class="login">
      <h1>Welcome to Movie Log</h1>
      <h2 class="fs-6 mb-5">Please sign in with Google</h2>
      <GoogleLogin :callback="login" prompt auto-login/>
    </div>
    <div v-if="googleLogin" class="content">
      <Header @openSettings="toggleSettings"/>
      <!-- <div class="col-12 my-3">
        <button class="btn btn-block btn-success col-10" @click="foobar">Click</button>
      </div> -->
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
        <SearchDatabase @dBSearch="dBSearch"/>
        <hr>
        <QuickSearch/>
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
        <DBSearchResults :database="database" :initialValue="dBSearchValue" @rateMovie="rateMovie"/>
      </div>
      <Footer/>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import cheerio from "cheerio";
import { decodeCredential } from 'vue3-google-login'

import Header from "./components/Header.vue";
import Settings from "./components/Settings.vue";
import NewRatingSearch from "./components/NewRatingSearch.vue";
import SearchDatabase from "./components/SearchDatabase.vue";
import DBSearchResults from "./components/DBSearchResults.vue";
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
    DBSearchResults,
    QuickSearch,
    PickAMovie,
    RateMovie,
    Footer
  },
  data () {
    return {
      googleLogin: null,
      database: {},
      settings: {},
      newEntrySearchResults: null,
      movieToRate: null,
      visible: "home",
      showSettings: false,
      dBSearchValue: ""
    }
  },
  async mounted () {
    await this.getMovieDatabase();
    await this.getSettings();
  },
  methods: {
    login (resp) {
      const userData = decodeCredential(resp.credential)
      this.googleLogin = userData;
    },
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
      if (this.previouslyRated(movie.id)) {
        this.movieToRate = this.findMovieInDatabase(movie.id);
      } else {
        this.movieToRate = { movie };
      }
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
    previouslyRated (id) {
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
          `https://movie-log-8c4d5-default-rtdb.firebaseio.com/movieLog/${key}.json`,
          movieWithRating
        );
      } else {
        await axios.post(
          "https://movie-log-8c4d5-default-rtdb.firebaseio.com/movieLog.json",
          movieWithRating
        );
      }

      this.getMovieDatabase();
      // todo: I might want this to show a different screen after you finish rating...
      this.show("home");
    },
    dBSearch (value) {
      this.dBSearchValue = value;
      this.show("db-search-results");
    },
    foobar () {
      this.findMovieInDatabase(2107);
    }
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

  .login {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    margin: 30vh 24px;
  }
</style>

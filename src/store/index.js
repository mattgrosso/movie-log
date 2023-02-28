import { createStore } from "vuex"
import axios from 'axios';
import { decodeCredential } from 'vue3-google-login'
import * as Sentry from "@sentry/vue";

const sortByVoteCount = (a, b) => {
  if (a.vote_count < b.vote_count) {
    return 1;
  }
  if (a.vote_count > b.vote_count) {
    return -1;
  }

  return 0;
}

export default createStore({
  state: {
    database: {},
    settings: {},
    googleLogin: null,
    databaseTopKey: null,
    newEntrySearchResults: [],
    movieToRate: {},
    DBSearchValue: null,
    DBSortValue: null,
    DBSortOrder: null,
    showHeader: true
  },
  getters: {
    allMoviesAsArray: (state) => {
      return Object.keys(state.database).map((key) => {
        return state.database[key];
      })
    }
  },
  mutations: {
    setDatabase (state, value) {
      state.database = Object.freeze(value);
    },
    setSettings (state, value) {
      state.settings = value;
    },
    setGoogleLogin (state, value) {
      state.googleLogin = value;
    },
    setDatabaseTopKey (state, value) {
      state.databaseTopKey = value.replaceAll(/[-!$%@^&*()_+|~=`{}[\]:";'<>?,./]/g, "-");
    },
    setNewEntrySearchResults (state, value) {
      const results = [...value];
      const sorted = results.sort(sortByVoteCount);

      if (sorted.length > 9) {
        sorted.length = 9;
      }

      state.newEntrySearchResults = sorted;
    },
    setMovieToRate (state, movie) {
      state.movieToRate = movie;
    },
    setDBSearchValue (state, value) {
      state.DBSearchValue = value;
    },
    setDBSortValue (state, value) {
      state.DBSortValue = value;
    },
    setDBSortOrder (state, value) {
      state.DBSortOrder = value;
    },
    setShowHeader (state, value) {
      state.showHeader = value;
    }
  },
  actions: {
    async login (context, resp) {
      const devMode = JSON.parse(window.localStorage.getItem('devMode'));
      const userData = decodeCredential(resp.credential);

      context.commit('setGoogleLogin', userData.email);

      if (devMode) {
        context.commit('setDatabaseTopKey', 'testing-database');
      } else if (context.state.googleLogin) {
        context.commit('setDatabaseTopKey', context.state.googleLogin);
      } else {
        Sentry.captureMessage("Login attempted but the user data didn't work");
      }

      await context.dispatch('getDatabase');
    },
    async getDatabase (context) {
      if (!context.state.databaseTopKey) {
        return;
      }

      window.localStorage.setItem('databaseTopKey', context.state.databaseTopKey);

      const database = await axios.get(
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${context.state.databaseTopKey}.json`
      );

      if (database.data) {
        const db = database.data.movieLog ? database.data.movieLog : {};
        const settings = database.data.settings
          ? database.data.settings
          : {
              posterLayout: { grid: true },
              routeAfterRating: { value: "recentlyViewed" },
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
            };
        context.commit('setDatabase', db);
        context.commit('setSettings', settings);
      } else {
        await context.dispatch('initiateNewDatabase');
      }
    },
    async initiateNewDatabase (context) {
      if (!context.state.databaseTopKey) {
        return;
      }

      const newDB = {
        movieLog: {},
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
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${context.state.databaseTopKey}.json`,
        newDB
      );

      await context.dispatch('getDatabase');
    }
  },
  modules: {
  }
})

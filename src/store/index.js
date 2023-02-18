import { createStore } from "vuex"
import axios from 'axios';
import { decodeCredential } from 'vue3-google-login'

export default createStore({
  state: {
    database: {},
    settings: {},
    googleLogin: null,
    databaseTopKey: null,
    newEntrySearchResults: [],
    movieToRate: {},
    DBSearchValue: null,
    DBSortValue: null
  },
  getters: {
    allMoviesAsArray: (state) => {
      return Object.keys(state.database).map((key) => {
        return state.database[key];
      })
    }
  },
  mutations: {
    // TODO: Can we just set a value on state without going through these mutations?
    setDatabase (state, value) {
      state.database = value;
    },
    setSettings (state, value) {
      state.settings = value;
    },
    setGoogleLogin (state, value) {
      state.googleLogin = value;
    },
    setDatabaseTopKey (state, value) {
      state.databaseTopKey = value;
    },
    setNewEntrySearchResults (state, value) {
      const results = [...value];

      if (results.length > 9) {
        results.length = 9;
      }

      state.newEntrySearchResults = results;
    },
    setMovieToRate (state, movie) {
      state.movieToRate = movie;
    },
    setDBSearchValue (state, value) {
      state.DBSearchValue = value;
    },
    setDBSortValue (state, value) {
      state.DBSortValue = value;
    }
  },
  actions: {
    async login (context, resp) {
      const devMode = JSON.parse(window.localStorage.getItem('devMode'));
      const userData = decodeCredential(resp.credential)
      context.commit('setGoogleLogin', userData);

      if (devMode) {
        context.commit('setDatabaseTopKey', 'testing-database');
      } else {
        const key = userData.email.replaceAll(/[-!$%@^&*()_+|~=`{}[\]:";'<>?,./]/g, "-");
        context.commit('setDatabaseTopKey', key);
      }

      await context.dispatch('getDatabase');
    },
    async getDatabase (context) {
      if (!context.state.databaseTopKey) {
        return;
      }

      const database = await axios.get(
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${context.state.databaseTopKey}.json`
      );

      if (database.data) {
        const db = database.data.movieLog ? database.data.movieLog : {};
        context.commit('setDatabase', db);
        context.commit('setSettings', database.data.settings);
      } else {
        await context.dispatch('initiateNewDatabase');
      }
    },
    async initiateNewDatabase (context) {
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

      await context.dispatch('getDatabase');
    }
  },
  modules: {
  }
})

// TODO: Somewhere something is creating a "null" db. We should figure out where that's coming from.
// TODO: It seems like the route after rating entries aren't working. Trace the path after new rating.
import { createStore } from "vuex"
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from "firebase/database";
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

// Firebase
const firebaseConfig = {
  databaseURL: "https://movie-log-8c4d5-default-rtdb.firebaseio.com",
};

initializeApp(firebaseConfig);

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
    },
    databaseTopKey (state) {
      return state.databaseTopKey;
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

      const shallowDb = await axios.get(
        `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${context.state.databaseTopKey}.json?shallow=true`
      );

      if (!shallowDb.data) {
        context.dispatch('initiateNewDatabase');
      } else {
        const db = getDatabase();

        const movieLog = ref(db, `${context.state.databaseTopKey}/movieLog`);

        onValue(movieLog, (snapshot) => {
          const data = snapshot.val();

          if (data) {
            context.commit('setDatabase', data);
          }
        });

        const settings = ref(db, `${context.state.databaseTopKey}/settings`);

        onValue(settings, (snapshot) => {
          const data = snapshot.val();

          if (data) {
            context.commit('setSettings', data);
          }
        });
      }
    },
    async initiateNewDatabase (context) {
      if (!context.state.databaseTopKey) {
        return;
      }

      const newDB = {
        movieLog: {},
        settings: {
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

      context.dispatch('getDatabase');
    }
  },
  modules: {
  }
})

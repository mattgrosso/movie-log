import { createStore } from "vuex"
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from "firebase/database";
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

const db = getDatabase();

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
    showHeader: true,
    goHome: false,
    devModeTopKey: 'testing-database'
  },
  getters: {
    allMoviesAsArray: (state) => {
      return Object.keys(state.database).map((key) => {
        return state.database[key];
      })
    },
    databaseTopKey (state) {
      return state.databaseTopKey;
    },
    devMode (state) {
      return state.databaseTopKey === state.devModeTopKey;
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
    },
    setGoHome (state, value) {
      state.goHome = value;
    }
  },
  actions: {
    async login (context, resp) {
      const devMode = JSON.parse(window.localStorage.getItem('devMode'));
      const userData = decodeCredential(resp.credential);

      context.commit('setGoogleLogin', userData.email);

      if (devMode) {
        context.commit('setDatabaseTopKey', context.state.devModeTopKey);
      } else if (context.state.googleLogin) {
        context.commit('setDatabaseTopKey', context.state.googleLogin);
      } else {
        Sentry.captureMessage("Login attempted but the user data didn't work");
      }

      await context.dispatch('resetLocalDB');
    },
    async resetLocalDB (context) {
      context.commit('setDatabase', {});
      context.commit('setSettings', {});

      await context.dispatch('initializeDB');
    },
    async initializeDB (context) {
      if (!context.state.databaseTopKey) {
        return;
      }

      window.localStorage.setItem('databaseTopKey', context.state.databaseTopKey);

      const dataBaseHasData = Boolean(Object.keys(context.state.database).length);
      if (!dataBaseHasData) {
        onValue(ref(db, `${context.state.databaseTopKey}/movieLog`), (snapshot) => {
          const data = snapshot.val();

          const oldLength = context.state.database ? Object.keys(context.state.database).length : 0;
          const newLength = data ? Object.keys(data).length : 0;

          if (oldLength > newLength) {
            const deletedKeys = Object.keys(context.state.database).filter((key) => {
              return !data[key];
            });
            Sentry.captureMessage(`${context.state.databaseTopKey}'s DB length decreased from ${oldLength} to ${newLength}. The deleted keys are ${deletedKeys.join(', ')}. The value of the first deleted key is ${context.state.database[deletedKeys[0]]}.`);
          } else if (oldLength && newLength > oldLength) {
            Sentry.captureMessage(`${context.state.databaseTopKey}'s DB length increased from ${oldLength} to ${newLength}.`);
          }

          if (data) {
            if (context.state.databaseTopKey === "hopper-seth-gmail-com") {
              const justTitles = Object.keys(data).map((key) => {
                return data[key].movie.title;
              });
              Sentry.captureMessage(`Seth's DB has changed. It looks like this right now: ${JSON.stringify(justTitles)}`);
            }
            context.commit('setDatabase', data);
          }
        });
      }

      const settingsHasData = Boolean(Object.keys(context.state.settings).length);
      if (!settingsHasData) {
        onValue(ref(db, `${context.state.databaseTopKey}/settings`), (snapshot) => {
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
          tags: {
            "viewing-tags": { title: "default viewing tag" },
            "movie-tags": { title: "default movie tag" },
          },
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

      set(ref(db, `${context.state.databaseTopKey}`), newDB);

      context.dispatch('initializeDB');
    },
    async setDBValue (context, dbEntry) {
      try {
        await set(ref(db, `${context.state.databaseTopKey}/${dbEntry.path}`), dbEntry.value);
      } catch (error) {
        console.error(error);
        Sentry.captureMessage(`${context.state.databaseTopKey} failed to add a value. The path was ${dbEntry.path} and the value was ${dbEntry.value}.`);
        Sentry.captureException(error);
      }
    }
  },
  modules: {
  }
})

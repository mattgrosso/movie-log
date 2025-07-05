import axios from 'axios';
import { createStore } from "vuex"
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import * as Sentry from "@sentry/vue";
import { getRating } from "../assets/javascript/GetRating";
import router from '@/router';

const sortByVoteCount = (a, b) => {
  if (a.vote_count < b.vote_count) {
    return 1;
  }
  if (a.vote_count > b.vote_count) {
    return -1;
  }

  return 0;
}

const mostRecentRating = (media) => {
  return getRating(media);
}

const sortByRating = (a, b) => {
  const sortValueA = mostRecentRating(a).calculatedTotal;
  const sortValueB = mostRecentRating(b).calculatedTotal;

  if (sortValueA < sortValueB) {
    return 1;
  }

  if (sortValueA > sortValueB) {
    return -1;
  }

  return 0;
}

const removeNaNAndUndefined = (obj) => {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        removeNaNAndUndefined(obj[key]);
      } else if (Number.isNaN(obj[key]) || obj[key] === undefined) {
        Sentry.captureMessage(`NaN or undefined value found in ${key}. The Object was ${JSON.stringify(obj)}`);
        delete obj[key];
      }
    }
  }
  return obj;
};

// Firebase
const firebaseConfig = {
  apiKey: process.env.VUE_APP_GOOGLE_API_KEY,
  authDomain: "movie-log-8c4d5.firebaseapp.com",
  databaseURL: "https://movie-log-8c4d5-default-rtdb.firebaseio.com",
  projectId: "movie-log-8c4d5",
  storageBucket: "movie-log-8c4d5.appspot.com",
  messagingSenderId: "84563192115",
  appId: "1:84563192115:web:121c681b37d284dcc93646",
  measurementId: "G-4K1Y42HFSL"
};

initializeApp(firebaseConfig);

const db = getDatabase();

export default createStore({
  state: {
    movieLog: {},
    settings: {},
    weights: [ // These values should all add up to 10 except that "stickiness" gets divided by 2 first
      { name: "love", weight: 2.8 },
      { name: "overall", weight: 2 },
      { name: "story", weight: 1.25 },
      { name: "direction", weight: 1.1 },
      { name: "imagery", weight: 0.9 },
      { name: "stickiness", weight: 1.9 },
      { name: "performance", weight: 0.7 },
      { name: "soundtrack", weight: 0.3 },
    ],
    academyAwardWinners: {},
    userEmail: null,
    databaseTopKey: null,
    newEntrySearchResults: [],
    movieToRate: {},
    DBSearchValue: null,
    DBSortValue: null,
    DBSortOrder: null,
    showHeader: true,
    goHome: false,
    // devModeTopKey: 'testing-database',
    // devModeTopKey: 'natalierosegrosso-gmail-com',
    devModeTopKey: 'carrieseltzer-gmail-com',
    // devModeTopKey: 'hopper-seth-gmail-com',
    // devModeTopKey: 'brianpatrick1-gmail-com',
    dbLoaded: false,
    filteredResults: [],
  },
  getters: {
    allMediaAsArray: (state) => {
      if (!state.dbLoaded) {
        return [];
      }

      return Object.keys(state.movieLog).map((key) => {
        const movie = state.movieLog[key];
        movie.dbKey = key;
        return movie;
      });
    },
    allMoviesAsArray: (state) => {
      return Object.keys(state.movieLog).map((key) => {
        return state.movieLog[key];
      })
    },
    allMediaSortedByRating: (state, getters) => {
      return getters.allMediaAsArray.sort(sortByRating);
    },
    allMediaRatingsArray: (state, getters) => {
      return getters.allMediaAsArray.map((media) => {
        return mostRecentRating(media).calculatedTotal;
      });
    },
    databaseTopKey (state, getters) {
      return getters.devMode ? state.devModeTopKey : state.databaseTopKey;
    },
    devMode () {
      return localStorage.getItem('devMode') === 'true';
    },
    weight (state) {
      return (name) => {
        return state.weights.find((weight) => weight.name === name).weight;
      }
    },
  },
  mutations: {
    setMovieLog (state, value) {
      state.movieLog = Object.freeze(value);
    },
    setSettings (state, value) {
      state.settings = value;
    },
    setAcademyAwardWinners (state, value) {
      state.academyAwardWinners = value
    },
    setUserEmail (state, value) {
      state.userEmail = value;
    },
    setDatabaseTopKey (state, value) {
      state.databaseTopKey = value.replaceAll(/[-!$%@^&*()_+|~=`{}[\]:";'<>?,./]/g, "-");
    },
    setNewEntrySearchResults (state, value) {
      const results = [...value];
      const sorted = results.sort(sortByVoteCount);

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
    },
    setDbLoaded (state, value) {
      state.dbLoaded = value;
    },
    setFilteredResults (state, value) {
      state.filteredResults = value;
    }
  },
  actions: {
    async login (context) {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();

      try {
        const result = await signInWithPopup(auth, provider);
        // Handle the result.
        if (result) {
          const userData = result.user;

          context.commit('setUserEmail', userData.email);

          if (context.state.userEmail) {
            context.dispatch('setDatabaseTopKey', context.state.userEmail);
            window.localStorage.setItem('databaseTopKey', context.state.userEmail.replaceAll(/[-!$%@^&*()_+|~=`{}[\]:";'<>?,./]/g, "-"));
            context.dispatch('initializeDB');
            router.push('/');
          } else {
            console.error("Login attempted but the user data didn't work");
          }
        }
      } catch (error) {
        console.error(error);
      }
    },
    async resetLocalDB (context) {
      context.commit('setMovieLog', {});
      context.commit('setSettings', {});
      context.commit('setAcademyAwardWinners', {});

      await context.dispatch('initializeDB');
    },
    async initializeDB (context) {
      if (!context.getters.databaseTopKey) {
        return;
      }
      const movieLogHasData = Boolean(Object.keys(context.state.movieLog).length);
      if (!movieLogHasData) {
        onValue(ref(db, `${context.getters.databaseTopKey}/movieLog`), (snapshot) => {
          const data = snapshot.val();

          if (data) {
            context.commit('setMovieLog', data);
          }
          context.commit('setDbLoaded', true);
        });
      }
      const settingsHasData = Boolean(Object.keys(context.state.settings).length);
      if (!settingsHasData) {
        onValue(ref(db, `${context.getters.databaseTopKey}/settings`), (snapshot) => {
          const data = snapshot.val();

          if (data) {
            context.commit('setSettings', data);
          }
        });
      }
      const academyAwardWinnersHasData = Boolean(Object.keys(context.state.academyAwardWinners).length);
      if (!academyAwardWinnersHasData) {
        try {
          const response = await axios.get(`https://pacific-journey-63469-f4b691e852c6.herokuapp.com/awards?category=Best%20Picture`);
          const data = response.data.map((item) => {
            return {
              ...item,
              isWinner: ['TRUE', '1', true].includes(item.isWinner)
            }
          }).filter((item) => item.isWinner);

          const bestPictureWinners = [];

          for (const movieEntry of data) {
            try {
              const movieResponse = await axios.get(`https://api.themoviedb.org/3/movie/${movieEntry.tmdb}?api_key=${process.env.VUE_APP_TMDB_API_KEY}`);
              bestPictureWinners.push({
                ...movieResponse.data,
                academyAwardsYear: movieEntry.year
              });
            } catch (error) {
              console.error(error);
            }
          }

          context.commit('setAcademyAwardWinners', { bestPicture: bestPictureWinners });
        } catch (error) {
          console.error('Failed to get awards data:', error);
        }
      }
    },
    // todo: should I delete this? Nothing is calling it but it seems like something I kind of need...
    async initiateNewDatabase (context) {
      if (!context.getters.databaseTopKey) {
        return;
      }

      const newDB = {
        movieLog: {},
        settings: {
          tags: {
            "viewing-tags": { title: "default viewing tag" },
            "movie-tags": { title: "default movie tag" },
          }
        }
      }

      set(ref(db, `${context.getters.databaseTopKey}`), newDB);

      context.dispatch('initializeDB');
    },
    async setDBValue (context, dbEntry) {
      const cleanedDBEntry = removeNaNAndUndefined(dbEntry.value);

      set(ref(db, `${context.getters.databaseTopKey}/${dbEntry.path}`), cleanedDBEntry)
        .then(() => {
          console.log('setDBValue success');
        })
        .catch((error) => {
          console.error(error);
          Sentry.captureException(error);
        });
    },
    // This action adds a TV show to the list of recently rated TV shows in the user's settings.
  },
  modules: {
  }
})

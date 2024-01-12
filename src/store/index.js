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

const mostRecentRating = (media) => {
  if (media.ratings.tvShow) {
    return media.ratings.tvShow;
  } else {
    let mostRecentRating = media.ratings[0];

    media.ratings.forEach((rating) => {
      const ratingDate = rating.date ? new Date(rating.date).getTime() : 0;
      const mostRecentRatingDate = mostRecentRating.date ? new Date(mostRecentRating.date).getTime() : 0;

      if (!mostRecentRating.date) {
        mostRecentRating = rating;
      } else if (ratingDate && ratingDate > mostRecentRatingDate) {
        mostRecentRating = rating;
      }
    })

    return mostRecentRating;
  }
}

const sortByRating = (a, b) => {
  const sortValueA = mostRecentRating(a).rating;
  const sortValueB = mostRecentRating(b).rating;

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
  databaseURL: "https://movie-log-8c4d5-default-rtdb.firebaseio.com",
};

initializeApp(firebaseConfig);

const db = getDatabase();

export default createStore({
  state: {
    currentLog: 'movieLog',
    movieLog: {},
    tvLog: {},
    settings: {},
    googleLogin: null,
    databaseTopKey: null,
    newEntrySearchResults: [],
    movieToRate: {},
    tvShowToRate: {},
    DBSearchValue: null,
    DBSearchType: null,
    DBSortValue: null,
    DBSortOrder: null,
    showHeader: true,
    goHome: false,
    devModeTopKey: 'testing-database'
  },
  getters: {
    allMediaAsArray: (state) => {
      if (state.currentLog === 'tvLog') {
        return Object.keys(state.tvLog).map((key) => {
          const tvShow = state.tvLog[key];
          tvShow.dbKey = key;
          return tvShow;
        })
      } else {
        return Object.keys(state.movieLog).map((key) => {
          const movie = state.movieLog[key];
          movie.dbKey = key;
          return movie;
        })
      }
    },
    allMoviesAsArray: (state) => {
      return Object.keys(state.movieLog).map((key) => {
        return state.movieLog[key];
      })
    },
    allTVShowsAsArray: (state) => {
      return Object.keys(state.tvLog).map((key) => {
        return state.tvLog[key];
      })
    },
    allMediaSortedByRating: (state, getters) => {
      return getters.allMediaAsArray.sort(sortByRating);
    },
    databaseTopKey (state) {
      return state.databaseTopKey;
    },
    devMode (state) {
      return state.databaseTopKey === state.devModeTopKey;
    }
  },
  mutations: {
    setCurrentLog (state, value) {
      state.currentLog = value;
    },
    setMovieLog (state, value) {
      state.movieLog = Object.freeze(value);
    },
    setTVLog (state, value) {
      state.tvLog = Object.freeze(value);
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

      state.newEntrySearchResults = sorted;
    },
    setMovieToRate (state, movie) {
      state.movieToRate = movie;
    },
    setTVShowToRate (state, tvShow) {
      state.tvShowToRate = tvShow;
    },
    setDBSearchValue (state, value) {
      state.DBSearchValue = value;
    },
    setDBSearchType (state, value) {
      state.DBSearchType = value;
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
      context.commit('setMovieLog', {});
      context.commit('setTVLog', {});
      context.commit('setSettings', {});

      await context.dispatch('initializeDB');
    },
    async initializeDB (context) {
      if (!context.state.databaseTopKey) {
        return;
      }

      window.localStorage.setItem('databaseTopKey', context.state.databaseTopKey);

      const movieLogHasData = Boolean(Object.keys(context.state.movieLog).length);
      if (!movieLogHasData) {
        onValue(ref(db, `${context.state.databaseTopKey}/movieLog`), (snapshot) => {
          const data = snapshot.val();

          if (data) {
            context.commit('setMovieLog', data);
          }
        });
      }

      const tvLogHasData = Boolean(Object.keys(context.state.tvLog).length);
      if (!tvLogHasData) {
        onValue(ref(db, `${context.state.databaseTopKey}/tvLog`), (snapshot) => {
          const data = snapshot.val();

          if (data) {
            context.commit('setTVLog', data);
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
    // todo: should I delete this? Nothing is calling it but it seems like something I kind of need...
    async initiateNewDatabase (context) {
      if (!context.state.databaseTopKey) {
        return;
      }

      const newDB = {
        movieLog: {},
        tvLog: {},
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
      const cleanedDBEntry = removeNaNAndUndefined(dbEntry.value);

      set(ref(db, `${context.state.databaseTopKey}/${dbEntry.path}`), cleanedDBEntry)
        .then(() => {
          console.log('setDBValue success');
        })
        .catch((error) => {
          console.error(error);
          Sentry.captureException(error);
        });
    },
    // This action adds a TV show to the list of recently rated TV shows in the user's settings.
    addToRecentlyRatedTVShows (context, tvShow) {
      // Get the current list of recently rated TV shows from the user's settings.
      const recentlyRatedTVShows = context.state.settings.recentlyRatedTVShows || [];

      // If the TV show being added is already in the list, remove it from its current position.
      if (recentlyRatedTVShows.find((show) => show.id === tvShow.id)) {
        const index = recentlyRatedTVShows.findIndex((show) => show.id === tvShow.id);
        recentlyRatedTVShows.splice(index, 1);
      }

      // If the list of recently rated TV shows is longer than 2, remove the oldest item(s) until it's only 2 items long.
      if (recentlyRatedTVShows.length > 2) {
        recentlyRatedTVShows.length = 2;
      }

      // Add the new TV show to the beginning of the list of recently rated TV shows.
      recentlyRatedTVShows.unshift(tvShow);

      // Update the user's settings in the database with the new list of recently rated TV shows.
      context.dispatch('setDBValue', {
        path: 'settings/recentlyRatedTVShows',
        value: recentlyRatedTVShows
      });
    },
    toggleCurrentLog (context) {
      if (this.state.currentLog === 'movieLog') {
        this.commit('setCurrentLog', 'tvLog');
      } else {
        this.commit('setCurrentLog', 'movieLog');
      }

      window.localStorage.setItem('movieLogCurrentLog', context.state.currentLog);
    }
  },
  modules: {
  }
})

import { createRouter, createWebHashHistory } from 'vue-router';
import store from "../store";

const Home = () => import(/* webpackChunkName: "home" */ "../components/Home.vue");
const Login = () => import(/* webpackChunkName: "login" */ "../components/Login.vue");
const PickMedia = () => import(/* webpackChunkName: "pick-media" */ "../components/PickMedia.vue");
const RateMovie = () => import(/* webpackChunkName: "rate-movie" */ "../components/RateMovie.vue");
const Insights = () => import(/* webpackChunkName: "insights" */ "../components/Insights.vue");
const ShareDBResults = () => import(/* webpackChunkName: "share-db-results" */ "../components/ShareDBResults.vue");
const MovieDetail = () => import(/* webpackChunkName: "movie-detail" */ "../components/MovieDetail.vue");

// Router
const loggedIn = () => {
  const databaseTopKeyFromLocalStorage = window.localStorage.getItem('databaseTopKey');

  if (store.getters.databaseTopKey) {
    store.dispatch('initializeDB');
    return true;
  } else if (databaseTopKeyFromLocalStorage) {
    store.commit('setDatabaseTopKey', databaseTopKeyFromLocalStorage);
    store.dispatch('initializeDB');
    return true;
  } else {
    return false;
  }
}

const routes = [
  {
    path: '/',
    name: 'Home', // Added name for programmatic navigation
    component: Home,
    meta: {
      requiresLogin: true
    },
    beforeEnter: (to, from, next) => {
      store.commit('setGoHome', false);

      if (!loggedIn()) {
        next('/login');
      } else {
        next();
      }
    }
  },
  {
    path: '/login',
    component: Login,
    meta: {
      requiresLogin: false
    },
  },
  {
    path: '/rate-movie',
    component: RateMovie,
    meta: {
      requiresLogin: true
    },
    beforeEnter: (to, from, next) => {
      if (!loggedIn()) {
        next('/login');
      } else {
        next();
      }
    }
  },
  {
    path: '/insights',
    component: Insights,
    meta: {
      requiresLogin: true
    },
    beforeEnter: (to, from, next) => {
      if (!loggedIn()) {
        next('/login');
      } else {
        next();
      }
    }
  },
  {
    path: '/pick-media/:newEntrySearchResults',
    component: PickMedia,
    meta: {
      requiresLogin: true
    },
    beforeEnter: (to, from, next) => {
      if (!loggedIn()) {
        next('/login');
      } else {
        next();
      }
    }
  },
  {
    path: '/share/:userDBKey/:shareKey',
    component: ShareDBResults,
    meta: {
      requiresLogin: false
    }
  },
  {
    path: '/movie/:tmdbId',
    name: 'MovieDetail',
    component: MovieDetail,
    meta: {
      requiresLogin: true
    },
    beforeEnter: (to, from, next) => {
      if (!loggedIn()) {
        next('/login');
      } else {
        next();
      }
    }
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router;
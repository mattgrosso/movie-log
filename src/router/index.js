import { createRouter, createWebHashHistory } from 'vue-router';
import store from "../store";
import Login from "../components/Login.vue";
import Home from "../components/Home.vue";
import PickMedia from "../components/PickMedia.vue";
import RateMovie from "../components/RateMovie.vue";
import RateTVShow from "../components/RateTVShow.vue";
import ShareDBResults from "../components/ShareDBResults.vue";

// Router
const loggedIn = () => {
  const currentLogFromLocalStorage = window.localStorage.getItem('movieLogCurrentLog');

  if (currentLogFromLocalStorage) {
    store.commit('setCurrentLog', currentLogFromLocalStorage);
  }

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
    path: '/rate-tv-show',
    component: RateTVShow,
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
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router;
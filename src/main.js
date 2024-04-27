import { createApp } from "vue";
import App from "./App.vue";
import store from "./store";
import { createRouter, createWebHashHistory } from 'vue-router';
import vue3GoogleLogin from 'vue3-google-login';
import VueClickAway from "vue3-click-away";
import * as Sentry from "@sentry/vue";
import { BrowserTracing } from "@sentry/tracing";
import VueLazyLoad from 'vue3-lazyload';
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import 'bootstrap-icons/font/bootstrap-icons.css';
import Login from "./components/Login.vue";
import Home from "./components/Home.vue";
import PickMedia from "./components/PickMedia.vue";
import RateMovie from "./components/RateMovie.vue";
import RateTVShow from "./components/RateTVShow.vue";
import ShareDBResults from "./components/ShareDBResults.vue";
import VueCalendarHeatmap from 'vue3-calendar-heatmap';
import './registerServiceWorker'

const app = createApp(App);

app.use(store);

app.use(vue3GoogleLogin, {
  clientId: '495603923646-j49hr3l4m6l9grbvrnp7fr652hon2um3.apps.googleusercontent.com'
});

app.use(VueClickAway);

app.use(VueLazyLoad, {});

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

app.use(VueCalendarHeatmap);

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

app.use(router);

// Sentry

const allowDevSentry = false;

if (allowDevSentry || process.env.NODE_ENV !== "development") {
  Sentry.init({
    app,
    dsn: "https://25a3dc0387f04fd5923f226394a41e7d@o4504483013525504.ingest.sentry.io/4504642713944064",
    integrations: [
      new BrowserTracing({
        tracePropagationTargets: ["localhost", "surge", /^\//],
      }),
    ],
    tracesSampleRate: 1.0,
    sampleRate: 1.0,
    maxValueLength: 8000
  });
}

app.mount("#app");

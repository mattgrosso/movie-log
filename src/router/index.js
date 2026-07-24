import { createRouter, createWebHashHistory } from 'vue-router';
import store from "../store";

const Home = () => import(/* webpackChunkName: "home" */ "../components/Home.vue");
const Login = () => import(/* webpackChunkName: "login" */ "../components/Login.vue");
const PickMedia = () => import(/* webpackChunkName: "pick-media" */ "../components/PickMedia.vue");
const RateMovie = () => import(/* webpackChunkName: "rate-movie" */ "../components/RateMovie.vue");
const Insights = () => import(/* webpackChunkName: "insights" */ "../components/Insights.vue");
const ShareDBResults = () => import(/* webpackChunkName: "share-db-results" */ "../components/ShareDBResults.vue");
const MovieDetail = () => import(/* webpackChunkName: "movie-detail" */ "../components/MovieDetail.vue");
const YearInReview = () => import(/* webpackChunkName: "year-in-review" */ "../components/YearInReview.vue");
const TrophyCase = () => import(/* webpackChunkName: "trophy-case" */ "../components/TrophyCase.vue");
const GamesHub = () => import(/* webpackChunkName: "games" */ "../components/games/GamesHub.vue");
const HigherLowerGame = () => import(/* webpackChunkName: "games" */ "../components/games/HigherLowerGame.vue");
const ReelWordleGame = () => import(/* webpackChunkName: "games" */ "../components/games/ReelWordleGame.vue");
const ConnectionsGame = () => import(/* webpackChunkName: "games" */ "../components/games/ConnectionsGame.vue");
const SixDegreesGame = () => import(/* webpackChunkName: "games" */ "../components/games/SixDegreesGame.vue");
const TimelineGame = () => import(/* webpackChunkName: "games" */ "../components/games/TimelineGame.vue");

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
  {
    path: '/year-in-review',
    name: 'YearInReview',
    component: YearInReview,
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
    path: '/trophy-case',
    name: 'TrophyCase',
    component: TrophyCase,
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
    path: '/games',
    name: 'GamesHub',
    component: GamesHub,
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
    path: '/games/higher-lower',
    name: 'HigherLowerGame',
    component: HigherLowerGame,
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
    path: '/games/wordle',
    name: 'ReelWordleGame',
    component: ReelWordleGame,
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
    path: '/games/connections',
    name: 'ConnectionsGame',
    component: ConnectionsGame,
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
    path: '/games/six-degrees',
    name: 'SixDegreesGame',
    component: SixDegreesGame,
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
    path: '/games/timeline',
    name: 'TimelineGame',
    component: TimelineGame,
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

// Safety net for scroll-lock leaks. Modals/overlays across the app lock body
// scrolling via `body.no-scroll` (overflow:hidden) or `body.style.overflow`, and
// rely on their own close handler to undo it. When a route change happens while
// one is still open (e.g. tapping "Rate" from Home's movie-info modal), the close
// handler never runs and the lock sticks to <body> on every subsequent screen
// until a reload. Clearing it on each navigation guarantees no overlay can leave
// the page permanently unscrollable.
router.afterEach(() => {
  document.body.classList.remove('no-scroll');
  document.body.style.overflow = '';
})

export default router;
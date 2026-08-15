import { createRouter, createWebHashHistory } from 'vue-router';
import store from "../store";
import { gameAwareScrollBehavior } from "./scrollBehavior.js";

const Home = () => import(/* webpackChunkName: "home" */ "../components/Home.vue");
const Login = () => import(/* webpackChunkName: "login" */ "../components/Login.vue");
const PickMedia = () => import(/* webpackChunkName: "pick-media" */ "../components/PickMedia.vue");
const RateMovie = () => import(/* webpackChunkName: "rate-movie" */ "../components/RateMovie.vue");
const ReconcilePlaceholder = () => import(/* webpackChunkName: "reconcile-placeholder" */ "../components/ReconcilePlaceholder.vue");
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
const ClueBudgetGame = () => import(/* webpackChunkName: "games" */ "../components/games/ClueBudgetGame.vue");
const TaglineQuizGame = () => import(/* webpackChunkName: "games" */ "../components/games/TaglineQuizGame.vue");
const TriviaGame = () => import(/* webpackChunkName: "games" */ "../components/games/TriviaGame.vue");
const PosterZoomGame = () => import(/* webpackChunkName: "games" */ "../components/games/PosterZoomGame.vue");
const StampGame = () => import(/* webpackChunkName: "games" */ "../components/games/StampGame.vue");
const GameStatsScreen = () => import(/* webpackChunkName: "games" */ "../components/games/GameStatsScreen.vue");
const WatchlistScreen = () => import(/* webpackChunkName: "watchlist" */ "../components/WatchlistScreen.vue");

// Router
const loggedIn = () => {
  const databaseTopKeyFromLocalStorage = window.localStorage.getItem('databaseTopKey');

  if (store.getters.databaseTopKey) {
    store.dispatch('initializeDB');
    return true;
  } else if (databaseTopKeyFromLocalStorage) {
    store.commit('setDatabaseTopKey', databaseTopKeyFromLocalStorage);
    // The sanitized key can't be turned back into an address, so the raw
    // email is stored separately purely so the settings panel can show who
    // you're signed in as after a reload.
    const userEmailFromLocalStorage = window.localStorage.getItem('userEmail');
    if (userEmailFromLocalStorage) {
      store.commit('setUserEmail', userEmailFromLocalStorage);
    }
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
    path: '/reconcile/:dbKey',
    component: ReconcilePlaceholder,
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
  {
    path: '/games/clue-budget',
    name: 'ClueBudgetGame',
    component: ClueBudgetGame,
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
    path: '/games/tagline',
    name: 'TaglineQuizGame',
    component: TaglineQuizGame,
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
    path: '/watchlist',
    name: 'WatchlistScreen',
    component: WatchlistScreen,
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
    path: '/games/stats',
    name: 'GameStatsScreen',
    component: GameStatsScreen,
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
    path: '/games/stamp',
    name: 'StampGame',
    component: StampGame,
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
    path: '/games/trivia',
    name: 'TriviaGame',
    component: TriviaGame,
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
    path: '/games/poster-zoom',
    name: 'PosterZoomGame',
    component: PosterZoomGame,
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
  // Catch-all. Without this, an unmatched path renders NOTHING — no error, no
  // redirect, just the header over a blank page (confirmed live against a
  // route that had been removed). Games that no longer exist are the way this
  // actually bit: /games/rate-off and /games/quiz were both deleted, and
  // anything still pointing at them led straight here.
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  // Scoped to game routes only — see scrollBehavior.js for why this isn't
  // a blanket scroll-to-top.
  scrollBehavior: gameAwareScrollBehavior
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
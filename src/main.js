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
import Home from "./components/Home.vue";
import DBSearchResults from "./components/DBSearchResults.vue";
import PickAMovie from "./components/PickAMovie.vue";
import RateMovie from "./components/RateMovie.vue";
import ShareDBResults from "./components/ShareDBResults.vue";

const app = createApp(App);

app.use(store);

app.use(vue3GoogleLogin, {
  clientId: '495603923646-j49hr3l4m6l9grbvrnp7fr652hon2um3.apps.googleusercontent.com'
});

app.use(VueClickAway);

app.use(VueLazyLoad, {});

// Router

// TODO: We should use navigation guards to force login for some pages and not force login for others (like the db results share page)
// todo: https://router.vuejs.org/guide/advanced/navigation-guards.html
const routes = [
  { path: '/', component: Home },
  { path: '/db-search', component: DBSearchResults },
  { path: '/rate-movie', component: RateMovie },
  { path: '/pick-movie/:newEntrySearchResults', component: PickAMovie },
  { path: '/share/:userDBKey/:shareKey', component: ShareDBResults },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

app.use(router);

// Sentry

if (process.env.NODE_ENV !== "development") {
  Sentry.init({
    app,
    dsn: "https://25a3dc0387f04fd5923f226394a41e7d@o4504483013525504.ingest.sentry.io/4504642713944064",
    integrations: [
      new BrowserTracing({
        tracePropagationTargets: ["localhost", "surge", /^\//],
      }),
    ],
    tracesSampleRate: 1.0,
  });
}

app.mount("#app");

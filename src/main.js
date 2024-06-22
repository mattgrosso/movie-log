import { createApp } from "vue";
import App from "./App.vue";
import store from "./store";
import router from './router';
import VueClickAway from "vue3-click-away";
import * as Sentry from "@sentry/vue";
import { BrowserTracing } from "@sentry/tracing";
import VueLazyLoad from 'vue3-lazyload';
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import 'bootstrap-icons/font/bootstrap-icons.css';
import VueCalendarHeatmap from 'vue3-calendar-heatmap';
import './registerServiceWorker'

const app = createApp(App);

app.use(store);

app.use(VueClickAway);

app.use(VueLazyLoad, {});

app.use(VueCalendarHeatmap);

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

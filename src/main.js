import { createApp } from "vue";
import App from "./App.vue";
import store from "./store";
import vue3GoogleLogin from 'vue3-google-login';
import VueClickAway from "vue3-click-away";
import * as Sentry from "@sentry/vue";
import { BrowserTracing } from "@sentry/tracing";

const app = createApp(App);
app.use(store);
app.use(vue3GoogleLogin, {
  clientId: '495603923646-j49hr3l4m6l9grbvrnp7fr652hon2um3.apps.googleusercontent.com'
});
app.use(VueClickAway);

Sentry.init({
  app,
  dsn: "https://25a3dc0387f04fd5923f226394a41e7d@o4504483013525504.ingest.sentry.io/4504642713944064",
  integrations: [
    new BrowserTracing({
      tracePropagationTargets: ["localhost", "surge", /^\//],
    }),
  ],
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

app.mount("#app");

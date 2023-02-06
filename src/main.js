import { createApp } from "vue"
import App from "./App.vue"
import store from "./store"
import vue3GoogleLogin from 'vue3-google-login'

const app = createApp(App)
app.use(store);
app.use(vue3GoogleLogin, {
  clientId: '495603923646-j49hr3l4m6l9grbvrnp7fr652hon2um3.apps.googleusercontent.com'
})

app.mount("#app");

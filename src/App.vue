<template>
  <div class="movie-log">
    <div v-if="!databaseTopKey" class="login">
      <h1 class="col-12 text-center">Welcome to Movie Log</h1>
      <h2 class="col-12 text-center fs-6 mb-5">Please sign in with Google</h2>
      <GoogleLogin :callback="login" prompt auto-login/>
    </div>
    <div v-if="databaseTopKey" class="content">
      <Header/>
      <router-view></router-view>
      <Footer/>
    </div>
  </div>
</template>

<script>
import Footer from "./components/Footer.vue";
import Header from "./components/Header.vue";

export default {
  name: "Movie-Log",
  components: {
    Footer,
    Header
  },
  computed: {
    databaseTopKey () {
      const databaseTopKeyFromLocalStorage = window.localStorage.getItem('databaseTopKey');

      if (databaseTopKeyFromLocalStorage) {
        this.$store.commit('setDatabaseTopKey', databaseTopKeyFromLocalStorage);
        this.$store.dispatch('getDatabase');
        return databaseTopKeyFromLocalStorage;
      } else {
        return this.$store.state.databaseTopKey;
      }
    }
  },
  methods: {
    async login (resp) {
      this.$store.dispatch('login', resp);
    }
  }
}
</script>

<style lang="scss">
  body {
    font-family: "Roboto Condensed", sans-serif;
  }

  .login {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    margin: 30vh 24px;
  }
</style>

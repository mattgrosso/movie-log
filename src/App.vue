<template>
  <div class="movie-log">
    <div v-show="!googleLogin" class="login">
      <h1 class="col-12 text-center">Welcome to Movie Log</h1>
      <h2 class="col-12 text-center fs-6 mb-5">Please sign in with Google</h2>
      <GoogleLogin :callback="login" prompt auto-login/>
    </div>
    <div v-show="googleLogin" class="content">
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
    googleLogin () {
      return this.$store.state.googleLogin;
    }
  },
  methods: {
    async login (resp) {
      // Can we store some value in localStorage so that we don't have to reauth everytime?
      this.$store.dispatch('login', resp);
    }
  }
}
</script>

<style lang="scss">
  body {
    font-family: "Roboto Condensed", sans-serif;
  }

  hr {
    border-top: 1px solid;
    margin: 0 10%;
    opacity: 0.3;
  }

  .login {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    margin: 30vh 24px;
  }
</style>

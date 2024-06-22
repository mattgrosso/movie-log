<template>
  <div class="login">
    <h1 class="col-12 text-center">Welcome to Movie Log</h1>
    <h2 class="col-12 text-center fs-6 mb-5">Please sign in with Google</h2>
    <button @click="login" class="btn btn-primary google-signin-button">
      <i class="bi bi-google me-2"></i>
      Sign in with Google
    </button>
  </div>
</template>

<script>
export default {
  methods: {
    async login () {
      await this.$store.dispatch('login');
    }
  }
}
</script>

<style lang="scss">
  .login {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    margin: 30vh 24px;
  }
</style>
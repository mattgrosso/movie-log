<template>
  <form class="my-5 mx-3">
    <div class="search-inputs input-group mb-3">
      <input
        v-model="value"
        type="text"
        class="form-control"
        placeholder="Search Database"
        aria-label="Search Database"
        aria-describedby="search-database-button"
      >
      <button
        @click.prevent="dBSearch"
        class="btn btn-primary"
        type="submit"
        id="search-database-button"
      >
        <span v-if="value">Search</span>
        <span v-else>Go</span>
      </button>
    </div>
  </form>
</template>

<script>
export default {
  data () {
    return {
      value: ""
    }
  },
  methods: {
    dBSearch () {
      this.$store.commit('setDBSearchValue', this.value);

      this.$router.push('/db-search');
    }
  },
}
</script>

<style>

</style>
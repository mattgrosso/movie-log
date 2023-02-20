<template>
  <form class="my-5 mx-3">
    <div class="mb-3">
      <label for="term" class="form-label">Search Database</label>
      <input type="text" class="form-control" name="term" id="term" v-model="value">
    </div>
    <div class="col-12 d-flex justify-content-end">
      <button @click.prevent="dBSearch" type="submit" value="Search" class="shadow-lg btn btn-primary col-4">
        <span>Search</span>
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
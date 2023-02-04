<template>
  <form class="my-5 mx-3" @submit.prevent="onSubmit" target="_top" method="GET">
    <input type="hidden" name="action" value="search">
    <input type="hidden" name="start" value="0">
    <input type="hidden" name="sort" value="Rating">

    <div class="mb-3">
      <label for="term" class="form-label">Search Database</label>
      <input type="text" class="form-control" name="term" id="term" v-model="value">
    </div>
    <div class="col-12 d-flex justify-content-end">
      <button type="submit" value="Search" class="shadow-lg btn btn-primary col-4">
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
    onSubmit () {
      console.log("Search ratings database and show search page");
    }
  },
}
</script>

<style>

</style>
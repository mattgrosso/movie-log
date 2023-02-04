<template>
  <form class="my-5 mx-3" @submit.prevent="onSubmit" target="_top" method="GET">
    <input type="hidden" name="action" value="entry">

    <div class="mb-3">
      <label for="title" class="form-label">New Entry</label>
      <input type="text" class="form-control" name="title" id="title" v-model="value">
    </div>
    <div class="col-12 d-flex justify-content-end">
      <button type="submit" value="Enter" class="shadow-lg btn btn-primary col-4">
        <span>Enter</span>
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
      console.log("Search for movie and show search entry page");
    }
  }
}
</script>

<style>

</style>
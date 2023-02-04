<template>
  <form class="my-5 mx-3" @submit.prevent="searchTMDB" target="_top" method="GET">
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
import axios from 'axios';

export default {
  data () {
    return {
      value: ""
    }
  },
  methods: {
    async searchTMDB () {
      const resp = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US&query=${this.value}`);
      this.$emit('newEntrySearch', resp.data);
    }
  }
}
</script>

<style>

</style>
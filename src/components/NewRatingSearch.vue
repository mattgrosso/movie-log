<template>
  <form class="new-rating-search my-5 mx-3" @submit.prevent="searchTMDB" target="_top" method="GET">
    <input type="hidden" name="action" value="entry">

    <div class="search-inputs mb-3">
      <label for="title" class="form-label">New Entry</label>
      <input type="text" class="form-control" name="title" id="title" v-model="value">
      <div ref="noResults" class="invalid-feedback">No results found</div> 
    </div>
    <div class="col-12 d-flex justify-content-end">
      <button type="submit" value="Enter" class="shadow-lg btn btn-primary col-4" :class="{disabled: !value}">
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
      if (!this.value) {
        return;
      }

      const resp = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US&query=${this.value}`);

      if (resp.data.results.length) {
        this.$emit('newEntrySearch', resp.data);
      } else {
        this.showNoResultsMessage();
      }
    },
    showNoResultsMessage () {
      this.$refs.noResults.classList.add("show-message");

      setTimeout(() => {
        this.$refs.noResults.classList.remove("show-message");
      }, 3000);
    }
  }
}
</script>

<style lang="scss">
  .new-rating-search {
    .search-inputs {
      position: relative;

      .invalid-feedback {
        &.show-message {
          bottom: -24px;
          display: block;
          left: 12px;
          position: absolute;
        }
      }
    }

  }
</style>
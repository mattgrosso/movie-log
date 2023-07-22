<template>
  <form class="new-rating-search my-5 mx-3" @submit.prevent="searchTMDB" target="_top" method="GET">
    <input type="hidden" name="action" value="entry">
    <div class="search-inputs input-group mb-3">
      <input v-model="value" type="text" class="form-control" placeholder="New Entry" aria-label="New Entry" aria-describedby="new-rating-button">
      <div ref="noResults" class="invalid-feedback">No results found</div>
      <button class="btn btn-primary" :disabled="!value" type="submit" id="new-rating-button">Search</button>
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
  computed: {
    movieOrTV () {
      if (this.$store.state.currentLog === "tvLog") {
        return "tv";
      } else {
        return "movie";
      }
    }
  },
  methods: {
    async searchTMDB () {
      if (!this.value) {
        return;
      }

      const resp = await axios.get(`https://api.themoviedb.org/3/search/${this.movieOrTV}?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US&query=${this.value}`);

      if (resp.data.results.length) {
        this.newEntrySearch(resp.data.results);
      } else {
        this.showNoResultsMessage();
      }
    },
    showNoResultsMessage () {
      this.$refs.noResults.classList.add("show-message");

      setTimeout(() => {
        this.$refs.noResults.classList.remove("show-message");
      }, 3000);
    },
    newEntrySearch (results) {
      this.$store.commit('setNewEntrySearchResults', results)

      this.$router.push(`/pick-media/${this.value}`);
    },
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
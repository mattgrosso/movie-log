<template>
  <div class="no-results">
    <div v-if="suggestionsMode">
      <NewRatingSearch :value="value" :suggestionsMode="true" @clear-search-value="clearValueSearchTypeAndFilterValue" @cancel-suggestions="$emit('cancel-suggestions')"/>
    </div>
    <div v-else-if="hasMedia || value" class="has-media-no-results">
      <NewRatingSearch :value="value" @clear-search-value="clearValueSearchTypeAndFilterValue"/>
    </div>
    <div v-else class="no-movies">
      <p>Search for a {{movieOrTvShow}} in the box above and follow the instructions to add your first {{movieOrTvShow}} rating.</p>
      <p>You can also rate a <a class="btn-link p-0" @click="toggleMovieTV">{{otherMedia}} instead.</a></p>
    </div>
  </div>
</template>

<script>
import NewRatingSearch from './NewRatingSearch.vue';

export default {
  props: {
    value: {
      type: String,
      required: true
    },
    suggestionsMode: {
      type: Boolean,
      default: false
    }
  },
  components: {
    NewRatingSearch
  },
  computed: {
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    hasMedia () {
      return this.$store.getters.allMediaAsArray.length > 0;
    },
    movieOrTvShow () {
      return this.currentLogIsTVLog ? "TV Show" : "movie";
    },
    otherMedia () {
      return this.currentLogIsTVLog ? "movie" : "TV Show";
    }
  },
  methods: {
    toggleMovieTV () {
      this.clearValueSearchTypeAndFilterValue();
      this.$store.dispatch('toggleCurrentLog');
    },
    clearValueSearchTypeAndFilterValue () {
      this.$emit('clearValueSearchTypeAndFilterValue');
    }
  },
};
</script>

<style lang="scss">
  .no-results {
    a {
      cursor: pointer;
    }
  }
</style>
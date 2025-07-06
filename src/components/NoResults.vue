<template>
  <div class="no-results">
    <div v-if="suggestionsMode">
      <NewRatingSearch :value="value" :suggestionsMode="true" @clear-search-value="clearValueSearchTypeAndFilterValue" @start-new-search="startNewSearch" @cancel-suggestions="$emit('cancel-suggestions')"/>
    </div>
    <div v-else-if="hasMedia || value" class="has-media-no-results">
      <NewRatingSearch :value="value" @clear-search-value="clearValueSearchTypeAndFilterValue" @start-new-search="startNewSearch"/>
    </div>
    <div v-else class="no-movies">
      <p>Search for a movie in the box above and follow the instructions to add your first movie rating.</p>
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
    hasMedia () {
      return this.$store.getters.allMediaAsArray.length > 0;
    }
  },
  methods: {
    clearValueSearchTypeAndFilterValue () {
      this.$emit('clearValueSearchTypeAndFilterValue');
    },
    startNewSearch () {
      this.$emit('startNewSearch');
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
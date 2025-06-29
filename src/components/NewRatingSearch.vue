<template>
  <div class="new-rating-search mt-3 mb-4 mx-3">
    <div v-if="suggestionsMode && suggestions && suggestions.length" class="quick-pick">
      <p>Want some help getting started? Rate one of these popular movies:</p>
      <PickMedia :quickPick="true" :mediaList="suggestions" />
      <div class="button-wrapper d-flex justify-content-end gap-2">
        <button class="btn btn-warning" @click="$emit('cancel-suggestions')">Cancel</button>
        <button class="btn btn-primary" @click="fetchSuggestions" id="new-suggestions-button">More suggestions...</button>
      </div>
    </div>
    <div v-else-if="quickPickResults" class="quick-pick">
      <p>Add rating for...</p>
      <PickMedia :quickPick="true"/>
      <div class="button-wrapper d-flex justify-content-end">
        <button class="btn btn-primary" @click="searchTMDB(false)" id="new-rating-button">Show More Results</button>
      </div>
    </div>
    <div v-else-if="noResults" ref="noResults">
      <p>No results found in your Movie Log or on TMDB.</p>
      <p>I'm pretty sure that movie doesn't exist.</p>
      <p>Either you're from the future or maybe you just spelled it wrong.</p>
    </div>
    <div v-else class="d-flex justify-content-center my-5">
      <div class="spinner-border" :class="inDarkMode ? 'text-light' : 'text-dark'" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import debounce from 'lodash/debounce';
import RatingChangeRibbon from './RatingChangeRibbon.vue';
import PickMedia from './PickMedia.vue';

export default {
  components: {
    RatingChangeRibbon,
    PickMedia
  },
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
  data () {
    return {
      quickPickResults: null,
      noResults: false,
      suggestions: [],
      suggestionsPage: 1
    }
  },
  mounted () {
    if (this.suggestionsMode) {
      this.fetchSuggestions();
    } else {
      setTimeout(() => {
        this.searchTMDB(true);
      }, 1000);
    }
  },
  watch: {
    value () {
      if (!this.suggestionsMode) {
        this.searchTMDB(true);
      }
    }
  },
  computed: {
    inDarkMode () {
      return document.querySelector("body").classList.contains('bg-dark');
    },
  },
  methods: {
    async fetchSuggestions () {
      // Fetch popular movies from TMDB
      try {
        const resp = await axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US&page=${this.suggestionsPage}`);
        if (resp.data && resp.data.results && resp.data.results.length) {
          // Get IDs of already rated movies
          const ratedIds = this.$store.getters.allMoviesAsArray.map(m => m.movie.id);
          // Filter out already rated
          let filtered = resp.data.results.filter(movie => !ratedIds.includes(movie.id));
          // Shuffle the filtered array
          for (let i = filtered.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
          }
          this.suggestions = filtered.slice(0, 3);
          this.suggestionsPage = this.suggestionsPage >= resp.data.total_pages ? 1 : this.suggestionsPage + 1;
        }
      } catch (e) {
        this.suggestions = [];
      }
    },
    searchTMDB: debounce(async function (quickPick) {
      if (!this.value) {
        return;
      }
      const resp = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US&query=${this.value}`);
      if (quickPick && resp.data.results.length) {
        this.quickPickEntrySearch(resp.data.results);
      } else if (resp.data.results.length) {
        this.newEntrySearch(resp.data.results);
      } else {
        this.showNoResultsMessage();
      }
    }, 500),
    showNoResultsMessage () {
      this.noResults = true;
      setTimeout(() => {
        this.noResults = false;
        this.$emit('clear-search-value');
      }, 3000);
    },
    quickPickEntrySearch (results) {
      this.$store.commit('setNewEntrySearchResults', results);
      this.quickPickResults = results;
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
    }

    .last-three-shows {
      ul {
        align-items: center;
        display: flex;
        justify-content: center;
        list-style: none;
        margin: 0;
        padding: 0;

        li {
          background-color: white;
          border: 6px solid black;
          box-shadow: 0 0 5px 0 rgba(0,0,0,0.5);
          cursor: pointer;
          margin: 0 12px;
          padding: 6px;
          position: relative;

          img {
            width: 100%;
          }

          .rating-change {
            right: 0;
            position: absolute;
            top: 100%;
            transform: translate(22px, -22px);
          }
        }
      }
    }
  }
</style>
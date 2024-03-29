<template>
  <div class="new-rating-search mt-3 mb-4 mx-3">
    <div v-if="quickPickResults" class="quick-pick">
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
    <div v-if="currentLogIsTVLog && recentlyRatedTVShows.length" class="last-three-shows mt-4">
      <ul>
        <li v-for="(tvShow, index) in recentlyRatedTVShows" :key="index" class="col-3" @click="reRate(tvShow)">
          <img :src="`https://image.tmdb.org/t/p/original${tvShow.poster_path}`" :alt="`${tvShow.name} poster`">
          <RatingChangeRibbon :tvShow="tvShow"/>
        </li>
      </ul>
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
    }
  },
  data () {
    return {
      quickPickResults: null,
      noResults: false
    }
  },
  mounted () {
    setTimeout(() => {
      this.searchTMDB(true);
    }, 1000);
  },
  watch: {
    value () {
      this.searchTMDB(true);
    }
  },
  computed: {
    inDarkMode () {
      return document.querySelector("body").classList.contains('bg-dark');
    },
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    movieOrTV () {
      if (this.currentLogIsTVLog) {
        return "tv";
      } else {
        return "movie";
      }
    },
    recentlyRatedTVShows () {
      return this.$store.state.settings.recentlyRatedTVShows || [];
    },
    tvLog () {
      return this.$store.state.tvLog;
    }
  },
  methods: {
    searchTMDB: debounce(async function (quickPick) {
      console.error('1');
      if (!this.value) {
        console.error('2');
        return;
      }

      const resp = await axios.get(`https://api.themoviedb.org/3/search/${this.movieOrTV}?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US&query=${this.value}`);
      console.error('3');
      if (quickPick && resp.data.results.length) {
        console.error('4');
        this.quickPickEntrySearch(resp.data.results);
      } else if (resp.data.results.length) {
        console.error('5');
        this.newEntrySearch(resp.data.results);
      } else {
        console.error('6');
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
    reRate (tvShow) {
      this.$store.commit('setTVShowToRate', tvShow);
      this.$router.push('/rate-tv-show');
    }
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
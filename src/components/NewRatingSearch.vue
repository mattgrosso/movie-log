<template>
  <form class="new-rating-search mt-5 mx-3" @submit.prevent="searchTMDB" target="_top" method="GET">
    <input type="hidden" name="action" value="entry">
    <div class="search-inputs input-group">
      <input v-model="value" type="text" class="form-control" placeholder="New Entry" aria-label="New Entry" aria-describedby="new-rating-button">
      <div ref="noResults" class="invalid-feedback">No results found</div>
      <button class="btn btn-primary" :disabled="!value" type="submit" id="new-rating-button">Search</button>
    </div>
    <div v-if="currentLogIsTVLog && recentlyRatedTVShows.length" class="last-three-shows my-4">
      <ul>
        <li v-for="(tvShow, index) in recentlyRatedTVShows" :key="index" class="col-3" @click="reRate(tvShow)">
          <img :src="`https://image.tmdb.org/t/p/original${tvShow.poster_path}`" :alt="`${tvShow.name} poster`">
          <RatingChangeRibbon :tvShow="tvShow"/>
        </li>
      </ul>
    </div>
  </form>
</template>

<script>
import axios from 'axios';
import RatingChangeRibbon from './RatingChangeRibbon.vue';

export default {
  components: {
    RatingChangeRibbon
  },
  data () {
    return {
      value: ""
    }
  },
  computed: {
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

      .invalid-feedback {
        &.show-message {
          bottom: -24px;
          display: block;
          left: 12px;
          position: absolute;
        }
      }
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
<template>
  <div class="share-db-results">
    <div class="share-header">
      <img v-if="shareBannerUrl" class="col-12" :src="shareBannerUrl">
      <h1 class="text-light col-12 m-0 px-3 py-2">Movie Log</h1>
    </div>
    <div v-if="shareObject" class="terms d-flex justify-content-start p-3">
      <span class="badge rounded-pill text-bg-dark mx-2">{{shareObject.value}}</span>
      <span class="badge rounded-pill text-bg-dark mx-2">{{shareObject.sortValue}}</span>
      <span class="badge rounded-pill text-bg-dark mx-2">{{shareObject.sortOrder}}</span>
    </div>
    <table
      v-if="filteredResults.length"
      class="table table-hover table-striped"
      :class="useDark ? 'table-dark' : 'table-light'"
    >
      <thead>
        <tr>
          <th scope="col-1">#</th>
          <th scope="col-4">Title</th>
          <th scope="col-4">Release</th>
          <th scope="col-2">Rating</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(result, index) in filteredResults" :key="index">
          <th class="col-1" scope="row">{{index + 1}}</th>
          <td class="col-4">{{result.movie.title}}</td>
          <td class="col-4">{{result.movie.release_date}}</td>
          <td class="col-2">{{parseFloat(mostRecentRating(result).rating).toFixed(2)}}</td>
        </tr>
      </tbody>
    </table>
    <button
      v-if="showMoreButton"
      class="btn btn-secondary mb-5 mx-3 float-end"
      @click="addMoreResults"
    >
      More...
    </button>
  </div>
</template>

<script>
import { getDatabase, ref, child, get } from "firebase/database";
import { useDark } from "@vueuse/core";

export default {
  data () {
    return {
      shareObject: {},
      numberOfResultsToShow: 50,
      useDark: useDark()
    }
  },
  async mounted () {
    this.$store.commit("setShowHeader", false);

    const userDBKey = this.$route.params.userDBKey;
    const shareKey = this.$route.params.shareKey;

    const shareObject = await get(child(ref(getDatabase()), `${userDBKey}/sharedDBSearches/${shareKey}`));
    if (shareObject.exists()) {
      this.shareObject = shareObject.val();
    } else {
      console.error('No share data');
    }
  },
  beforeRouteLeave () {
    this.$store.commit("setShowHeader", true);
  },
  computed: {
    shareBannerUrl () {
      if (this.shareObject.results) {
        return `https://image.tmdb.org/t/p/original${this.shareObject.results[0].movie.backdrop_path}`;
      } else {
        return false;
      }
    },
    filteredResults () {
      if (!this.shareObject.results) {
        return [];
      }

      const filteredResults = this.shareObject.results.filter((result) => result.ratings[0]?.rating);

      return filteredResults.slice(0, this.numberOfResultsToShow);
    },
    showMoreButton () {
      if (!this.shareObject.results) {
        return false;
      }

      return this.shareObject.results.length > this.numberOfResultsToShow;
    }
  },
  methods: {
    mostRecentRating (movie) {
      let mostRecentRating = movie.ratings[0];

      movie.ratings.forEach((rating) => {
        if (!mostRecentRating.date) {
          mostRecentRating = rating;
        } else if (rating.date && rating.date > mostRecentRating.date) {
          mostRecentRating = rating;
        }
      })

      return mostRecentRating;
    },
    addMoreResults () {
      this.numberOfResultsToShow = this.numberOfResultsToShow + 50;

      this.$nextTick(() => {
        window.scrollBy({
          top: 500,
          behavior: 'smooth'
        })
      });
    }
  },
}
</script>

<style lang="scss">
  .share-db-results {
    .share-header {
      position: relative;

      h1 {
        background-color: #000000a3;
        bottom: 0;
        position: absolute;
      }
    }
  }
</style>
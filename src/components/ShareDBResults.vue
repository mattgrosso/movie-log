<template>
  <div class="share-db-results">
    <div class="share-header bg-dark text-light p-3">
      <h1>Movie Log</h1>
    </div>
    <div v-if="shareObject" class="terms d-flex justify-content-start p-3">
      <span class="badge rounded-pill text-bg-dark mx-2">{{shareObject.value}}</span>
      <span class="badge rounded-pill text-bg-dark mx-2">{{shareObject.sortValue}}</span>
      <span class="badge rounded-pill text-bg-dark mx-2">{{shareObject.sortOrder}}</span>
    </div>
    <table v-if="filteredResults.length" class="table table-light table-hover table-striped">
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
import axios from 'axios';

export default {
  data () {
    return {
      shareObject: {},
      numberOfResultsToShow: 50
    }
  },
  async mounted () {
    this.$store.commit("setShowHeader", false);

    const userDBKey = this.$route.params.userDBKey;
    const shareKey = this.$route.params.shareKey;

    const shareObject = await axios.get(
      `https://movie-log-8c4d5-default-rtdb.firebaseio.com/${userDBKey}/sharedDBSearches/${shareKey}.json`
    );

    this.shareObject = shareObject.data;
  },
  beforeRouteLeave () {
    this.$store.commit("setShowHeader", true);
  },
  computed: {
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
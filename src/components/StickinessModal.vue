<template>
  <div v-if="resultsThatNeedStickiness.length && showStickinessModal" class="stickiness">
    <div class="stickiness-notice alert alert-info my-2" role="alert" @click="openModal">
      You have {{ resultsThatNeedStickiness.length }} movies that need stickiness updates.
      <a class="alert-link" @click.stop="openModal">Click to add stickiness.</a>
    </div>
    <Modal :show="showModal" @close="closeModal">
      <template v-slot:header>
        <div class="poster">
          <img class="col-12" :src="`https://image.tmdb.org/t/p/w500${topStructure(firstResult).backdrop_path}`" :alt="topStructure(firstResult).title">
        </div>
      </template>
      <template v-slot:body>
        <div class="col-12 my-3">
          <label class="form-label fs-4 mb-0" for="stickiness">
            <span v-if="showSixMonthMessage">It's been six months now.<br></span>
            <span>How sticky has {{topStructure(firstResult).title}} <span v-if="showSixMonthMessage">really</span> been?</span>
          </label>
          <p v-if="!showSixMonthMessage">Rate how much you've been thinking and talking about the movie since you watched it.</p>
          <p class="rating-change col-12 text-center" :class="{visible: ratingChange || ratingChange === 0}">
            <span v-if="ratingWithoutStickiness === ratingWithStickiness">Your rating didn't change.</span>
            <span v-else>
              Your rating went from
              <span>{{ratingWithoutStickiness}} to {{ratingWithStickiness}}.</span>
            </span>
            <br v-if="rankWithoutStickiness !== rankWithStickiness">
            <span v-if="rankWithoutStickiness - rankWithStickiness > 0" class="positive">
              It went up {{ rankWithoutStickiness - rankWithStickiness }} spots. From {{ rankWithoutStickiness }} to {{ rankWithStickiness }}.
            </span>
            <span v-else-if="rankWithoutStickiness - rankWithStickiness < 0" class="negative">
              It went down {{ rankWithStickiness - rankWithoutStickiness }} spots. From {{ rankWithoutStickiness }} to {{ rankWithStickiness }}.
            </span>
          </p>
          <select class="form-select" name="stickiness" id="stickiness" v-model="stickinessRating">
            <option value="">Rate Stickiness</option>
            <option value="0">
              <span v-if="showSixMonthMessage">0 - Are you sure I watched that?</span>
              <span v-else>0 - I told people to avoid it</span>
            </option>
            <option value="1">
              <span v-if="showSixMonthMessage">1 - I basically forgot about this movie</span>
              <span v-else>1 - I forgot it immediately</span>
            </option>
            <option value="2">
              <span v-if="showSixMonthMessage">2 - I remember it fondly</span>
              <span v-else>2 - I've been mentioning it fondly to people</span>
            </option>
            <option value="3">
              <span v-if="showSixMonthMessage">3 - I think about it often</span>
              <span v-else>3 - I remember it often</span>
            </option>
            <option value="4">
              <span v-if="showSixMonthMessage">4 - I reference it and think about it a lot</span>
              <span v-else>4 - I can't seem to stop thinking about it</span>
            </option>
            <option value="5">
              <span v-if="showSixMonthMessage">5 - It expanded my idea of what movies can be</span>
              <span v-else>5 - It expanded my idea of what movies can be</span>
            </option>
          </select>
        </div>
      </template>
      <template v-slot:footer>
        <div class="stickiness-modal-footer d-flex justify-content-end">
          <button ref="close" type="button" class="btn btn-secondary me-2" @click="closeModal">Close</button>
          <button v-if="submitting" type="button" class="btn btn-primary" disabled>
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          </button>
          <button v-else-if="resultsThatNeedStickiness[1]" type="button" class="btn btn-primary" :disabled="!stickinessRating" @click="addStickinessRating">
            Add Rating and Next
          </button>
          <button v-else type="button" class="btn btn-primary" :disabled="!stickinessRating" @click="addStickinessRating">
            Add Rating
          </button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script>
import { getRating } from "../assets/javascript/GetRating.js";
import cloneDeep from 'lodash/cloneDeep';
import Modal from './Modal.vue';

export default {
  name: "StickinessModal",
  props: {
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    },
    showStickinessModal: {
      type: Boolean,
      required: true
    }
  },
  components: {
    Modal
  },
  data () {
    return {
      showModal: false,
      stickinessRating: "",
      ratingChange: null,
      submitting: false,
    };
  },
  computed: {
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    allMoviesRanked () {
      const movies = [...this.$store.getters.allMoviesAsArray];
      return movies.sort(this.sortByRating);
    },
    hasResultsToRate () {
      return this.resultsThatNeedStickiness.length > 0;
    },
    darkOrLight () {
      const inDarkMode = document.querySelector("body").classList.contains('bg-dark');

      return { 'text-bg-dark': inDarkMode, 'text-bg-light': !inDarkMode };
    },
    resultsThatNeedStickiness () {
      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const hasntReratedStickinessOneWeek = !this.mostRecentRating(result).userAddedStickiness;
        const hasntReratedStickinessSixMonths = !this.mostRecentRating(result).userAddedSixMonthStickiness;
        const ratingDate = this.mostRecentRating(result).date || "1/1/2021";
        const moreThanAWeekAgo = new Date(ratingDate).getTime() < new Date().getTime() - (604800000);
        const moreThanSixMonthsAgo = new Date(ratingDate).getTime() < new Date().getTime() - (15778476000);

        return (hasntReratedStickinessOneWeek && moreThanAWeekAgo) || (hasntReratedStickinessSixMonths && moreThanSixMonthsAgo);
      }).sort((a, b) => {
        const ratingDateA = this.mostRecentRating(a).date || "1/1/2021";
        const ratingDateB = this.mostRecentRating(b).date || "1/1/2021";
        const dateA = new Date(ratingDateA);
        const dateB = new Date(ratingDateB);
        return dateB - dateA;
      });
    },
    firstResult () {
      return this.resultsThatNeedStickiness[0];
    },
    ratingWithoutStickiness () {
      const tempResult = cloneDeep(this.firstResult);

      tempResult.ratings[this.mostRecentRatingIndex].stickiness = null;

      return getRating(this.firstResult).calculatedTotal;
    },
    ratingWithStickiness () {
      if (!this.stickinessRating && this.stickinessRating !== 0 && this.stickinessRating !== "0") {
        return null;
      }

      const tempResult = cloneDeep(this.firstResult);

      tempResult.ratings[this.mostRecentRatingIndex].stickiness = parseFloat(this.stickinessRating);

      return getRating(tempResult).calculatedTotal;
    },
    rankWithoutStickiness () {
      return this.allMoviesRanked.findIndex((movie) => movie.dbKey === this.firstResult.dbKey) + 1;
    },
    rankWithStickiness () {
      const tempResult = cloneDeep(this.firstResult);

      tempResult.ratings[this.mostRecentRatingIndex].stickiness = parseFloat(this.stickinessRating);

      const movies = [...this.$store.getters.allMoviesAsArray];
      const movieIndex = movies.findIndex((movie) => movie.dbKey === this.firstResult.dbKey);
      movies[movieIndex] = tempResult;

      const sortedMovies = movies.sort(this.sortByRating);
      return sortedMovies.findIndex((movie) => movie.dbKey === tempResult.dbKey) + 1;
    },
    mostRecentRatingIndex () {
      let mostRecentRating = this.firstResult.ratings[0];
      let mostRecentRatingIndex = 0;

      this.firstResult.ratings.forEach((rating, index) => {
        const ratingDate = rating.date ? new Date(rating.date).getTime() : 0;
        const mostRecentRatingDate = mostRecentRating.date ? new Date(mostRecentRating.date).getTime() : 0;

        if (!mostRecentRating.date) {
          mostRecentRating = rating;
          mostRecentRatingIndex = index;
        } else if (ratingDate && ratingDate > mostRecentRatingDate) {
          mostRecentRating = rating;
          mostRecentRatingIndex = index;
        }
      })

      return mostRecentRatingIndex;
    },
    showSixMonthMessage () {
      return this.mostRecentRating(this.firstResult).userAddedStickiness;
    }
  },
  methods: {
    openModal () {
      this.showModal = true;
    },
    closeModal () {
      this.showModal = false;
    },
    topStructure (result) {
      if (this.currentLogIsTVLog) {
        return result.tvShow;
      } else {
        return result.movie;
      }
    },
    sortByRating (a, b) {
      const aRating = getRating(a)?.calculatedTotal;
      const bRating = getRating(b)?.calculatedTotal;

      if (aRating < bRating) {
        return 1;
      }
      if (aRating > bRating) {
        return -1;
      }

      return 0;
    },
    addStickinessRating () {
      this.submitting = true;
      this.ratingChange = ((this.ratingWithStickiness - this.ratingWithoutStickiness) / this.ratingWithoutStickiness * 100).toFixed(2);

      let movieWithRating;

      if (!this.firstResult.ratings[this.mostRecentRatingIndex].userAddedStickiness) {
        movieWithRating = {
          ...this.firstResult,
          ratings: {
            ...this.firstResult.ratings,
            [this.mostRecentRatingIndex]: {
              ...this.firstResult.ratings[this.mostRecentRatingIndex],
              rating: this.ratingWithStickiness,
              stickiness: parseFloat(this.stickinessRating),
              userAddedStickiness: true
            }
          }
        };
      } else {
        movieWithRating = {
          ...this.firstResult,
          ratings: {
            ...this.firstResult.ratings,
            [this.mostRecentRatingIndex]: {
              ...this.firstResult.ratings[this.mostRecentRatingIndex],
              rating: this.ratingWithStickiness,
              stickiness: parseFloat(this.stickinessRating),
              userAddedSixMonthStickiness: true
            }
          }
        };
      }

      setTimeout(() => {
        const dbEntry = {
          path: `movieLog/${this.firstResult.dbKey}`,
          value: movieWithRating
        }

        this.$store.dispatch('setDBValue', dbEntry);

        this.submitting = false;
        this.stickinessRating = "";
        this.ratingChange = null;

        if (!this.resultsThatNeedStickiness.length) {
          this.closeModal();
        }
      }, 2000);
    },
    mostRecentRating (media) {
      return getRating(media);
    }
  },
};
</script>

<style lang="scss">
.stickiness {
  .alert-link {
    cursor: pointer;
  }

  .cinemaroll-modal {
    .cinemaroll-modal-content {
      height: fit-content;

      @media screen and (min-width: 832px) {
        height: fit-content;
        max-height: 100vh;
      }
    }
  }

  .rating-change {
    font-size: 0.75rem;
    min-height: 100px;
    opacity: 0;
    padding: 12px;
    transition: none;

    &.visible {
      opacity: 1;
      transition: opacity 0.5s;
    }

    span {
      color: white;
      font-size: 1rem;

      &.negative {
        color: red;
      }

      &.positive {
        color: green;
      }
    }
  }
}
</style>
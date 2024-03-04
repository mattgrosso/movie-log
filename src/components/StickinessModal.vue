<template>
  <div v-if="hasResultsToRate" class="stickiness">
    <div class="stickiness-notice alert alert-info" role="alert">
      You have {{ resultsThatNeedStickiness.length }} movies without stickiness ratings.
      <a class="alert-link" data-bs-toggle="modal" data-bs-target="#stickinessModal">Click to add stickiness.</a>
    </div>
    <div class="modal fade" id="stickinessModal" tabindex="-1" aria-labelledby="stickinessModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content" :class="darkOrLight">
          <div class="modal-body">
            <div class="poster">
              <img class="col-12" :src="`https://image.tmdb.org/t/p/original${firstResult.movie.backdrop_path}`" :alt="firstResult.movie.title">
            </div>
            <div class="col-12 my-3">
              <label class="form-label fs-4 mb-0" for="impression">How sticky has {{firstResult.movie.title}} been?</label>
              <p>Rate how much you've been thinking and talking about the movie since you watched it.</p>
              <select class="form-select" name="impression" id="impression" v-model="stickinessRating">
                <option value="">Rate Stickiness</option>
                <option value="0">
                  0 - I told people to avoid it
                </option>
                <option value="1">
                  1 - I forgot it immediately
                </option>
                <option value="2">
                  2 - I mentioned it to people
                </option>
                <option value="3">
                  3 - I remember it often
                </option>
                <option value="4">
                  4 - I think about it all the time
                </option>
                <option value="5">
                  5 - It changed the way I think
                </option>
              </select>
            </div>
            <p class="rating-change col-12 text-center" :class="{visible: ratingChange || ratingChange === 0}">
              Your rating for {{firstResult.movie.title}} changed by <span :class="{negative: ratingChange < 0, positive: ratingChange >= 0}">{{ratingChange}}%</span>
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
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
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getRating } from "../assets/javascript/GetRating.js";
import cloneDeep from 'lodash/cloneDeep';

export default {
  name: "StickinessModal",
  props: {
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    }
  },
  watch: {
    hasResultsToRate (newVal) {
      if (!newVal) {
        document.querySelector("#stickinessModal").classList.remove("show");
        document.querySelector(".modal-backdrop").remove();
        document.querySelector("body").classList.remove("modal-open");
        document.querySelector("body").style = "";
      }
    }
  },
  data () {
    return {
      stickinessRating: "",
      ratingChange: null,
      submitting: false
    };
  },
  computed: {
    hasResultsToRate () {
      return this.resultsThatNeedStickiness.length > 0;
    },
    darkOrLight () {
      const inDarkMode = document.querySelector("body").classList.contains('bg-dark');

      return { 'text-bg-dark': inDarkMode, 'text-bg-light': !inDarkMode };
    },
    resultsThatNeedStickiness () {
      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const doesntHaveStickiness = !this.mostRecentRating(result).userAddedStickiness;
        const ratingDate = this.mostRecentRating(result).date || "1/1/2021";
        const moreThanAWeekAgo = new Date(ratingDate).getTime() < new Date().getTime() - (604800000);

        return doesntHaveStickiness && moreThanAWeekAgo;
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
    }
  },
  methods: {
    addStickinessRating () {
      this.submitting = true;
      this.ratingChange = ((this.ratingWithStickiness - this.ratingWithoutStickiness) / this.ratingWithoutStickiness * 100).toFixed(2);

      const movieWithRating = {
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

      setTimeout(() => {
        const dbEntry = {
          path: `movieLog/${this.firstResult.dbKey}`,
          value: movieWithRating
        }

        this.$store.dispatch('setDBValue', dbEntry);

        this.submitting = false;
        this.stickinessRating = "";
        this.ratingChange = null;
      }, 1000);
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

  .modal {
    .rating-change {
      font-size: 0.75rem;
      opacity: 0;
      transition: none;

      &.visible {
        opacity: 1;
        transition: opacity 0.5s;
      }

      span {
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
}
</style>
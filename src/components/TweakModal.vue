<template>
  <div class="tweak-modal">
    <div class="stickiness-notice alert alert-info my-2" role="alert">
      You have a tie to deal with.
      <a class="alert-link" data-bs-toggle="modal" data-bs-target="#tweakModal">Click to break the tie.</a>
    </div>
    <div class="modal fade" id="tweakModal" tabindex="-1" aria-labelledby="tweakModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content" :class="darkOrLight">
          <div class="modal-body row d-flex justify-content-center flex-wrap">
            <div class="poster first-movie col">
              <img class="col-12" :src="`https://image.tmdb.org/t/p/original${topStructure(firstResult).poster_path}`" :alt="topStructure(firstResult).title">
            </div>
            <div class="poster second-movie col">
              <img class="col-12" :src="`https://image.tmdb.org/t/p/original${topStructure(secondResult).poster_path}`" :alt="topStructure(secondResult).title">
            </div>
          </div>
          <div class="modal-footer row pt-3 pb-4">
            <h5 class="modal-title mb-3 d-flex justify-content-center" id="tweakModalLabel">Break the Tie</h5>
            <div class="col">
              <button type="button" class="btn btn-primary w-100" @click="firstResultWins">
                {{topStructure(firstResult).title}}
              </button>
            </div>
            <div class="col-1 d-flex justify-content-center">or</div>
            <div class="col">
              <button type="button" class="btn btn-primary w-100" @click="secondResultWins">
                {{topStructure(secondResult).title}}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getRating } from "../assets/javascript/GetRating.js";

export default {
  name: "tweakModal",
  props: {
    showTweakModal: {
      type: Boolean,
      required: false,
      default: false
    },
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    }
  },
  data () {
    return {
      stickinessRating: "",
      ratingChange: null,
      submitting: false
    };
  },
  watch: {
    showTweakModal (newVal) {
      if (!newVal) {
        document.querySelector("#tweakModal").classList.remove("show");
        document.querySelector(".modal-backdrop").remove();
        document.querySelector("body").classList.remove("modal-open");
        document.querySelector("body").style = "";
      }
    }
  },
  computed: {
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    allMoviesRanked () {
      const movies = [...this.$store.getters.allMoviesAsArray];
      return movies.sort(this.sortByRating);
    },
    darkOrLight () {
      const inDarkMode = document.querySelector("body").classList.contains('bg-dark');

      return { 'text-bg-dark': inDarkMode, 'text-bg-light': !inDarkMode };
    },
    firstTiedResults () {
      const firstTiedPairIndex = this.allMoviesRanked.findIndex((movie, index) => {
        const nextMovie = this.allMoviesRanked[index + 1];

        if (!nextMovie) {
          return false;
        }

        return getRating(movie).calculatedTotal === getRating(nextMovie).calculatedTotal;
      });

      if (firstTiedPairIndex === -1) {
        return [];
      }

      return [this.allMoviesRanked[firstTiedPairIndex], this.allMoviesRanked[firstTiedPairIndex + 1]];
    },
    firstResult () {
      return this.firstTiedResults[0];
    },
    secondResult () {
      return this.firstTiedResults[1];
    },
    firstResultTweakValue () {
      return this.firstResult.ratings[this.mostRecentRatingIndex(this.firstResult)].tweakValue || 0;
    },
    secondResultTweakValue () {
      return this.secondResult.ratings[this.mostRecentRatingIndex(this.secondResult)].tweakValue || 0;
    },
  },
  methods: {
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
    mostRecentRatingIndex (result) {
      let mostRecentRating = result.ratings[0];
      let mostRecentRatingIndex = 0;

      result.ratings.forEach((rating, index) => {
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
    firstResultWins () {
      // Because the first result won, we are going to reduce the overall score of second result.
      this.submitting = true;

      const movieWithRating = {
        ...this.secondResult,
        ratings: this.secondResult.ratings.slice().map((rating, index) => {
          if (index === this.mostRecentRatingIndex(this.secondResult)) {
            return {
              ...rating,
              tweakValue: this.secondResultTweakValue - 0.1,
              userTweaked: true
            };
          }
          return rating;
        })
      };

      const dbEntry = {
        path: `movieLog/${this.secondResult.dbKey}`,
        value: movieWithRating
      }

      this.$store.dispatch('setDBValue', dbEntry);
      this.$store.dispatch('setDBValue', {
        path: 'settings/lastTweak',
        value: Date.now()
      });

      this.hideModalBackdrop();
      this.submitting = false;
    },
    secondResultWins () {
      // Because the second result won, we are going to reduce the overall score of first result.
      this.submitting = true;

      const movieWithRating = {
        ...this.firstResult,
        ratings: this.firstResult.ratings.slice().map((rating, index) => {
          if (index === this.mostRecentRatingIndex(this.firstResult)) {
            return {
              ...rating,
              tweakValue: this.firstResultTweakValue - 0.1,
              userTweaked: true
            };
          }
          return rating;
        })
      };

      const dbEntry = {
        path: `movieLog/${this.firstResult.dbKey}`,
        value: movieWithRating
      }

      this.$store.dispatch('setDBValue', dbEntry);
      this.$store.dispatch('setDBValue', {
        path: 'settings/lastTweak',
        value: Date.now()
      });

      this.hideModalBackdrop();
      this.submitting = false;
    },
    hideModalBackdrop () {
      document.querySelector("#tweakModal").classList.remove("show");
      document.querySelector(".modal-backdrop").remove();
      document.querySelector("body").classList.remove("modal-open");
      document.querySelector("body").style = "";
    }
  },
};
</script>

<style lang="scss">
.tweak-modal {
  .alert-link {
    cursor: pointer;
  }

  .modal {
    .modal-footer {
      .col {
        &:nth-child(2) {
          .btn {
            border: none;
            background-color: #1D8BF1; /* Medium Blue */
            color: white;
          }
        }

        &:nth-child(4) {
          .btn {
            border: none;
            background-color: #FFD700; /* Yellow */
            color: black;
          }
        }
      }
    }
  }
}
</style>
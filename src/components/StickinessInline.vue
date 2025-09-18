<template>
  <div v-if="showStickinessModal && resultsThatNeedStickiness.length" class="stickiness-inline">
    <!-- Single container that changes its content -->
    <Transition name="stickiness-expand" mode="out-in">
      <!-- Prompt -->
      <div v-if="!showStickinessInline" key="notice" class="stickiness-container rounded p-3 mb-3" @click="toggleStickinessInline">
        <div class="stickiness-notice-content">
          You have {{ resultsThatNeedStickiness.length }} movies that need stickiness updates.
          <a class="alert-link" @click.stop="toggleStickinessInline">Click to add stickiness.</a>
        </div>
      </div>

      <!-- Inline Content -->
      <div v-else key="form" class="stickiness-container rounded p-3 mb-3">
        <!-- Top section: Centered poster -->
        <div class="text-center mb-3">
          <img
            class="rounded"
            :src="`https://image.tmdb.org/t/p/w500${topStructure(firstStickinessResult).poster_path}`"
            :alt="topStructure(firstStickinessResult).title"
            style="width: 120px; height: 180px; object-fit: cover;"
          >
        </div>

        <!-- Description text with conditional wording -->
        <div class="mb-3">
          <p v-if="!showSixMonthMessage" class="text-light mb-0">Rate how much you've been thinking and talking about {{ topStructure(firstStickinessResult).title }} since you watched it.</p>
          <p v-else class="text-light mb-0">Rate how much you've been thinking and talking about {{ topStructure(firstStickinessResult).title }} in the past 6 months.</p>
        </div>

        <!-- Rating change preview (always takes space) -->
        <div class="rating-preview alert py-2 mb-3 text-center"
             :class="{
               invisible: !stickinessRating || !ratingWithStickiness,
               'alert-success': stickinessRating && ratingWithStickiness && ratingWithStickiness > ratingWithoutStickiness,
               'alert-danger': stickinessRating && ratingWithStickiness && ratingWithStickiness < ratingWithoutStickiness,
               'alert-info': stickinessRating && ratingWithStickiness && ratingWithStickiness === ratingWithoutStickiness
             }">
          <small>
            <span v-if="ratingWithoutStickiness === ratingWithStickiness">Your rating won't change.</span>
            <span v-else>
              Rating: {{ ratingWithoutStickiness }} → <strong>{{ ratingWithStickiness }}</strong>
              <span v-if="rankWithoutStickiness !== rankWithStickiness" class="ms-2">
                (Rank: {{ rankWithoutStickiness }} → {{ rankWithStickiness }})
              </span>
            </span>
          </small>
        </div>

        <!-- Form section -->
        <div class="rating-interface">
          <!-- Stickiness selector -->
          <select class="form-select mb-3 stickiness-select" name="stickiness-inline" id="stickiness-inline" v-model="stickinessRating">
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

          <!-- Action buttons -->
          <div class="d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-secondary" @click="closeStickinessInline">Close</button>
            <button v-if="submittingStickiness" type="button" class="btn btn-primary" disabled>
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
    </Transition>
  </div>
</template>

<script>
import { getRating } from "../assets/javascript/GetRating.js";
import cloneDeep from 'lodash/cloneDeep';

export default {
  name: "StickinessInline",
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
  emits: ['stickiness-updated'],
  data() {
    return {
      showStickinessInline: false,
      stickinessRating: "",
      submittingStickiness: false
    }
  },
  computed: {
    currentLogIsTVLog() {
      return this.$store.state.currentLog === "tvLog";
    },
    allMoviesRanked() {
      const movies = [...this.$store.getters.allMoviesAsArray];
      return movies.sort(this.sortByRating);
    },
    resultsThatNeedStickiness() {
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
    firstStickinessResult() {
      return this.resultsThatNeedStickiness[0];
    },
    ratingWithoutStickiness() {
      if (!this.firstStickinessResult) return null;
      const tempResult = cloneDeep(this.firstStickinessResult);
      tempResult.ratings[this.mostRecentRatingIndex].stickiness = null;
      return getRating(this.firstStickinessResult).calculatedTotal;
    },
    ratingWithStickiness() {
      if (!this.stickinessRating && this.stickinessRating !== 0 && this.stickinessRating !== "0") {
        return null;
      }
      if (!this.firstStickinessResult) return null;
      const tempResult = cloneDeep(this.firstStickinessResult);
      tempResult.ratings[this.mostRecentRatingIndex].stickiness = parseFloat(this.stickinessRating);
      return getRating(tempResult).calculatedTotal;
    },
    rankWithoutStickiness() {
      if (!this.firstStickinessResult) return null;
      return this.allMoviesRanked.findIndex((movie) => movie.dbKey === this.firstStickinessResult.dbKey) + 1;
    },
    rankWithStickiness() {
      if (!this.stickinessRating || !this.firstStickinessResult) return null;
      const tempResult = cloneDeep(this.firstStickinessResult);
      tempResult.ratings[this.mostRecentRatingIndex].stickiness = parseFloat(this.stickinessRating);
      const movies = [...this.$store.getters.allMoviesAsArray];
      const movieIndex = movies.findIndex((movie) => movie.dbKey === this.firstStickinessResult.dbKey);
      movies[movieIndex] = tempResult;
      const sortedMovies = movies.sort(this.sortByRating);
      return sortedMovies.findIndex((movie) => movie.dbKey === tempResult.dbKey) + 1;
    },
    mostRecentRatingIndex() {
      if (!this.firstStickinessResult) return 0;
      let mostRecentRating = this.firstStickinessResult.ratings[0];
      let mostRecentRatingIndex = 0;

      this.firstStickinessResult.ratings.forEach((rating, index) => {
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
    showSixMonthMessage() {
      if (!this.firstStickinessResult) return false;
      return this.mostRecentRating(this.firstStickinessResult).userAddedStickiness;
    }
  },
  methods: {
    toggleStickinessInline() {
      this.showStickinessInline = true;
    },
    closeStickinessInline() {
      this.showStickinessInline = false;
      this.stickinessRating = "";
    },
    topStructure(result) {
      if (this.currentLogIsTVLog) {
        return result.tvShow;
      } else {
        return result.movie;
      }
    },
    sortByRating(a, b) {
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
    addStickinessRating() {
      this.submittingStickiness = true;

      let movieWithRating;

      if (!this.firstStickinessResult.ratings[this.mostRecentRatingIndex].userAddedStickiness) {
        movieWithRating = {
          ...this.firstStickinessResult,
          ratings: {
            ...this.firstStickinessResult.ratings,
            [this.mostRecentRatingIndex]: {
              ...this.firstStickinessResult.ratings[this.mostRecentRatingIndex],
              rating: this.ratingWithStickiness,
              stickiness: parseFloat(this.stickinessRating),
              userAddedStickiness: true
            }
          }
        };
      } else {
        movieWithRating = {
          ...this.firstStickinessResult,
          ratings: {
            ...this.firstStickinessResult.ratings,
            [this.mostRecentRatingIndex]: {
              ...this.firstStickinessResult.ratings[this.mostRecentRatingIndex],
              rating: this.ratingWithStickiness,
              stickiness: parseFloat(this.stickinessRating),
              userAddedSixMonthStickiness: true
            }
          }
        };
      }

      setTimeout(() => {
        const dbEntry = {
          path: `movieLog/${this.firstStickinessResult.dbKey}`,
          value: movieWithRating
        }

        this.$store.dispatch('setDBValue', dbEntry);

        this.submittingStickiness = false;
        this.stickinessRating = "";

        // Emit event to parent to update data
        this.$emit('stickiness-updated');

        if (!this.resultsThatNeedStickiness.length) {
          this.closeStickinessInline();
        }
      }, 2000);
    },
    mostRecentRating(media) {
      return getRating(media);
    }
  }
}
</script>

<style lang="scss" scoped>
// Stickiness inline animation
.stickiness-expand-enter-active,
.stickiness-expand-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.stickiness-expand-enter-from {
  opacity: 0;
}

.stickiness-expand-enter-to {
  opacity: 1;
}

.stickiness-expand-leave-from {
  opacity: 1;
}

.stickiness-expand-leave-to {
  opacity: 0;
}

// Stickiness content styling
.stickiness-inline {
  .stickiness-container {
    background: #4a4a4a;
    border: 1px solid #666;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition: all 0.2s ease;

    .stickiness-notice-content {
      color: #fff;

      .alert-link {
        cursor: pointer;
        text-decoration: none;
        color: #fff;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    // Remove cursor pointer when showing form
    &:has(.rating-interface) {
      cursor: default;
    }
  }

  .rating-preview {
    // Let Bootstrap alert classes handle colors
    small {
      font-weight: 500;
    }
  }
}

/* Stickiness form controls styling */
.stickiness-select {
  background-color: var(--bs-light) !important;
  border-color: var(--bs-secondary) !important;
  color: var(--bs-dark) !important;
}

.stickiness-select option {
  background-color: var(--bs-light) !important;
  color: var(--bs-dark) !important;
}
</style>
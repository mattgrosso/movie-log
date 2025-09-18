<template>
  <div v-if="firstTiedResults.length && showTweakModal" class="tweak-inline">
    <!-- Single container that changes its content -->
    <Transition name="tweak-expand" mode="out-in">
      <!-- Prompt -->
      <div v-if="!showTweakInline" key="notice" class="tweak-container rounded p-3 mb-3" @click="toggleTweakInline">
        <div class="tweak-notice-content">
          You have a tie to deal with.
          <a class="alert-link" @click.stop="toggleTweakInline"><br/>Click to break the tie.</a>
        </div>
      </div>

      <!-- Inline Content -->
      <div v-else key="form" class="tweak-container rounded p-3 mb-3">
        <!-- Title -->
        <div class="text-center mb-3">
          <h5 class="text-light mb-0">Break the Tie</h5>
        </div>

        <!-- Two posters side by side -->
        <div class="d-flex justify-content-center gap-4">
          <div class="poster-container text-center" @click="firstResultWins">
            <div class="poster-wrapper">
              <img
                class="rounded poster-image"
                :src="`https://image.tmdb.org/t/p/w500${topStructure(firstResult).poster_path}`"
                :alt="topStructure(firstResult).title"
              >
            </div>
          </div>

          <div class="vs-divider d-flex align-items-center">
            <span class="text-light">vs</span>
          </div>

          <div class="poster-container text-center" @click="secondResultWins">
            <div class="poster-wrapper">
              <img
                class="rounded poster-image"
                :src="`https://image.tmdb.org/t/p/w500${topStructure(secondResult).poster_path}`"
                :alt="topStructure(secondResult).title"
              >
            </div>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="submitting" class="text-center">
          <span class="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></span>
          <span class="text-light ms-2">Processing...</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script>
import { getRating } from "../assets/javascript/GetRating.js";

export default {
  name: "TweakInline",
  props: {
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    },
    showTweakModal: {
      type: Boolean,
      required: true
    }
  },
  emits: ['tweak-updated'],
  data() {
    return {
      showTweakInline: false,
      submitting: false
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
    firstTiedResults() {
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
    firstResult() {
      return this.firstTiedResults[0];
    },
    secondResult() {
      return this.firstTiedResults[1];
    },
    firstResultTweakValue() {
      if (!this.firstResult) return 0;
      return this.firstResult.ratings[this.mostRecentRatingIndex(this.firstResult)].tweakValue || 0;
    },
    secondResultTweakValue() {
      if (!this.secondResult) return 0;
      return this.secondResult.ratings[this.mostRecentRatingIndex(this.secondResult)].tweakValue || 0;
    }
  },
  methods: {
    toggleTweakInline() {
      this.showTweakInline = true;
    },
    closeTweakInline() {
      this.showTweakInline = false;
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
    mostRecentRatingIndex(result) {
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
    firstResultWins() {
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

      this.submitting = false;
      this.closeTweakInline();

      // Emit event to parent to update data
      this.$emit('tweak-updated');
    },
    secondResultWins() {
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

      this.submitting = false;
      this.closeTweakInline();

      // Emit event to parent to update data
      this.$emit('tweak-updated');
    }
  }
}
</script>

<style lang="scss" scoped>
// Tweak inline animation
.tweak-expand-enter-active,
.tweak-expand-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.tweak-expand-enter-from {
  opacity: 0;
}

.tweak-expand-enter-to {
  opacity: 1;
}

.tweak-expand-leave-from {
  opacity: 1;
}

.tweak-expand-leave-to {
  opacity: 0;
}

// Tweak content styling
.tweak-inline {
  .tweak-container {
    background: #4a4a4a;
    border: 1px solid #666;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition: all 0.2s ease;

    .tweak-notice-content {
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
    &:has(.poster-container) {
      cursor: default;
    }
  }

  .poster-container {
    cursor: pointer;
    transition: transform 0.2s ease;

    &:hover {
      transform: scale(1.05);
    }

    .poster-wrapper {
      position: relative;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      overflow: hidden;
      transition: border-color 0.2s ease;

      &:hover {
        border-color: rgba(255, 255, 255, 0.6);
      }
    }

    .poster-image {
      width: 120px;
      height: 180px;
      object-fit: cover;
      display: block;
    }
  }

  .vs-divider {
    font-size: 1.2rem;
    font-weight: bold;
    opacity: 0.7;
  }

  .btn {
    min-width: 120px;
  }
}
</style>
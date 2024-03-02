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
                  1 - I forgot it immediately
                </option>
                <option value="1">
                  2 - I mentioned it to people
                </option>
                <option value="2">
                  3 - I remember it often
                </option>
                <option value="4">
                  4 - I think about it all the time
                </option>
                <option value="10">
                  5 - It changed the way I think
                </option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button v-if="resultsThatNeedStickiness[1]" type="button" class="btn btn-primary" :disabled="!stickinessRating" @click="addStickinessRating">Add Rating and Next</button>
            <button v-else type="button" class="btn btn-primary" :disabled="!stickinessRating" @click="addStickinessRating">Add Rating</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getRating } from "../assets/javascript/GetRating.js";

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
      stickinessRating: ""
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
        const doesntHaveStickiness = !this.mostRecentRating(result).stickiness;
        const ratingDate = this.mostRecentRating(result).date || "1/1/2021";
        const moreThanAWeekAgo = new Date(ratingDate).getTime() < new Date().getTime() - 604800000;

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
    rating () {
      if (!this.stickinessRating) {
        return getRating(this.firstResult).calculatedTotal;
      }

      const tempResult = {
        ...this.firstResult,
        ratings: [
          ...this.firstResult.ratings
        ]
      }

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
      const movieWithRating = {
        ...this.firstResult,
        ratings: {
          ...this.firstResult.ratings,
          [this.mostRecentRatingIndex]: {
            ...this.firstResult.ratings[this.mostRecentRatingIndex],
            rating: this.rating,
            stickiness: parseFloat(this.stickinessRating),
          }
        }
      };

      const dbEntry = {
        path: `movieLog/${this.firstResult.dbKey}`,
        value: movieWithRating
      }

      this.$store.dispatch('setDBValue', dbEntry);
      this.stickinessRating = "";
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
}
</style>
<template>
  <div class="toggleable-rating" @click="cycleVisibleRatingType">
    <div v-if="visibleRatingType === 'rating'" class="rating">
      <h3 class="m-0">{{ displayRating }}</h3>
      <!-- The rank sits exactly where "(normalized rating)" sits, and is
           deliberately NOT a link or a button. Bug report 2026-08-25: "The
           whole score is a button that toggles itself between score,
           normalized, stars. So I don't want be accidentally clicking a link
           while I'm trying to toggle." A tap here falls through to the
           toggle like a tap anywhere else on the control. -->
      <label v-if="rankLabel">({{ rankLabel }})</label>
    </div>
    <div v-else-if="visibleRatingType === 'normalizedRating'" class="normalized-rating">
      <h3 class="m-0">{{ displayNormalizedRating }}</h3>
      <label @click.stop="cycleVisibleRatingType">(normalized rating)</label>
    </div>
    <div v-else-if="visibleRatingType === 'stars'" class="stars">
      <div v-if="hasAnyStars" class="has-stars">
        <i v-for="i in fullStars" :key="i" class="bi bi-star-fill"/>
        <i v-if="hasHalfStar" class="bi bi-star-half"/>
      </div>
      <div v-else class="no-stars">
        <i class="bi bi-star"/>
        <i class="bi bi-slash-lg"/>
      </div>
    </div>
  </div>
</template>

<script>
import { formatScore, formatNormalizedScore } from '../assets/javascript/formatScore.js';

export default {
  name: 'ToggleableRating',
  // Which of the three views is showing. MovieDetail uses it to show the
  // overall rank ONLY beside the precise score — a rank next to a star
  // rating or a normalized score is answering a question nobody asked.
  emits: ['typeChanged'],
  props: {
    rating: {
      type: Number,
      required: true
    },
    normalizedRating: {
      type: Number,
      required: true
    },
    // Already-ordinalised ("412th"). Shown only beside the precise score — a
    // rank next to a star rating is answering a question nobody asked.
    rankLabel: {
      type: String,
      default: ''
    }
  },
  data () {
    return {
      visibleRatingType: 'rating'
    }
  },
  mounted () {
    this.$emit('typeChanged', this.visibleRatingType);
  },
  watch: {
    visibleRatingType (type) {
      this.$emit('typeChanged', type);
    }
  },
  computed: {
    // Formatted at the point of display only. The props stay numeric because
    // the star maths below divides them — rounding first would move half-stars
    // around. Scores are computed to four decimals and shown at two, and this
    // component is handed `calculatedTotal` as a prop, which is how it slipped
    // past the guard in scorePrecision.test.js and printed 8.4372 on the
    // detail page (bug report 2026-08-25).
    displayRating () {
      return formatScore(this.rating);
    },
    // Whole numbers, not two decimals — the normalized score is rounded at
    // source (see formatNormalizedScore). The prop stays numeric because
    // starCount below divides it.
    displayNormalizedRating () {
      return formatNormalizedScore(this.normalizedRating);
    },
    starCount () {
      return this.normalizedRating / 2;
    },
    fullStars () {
      return Math.floor(this.starCount);
    },
    hasHalfStar () {
      return this.starCount % 1 !== 0;
    },
    hasAnyStars () {
      return this.starCount > 0;
    }
  },
  methods: {
    cycleVisibleRatingType () {
      switch (this.visibleRatingType) {
        case 'rating':
          this.visibleRatingType = 'normalizedRating';
          break;
        case 'normalizedRating':
          this.visibleRatingType = 'stars';
          break;
        case 'stars':
          this.visibleRatingType = 'rating';
          break;
      }
    }
  },
};
</script>

<style lang="scss">
  .toggleable-rating {
    cursor: pointer;
    display: flex;
    font-size: 1.25rem;
    height: 36px;
    justify-content: flex-end;
    min-width: 100px;
    position: relative;

    .stars {
      color: #f8d62b;

      .no-stars {
        position: relative;

        .bi-slash-lg {
          color: #f8d62b;
          left: 0;
          position: absolute;
          top: 0;
        }
      }
    }

    /* One placement, two users: the rank parenthetical is meant to sit
       exactly where "(normalized rating)" sits, so they share the rule
       rather than being lined up by eye and drifting apart. */
    .rating,
    .normalized-rating {
      display: flex;
      position: relative;

      label {
        align-items: center;
        cursor: pointer;
        display: flex;
        font-size: 0.5rem;
        margin-left: 0.25rem;
        position: absolute;
        bottom: -5px;
        white-space: nowrap;
        right: 0;
      }
    }
  }
</style>
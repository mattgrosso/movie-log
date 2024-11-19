<template>
  <div class="toggleable-rating" @click="cycleVisibleRatingType">
    <div v-if="visibleRatingType === 'rating'" class="rating">
      <h3 class="m-0">{{ rating }}</h3>
    </div>
    <div v-else-if="visibleRatingType === 'normalizedRating'" class="normalized-rating">
      <h3 class="m-0">{{ normalizedRating }}</h3>
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
export default {
  name: 'ToggleableRating',
  props: {
    rating: {
      type: Number,
      required: true
    },
    normalizedRating: {
      type: Number,
      required: true
    }
  },
  data () {
    return {
      visibleRatingType: 'rating'
    }
  },
  computed: {
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
<template>
  <div
    class="rating-change-ribbon"
    :class="{positive: rankChange > 0, negative: rankChange < 0, neutral: rankChange == 0}"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-award-fill" viewBox="0 0 16 16">
      <path d="m8 0 1.669.864 1.858.282.842 1.68 1.337 1.32L13.4 6l.306 1.854-1.337 1.32-.842 1.68-1.858.282L8 12l-1.669-.864-1.858-.282-.842-1.68-1.337-1.32L2.6 6l-.306-1.854 1.337-1.32.842-1.68L6.331.864 8 0z"/>
      <path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1 4 11.794z"/>
    </svg>
    <div class="number">
      <span class="plus">+</span>
      <span>{{ rankChange }}</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    tvShow: {
      type: Object,
      required: true,
    },
  },
  computed: {
    rankChange () {
      const sorted = this.$store.getters.allMediaSortedByRating;
      const entryWithRatings = sorted.find((tvShow) => tvShow.tvShow.id === this.tvShow.id);
      const previousRanking = entryWithRatings?.ratings.tvShow.previousRanking ? entryWithRatings.ratings.tvShow.previousRanking : sorted.length;
      const currentRanking = sorted.findIndex((tvShow) => tvShow.tvShow.id === this.tvShow.id) + 1;

      return previousRanking - currentRanking;
    }
  },
};
</script>

<style lang="scss">
  .rating-change-ribbon {
    position: absolute;

    &.positive {
      color: green;

      .number {
        .plus {
          display: block;
        }
      }
    }

    &.neutral {
      color: #fae150;

      .number {
        color: black;

        .plus {
          display: block;
        }
      }
    }

    &.negative {
      color: red;

      .number {
        .minus {
          display: block;
        }
      }
    }

    svg {
      height: 45px;
      width: 45px;

      path {
        stroke: #ffffff;
        stroke-width: 0.25px;
      }
    }

    .number {
      font-size: 12px;
      color: white;
      position: absolute;
      top: 50%;
      transform: translate(-50%, -16px);
      line-height: 20px;
      left: 50%;
      display: flex;
      justify-content: center;
      align-items: center;

      .plus,
      .minus {
        display: none;
      }

      span {
        display: block;
        line-height: 20px;
      }
    }
  }
</style>
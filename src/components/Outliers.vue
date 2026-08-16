<template>
  <div class="outliers">
    <div class="outlier-card">
      <p class="outlier-card-title">You love these more than most things</p>
      <ul>
        <li v-for="item in outliers.loved" :key="`${item.type}-${item.name}`" class="outlier-row" @click="updateSearchValue(item.name)">
          <span class="outlier-name"><span class="outlier-type">{{ item.type }}</span>{{ item.name }}</span>
          <span class="outlier-numbers">{{ item.average.toFixed(2) }} <span class="outlier-count">· {{ item.count }} films</span></span>
        </li>
      </ul>
    </div>
    <div class="outlier-card">
      <p class="outlier-card-title">You're hardest on these</p>
      <ul>
        <li v-for="item in outliers.hardest" :key="`${item.type}-${item.name}`" class="outlier-row" @click="updateSearchValue(item.name)">
          <span class="outlier-name"><span class="outlier-type">{{ item.type }}</span>{{ item.name }}</span>
          <span class="outlier-numbers">{{ item.average.toFixed(2) }} <span class="outlier-count">· {{ item.count }} films</span></span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
// Reworked 2026-08-15 (Matt: "I don't even remember how I made it or what
// it means"). The old SD-threshold slider is gone; two fixed cards show
// what you rate unusually high/low vs your library average, with film
// counts and a minimum-count floor so tiny samples can't fake
// significance. Math in ratingOutliers.js.
import { getRating } from "../assets/javascript/GetRating.js";
import { tasteOutliers } from "../assets/javascript/ratingOutliers.js";

export default {
  name: "Outliers",
  props: {
    resultsWithRatings: {
      type: Array,
      required: true
    },
    allCounts: {
      type: Object,
      required: false,
      default: null
    }
  },
  emits: ['updateSearchValue'],
  computed: {
    outliers () {
      return tasteOutliers(this.resultsWithRatings, getRating, { minCount: 5, cap: 8 });
    }
  },
  methods: {
    updateSearchValue (value) {
      this.$emit('updateSearchValue', value);
    }
  }
};
</script>

<style lang="scss" scoped>
.outliers {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.outlier-card {
  border: 1px solid white;
  border-radius: 3px;
  color: white;
  overflow: hidden;

  .outlier-card-title {
    background: var(--accent, #3b5aaa);
    color: var(--accent-text, white);
    border-bottom: 1px solid white;
    font-size: 0.8rem;
    margin: 0;
    padding: 2px 8px;
    text-align: center;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0.25rem 0.6rem 0.4rem;
    /* Shorter, and you flip through it in place rather than pushing the rest
       of the tab off the screen ("some of these panels are too tall and would
       be better if they were shorter and had internal scrolling so I could
       flip through them", Matt 2026-08-16). */
    max-height: 15rem;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .outlier-row {
    align-items: baseline;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    cursor: pointer;
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    padding: 0.35rem 0;

    &:first-child {
      border-top: none;
    }

    &:active {
      opacity: 0.6;
    }
  }

  .outlier-name {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .outlier-type {
    color: #9ec5fe;
    font-size: 0.65rem;
    margin-right: 0.4rem;
    text-transform: uppercase;
  }

  .outlier-numbers {
    flex: 0 0 auto;
    font-weight: 700;
  }

  .outlier-count {
    color: #ccc;
    font-size: 0.75rem;
    font-weight: 400;
  }
}
</style>

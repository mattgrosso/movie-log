<template>
  <div class="best-years">
    <div class="best-years-card">
      <p class="best-years-title">Best years of movies</p>
      <p class="best-years-caption">Release years ranked by the Log Score of your ratings — a year needs depth AND quality to place. Tap a year to see its films.</p>
      <ul>
        <li v-for="(item, index) in allYears" :key="item.year" class="year-row" @click="$emit('updateSearchValue', String(item.year))">
          <span class="year-rank">{{ index + 1 }}</span>
          <span class="year-info">
            <span class="year-name">{{ item.year }}</span>
            <span class="year-top" v-if="item.top">{{ item.top.movie.title }}</span>
          </span>
          <span class="year-numbers">{{ item.score.toFixed(2) }} <span class="year-count">· {{ item.count }} films</span></span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
// Reworked 2026-08-15 (Matt: the bar chart "feels like the kind of chart I
// might want, but I don't really know what to do with it... make sure we
// maintain what is the best year of movies I've ever watched"). RELEASE
// years — deliberately not watch years, which Deep Stats' Years section
// already covers — ranked by log score. Math in ratingOutliers.js.
import { getRating } from "../assets/javascript/GetRating.js";
import { bestReleaseYears } from "../assets/javascript/ratingOutliers.js";
import { logScoreSettings } from "../assets/javascript/logScore.js";

export default {
  name: "YearlyAverage",
  props: {
    resultsWithRatings: {
      type: Array,
      required: true
    }
  },
  emits: ['updateSearchValue'],
  // No limit and no "show all" button any more: the list scrolls inside its
  // own card, so every year is one flick away.
  computed: {
    allYears () {
      return bestReleaseYears(this.resultsWithRatings, getRating, logScoreSettings(this.$store?.state?.settings));
    }
  }
};
</script>

<style lang="scss" scoped>
.best-years {
  width: 100%;
}

.best-years-card {
  border: 1px solid white;
  border-radius: 3px;
  color: white;
  overflow: hidden;

  .best-years-title {
    background: var(--accent, #3b5aaa);
    color: var(--accent-text, white);
    border-bottom: 1px solid white;
    font-size: 0.8rem;
    margin: 0;
    padding: 2px 8px;
    text-align: center;
  }

  .best-years-caption {
    color: #ccc;
    font-size: 0.72rem;
    margin: 0;
    padding: 0.4rem 0.6rem 0;
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

  .year-row {
    align-items: baseline;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    cursor: pointer;
    display: flex;
    gap: 0.6rem;
    padding: 0.35rem 0;

    &:first-child {
      border-top: none;
    }

    &:active {
      opacity: 0.6;
    }
  }

  .year-rank {
    color: #9ec5fe;
    flex: 0 0 1.4em;
    font-size: 0.8rem;
    text-align: right;
  }

  .year-info {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
  }

  .year-name {
    font-weight: 700;
  }

  .year-top {
    color: #ccc;
    font-size: 0.72rem;
    overflow-wrap: anywhere;
  }

  .year-numbers {
    flex: 0 0 auto;
    font-weight: 700;
  }

  .year-count {
    color: #ccc;
    font-size: 0.75rem;
    font-weight: 400;
  }

}
</style>

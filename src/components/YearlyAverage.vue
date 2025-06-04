<template>
  <div class="yearly-average">
    <div class="year-adjustments">
      <p>Average ratings for last {{Math.floor(numberOfYears)}} years.</p>
      <button class="btn btn-primary btn-sm" @click="decreaseYears">Fewer Years</button>
      <button class="btn btn-success btn-sm" @click="increaseYears">More Years</button>
    </div>
    <BarChart class="chart" :chartData="yearlyAverageData" :options="yearlyAverageOptions"/>
  </div>
</template>

<script>
import { BarChart, LineChart } from "vue-chart-3";
import { getRating } from "../assets/javascript/GetRating.js";
import randomColor from 'randomcolor';

export default {
  name: "YearlyAverage",
  components: {
    BarChart,
    LineChart
  },
  data () {
    return {
      numberOfYears: 10
    };
  },
  props: {
    resultsWithRatings: {
      type: Array,
      required: true
    }
  },
  computed: {
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    uniqueYears () {
      const years = this.resultsWithRatings.map((result) => this.getYear(result));
      return [...new Set(years)].sort((a, b) => parseInt(a) - parseInt(b));
    },
    canDecreaseYears () {
      return this.numberOfYears / 2 >= 1;
    },
    canIncreaseYears () {
      return this.numberOfYears * 2 <= this.uniqueYears.length;
    },
    yearlyAverageData () {
      const counts = {};
      const sums = {};

      this.uniqueYears.forEach((year) => {
        counts[year] = 0;
        sums[year] = 0;
      });

      this.resultsWithRatings.forEach((result) => {
        const year = this.getYear(result);
        const rating = getRating(result).calculatedTotal;

        if (typeof rating === 'number' && !isNaN(rating)) {
          counts[year]++;
          sums[year] += rating;
        }
      });

      const averages = this.uniqueYears.map((year) => {
        if (counts[year] > 0) {
          return (sums[year] / counts[year]).toFixed(2);
        } else {
          return 0;
        }
      });

      // Get the last this.numberOfYears worth of data
      const startIndex = Math.max(this.uniqueYears.length - this.numberOfYears, 0);
      const recentYears = this.uniqueYears.slice(startIndex);
      const recentAverages = averages.slice(startIndex);

      const color = "#5bc62b";

      return {
        labels: recentYears,
        datasets: [
          {
            data: recentAverages,
            backgroundColor: color,
            borderColor: color,
            tension: 0.5
          }
        ]
      };
    },
    yearlyAverageOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: false,
            text: "Yearly Averages",
          },
        },
        backgroundColor: 'rgba(100, 100, 0, 1)',
        scales: {
          x: {
            display: true
          }
        }
      }
    }
  },
  methods: {
    getYear (media) {
      let date;
      if (this.currentLogIsTVLog) {
        date = media.tvShow.first_air_date;
      } else {
        date = media.movie.release_date;
      }

      return new Date(date).getFullYear();
    },
    decreaseYears () {
      if (this.canDecreaseYears) {
        this.numberOfYears = this.numberOfYears / 2;
      } else {
        this.numberOfYears = 1;
      }
    },
    increaseYears () {
      if (this.canIncreaseYears) {
        this.numberOfYears = this.numberOfYears * 2;
      } else if (this.numberOfYears < this.uniqueYears.length) {
        this.numberOfYears = this.uniqueYears.length;
      }
    }
  },
};
</script>

<style lang="scss">
  .yearly-average {
    .year-adjustments {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;

      p {
        width: 100%;
        text-align: center;
        margin: 6px 0;
      }

      button {
        margin: 0 0.25rem;
      }
    }
  }
</style>
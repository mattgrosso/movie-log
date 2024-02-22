<template>
  <div class="charts">
    <div class="accordion" id="accordionPanelsStayOpenExample">

      <div class="accordion-item" >
        <h2 class="accordion-header" id="panelsStayOpen-headingOne">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseOne" aria-expanded="true" aria-controls="panelsStayOpen-collapseOne">
            Keyword Cloud
          </button>
        </h2>
        <div id="panelsStayOpen-collapseOne" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingOne">
          <div class="accordion-body" :class="darkOrLight">
            <KeywordCloud :results="results" :countedKeywords="countedKeywords" @updateSearchValue="updateSearchValue"/>
          </div>
        </div>
      </div>

      <div v-if="results.length > 9" class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingTwo">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseTwo" aria-expanded="true" aria-controls="panelsStayOpen-collapseTwo">
            Ratings Distribution
          </button>
        </h2>
        <div id="panelsStayOpen-collapseTwo" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingTwo">
          <div class="accordion-body" :class="darkOrLight">
            <LineChart class="chart" :chartData="ratingsCountData" :options="ratingsCountOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingThree">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseThree" aria-expanded="true" aria-controls="panelsStayOpen-collapseThree">
            All Ratings Bar Chart
          </button>
        </h2>
        <div id="panelsStayOpen-collapseThree" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingThree">
          <div class="accordion-body" :class="darkOrLight">
            <BarChart class="chart" :chartData="allRatingsData" :options="allRatingsOptions"/>
          </div>
        </div>
      </div>

      <div v-if="results.length < 10" class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingFour">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseFour" aria-expanded="true" aria-controls="panelsStayOpen-collapseFour">
            Years Heat Chart
          </button>
        </h2>
        <div id="panelsStayOpen-collapseFour" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingFour">
          <div class="accordion-body" :class="darkOrLight">
            <BarChart class="chart" :chartData="ratingsCountData" :options="ratingsCountOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingFive">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseFive" aria-expanded="true" aria-controls="panelsStayOpen-collapseFive">
            Keyword Cloud
          </button>
        </h2>
        <div id="panelsStayOpen-collapseFive" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingFive">
          <div class="accordion-body" :class="darkOrLight">
            <BarChart class="chart" :chartData="yearsData" :options="yearsOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingSix">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseSix" aria-expanded="true" aria-controls="panelsStayOpen-collapseSix">
            Best Movie from Each Year
          </button>
        </h2>
        <div id="panelsStayOpen-collapseSix" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingSix">
          <div class="accordion-body" :class="darkOrLight">
            <BarChart class="chart" :chartData="highestRatingEachYearData" :options="highestRatingEachYearOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingSeven">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseSeven" aria-expanded="true" aria-controls="panelsStayOpen-collapseSeven">
            Genre Donut Chart
          </button>
        </h2>
        <div id="panelsStayOpen-collapseSeven" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingSeven">
          <div class="accordion-body" :class="darkOrLight">
            <DoughnutChart class="chart" :chartData="genreChartData" :options="genreChartOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingEight">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseEight" aria-expanded="true" aria-controls="panelsStayOpen-collapseEight">
            Runtime vs Rating Scatter Chart
          </button>
        </h2>
        <div id="panelsStayOpen-collapseEight" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingEight">
          <div class="accordion-body" :class="darkOrLight">
            <ScatterChart class="chart" :chartData="lengthVsRatingData" :options="lengthVsRatingOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingNine">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseNine" aria-expanded="true" aria-controls="panelsStayOpen-collapseNine">
            Production Companies Donut Chart
          </button>
        </h2>
        <div id="panelsStayOpen-collapseNine" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingNine">
          <div class="accordion-body" :class="darkOrLight">
            <DoughnutChart class="chart" :chartData="companyChartData" :options="companyChartOptions"/>
          </div>
        </div>
      </div>

      <div v-if="results.length < 10" class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingTen">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseTen" aria-expanded="true" aria-controls="panelsStayOpen-collapseTen">
            Radar Comparison
          </button>
        </h2>
        <div id="panelsStayOpen-collapseTen" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingTen">
          <div class="accordion-body" :class="darkOrLight">
            <RadarChart class="chart" :chartData="radarRatingsData" :options="radarRatingsOptions"/>
          </div>
        </div>
      </div>

      <div v-if="!currentLogIsTVLog" class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingEleven">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseEleven" aria-expanded="true" aria-controls="panelsStayOpen-collapseEleven">
            Streaks
          </button>
        </h2>
        <div id="panelsStayOpen-collapseEleven" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingEleven">
          <div class="accordion-body" :class="darkOrLight">
            <Streaks :resultsWithRatings="resultsWithRatings" :mostRecentRating="mostRecentRating"/>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import { BarChart, DoughnutChart, ScatterChart, RadarChart, LineChart } from "vue-chart-3";
import { Chart, registerables } from "chart.js";
import mean from 'lodash/mean';
import maxBy from 'lodash/maxBy';
import sortBy from 'lodash/sortBy';
import randomColor from 'randomcolor';
import { useDark } from "@vueuse/core";
import Streaks from "./Streaks.vue";
import KeywordCloud from "./KeywordCloud.vue";

Chart.register(...registerables);

export default {
  props: {
    results: {
      type: Array,
      required: true
    },
    sortOrder: {
      type: String,
      required: true
    },
    countedKeywords: {
      type: Object,
      required: false,
      default: () => {}
    }
  },
  components: {
    BarChart,
    LineChart,
    DoughnutChart,
    ScatterChart,
    RadarChart,
    Streaks,
    KeywordCloud
  },
  data () {
    return {
      streakThreshold: 5,
      useDark: useDark()
    }
  },
  computed: {
    darkOrLight () {
      return {'text-bg-dark': useDark, 'text-bg-light': !useDark};
    },
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    resultsWithRatings () {
      return this.results.filter((result) => this.mostRecentRating(result).rating);
    },
    allRatingsData () {
      const resultsByRating = sortBy(this.resultsWithRatings, (result) => this.mostRecentRating(result).rating);
      const labels = resultsByRating.map((result) => this.getMediaTitle(result));
      const data = resultsByRating.map((result) => parseFloat(this.mostRecentRating(result).rating));

      return {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: [randomColor(), randomColor(), randomColor(), randomColor()],
          }
        ]
      }
    },
    allRatingsOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: "All Ratings",
          },
        },
        scales: {
          x: {
            display: false
          }
        }
      }
    },
    ratingsCountData () {
      const rounded = this.resultsWithRatings.map((result) => {
        const rounded = Math.round((parseFloat(this.mostRecentRating(result).rating)) * 2) / 2;
        if (isNaN(rounded)) {
          return 0;
        } else {
          return rounded;
        }
      });

      const counts = {
        1: 0,
        1.5: 0,
        2: 0,
        2.5: 0,
        3: 0,
        3.5: 0,
        4: 0,
        4.5: 0,
        5: 0,
        5.5: 0,
        6: 0,
        6.5: 0,
        7: 0,
        7.5: 0,
        8: 0,
        8.5: 0,
        9: 0,
        9.5: 0,
        10: 0
      };
      rounded.forEach((number) => {
        if (!counts[number]) {
          counts[number] = 1;
        } else {
          counts[number]++;
        }
      })

      const countsWithLabels = Object.keys(counts).map((val) => {
        return {
          label: val,
          value: counts[val]
        }
      }).sort((a, b) => parseFloat(a.label) - parseFloat(b.label));

      const data = countsWithLabels.map((count) => count.value);
      const labels = countsWithLabels.map((count) => count.label);

      const color = randomColor();

      return {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: color,
            borderColor: color,
            tension: 0.5
          }
        ]
      }
    },
    ratingsCountOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: "Ratings Distribution",
          },
        },
        backgroundColor: 'rgba(100, 100, 0, 1)',
        scales: {
          x: {
            display: true
          }
        }
      }
    },
    genreChartData () {
      const genreArrays = this.results.map((result) => this.topStructure(result).genres);

      const counts = {};

      genreArrays.forEach((array) => {
        if (!array) {
          return;
        }

        array.forEach((genre) => {
          if (counts[genre.name]) {
            counts[genre.name]++;
          } else {
            counts[genre.name] = 1;
          }
        })
      })

      const countsWithLabels = Object.keys(counts).map((val) => {
        return {
          label: val,
          value: counts[val]
        }
      })

      const data = countsWithLabels.map((count) => count.value);
      const labels = countsWithLabels.map((count) => count.label);

      return {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: [randomColor(), randomColor(), randomColor(), randomColor(), randomColor()],
          }
        ]
      }
    },
    genreChartOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: "Genres",
          },
        },
        scales: {
          x: {
            display: false
          }
        }
      }
    },
    lengthVsRatingData () {
      const data = this.resultsWithRatings.map((result) => {
        let runtime;

        if (this.topStructure(result).runtime) {
          runtime = this.topStructure(result).runtime;
        } else if (this.topStructure(result).episode_run_time) {
          runtime = this.topStructure(result).episode_run_time[0];
        } else {
          runtime = 0;
        }

        return {
          x: runtime,
          y: this.mostRecentRating(result).rating
        }
      }).filter((result) => result.x && result.y);

      return {
        datasets: [{
          label: '(minutes, rating)',
          data: data,
          backgroundColor: randomColor(),
          pointBorderColor: randomColor()
        }],
      }
    },
    lengthVsRatingOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Runtime vs Rating'
          },
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'Rating'
            },
            type: 'linear'
          },
          x: {
            title: {
              display: true,
              text: 'Minutes'
            },
            type: 'linear',
            position: 'bottom'
          }
        }
      }
    },
    companyChartData () {
      const companyArrays = this.results.map((result) => this.topStructure(result).production_companies);

      const counts = {};

      companyArrays.forEach((array) => {
        if (!array) {
          return;
        }
        array.forEach((company) => {
          if (counts[company.name]) {
            counts[company.name]++;
          } else {
            counts[company.name] = 1;
          }
        })
      })

      let total = 0;
      Object.keys(counts).forEach((count) => {
        total = total + counts[count];
      })

      const countsWithLabels = Object.keys(counts).map((val) => {
        if (counts[val] < total * 0.005) {
          return null;
        }

        return {
          label: val,
          value: counts[val]
        }
      }).filter((count) => count);

      const data = countsWithLabels.map((count) => count.value);
      const labels = countsWithLabels.map((count) => count.label);

      return {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: [randomColor(), randomColor(), randomColor(), randomColor(), randomColor()],
          }
        ]
      }
    },
    companyChartOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: "Production Companies",
          },
          subtitle: {
            display: true,
            text: '(with >0.5% representation)'
          }
        },
        scales: {
          x: {
            display: false
          }
        }
      }
    },
    radarRatingsData () {
      const data = this.resultsWithRatings.map((result) => {
        const rating = this.mostRecentRating(result);
        const color = randomColor({
          format: 'rgba',
          alpha: 0.5
        });

        return {
          label: this.getMediaTitle(result),
          data: [
            rating.direction,
            rating.imagery,
            rating.story,
            rating.performance,
            rating.soundtrack,
            rating.impression,
            rating.love,
            rating.overall
          ],
          fill: true,
          backgroundColor: color,
          borderColor: randomColor({ hue: color }),
          pointBackgroundColor: randomColor({ hue: color }),
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: randomColor({ hue: color })
        }
      });

      return {
        labels: [
          "direction",
          "imagery",
          "story",
          "performance",
          "soundtrack",
          "impression",
          "love",
          "overall"
        ],
        datasets: data
      };
    },
    radarRatingsOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Ratings'
          },
        },
        elements: {
          line: {
            borderWidth: 3
          }
        }
      };
    },
    yearsData () {
      const yearsAndRatings = this.resultsWithRatings.map((result) => {
        return {
          year: this.getYear(result),
          rating: this.mostRecentRating(result).rating
        }
      });

      const years = {};

      yearsAndRatings.forEach((movie) => {
        if (!years[movie.year]) {
          years[movie.year] = [parseFloat(movie.rating)];
        } else {
          years[movie.year].push(parseFloat(movie.rating));
        }
      });

      const labels = [];
      const data = [];
      const backgroundColors = [];

      Object.keys(years).forEach((year) => {
        labels.push(year);
        data.push(years[year].length);
        backgroundColors.push(this.percentToColor(parseFloat(mean(years[year]).toFixed()) * 10));
      });

      return {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: backgroundColors,
          }
        ]
      }
    },
    yearsOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: "Years",
          },
          subtitle: {
            display: true,
            text: "(Warmer color means higher average rating)"
          }
        }
      };
    },
    highestRatingEachYearData () {
      const yearsAndRatings = this.resultsWithRatings.map((result) => {
        return {
          year: this.getYear(result),
          rating: this.mostRecentRating(result).rating,
          title: this.getMediaTitle(result)
        }
      });

      const years = {};

      yearsAndRatings.forEach((movie) => {
        if (!years[movie.year]) {
          years[movie.year] = [{ rating: parseFloat(movie.rating), title: movie.title }];
        } else {
          years[movie.year].push({ rating: parseFloat(movie.rating), title: movie.title });
        }
      });

      const labels = [];
      const data = [];
      const backgroundColors = [];

      Object.keys(years).forEach((year) => {
        const highest = maxBy(years[year], (i) => i.rating);

        labels.push(`${highest.title} (${year})`);
        data.push(highest.rating);
        backgroundColors.push(this.percentToColor(parseFloat(highest.rating.toFixed()) * 10));
      });

      return {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: backgroundColors
          }
        ]
      }
    },
    highestRatingEachYearOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: this.currentLogIsTVLog ? "Best Show Each Year" : "Best Movie Each Year",
          }
        },
        scales: {
          x: {
            display: false
          }
        }
      };
    }
  },
  methods: {
    getMediaTitle (media) {
      if (this.currentLogIsTVLog) {
        return media.tvShow.name;
      } else {
        return media.movie.title;
      }
    },
    topStructure (media) {
      if (this.currentLogIsTVLog) {
        return media.tvShow;
      } else {
        return media.movie;
      }
    },
    getYear (media) {
      let date;
      if (this.currentLogIsTVLog) {
        date = media.tvShow.first_air_date;
      } else {
        date = media.movie.release_date;
      }

      return new Date(date).getFullYear();
    },
    mostRecentRating (media) {
      if (this.currentLogIsTVLog) {
        return media.ratings.tvShow;
      } else {
        let mostRecentRating = media.ratings[0];

        media.ratings.forEach((rating) => {
          if (!mostRecentRating.date) {
            mostRecentRating = rating;
          } else if (rating.date && rating.date > mostRecentRating.date) {
            mostRecentRating = rating;
          }
        })

        return mostRecentRating;
      }
    },
    percentToColor (percent) {
      let r = 0;
      let g = 0;
      const b = 0;
      if (percent < 50) {
        g = 255;
        r = Math.round(5.1 * percent);
      } else {
        r = 255;
        g = Math.round(510 - 5.10 * percent);
      }
      const h = r * 0x10000 + g * 0x100 + b * 0x1;
      return '#' + ('000000' + h.toString(16)).slice(-6);
    },
    updateSearchValue (searchObject) {
      this.$emit('updateSearchValue', searchObject);
    }
  }
}
</script>

<style lang="scss">
.charts {
  .accordion {
    .accordion-button {
      &:focus {
        border: none;
        box-shadow: none;
      }

      &.text-bg-dark::after {
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 16 16'%3e%3cpath d='M4.646 7.646a.5.5 0 0 1 .708 0L8 10.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e");
      }

      &.text-bg-light::after {
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='black' viewBox='0 0 16 16'%3e%3cpath d='M4.646 7.646a.5.5 0 0 1 .708 0L8 10.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e");
      }
    }
  }
}
</style>
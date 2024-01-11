<template>
  <div class="charts">
    <div v-if="keywordsForCloud.length > 1" class="keywords">
      <div class="keywords-header d-flex align-items-center justify-content-center py-2">
        <button
          class="keyword-style-toggle btn btn-sm btn-light"
          type="button"
          @click="showKeywordCloud = !showKeywordCloud"
        >
          <span v-if="showKeywordCloud">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-columns-gap" viewBox="0 0 16 16">
              <path d="M6 1v3H1V1zM1 0a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1zm14 12v3h-5v-3zm-5-1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zM6 8v7H1V8zM1 7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm14-6v7h-5V1zm-5-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1z"/>
            </svg>
          </span>
          <span v-else>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud" viewBox="0 0 16 16">
              <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383m.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
            </svg>
          </span>
        </button>
        <div class="keyword-threshold d-flex align-items-center col-10">
          <label for="customRange1" class="form-label col-2 d-flex justify-content-end align-items-center px-2 my-0">{{ threseholdRange }}%</label>
          <input type="range" class="form-range col-10" style="width: 83.33333333%" id="customRange1" min="0" :max="maxKeywordPercentage" v-model="threseholdRange">
        </div>
      </div>
      <vueWordCloud
        v-if="showKeywordCloud"
        class="word-cloud"
        :words="keywordsForCloud"
        :color="wordCLoudColors"
        :rotation="wordCloudRotation"
        spacing="1"
        font-size-ratio="4"
        font-family="Roboto Condensed"
        @click="handleKeywordClick"
      />
      <div v-else class="d-flex flex-wrap">
        <div v-for="(keyword, index) in keywordsForCloud" :key="index">
          <span class="badge mx-1 text-bg-secondary">
            <span @click="handleKeywordClick">{{ keyword[0] }}</span>
            <span>&nbsp;({{ Math.floor((keyword[1] / this.results.length) * 100) }}%)</span>
          </span>
        </div>
      </div>
    </div>
    <LineChart v-if="results.length > 9" class="chart my-5" :chartData="ratingsCountData" :options="ratingsCountOptions"/>
    <BarChart class="chart my-5" :chartData="allRatingsData" :options="allRatingsOptions"/>
    <BarChart v-if="results.length < 10" class="chart my-5" :chartData="ratingsCountData" :options="ratingsCountOptions"/>
    <BarChart class="chart my-5" :chartData="yearsData" :options="yearsOptions"/>
    <BarChart class="chart my-5" :chartData="highestRatingEachYearData" :options="highestRatingEachYearOptions"/>
    <DoughnutChart class="chart my-5" :chartData="genreChartData" :options="genreChartOptions"/>
    <ScatterChart class="chart my-5" :chartData="lengthVsRatingData" :options="lengthVsRatingOptions"/>
    <DoughnutChart class="chart my-5" :chartData="companyChartData" :options="companyChartOptions"/>
    <RadarChart v-if="results.length < 10" class="chart my-5" :chartData="radarRatingsData" :options="radarRatingsOptions"/>
    <Streaks :resultsWithRatings="resultsWithRatings" :mostRecentRating="mostRecentRating"/>
  </div>
</template>

<script>
import { BarChart, DoughnutChart, ScatterChart, RadarChart, LineChart } from "vue-chart-3";
import { Chart, registerables } from "chart.js";
import VueWordCloud from 'vuewordcloud';
import mean from 'lodash/mean';
import maxBy from 'lodash/maxBy';
import sortBy from 'lodash/sortBy';
import randomColor from 'randomcolor';
import Streaks from "./Streaks.vue";

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
    VueWordCloud
  },
  data () {
    return {
      streakThreshold: 5,
      showKeywordCloud: true,
      threseholdRange: 3
    }
  },
  computed: {
    resultsWithRatings () {
      return this.results.filter((result) => this.mostRecentRating(result).rating);
    },
    allRatingsData () {
      const resultsByRating = sortBy(this.resultsWithRatings, (result) => this.mostRecentRating(result).rating);
      const labels = resultsByRating.map((result) => result.movie.title);
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
      const genreArrays = this.results.map((result) => result.movie.genres);

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
        return {
          x: result.movie.runtime,
          y: this.mostRecentRating(result).rating
        }
      });

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
      const companyArrays = this.results.map((result) => result.movie.production_companies);

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
          label: result.movie.title,
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
          year: new Date(result.movie.release_date).getFullYear(),
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
          year: new Date(result.movie.release_date).getFullYear(),
          rating: this.mostRecentRating(result).rating,
          title: result.movie.title
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
            text: "Best Movie Each Year",
          }
        },
        scales: {
          x: {
            display: false
          }
        }
      };
    },
    keywordsForCloud () {
      const percentofMedia = Math.round(this.results.length * (this.threseholdRange / 100));

      const keywords = Object.keys(this.countedKeywords).map((keyword) => {
        return [keyword, this.countedKeywords[keyword]];
      }).filter((keyword) => keyword[1] > percentofMedia).sort((a, b) => b[1] - a[1]);

      return keywords;
    },
    maxKeywordPercentage () {
      const keywords = Object.keys(this.countedKeywords).map((keyword) => {
        return [keyword, this.countedKeywords[keyword]];
      }).sort((a, b) => b[1] - a[1]);

      return Math.floor((keywords[1][1] / this.results.length) * 100);
    }
  },
  methods: {
    handleKeywordClick (event) {
      this.searchFor('keyword', event.target.innerText);
    },
    updateSearchValue (searchType, value) {
      this.$emit('updateSearchValue', {searchType: searchType, value});
    },
    searchFor (searchType, term) {
      this.updateSearchValue(searchType, term);

      window.scroll({
        top: top,
        behavior: 'smooth'
      })
    },
    mostRecentRating (movie) {
      let mostRecentRating = movie.ratings[0];

      movie.ratings.forEach((rating) => {
        if (!mostRecentRating.date) {
          mostRecentRating = rating;
        } else if (rating.date && rating.date > mostRecentRating.date) {
          mostRecentRating = rating;
        }
      })

      return mostRecentRating;
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
    wordCloudRotation (word) {
      const index = Math.round(Math.random());
      return [0, 3 / 4][index];
    },
    wordCLoudColors (word) {
      return [
        randomColor({luminosity: 'dark'}), 
        randomColor({luminosity: 'dark'}), 
        randomColor({luminosity: 'dark'}), 
        randomColor({luminosity: 'dark'})
      ];
    }
  }
}
</script>

<style lang="scss">
  .charts {
    .keywords {
      .word-cloud {
        height: 250px !important;
        pointer-events: none;
        width: 100% !important;
  
        transition {
          div {
            cursor: pointer;
            pointer-events: all;
          }
        }
      }

      .badge {
        cursor: pointer;
      }
    }
  }
</style>
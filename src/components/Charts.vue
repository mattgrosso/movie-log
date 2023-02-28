<template>
  <div class="charts">
    <BarChart class="chart my-5" :chartData="allRatingsData" :options="allRatingsOptions"/>
    <BarChart class="chart my-5" :chartData="highestRatingEachYearData" :options="highestRatingEachYearOptions"/>
    <LineChart v-if="results.length > 9" class="chart my-5" :chartData="ratingsCountData" :options="ratingsCountOptions"/>
    <BarChart v-if="results.length < 10" class="chart my-5" :chartData="ratingsCountData" :options="ratingsCountOptions"/>
    <BarChart class="chart my-5" :chartData="yearsData" :options="yearsOptions"/>
    <DoughnutChart class="chart my-5" :chartData="genreChartData" :options="genreChartOptions"/>
    <ScatterChart class="chart my-5" :chartData="lengthVsRatingData" :options="lengthVsRatingOptions"/>
    <DoughnutChart class="chart my-5" :chartData="companyChartData" :options="companyChartOptions"/>
    <RadarChart v-if="results.length < 10" class="chart my-5" :chartData="radarRatingsData" :options="radarRatingsOptions"/>
  </div>
</template>

<script>
import { BarChart, DoughnutChart, ScatterChart, RadarChart, LineChart } from "vue-chart-3";
import { Chart, registerables } from "chart.js";
import mean from 'lodash/mean';
import maxBy from 'lodash/maxBy';
import randomColor from 'randomcolor';

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
    }
  },
  components: {
    BarChart,
    LineChart,
    DoughnutChart,
    ScatterChart,
    RadarChart
  },
  computed: {
    resultsWithRatings () {
      return this.results.filter((result) => this.mostRecentRating(result).rating);
    },
    allRatingsData () {
      const resultsByRating = [...this.resultsWithRatings].sort(this.sortByRating);
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
        const test = Math.round((parseFloat(this.mostRecentRating(result).rating)) * 2) / 2;
        if (isNaN(test)) {
          return 0;
        } else {
          return test;
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
          years[movie.year] = [{rating: parseFloat(movie.rating), title: movie.title}];
        } else {
          years[movie.year].push({rating: parseFloat(movie.rating), title: movie.title});
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
    }
  },
  methods: {
    sortByRating (a, b) {
      const sortValueA = this.mostRecentRating(a).rating;
      const sortValueB = this.mostRecentRating(b).rating;

      if (sortValueA < sortValueB) {
        if (this.sortOrder === "ascending") {
          return 1;
        } else {
          return -1;
        }
      }
      if (sortValueA > sortValueB) {
        if (this.sortOrder === "ascending") {
          return -1;
        } else {
          return 1;
        }
      }

      return 0;
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
    }
  }
}
</script>

<style>

</style>
<template>
  <div class="charts">
    <BarChart class="chart my-5" :chartData="allRatingsData" :options="allRatingsOptions"/>
    <LineChart class="chart my-5" :chartData="ratingsCountData" :options="ratingsCountOptions"/>
    <DoughnutChart class="chart my-5" :chartData="genreChartData" :options="genreChartOptions"/>
    <ScatterChart class="chart my-5" :chartData="lengthVsRatingData" :options="lengthVsRatingOptions"/>
    <DoughnutChart class="chart my-5" :chartData="companyChartData" :options="companyChartOptions"/>
    <RadarChart v-if="results.length < 10" class="chart my-5" :chartData="radarRatingsData" :options="radarRatingsOptions"/>
  </div>
</template>

<script>
import { BarChart, DoughnutChart, ScatterChart, RadarChart, LineChart } from "vue-chart-3";
import { Chart, registerables } from "chart.js";
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
    allRatingsData () {
      const resultsByRating = [...this.results].sort(this.sortByRating);
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
      const rounded = this.results.map((result) => {
        return Math.round((parseFloat(this.mostRecentRating(result).rating)) * 2) / 2;
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
      const data = this.results.map((result) => {
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
      const data = this.results.map((result) => {
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
    }
  }
}
</script>

<style>

</style>
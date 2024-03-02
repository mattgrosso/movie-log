<template>
  <div class="charts">
    <div class="accordion" id="accordionPanelsStayOpenExample">

      <div class="accordion-item" >
        <h2 class="accordion-header" id="panelsStayOpen-headingKeywordCloud">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseKeywordCloud" aria-expanded="true" aria-controls="panelsStayOpen-collapseKeywordCloud">
            Keyword Cloud
          </button>
        </h2>
        <div id="panelsStayOpen-collapseKeywordCloud" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingKeywordCloud">
          <div class="accordion-body" :class="darkOrLight">
            <KeywordCloud :results="results" :countedKeywords="allCounts.keywords" @updateSearchValue="updateSearchValue"/>
          </div>
        </div>
      </div>

      <div class="accordion-item" >
        <h2 class="accordion-header" id="panelsStayOpen-headingHIndexes">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseHIndexes" aria-expanded="true" aria-controls="panelsStayOpen-collapseHIndexes">
            H-Indexes
          </button>
        </h2>
        <div id="panelsStayOpen-collapseHIndexes" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingHIndexes">
          <div class="accordion-body" :class="darkOrLight">
            <table class="table" :class="darkOrLight">
              <tbody>
                <tr>
                  <th scope="row">Directors</th>
                  <td>{{directorHIndex}}</td>
                  <td>
                    <div class="icon-container">
                      <i class="bi bi-info-circle" @touchstart="toggleTooltip('directors')" @click="toggleTooltip('directors')"></i>
                      <div class="tooltip" v-if="tooltips.directors">{{directorHIndex}} directors have {{directorHIndex}} movies rated</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Years</th>
                  <td>{{yearsHIndex}}</td>
                  <td>
                    <div class="icon-container">
                      <i class="bi bi-info-circle" @touchstart="toggleTooltip('years')" @click="toggleTooltip('years')"></i>
                      <div class="tooltip" v-if="tooltips.years">{{yearsHIndex}} years have {{yearsHIndex}} movies rated</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Cast/Crew</th>
                  <td>{{castCrewHIndex}}</td>
                  <td>
                    <div class="icon-container">
                      <i class="bi bi-info-circle" @touchstart="toggleTooltip('castCrew')" @click="toggleTooltip('castCrew')"></i>
                      <div class="tooltip" v-if="tooltips.castCrew">{{castCrewHIndex}} cast/crew members have {{castCrewHIndex}} movies rated</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Studios</th>
                  <td>{{studioHIndex}}</td>
                  <td>
                    <div class="icon-container">
                      <i class="bi bi-info-circle" @touchstart="toggleTooltip('studios')" @click="toggleTooltip('studios')"></i>
                      <div class="tooltip" v-if="tooltips.studios">{{studioHIndex}} studios members have {{studioHIndex}} movies rated</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Genres</th>
                  <td>{{genresHIndex}}</td>
                  <td>
                    <div class="icon-container">
                      <i class="bi bi-info-circle" @touchstart="toggleTooltip('genres')" @click="toggleTooltip('genres')"></i>
                      <div class="tooltip" v-if="tooltips.genres">{{genresHIndex}} genres have {{genresHIndex}} movies rated</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Keywords</th>
                  <td>{{keywordsHIndex}}</td>
                  <td>
                    <div class="icon-container">
                      <i class="bi bi-info-circle" @touchstart="toggleTooltip('keywords')" @click="toggleTooltip('keywords')"></i>
                      <div class="tooltip" v-if="tooltips.keywords">{{keywordsHIndex}} keywords are found in {{keywordsHIndex}} movies</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="accordion-item" >
        <h2 class="accordion-header" id="panelsStayOpen-headingDirectorPercentages">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseDirectorPercentages" aria-expanded="true" aria-controls="panelsStayOpen-collapseDirectorPercentages">
            Director Percentages
          </button>
        </h2>
        <div id="panelsStayOpen-collapseDirectorPercentages" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingDirectorPercentages">
          <div class="accordion-body" :class="darkOrLight">
            <table class="table" :class="darkOrLight">
              <tbody>
                <tr v-for="(director, index) in directorsWithPercentages" :key="index">
                  <th scope="row">{{director.name}}</th>
                  <td>{{director.count}} / {{director.totalFilms}}</td>
                  <td>{{director.percentageOfFilmography}}%</td>
                  <td>
                    <div class="icon-container">
                      <i class="bi bi-info-circle" @touchstart="toggleTooltip(`directorPercentage${index}`)" @click="toggleTooltip(`directorPercentage${index}`)"></i>
                      <div class="tooltip" v-if="tooltips[`directorPercentage${index}`]">
                        <ul>
                          <li v-for="(film, index) in sortFilmographyByWatched(director.filmography)" :key="index" :class="{watched: film.watched}">
                            <p class="m-1">{{film.title}}</p>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="more-directors-button d-flex justify-content-end">
              <button class="btn btn-secondary btn-sm" @click="numberOfDirectors += 10">More...</button>
            </div>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingCalendarHeatMap">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseCalendarHeatMap" aria-expanded="true" aria-controls="panelsStayOpen-collapseCalendarHeatMap">
            Calendar Heat Map
          </button>
        </h2>
        <div id="panelsStayOpen-collapseCalendarHeatMap" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingCalendarHeatMap">
          <div class="accordion-body" :class="darkOrLight">
            <CalendarHeatMap :results="results"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingFullCalendar">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseFullCalendar" aria-expanded="true" aria-controls="panelsStayOpen-collapseFullCalendar" @click="fullCalendarAccordionOpen = !fullCalendarAccordionOpen">
            Full Calendar
          </button>
        </h2>
        <div id="panelsStayOpen-collapseFullCalendar" ref="fullCalendar" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingFullCalendar">
          <div class="accordion-body" :class="darkOrLight">
            <FullCalendarView :results="results" :open="fullCalendarAccordionOpen" />
          </div>
        </div>
      </div>

      <div v-if="results.length > 9" class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingDistribution">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseDistribution" aria-expanded="true" aria-controls="panelsStayOpen-collapseDistribution">
            Ratings Distribution
          </button>
        </h2>
        <div id="panelsStayOpen-collapseDistribution" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingDistribution">
          <div class="accordion-body" :class="darkOrLight">
            <LineChart class="chart" :chartData="ratingsCountData" :options="ratingsCountOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingAllRatingsBar">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseAllRatingsBar" aria-expanded="true" aria-controls="panelsStayOpen-collapseAllRatingsBar">
            All Ratings Bar Chart
          </button>
        </h2>
        <div id="panelsStayOpen-collapseAllRatingsBar" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingAllRatingsBar">
          <div class="accordion-body" :class="darkOrLight">
            <BarChart class="chart" :chartData="allRatingsData" :options="allRatingsOptions"/>
          </div>
        </div>
      </div>

      <div v-if="results.length < 10" class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingRatingsCount">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseRatingsCount" aria-expanded="true" aria-controls="panelsStayOpen-collapseRatingsCount">
            Ratings Count
          </button>
        </h2>
        <div id="panelsStayOpen-collapseRatingsCount" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingRatingsCount">
          <div class="accordion-body" :class="darkOrLight">
            <BarChart class="chart" :chartData="ratingsCountData" :options="ratingsCountOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingYearsHeatChart">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseYearsHeatChart" aria-expanded="true" aria-controls="panelsStayOpen-collapseYearsHeatChart">
            Years Heat Chart
          </button>
        </h2>
        <div id="panelsStayOpen-collapseYearsHeatChart" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingYearsHeatChart">
          <div class="accordion-body" :class="darkOrLight">
            <BarChart class="chart" :chartData="yearsData" :options="yearsOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingBestOfEachYear">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseBestOfEachYear" aria-expanded="true" aria-controls="panelsStayOpen-collapseBestOfEachYear">
            Best Movie from Each Year
          </button>
        </h2>
        <div id="panelsStayOpen-collapseBestOfEachYear" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingBestOfEachYear">
          <div class="accordion-body" :class="darkOrLight">
            <BarChart class="chart" :chartData="highestRatingEachYearData" :options="highestRatingEachYearOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingMediumDonut">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseMediumDonut" aria-expanded="true" aria-controls="panelsStayOpen-collapseMediumDonut">
            Medium Donut Chart
          </button>
        </h2>
        <div id="panelsStayOpen-collapseMediumDonut" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingMediumDonut">
          <div class="accordion-body" :class="darkOrLight">
            <DoughnutChart class="chart" :chartData="mediumChartData" :options="mediumChartOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingGenreDonut">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseGenreDonut" aria-expanded="true" aria-controls="panelsStayOpen-collapseGenreDonut">
            Genre Donut Chart
          </button>
        </h2>
        <div id="panelsStayOpen-collapseGenreDonut" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingGenreDonut">
          <div class="accordion-body" :class="darkOrLight">
            <DoughnutChart class="chart" :chartData="genreChartData" :options="genreChartOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingRuntimeVsRating">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseRuntimeVsRating" aria-expanded="true" aria-controls="panelsStayOpen-collapseRuntimeVsRating">
            Runtime vs Rating Scatter Chart
          </button>
        </h2>
        <div id="panelsStayOpen-collapseRuntimeVsRating" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingRuntimeVsRating">
          <div class="accordion-body" :class="darkOrLight">
            <ScatterChart class="chart" :chartData="lengthVsRatingData" :options="lengthVsRatingOptions"/>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingProductionCompanyDonut">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseProductionCompanyDonut" aria-expanded="true" aria-controls="panelsStayOpen-collapseProductionCompanyDonut">
            Production Companies Donut Chart
          </button>
        </h2>
        <div id="panelsStayOpen-collapseProductionCompanyDonut" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingProductionCompanyDonut">
          <div class="accordion-body" :class="darkOrLight">
            <DoughnutChart class="chart" :chartData="companyChartData" :options="companyChartOptions"/>
          </div>
        </div>
      </div>

      <div v-if="results.length < 10" class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingRadarComparison">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseRadarComparison" aria-expanded="true" aria-controls="panelsStayOpen-collapseRadarComparison">
            Radar Comparison
          </button>
        </h2>
        <div id="panelsStayOpen-collapseRadarComparison" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingRadarComparison">
          <div class="accordion-body" :class="darkOrLight">
            <RadarChart class="chart" :chartData="radarRatingsData" :options="radarRatingsOptions"/>
          </div>
        </div>
      </div>

      <div v-if="!currentLogIsTVLog" class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingStreaks">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseStreaks" aria-expanded="true" aria-controls="panelsStayOpen-collapseStreaks">
            Streaks
          </button>
        </h2>
        <div id="panelsStayOpen-collapseStreaks" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingStreaks">
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
import Streaks from "./Streaks.vue";
import KeywordCloud from "./KeywordCloud.vue";
import CalendarHeatMap from "./CalendarHeatMap.vue";
import FullCalendarView from "./FullCalendarView.vue";

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
    allCounts: {
      type: Object,
      required: true
    }
  },
  components: {
    BarChart,
    LineChart,
    DoughnutChart,
    ScatterChart,
    RadarChart,
    Streaks,
    KeywordCloud,
    CalendarHeatMap,
    FullCalendarView
  },
  data () {
    return {
      streakThreshold: 5,
      tooltips: {
        directors: false,
        years: false,
        castCrew: false,
        studios: false,
        genres: false,
        keywords: false,
        directorPercentage0: false,
        directorPercentage1: false,
        directorPercentage2: false,
        directorPercentage3: false,
        directorPercentage4: false,
        directorPercentage5: false,
        directorPercentage6: false,
        directorPercentage7: false,
        directorPercentage8: false,
        directorPercentage9: false
      },
      numberOfDirectors: 10,
      fullCalendarAccordionOpen: false
    }
  },
  computed: {
    darkOrLight () {
      const inDarkMode = document.querySelector("body").classList.contains('bg-dark');

      return { 'text-bg-dark': inDarkMode, 'text-bg-light': !inDarkMode };
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
    mediumChartData () {
      const data = this.allCounts.mediums.map((count) => count.count);
      const labels = this.allCounts.mediums.map((count) => count.name);

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
    mediumChartOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: "Mediums",
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
    },
    directorHIndex () {
      const hIndex = Object.keys(this.allCounts.directors).map((director) => this.allCounts.directors[director]).sort((a, b) => b - a).map((count, index) => {
        return Math.min(count, index + 1);
      }).reduce((a, b) => Math.max(a, b), 0);

      return hIndex;
    },
    yearsHIndex () {
      const hIndex = Object.keys(this.allCounts.years).map((year) => this.allCounts.years[year]).sort((a, b) => b - a).map((count, index) => {
        return Math.min(count, index + 1);
      }).reduce((a, b) => Math.max(a, b), 0);

      return hIndex;
    },
    genresHIndex () {
      const hIndex = Object.keys(this.allCounts.genres).map((genre) => this.allCounts.genres[genre]).sort((a, b) => b - a).map((count, index) => {
        return Math.min(count, index + 1);
      }).reduce((a, b) => Math.max(a, b), 0);

      return hIndex;
    },
    castCrewHIndex () {
      const hIndex = Object.keys(this.allCounts.castCrew).map((person) => this.allCounts.castCrew[person]).sort((a, b) => b - a).map((count, index) => {
        return Math.min(count, index + 1);
      }).reduce((a, b) => Math.max(a, b), 0);

      return hIndex;
    },
    studioHIndex () {
      const hIndex = Object.keys(this.allCounts.studios).map((studio) => this.allCounts.studios[studio]).sort((a, b) => b - a).map((count, index) => {
        return Math.min(count, index + 1);
      }).reduce((a, b) => Math.max(a, b), 0);

      return hIndex;
    },
    keywordsHIndex () {
      const hIndex = Object.keys(this.allCounts.keywords).map((keyword) => this.allCounts.keywords[keyword]).sort((a, b) => b - a).map((count, index) => {
        return Math.min(count, index + 1);
      }).reduce((a, b) => Math.max(a, b), 0);

      return hIndex;
    },
    arrayOfIdsFromResults () {
      return this.results.map((result) => result.movie.id);
    },
    directorsWithPercentages () {
      const mapped = this.allCounts.filmographies.map((director) => {
        return {
          name: director.name,
          totalFilms: director.filmography.length,
          filmography: director.filmography.map((film) => {
            return {
              title: film.title.length > 35 ? film.title.slice(0, 35) + '...' : film.title,
              watched: this.arrayOfIdsFromResults.includes(film.id)
            }
          }),
          count: director.count,
          percentageOfFilmography: director.filmography.length ? (director.count / director.filmography.length * 100).toFixed(0) : 0
        }
      })

      const filtered = mapped.filter((director) => director.totalFilms > 2);

      const sortedAndTruncated = filtered.sort((a, b) => b.percentageOfFilmography - a.percentageOfFilmography).slice(0, this.numberOfDirectors);

      return sortedAndTruncated;
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
    },
    toggleTooltip (type) {
      this.tooltips[type] = !this.tooltips[type];
    },
    sortFilmographyByWatched (filmography) {
      return filmography.sort((a, b) => {
        if (a.watched && !b.watched) {
          return 1;
        } else if (!a.watched && b.watched) {
          return -1;
        } else {
          return 0;
        }
      })
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

    #panelsStayOpen-collapseDirectorPercentages {
      table {
        td {
          white-space: nowrap;

          ul {
            list-style: none;
            margin: 0;
            padding: 0;

            li {
              margin-bottom: 5px;

              &.watched {
                text-decoration: line-through;
              }
            }
          }
        }
      }
    }

    #panelsStayOpen-collapseCalendarHeatMap {
      overflow: hidden;

      .accordion-body {
        width: 120%;
      }
    }
  }

  .icon-container {
    display: inline-block;
    position: relative;

    &:hover {
      .tooltip {
        opacity: 1;
        transition-delay: 0s;
        visibility: visible;
      }
    }

    .tooltip {
      background-color: #333;
      border-radius: 3px;
      bottom: 110%;
      color: #fff;
      left: 0;
      max-width: 80vw;
      opacity: 0;
      padding: 5px 10px;
      position: absolute;
      transform: translateX(-80%);
      transition: visibility 0s linear 0.3s, opacity 0.3s linear;
      visibility: hidden;
      white-space: nowrap;

      &::after {
        border-color: #333 transparent transparent transparent;
        border-style: solid;
        border-width: 5px;
        content: "";
        left: 80%;
        position: absolute;
        top: 100%;
        transform: translateX(30%);
      }
    }
  }

}
</style>
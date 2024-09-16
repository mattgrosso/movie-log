<template>
  <div class="charts">
    <div class="accordion" id="chartsAccordion">
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
        <h2 class="accordion-header" id="panelsStayOpen-headingViewingCounts">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseViewingCounts" aria-expanded="true" aria-controls="panelsStayOpen-collapseViewingCounts">
            Viewing Counts
          </button>
        </h2>
        <div id="panelsStayOpen-collapseViewingCounts" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingViewingCounts">
          <div class="accordion-body" :class="darkOrLight">
            <p>This week you've watched {{ moviesWatchedThisWeek }} movies. Last week you watched {{ moviesWatchedLastWeek }}.</p>
            <p>You've watched {{ moviesWatchedThisMonth }} movies in {{ moment().format('MMMM') }}. You watched {{ moviesWatchedLastMonth }} in {{ moment().subtract(1, 'months').format('MMMM') }}.</p>
            <p>So far in {{ moment().format('YYYY') }} you've watched {{ moviesWatchedThisYear }}.</p>
            <p>You're on track to watch {{ estimatedMoviesThisYear }} this year.</p>
            <p>Last year you watched a total of {{ moviesWatchedLastYear }}.</p>
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

    </div>
  </div>
</template>

<script>
import { getRating } from "../assets/javascript/GetRating.js";
import { BarChart, DoughnutChart, ScatterChart, RadarChart, LineChart } from "vue-chart-3";
import { Chart, registerables } from "chart.js";
import sortBy from 'lodash/sortBy';
import randomColor from 'randomcolor';
import moment from 'moment';
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
    allEntriesWithFlatKeywordsAdded: {
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
      fullCalendarAccordionOpen: false,
      moment: moment
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
      return this.results.filter((result) => getRating(result).calculatedTotal);
    },
    allRatingsData () {
      const resultsByRating = sortBy(this.resultsWithRatings, (result) => getRating(result).calculatedTotal);
      const labels = resultsByRating.map((result) => this.getMediaTitle(result).calculatedTotal);
      const data = resultsByRating.map((result) => parseFloat(getRating(result).calculatedTotal));

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
    datesWithCounts () {
      const datesWithCounts = {};

      for (const result of this.allEntriesWithFlatKeywordsAdded) {
        for (const rating of result.ratings) {
          const datesWithCountsKey = new Date(rating.date).toLocaleDateString();
          if (datesWithCounts[datesWithCountsKey]) {
            datesWithCounts[datesWithCountsKey]++;
          } else {
            datesWithCounts[datesWithCountsKey] = 1;
          }
        }
      }

      return datesWithCounts;
    },
    moviesWatchedThisWeek () {
      let count = 0;
      for (let i = 0; i < 7; i++) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        day.setHours(0, 0, 0, 0);
        const dateString = `${day.getMonth() + 1}/${day.getDate()}/${day.getFullYear()}`;
        count += this.datesWithCounts[dateString] || 0;
      }
      return count;
    },
    moviesWatchedLastWeek () {
      let count = 0;
      for (let i = 7; i < 14; i++) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        day.setHours(0, 0, 0, 0);
        const dateString = `${day.getMonth() + 1}/${day.getDate()}/${day.getFullYear()}`;
        count += this.datesWithCounts[dateString] || 0;
      }
      return count;
    },
    moviesWatchedThisMonth () {
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();
      let count = 0;
      Object.keys(this.datesWithCounts).forEach(date => {
        const [dateMonth, , dateYear] = date.split('/');
        if (+dateMonth === month && +dateYear === year) {
          count += this.datesWithCounts[date];
        }
      });
      return count;
    },
    moviesWatchedLastMonth () {
      const today = new Date();
      today.setMonth(today.getMonth() - 1); // Get the same date but for last month
      const month = today.getMonth() + 1;
      const year = today.getFullYear();
      let count = 0;
      Object.keys(this.datesWithCounts).forEach(date => {
        const [dateMonth, , dateYear] = date.split('/');
        if (+dateMonth === month && +dateYear === year) {
          count += this.datesWithCounts[date];
        }
      });
      return count;
    },
    moviesWatchedThisYear () {
      const year = new Date().getFullYear();
      let count = 0;
      Object.keys(this.datesWithCounts).forEach(date => {
        const dateYear = +date.split('/')[2];
        if (dateYear === year) {
          count += this.datesWithCounts[date];
        }
      });
      return count;
    },
    estimatedMoviesThisYear () {
      const today = new Date();
      const currentYear = today.getFullYear();
      const dayOfYear = Math.floor((today - new Date(currentYear, 0, 0)) / 1000 / 60 / 60 / 24);
      const daysInYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0 ? 366 : 365;

      // Calculate the average movies watched per day this year
      const avgMoviesPerDayThisYear = this.moviesWatchedThisYear / dayOfYear;

      // Estimate based on current year's average
      const remainingDays = daysInYear - dayOfYear;
      const estimateBasedOnCurrentYear = avgMoviesPerDayThisYear * remainingDays;

      // Calculate the average movies watched per week this year
      const avgMoviesPerWeekThisYear = this.moviesWatchedThisYear / (dayOfYear / 7);

      // Calculate the average movies watched per month this year
      const avgMoviesPerMonthThisYear = this.moviesWatchedThisYear / (dayOfYear / (daysInYear / 12));

      // Combine the estimates
      const combinedEstimate = (estimateBasedOnCurrentYear + avgMoviesPerWeekThisYear * (remainingDays / 7) + avgMoviesPerMonthThisYear * (remainingDays / (daysInYear / 12))) / 3;

      // Adjust the estimate based on recent viewing patterns
      const recentWeeksAdjustment = (this.moviesWatchedThisWeek + this.moviesWatchedLastWeek) / 2;
      const recentMonthsAdjustment = (this.moviesWatchedThisMonth + this.moviesWatchedLastMonth) / 2;

      const finalEstimate = this.moviesWatchedThisYear + (combinedEstimate + recentWeeksAdjustment * (remainingDays / 7) + recentMonthsAdjustment * (remainingDays / (daysInYear / 12))) / 3;

      return Math.round(finalEstimate);
    },
    moviesWatchedLastYear () {
      const year = new Date().getFullYear() - 1; // Get last year
      let count = 0;
      Object.keys(this.datesWithCounts).forEach(date => {
        const dateYear = +date.split('/')[2];
        if (dateYear === year) {
          count += this.datesWithCounts[date];
        }
      });
      return count;
    },
    ratingsCountData () {
      const rounded = this.resultsWithRatings.map((result) => {
        const roundedValue = Math.round((parseFloat(getRating(result).calculatedTotal)) * 2) / 2;
        if (isNaN(roundedValue)) {
          return 0;
        } else {
          return roundedValue;
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
    radarRatingsData () {
      const data = this.resultsWithRatings.map((result) => {
        const rating = getRating(result).calculatedTotal;
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
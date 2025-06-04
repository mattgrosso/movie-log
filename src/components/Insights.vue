<template>
  <div class="insights">
    <div class="home-link" @click="returnHome">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-left-fill" viewBox="0 0 16 16">
        <path d="m3.86 8.753 5.482 4.796c.646.566 1.658.106 1.658-.753V3.204a1 1 0 0 0-1.659-.753l-5.48 4.796a1 1 0 0 0 0 1.506z"/>
      </svg>
      <span>
        Home
      </span>
    </div>
    <InsightsPane>
      <div class="insights-pane-header">
        <p>Totals</p>
      </div>
      <div class="insights-pane-item-wrapper col-6">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">Total Movies</p>
          <p class="insights-pane-item-value">{{allEntriesWithFlatKeywordsAdded.length}}</p>
        </div>
      </div>
      <div class="insights-pane-item-wrapper col-6">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">Total Viewings</p>
          <p class="insights-pane-item-value">{{viewsCount}}</p>
        </div>
      </div>
      <div class="insights-pane-item-wrapper col-4">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">Highest Rating</p>
          <p class="insights-pane-item-value">{{highestRating}}</p>
        </div>
      </div>
      <div class="insights-pane-item-wrapper col-4">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">Average Rating</p>
          <p class="insights-pane-item-value">{{averageRating}}</p>
        </div>
      </div>
      <div class="insights-pane-item-wrapper col-4">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">Lowest Rating</p>
          <p class="insights-pane-item-value">{{lowestRating}}</p>
        </div>
      </div>
      <LineChart :chartData="ratingsCountData" :options="ratingsCountOptions"/>
    </InsightsPane>

    <InsightsPane>
      <div class="insights-pane-header">
        <p>View Counts</p>
      </div>
      <div class="insights-pane-item-wrapper col-6">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">This week</p>
          <p class="insights-pane-item-value">{{moviesWatchedThisWeek}}</p>
        </div>
      </div>
      <div class="insights-pane-item-wrapper col-6">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">Last Week</p>
          <p class="insights-pane-item-value">{{moviesWatchedLastWeek}}</p>
        </div>
      </div>
      <div class="insights-pane-item-wrapper col-6">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">Movies in {{thisMonth}}</p>
          <p class="insights-pane-item-value">{{moviesWatchedThisMonth}}</p>
        </div>
      </div>
      <div class="insights-pane-item-wrapper col-6">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">Movies in {{lastMonth}}</p>
          <p class="insights-pane-item-value">{{moviesWatchedLastMonth}}</p>
        </div>
      </div>
      <div class="insights-pane-item-wrapper col-6">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">{{thisYear}} to Date</p>
          <p class="insights-pane-item-value">{{moviesWatchedThisYear}}</p>
        </div>
      </div>
      <div class="insights-pane-item-wrapper col-6">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">{{lastYear}} to Same Date</p>
          <p class="insights-pane-item-value">{{moviesWatchedLastYearToDate}}</p>
        </div>
      </div>
      <div class="insights-pane-item-wrapper col-6">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">On Track This Year For</p>
          <p class="insights-pane-item-value">{{estimatedMoviesThisYear}}</p>
        </div>
      </div>
      <div class="insights-pane-item-wrapper col-6">
        <div class="insights-pane-item">
          <p class="insights-pane-item-header">{{lastYear}} Total</p>
          <p class="insights-pane-item-value">{{moviesWatchedLastYear}}</p>
        </div>
      </div>
    </InsightsPane>
    
    <InsightsPane>
      <div class="insights-pane-header">
        <p>Favorite Directors</p>
      </div>
      <FavoriteDirectors :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded" @updateSearchValue="updateSearchValue"/>
    </InsightsPane>

    <InsightsPane>
      <div class="insights-pane-header">
        <p>Favorite Actresses</p>
      </div>
      <FavoriteActresses :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded" @updateSearchValue="updateSearchValue"/>
    </InsightsPane>

    <InsightsPane>
      <div class="insights-pane-header">
        <p>Favorite Actors</p>
      </div>
      <FavoriteActors :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded" @updateSearchValue="updateSearchValue"/>
    </InsightsPane>

    <InsightsPane>
      <div class="insights-pane-header">
        <p>Favorite Writers</p>
      </div>
      <FavoriteWriters :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded" @updateSearchValue="updateSearchValue"/>
    </InsightsPane>

    <InsightsPane>
      <div class="insights-pane-header">
        <p>Favorite Cinematographers</p>
      </div>
      <FavoriteCinematographers :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded" @updateSearchValue="updateSearchValue"/>
    </InsightsPane>

    <InsightsPane>
      <div class="insights-pane-header">
        <p>Favorite Editors</p>
      </div>
      <FavoriteEditors :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded" @updateSearchValue="updateSearchValue"/>
    </InsightsPane>

    <InsightsPane>
      <div class="insights-pane-header">
        <p>Favorite Composers</p>
      </div>
      <FavoriteComposers :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded" @updateSearchValue="updateSearchValue"/>
    </InsightsPane>

    <InsightsPane>
      <div class="insights-pane-header">
        <p>Favorite Producers</p>
      </div>
      <FavoriteProducers :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded" @updateSearchValue="updateSearchValue"/>
    </InsightsPane>

    <InsightsPane>
      <div class="insights-pane-header">
        <p>Full Calendar</p>
      </div>
      <FullCalendarView :results="allEntriesWithFlatKeywordsAdded" :open="true" />
    </InsightsPane>

    <InsightsPane>
      <div class="insights-pane-header">
        <p>Yearly Averages</p>
      </div>
      <YearlyAverage :resultsWithRatings="resultsWithRatings"/>
    </InsightsPane>

    <InsightsPane>
      <div class="insights-pane-header">
        <p>Outliers</p>
      </div>
      <Outliers :resultsWithRatings="resultsWithRatings" :allCounts="allCounts" @updateSearchValue="updateSearchValue"/>
    </InsightsPane>

    <!-- <Settings/>
    <BulkTagEditor
      v-if="isMatt"
      :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"
    /> -->
  </div>
</template>

<script>
import Charts from "./Charts.vue";
import Outliers from "./Outliers.vue";
import YearlyAverage from "./YearlyAverage.vue";
import FullCalendarView from "./FullCalendarView.vue";
import Favorites from "./Favorites.vue";
import FavoriteActresses from "./FavoriteActresses.vue";
import FavoriteActors from "./FavoriteActors.vue";
import FavoriteDirectors from "./FavoriteDirectors.vue";
import FavoriteWriters from "./FavoriteWriters.vue";
import FavoriteEditors from "./FavoriteEditors.vue";
import FavoriteCinematographers from "./FavoriteCinematographers.vue";
import FavoriteComposers from "./FavoriteComposers.vue";
import FavoriteProducers from "./FavoriteProducers.vue";
import { getRating } from "../assets/javascript/GetRating.js";

import { Chart, registerables } from "chart.js";
import { BarChart, DoughnutChart, ScatterChart, RadarChart, LineChart } from "vue-chart-3";
import InsightsPane from "./InsightsPane.vue";
import uniq from 'lodash/uniq';

Chart.register(...registerables);

export default {
  name: "Insights",
  components: {
    Charts,
    LineChart,
    InsightsPane,
    Outliers,
    YearlyAverage,
    FullCalendarView,
    Favorites,
    FavoriteActresses,
    FavoriteActors,
    FavoriteDirectors,
    FavoriteWriters,
    FavoriteEditors,
    FavoriteCinematographers,
    FavoriteComposers,
    FavoriteProducers,
  },
  computed: {
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    allEntriesWithFlatKeywordsAdded () {
      return this.$store.getters.allMediaAsArray.map((result) => {
        if (this.currentLogIsTVLog) {
          return {
            ...result,
            tvShow: {
              ...this.topStructure(result),
              flatKeywords: this.topStructure(result).keywords ? this.topStructure(result).keywords.map((keyword) => keyword.name) : []
            }
          }
        } else {
          const flatTMDBKeywords = result.movie.keywords ? result.movie.keywords.map((keyword) => keyword.name) : [];
          const flatChatGPTKeywords = this.topStructure(result).chatGPTKeywords || [];
          const flatKeywords = uniq([...flatTMDBKeywords, ...flatChatGPTKeywords]);
          return {
            ...result,
            movie: {
              ...this.topStructure(result),
              flatKeywords: flatKeywords || []
            }
          }
        }
      });
    },
    movieOrTVShowDisplay () {
      if (this.currentLogIsTVLog) {
        return "TV show";
      } else {
        return "movie";
      }
    },
    allCounts () {
      return {
        keywords: this.countedKeywords,
        genres: this.countedGenres,
        years: this.countedYears,
        directors: this.countDirectors,
        castCrew: this.countCastCrew,
        studios: this.countStudios,
        mediums: this.allMediums,
        filmographies: this.allDirectors
      }
    },
    countedKeywords () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        if (this.topStructure(result).flatKeywords) {
          this.topStructure(result).flatKeywords.forEach((keyword) => {
            if (counts[keyword]) {
              counts[keyword]++;
            } else if (keyword) {
              counts[keyword] = 1;
            }
          })
        }
      })

      return counts;
    },
    countedGenres () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        if (this.topStructure(result).genres) {
          this.topStructure(result).genres.forEach((genre) => {
            if (counts[genre.name]) {
              counts[genre.name]++;
            } else if (genre.name) {
              counts[genre.name] = 1;
            }
          })
        }
      })

      return counts;
    },
    countedYears () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const year = this.getYear(result);
        if (counts[year]) {
          counts[year]++;
        } else if (year) {
          counts[year] = 1;
        }
      })

      return counts;
    },
    countDirectors () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        let director;
        if (this.currentLogIsTVLog) {
          director = result.tvShow.created_by?.[0].name;
        } else {
          director = result.movie.crew?.find((person) => person.job === "Director").name;
        }

        if (director) {
          if (counts[director]) {
            counts[director]++;
          } else if (director) {
            counts[director] = 1;
          }
        }
      })

      return counts;
    },
    countCastCrew () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const cast = this.topStructure(result).cast?.filter((person, index) => index < 10).map(person => person.name) || [];
        const crew = this.topStructure(result).crew?.filter((person, index) => index < 10).map(person => person.name) || [];
        const castCrewCombined = uniq([...cast, ...crew]);

        castCrewCombined.forEach((person) => {
          if (counts[person]) {
            counts[person]++;
          } else if (person) {
            counts[person] = 1;
          }
        })
      })

      return counts;
    },
    countStudios () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const productionCompanies = this.topStructure(result).production_companies?.map(company => company.name) || [];

        productionCompanies.forEach((company) => {
          if (counts[company]) {
            counts[company]++;
          } else if (company) {
            counts[company] = 1;
          }
        })
      })

      return counts;
    },
    countMediums () {
      const counts = {};

      if (this.currentLogIsTVLog) {
        return counts;
      }

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        result.ratings.forEach((rating) => {
          if (counts[rating.medium]) {
            counts[rating.medium]++;
          } else if (rating.medium) {
            counts[rating.medium] = 1;
          }
        })
      })

      return counts;
    },
    allDirectors () {
      if (this.currentLogIsTVLog) {
        return [];
      }

      return Object.keys(this.countDirectors).map((keyword) => {
        const filmography = this.allEntriesWithFlatKeywordsAdded.find((entry) => {
          return entry.movie.crew.find((person) => person.job === "Director" && person.name === keyword);
        }).movie.crew.find((person) => person.name === keyword && person.filmography)?.filmography;

        return {
          name: this.titleCase(keyword),
          count: this.countDirectors[keyword],
          filmography: filmography ? filmography.filter((film) => new Date(film.release_date) < new Date() && film.popularity > 8.65) : []
        }
      });
    },
    allMediums () {
      const mediums = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        if (!this.currentLogIsTVLog) {
          result.ratings.forEach((rating) => {
            if (!rating.medium) {
              return;
            } else if (mediums[rating.medium]) {
              mediums[rating.medium]++;
            } else {
              mediums[rating.medium] = 1;
            }
          })
        }
      })

      return Object.keys(mediums).map((medium) => {
        return {
          name: this.titleCase(medium),
          count: mediums[medium]
        }
      });
    },
    viewsCount () {
      return this.allEntriesWithFlatKeywordsAdded.reduce((total, result) => {
        return total + (result.ratings ? result.ratings.length : 0);
      }, 0);
    },
    highestRating () {
      const ratedMovies = this.allEntriesWithFlatKeywordsAdded.filter((result) => this.mostRecentRating(result).calculatedTotal);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
      return Math.max(...ratings).toFixed(2);
    },
    lowestRating () {
      const ratedMovies = this.allEntriesWithFlatKeywordsAdded.filter((result) => this.mostRecentRating(result).calculatedTotal);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
      return Math.min(...ratings).toFixed(2);
    },
    averageRating () {
      const ratedMovies = this.allEntriesWithFlatKeywordsAdded.filter((result) => this.mostRecentRating(result).calculatedTotal);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
      const total = ratings.reduce((a, b) => a + b, 0);
      return (total / ratings.length).toFixed(2);
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
    thisMonth () {
      const today = new Date();
      return today.toLocaleString('default', { month: 'long' }); // e.g., "June"
    },
    lastMonth () {
      const today = new Date();
      today.setMonth(today.getMonth() - 1);
      return today.toLocaleString('default', { month: 'long' }); // e.g., "May"
    },
    thisYear () {
      return new Date().getFullYear(); // e.g., 2025
    },
    lastYear () {
      return new Date().getFullYear() - 1; // e.g., 2024
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
      today.setMonth(today.getMonth() - 1);
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
    moviesWatchedLastYearToDate () {
      const today = new Date();
      const lastYear = today.getFullYear() - 1;
      // Get the same month and day as today, but in last year
      const cutoff = new Date(lastYear, today.getMonth(), today.getDate(), 23, 59, 59, 999);
      let count = 0;
      Object.keys(this.datesWithCounts).forEach(date => {
        const [month, day, year] = date.split('/').map(Number);
        const entryDate = new Date(year, month - 1, day);
        if (year === lastYear && entryDate <= cutoff) {
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
    resultsWithRatings () {
      return this.allEntriesWithFlatKeywordsAdded.filter((result) => getRating(result).calculatedTotal);
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

      const color = "#5bc62b";

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
  },
  methods: {
    returnHome () {
      this.$store.commit("setShowHeader", true);
      this.$router.push({ path: '/', query: { noRandom: 'true', movieDbKey: this.dbEntry?.path?.split("movieLog/")[1] } });
    },
    updateSearchValue (value) {
      // Navigate to Home and set the search value as a query parameter
      this.$router.push({ name: 'Home', query: { search: encodeURIComponent(value) } });
    },
    topStructure (result) {
      if (this.currentLogIsTVLog) {
        return result.tvShow;
      } else {
        return result.movie;
      }
    },
    mostRecentRating (media) {
      return getRating(media);
    },
    averageRating (results) {
      const ratedMovies = results.filter((result) => this.mostRecentRating(result).calculatedTotal);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
      const total = ratings.reduce((a, b) => a + b, 0);
      return (total / ratings.length).toFixed(2);
    },
    updateSearchValue (value) {
      // Navigate to Home and set the search value as a query parameters
      this.$router.push({ name: 'Home', query: { search: encodeURIComponent(value) } });
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
    titleCase (input) {
      const string = input.toString();
      return string.replace(
        /\w\S*/g,
        function (txt) {
          return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
      );
    }
  },
};
</script>

<style lang="scss">
  .insights {
    color: white;
    padding: 18px;

    .home-link {
      align-items: center;
      column-gap: 4px;
      cursor: pointer;
      display: flex;
      left: 6px;
      position: absolute;
      top: 6px;
    }
  }
</style>
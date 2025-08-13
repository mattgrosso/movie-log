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
          <p class="insights-pane-item-value">{{filteredEntriesWithFlatKeywordsAdded.length}}</p>
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

    <InsightsPane v-if="completedAwardsYears.length > 0">
      <div class="insights-pane-header">
        <p>Personal Awards Results</p>
      </div>
      <div class="awards-year-selector mb-3 w-100">
        <div class="form-floating" data-bs-theme="dark">
          <select id="awards-year-select" class="form-select w-100" v-model="selectedAwardsYear">
            <option v-for="year in completedAwardsYears" :key="year" :value="year">
              {{ year }}
            </option>
          </select>
          <label for="awards-year-select">Select Year</label>
        </div>
        <button 
          v-if="hasEligibleYears && isWithinDailyLimit" 
          class="btn btn-outline-warning btn-sm mt-2 w-100"
          @click="startNewAwards"
        >
          <i class="fas fa-trophy"></i>
          Start New Awards (Override Daily Limit)
        </button>
      </div>
      <div v-if="selectedAwardsData" class="awards-results">
        <div v-for="category in awardCategories" :key="category.key" class="award-category mb-3">
          <h6 class="category-title mb-2">{{ category.name }}</h6>
          <div v-if="selectedAwardsData[category.key]" class="category-results">
            <div class="award-display d-flex align-items-start">
              <!-- Winner Poster -->
              <div v-if="selectedAwardsData[category.key].winner" class="winner-section me-3">
                <div class="winner-poster">
                  <img 
                    v-if="getMoviePoster(selectedAwardsData[category.key].winner)"
                    :src="getMoviePoster(selectedAwardsData[category.key].winner)" 
                    :alt="getOptionTitle(selectedAwardsData[category.key].winner)"
                    class="poster-img"
                  >
                  <div v-else class="poster-placeholder">
                    {{ getOptionTitle(selectedAwardsData[category.key].winner).charAt(0) }}
                  </div>
                  <div class="winner-badge">WINNER</div>
                </div>
                <div v-if="isPersonCategory(category.key)" class="winner-title mt-1">
                  {{ getPersonTitle(selectedAwardsData[category.key].winner) }}<br/>
                  ({{ getMovieTitle(selectedAwardsData[category.key].winner) }})
                </div>
              </div>

              <!-- Nominees List -->
              <div v-if="getNomineesExcludingWinner(selectedAwardsData[category.key]).length > 0" class="nominees-section flex-grow-1">
                <div class="nominees-label">Also nominated:</div>
                <ul class="nominees-list mb-0">
                  <li v-for="nominee in getNomineesExcludingWinner(selectedAwardsData[category.key])" 
                      :key="getOptionId(nominee)"
                      class="nominee-item">
                    <span v-if="isPersonCategory(category.key)">{{ getPersonTitle(nominee) }} ({{ getMovieTitle(nominee) }})</span>
                    <span v-else>{{ getOptionTitle(nominee) }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div v-else class="no-data">
            <em>No data for this category</em>
          </div>
        </div>
      </div>
    </InsightsPane>

    <InsightsPane>
      <div class="insights-pane-header">
        <p>Custom Scatter Plot</p>
      </div>
      <ScatterChart :chartData="scatterPlotData" :options="scatterPlotOptions"/>
      <div class="scatter-controls mt-3">
        <div class="row g-2">
          <div class="col-12">
            <button class="btn btn-outline-light w-100 scatter-button" @click="randomizeAxes" title="Random Axes">
              <i class="bi bi-shuffle"/>
            </button>
          </div>
          <div class="col-12">
            <div class="form-floating" data-bs-theme="dark">
              <select id="x-axis-select" class="form-select scatter-select" v-model="selectedXAxis">
                <option v-for="option in axisOptions" :key="option.key" :value="option.key">
                  {{ option.label }}
                </option>
              </select>
              <label for="x-axis-select">X-Axis</label>
            </div>
          </div>
          <div class="col-12">
            <div class="form-floating" data-bs-theme="dark">
              <select id="y-axis-select" class="form-select scatter-select" v-model="selectedYAxis">
                <option v-for="option in axisOptions" :key="option.key" :value="option.key">
                  {{ option.label }}
                </option>
              </select>
              <label for="y-axis-select">Y-Axis</label>
            </div>
          </div>
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
  </div>
</template>

<script>
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
    LineChart,
    ScatterChart,
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
  data() {
    return {
      selectedXAxis: 'runtime', // Will be randomized on mount
      selectedYAxis: 'userRating', // Will be randomized on mount
      selectedAwardsYear: null,
      axisOptions: [
        { key: 'runtime', label: 'Runtime (minutes)' },
        { key: 'releaseYear', label: 'Release Year' },
        { key: 'userRating', label: 'User Rating' },
        { key: 'releaseMonth', label: 'Release Month' },
        { key: 'genreCount', label: 'Genre Count' },
        { key: 'castSize', label: 'Cast Size' },
        { key: 'daysSinceRelease', label: 'Days Since Release' },
        { key: 'titleLength', label: 'Title Length (characters)' },
        { key: 'viewCount', label: 'View Count' },
        { key: 'love', label: 'Love Rating' },
        { key: 'story', label: 'Story Rating' },
        { key: 'direction', label: 'Direction Rating' },
        { key: 'imagery', label: 'Imagery Rating' },
        { key: 'performance', label: 'Performance Rating' },
        { key: 'soundtrack', label: 'Soundtrack Rating' },
        { key: 'stickiness', label: 'Stickiness Rating' },
        { key: 'cerebralScale', label: 'Instinctual ↔ Cerebral' },
        { key: 'blockbusterScale', label: 'Indie ↔ Blockbuster' },
        { key: 'mainstreamScale', label: 'Arthouse ↔ Mainstream' },
        { key: 'comfortScale', label: 'Challenge ↔ Comfort' },
        { key: 'styleScale', label: 'Substance ↔ Style' },
        { key: 'groundedScale', label: 'Fantastical ↔ Grounded' },
        { key: 'classicScale', label: 'Contemporary ↔ Classic' },
        { key: 'upliftingScale', label: 'Melancholy ↔ Uplifting' },
        { key: 'tenseScale', label: 'Relaxing ↔ Tense' },
        { key: 'hopefulScale', label: 'Cynical ↔ Hopeful' },
        { key: 'simpleScale', label: 'Complex ↔ Simple' },
        { key: 'characterScale', label: 'Plot-Driven ↔ Character-Driven' },
        { key: 'linearScale', label: 'Non-Linear ↔ Linear' },
        { key: 'universalScale', label: 'Niche ↔ Universal' },
        { key: 'escapistScale', label: 'Realistic ↔ Escapist' },
        { key: 'polishedScale', label: 'Raw ↔ Polished' },
        { key: 'familiarScale', label: 'Innovative ↔ Familiar' },
        { key: 'minimalistScale', label: 'Maximalist ↔ Minimalist' }
      ]
    };
  },
  mounted() {
    // Set random axes on page load
    this.randomizeAxes();
  },
  computed: {
    completedAwardsYears() {
      // Get all years that have completed personal awards
      const personalAwards = this.$store.state.settings.personalAwards;
      if (!personalAwards) return [];
      
      const years = Object.keys(personalAwards)
        .filter(year => personalAwards[year].completed)
        .map(year => parseInt(year))
        .sort((a, b) => b - a); // Most recent first
        
      // Set default selected year to random year if not already set
      if (years.length > 0 && !this.selectedAwardsYear) {
        const randomIndex = Math.floor(Math.random() * years.length);
        this.selectedAwardsYear = years[randomIndex];
      }
      
      return years;
    },
    selectedAwardsData() {
      if (!this.selectedAwardsYear) return null;
      return this.$store.state.settings.personalAwards?.[this.selectedAwardsYear]?.categories;
    },
    awardCategories() {
      return [
        { key: 'bestPicture', name: 'Best Picture' },
        { key: 'bestDirector', name: 'Best Director' },
        { key: 'bestActor', name: 'Best Actor' },
        { key: 'bestActress', name: 'Best Actress' },
        { key: 'bestSupportingActor', name: 'Best Supporting Actor' },
        { key: 'bestSupportingActress', name: 'Best Supporting Actress' },
        { key: 'bestScreenplay', name: 'Best Screenplay or Writing' },
        { key: 'bestCinematography', name: 'Best Cinematography' },
        { key: 'bestEditing', name: 'Best Editing' },
        { key: 'bestScore', name: 'Best Score or Music' },
        { key: 'bestVisualEffects', name: 'Best Visual Effects or Production Design' },
        { key: 'bestAnimatedFeature', name: 'Best Animated Feature' },
        { key: 'bestDocumentaryFeature', name: 'Best Documentary Feature' }
      ];
    },
    includeShorts() {
      // Default to false if not set
      return this.$store.state.settings.includeShorts === true;
    },
    filteredEntriesWithFlatKeywordsAdded() {
      if (this.includeShorts) return this.allEntriesWithFlatKeywordsAdded;
      // Exclude shorts: genre 'Short' or runtime <= 40
      return this.allEntriesWithFlatKeywordsAdded.filter(result => {
        const structure = this.topStructure(result);
        const genres = structure.genres || [];
        const isShortGenre = genres.some(g => g.name && g.name.toLowerCase() === 'short');
        const runtime = structure.runtime;
        return !isShortGenre && !(runtime && runtime <= 40);
      });
    },
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
      return this.filteredEntriesWithFlatKeywordsAdded.reduce((total, result) => {
        return total + (result.ratings ? result.ratings.length : 0);
      }, 0);
    },
    highestRating () {
      const ratedMovies = this.filteredEntriesWithFlatKeywordsAdded.filter((result) => this.mostRecentRating(result).calculatedTotal);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
      return Math.max(...ratings).toFixed(2);
    },
    lowestRating () {
      const ratedMovies = this.filteredEntriesWithFlatKeywordsAdded.filter((result) => this.mostRecentRating(result).calculatedTotal);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
      return Math.min(...ratings).toFixed(2);
    },
    averageRating () {
      const ratedMovies = this.filteredEntriesWithFlatKeywordsAdded.filter((result) => this.mostRecentRating(result).calculatedTotal);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
      const total = ratings.reduce((a, b) => a + b, 0);
      return (total / ratings.length).toFixed(2);
    },
    datesWithCounts () {
      const datesWithCounts = {};

      for (const result of this.filteredEntriesWithFlatKeywordsAdded) {
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
    scatterPlotData() {
      const data = this.filteredEntriesWithFlatKeywordsAdded.map(result => {
        const xValue = this.getAxisValue(result, this.selectedXAxis);
        const yValue = this.getAxisValue(result, this.selectedYAxis);
        
        // Only include points where both x and y values exist
        if (xValue !== null && yValue !== null) {
          return {
            x: xValue,
            y: yValue,
            label: this.topStructure(result).title || 'Unknown Title'
          };
        }
        return null;
      }).filter(point => point !== null);

      return {
        datasets: [{
          label: 'Movies',
          data: data,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      };
    },
    scatterPlotOptions() {
      const xAxisOption = this.axisOptions.find(opt => opt.key === this.selectedXAxis);
      const yAxisOption = this.axisOptions.find(opt => opt.key === this.selectedYAxis);
      
      // Check if either axis is a qualitative scale
      const qualitativeScales = ['cerebralScale', 'blockbusterScale', 'mainstreamScale', 'comfortScale', 'styleScale', 'groundedScale', 'classicScale', 'upliftingScale', 'tenseScale', 'hopefulScale', 'simpleScale', 'characterScale', 'linearScale', 'universalScale', 'escapistScale', 'polishedScale', 'familiarScale', 'minimalistScale'];
      const xIsQualitative = qualitativeScales.includes(this.selectedXAxis);
      const yIsQualitative = qualitativeScales.includes(this.selectedYAxis);
      
      return {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: false,
            text: `${yAxisOption?.label || 'Y'} vs ${xAxisOption?.label || 'X'}`,
            color: 'white'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.raw.label;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: true,
              text: xAxisOption?.label || 'X-Axis',
              color: 'white'
            },
            ticks: {
              color: 'white',
              display: !xIsQualitative // Hide ticks for qualitative scales
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ...(xIsQualitative && {
              min: -10,
              max: 10
            })
          },
          y: {
            title: {
              display: true,
              text: yAxisOption?.label || 'Y-Axis',
              color: 'white'
            },
            ticks: {
              color: 'white',
              display: !yIsQualitative // Hide ticks for qualitative scales
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ...(yIsQualitative && {
              min: -10,
              max: 10
            })
          }
        }
      };
    },
    hasEligibleYears() {
      // Check if there are any incomplete years that could have awards
      const yearsEligibleForAwards = this.allEntriesWithFlatKeywordsAdded
        .map(entry => new Date(entry.movie.release_date).getFullYear())
        .filter(year => year >= 2010) // Or whatever your earliest year is
        .filter((year, index, array) => array.indexOf(year) === index) // Unique years
        .sort((a, b) => b - a);
      
      return yearsEligibleForAwards.some(year => {
        const existingAwards = this.$store.state.settings.personalAwards?.[year];
        return !existingAwards?.completed;
      });
    },
    isWithinDailyLimit() {
      const settings = this.$store.state.settings;
      const today = new Date().toDateString();
      const lastAwardDate = settings.lastAwardCompletionDate;
      
      // Return true if we're within the daily limit (i.e., already completed awards today)
      return lastAwardDate === today;
    },
  },
  methods: {
    returnHome () {
      this.$store.commit("setShowHeader", true);
      this.$router.push({ path: '/', query: { movieDbKey: this.dbEntry?.path?.split("movieLog/")[1] } });
    },
    randomizeAxes() {
      const availableOptions = this.axisOptions.map(opt => opt.key);
      
      // Get two different random axes
      const randomX = availableOptions[Math.floor(Math.random() * availableOptions.length)];
      let randomY = availableOptions[Math.floor(Math.random() * availableOptions.length)];
      
      // Ensure Y is different from X
      while (randomY === randomX) {
        randomY = availableOptions[Math.floor(Math.random() * availableOptions.length)];
      }
      
      this.selectedXAxis = randomX;
      this.selectedYAxis = randomY;
    },
    getOptionTitle(option) {
      // Helper method to get the title of an award nominee/winner
      if (!option) return '';
      return option.name || option.movie?.title || 'Unknown';
    },
    getOptionId(option) {
      // Helper method to get unique ID for an award nominee/winner
      if (!option) return '';
      return option.id || option.movie?.id || Math.random().toString(36);
    },
    getMoviePoster(option) {
      // Helper method to get movie poster URL
      if (!option) return null;
      
      // For person awards (actors, directors, etc.)
      if (option.details?.profile_path) {
        return `https://image.tmdb.org/t/p/w185${option.details.profile_path}`;
      }
      
      // For movie awards
      if (option.movie?.poster_path) {
        return `https://image.tmdb.org/t/p/w185${option.movie.poster_path}`;
      }
      
      return null;
    },
    getNomineesExcludingWinner(categoryData) {
      // Filter nominees to exclude the winner to avoid duplication
      if (!categoryData?.nominees || !categoryData.winner) {
        return categoryData?.nominees || [];
      }
      
      const winnerId = this.getOptionId(categoryData.winner);
      return categoryData.nominees.filter(nominee => this.getOptionId(nominee) !== winnerId);
    },
    isPersonCategory(categoryKey) {
      // Determine if this category is for people (actors, directors, etc) vs movies
      const personCategories = ['bestDirector', 'bestActor', 'bestActress', 'bestSupportingActor', 'bestSupportingActress'];
      return personCategories.includes(categoryKey);
    },
    getPersonTitle(option) {
      // Get person name and movie for person categories
      if (!option) return '';
      return option.name || 'Unknown';
    },
    async startNewAwards() {
      // Override the daily limit by clearing the last completion date
      await this.$store.dispatch('setDBValue', {
        path: 'settings/lastAwardCompletionDate',
        value: null
      });
      
      // Navigate to home page which will now show the awards prompt
      this.$router.push('/');
    },
    getMovieTitle(option) {
      // Get movie title for movie categories
      if (!option) return '';
      return option.movie?.title || 'Unknown Movie';
    },
    mostRecentRating (media) {
      return getRating(media);
    },
    updateSearchValue (value) {
      // Navigate to Home and set the search value as a query parameter
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
    },
    topStructure (media) {
      // For insights, we're only dealing with movies
      return media.movie;
    },
    getAxisValue(result, axisKey) {
      const structure = this.topStructure(result);
      const rating = this.mostRecentRating(result);
      
      switch (axisKey) {
        case 'runtime':
          return structure.runtime || null;
        case 'releaseYear':
          return structure.release_date ? new Date(structure.release_date).getFullYear() : null;
        case 'userRating':
          return rating.calculatedTotal ? parseFloat(rating.calculatedTotal) : null;
        case 'releaseMonth':
          return structure.release_date ? new Date(structure.release_date).getMonth() + 1 : null;
        case 'genreCount':
          return structure.genres ? structure.genres.length : 0;
        case 'castSize':
          return structure.cast ? structure.cast.length : 0;
        case 'daysSinceRelease':
          if (structure.release_date) {
            const releaseDate = new Date(structure.release_date);
            const today = new Date();
            return Math.floor((today - releaseDate) / (1000 * 60 * 60 * 24));
          }
          return null;
        case 'titleLength':
          return structure.title ? structure.title.length : 0;
        case 'viewCount':
          return result.ratings ? result.ratings.length : 1;
        case 'love':
          return rating.love || null;
        case 'story':
          return rating.story || null;
        case 'direction':
          return rating.direction || null;
        case 'imagery':
          return rating.imagery || null;
        case 'performance':
          return rating.performance || null;
        case 'soundtrack':
          return rating.soundtrack || null;
        case 'stickiness':
          return rating.stickiness || null;
        case 'cerebralScale':
          return this.calculateCerebralScale(structure);
        case 'blockbusterScale':
          return this.calculateBlockbusterScale(structure);
        case 'mainstreamScale':
          return this.calculateMainstreamScale(structure);
        case 'comfortScale':
          return this.calculateComfortScale(structure);
        case 'styleScale':
          return this.calculateStyleScale(structure);
        case 'groundedScale':
          return this.calculateGroundedScale(structure);
        case 'classicScale':
          return this.calculateClassicScale(structure);
        case 'upliftingScale':
          return this.calculateUpliftingScale(structure);
        case 'tenseScale':
          return this.calculateTenseScale(structure);
        case 'hopefulScale':
          return this.calculateHopefulScale(structure);
        case 'simpleScale':
          return this.calculateSimpleScale(structure);
        case 'characterScale':
          return this.calculateCharacterScale(structure);
        case 'linearScale':
          return this.calculateLinearScale(structure);
        case 'universalScale':
          return this.calculateUniversalScale(structure);
        case 'escapistScale':
          return this.calculateEscapistScale(structure);
        case 'polishedScale':
          return this.calculatePolishedScale(structure);
        case 'familiarScale':
          return this.calculateFamiliarScale(structure);
        case 'minimalistScale':
          return this.calculateMinimalistScale(structure);
        default:
          return null;
      }
    },
    calculateCerebralScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const runtime = movie.runtime || 90;
      
      // Cerebral indicators (+) with weighted values
      const cerebralGenres = [
        { name: 'documentary', weight: 2.8 },
        { name: 'drama', weight: 1.4 },
        { name: 'history', weight: 2.2 },
        { name: 'war', weight: 1.8 },
        { name: 'biography', weight: 2.1 }
      ];
      const cerebralKeywords = [
        { name: 'philosophy', weight: 1.7 },
        { name: 'politics', weight: 1.5 },
        { name: 'paranoia', weight: 1.9 },
        { name: 'dystopia', weight: 1.8 },
        { name: 'investigation', weight: 1.6 },
        { name: 'memory', weight: 1.4 },
        { name: 'psychology', weight: 1.8 },
        { name: 'conspiracy', weight: 1.5 },
        { name: 'time travel', weight: 1.3 },
        { name: 'based on true story', weight: 1.2 },
        { name: 'biography', weight: 1.1 }
      ];
      
      cerebralGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      cerebralKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Instinctual indicators (-) with weighted values
      const instinctualGenres = [
        { name: 'action', weight: -2.3 },
        { name: 'horror', weight: -1.9 },
        { name: 'thriller', weight: -1.1 },
        { name: 'comedy', weight: -1.7 },
        { name: 'adventure', weight: -1.5 }
      ];
      const instinctualKeywords = [
        { name: 'martial arts', weight: -2.2 },
        { name: 'chase', weight: -1.8 },
        { name: 'fight', weight: -1.6 },
        { name: 'explosion', weight: -1.4 },
        { name: 'gun', weight: -1.2 },
        { name: 'violence', weight: -1.5 },
        { name: 'rescue', weight: -1.1 },
        { name: 'showdown', weight: -1.3 },
        { name: 'survival', weight: -1.0 },
        { name: 'escape', weight: -0.9 }
      ];
      
      instinctualGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      instinctualKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Add runtime factor (longer films tend to be more cerebral)
      score += (runtime - 100) * 0.01;
      
      // Add some random variation based on title hash for uniqueness
      const titleHash = movie.title ? movie.title.length * 0.13 : 0;
      score += (titleHash % 1) * 0.4 - 0.2;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateBlockbusterScale(movie) {
      let score = 0;
      const companies = movie.production_companies || [];
      const cast = movie.cast || [];
      const budget = movie.budget || 0;
      const runtime = movie.runtime || 90;
      
      // Blockbuster indicators (+) with weighted values - using actual companies from collection
      const majorStudios = [
        { name: 'walt disney', weight: 3.8 },
        { name: 'warner bros', weight: 3.2 },
        { name: 'universal', weight: 3.5 },
        { name: 'paramount', weight: 2.9 },
        { name: 'sony', weight: 2.7 },
        { name: 'columbia pictures', weight: 3.0 },
        { name: 'twentieth century fox', weight: 3.1 },
        { name: 'marvel', weight: 4.2 },
        { name: 'lucasfilm', weight: 3.9 },
        { name: 'touchstone pictures', weight: 2.8 },
        { name: 'dreamworks', weight: 3.1 }
      ];
      
      majorStudios.forEach(studio => {
        if (companies.some(c => c.name && c.name.toLowerCase().includes(studio.name))) {
          score += studio.weight;
        }
      });
      
      // Cast size factor (continuous)
      score += Math.min(cast.length * 0.15, 3.0);
      
      // Budget factor (continuous)
      if (budget > 0) {
        score += Math.min(Math.log10(budget) - 6, 4.0); // Log scale for budget
      }
      
      // Indie indicators (-) with weighted values - using actual companies from collection
      const indieStudios = [
        { name: 'a24', weight: -3.7 },
        { name: 'focus features', weight: -2.8 },
        { name: 'fox searchlight', weight: -2.9 },
        { name: 'searchlight', weight: -2.9 },
        { name: 'annapurna', weight: -3.1 },
        { name: 'neon', weight: -3.4 },
        { name: 'bleecker street', weight: -2.6 },
        { name: 'miramax', weight: -2.7 },
        { name: 'summit entertainment', weight: -2.3 },
        { name: 'roadside attractions', weight: -2.8 }
      ];
      
      indieStudios.forEach(studio => {
        if (companies.some(c => c.name && c.name.toLowerCase().includes(studio.name))) {
          score += studio.weight;
        }
      });
      
      // Small cast penalty (continuous)
      if (cast.length < 15) {
        score -= (15 - cast.length) * 0.12;
      }
      
      // Low budget factor
      if (budget > 0 && budget < 10000000) {
        score -= Math.min((10000000 - budget) / 2000000, 3.0);
      }
      
      // Runtime factor (blockbusters tend to be longer)
      score += (runtime - 100) * 0.008;
      
      // Title-based variation for uniqueness
      const titleVariation = movie.title ? (movie.title.charCodeAt(0) % 100) * 0.02 - 1.0 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateMainstreamScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const language = movie.original_language || 'en';
      const keywords = movie.flatKeywords || [];
      const budget = movie.budget || 0;
      
      // Mainstream indicators (+) with weighted values
      const popularGenres = [
        { name: 'action', weight: 2.3 },
        { name: 'comedy', weight: 2.8 },
        { name: 'adventure', weight: 2.1 },
        { name: 'animation', weight: 2.4 },
        { name: 'family', weight: 2.9 }
      ];
      
      popularGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      
      // Language factor with nuance
      if (language === 'en') {
        score += 2.3;
      } else {
        score -= 1.8; // Non-English penalty
      }
      
      // Arthouse indicators (-) with weighted values
      const arthouseGenres = [
        { name: 'drama', weight: -1.2 },
        { name: 'documentary', weight: -2.7 },
        { name: 'foreign', weight: -2.1 }
      ];
      const arthouseKeywords = [
        { name: 'festival', weight: -2.4 },
        { name: 'cannes', weight: -2.8 },
        { name: 'sundance', weight: -2.2 },
        { name: 'experimental', weight: -2.6 },
        { name: 'avant-garde', weight: -2.9 },
        { name: 'independent film', weight: -2.1 },
        { name: 'black and white', weight: -1.8 },
        { name: 'foreign language film', weight: -2.0 },
        { name: 'art', weight: -1.5 },
        { name: 'surrealism', weight: -2.3 },
        { name: 'minimalism', weight: -1.9 }
      ];
      
      arthouseGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      arthouseKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Budget factor (mainstream films often have bigger budgets)
      if (budget > 0) {
        score += Math.min((budget / 50000000), 1.5);
      }
      
      // Genre count factor (arthouse films often have fewer genres)
      const genreCount = genres.length;
      if (genreCount <= 2) {
        score -= 0.8; // Fewer genres = more arthouse
      } else if (genreCount >= 4) {
        score += 0.6; // More genres = more mainstream
      }
      
      // Title-based variation
      const titleLength = movie.title ? movie.title.length : 20;
      score += (titleLength * 0.037) % 0.8 - 0.4;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateComfortScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const runtime = movie.runtime || 90;
      
      // Comfort indicators (+) with weighted values
      const comfortGenres = [
        { name: 'comedy', weight: 2.6 },
        { name: 'family', weight: 3.1 },
        { name: 'animation', weight: 2.8 },
        { name: 'romance', weight: 2.3 },
        { name: 'adventure', weight: 1.7 }
      ];
      const comfortKeywords = [
        { name: 'friendship', weight: 2.1 },
        { name: 'wedding', weight: 1.8 },
        { name: 'christmas', weight: 2.2 },
        { name: 'holiday', weight: 1.9 },
        { name: 'happy ending', weight: 2.0 },
        { name: 'school', weight: 1.6 },
        { name: 'romantic comedy', weight: 1.7 },
        { name: 'coming of age', weight: 1.5 },
        { name: 'feel good', weight: 1.8 }
      ];
      
      comfortGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      comfortKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Challenge indicators (-) with weighted values
      const challengeGenres = [
        { name: 'horror', weight: -2.7 },
        { name: 'thriller', weight: -1.4 },
        { name: 'war', weight: -2.2 },
        { name: 'crime', weight: -1.8 }
      ];
      const challengeKeywords = [
        { name: 'murder', weight: -2.4 },
        { name: 'violence', weight: -2.1 },
        { name: 'death', weight: -1.8 },
        { name: 'revenge', weight: -1.9 },
        { name: 'betrayal', weight: -1.7 },
        { name: 'torture', weight: -2.6 },
        { name: 'dystopia', weight: -2.0 },
        { name: 'alcoholism', weight: -1.8 },
        { name: 'suicide', weight: -2.2 },
        { name: 'tragedy', weight: -1.6 },
        { name: 'prison', weight: -1.5 }
      ];
      
      challengeGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      challengeKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Runtime factor (shorter films often more comfortable)
      score += (100 - runtime) * 0.005;
      
      // Title-based variation
      const titleHash = movie.title ? movie.title.replace(/\s/g, '').length * 0.17 : 0;
      score += (titleHash % 1) * 0.6 - 0.3;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateStyleScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const budget = movie.budget || 0;
      const runtime = movie.runtime || 100;
      
      // Style indicators (+) with weighted values
      const visualGenres = [
        { name: 'fantasy', weight: 2.4 },
        { name: 'science fiction', weight: 2.1 },
        { name: 'action', weight: 1.8 },
        { name: 'adventure', weight: 1.7 }
      ];
      const styleKeywords = [
        { name: 'visual effects', weight: 2.3 },
        { name: 'special effects', weight: 2.2 },
        { name: 'computer animation', weight: 2.0 },
        { name: 'cinematography', weight: 1.9 },
        { name: 'cgi', weight: 2.1 },
        { name: 'superhero', weight: 1.8 },
        { name: 'spectacle', weight: 1.7 },
        { name: 'epic', weight: 1.6 },
        { name: 'costume design', weight: 1.4 }
      ];
      
      visualGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      styleKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Budget factor (continuous)
      if (budget > 0) {
        score += Math.min((budget / 50000000) * 1.8, 3.2); // High budget often means visual spectacle
      }
      
      // Substance indicators (-) with weighted values
      const substanceGenres = [
        { name: 'drama', weight: -2.1 },
        { name: 'biography', weight: -2.4 },
        { name: 'history', weight: -1.9 }
      ];
      const substanceKeywords = [
        { name: 'character study', weight: -2.6 },
        { name: 'based on true story', weight: -2.2 },
        { name: 'biography', weight: -2.4 },
        { name: 'friendship', weight: -1.8 },
        { name: 'marriage', weight: -1.6 },
        { name: 'family relationships', weight: -1.7 },
        { name: 'coming of age', weight: -1.5 },
        { name: 'father son relationship', weight: -1.9 },
        { name: 'mother daughter relationship', weight: -1.8 },
        { name: 'divorce', weight: -1.4 }
      ];
      
      substanceGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      substanceKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Runtime factor (epic films often emphasize style)
      score += (runtime - 100) * 0.006;
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.length * 0.09) % 0.7 - 0.35 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateGroundedScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const language = movie.original_language || 'en';
      const budget = movie.budget || 0;
      
      // Grounded indicators (+) with weighted values
      const realisticGenres = [
        { name: 'drama', weight: 2.3 },
        { name: 'biography', weight: 2.8 },
        { name: 'documentary', weight: 3.1 },
        { name: 'history', weight: 2.4 },
        { name: 'crime', weight: 1.9 }
      ];
      const groundedKeywords = [
        { name: 'based on true story', weight: 2.7 },
        { name: 'biography', weight: 2.5 },
        { name: 'new york city', weight: 1.8 },
        { name: 'los angeles', weight: 1.6 },
        { name: 'police', weight: 1.9 },
        { name: 'hospital', weight: 1.7 },
        { name: 'journalist', weight: 1.8 },
        { name: 'courtroom', weight: 1.9 },
        { name: 'workplace', weight: 1.5 },
        { name: 'contemporary', weight: 1.6 }
      ];
      
      realisticGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      groundedKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Language factor (non-English often more grounded)
      if (language !== 'en') {
        score += 1.3;
      }
      
      // Budget factor (lower budget often more grounded)
      if (budget > 0 && budget < 20000000) {
        score += Math.min((20000000 - budget) / 10000000, 1.8);
      }
      
      // Fantastical indicators (-) with weighted values
      const fantasticalGenres = [
        { name: 'fantasy', weight: -2.9 },
        { name: 'science fiction', weight: -2.6 },
        { name: 'animation', weight: -2.2 },
        { name: 'horror', weight: -1.7 }
      ];
      const fantasticalKeywords = [
        { name: 'magic', weight: -2.4 },
        { name: 'supernatural', weight: -2.1 },
        { name: 'future', weight: -1.9 },
        { name: 'alien', weight: -2.3 },
        { name: 'monster', weight: -1.8 },
        { name: 'superhero', weight: -2.2 },
        { name: 'time travel', weight: -2.0 },
        { name: 'space', weight: -1.9 },
        { name: 'dragon', weight: -2.5 },
        { name: 'wizard', weight: -2.4 },
        { name: 'mythology', weight: -1.6 }
      ];
      
      fantasticalGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      fantasticalKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.split(' ').length * 0.23) % 0.8 - 0.4 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateClassicScale(movie) {
      let score = 0;
      const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const currentYear = new Date().getFullYear();
      
      // Age-based scoring (continuous)
      if (releaseYear > 0) {
        const age = currentYear - releaseYear;
        if (age > 40) {
          score += 2.8 + (age - 40) * 0.04; // Extra points for very old films
        } else if (age > 20) {
          score += 1.2 + (age - 20) * 0.08;
        } else if (age < 10) {
          score -= 2.1 - age * 0.15; // Penalty for very recent films
        }
      }
      
      // Classic indicators (+) with weighted values
      const classicGenres = [
        { name: 'drama', weight: 1.4 },
        { name: 'romance', weight: 1.8 },
        { name: 'musical', weight: 2.3 },
        { name: 'western', weight: 2.6 }
      ];
      const classicKeywords = [
        { name: 'period piece', weight: 2.3 },
        { name: 'costume drama', weight: 2.1 },
        { name: 'black and white', weight: 2.5 },
        { name: 'world war ii', weight: 1.8 },
        { name: 'historical', weight: 1.9 },
        { name: 'victorian era', weight: 2.0 },
        { name: '1940s', weight: 1.7 },
        { name: '1950s', weight: 1.6 },
        { name: 'old hollywood', weight: 2.2 }
      ];
      
      classicGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      classicKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Contemporary indicators (-) with weighted values
      const modernGenres = [
        { name: 'science fiction', weight: -1.8 },
        { name: 'action', weight: -1.3 }
      ];
      const contemporaryKeywords = [
        { name: 'internet', weight: -2.1 },
        { name: 'social media', weight: -2.3 },
        { name: 'cell phone', weight: -1.9 },
        { name: 'computer', weight: -1.7 },
        { name: 'modern day', weight: -1.8 },
        { name: '2000s', weight: -1.5 },
        { name: '2010s', weight: -1.6 },
        { name: 'contemporary', weight: -1.4 },
        { name: 'technology', weight: -1.8 }
      ];
      
      modernGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      contemporaryKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Runtime factor (classic films often have different pacing)
      const runtime = movie.runtime || 100;
      if (runtime > 150) {
        score += 0.8; // Epic length often associated with classics
      } else if (runtime < 90) {
        score -= 0.4; // Very short films less classic
      }
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.charCodeAt(movie.title.length - 1) % 50) * 0.016 - 0.4 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateUpliftingScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const runtime = movie.runtime || 100;
      
      // Uplifting indicators (+) with weighted values
      const upliftingGenres = [
        { name: 'comedy', weight: 2.8 },
        { name: 'family', weight: 2.6 },
        { name: 'animation', weight: 2.3 },
        { name: 'romance', weight: 2.1 },
        { name: 'adventure', weight: 1.9 },
        { name: 'musical', weight: 2.4 }
      ];
      const upliftingKeywords = [
        { name: 'friendship', weight: 2.2 },
        { name: 'hope', weight: 2.7 },
        { name: 'redemption', weight: 2.5 },
        { name: 'inspiring', weight: 2.3 },
        { name: 'triumph', weight: 2.1 },
        { name: 'happy ending', weight: 2.4 },
        { name: 'celebration', weight: 1.8 },
        { name: 'wedding', weight: 1.9 },
        { name: 'christmas', weight: 2.0 }
      ];
      
      upliftingGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      upliftingKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Melancholy indicators (-) with weighted values
      const melancholyGenres = [
        { name: 'drama', weight: -1.8 },
        { name: 'war', weight: -2.4 },
        { name: 'crime', weight: -1.6 },
        { name: 'thriller', weight: -1.3 }
      ];
      const melancholyKeywords = [
        { name: 'death', weight: -2.1 },
        { name: 'tragedy', weight: -2.6 },
        { name: 'loss', weight: -2.2 },
        { name: 'suicide', weight: -2.8 },
        { name: 'alcoholism', weight: -2.4 },
        { name: 'depression', weight: -2.5 },
        { name: 'funeral', weight: -2.3 },
        { name: 'betrayal', weight: -2.0 },
        { name: 'divorce', weight: -1.8 }
      ];
      
      melancholyGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      melancholyKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Runtime factor (longer films often more melancholy)
      score += (100 - runtime) * 0.004;
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.replace(/[^a-z]/gi, '').length * 0.11) % 0.9 - 0.45 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateTenseScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const runtime = movie.runtime || 100;
      
      // Tense indicators (+) with weighted values
      const tenseGenres = [
        { name: 'thriller', weight: 2.9 },
        { name: 'horror', weight: 2.7 },
        { name: 'mystery', weight: 2.2 },
        { name: 'action', weight: 1.8 },
        { name: 'crime', weight: 2.1 }
      ];
      const tenseKeywords = [
        { name: 'suspense', weight: 2.4 },
        { name: 'chase', weight: 2.6 },
        { name: 'kidnapping', weight: 2.1 },
        { name: 'murder', weight: 2.3 },
        { name: 'paranoia', weight: 2.5 },
        { name: 'survival', weight: 2.0 },
        { name: 'escape', weight: 1.9 },
        { name: 'showdown', weight: 1.8 },
        { name: 'violence', weight: 1.7 }
      ];
      
      tenseGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      tenseKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Relaxing indicators (-) with weighted values
      const relaxingGenres = [
        { name: 'comedy', weight: -2.3 },
        { name: 'romance', weight: -2.1 },
        { name: 'family', weight: -2.5 },
        { name: 'documentary', weight: -1.8 }
      ];
      const relaxingKeywords = [
        { name: 'friendship', weight: -2.4 },
        { name: 'wedding', weight: -2.2 },
        { name: 'christmas', weight: -2.3 },
        { name: 'holiday', weight: -2.0 },
        { name: 'school', weight: -2.1 },
        { name: 'coming of age', weight: -1.9 },
        { name: 'romantic comedy', weight: -2.5 },
        { name: 'feel good', weight: -2.4 }
      ];
      
      relaxingGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      relaxingKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Runtime factor (longer films can build more tension)
      score += (runtime - 100) * 0.008;
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100) * 0.014 - 0.7 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateHopefulScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 0;
      
      // Hopeful indicators (+) with weighted values
      const hopefulGenres = [
        { name: 'family', weight: 2.4 },
        { name: 'adventure', weight: 2.1 },
        { name: 'animation', weight: 2.2 },
        { name: 'comedy', weight: 1.9 }
      ];
      const hopefulKeywords = [
        { name: 'hope', weight: 2.8 },
        { name: 'redemption', weight: 2.6 },
        { name: 'triumph', weight: 2.3 },
        { name: 'happy ending', weight: 2.4 },
        { name: 'friendship', weight: 2.1 },
        { name: 'inspiring', weight: 2.2 },
        { name: 'second chance', weight: 2.0 },
        { name: 'rescue', weight: 1.9 },
        { name: 'wedding', weight: 1.8 }
      ];
      
      hopefulGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      hopefulKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Cynical indicators (-) with weighted values
      const cynicalGenres = [
        { name: 'war', weight: -2.6 },
        { name: 'crime', weight: -2.1 },
        { name: 'thriller', weight: -1.8 }
      ];
      const cynicalKeywords = [
        { name: 'corruption', weight: -2.4 },
        { name: 'betrayal', weight: -2.2 },
        { name: 'revenge', weight: -2.1 },
        { name: 'murder', weight: -2.0 },
        { name: 'dystopia', weight: -2.5 },
        { name: 'paranoia', weight: -2.3 },
        { name: 'conspiracy', weight: -1.9 },
        { name: 'alcoholism', weight: -2.6 },
        { name: 'suicide', weight: -2.8 }
      ];
      
      cynicalGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      cynicalKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Era factor (older films sometimes more optimistic)
      if (releaseYear > 0 && releaseYear < 1970) {
        score += 1.2;
      } else if (releaseYear > 2000) {
        score -= 0.8; // Modern films often more cynical
      }
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.length * 0.13) % 0.8 - 0.4 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateSimpleScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const runtime = movie.runtime || 100;
      const genreCount = genres.length;
      
      // Simple indicators (+) with weighted values
      const simpleGenres = [
        { name: 'comedy', weight: 2.1 },
        { name: 'action', weight: 1.9 },
        { name: 'horror', weight: 1.8 },
        { name: 'romance', weight: 2.0 },
        { name: 'family', weight: 2.3 }
      ];
      const simpleKeywords = [
        { name: 'friendship', weight: 2.4 },
        { name: 'family', weight: 2.6 },
        { name: 'school', weight: 2.2 },
        { name: 'wedding', weight: 2.1 },
        { name: 'coming of age', weight: 2.0 },
        { name: 'high school', weight: 2.3 },
        { name: 'love', weight: 2.2 },
        { name: 'christmas', weight: 2.4 }
      ];
      
      simpleGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      simpleKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Genre count factor
      if (genreCount <= 2) {
        score += 1.8; // Fewer genres = simpler
      } else if (genreCount >= 4) {
        score -= 1.5; // More genres = more complex
      }
      
      // Complex indicators (-) with weighted values
      const complexGenres = [
        { name: 'drama', weight: -1.7 },
        { name: 'mystery', weight: -2.3 },
        { name: 'science fiction', weight: -2.1 },
        { name: 'thriller', weight: -2.0 }
      ];
      const complexKeywords = [
        { name: 'time travel', weight: -2.8 },
        { name: 'conspiracy', weight: -2.4 },
        { name: 'dystopia', weight: -2.6 },
        { name: 'philosophy', weight: -2.5 },
        { name: 'artificial intelligence', weight: -2.3 },
        { name: 'alternate reality', weight: -2.7 },
        { name: 'multiple timeline', weight: -2.8 },
        { name: 'psychological', weight: -2.2 }
      ];
      
      complexGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      complexKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Runtime factor (shorter films often simpler)
      score += (90 - runtime) * 0.006;
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.replace(/\s/g, '').length * 0.07) % 0.6 - 0.3 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateCharacterScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const cast = movie.credits?.cast || [];
      const runtime = movie.runtime || 100;
      
      // Character-driven indicators (+) with weighted values
      const characterGenres = [
        { name: 'drama', weight: 2.4 },
        { name: 'biography', weight: 2.8 },
        { name: 'romance', weight: 2.1 }
      ];
      const characterKeywords = [
        { name: 'friendship', weight: 2.5 },
        { name: 'marriage', weight: 2.4 },
        { name: 'father son relationship', weight: 2.6 },
        { name: 'mother daughter relationship', weight: 2.5 },
        { name: 'family relationships', weight: 2.3 },
        { name: 'love', weight: 2.2 },
        { name: 'psychological', weight: 2.1 },
        { name: 'character study', weight: 2.7 }
      ];
      
      characterGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      characterKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Cast size factor (character-driven films often have smaller casts)
      if (cast.length > 0 && cast.length < 20) {
        score += 1.6;
      } else if (cast.length > 50) {
        score -= 1.2;
      }
      
      // Plot-driven indicators (-) with weighted values
      const plotGenres = [
        { name: 'action', weight: -2.2 },
        { name: 'adventure', weight: -1.9 },
        { name: 'thriller', weight: -2.0 },
        { name: 'mystery', weight: -1.8 }
      ];
      const plotKeywords = [
        { name: 'superhero', weight: -2.3 },
        { name: 'chase', weight: -2.1 },
        { name: 'explosion', weight: -2.0 },
        { name: 'heist', weight: -2.2 },
        { name: 'mission', weight: -2.0 },
        { name: 'murder', weight: -1.9 },
        { name: 'gun fight', weight: -2.1 },
        { name: 'car chase', weight: -2.2 }
      ];
      
      plotGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      plotKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Runtime factor (character studies often take time)
      score += (runtime - 100) * 0.005;
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.split(' ').length * 0.19) % 0.7 - 0.35 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateLinearScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const runtime = movie.runtime || 100;
      
      // Linear indicators (+) with weighted values
      const linearGenres = [
        { name: 'action', weight: 2.2 },
        { name: 'adventure', weight: 2.0 },
        { name: 'comedy', weight: 1.9 },
        { name: 'horror', weight: 1.8 }
      ];
      const linearKeywords = [
        { name: 'journey', weight: 2.2 },
        { name: 'coming of age', weight: 2.1 },
        { name: 'road trip', weight: 2.0 },
        { name: 'race against time', weight: 2.3 },
        { name: 'quest', weight: 1.9 },
        { name: 'rescue', weight: 2.0 },
        { name: 'escape', weight: 2.1 },
        { name: 'mission', weight: 1.8 }
      ];
      
      linearGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      linearKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Non-linear indicators (-) with weighted values
      const nonLinearGenres = [
        { name: 'drama', weight: -1.6 },
        { name: 'mystery', weight: -2.3 },
        { name: 'science fiction', weight: -1.9 }
      ];
      const nonLinearKeywords = [
        { name: 'time travel', weight: -2.4 },
        { name: 'memory', weight: -2.2 },
        { name: 'flashback', weight: -2.0 },
        { name: 'multiple timeline', weight: -2.6 },
        { name: 'nonlinear', weight: -2.7 },
        { name: 'dream', weight: -2.1 },
        { name: 'parallel universe', weight: -2.5 },
        { name: 'anthology', weight: -2.3 }
      ];
      
      nonLinearGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      nonLinearKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Runtime factor (shorter films often more linear)
      score += (100 - runtime) * 0.007;
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.charCodeAt(0) % 60) * 0.016 - 0.48 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateUniversalScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const language = movie.original_language || 'en';
      const budget = movie.budget || 0;
      
      // Universal indicators (+) with weighted values
      const universalGenres = [
        { name: 'family', weight: 2.6 },
        { name: 'animation', weight: 2.4 },
        { name: 'comedy', weight: 2.2 },
        { name: 'adventure', weight: 2.0 }
      ];
      const universalKeywords = [
        { name: 'family', weight: 2.7 },
        { name: 'friendship', weight: 2.5 },
        { name: 'school', weight: 2.3 },
        { name: 'high school', weight: 2.2 },
        { name: 'love', weight: 2.1 },
        { name: 'christmas', weight: 2.4 },
        { name: 'wedding', weight: 2.0 },
        { name: 'coming of age', weight: 2.2 }
      ];
      
      universalGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      universalKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Language factor
      if (language === 'en') {
        score += 1.8; // English more universal
      } else {
        score -= 1.4;
      }
      
      // Budget factor (higher budget often more universal appeal)
      if (budget > 50000000) {
        score += Math.min((budget / 100000000) * 1.5, 2.2);
      }
      
      // Niche indicators (-) with weighted values
      const nicheGenres = [
        { name: 'documentary', weight: -2.8 },
        { name: 'foreign', weight: -2.4 },
        { name: 'art', weight: -2.6 }
      ];
      const nicheKeywords = [
        { name: 'foreign language film', weight: -2.7 },
        { name: 'art', weight: -2.5 },
        { name: 'independent film', weight: -2.3 },
        { name: 'cult', weight: -2.4 },
        { name: 'experimental', weight: -2.6 },
        { name: 'avant garde', weight: -2.8 },
        { name: 'surreal', weight: -2.5 },
        { name: 'abstract', weight: -2.7 }
      ];
      
      nicheGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      nicheKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.replace(/[aeiou]/gi, '').length * 0.12) % 0.8 - 0.4 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateEscapistScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const budget = movie.budget || 0;
      
      // Escapist indicators (+) with weighted values
      const escapistGenres = [
        { name: 'fantasy', weight: 2.8 },
        { name: 'science fiction', weight: 2.6 },
        { name: 'adventure', weight: 2.3 },
        { name: 'animation', weight: 2.4 },
        { name: 'action', weight: 2.1 }
      ];
      const escapistKeywords = [
        { name: 'fantasy', weight: 2.6 },
        { name: 'superhero', weight: 2.5 },
        { name: 'space', weight: 2.4 },
        { name: 'magic', weight: 2.3 },
        { name: 'alien', weight: 2.2 },
        { name: 'time travel', weight: 2.1 },
        { name: 'alternate reality', weight: 2.4 },
        { name: 'computer animation', weight: 2.0 }
      ];
      
      escapistGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      escapistKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Budget factor (escapist films often have higher budgets)
      if (budget > 80000000) {
        score += Math.min((budget / 150000000) * 1.8, 2.1);
      }
      
      // Realistic indicators (-) with weighted values
      const realisticGenres = [
        { name: 'drama', weight: -2.0 },
        { name: 'documentary', weight: -2.9 },
        { name: 'biography', weight: -2.4 },
        { name: 'history', weight: -2.2 }
      ];
      const realisticKeywords = [
        { name: 'based on true story', weight: -2.8 },
        { name: 'biography', weight: -2.6 },
        { name: 'documentary', weight: -2.7 },
        { name: 'real life', weight: -2.4 },
        { name: 'prison', weight: -2.1 },
        { name: 'hospital', weight: -2.0 },
        { name: 'courtroom', weight: -2.2 },
        { name: 'war', weight: -2.3 }
      ];
      
      realisticGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      realisticKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.match(/[A-Z]/g)?.length || 0) * 0.14 - 0.42 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculatePolishedScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const budget = movie.budget || 0;
      const companies = movie.production_companies || [];
      
      // Polished indicators (+) with weighted values
      const polishedStudios = [
        { name: 'disney', weight: 2.6 },
        { name: 'warner bros', weight: 2.3 },
        { name: 'universal', weight: 2.2 },
        { name: 'paramount', weight: 2.1 },
        { name: 'sony', weight: 2.0 }
      ];
      const polishedKeywords = [
        { name: 'computer animation', weight: 2.4 },
        { name: 'special effects', weight: 2.3 },
        { name: 'visual effects', weight: 2.2 },
        { name: 'cgi', weight: 2.1 },
        { name: 'blockbuster', weight: 2.0 },
        { name: 'sequel', weight: 1.9 },
        { name: 'franchise', weight: 2.2 },
        { name: 'superhero', weight: 2.1 }
      ];
      
      polishedStudios.forEach(studio => {
        if (companies.some(c => c.name && c.name.toLowerCase().includes(studio.name))) {
          score += studio.weight;
        }
      });
      polishedKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Budget factor (higher budget often more polished)
      if (budget > 0) {
        score += Math.min((budget / 100000000) * 2.8, 3.5);
      }
      
      // Raw indicators (-) with weighted values
      const rawStudios = [
        { name: 'a24', weight: -2.4 },
        { name: 'mumblecore', weight: -2.8 },
        { name: 'independent', weight: -1.9 }
      ];
      const rawKeywords = [
        { name: 'prison', weight: -2.6 },
        { name: 'murder', weight: -2.4 },
        { name: 'violence', weight: -2.3 },
        { name: 'drug', weight: -2.5 },
        { name: 'crime', weight: -2.2 },
        { name: 'gang', weight: -2.4 },
        { name: 'street', weight: -2.1 },
        { name: 'urban', weight: -2.0 }
      ];
      
      rawStudios.forEach(studio => {
        if (companies.some(c => c.name && c.name.toLowerCase().includes(studio.name))) {
          score += studio.weight;
        }
      });
      rawKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Low budget factor
      if (budget > 0 && budget < 5000000) {
        score -= Math.min((5000000 - budget) / 1000000, 2.5);
      }
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.replace(/\W/g, '').length * 0.08) % 0.6 - 0.3 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateFamiliarScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 0;
      
      // Familiar indicators (+) with weighted values
      const familiarGenres = [
        { name: 'comedy', weight: 2.1 },
        { name: 'action', weight: 1.9 },
        { name: 'romance', weight: 2.0 },
        { name: 'family', weight: 2.2 }
      ];
      const familiarKeywords = [
        { name: 'sequel', weight: 2.4 },
        { name: 'franchise', weight: 2.3 },
        { name: 'superhero', weight: 2.1 },
        { name: 'remake', weight: 2.5 },
        { name: 'adaptation', weight: 2.0 },
        { name: 'classic', weight: 2.2 },
        { name: 'traditional', weight: 1.9 },
        { name: 'formula', weight: 1.8 }
      ];
      
      familiarGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      familiarKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Era factor (older films more familiar to modern audiences)
      if (releaseYear > 0 && releaseYear < 1990) {
        score += 1.5;
      }
      
      // Innovative indicators (-) with weighted values
      const innovativeGenres = [
        { name: 'science fiction', weight: -2.0 },
        { name: 'experimental', weight: -2.8 }
      ];
      const innovativeKeywords = [
        { name: 'original screenplay', weight: -2.6 },
        { name: 'experimental', weight: -2.8 },
        { name: 'avant garde', weight: -2.7 },
        { name: 'innovative', weight: -2.5 },
        { name: 'first film', weight: -2.4 },
        { name: 'debut', weight: -2.3 },
        { name: 'breakthrough', weight: -2.2 },
        { name: 'unique', weight: -2.1 }
      ];
      
      innovativeGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      innovativeKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Recent films factor (very recent films might be more innovative)
      if (releaseYear > 2018) {
        score -= 1.2;
      }
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.split(' ').length * 0.15) % 0.7 - 0.35 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    },
    calculateMinimalistScale(movie) {
      let score = 0;
      const genres = movie.genres || [];
      const keywords = movie.flatKeywords || [];
      const budget = movie.budget || 0;
      const cast = movie.credits?.cast || [];
      const runtime = movie.runtime || 100;
      
      // Minimalist indicators (+) with weighted values
      const minimalistGenres = [
        { name: 'drama', weight: 2.2 },
        { name: 'documentary', weight: 2.4 },
        { name: 'art', weight: 2.6 }
      ];
      const minimalistKeywords = [
        { name: 'character study', weight: 2.8 },
        { name: 'dialogue', weight: 2.5 },
        { name: 'conversation', weight: 2.4 },
        { name: 'intimate', weight: 2.3 },
        { name: 'quiet', weight: 2.2 },
        { name: 'subtle', weight: 2.1 },
        { name: 'introspective', weight: 2.6 },
        { name: 'contemplative', weight: 2.5 }
      ];
      
      minimalistGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      minimalistKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // Budget factor (lower budget often more minimalist)
      if (budget > 0 && budget < 10000000) {
        score += Math.min((10000000 - budget) / 2000000, 2.2);
      }
      
      // Cast size factor (smaller cast more minimalist)
      if (cast.length > 0 && cast.length < 15) {
        score += 1.8;
      }
      
      // Maximalist indicators (-) with weighted values
      const maximalistGenres = [
        { name: 'action', weight: -2.3 },
        { name: 'adventure', weight: -2.1 },
        { name: 'fantasy', weight: -2.4 },
        { name: 'science fiction', weight: -2.2 }
      ];
      const maximalistKeywords = [
        { name: 'epic', weight: -2.4 },
        { name: 'explosion', weight: -2.3 },
        { name: 'special effects', weight: -2.5 },
        { name: 'visual effects', weight: -2.4 },
        { name: 'spectacle', weight: -2.6 },
        { name: 'action packed', weight: -2.7 },
        { name: 'blockbuster', weight: -2.2 },
        { name: 'ensemble cast', weight: -2.1 }
      ];
      
      maximalistGenres.forEach(genre => {
        if (genres.some(g => g.name && g.name.toLowerCase().includes(genre.name))) {
          score += genre.weight;
        }
      });
      maximalistKeywords.forEach(keyword => {
        if (keywords.some(k => k.toLowerCase().includes(keyword.name))) {
          score += keyword.weight;
        }
      });
      
      // High budget factor (blockbusters often maximalist)
      if (budget > 150000000) {
        score -= Math.min((budget - 150000000) / 100000000, 2.8);
      }
      
      // Large cast factor
      if (cast.length > 50) {
        score -= 1.9;
      }
      
      // Runtime factor (shorter films often more minimalist)
      score += (90 - runtime) * 0.008;
      
      // Title-based variation
      const titleVariation = movie.title ? (movie.title.replace(/\s/g, '').length * 0.06) % 0.5 - 0.25 : 0;
      score += titleVariation;
      
      return Math.max(-10, Math.min(10, score));
    }
  }
};
</script>

<style lang="scss">
  .insights {
    color: white;
    padding: 18px;
    max-width: 600px;
    margin: 0 auto;

    .home-link {
      align-items: center;
      column-gap: 4px;
      cursor: pointer;
      display: flex;
      left: 6px;
      position: absolute;
      top: 6px;
    }

    .awards-results {
      .award-category {
        .category-title {
          color: #f8f9fa;
          font-weight: 600;
          font-size: 0.9em;
          border-bottom: 1px solid #495057;
          padding-bottom: 4px;
          text-align: end;
        }

        .category-results {
          padding-top: 12px;
        }
        
        .award-display {
          .winner-section {
            .winner-poster {
              position: relative;
              width: 100px;
              
              .poster-img, .poster-placeholder {
                width: 100%;
                aspect-ratio: 2/3;
                border-radius: 4px;
                object-fit: cover;
              }
              
              .poster-placeholder {
                background: #495057;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5em;
                font-weight: bold;
                color: #ffd700;
              }
              
              .winner-badge {
                position: absolute;
                top: -6px;
                left: 50%;
                transform: translateX(-50%);
                background: #ffd700;
                color: #000;
                font-size: 0.6em;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 8px;
                white-space: nowrap;
              }
            }
            
            .winner-title {
              font-size: 0.75em;
              font-weight: 600;
              text-align: center;
              line-height: 1.2;
              max-width: 100px;
            }
          }
          
          .nominees-section {
            .nominees-label {
              font-size: 0.8em;
              color: #adb5bd;
              font-weight: 600;
              margin-bottom: 4px;
            }
            
            .nominees-list {
              list-style: none;
              padding-left: 0;
              
              .nominee-item {
                font-size: 0.8em;
                color: #e9ecef;
                line-height: 1.3;
                margin-bottom: 2px;
                padding-left: 12px;
                position: relative;
                
                &::before {
                  content: "•";
                  color: #6c757d;
                  position: absolute;
                  left: 0;
                }
              }
            }
          }
        }
        
        .no-data {
          color: #6c757d;
          font-style: italic;
          font-size: 0.85em;
          text-align: center;
          padding: 20px;
        }
      }
    }
  }
</style>
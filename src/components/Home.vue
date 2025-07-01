<template>
  <div class="home p-3 pt-4 mx-auto">
    <div v-if="$store.state.dbLoaded" class="search-bar mx-auto">
      <div class="input-group mb-1 col-12 md-col-6">
        <input
          class="form-control"
          :class="{'has-content': value}"
          ref="searchInput"
          type="text"
          autocapitalize="none"
          autocorrect="off"
          autocomplete="off"
          name="search"
          id="search"
          :placeholder="placeholder"
          style="font-size: 0.75rem;"
          @focus="focusOnSearchBar"
          @blur="blurSearchBar"
          v-model="value"
        >
        <span v-if="value" class="clear-button" @click.prevent="clearValue" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
          <i class="bi bi-x-circle"/>
        </span>
        <span v-if="value" class="more-info-button" @click.prevent="goToWikipedia">
          <i class="bi bi-wikipedia"/>
        </span>
      </div>
    </div>
    <!-- Suggestions button below search bar if user has rated < 10 movies -->
    <div v-if="$store.state.dbLoaded && !showSuggestionsOnly && userRatedMovieCount < 10 && !value && !resultsAreFiltered" class="text-center my-2">
      <button class="btn btn-success" @click="showSuggestionsOnly = true">{{ suggestionsButtonLabel }}</button>
    </div>
    <NoResults
      v-if="showSuggestionsOnly && userRatedMovieCount < 10"
      :value="value"
      :suggestionsMode="true"
      @cancel-suggestions="showSuggestionsOnly = false"
      style="margin-bottom: 2rem;"
    />
    <div v-else>
      <div v-if="showResultsList" class="results">
        <div v-if="paginatedSortedResults.length" class="results-exist">
          <div class="results-actions col-12 md-col-6 d-flex justify-content-between flex-wrap my-2">
            <div class="btn-group col-12" role="group" aria-label="Button group">
              <!-- Settings (gear) button replaces shorts toggle -->
              <button class="results-actions-button btn btn-secondary" @click="toggleSettingsPanel">
                <i class="bi bi-gear"></i>
              </button>
              <button class="results-actions-button btn btn-warning" @click="shareResults">
                <span v-if="!sharing">
                  <i class="bi bi-share"/>
                </span>
                <div v-else class="spinner-border text-light" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </button>
              <button class="results-actions-button filtered-count-display btn btn-secondary" @click="toggleCountViewsAverage">
                <span v-if="showAverage">
                  <span class="average-label">(avg)</span>
                  <span class="average-value">{{averageRating(filteredResults)}}</span>
                </span>
                <span v-else-if="showViewCount">
                  <span class="average-label">(views)</span>
                  <span class="average-value">{{viewsCount(filteredResults)}}</span>
                </span>
                <span v-else-if="activeQuickLinkList === 'bestPicture'">{{bestPicturesWithRatings.length}}/{{filteredResults.length}}</span>
                <span v-else>{{filteredResults.length}}</span>
              </button>
              <button class="results-actions-button btn btn-info" type="button" @click="goToInsights">
                <i class="bi bi-lightbulb"/>
              </button>
              <button class="results-actions-button btn btn-warning btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#quick-links-accordion" aria-expanded="false" aria-controls="quick-links-accordion" @click="toggleQuickLinksAccordion">
                <i class="bi bi-lightning-charge"/>
              </button>
              <button class="results-actions-button btn btn-info btn-sm" @click="findRandomSearchValue">
                <i class="bi bi-shuffle"/>
              </button>
              <button class="results-actions-button btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i v-if="sortValue === 'rating'" class="bi bi-123"/>
                <i v-if="sortValue === 'watched'" class="bi bi-calendar3"/>
                <i v-if="sortValue === 'release'" class="bi bi-calendar-date"/>
                <i v-if="sortValue === 'title'" class="bi bi-alphabet"></i>
                <i v-if="sortValue === 'views'" class="bi bi-eye"></i>
                <i v-if="sortValue === 'direction'" class="bi bi-dpad"></i>
                <i v-if="sortValue === 'imagery'" class="bi bi-image"></i>
                <i v-if="sortValue === 'story'" class="bi bi-book"></i>
                <i v-if="sortValue === 'performance'" class="bi bi-speedometer"></i>
                <i v-if="sortValue === 'soundtrack'" class="bi bi-music-note-beamed"></i>
                <i v-if="sortValue === 'stickiness'" class="bi bi-sticky"></i>
                <span class="order-arrow">
                  <i v-if="sortOrder !== 'bestOrNewestOnTop'" class="bi bi-arrow-down-short"/>
                  <i v-if="sortOrder === 'bestOrNewestOnTop'" class="bi bi-arrow-up-short"/>
                </span>
                <ul class="dropdown-menu">
                  <li value="rating">
                    <button class="dropdown-item" :class="{active: sortValue === 'rating'}" @click="setOrToggleSortValue('rating')">
                      Rating
                    </button>
                  </li>
                  <li value="watched">
                    <button class="dropdown-item" :class="{active: sortValue === 'watched'}" @click="setOrToggleSortValue('watched')">
                      Watch Date
                    </button>
                  </li>
                  <li value="release">
                    <button class="dropdown-item" :class="{active: sortValue === 'release'}" @click="setOrToggleSortValue('release')">
                      Release Date
                    </button>
                  </li>
                  <li value="title">
                    <button class="dropdown-item" :class="{active: sortValue === 'title'}" @click="setOrToggleSortValue('title')">
                      Title
                    </button>
                  </li>
                  <li value="views">
                    <button class="dropdown-item" :class="{active: sortValue === 'views'}" @click="setOrToggleSortValue('views')">
                      Views
                    </button>
                  </li>
                  <li value="direction">
                    <button class="dropdown-item" :class="{active: sortValue === 'direction'}" @click="setOrToggleSortValue('direction')">
                      Direction
                    </button>
                  </li>
                  <li value="imagery">
                    <button class="dropdown-item" :class="{active: sortValue === 'imagery'}" @click="setOrToggleSortValue('imagery')">
                      Imagery
                    </button>
                  </li>
                  <li value="story">
                    <button class="dropdown-item" :class="{active: sortValue === 'story'}" @click="setOrToggleSortValue('story')">
                      Story
                    </button>
                  </li>
                  <li value="performance">
                    <button class="dropdown-item" :class="{active: sortValue === 'performance'}" @click="setOrToggleSortValue('performance')">
                      Performance
                    </button>
                  </li>
                  <li value="soundtrack">
                    <button class="dropdown-item" :class="{active: sortValue === 'soundtrack'}" @click="setOrToggleSortValue('soundtrack')">
                      Soundtrack
                    </button>
                  </li>
                  <li value="stickiness">
                    <button class="dropdown-item" :class="{active: sortValue === 'stickiness'}" @click="setOrToggleSortValue('stickiness')">
                      Stickiness
                    </button>
                  </li>
                </ul>
              </button>
            </div>
            <div ref="quickLinkTypes" class="quick-link-types d-flex align-items-center flex-wrap col-md-12">
              <div id="quick-links-accordion" class="col-12 mt-1 accordion-collapse collapse">
                <div>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'annual' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleAnnualBestFilter"
                  >
                    Annual Best
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'bestPicture' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleBestPicturesFilter"
                  >
                    Best Picture
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'thisYear' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleThisYearFilter"
                  >
                    This Year
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'lastYear' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleLastYearFilter"
                  >
                    Last Year
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'thisMonth' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleThisMonthFilter"
                  >
                    This Month
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'lastMonth' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleLastMonthFilter"
                  >
                    Last Month
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'notOnLetterboxd' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleNotOnLetterboxdFilter"
                  >
                    Not on Letterboxd
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'genre' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleQuickLinksList('genre')"
                  >
                    Genres
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'keyword' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleQuickLinksList('keyword')"
                  >
                    Keywords
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'year' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleQuickLinksList('year')"
                  >
                    Years
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'director' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleQuickLinksList('director')"
                  >
                    Directors
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'cast/crew' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleQuickLinksList('cast/crew')"
                  >
                    Cast/Crew Members
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'studios' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleQuickLinksList('studios')"
                  >
                    Studios
                  </span>
                  <hr>
                  <div class="tags-quicklinks">
                    <p data-bs-toggle="collapse" data-bs-target="#tagsCollapse" aria-expanded="false" aria-controls="tagsCollapse">
                      Tags
                      <i class="bi bi-caret-right-fill"/>
                    </p>
                    <div class="collapse" id="tagsCollapse">
                      <span
                        v-for="(tag, index) in tags"
                        :key="index"
                        class="badge mx-1"
                        :class="value === tag ? 'text-bg-success' : 'text-bg-secondary'"
                        @click="toggleQuickLinksList(tag)"
                      >
                        {{tag}}
                      </span>
                    </div>
                  </div>
                </div>
                <div v-if="sortedDataForActiveQuickLinkList.length" class="quick-links-list-wrapper mt-2">
                  <div class="accordion-body col-12">
                    <button
                      class="quick-links-list-sort"
                      :class="darkOrLight"
                      @click="toggleQuickLinksSort"
                    >
                      {{quickLinksSortType}}
                    </button>
                    <ul class="quick-link-list p-0 col-12">
                      <li v-for="(value, index) in sortedDataForActiveQuickLinkList" :key="index" @click="updateSearchValue(value.name)">
                        <span class="badge mx-1" :class="darkOrLight">
                          {{ value.name }}<span v-if="quickLinksSortType === 'count' && value.count">&nbsp;({{value.count}})</span>
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <StickinessModal
            v-if="showStickinessModal"
            :showStickinessModal="showStickinessModal"
            :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"Add commentMore actions
          />
          <TweakModal
            v-else-if="showTweakModal"
            :showTweakModal="showTweakModal"
            :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"
          />
          <!-- Inline Settings Panel accordion, right after action buttons and before results list -->
          <div v-if="showSettingsPanel" :class="['settings-panel-inline', 'card', 'card-body', darkOrLight['text-bg-dark'] ? 'dark' : '']">
            <div class="settings-panel-header d-flex justify-content-between align-items-center mb-2">
              <h5 class="mb-0">Settings</h5>
            </div>
            <hr class="mt-0 mb-3">
            <div class="settings-panel-body">
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="shortsToggle" v-model="showShorts">
                <label class="form-check-label" for="shortsToggle">Include short films</label>
              </div>
              <div class="mb-3">
                <label for="normalizationTweak" class="form-label">Normalization offset:</label>
                <input
                  type="number"
                  class="form-control"
                  id="normalizationTweak"
                  v-model.number="normalizationTweak"
                  min="0"
                  max="1"
                  step="0.01"
                  @change="saveNormalizationTweak"
                >
              </div>
              <div class="mb-3">
                <label for="tieBreakTweak" class="form-label">Max daily tiebreak prompts:</label>
                <input
                  type="number"
                  class="form-control"
                  id="tieBreakTweak"
                  v-model.number="tieBreakTweak"
                  min="0"
                  max="1"
                  step="1"
                  @change="saveTieBreakTweak"
                >
              </div>
              <div class="mb-3">
                <label for="letterboxdUsername" class="form-label">Letterboxd Username:</label>
                <div class="input-group">
                  <span class="input-group-text">letterboxd.com/</span>
                  <input
                    type="text"
                    class="form-control"
                    id="letterboxdUsername"
                    v-model="letterboxdUsername"
                    placeholder="username"
                    @blur="saveLetterboxdUsername"
                  >
                  <button v-if="letterboxdUsername" class="btn btn-outline-info" @click="testLetterboxdScraping" :disabled="scrapingTest.loading" title="Refresh Letterboxd Data">
                    <span v-if="scrapingTest.loading">
                      <span class="spinner-border spinner-border-sm" role="status"></span>
                    </span>
                    <span v-else>
                      <i class="bi bi-arrow-clockwise"></i>
                    </span>
                  </button>
                </div>
                <small class="form-text text-muted">Enter your public Letterboxd username to enable integration</small>
                <div v-if="letterboxdUsername">
                  <div v-if="scrapingTest.result" class="mt-2">
                    <div v-if="scrapingTest.success" class="alert alert-success alert-sm">
                      ✅ Found {{ scrapingTest.result.films?.length || 0 }} films in your Letterboxd profile!
                    </div>
                    <div v-else class="alert alert-warning alert-sm">
                      ⚠️ {{ scrapingTest.error || 'Testing failed, using mock data instead' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Results list follows the settings panel -->
          <!-- Grouped results by person role -->
          <div v-if="groupedByPersonRole" class="pb-3">
            <div v-for="group in groupedByPersonRole" :key="`${group.personName}-${group.role}`" class="my-4 role-section">
              <h6 class="bg-dark text-white text-end mb-2">{{ group.role }}</h6>
              <ul class="grid-layout" :class="getGridClassesForGroup(group.movies.length)">
                <DBGridLayoutSearchResult
                  v-for="(result, index) in group.movies"
                  :key="topStructure(result).id"
                  :result="result"
                  :keywordCounts="allCounts.keywords"
                  :allCounts="allCounts"
                  :index="index"
                  :resultsAreFiltered="resultsAreFiltered"
                  :sortValue="sortValue"
                  :activeQuickLinkList="activeQuickLinkList"
                  @updateSearchValue="updateSearchValue"
                />
              </ul>
            </div>
          </div>
          <!-- Regular results list -->
          <ul v-else class="grid-layout pb-3" :class="listCountClasses">
            <DBGridLayoutSearchResult
              v-for="(result, index) in paginatedSortedResults"
              :key="topStructure(result).id"
              :result="result"
              :keywordCounts="allCounts.keywords"
              :allCounts="allCounts"
              :index="index"
              :resultsAreFiltered="resultsAreFiltered"
              :sortValue="sortValue"
              :activeQuickLinkList="activeQuickLinkList"
              @updateSearchValue="updateSearchValue"
            />
          </ul>
          <div v-if="!groupedByPersonRole && sortedResults.length > numberOfResultsToShow" class="d-flex justify-content-end mb-5">
            <button
              class="btn btn-secondary"
              @click="addMoreResults"
            >
              More...
            </button>
          </div>
          <!-- Suggestions button/component at the very bottom, only if not searching/filtering and all results are shown and user has rated 10+ movies -->
          <div v-else-if="!value && !resultsAreFiltered && sortedResults.length <= numberOfResultsToShow && userRatedMovieCount >= 10" class="mt-4 mb-5 text-center">
            <button v-if="!showSuggestionsOnly" class="btn btn-success" @click="showSuggestionsOnly = true">{{ suggestionsButtonLabel }}</button>
            <NoResults
              v-if="showSuggestionsOnly"
              :value="value"
              :suggestionsMode="true"
              @cancel-suggestions="showSuggestionsOnly = false"
              style="margin-bottom: 2rem;"
            />
          </div>
          <div v-else class="button-wrapper d-flex justify-content-end mb-5">
            <button class="btn btn-primary" @click="searchTMDB" id="new-rating-button">Search TMDB for {{titleCase(value)}}</button>
          </div>
        </div>
        <div v-else class="no-results-but-search-type">
          <p class="text-center">No movies found for your search.</p>
          <button class="btn btn-link col-12" @click="toggleQuickLinksList(null)">Clear quick filters?</button>
        </div>
      </div>
      <NoResults v-else-if="$store.state.dbLoaded" :value="value" @clearValue="clearValue"/>
      <div v-else class="loading-screen d-flex justify-content-center align-items-center my-5">
        <div class="spinner-border text-light" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
      <InsetBrowserModal :show="showInsetBrowserModal" :url="insetBrowserUrl" @close="showInsetBrowserModal = false" />
    </div>
    <!-- Unrated movies section -->
    <div v-if="unratedMoviesLoading" class="unrated-movies-loading text-center my-4">
      <span v-if="unratedMoviesSearchType === 'person'">Loading more movies by this person...</span>
      <span v-else-if="unratedMoviesSearchType === 'year'">Loading popular movies from {{ value }}...</span>
      <span v-else-if="unratedMoviesSearchType === 'yearRange'">Loading popular movies from this time period...</span>
      <span v-else-if="unratedMoviesSearchType === 'genre'">Loading popular {{ value.toLowerCase() }} movies...</span>
      <span v-else-if="unratedMoviesSearchType === 'general'">Loading movies matching "{{ value }}"...</span>
      <span v-else>Loading movies...</span>
    </div>
    <div v-else-if="displayableUnratedMovies.length && !unratedMoviesLoading && !unratedMoviesError" class="unrated-movies-grid">
      <h3 class="bg-dark">
        <span v-if="unratedMoviesSearchType === 'person'">More from {{ value }}:</span>
        <span v-else-if="unratedMoviesSearchType === 'year'">More from {{ value }}:</span>
        <span v-else-if="unratedMoviesSearchType === 'yearRange'">More from this time period:</span>
        <span v-else-if="unratedMoviesSearchType === 'genre'">More {{ value.toLowerCase() }} movies:</span>
        <span v-else-if="unratedMoviesSearchType === 'general'">Movies matching "{{ value }}":</span>
        <span v-else>More from {{ value }}:</span>
      </h3>
      <div class="d-flex flex-wrap">
        <div v-for="movie in unratedMovies" :key="movie.id" class="unrated-movie-card" :class="columnsForUnratedMovies">
          <a v-if="movie.id" :href="'https://www.themoviedb.org/movie/' + movie.id" target="_blank" rel="noopener">
            <img v-if="movie.poster_path" :src="'https://image.tmdb.org/t/p/w185' + movie.poster_path" :alt="movie.title" class="unrated-movie-poster col-12 p-1"/>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import uniq from 'lodash/uniq';
import minBy from 'lodash/minBy';
import debounce from 'lodash/debounce';
import DBGridLayoutSearchResult from './DBGridLayoutSearchResult.vue';
import StickinessModal from "./StickinessModal.vue";
import TweakModal from "./TweakModal.vue";
import NoResults from "./NoResults.vue";
import InsetBrowserModal from './InsetBrowserModal.vue';
import { getRating } from "../assets/javascript/GetRating.js";

export default {
  components: {
    DBGridLayoutSearchResult,
    InsetBrowserModal,
    StickinessModal,
    TweakModal,
    NoResults,
  },
  data () {
    return {
      sortOrder: "bestOrNewestOnTop",
      value: "",
      activeQuickLinkList: "title",
      sortValue: null,
      quickLinksSortType: "count",
      numberOfResultsToShow: 25,
      sharing: false,
      hasCalledFindFilter: false,
      showInsetBrowserModal: false,
      insetBrowserUrl: "",
      showAverage: false,
      showViewCount: false,
      showSuggestionsOnly: false,
      showShorts: false, // shorts toggle, default to off
      showSettingsPanel: false, // controls settings panel visibility
      normalizationTweak: 0.25, // default, will be set from store
      tieBreakTweak: 1, // default, will be set from store
      letterboxdConnected: false, // Letterboxd integration toggle
      letterboxdUsername: '', // Letterboxd username
      scrapingTest: {
        loading: false,
        result: null,
        success: false,
        error: null
      },
      unratedMovies: [],
      unratedMoviesLoading: false,
      unratedMoviesError: null,
      unratedMoviesQuery: '',
      unratedMoviesPersonType: '',
      unratedMoviesDebounceTimeout: null,
      unratedMoviesSearchType: null, // 'person', 'year', 'yearRange', 'genre', 'general'
      letterboxdUserData: null,
    }
  },
  watch: {
    DBSearchValue (newVal) {
      if (newVal || newVal === "") {
        this.value = newVal;
      }
    },
    '$route.query.search'(newVal, oldVal) {
      // When the route query changes, update the value
      if (newVal !== oldVal && typeof newVal === 'string') {
        const decodedValue = decodeURIComponent(newVal);
        this.value = decodedValue;
        // Only commit if different from current store value to prevent cycles
        if (this.$store.state.DBSearchValue !== decodedValue) {
          this.$store.commit('setDBSearchValue', decodedValue);
        }
      }
    },
    DBSortValue (newVal) {
      if (newVal) {
        this.setSortValue(newVal)
      }
    },
    paginatedSortedResults (newVal, oldVal) {
      if (!oldVal.length && newVal.length) {
        this.checkResultsAndFindFilter();
      }
    },
    filteredResults: debounce(function (newVal) {
      this.$store.commit("setFilteredResults", newVal);
    }, 500),
    '$store.state.settings.normalizationTweak': {
      handler(newVal) {
        if (typeof newVal === 'number') {
          this.normalizationTweak = newVal;
        } else {
          this.normalizationTweak = 0.25;
        }
      },
      immediate: true
    },
    '$store.state.settings.tieBreakTweak': {
      handler(newVal) {
        if (typeof newVal === 'number') {
          this.tieBreakTweak = newVal;
        } else {
          this.tieBreakTweak = 1;
        }
      },
      immediate: true
    },
    '$store.state.settings.includeShorts': {
      handler(newVal) {
        if (typeof newVal === 'boolean') {
          this.showShorts = newVal;
        } else {
          this.showShorts = false;
        }
      },
      immediate: true
    },
    '$store.state.settings.letterboxdConnected': {
      handler(newVal) {
        if (typeof newVal === 'boolean') {
          this.letterboxdConnected = newVal;
        } else {
          this.letterboxdConnected = false;
        }
      },
      immediate: true
    },
    '$store.state.settings.letterboxdUsername': {
      handler(newVal) {
        if (typeof newVal === 'string') {
          this.letterboxdUsername = newVal;
        } else {
          this.letterboxdUsername = '';
        }
      },
      immediate: true
    },
    showShorts(newVal) {
      this.$store.dispatch('setDBValue', { path: 'settings/includeShorts', value: newVal });
    },
    value(newVal, oldVal) {
      // Fetch unrated movies for any non-empty value
      if (newVal && newVal !== oldVal) {
        this.debouncedFetchUnratedMoviesByValue(newVal);
      } else if (!newVal) {
        this.unratedMovies = [];
        this.unratedMoviesError = null;
      }
    },
    '$store.state.dbLoaded'(newVal) {
      if (newVal) {
        this.checkResultsAndFindFilter();
      }
    }
  },
  mounted () {
    this.value = this.DBSearchValue;
    window.scroll({
      top: 0,
      left: 0,
      behavior: 'instant'
    });

    if (this.$route.query.search) {
      this.value = decodeURIComponent(this.$route.query.search);
    } else {
      this.checkResultsAndFindFilter();
    }

    if (this.DBSortValue) {
      this.setSortValue(this.DBSortValue)
    } else {
      this.setSortValue("rating")
    }

    if (this.$route.query.movieDbKey) {
      this.$store.commit("setDBSortValue", "watched");
      this.sortOrder = "bestOrNewestOnTop";
    }

    // Initialize showShorts from store
    if (typeof this.$store.state.settings.includeShorts === 'boolean') {
      this.showShorts = this.$store.state.settings.includeShorts;
    } else {
      this.showShorts = false;
    }
  },
  beforeRouteLeave () {
    this.sortOrder = "bestOrNewestOnTop";
    this.setSortValue(null);
    this.value = "";
    this.$store.commit("setDBSearchValue", this.value);
    this.$store.commit("setDBSortValue", this.sortValue);
  },
  computed: {
    isMatt () {
      return this.$store.state.databaseTopKey === "mattgrosso-gmail-com" || !this.$store.state.databaseTopKey;
    },
    darkOrLight () {
      const inDarkMode = document.querySelector("body").classList.contains('bg-dark');

      return { 'text-bg-dark': inDarkMode, 'text-bg-light': !inDarkMode };
    },
    tags () {
      if (this.$store.state?.settings?.tags?.['viewing-tags']) {
        return Object.values(this.$store.state.settings.tags['viewing-tags']).map(tag => tag.title);
      } else {
        return [];
      }
    },
    DBSearchValue () {
      return this.$store.state.DBSearchValue;
    },
    DBSortValue () {
      return this.$store.state.DBSortValue;
    },
    displayableUnratedMovies () {
      return this.unratedMovies.filter(movie => movie.id && movie.poster_path);
    },
    allEntriesWithFlatKeywordsAdded () {
      return this.$store.getters.allMediaAsArray.map((result) => {
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
      });
    },
    resultsThatNeedStickiness () {
      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const hasntReratedStickinessOneWeek = !this.mostRecentRating(result).userAddedStickiness;
        const hasntReratedStickinessSixMonths = !this.mostRecentRating(result).userAddedSixMonthStickiness;
        const ratingDate = this.mostRecentRating(result).date || "1/1/2021";
        const moreThanAWeekAgo = new Date(ratingDate).getTime() < new Date().getTime() - (604800000);
        const moreThanSixMonthsAgo = new Date(ratingDate).getTime() < new Date().getTime() - (15778476000);

        return (hasntReratedStickinessOneWeek && moreThanAWeekAgo) || (hasntReratedStickinessSixMonths && moreThanSixMonthsAgo);
      }).sort((a, b) => {
        const ratingDateA = this.mostRecentRating(a).date || "1/1/2021";
        const ratingDateB = this.mostRecentRating(b).date || "1/1/2021";
        const dateA = new Date(ratingDateA);
        const dateB = new Date(ratingDateB);
        return dateB - dateA;
      });
    },
    showStickinessModal () {
      return Boolean(this.allEntriesWithFlatKeywordsAdded.length && this.resultsThatNeedStickiness.length);
    },
    showTweakModal () {
      if (this.showStickinessModal) {
        return false;
      }

      const firstTiedPairIndex = this.sortedByRating.findIndex((movie, index) => {
        const nextMovie = this.sortedByRating[index + 1];

        if (!nextMovie) {
          return false;
        }

        return getRating(movie).calculatedTotal === getRating(nextMovie).calculatedTotal;
      });

      if (firstTiedPairIndex === -1) {
        return false;
      }

      const hasTiedResults = Boolean(this.sortedByRating[firstTiedPairIndex] && this.sortedByRating[firstTiedPairIndex + 1]);
      const lastTweak = this.$store.state.settings.lastTweak || Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const maxDailyTieBreaks = this.$store.state.settings.tieBreakTweak || 1;
      const noTieBreakYetToday = Date.now() - lastTweak > (oneDay / maxDailyTieBreaks);

      return hasTiedResults && noTieBreakYetToday;
    },
    filteredResults () {
      let results;
      if (this.activeQuickLinkList === "annual") {
        results = this.bestMovieFromEachYear;
      } else if (this.activeQuickLinkList === "bestPicture") {
        results = this.bestPictures;
      } else if (this.activeQuickLinkList === "thisYear") {
        results = this.thisYearsMovies;
      } else if (this.activeQuickLinkList === "lastYear") {
        results = this.lastYearsMovies;
      } else if (this.activeQuickLinkList === "thisMonth") {
        results = this.thisMonthsMovies;
      } else if (this.activeQuickLinkList === "lastMonth") {
        results = this.lastMonthsMovies;
      } else if (this.activeQuickLinkList === "notOnLetterboxd") {
        results = this.notOnLetterboxdMovies;
      } else if (this.tags.includes(this.activeQuickLinkList)) {
        results = this.matchingTags;
      } else if (this.value) {
        results = this.fuzzyFilter;
      } else {
        results = this.allEntriesWithFlatKeywordsAdded;
      }
      // Exclude shorts if showShorts is false
      if (!this.showShorts) {
        results = results.filter(result => {
          // Try to detect short films by genre or runtime
          const genres = this.topStructure(result).genres || [];
          const isShortGenre = genres.some(g => g.name && g.name.toLowerCase() === 'short');
          const runtime = this.topStructure(result).runtime;
          // Consider as short if genre is 'Short' or runtime <= 40 min
          return !isShortGenre && !(runtime && runtime <= 40);
        });
      }
      return results;
    },
    fuzzyFilter  () {
      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        if (!this.value) {
          return true;
        }

        return this.topStructure(media).title.toLowerCase().includes(this.value.toLowerCase()) ||
        this.topStructure(media).flatKeywords?.includes(this.value.toLowerCase()) ||
        this.topStructure(media).genres?.find((genre) => genre.name.toLowerCase() === this.value.toLowerCase()) ||
        this.topStructure(media).cast?.flatMap((person) => {
          const names = person.name.toLowerCase().split(' ');
          return [person.name.toLowerCase(), ...names];
        }).includes(this.value.toLowerCase()) ||
        this.topStructure(media).crew?.flatMap((person) => {
          const names = person.name.toLowerCase().split(' ');
          return [person.name.toLowerCase(), ...names];
        }).includes(this.value.toLowerCase()) ||
        this.topStructure(media).production_companies?.map((company) => company.name.toLowerCase()).includes(this.value.toLowerCase()) ||
        (this.yearFilter.length && this.yearFilter.includes(`${this.getYear(media)}`));
      })
    },
    groupedByPersonRole () {
      if (!this.value) return null;
      
      const searchTerm = this.value.toLowerCase();
      
      // Define role hierarchy (higher number = higher priority)
      const roleRanking = {
        'Director': 7,
        'Cast': 6,
        'Producer': 5,
        'Writer': 4,
        'Cinematographer': 3,
        'Music': 2,
        'Editor': 1,
        'Crew': 0
      };
      
      // First pass: collect all movies for each person-role combination
      const personRoleData = {};
      const usedMovies = new Set(); // Track movies that have been assigned to higher priority roles
      
      this.fuzzyFilter.forEach((media) => {
        const movieData = this.topStructure(media);
        
        // Check cast
        if (movieData.cast) {
          movieData.cast.forEach((person) => {
            const personName = person.name.toLowerCase();
            const personNames = personName.split(' ');
            
            if (personName.includes(searchTerm) || personNames.some(name => name.includes(searchTerm))) {
              if (!personRoleData[person.name]) {
                personRoleData[person.name] = {};
              }
              if (!personRoleData[person.name]['Cast']) {
                personRoleData[person.name]['Cast'] = [];
              }
              personRoleData[person.name]['Cast'].push(media);
            }
          });
        }
        
        // Check crew
        if (movieData.crew) {
          movieData.crew.forEach((person) => {
            const personName = person.name.toLowerCase();
            const personNames = personName.split(' ');
            
            if (personName.includes(searchTerm) || personNames.some(name => name.includes(searchTerm))) {
              let roleCategory = 'Crew';
              
              // Categorize crew roles
              if (person.job === 'Director') {
                roleCategory = 'Director';
              } else if (person.job && person.job.toLowerCase().includes('producer')) {
                roleCategory = 'Producer';
              } else if (person.job && ['Writer', 'Screenplay', 'Story', 'Novel'].includes(person.job)) {
                roleCategory = 'Writer';
              } else if (person.job && person.job.toLowerCase().includes('composer') || 
                        person.job && person.job.toLowerCase().includes('music') ||
                        person.job && person.job.toLowerCase().includes('score')) {
                roleCategory = 'Music';
              } else if (person.job && person.job.toLowerCase().includes('editor')) {
                roleCategory = 'Editor';
              } else if (person.job && (person.job.toLowerCase().includes('photo') ||
                                      person.job.toLowerCase().includes('cinematographer') ||
                                      person.job.toLowerCase().includes('director of photography'))) {
                roleCategory = 'Cinematographer';
              }
              
              if (!personRoleData[person.name]) {
                personRoleData[person.name] = {};
              }
              if (!personRoleData[person.name][roleCategory]) {
                personRoleData[person.name][roleCategory] = [];
              }
              
              // Avoid duplicates in the same role category
              if (!personRoleData[person.name][roleCategory].find(m => this.topStructure(m).id === movieData.id)) {
                personRoleData[person.name][roleCategory].push(media);
              }
            }
          });
        }
      });
      
      // Second pass: build final groups ensuring each movie appears only once, prioritizing by role ranking
      const finalGroups = [];
      
      Object.keys(personRoleData).forEach(personName => {
        const roles = personRoleData[personName];
        
        // Sort roles by ranking (highest first)
        const sortedRoles = Object.keys(roles).sort((a, b) => (roleRanking[b] || 0) - (roleRanking[a] || 0));
        
        sortedRoles.forEach(role => {
          const availableMovies = roles[role].filter(movie => !usedMovies.has(this.topStructure(movie).id));
          
          if (availableMovies.length > 0) {
            // Sort the movies in this group using the same sorting logic as the main list
            const sortedMovies = [...availableMovies].sort(this.sortResults);
            
            finalGroups.push({
              personName: personName,
              role: role,
              movies: sortedMovies,
              ranking: roleRanking[role] || 0
            });
            
            // Mark these movies as used
            availableMovies.forEach(movie => {
              usedMovies.add(this.topStructure(movie).id);
            });
          }
        });
      });
      
      // Sort final groups by person name, then by role ranking (highest first)
      finalGroups.sort((a, b) => {
        if (a.personName !== b.personName) {
          return a.personName.localeCompare(b.personName);
        }
        return b.ranking - a.ranking;
      });
      
      // Only return grouped results if we found person matches and there are multiple groups for at least one person
      const personCounts = {};
      finalGroups.forEach(group => {
        personCounts[group.personName] = (personCounts[group.personName] || 0) + 1;
      });
      
      const hasMultipleRoles = Object.values(personCounts).some(count => count > 1);
      return hasMultipleRoles ? finalGroups : null;
    },
    yearFilter () {
      let parsedYears = [];

      if (this.value.length === 2 && parseInt(this.value) < new Date().getFullYear() - 2000) {
        parsedYears = [`20${this.value}`];
      } else if (this.value.length === 2) {
        parsedYears = [`19${this.value}`];
      } else if (this.value.includes("-") && this.value.includes(" ")) {
        parsedYears = this.value.split(" ").join("").split("-");

        for (let i = parseInt(parsedYears[0]) + 1; i < parseInt(parsedYears[1]); i++) {
          parsedYears.push(i.toString());
        }
      } else if (this.value.includes("-")) {
        parsedYears = this.value.split("-");

        for (let i = parseInt(parsedYears[0]) + 1; i < parseInt(parsedYears[1]); i++) {
          parsedYears.push(i.toString());
        }
      } else if (this.value.length === 5 && this.value.includes("s")) {
        parsedYears = this.value.split("s").filter((x) => x);

        parsedYears.push(`${parseInt(parsedYears[0]) + 1}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 2}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 3}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 4}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 5}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 6}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 7}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 8}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 9}`);
      } else if (this.value.length === 3 && this.value.includes("s")) {
        parsedYears = this.value.split("s").filter((x) => x);

        if (parseInt(this.value) < new Date().getFullYear() - 2000) {
          parsedYears[0] = `20${parsedYears[0]}`;
        } else {
          parsedYears[0] = `19${parsedYears[0]}`;
        }
        parsedYears.push(`${parseInt(parsedYears[0]) + 1}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 2}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 3}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 4}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 5}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 6}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 7}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 8}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 9}`);
      } else if (this.value.length === 4 && parseInt(this.value)) {
        parsedYears = [this.value];
      }

      return parsedYears;
    },
    bestMovieFromEachYear () {
      const years = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        let year;

        year = new Date(result.movie.release_date).getFullYear();

        if (!years[year]) {
          years[year] = result;
        } else if (this.mostRecentRating(result).calculatedTotal > this.mostRecentRating(years[year]).calculatedTotal) {
          years[year] = result;
        }
      })

      return Object.keys(years).map((year) => years[year]);
    },
    bestPictures () {
      const bestPictureWinners = this.$store.state.academyAwardWinners.bestPicture;

      const allEntryIds = this.allEntriesWithFlatKeywordsAdded.map((result) => {
        return this.topStructure(result).id;
      });

      const bestPictureWinnersWithRatingStatus = [];

      bestPictureWinners.forEach((movie) => {
        if (allEntryIds.includes(movie.id)) {
          bestPictureWinnersWithRatingStatus.push({
            ...this.allEntriesWithFlatKeywordsAdded.find((entry) => entry.movie.id === movie.id),
            ...{
              movie: {
                ...this.allEntriesWithFlatKeywordsAdded.find((entry) => entry.movie.id === movie.id).movie,
                academyAwardsYear: movie.academyAwardsYear
              }
            }
          });
        } else {
          bestPictureWinnersWithRatingStatus.push({
            falseEntry: true,
            movie: movie,
            ratings: [
              {
                date: Date.now(),
                direction: 0,
                id: movie.id,
                imagery: 0,
                impression: 0,
                love: 0,
                medium: "",
                overall: 0,
                performance: 0,
                soundtrack: 0,
                stickiness: 0,
                story: 0,
                title: movie.title,
                year: new Date(movie.release_date).getFullYear()
              }
            ]
          });
        }
      });

      return bestPictureWinnersWithRatingStatus;
    },
    thisYearsMovies () {
      const currentYear = new Date().getFullYear();

      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const mostRecentRating = this.mostRecentRating(result);

        if (mostRecentRating && mostRecentRating.date) {
          const ratingYear = new Date(parseInt(mostRecentRating.date)).getFullYear();
          return ratingYear === currentYear;
        }

        return false;
      });
    },
    lastYearsMovies () {
      const lastYear = new Date().getFullYear() - 1;

      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const mostRecentRating = this.mostRecentRating(result);

        if (mostRecentRating && mostRecentRating.date) {
          const ratingYear = new Date(parseInt(mostRecentRating.date)).getFullYear();
          return ratingYear === lastYear;
        }

        return false;
      });
    },
    thisMonthsMovies () {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const mostRecentRating = this.mostRecentRating(result);

        if (mostRecentRating && mostRecentRating.date) {
          const ratingMonth = new Date(parseInt(mostRecentRating.date)).getMonth();
          const ratingYear = new Date(parseInt(mostRecentRating.date)).getFullYear();
          return ratingMonth === currentMonth && ratingYear === currentYear;
        }

        return false;
      });
    },
    lastMonthsMovies () {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
    
      // Adjust for January
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const mostRecentRating = this.mostRecentRating(result);
    
        if (mostRecentRating && mostRecentRating.date) {
          const ratingDate = new Date(parseInt(mostRecentRating.date));
          const ratingMonth = ratingDate.getMonth();
          const ratingYear = ratingDate.getFullYear();
          return ratingMonth === lastMonth && ratingYear === lastMonthYear;
        }
    
        return false;
      });
    },
    notOnLetterboxdMovies () {
      if (!this.$store.state.settings.letterboxdConnected || !this.$store.state.settings.letterboxdUsername) {
        return [];
      }

      // If we don't have letterboxd data yet, return empty array
      if (!this.letterboxdUserData) {
        return [];
      }

      // Filter movies that are NOT in the user's Letterboxd films
      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const movie = this.topStructure(result);
        
        // Check if this movie exists in the user's Letterboxd films
        const movieExists = this.letterboxdUserData.films.some(film => {
          const normalizedFilmTitle = this.normalizeMovieTitle(film.title);
          const normalizedSearchTitle = this.normalizeMovieTitle(movie.title);
          return normalizedFilmTitle === normalizedSearchTitle;
        });
        
        // Return movies that are NOT on Letterboxd
        return !movieExists;
      });
    },
    matchingTags () {
      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        return result.ratings.map((rating) => rating.tags || []).flat().map((tag) => tag.title).includes(this.activeQuickLinkList);
      });
    },
    bestPicturesWithRatings () {
      return this.bestPictures.filter((result) => !result.falseEntry);
    },
    showResultsList () {
      return Boolean(this.paginatedSortedResults.length) || this.activeQuickLinkList !== "title";
    },
    sortedResults () {
      return [...this.filteredResults].sort(this.sortResults);
    },
    sortedByRating () {
      const allMediaSortedByRating = this.$store.getters.allMediaSortedByRating;

      if (this.sortOrder === 'bestOrNewestOnTop') {
        return allMediaSortedByRating;
      } else {
        return allMediaSortedByRating.slice().reverse();
      }
    },
    paginatedSortedResults () {
      return this.sortedResults.slice(0, this.numberOfResultsToShow);
    },
    datalistForActiveQuickLink () {
      if (this.activeQuickLinkList === "keyword") {
        return this.allKeywords;
      } else if (this.activeQuickLinkList === "genre") {
        return this.allGenres;
      } else if (this.activeQuickLinkList === "year") {
        return this.allYears;
      } else if (this.activeQuickLinkList === "director") {
        return this.allDirectors;
      } else if (this.activeQuickLinkList === "cast/crew") {
        return this.allCastCrew;
      } else if (this.activeQuickLinkList === "studios") {
        return this.allStudios;
      } else if (this.activeQuickLinkList === "mediums") {
        return this.allMediums;
      } else {
        return [];
      }
    },
    sortedDataForActiveQuickLinkList () {
      const data = [...this.datalistForActiveQuickLink];

      if (this.quickLinksSortType === "a-z") {
        return data.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        return data.sort((a, b) => b.count - a.count);
      }
    },
    allKeywords () {
      return Object.keys(this.countedKeywords).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countedKeywords[keyword]
        }
      });
    },
    allGenres () {
      return Object.keys(this.countedGenres).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countedGenres[keyword]
        }
      });
    },
    allYears () {
      return Object.keys(this.countedYears).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countedYears[keyword]
        }
      });
    },
    allDirectors () {

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
    allCastCrew () {
      return Object.keys(this.countCastCrew).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countCastCrew[keyword]
        }
      });
    },
    allStudios () {
      return Object.keys(this.countStudios).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countStudios[keyword]
        }
      });
    },
    allMediums () {
      const mediums = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        result.ratings.forEach((rating) => {
          if (!rating.medium) {
            return;
          } else if (mediums[rating.medium]) {
            mediums[rating.medium]++;
          } else {
            mediums[rating.medium] = 1;
          }
        });
      });

      return Object.keys(mediums).map((medium) => {
        return {
          name: this.titleCase(medium),
          count: mediums[medium]
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
        const director = result.movie.crew?.find((person) => person.job === "Director")?.name;

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
    resultsAreFiltered () {
      return Boolean(this.value);
    },
    placeholder () {
      if (this.activeQuickLinkList === 'annual') {
        return "The best of each year";
      } else if (this.activeQuickLinkList === 'bestPicture') {
        return "The Best Picture winners";
      } else {
        return "Search...";
      }
    },
    listCountClasses () {
      const count = this.paginatedSortedResults.length;

      return {
        "count-is-1": count === 1,
        "count-is-2": count === 2,
        "count-is-3": count === 3,
        "count-is-4": count === 4,
        "count-more-than-4-remainder-0": count > 4 & count % 4 === 0,
        "count-more-than-4-remainder-1": count > 4 & count % 4 === 1,
        "count-more-than-4-remainder-2": count > 4 & count % 4 === 2,
        "count-more-than-4-remainder-3": count > 4 & count % 4 === 3
      }
    },
    userRatedMovieCount() {
      // Count the number of movies the user has rated (not TV shows)
      return this.allEntriesWithFlatKeywordsAdded.length;
    },
    suggestionsButtonLabel() {
      return this.userRatedMovieCount === 0
        ? 'Suggest some movies to rate'
        : 'Suggest more movies to rate';
    },
    columnsForUnratedMovies () {
      if (this.unratedMovies.length % 4 === 0) {
        return "col-3";
      } else {
        return "col-4";
      }
    }
  },
  methods: {
    toggleSettingsPanel () {
      this.showSettingsPanel = !this.showSettingsPanel;
    },
    getGridClassesForGroup (count) {
      return {
        "count-is-1": count === 1,
        "count-is-2": count === 2,
        "count-is-3": count === 3,
        "count-is-4": count === 4,
        "count-more-than-4-remainder-0": count > 4 & count % 4 === 0,
        "count-more-than-4-remainder-1": count > 4 & count % 4 === 1,
        "count-more-than-4-remainder-2": count > 4 & count % 4 === 2,
        "count-more-than-4-remainder-3": count > 4 & count % 4 === 3
      }
    },
    checkResultsAndFindFilter () {
      const allowRandom = !this.$route.query.noRandom;
      const hasResults = this.paginatedSortedResults.length > 0;
      const hasNotCalledFindFilter = !this.hasCalledFindFilter;

      if (allowRandom && hasResults && hasNotCalledFindFilter) {
        this.findRandomSearchValue();
        this.hasCalledFindFilter = true;
      }
    },
    findRandomSearchValue () {
      this.$router.push({ query: { ...this.$route.query, returnFromRating: undefined } });
      const countedLists = ["keyword", "genre", "year", "director", "cast/crew", "studios"];
      const randomList = countedLists[Math.floor(Math.random() * countedLists.length)];

      const minimumCount = 3;

      let counts;
      switch (randomList) {
        case "keyword":
          counts = this.countedKeywords;
          break;
        case "genre":
          counts = this.countedGenres;
          break;
        case "year":
          counts = this.countedYears;
          break;
        case "director":
          counts = this.countDirectors;
          break;
        case "cast/crew":
          counts = this.countCastCrew;
          break;
        case "studios":
          counts = this.countStudios;
          break;
      }

      const valuesFromRandomCountedList = Object.keys(counts);
      let randomValue;
      let safetyLimit = 100;

      do {
        const randomIndex = Math.floor(Math.random() * valuesFromRandomCountedList.length);
        randomValue = valuesFromRandomCountedList[randomIndex];
        safetyLimit--;
      } while (counts[randomValue] <= minimumCount && safetyLimit > 0);

      if (randomValue && safetyLimit > 0) {
        this.updateSearchValue(randomValue);
        this.sortOrder = "bestOrNewestOnTop";
      } else {
        this.clearValue();
      }
    },
    async wikiLinkFor (searchValue) {
      const wiki = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrnamespace=0&gsrlimit=5&gsrsearch=%27${searchValue}%27`);
      const pages = wiki.data.query.pages;
      const pagesArray = Object.keys(pages).map((page) => pages[page]);
      const bestMatch = minBy(pagesArray, (page) => page.index);

      return `https://en.m.wikipedia.org/w/index.php?curid=${bestMatch.pageid}`;
    },
    async goToWikipedia () {
      this.insetBrowserUrl = await this.wikiLinkFor(this.value);
      this.showInsetBrowserModal = true;
    },
    clearValue () {
      this.value = "";
    },
    async fetchLetterboxdData () {
      if (!this.$store.state.settings.letterboxdConnected || !this.$store.state.settings.letterboxdUsername) {
        return;
      }

      const username = this.$store.state.settings.letterboxdUsername;
      
      try {
        // Import the LetterboxdScrapingService dynamically
        const LetterboxdScrapingService = (await import('../services/LetterboxdScrapingService.js')).default;
        
        // Get user's Letterboxd data (this will use cache if available)
        this.letterboxdUserData = await LetterboxdScrapingService.getUserData(username);
        
      } catch (error) {
        console.error('Error fetching Letterboxd data:', error);
        this.letterboxdUserData = null;
      }
    },
    normalizeMovieTitle (title) {
      // Use the same normalization logic as LetterboxdScrapingService
      return title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    },
    updateSearchValue (value) {
      this.value = value;

      window.scroll({
        top: 0,
        left: 0,
        behavior: 'instant'
      });

      this.$refs.insightsAccordion?.classList.remove("show");
    },
    toggleQuickLinksSort () {
      if (this.quickLinksSortType === "a-z") {
        this.quickLinksSortType = "count";
      } else {
        this.quickLinksSortType = "a-z";
      }
    },
    toggleQuickLinksAccordion (event) {
      if (event.delegateTarget.classList.contains("collapsed")) {
        this.updateSearchValue(null);
        this.activeQuickLinkList = "title";
      }
    },
    toggleQuickLinksList (value) {
      if (this.activeQuickLinkList === value || !value) {
        this.activeQuickLinkList = "title";
        this.updateSearchValue("");
        this.$refs.QuickLinksAccordion?.classList.remove("show");
      } else if (this.tags?.includes(value)) {
        this.activeQuickLinkList = value;
        this.sortOrder = "bestOrNewestOnTop";

        this.updateSearchValue(value);
      } else {
        this.activeQuickLinkList = value;

        this.$refs.QuickLinksAccordion?.classList.add("show");
      }
    },
    toggleAnnualBestFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "annual") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "annual";
        this.$store.commit("setDBSortValue", "release");
      }
    },
    toggleBestPicturesFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "bestPicture") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "bestPicture";
        this.$store.commit("setDBSortValue", "release");
      }
    },
    toggleThisYearFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "thisYear") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "thisYear";
        this.$store.commit("setDBSortValue", "rating");
      }
    },
    toggleLastYearFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "lastYear") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "lastYear";
        this.$store.commit("setDBSortValue", "rating");
      }
    },
    toggleThisMonthFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "thisMonth") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "thisMonth";
        this.$store.commit("setDBSortValue", "rating");
      }
    },
    toggleLastMonthFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "lastMonth") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "lastMonth";
        this.$store.commit("setDBSortValue", "rating");
      }
    },
    async toggleNotOnLetterboxdFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "notOnLetterboxd") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "notOnLetterboxd";
        this.$store.commit("setDBSortValue", "rating");
        
        // Fetch Letterboxd data if we don't have it yet
        await this.fetchLetterboxdData();
      }
    },
    toggleSortOrder () {
      if (this.sortOrder === "bestOrNewestOnTop") {
        this.setSortOrder("worstOrOldestOnTop");
      } else {
        this.setSortOrder("bestOrNewestOnTop");
      }
    },
    setSortOrder (order) {
      this.sortOrder = order;
    },
    setSortValue (value) {
      this.sortValue = value;
    },
    setOrToggleSortValue (value) {
      if (this.sortValue === value) {
        this.toggleSortOrder();
      } else {
        this.setSortValue(value);
        this.setSortOrder("bestOrNewestOnTop");
      }
    },
    getSortValue (item, key) {
      if (key === "rating") {
        return this.mostRecentRating(item).calculatedTotal;
      } else if (key === "release") {
        return new Date(this.getYear(item), 0, 1);
      } else if (key === "title") {
        return this.topStructure(item).title;
      } else if (key === "watched") {
        const date = this.mostRecentRating(item).date || "3/22/1982";
        return new Date(date);
      } else if (key === "views") {
        return item.ratings.length;
      } else {
        const keyScore = parseInt(this.mostRecentRating(item)[key]);
        const keysToCompare = ["direction", "imagery", "impression", "love", "performance", "soundtrack", "stickiness", "story"];
        const isKeyScoreHighestScore = keysToCompare.some((keyToCompare) => {
          const keyToCompareScore = parseInt(this.mostRecentRating(item)[keyToCompare]);
          return keyToCompareScore >= keyScore;
        });
        return isKeyScoreHighestScore ? keyScore : 0;
      }
    },
    sortResults (a, b) {
      const sortValueA = this.getSortValue(a, this.sortValue || "rating");
      const sortValueB = this.getSortValue(b, this.sortValue || "rating");

      if (sortValueA === sortValueB) {
        const secondarySortValueA = this.mostRecentRating(a).calculatedTotal;
        const secondarySortValueB = this.mostRecentRating(b).calculatedTotal;

        if (secondarySortValueA < secondarySortValueB) {
          return this.sortOrder === "bestOrNewestOnTop" ? 1 : -1;
        }
        if (secondarySortValueA > secondarySortValueB) {
          return this.sortOrder === "bestOrNewestOnTop" ? -1 : 1;
        }
        return 0;
      }

      if (sortValueA < sortValueB) {
        return this.sortOrder === "bestOrNewestOnTop" ? 1 : -1;
      }
      if (sortValueA > sortValueB) {
        return this.sortOrder === "bestOrNewestOnTop" ? -1 : 1;
      }

      return 0;
    },
    toggleCountViewsAverage () {
      if (this.showAverage) {
        this.showAverage = false;
        this.showViewCount = true;
      } else if (this.showViewCount) {
        this.showAverage = false;
        this.showViewCount = false;
      } else {
        this.showAverage = true;
        this.showViewCount = false;
      }
    },
    averageRating (results) {
      const ratedMovies = results.filter((result) => this.mostRecentRating(result).calculatedTotal);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
      const total = ratings.reduce((a, b) => a + b, 0);
      return (total / ratings.length).toFixed(2);
    },
    viewsCount (results) {
      return results.reduce((total, result) => {
        return total + (result.ratings ? result.ratings.length : 0);
      }, 0);
    },
    getYear (media) {
      const date = media.movie.release_date;

      return new Date(date).getFullYear();
    },
    mostRecentRating (media) {
      return getRating(media);
    },
    async searchTMDB () {
      if (!this.value) {
        return;
      }

      const resp = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US&query=${this.value}`);

      if (resp.data.results.length) {
        this.newEntrySearch(resp.data.results);

        window.scroll({
          top: 0,
          left: 0,
          behavior: 'instant'
        });
      } else {
        this.showNoResultsMessage();
      }
    },
    newEntrySearch (results) {
      this.$store.commit('setNewEntrySearchResults', results)

      this.$router.push(`/pick-media/${this.value}`);
    },
    showNoResultsMessage () {
      this.noResults = true;

      setTimeout(() => {
        this.noResults = false;
        this.clearValue();
      }, 3000);
    },
    addMoreResults () {
      // Add movies in increments of 48 for stable grid layout
      this.numberOfResultsToShow = this.numberOfResultsToShow + 48;

      this.$nextTick(() => {
        window.scrollBy({
          top: 500,
          behavior: 'smooth'
        })
      });
    },
    async shareResults () {
      this.sharing = true;

      const shareObject = {
        results: this.sortedResults,
        sortOrder: this.sortOrder,
        sortValue: this.sortValue,
        value: this.value
      };

      const dbKey = `${new Date().getTime()}-${crypto.randomUUID()}`;

      const dbEntry = {
        path: `sharedDBSearches/${dbKey}`,
        value: shareObject
      }

      this.$store.dispatch('setDBValue', dbEntry);

      this.sharing = false;
      this.value = "";

      this.$nextTick(() => {
        this.$router.push(`/share/${this.$store.state.databaseTopKey}/${dbKey}`);
      });
    },
    topStructure (result) {
      return result.movie;
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
    focusOnSearchBar (event) {
      event.target.classList.add('font-size-increased');
      event.target.style.fontSize = '16px';

      // Select the text if there is any text in the input
      if (event.target.value) {
        event.target.select();
      }
    },
    blurSearchBar (event) {
      event.target.classList.remove('font-size-increased');
      event.target.style.fontSize = '12px';
    },
    handleTouchStart (event) {
      event.target.classList.add('touch-active');
    },
    handleTouchEnd (event) {
      event.target.classList.remove('touch-active');
    },
    goToInsights () {
      this.$router.push('/insights');
    },
    saveNormalizationTweak() {
      this.$store.dispatch('setDBValue', { path: 'settings/normalizationTweak', value: this.normalizationTweak });
    },
    saveTieBreakTweak() {
      this.$store.dispatch('setDBValue', { path: 'settings/tieBreakTweak', value: this.tieBreakTweak });
    },
    saveLetterboxdConnection() {
      this.$store.dispatch('setDBValue', { path: 'settings/letterboxdConnected', value: this.letterboxdConnected });
    },
    saveLetterboxdUsername() {
      this.$store.dispatch('setDBValue', { path: 'settings/letterboxdUsername', value: this.letterboxdUsername });
      // Auto-enable integration when username is provided
      if (this.letterboxdUsername && !this.letterboxdConnected) {
        this.letterboxdConnected = true;
        this.saveLetterboxdConnection();
      }
    },
    // Test function for Letterboxd URL generation (call from browser console)
    // Test function for Letterboxd scraping (UI button)
    async testLetterboxdScraping() {
      const username = this.letterboxdUsername || this.$store.state.settings.letterboxdUsername;
      
      if (!username) {
        this.scrapingTest.error = 'No Letterboxd username set';
        this.scrapingTest.success = false;
        this.scrapingTest.result = null;
        return;
      }
      
      this.scrapingTest.loading = true;
      this.scrapingTest.result = null;
      this.scrapingTest.error = null;
      
      try {
        // Import the scraping service dynamically
        const LetterboxdScrapingService = (await import('../services/LetterboxdScrapingService.js')).default;
        const result = await LetterboxdScrapingService.testScraping(username);
        
        this.scrapingTest.result = result;
        this.scrapingTest.success = result && result.films && result.films.length > 0;
        this.scrapingTest.loading = false;
        
        // Also log to console for debugging
        console.log('🎬 Letterboxd test results:', result);
        
      } catch (error) {
        console.error('❌ Letterboxd test failed:', error);
        this.scrapingTest.error = error.message || 'Test failed';
        this.scrapingTest.success = false;
        this.scrapingTest.loading = false;
      }
    },
    debouncedFetchUnratedMoviesByValue(value) {
      clearTimeout(this.unratedMoviesDebounceTimeout);
      this.unratedMoviesDebounceTimeout = setTimeout(() => {
        this.fetchUnratedMoviesByValue(value);
      }, 800);
    },
    // Detection methods for different search types
    detectSearchType(value) {
      const trimmed = value.trim();
      
      // Year patterns
      if (/^\d{4}$/.test(trimmed)) {
        const year = parseInt(trimmed);
        if (year >= 1900 && year <= new Date().getFullYear() + 5) {
          return { type: 'year', value: year };
        }
      }
      
      // 2-digit year (e.g., "95" → 1995)
      if (/^\d{2}$/.test(trimmed)) {
        const shortYear = parseInt(trimmed);
        const currentYear = new Date().getFullYear();
        const currentCentury = Math.floor(currentYear / 100) * 100;
        const fullYear = shortYear <= (currentYear % 100) + 10 ? currentCentury + shortYear : currentCentury - 100 + shortYear;
        return { type: 'year', value: fullYear };
      }
      
      // Year range (e.g., "1990-1995")
      const rangeMatch = trimmed.match(/^(\d{4})-(\d{4})$/);
      if (rangeMatch) {
        const startYear = parseInt(rangeMatch[1]);
        const endYear = parseInt(rangeMatch[2]);
        if (startYear >= 1900 && endYear <= new Date().getFullYear() + 5 && startYear <= endYear) {
          return { type: 'yearRange', startYear, endYear };
        }
      }
      
      // Decade patterns (e.g., "90s", "1990s")
      const decadeMatch = trimmed.match(/^(\d{2,4})s$/i);
      if (decadeMatch) {
        let decade = parseInt(decadeMatch[1]);
        if (decade < 100) {
          // Convert 2-digit to 4-digit (e.g., "90" → "1990")
          const currentYear = new Date().getFullYear();
          const currentCentury = Math.floor(currentYear / 100) * 100;
          decade = decade <= (currentYear % 100) + 10 ? currentCentury + decade : currentCentury - 100 + decade;
        }
        decade = Math.floor(decade / 10) * 10; // Round down to decade
        return { type: 'yearRange', startYear: decade, endYear: decade + 9 };
      }
      
      // Common genre patterns
      const commonGenres = {
        'action': 28, 'adventure': 12, 'animation': 16, 'comedy': 35, 
        'crime': 80, 'documentary': 99, 'drama': 18, 'family': 10751,
        'fantasy': 14, 'history': 36, 'horror': 27, 'music': 10402,
        'mystery': 9648, 'romance': 10749, 'sci-fi': 878, 'science fiction': 878,
        'thriller': 53, 'war': 10752, 'western': 37
      };
      
      const lowerValue = trimmed.toLowerCase();
      if (commonGenres[lowerValue]) {
        return { type: 'genre', genreId: commonGenres[lowerValue], value: trimmed };
      }
      
      // For everything else, try both person and keyword search
      return { type: 'general', value: trimmed };
    },
    async fetchUnratedMoviesByYear(year) {
      // Fetch multiple pages to get more variety
      const allResults = [];
      
      for (let page = 1; page <= 3; page++) { // Get first 3 pages (60 movies)
        const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
          params: {
            api_key: process.env.VUE_APP_TMDB_API_KEY,
            language: 'en-US',
            primary_release_year: year,
            sort_by: 'popularity.desc',
            page: page,
            'vote_count.gte': 25, // Further lowered to include more movies
            include_adult: false, // Explicitly exclude adult content
          }
        });
        
        if (response.data.results) {
          allResults.push(...response.data.results);
        }
        
        // Stop if we've reached the end
        if (page >= response.data.total_pages) break;
      }
      return allResults;
    },
    async fetchUnratedMoviesByYearRange(startYear, endYear) {
      const allResults = [];
      
      for (let page = 1; page <= 2; page++) { // Get first 2 pages (40 movies) for ranges
        const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
          params: {
            api_key: process.env.VUE_APP_TMDB_API_KEY,
            language: 'en-US',
            'primary_release_date.gte': `${startYear}-01-01`,
            'primary_release_date.lte': `${endYear}-12-31`,
            sort_by: 'popularity.desc',
            page: page,
            'vote_count.gte': 25,
            include_adult: false, // Explicitly exclude adult content
          }
        });
        
        if (response.data.results) {
          allResults.push(...response.data.results);
        }
        
        // Stop if we've reached the end
        if (page >= response.data.total_pages) break;
      }
      
      return allResults;
    },
    async fetchUnratedMoviesByGenre(genreId) {
      const allResults = [];
      
      // Filter out movies newer than 2 years to avoid current buzz
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - 2);
      const maxDateString = maxDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      for (let page = 1; page <= 3; page++) { // Get first 3 pages (60 movies)
        const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
          params: {
            api_key: process.env.VUE_APP_TMDB_API_KEY,
            language: 'en-US',
            with_genres: genreId,
            sort_by: 'popularity.desc',
            page: page,
            'vote_count.gte': 50, // Increased vote threshold for better quality
            'primary_release_date.lte': maxDateString, // No movies newer than 2 years
            include_adult: false, // Explicitly exclude adult content
          }
        });
        
        if (response.data.results) {
          allResults.push(...response.data.results);
        }
        
        // Stop if we've reached the end
        if (page >= response.data.total_pages) break;
      }
      
      return allResults;
    },
    async fetchUnratedMoviesByKeyword(keyword) {
      // Filter out movies newer than 1 year to avoid current buzz
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - 1);
      const maxYear = maxDate.getFullYear();
      
      // First try movie search
      const movieSearchResp = await axios.get('https://api.themoviedb.org/3/search/movie', {
        params: {
          api_key: process.env.VUE_APP_TMDB_API_KEY,
          language: 'en-US',
          query: keyword,
          page: 1,
          include_adult: false, // Explicitly exclude adult content
        }
      });
      
      let allResults = (movieSearchResp.data.results || []).filter(movie => {
        const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 0;
        return releaseYear <= maxYear && movie.vote_count >= 30; // Filter by age and vote count
      });
      
      // If we don't get enough results, try keyword search
      if (allResults.length < 10) {
        try {
          const keywordSearchResp = await axios.get('https://api.themoviedb.org/3/search/keyword', {
            params: {
              api_key: process.env.VUE_APP_TMDB_API_KEY,
              language: 'en-US',
              query: keyword,
            }
          });
          
          if (keywordSearchResp.data.results && keywordSearchResp.data.results.length > 0) {
            const keywordId = keywordSearchResp.data.results[0].id;
            
            // Get movies with this keyword, filtered by age
            const maxDateString = maxDate.toISOString().split('T')[0]; // YYYY-MM-DD format
            const keywordMoviesResp = await axios.get('https://api.themoviedb.org/3/discover/movie', {
              params: {
                api_key: process.env.VUE_APP_TMDB_API_KEY,
                language: 'en-US',
                with_keywords: keywordId,
                sort_by: 'popularity.desc',
                page: 1,
                'vote_count.gte': 50, // Higher threshold for keyword searches
                'primary_release_date.lte': maxDateString, // No movies newer than 1 year
                include_adult: false, // Explicitly exclude adult content
              }
            });
            
            const keywordResults = keywordMoviesResp.data.results || [];
            // Merge results, prioritizing direct movie search results
            allResults = [...allResults, ...keywordResults];
          }
        } catch (keywordError) {
          console.log('Keyword search failed, using movie search results only:', keywordError);
        }
      }
      
      return allResults;
    },
    async fetchUnratedMoviesByValue(value) {
      this.unratedMoviesLoading = true;
      this.unratedMoviesError = null;
      this.unratedMovies = [];
      
      try {
        // Detect what type of search this is
        const searchInfo = this.detectSearchType(value);
        this.unratedMoviesSearchType = searchInfo.type;
        
        let relevantList = [];
        
        if (searchInfo.type === 'year') {
          // Fetch movies from specific year
          relevantList = await this.fetchUnratedMoviesByYear(searchInfo.value);
        } else if (searchInfo.type === 'yearRange') {
          // Fetch movies from year range
          relevantList = await this.fetchUnratedMoviesByYearRange(searchInfo.startYear, searchInfo.endYear);
        } else if (searchInfo.type === 'genre') {
          // Fetch movies from specific genre
          relevantList = await this.fetchUnratedMoviesByGenre(searchInfo.genreId);
        } else if (searchInfo.type === 'general') {
          // Try keyword/general search first
          relevantList = await this.fetchUnratedMoviesByKeyword(searchInfo.value);
          
          // If keyword search didn't yield good results, fall back to person search
          if (relevantList.length < 5) {
            try {
              const personResp = await axios.get('https://api.themoviedb.org/3/search/person', {
                params: {
                  api_key: process.env.VUE_APP_TMDB_API_KEY,
                  language: 'en-US',
                  query: searchInfo.value,
                }
              });

              if (personResp.data.results && personResp.data.results.length <= 3 && personResp.data.results.length > 0) {
                const person = personResp.data.results[0];
                const creditsResp = await axios.get(`https://api.themoviedb.org/3/person/${person.id}/movie_credits`, {
                  params: {
                    api_key: process.env.VUE_APP_TMDB_API_KEY,
                    language: 'en-US',
                  }
                });
                
                // Use person search logic
                const department = (person.known_for_department || '').toLowerCase();
                let personRelevantList = [];
                
                if (department === 'acting') {
                  personRelevantList = creditsResp.data.cast || [];
                } else if (department === 'directing') {
                  personRelevantList = (creditsResp.data.crew || []).filter(c => c.department && c.department.toLowerCase() === 'directing');
                  const relevantJobs = ['director', 'co-director', 'second unit director', 'assistant director'];
                  personRelevantList = personRelevantList.filter(c => relevantJobs.includes((c.job || '').toLowerCase()));
                } else {
                  // fallback: show all movies from both cast and crew
                  personRelevantList = [
                    ...(creditsResp.data.cast || []),
                    ...(creditsResp.data.crew || [])
                  ];
                }
                
                // Merge person results with keyword results, giving priority to keyword results
                relevantList = [...relevantList, ...personRelevantList];
                this.unratedMoviesSearchType = 'person'; // Update search type for display
              }
            } catch (personError) {
              console.log('Person search fallback failed:', personError);
            }
          }
        } else {
          // This shouldn't happen with our current logic, but keep as fallback
          relevantList = [];
        }
        
        // Filter out already rated movies and remove duplicates
        const ratedIds = new Set(this.allEntriesWithFlatKeywordsAdded.map(r => this.topStructure(r).id));
        const seenIds = new Set();
        const unrated = [];
        
        for (const m of relevantList) {
          if (!ratedIds.has(m.id) && !seenIds.has(m.id)) {
            unrated.push(m);
            seenIds.add(m.id);
          }
        }
        
        // Sort by popularity and apply filtering
        if (unrated.length > 0) {
          unrated.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
          
          const popularities = unrated.map(m => m.popularity).filter(p => typeof p === 'number');
          if (popularities.length > 0) {
            const max = Math.max(...popularities);
            const min = Math.min(...popularities);
            
            // Use more lenient filtering for different search types
            let cutoffPercentage;
            if (this.unratedMoviesSearchType === 'year' || this.unratedMoviesSearchType === 'yearRange') {
              cutoffPercentage = 0.2; // Keep movies in top 80% for year searches
            } else if (this.unratedMoviesSearchType === 'genre') {
              cutoffPercentage = 0.3; // Keep movies in top 70% for genre searches
            } else if (this.unratedMoviesSearchType === 'general') {
              cutoffPercentage = 0.4; // Keep movies in top 60% for keyword searches
            } else {
              cutoffPercentage = 0.6; // Keep original strict filtering for person searches
            }
            
            const cutoff = min + (max - min) * cutoffPercentage;
            let filtered = unrated.filter(m => m.popularity >= cutoff);
            
            // Show more movies for different search types
            let targetCount;
            if (this.unratedMoviesSearchType === 'year' || this.unratedMoviesSearchType === 'yearRange') {
              targetCount = 18;
            } else if (this.unratedMoviesSearchType === 'genre') {
              targetCount = 15;
            } else if (this.unratedMoviesSearchType === 'general') {
              targetCount = 12;
            } else {
              targetCount = 12; // Default for person searches
            }
            
            if (filtered.length < targetCount && unrated.length > targetCount) {
              filtered = unrated.slice(0, targetCount);
            }
            
            this.unratedMovies = filtered;
          } else {
            this.unratedMovies = unrated.slice(0, 12);
          }
        } else {
          this.unratedMovies = [];
        }
        
      } catch (err) {
        console.error('Error fetching unrated movies:', err);
        this.unratedMoviesError = 'Error fetching from TMDB.';
      } finally {
        this.unratedMoviesLoading = false;
      }
    },
  },
}
</script>

<style lang="scss">
  .home {
    max-width: 832px;

    .search-bar {
      max-width: 416px;

      input#search {
        border-bottom-right-radius: .375rem;
        border-top-right-radius: .375rem;

        &.has-content {
          padding-left: 36px;
          padding-right: 36px;
        }

        &.font-size-increased {
          margin: -6px 0 0;

          & + .clear-button {
            transform: translateY(calc(-50% - 3px));
          }

          & + .clear-button + .more-info-button {
            transform: translateY(calc(-50% - 3px));
          }
        }
      }

      .clear-button {
        align-items: center;
        color: black;
        cursor: pointer;
        display: flex;
        height: 60px;
        justify-content: center;
        right: 0px;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        z-index: 5;
        overflow: hidden;
      }

      .clear-button::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 200%;
        height: 200%;
        background-color: rgba(0, 0, 0, 0.1);
        transform: translate(-50%, -50%) scale(0);
        transition: transform 0.5s ease-out;
        border-radius: 50%;
      }

      .clear-button:active::before {
        transform: translate(-50%, -50%) scale(1);
      }

      .clear-button:hover,
      .clear-button:focus,
      .clear-button.touch-active {
        background-color: rgba(0, 0, 0, 0.1);
        height: 30px;
      }

      .more-info-button {
        align-items: center;
        color: black;
        cursor: pointer;
        display: flex;
        height: 40px;
        justify-content: center;
        left: 0px;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        z-index: 5;
      }

      svg {
        height: 18px;
        width: 18px;
      }
    }

    .results {
      .results-count {
        font-size: 1rem;
      }

      .results-actions {
        .dropdown-item {
          &.active,
          &:active {
            color: #1e2125;
            background-color: #e9ecef;
          }
        }

        .dropdown-toggle {
          position: relative;

          &::after {
            display: none;
          }

          > i {
            margin-right: 6px;
          }

          .order-arrow {
            position: absolute;
            right: 7px;
            top: 49%;
            transform: translateY(-49%);
          }
        }

        button {
          svg {
            height: 14px;
            width: 14px;
          }

          border: none;

          &.results-actions-button {
            &:nth-child(1) {
              background-color: #E71D36; /* Red */
              color: white;
            }

            &:nth-child(2) {
              background-color: #FF9F1C; /* Orange */
              color: black;
            }

            &:nth-child(3) {
              background-color: #FFD700; /* Yellow */
              color: black;
            }

            &:nth-child(4) {
              background-color: #24d776; /* Green */
              color: black;
            }

            &:nth-child(5) {
              background-color: #1D8BF1; /* Blue */
              color: black;
            }

            &:nth-child(6) {
              background-color: #5A189A; /* Indigo */
              color: white;
            }

            &:nth-child(7) {
              background-color: #cd7fe8; /* Violet */
              color: white;
            }

            &:nth-child(8) {
              background-color: #00FFFF; /* Cyan */
              color: white;
            }
          }
        }

        .filtered-count-display {
          .average-label {
            font-size: 0.5rem;
            position: absolute;
            bottom: 4px;
            left: 50%;
            transform: translateX(-50%);
          }

          .average-value {
            position: relative;
            top: -4px;
          }
        }

        .quick-link-types {
          row-gap: 6px;

          span {
            cursor: pointer;
            font-size: 0.75rem;
          }

          hr {
            margin: 14px 0 10px;
          }

          .tags-quicklinks {
            position: relative;

            p {
              background: #212529;
              cursor: pointer;
              font-size: 0.75rem;
              padding: 0 10px 0 7px;
              position: absolute;
              right: 0;
              top: -22px;

              &[aria-expanded="true"] {
                .bi-caret-right-fill::before {
                  transform: rotate(90deg);
                }
              }

              .bi-caret-right-fill::before {
                transition: transform .5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
              }
            }
          }

          .quick-links-list-wrapper {
            border: 1px solid #c0c2c3;
            max-height: 150px;
            overflow-y: scroll;
            position: relative;

            .quick-links-list-sort {
              position: sticky;
              top: 4px;
              left: 100%;
              border: 1px solid #c0c2c3;
              border-bottom-left-radius: 2px;
              padding: 2px 4px;
              background: white;
              font-size: 0.65rem;
              margin: 4px 8px;
            }

            .quick-link-list {
              column-count: 2;
              column-gap: 0;
              list-style: none;
              margin-top: -20px;

              li {
                .badge {
                  align-items: center;
                  cursor: pointer;
                  display: flex;
                  text-align: start;
                  white-space: break-spaces;

                  span {
                    font-size: 0.5rem;
                  }
                }
              }
            }
          }
        }
      }

      ul {
        list-style: none;
        width: 100%;
        padding: 0;
        margin: 0;

        &.grid-layout {
          display: grid;
          grid-gap: 0;

          li {
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);

            &.highlight {
              border: 2px solid #54b448;
              transform: scale(1.2);
              z-index: 1;
            }


            img {
              width: 100%;
              height: auto;
              object-fit: cover;
            }
          }

          &.count-is-1 {
            grid-template-columns: repeat(4, 1fr);

            li {
              grid-column: span 4;
              grid-row: span 2;

              @media screen and (min-width: 832px) {
                grid-column: 2 / span 2;
                grid-row: span 2;
              }
            }
          }

          &.count-is-2 {
            grid-template-columns: repeat(4, 1fr);

            li {
              grid-column: span 2;
              grid-row: span 2;
            }
          }

          &.count-is-3 {
            grid-template-columns: repeat(4, 1fr);

            @media screen and (min-width: 832px) {
              grid-template-columns: repeat(3, 1fr);
            }

            li {
              &:first-child {
                grid-column: span 4;
                grid-row: span 2;
              }

              &:nth-child(n+1) {
                grid-column-end: span 2;
              }

              @media screen and (min-width: 832px) {
                /* Override the first-child settings for larger screens */
                &:first-child {
                  grid-column: span 1; /* Corrected to span only 1 column */
                }
                /* Ensure each li takes up 1/3 of the width */
                &:nth-child(n+1) {
                  grid-column-end: span 1;
                }
              }
            }
          }

          &.count-is-4 {
            grid-template-columns: repeat(12, 1fr);

            li {
              &:first-child {
                grid-column: span 12;
                grid-row: span 12;
              }

              &:nth-child(2),
              &:nth-child(3),
              &:nth-child(4) {
                grid-column: span 4;
                grid-row: span 4;
              }

              @media screen and (min-width: 832px) {
                &:first-child,
                &:nth-child(2),
                &:nth-child(3),
                &:nth-child(4) {
                  grid-column: span 3;
                  grid-row: span 4;
                }
              }
            }
          }

          &.count-more-than-4-remainder-0 {
            grid-template-columns: repeat(12, 1fr);

            li {
              &:first-child {
                grid-column: span 12;
                grid-row: span 12;
              }

              &:nth-child(2),
              &:nth-child(3),
              &:nth-child(4) {
                grid-column: span 4;
                grid-row: span 4;
              }

              &:nth-child(n+5) {
                grid-column: span 3;
              }

              @media screen and (min-width: 832px) {
                &:first-child,
                &:nth-child(2),
                &:nth-child(3),
                &:nth-child(4),
                &:nth-child(n+5) {
                  grid-column: span 3;
                  grid-row: span 4;
                }
              }
            }
          }

          &.count-more-than-4-remainder-1 {
            grid-template-columns: repeat(4, 1fr);

            li {
              &:first-child {
                grid-column: span 2;
                grid-row: span 2;
              }

              &:nth-child(n+2) {
                grid-column: span 1;
                grid-row: span 1;
              }
            }
          }

          &.count-more-than-4-remainder-2 {
            grid-template-columns: repeat(4, 1fr);

            li {
              &:first-child {
                grid-column: span 2;
                grid-row: span  2;
              }

              &:nth-child(2) {
                grid-column: span 2;
                grid-row: span 2;
              }

              &:nth-child(n+2) {
                grid-column-end: span 1;
              }
            }
          }

          &.count-more-than-4-remainder-3 {
            grid-template-columns: repeat(4, 1fr);

            @media screen and (min-width: 832px) {
              grid-template-columns: repeat(12, 1fr);
            }

            li {
              &:first-child {
                grid-column: span 4;
                grid-row: span 4;
              }

              &:nth-child(2),
              &:nth-child(3) {
                grid-column: span 2;
                grid-row: span 2;
              }

              &:nth-child(n+4) {
                grid-column: span 1;
                grid-row: span 2;
              }

              @media screen and (min-width: 832px) {
                &:first-child,
                &:nth-child(2),
                &:nth-child(3) {
                  grid-column: span 4;
                  grid-row: span 2;
                }

                &:nth-child(n+4) {
                  grid-column: span 3;
                  grid-row: span 2;
                }
              }
            }
          }

          .cinemaroll-modal-content {
            max-height: 97vh !important;
          }
        }
      }
    }

    .unrated-movies-grid {
      border-top: 1px solid white;
      padding: 16px 0 50px;
      position: relative;

      h3 {
        font-size: 1rem;
        left: 50%;
        padding: 0 16px;
        position: absolute;
        top: 0;
        transform: translate(-50%, -50%);
        white-space: nowrap;
      }
    }

    .loading-screen {
      height: 75vh;
    }

    .btn {
      .spinner-border {
        height: 18px;
        width: 18px;
      }
    }

    .new-rating {
      a {
        cursor: pointer;
      }
    }

    .settings-panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.3);
      z-index: 2000;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
    }
    .settings-panel {
      width: 320px;
      max-width: 90vw;
      background: var(--bs-light, #fff);
      box-shadow: 0 2px 16px rgba(0,0,0,0.15);
      border-radius: 8px;
      margin: 2rem 2rem 0 0;
      animation: slideInRight 0.2s;
    }
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  }

  .bg-dark {
    .home {
      color: white;

      ul {
        .media-result {
          border-color: white;
        }
      }
    }
  }

  .settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 320px;
  height: 100vh;
  background: var(--bs-light, #fff);
  box-shadow: -2px 0 8px rgba(0,0,0,0.15);
  z-index: 2000;
  padding: 1.5rem 1.25rem 1.25rem 1.25rem;
  transition: transform 0.3s cubic-bezier(.4,0,.2,1);
}
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s cubic-bezier(.4,0,.2,1);
}
.slide-enter, .slide-leave-to {
  transform: translateX(100%);
}

.role-section {
  border-top: 1px solid white;
  padding: 16px 0 0;
  position: relative;

  h6 {
    font-size: 0.75rem;
    right: 12px;
    padding: 0 12px;
    position: absolute;
    top: -2px;
    transform: translateY(-50%);
    white-space: nowrap;
  }
}
</style>

<style scoped>
.settings-panel-inline {
  background: var(--bs-light, #fff);
  border: 1px solid var(--bs-border-color, #dee2e6);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  max-width: 600px;
  margin: 0 auto 1.5rem auto;
  color: var(--bs-body-color, #212529);
}
.settings-panel-inline.dark {
  background: #23272b !important;
  border-color: #343a40 !important;
  color: #f8f9fa !important;
}
.settings-panel-inline.dark .form-check-label,
.settings-panel-inline.dark h5,
.settings-panel-inline.dark .settings-panel-header,
.settings-panel-inline.dark .settings-panel-body {
  color: #f8f9fa !important;
}
.settings-panel-inline.dark .form-check-input:checked {
  background-color: #0d6efd;
  border-color: #0d6efd;
}
.settings-panel-inline.dark .form-range {
  background-color: #343a40;
}
.settings-panel-inline .form-range {
  accent-color: #0d6efd;
}
</style>
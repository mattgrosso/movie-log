<template>
  <div class="home p-3 pt-4 mx-auto">
    <div class="search-bar mx-auto">
      <div class="input-group mb-1 col-12 md-col-6">
        <input
          class="form-control"
          :class="{'has-content': value || searchType || filterValue}"
          ref="searchInput"
          type="text"
          autocapitalize="none"
          autocorrect="off"
          autocomplete="off"
          name="search"
          id="search"
          :placeholder="placeholder"
          style="font-size: 0.75rem;"
          @focus="increaseFontSize"
          @blur="decreaseFontSize"
          v-model="value"
        >
        <span v-if="value || (searchType && filterValue)" class="clear-button" @click.prevent="clearValueSearchTypeAndFilterValue">
          <i class="bi bi-x-circle"/>
        </span>
        <span v-if="searchType && filterValue" class="more-info-button" @click.prevent="goToWikipedia">
          <i class="bi bi-question-circle"/>
        </span>
      </div>
    </div>
    <div v-if="showResultsList" class="results">
      <div v-if="paginatedSortedResults.length" class="results-exist">
        <div class="results-actions col-12 md-col-6 d-flex justify-content-between flex-wrap my-2">
          <div class="btn-group col-12" role="group" aria-label="Button group">
            <button class="results-actions-button btn btn-secondary" @click="toggleSettings">
              <i class="bi bi-gear"/>
            </button>
            <button class="results-actions-button btn btn-warning" @click="shareResults">
              <span v-if="!sharing">
                <i class="bi bi-share"/>
              </span>
              <div v-else class="spinner-border text-light" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </button>
            <button class="results-actions-button btn btn-danger" @click="gridLayout = !gridLayout">
              <i v-if="gridLayout" class="bi bi-view-list"/>
              <i v-else class="bi bi-grid-1x2"/>
            </button>
            <button class="results-actions-button filtered-count-display btn btn-secondary" @click="showAverage = !showAverage">
              <span v-if="showAverage">
                <span class="average-label">(avg)</span>
                <span class="average-value">{{averageRating(filteredResults)}}</span>
              </span>
              <span v-else>{{filteredResults.length}}</span>
            </button>
            <button class="results-actions-button btn btn-info collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#insights-accordion" aria-expanded="false" aria-controls="insights-accordion">
              <i class="bi bi-lightbulb"/>
            </button>
            <button class="results-actions-button btn btn-warning btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#quick-links-accordion" aria-expanded="false" aria-controls="quick-links-accordion">
              <i class="bi bi-lightning-charge"/>
            </button>
            <button class="results-actions-button btn btn-info btn-sm" @click="findRandomSearchTypeAndFilterValue">
              <i class="bi bi-shuffle"/>
            </button>
            <button class="results-actions-button btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
              <i v-if="sortValue === 'rating'" class="bi bi-123"/>
              <i v-if="sortValue === 'watched'" class="bi bi-calendar3"/>
              <i v-if="sortValue === 'release'" class="bi bi-calendar-date"/>
              <i v-if="sortValue === 'title'" class="bi bi-alphabet"></i>
              <span class="order-arrow">
                <i v-if="sortOrder !== 'ascending'" class="bi bi-arrow-down-short"/>
                <i v-if="sortOrder === 'ascending'" class="bi bi-arrow-up-short"/>
              </span>
              <ul class="dropdown-menu">
                <li value="rating">
                  <button class="dropdown-item" :class="{active: sortValue === 'rating'}" @click="setSortValue('rating')">
                    Rating
                  </button>
                </li>
                <li value="watched">
                  <button class="dropdown-item" :class="{active: sortValue === 'watched'}" @click="setSortValue('watched')">
                    Watch Date
                  </button>
                </li>
                <li value="release">
                  <button class="dropdown-item" :class="{active: sortValue === 'release'}" @click="setSortValue('release')">
                    Release Date
                  </button>
                </li>
                <li value="title">
                  <button class="dropdown-item" :class="{active: sortValue === 'title'}" @click="setSortValue('title')">
                    Title
                  </button>
                </li>
              </ul>
            </button>
          </div>
          <div ref="quickLinkTypes" class="quick-link-types d-flex align-items-center flex-wrap">
            <div id="quick-links-accordion" class="col-12 mt-1 accordion-collapse collapse">
              <span
                class="badge mx-1"
                :class="searchType === 'annual' ? 'text-bg-success' : 'text-bg-secondary'"
                @click="toggleAnnualBestFilter"
              >
                Annual Best
              </span>
              <span
                class="badge mx-1"
                :class="searchType === 'genre' ? 'text-bg-success' : 'text-bg-secondary'"
                @click="toggleQuickLinksList('genre')"
              >
                Genres
              </span>
              <span
                class="badge mx-1"
                :class="searchType === 'keyword' ? 'text-bg-success' : 'text-bg-secondary'"
                @click="toggleQuickLinksList('keyword')"
              >
                Keywords
              </span>
              <span
                class="badge mx-1"
                :class="searchType === 'year' ? 'text-bg-success' : 'text-bg-secondary'"
                @click="toggleQuickLinksList('year')"
              >
                Years
              </span>
              <span
                class="badge mx-1"
                :class="searchType === 'director' ? 'text-bg-success' : 'text-bg-secondary'"
                @click="toggleQuickLinksList('director')"
              >
                <span v-if="currentLogIsTVLog">Creators</span>
                <span v-else>Directors</span>
              </span>
              <span
                class="badge mx-1"
                :class="searchType === 'cast/crew' ? 'text-bg-success' : 'text-bg-secondary'"
                @click="toggleQuickLinksList('cast/crew')"
              >
                Cast/Crew Members
              </span>
              <span
                class="badge mx-1"
                :class="searchType === 'studios' ? 'text-bg-success' : 'text-bg-secondary'"
                @click="toggleQuickLinksList('studios')"
              >
                Studios
              </span>
            </div>
          </div>
          <div id="quick-links-types-accordion" class="quick-links-list-wrapper col-12 mt-1 accordion-collapse collapse" ref="QuickLinksAccordion">
            <div class="accordion-body col-12">
              <button
                class="quick-links-list-sort"
                :class="darkOrLight"
                @click="toggleQuickLinksSort"
              >
                {{quickLinksSortType}}
              </button>
              <ul class="quick-link-list p-0 col-12">
                <li v-for="(value, index) in sortedDataListForSearchType" :key="index" @click="updateFilterValue(value.name)">
                  <span class="badge mx-1" :class="darkOrLight">
                    {{ value.name }}<span v-if="quickLinksSortType === 'count' && value.count">&nbsp;({{value.count}})</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <div id="insights-accordion" ref="insightsAccordion" class="accordion-collapse collapse col-12" aria-labelledby="insights">
            <div class="accordion-body col-12">
              <div class="details py-3">
                <p v-if="filteredResults.length === allEntriesWithFlatKeywordsAdded.length" class="fs-5 my-2 text-center">
                  You've rated {{allEntriesWithFlatKeywordsAdded.length}} {{movieOrTVShowDisplay}}s.
                </p>
                <p class="m-0 d-flex justify-content-center align-items-center">
                  They have an average rating of {{averageRating(filteredResults)}}
                </p>
              </div>
              <Charts
                :results="filteredResults"
                :sortOrder="sortOrder"
                :allCounts="allCounts"
                @updateSearchValue="updateSearchValue"
              />
            </div>
          </div>
        </div>
        <StickinessModal v-if="allEntriesWithFlatKeywordsAdded.length" :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded" />
        <ul v-if="gridLayout" class="grid-layout pb-3" :class="listCountClasses">
          <DBGridLayoutSearchResult
            v-for="(result, index) in paginatedSortedResults"
            :key="result.movie.id"
            :result="result"
            :index="index"
            :resultsAreFiltered="resultsAreFiltered"
            :sortValue="sortValue"
            @updateSearchValue="updateSearchValue"
          />
        </ul>
        <ul v-else>
          <DBSearchResult
            v-for="(result, index) in paginatedSortedResults"
            :key="result.movie.id"
            :result="result"
            :index="index"
            :resultsAreFiltered="resultsAreFiltered"
            @updateSearchValue="updateSearchValue"
          />
        </ul>
        <button
          v-if="sortedResults.length > numberOfResultsToShow"
          class="btn btn-secondary mb-5 float-end"
          @click="addMoreResults"
        >
          More...
        </button>
        <div v-else-if="value" class="mb-5">
          <div v-if="noResults" ref="noResults">
            <p>No results found in your Movie Log or on TMDB.</p>
            <p>I'm pretty sure that movie doesn't exist.</p>
            <p>Either you're from the future or maybe you just spelled it wrong.</p>
          </div>
          <div v-else class="button-wrapper d-flex justify-content-end">
            <button class="btn btn-primary" @click="searchTMDB" id="new-rating-button">It's another {{movieOrTVShowDisplay}} called {{titleCase(value)}}</button>
          </div>
        </div>
      </div>
      <div v-else class="no-results-but-search-type">
        <p class="text-center">No {{movieOrTVShowDisplay}}s found for your search.</p>
        <button class="btn btn-link col-12" @click="toggleQuickLinksList(null)">Clear quick filters?</button>
      </div>
    </div>
    <div v-else class="new-rating">
      <NewRatingSearch :value="value" @clear-search-value="clearValueSearchTypeAndFilterValue"/>
    </div>
    <InsetBrowserModal :show="showInsetBrowserModal" :url="insetBrowserUrl" @close="showInsetBrowserModal = false" />
  </div>
</template>

<script>
import axios from 'axios';
import uniq from 'lodash/uniq';
import minBy from 'lodash/minBy';
import debounce from 'lodash/debounce';
import Charts from "./Charts.vue";
import DBSearchResult from './DBSearchResult.vue';
import DBGridLayoutSearchResult from './DBGridLayoutSearchResult.vue';
import NewRatingSearch from "./NewRatingSearch.vue";
import StickinessModal from "./StickinessModal.vue";
import InsetBrowserModal from './InsetBrowserModal.vue';
import { getRating } from "../assets/javascript/GetRating.js";

export default {
  components: {
    Charts,
    DBSearchResult,
    DBGridLayoutSearchResult,
    NewRatingSearch,
    InsetBrowserModal,
    StickinessModal
  },
  data () {
    return {
      sortOrder: "ascending",
      value: "",
      searchType: "title",
      filterValue: "",
      sortValue: null,
      quickLinksSortType: "a-z",
      numberOfResultsToShow: 54,
      sharing: false,
      noResults: false,
      gridLayout: true,
      hasCalledFindFilter: false,
      showInsetBrowserModal: false,
      insetBrowserUrl: "",
      showAverage: false
    }
  },
  watch: {
    value: debounce(function (newVal) {
      this.updateFilterValue("");
      this.updateSearchType("title");
    }, 300),
    DBSearchValue (newVal) {
      if (newVal || newVal === "") {
        this.value = newVal;
      }
    },
    DBSortValue (newVal) {
      if (newVal) {
        this.setSortValue(newVal)
      }
    },
    DBSortOrder (newVal) {
      if (newVal) {
        this.sortOrder = newVal;
      }
    },
    paginatedSortedResults () {
      this.checkResultsAndFindFilter();
    },
  },
  mounted () {
    this.value = this.DBSearchValue;

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

    if (this.DBSortOrder) {
      this.sortOrder = this.DBSortOrder;
    } else {
      this.sortOrder = "ascending";
    }
  },
  beforeRouteLeave () {
    this.sortOrder = "ascending";
    this.setSortValue(null);
    this.value = "";
    this.$store.commit("setDBSearchValue", this.value);
    this.$store.commit("setDBSortValue", this.sortValue);
    this.$store.commit("setDBSortOrder", this.sortOrder);
  },
  computed: {
    darkOrLight () {
      const inDarkMode = document.querySelector("body").classList.contains('bg-dark');

      return { 'text-bg-dark': inDarkMode, 'text-bg-light': !inDarkMode };
    },
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    movieOrTVShowDisplay () {
      if (this.currentLogIsTVLog) {
        return "TV show";
      } else {
        return "movie";
      }
    },
    movieOrTV () {
      if (this.currentLogIsTVLog) {
        return "tv";
      } else {
        return "movie";
      }
    },
    DBSearchValue () {
      return this.$store.state.DBSearchValue;
    },
    DBSortValue () {
      return this.$store.state.DBSortValue;
    },
    DBSortOrder () {
      return this.$store.state.DBSortOrder;
    },
    sortValueDisplay () {
      if (this.sortValue === "rating") {
        return "Rank";
      } else if (this.sortValue === "watched") {
        return "Watched";
      } else if (this.sortValue === "release") {
        return "Release";
      } else if (this.sortValue === "title") {
        return "Title";
      } else {
        return "Sort By";
      }
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
          return {
            ...result,
            movie: {
              ...this.topStructure(result),
              flatKeywords: this.topStructure(result).keywords ? this.topStructure(result).keywords.map((keyword) => keyword.name) : []
            }
          }
        }
      });
    },
    filteredResults () {
      let searchTypeFiltered;

      if (this.searchType === "annual") {
        this.$store.commit("setDBSortValue", "release");
        searchTypeFiltered = this.bestMovieFromEachYear;
      } else if (!this.filterValue) {
        this.$store.commit("setDBSortValue", this.DBSortValue || "rating");
        searchTypeFiltered = this.allEntriesWithFlatKeywordsAdded;
      } else if (this.searchType === "keyword") {
        this.$store.commit("setDBSortValue", this.DBSortValue || "rating");
        searchTypeFiltered = this.keywordFilter;
      } else if (this.searchType === "genre") {
        this.$store.commit("setDBSortValue", this.DBSortValue || "rating");
        searchTypeFiltered = this.genreFilter;
      } else if (this.searchType === "year") {
        this.$store.commit("setDBSortValue", this.DBSortValue || "release");
        searchTypeFiltered = this.yearFilter;
      } else if (this.searchType === "director") {
        this.$store.commit("setDBSortValue", this.DBSortValue || "rating");
        searchTypeFiltered = this.directorFilter;
      } else if (this.searchType === "cast/crew") {
        this.$store.commit("setDBSortValue", this.DBSortValue || "rating");
        searchTypeFiltered = this.castCrewFilter;
      } else if (this.searchType === "studios") {
        this.$store.commit("setDBSortValue", this.DBSortValue || "rating");
        searchTypeFiltered = this.studioFilter;
      } else if (this.searchType === "mediums") {
        this.$store.commit("setDBSortValue", this.DBSortValue || "rating");
        searchTypeFiltered = this.mediumFilter;
      } else {
        searchTypeFiltered = [];
      }

      if (!this.value) {
        return searchTypeFiltered;
      } else {
        return this.inputValueFilter(searchTypeFiltered);
      }
    },
    keywordFilter () {
      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        return this.topStructure(media).flatKeywords?.includes(this.filterValue.toLowerCase());
      })
    },
    genreFilter () {
      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        return this.topStructure(media).genres?.find((genre) => genre.name.toLowerCase() === this.filterValue.toLowerCase());
      })
    },
    yearFilter () {
      let parsedYears = [];

      if (this.filterValue.length === 2 && parseInt(this.filterValue) < new Date().getFullYear() - 2000) {
        parsedYears = [`20${this.filterValue}`];
      } else if (this.filterValue.length === 2) {
        parsedYears = [`19${this.filterValue}`];
      } else if (this.filterValue.includes("-") && this.filterValue.includes(" ")) {
        parsedYears = this.filterValue.split(" ").join("").split("-");

        for (let i = parseInt(parsedYears[0]) + 1; i < parseInt(parsedYears[1]); i++) {
          parsedYears.push(i.toString());
        }
      } else if (this.filterValue.includes("-")) {
        parsedYears = this.filterValue.split("-");

        for (let i = parseInt(parsedYears[0]) + 1; i < parseInt(parsedYears[1]); i++) {
          parsedYears.push(i.toString());
        }
      } else if (this.filterValue.length === 5 && this.filterValue.includes("s")) {
        parsedYears = this.filterValue.split("s").filter((x) => x);

        parsedYears.push(`${parseInt(parsedYears[0]) + 1}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 2}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 3}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 4}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 5}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 6}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 7}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 8}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 9}`);
      } else if (this.filterValue.length === 3 && this.filterValue.includes("s")) {
        parsedYears = this.filterValue.split("s").filter((x) => x);

        if (parseInt(this.filterValue) < new Date().getFullYear() - 2000) {
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
      } else {
        parsedYears = [this.filterValue];
      }

      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        return parsedYears.includes(`${this.getYear(media)}`);
      })
    },
    directorFilter () {
      if (this.currentLogIsTVLog) {
        return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
          return media.tvShow.created_by?.map((person) => person.name.toLowerCase()).join(" ").includes(this.filterValue.toLowerCase());
        })
      } else {
        return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
          return media.movie.crew?.find((person) => person.job === "Director").name.toLowerCase() === this.filterValue.toLowerCase();
        })
      }
    },
    castCrewFilter () {
      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        const cast = this.topStructure(media).cast?.map((person, index) => person.name.toLowerCase()) || [];
        const crew = this.topStructure(media).crew?.map((person, index) => person.name.toLowerCase()) || [];
        const castCrewCombined = [...cast, ...crew];

        return castCrewCombined.includes(this.filterValue.toLowerCase());
      })
    },
    studioFilter () {
      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        return this.topStructure(media).production_companies?.map((company) => company.name.toLowerCase()).includes(this.filterValue.toLowerCase());
      })
    },
    mediumFilter () {
      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        return media.ratings.some((rating) => {
          if (!rating.medium) {
            return false;
          } else {
            return rating.medium.toLowerCase().includes(this.filterValue.toLowerCase())
          }
        });
      });
    },
    bestMovieFromEachYear () {
      const years = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        let year;

        if (this.currentLogIsTVLog) {
          year = new Date(result.tvShow.first_air_date).getFullYear();
        } else {
          year = new Date(result.movie.release_date).getFullYear();
        }

        if (!years[year]) {
          years[year] = result;
        } else if (this.mostRecentRating(result).calculatedTotal > this.mostRecentRating(years[year]).calculatedTotal) {
          years[year] = result;
        }
      })

      return Object.keys(years).map((year) => years[year]);
    },
    showResultsList () {
      return Boolean(this.paginatedSortedResults.length) || this.searchType !== "title";
    },
    sortedResults () {
      return [...this.filteredResults].sort(this.sortResults);
    },
    sortedByRating () {
      const allMediaSortedByRating = this.$store.getters.allMediaSortedByRating;

      if (this.sortOrder === 'ascending') {
        return allMediaSortedByRating;
      } else {
        return allMediaSortedByRating.slice().reverse();
      }
    },
    paginatedSortedResults () {
      return this.sortedResults.slice(0, this.numberOfResultsToShow);
    },
    datalistForSearchType () {
      if (this.searchType === "keyword") {
        return this.allKeywords;
      } else if (this.searchType === "genre") {
        return this.allGenres;
      } else if (this.searchType === "year") {
        return this.allYears;
      } else if (this.searchType === "director") {
        return this.allDirectors;
      } else if (this.searchType === "cast/crew") {
        return this.allCastCrew;
      } else if (this.searchType === "studios") {
        return this.allStudios;
      } else if (this.searchType === "mediums") {
        return this.allMediums;
      } else {
        return [];
      }
    },
    sortedDataListForSearchType () {
      const data = [...this.datalistForSearchType];

      if (this.quickLinksSortType === "a-z") {
        return data.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        return data.sort((a, b) => b.count - a.count);
      }
    },
    allTitles () {
      if (this.currentLogIsTVLog) {
        return this.sortedResults.map((result) => result.tvShow.name);
      } else {
        return this.sortedResults.map((result) => result.movie.title);
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
        })
      })

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
      return Boolean(this.value || this.filterValue);
    },
    placeholder () {
      if (this.searchType && this.filterValue) {
        return `Search within ${this.searchType}: ${this.filterValue}...`
      } else if (this.searchType === 'annual') {
        return "Search within the best of each year..."
      } else if (this.searchType !== 'title') {
        return `Search within ${this.searchType}...`
      } else {
        return "Search..."
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
    }
  },
  methods: {
    checkResultsAndFindFilter () {
      if (!this.$route.query.noRandom && this.paginatedSortedResults.length > 0 && !this.hasCalledFindFilter) {
        this.findRandomSearchTypeAndFilterValue();
        this.hasCalledFindFilter = true;
      }
    },
    findRandomSearchTypeAndFilterValue () {
      this.$router.push({ query: { ...this.$route.query, returnFromRating: undefined } });
      const searchTypes = ["keyword", "genre", "year", "director", "cast/crew", "studios", "mediums"];
      const randomSearchType = searchTypes[Math.floor(Math.random() * searchTypes.length)];
      this.updateSearchType(randomSearchType);

      const minimumCount = 3;

      let counts;
      switch (randomSearchType) {
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
        case "mediums":
          counts = this.countMediums;
          break;
      }

      const filterValues = Object.keys(counts);
      let randomFilterValue;
      let safetyLimit = 100;

      do {
        const randomIndex = Math.floor(Math.random() * filterValues.length);
        randomFilterValue = filterValues[randomIndex];
        safetyLimit--;
      } while (counts[randomFilterValue] <= minimumCount && safetyLimit > 0);

      if (randomFilterValue && safetyLimit > 0) {
        this.updateFilterValue(randomFilterValue);
      } else {
        this.clearValueSearchTypeAndFilterValue();
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
      let curatedSearchType;

      if (this.searchType === "keyword") {
        curatedSearchType = "";
      } else if (this.searchType === "genre") {
        curatedSearchType = "film genre";
      } else if (this.searchType === "year") {
        curatedSearchType = "film in";
      } else if (this.searchType === "director") {
        curatedSearchType = "";
      } else if (this.searchType === "cast/crew") {
        curatedSearchType = "";
      } else if (this.searchType === "studios") {
        curatedSearchType = "film studio";
      } else if (this.searchType === "mediums") {
        curatedSearchType = "";
      } else {
        curatedSearchType = "";
      }

      const searchValue = `${curatedSearchType} ${this.filterValue}`;

      this.insetBrowserUrl = await this.wikiLinkFor(searchValue);
      this.showInsetBrowserModal = true;
    },
    async getDirectorsFilmography (director) {
      const filmography = await axios.get(`https://api.themoviedb.org/3/person/${director.id}/movie_credits?api_key=${process.env.VUE_APP_TMDB_API_KEY}`);
      const directingCredits = filmography.data.crew.filter((credit) => credit.job === "Director");

      const minimizedCredits = directingCredits.map((credit) => {
        return {
          id: credit.id,
          popularity: credit.popularity,
          release_date: credit.release_date,
          title: credit.title
        }
      });

      return minimizedCredits;
    },
    clearValueSearchTypeAndFilterValue () {
      this.value = "";
      this.searchType = "title";
      this.filterValue = "";
      this.$refs.searchInput.focus();
    },
    updateFilterValue (filterValue) {
      this.filterValue = filterValue.toString();
    },
    updateSearchType (searchType) {
      this.filterValue = "";
      this.searchType = searchType;
    },
    updateSearchValue (searchObject) {
      this.updateSearchType(searchObject.searchType);
      this.updateFilterValue(searchObject.value);
      this.$refs.insightsAccordion?.classList.remove("show");
    },
    toggleSettings () {
      this.$router.push("/settings");
    },
    toggleQuickLinksSort () {
      if (this.quickLinksSortType === "a-z") {
        this.quickLinksSortType = "count";
      } else {
        this.quickLinksSortType = "a-z";
      }
    },
    toggleQuickLinksList (name) {
      if (this.searchType === name || !name) {
        this.updateSearchType('title');

        this.$refs.QuickLinksAccordion?.classList.remove("show");
      } else {
        this.updateSearchType(name);

        this.$refs.QuickLinksAccordion?.classList.add("show");
      }
    },
    toggleAnnualBestFilter () {
      if (this.searchType === "annual") {
        this.updateSearchType('title');
      } else {
        this.updateSearchType('annual');
      }
    },
    inputValueFilter (results) {
      return results.filter((media) => {
        if (this.currentLogIsTVLog) {
          return this.topStructure(media).name.toLowerCase().includes(this.value.toLowerCase());
        } else {
          return this.topStructure(media).title.toLowerCase().includes(this.value.toLowerCase());
        }
      })
    },
    toggleSortOrder () {
      if (this.sortOrder === "ascending") {
        this.sortOrder = "descending";
      } else {
        this.sortOrder = "ascending";
      }
    },
    setSortValue (value) {
      if (this.sortValue === value) {
        this.toggleSortOrder();
      } else {
        this.sortValue = value;
      }
    },
    sortResults (a, b) {
      let sortValueA;
      let sortValueB;

      if (!this.sortValue || this.sortValue === "rating") {
        sortValueA = this.mostRecentRating(a).calculatedTotal;
        sortValueB = this.mostRecentRating(b).calculatedTotal;
      } else if (this.sortValue === "release") {
        if (this.currentLogIsTVLog) {
          sortValueA = new Date(a.tvShow.first_air_date);
          sortValueB = new Date(b.tvShow.first_air_date);
        } else {
          sortValueA = new Date(a.movie.release_date);
          sortValueB = new Date(b.movie.release_date);
        }
      } else if (this.sortValue === "title") {
        if (this.currentLogIsTVLog) {
          sortValueA = a.tvShow.name;
          sortValueB = b.tvShow.name;
        } else {
          sortValueA = a.movie.title;
          sortValueB = b.movie.title;
        }
      } else if (this.sortValue === "watched") {
        const dateA = this.mostRecentRating(a).date || "3/22/1982";
        const dateB = this.mostRecentRating(b).date || "3/22/1982";

        sortValueA = new Date(dateA);
        sortValueB = new Date(dateB);
      } else {
        sortValueA = 0;
        sortValueB = 0;
      }

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
    averageRating (results) {
      const ratedMovies = results.filter((result) => this.mostRecentRating(result).calculatedTotal);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
      const total = ratings.reduce((a, b) => a + b, 0);
      return (total / ratings.length).toFixed(2);
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
        return getRating(media);
      }
    },
    async searchTMDB () {
      if (!this.value) {
        return;
      }

      const resp = await axios.get(`https://api.themoviedb.org/3/search/${this.movieOrTV}?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US&query=${this.value}`);

      if (resp.data.results.length) {
        this.newEntrySearch(resp.data.results);
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
        this.clearValueSearchTypeAndFilterValue();
      }, 3000);
    },
    addMoreResults () {
      this.numberOfResultsToShow = this.numberOfResultsToShow + 50;

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
      if (this.currentLogIsTVLog) {
        return result.tvShow;
      } else {
        return result.movie;
      }
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
    increaseFontSize (event) {
      event.target.style.fontSize = '16px';
    },
    decreaseFontSize (event) {
      event.target.style.fontSize = '0.75rem';
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
      }

      .clear-button {
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

      .more-info-button {
        align-items: center;
        color: black;
        cursor: pointer;
        display: flex;
        height: 40px;
        justify-content: center;
        right: 0px;
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
              background-color: #2EC4B6; /* Green */
              color: black;
            }

            &:nth-child(5) {
              background-color: #00FFFF; /* Cyan */
              color: black;
            }

            &:nth-child(6) {
              background-color: #1D8BF1; /* Medium Blue */
              color: white;
            }

            &:nth-child(7) {
              background-color: #5A189A; /* Indigo */
              color: white;
            }

            &:nth-child(8) {
              background-color: #9D4EDD; /* Violet */
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

            li {
              &:first-child {
                grid-column: span 4;
                grid-row: span 2;
              }

              &:nth-child(n+1) {
                grid-column-end: span 2;
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
                grid-column-end: span 3;
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
                grid-row: span 2;
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
            }
          }
        }
      }
    }

    .btn {
      .spinner-border {
        height: 18px;
        width: 18px;
      }
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
</style>
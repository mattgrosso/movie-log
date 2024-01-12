<template>
  <div class="db-search-results p-3 pt-5 mx-auto">
    <div class="search-bar mx-auto">
      <div class="input-group mb-1 col-12 md-col-6">
        <input class="form-control" type="text" list="datalistOptions" autocapitalize="none" name="search" id="search" :placeholder="`${searchType} search...`" v-model="value">
        <datalist id="datalistOptions">
          <option v-for="(value, index) in datalistForSearchType" :key="index" :value="value"/>
        </datalist>
        <span v-if="value" class="clear-button" @click.prevent="value = null">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle" viewBox="0 0 16 16">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
          </svg>
        </span>
      </div>
      <div class="search-types d-flex flex-nowrap mb-3 col-12 md-col-6">
        <div class="types d-flex align-items-center flex-wrap p-1">
          <span
            class="badge mx-1"
            :class="searchType === 'title' ? 'text-bg-success' : 'text-bg-secondary'"
            @click="searchType = 'title'"
          >
            Title
          </span>
          <span
            class="badge mx-1"
            :class="searchType === 'keyword' ? 'text-bg-success' : 'text-bg-secondary'"
            @click="searchType = 'keyword'"
          >
            Keyword
          </span>
          <span
            class="badge mx-1"
            :class="searchType === 'genre' ? 'text-bg-success' : 'text-bg-secondary'"
            @click="searchType = 'genre'"
          >
            Genre
          </span>
          <span
            class="badge mx-1"
            :class="searchType === 'year' ? 'text-bg-success' : 'text-bg-secondary'"
            @click="searchType = 'year'"
          >
            Year
          </span>
          <span
            class="badge mx-1"
            :class="searchType === 'director' ? 'text-bg-success' : 'text-bg-secondary'"
            @click="searchType = 'director'"
          >
            Director
          </span>
          <span
            class="badge mx-1"
            :class="searchType === 'cast/crew' ? 'text-bg-success' : 'text-bg-secondary'"
            @click="searchType = 'cast/crew'"
          >
            Cast/Crew
          </span>
        </div>
      </div>
      <div class="input-group mb-3 col-12 md-col-6">
        <select class="form-select" name="sortValue" id="sortValue" v-model="sortValue">
          <option value="rating" selected>Rating</option>
          <option value="watched">Watch Date</option>
          <option value="release">Release Date</option>
          <option value="title">Title</option>
        </select>
        <label class="input-group-text" @click="toggleSortOrder">
          <div v-if="sortOrder !== 'ascending'" class="descending">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down-alt" viewBox="0 0 16 16">
              <path d="M3.5 3.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 12.293V3.5zm4 .5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z"/>
            </svg>
          </div>
          <div v-if="sortOrder === 'ascending'" class="ascending">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up-alt" viewBox="0 0 16 16">
              <path d="M3.5 13.5a.5.5 0 0 1-1 0V4.707L1.354 5.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 4.707V13.5zm4-9.5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z"/>
            </svg>
          </div>
        </label>
      </div>
    </div>
    <hr class="mt-4">
    <div v-show="paginatedSortedResults.length" class="details">
      <p v-if="filteredResults.length === allEntriesWithFlatKeywordsAdded.length" class="fs-5 my-2 text-center">
        You've rated {{allEntriesWithFlatKeywordsAdded.length}} {{movieOrTVShow}}s.
      </p>
      <p v-else class="fs-5 my-2 text-center">
        {{filteredResults.length}} out of {{allEntriesWithFlatKeywordsAdded.length}} {{movieOrTVShow}}s match your search.
      </p>
      <p class="m-0 d-flex justify-content-center align-items-center">
        They have an average rating of {{averageRating(filteredResults)}}
      </p>
      <div v-if="!currentLogIsTVLog" class="charts-and-share col-12 my-3 d-flex justify-content-around align-items-center">
        <button class="btn btn-info col-5 collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#charts-accordion" aria-expanded="false" aria-controls="charts-accordion">
          Charts
        </button>
        <button class="btn btn-secondary col-5" @click="shareResults">
          <span v-if="!sharing">
            Share Results
          </span>
          <div v-else class="spinner-border text-light" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </button>
      </div>
    </div>
    <div v-if="!currentLogIsTVLog" id="charts-accordion" ref="chartsAccordion" class="accordion-collapse collapse" aria-labelledby="charts">
      <div class="accordion-body">
        <Charts
          :results="filteredResults"
          :sortOrder="sortOrder"
          :countedKeywords="countedKeywords"
          @updateSearchValue="updateSearchValue"
        />
      </div>
    </div>
    <hr :class="{'mt-3': currentLogIsTVLog}">
    <ul class="col-12 py-3 px-0 m-0 d-flex flex-wrap">
      <DBSearchResult
        v-for="(result, index) in paginatedSortedResults"
        :key="index"
        :result="result"
        :index="index"
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
  </div>
</template>

<script>
import Charts from "./Charts.vue";
import DBSearchResult from './DBSearchResult.vue';

export default {
  components: {
    Charts,
    DBSearchResult
  },
  data () {
    return {
      popperInstance: null,
      sortOrder: "ascending",
      sortValue: null,
      value: "",
      numberOfResultsToShow: 50,
      sharing: false,
      searchType: "title"
    }
  },
  watch: {
    DBSearchValue (newVal) {
      if (newVal || newVal === "") {
        this.value = newVal;
      }
    },
    DBSortValue (newVal) {
      if (newVal) {
        this.sortValue = newVal;
      }
    },
    DBSortOrder (newVal) {
      if (newVal) {
        this.sortOrder = newVal;
      }
    },
    value (newVal) {
      this.updateUrl();
    }
  },
  mounted () {
    this.value = this.DBSearchValue;
    if (this.$route.query.search) {
      this.value = decodeURIComponent(this.$route.query.search);
    }

    if (this.DBSortValue) {
      this.sortValue = this.DBSortValue;
    } else {
      this.sortValue = "rating";
    }

    if (this.DBSortOrder) {
      this.sortOrder = this.DBSortOrder;
    } else {
      this.sortOrder = "ascending";
    }
  },
  beforeRouteLeave () {
    this.sortOrder = "ascending";
    this.sortValue = null;
    this.value = "";
    this.$store.commit("setDBSearchValue", this.value);
    this.$store.commit("setDBSortValue", this.sortValue);
    this.$store.commit("setDBSortOrder", this.sortOrder);
  },
  computed: {
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    movieOrTVShow () {
      if (this.currentLogIsTVLog) {
        return "TV show";
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
    allEntriesWithFlatKeywordsAdded () {
      return this.$store.getters.allMediaAsArray.map((result) => {
        return {
          ...result,
          movie: {
            ...result.movie,
            flatKeywords: result.movie.keywords ? result.movie.keywords.map((keyword) => keyword.name) : []
          }
        }
      });
    },
    filteredResults () {
      if (this.currentLogIsTVLog || !this.value) {
        return this.allEntriesWithFlatKeywordsAdded;
      } else if (this.searchType === "title") {
        return this.titleFilter;
      } else if (this.searchType === "keyword") {
        return this.keywordFilter;
      } else if (this.searchType === "genre") {
        return this.genreFilter;
      } else if (this.searchType === "year") {
        return this.yearFilter;
      } else if (this.searchType === "director") {
        return this.directorFilter;
      } else if (this.searchType === "cast/crew") {
        return this.castCrewFilter;
      } else {
        return [];
      }
    },
    titleFilter () {
      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        return media.movie.title.toLowerCase().includes(this.value.toLowerCase());
      })
    },
    keywordFilter () {
      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        return media.movie.flatKeywords?.includes(this.value.toLowerCase());
      })
    },
    genreFilter () {
      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        return media.movie.genres?.find((genre) => genre.name.toLowerCase() === this.value.toLowerCase());
      })
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
      } else {
        parsedYears = [this.value];
      }

      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        return parsedYears.includes(`${this.getYear(media)}`);
      })
    },
    directorFilter () {
      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        return media.movie.crew?.find((person) => person.job === "Director").name.toLowerCase() === this.value.toLowerCase();
      })
    },
    castCrewFilter () {
      return this.allEntriesWithFlatKeywordsAdded.filter((media) => {
        const cast = media.movie.cast?.map((person, index) => person.name.toLowerCase()) || [];
        const crew = media.movie.crew?.map((person, index) => person.name.toLowerCase()) || [];
        const castCrewCombined = [...cast, ...crew];

        return castCrewCombined.includes(this.value.toLowerCase());
      })
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
      if (this.searchType === "title") {
        return this.allTitles;
      } else if (this.searchType === "keyword") {
        return this.allKeywords;
      } else if (this.searchType === "genre") {
        return this.allGenres;
      } else if (this.searchType === "year") {
        return this.allYears;
      } else if (this.searchType === "director") {
        return this.allDirectors;
      } else if (this.searchType === "cast/crew") {
        return this.allCastCrew;
      } else {
        return [];
      }
    },
    allTitles () {
      return this.sortedResults.map((result) => result.movie.title);
    },
    allKeywords () {
      return Object.keys(this.countedKeywords).map((keyword) => this.titleCase(keyword));
    },
    allGenres () {
      const genres = [];

      this.sortedResults.forEach((result) => {
        result.movie.genres.forEach((genre) => {
          if (!genres.includes(genre.name)) {
            genres.push(genre.name);
          }
        })
      })

      return genres;
    },
    allYears () {
      const years = [];

      this.sortedResults.forEach((result) => {
        const year = this.getYear(result);
        if (!years.includes(year)) {
          years.push(year);
        }
      })

      return years;
    },
    allDirectors () {
      const directors = [];

      this.sortedResults.forEach((result) => {
        const director = result?.movie?.crew?.find((person) => person.job === "Director").name;
        if (director && !directors.includes(director)) {
          directors.push(director);
        }
      })

      return directors;
    },
    allCastCrew () {
      const castCrew = [];

      this.sortedResults.forEach((result) => {
        const cast = result?.movie?.cast?.map((person, index) => index < 10 && person.name) || [];
        const crew = result?.movie?.crew?.map((person, index) => index < 10 && person.name) || [];
        const castCrewCombined = [...cast, ...crew];

        castCrewCombined.forEach((person) => {
          if (!castCrew.includes(person)) {
            castCrew.push(person);
          }
        })
      })

      return castCrew;
    },
    countedKeywords () {
      const counts = {};

      this.sortedResults.forEach((result) => {
        if (result.movie.flatKeywords) {
          result.movie.flatKeywords.forEach((keyword) => {
            if (counts[keyword]) {
              counts[keyword]++;
            } else {
              counts[keyword] = 1;
            }
          })
        }
      })

      return counts;
    }
  },
  methods: {
    updateSearchValue (searchObject) {
      this.searchType = searchObject.searchType;
      this.value = searchObject.value.replace(/'/g, '');
      this.$refs.chartsAccordion.classList.remove("show");
    },
    toggleSortOrder () {
      if (this.sortOrder === "ascending") {
        this.sortOrder = "descending";
      } else {
        this.sortOrder = "ascending";
      }
    },
    sortResults (a, b) {
      let sortValueA;
      let sortValueB;

      if (!this.sortValue || this.sortValue === "rating") {
        sortValueA = this.mostRecentRating(a).rating;
        sortValueB = this.mostRecentRating(b).rating;
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
      const ratedMovies = results.filter((result) => this.mostRecentRating(result).rating);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).rating));
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
        let mostRecentRating = media.ratings[0];

        media.ratings.forEach((rating) => {
          const ratingDate = rating.date ? new Date(rating.date).getTime() : 0;
          const mostRecentRatingDate = mostRecentRating.date ? new Date(mostRecentRating.date).getTime() : 0;

          if (!mostRecentRating.date) {
            mostRecentRating = rating;
          } else if (ratingDate && ratingDate > mostRecentRatingDate) {
            mostRecentRating = rating;
          }
        })

        return mostRecentRating;
      }
    },
    togglePopper () {
      const popper = this.$refs.popper;
      if (popper.hasAttribute('data-show', '')) {
        popper.removeAttribute('data-show', '')
      } else {
        popper.setAttribute('data-show', '');
      }

      this.popperInstance.update();
    },
    onClickAway (event) {
      const popperWrapper = this.$refs.popperWrapper;
      const popper = this.$refs.popper;

      if (popperWrapper.contains(event.target)) {
        return;
      } else if (popper.hasAttribute('data-show', '')) {
        popper.removeAttribute('data-show', '')
        this.popperInstance.update();
      }
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
    updateUrl () {
      if (!this.$store.state.goHome) {
        const queryValue = this.value ? { search: encodeURIComponent(this.value) } : undefined;
        this.$router.replace({ query: queryValue });
      }
    },
    topStructure (result) {
      if (this.currentLogIsTVLog) {
        return result.tvShow;
      } else {
        return result.movie;
      }
    },
    titleCase (string) {
      return string.replace(
        /\w\S*/g,
        function (txt) {
          return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
      );
    }
  },
}
</script>

<style lang="scss">
  .db-search-results {
    max-width: 832px;

    .search-bar {
      max-width: 416px;

      .search-types {
        p {
          white-space: nowrap;
        }

        .types {
          row-gap: 6px;

          span {
            cursor: pointer;
          }
        }
      }

      .clear-button {
        align-items: center;
        cursor: pointer;
        display: flex;
        height: 18px;
        justify-content: center;
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 18px;
        z-index: 5;
      }

      svg {
        height: 18px;
        width: 18px;
      }
    }

    ul {
      list-style: none;
    }

    .btn {
      .spinner-border {
        height: 18px;
        width: 18px;
      }
    }
  }

  .bg-dark {
    .db-search-results {
      color: white;

      ul {
        .media-result {
          border-color: white;
        }
      }
    }
  }
</style>
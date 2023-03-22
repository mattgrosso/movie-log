<template>
  <div class="db-search-results p-3 pt-5 mx-auto">
    <div class="search-bar mx-auto">
      <div class="input-group mb-3 col-12 md-col-6">
        <span ref="target" class="search-help-icon input-group-text" @click="togglePopper" v-click-away="onClickAway">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-info-circle" viewBox="0 0 16 16">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
          </svg>
        </span>
        <div ref=popperWrapper>
          <div ref="popper" id="search-help-popper" class="popper" role="tooltip">
            <div class="year help mb-1">
              <p class="title m-0 text-decoration-underline">Search by year</p>
              <p class="example my-0 px-3">year:1990</p>
              <p class="example my-0 px-3">y:2002</p>
              <p class="example my-0 px-3">y:1990-1998</p>
            </div>
            <div class="person help mb-1">
              <p class="title m-0 text-decoration-underline">Search for cast or crew</p>
              <p class="example my-0 px-3">person:"John Williams"</p>
              <p class="example my-0 px-3">p:"Natalie Portman"</p>
            </div>
            <div class="genre help mb-1">
              <p class="title m-0 text-decoration-underline">Search for a genre</p>
              <p class="example my-0 px-3">genre:Comedy</p>
              <p class="example my-0 px-3">g:Drama</p>
            </div>
            <div class="tag help mb-1">
              <p class="title m-0 text-decoration-underline">Search for a tag</p>
              <p class="example my-0 px-3">tag:[your tag]</p>
              <p class="example my-0 px-3">t:[your tag]</p>
            </div>
            <div class="tag help mb-1">
              <p class="title m-0 text-decoration-underline">Best from each year</p>
              <p class="example my-0 px-3">annual</p>
            </div>
            <div id="arrow" data-popper-arrow></div>
          </div>
        </div>
        <input class="form-control" type="text" autocapitalize="none" name="search" id="search" placeholder="search..." v-model="value">
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
      <p v-if="results.length === $store.getters.allMoviesAsArray.length" class="fs-5 my-2 text-center">
        You've rated {{$store.getters.allMoviesAsArray.length}} movies.
      </p>
      <p v-else class="fs-5 my-2 text-center">
        {{results.length}} out of {{$store.getters.allMoviesAsArray.length}} movies match your search.
      </p>
      <p class="m-0 d-flex justify-content-center align-items-center">
        They have an average rating of {{averageRating(results)}}
      </p>
      <div class="charts-and-share col-12 my-3 d-flex justify-content-around align-items-center">
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
    <div id="charts-accordion" class="accordion-collapse collapse" aria-labelledby="charts">
      <div class="accordion-body">
        <Charts :results="results" :sortOrder="sortOrder"/>
      </div>
    </div>
    <hr>
    <ul class="col-12 py-3 px-0 m-0 d-flex flex-wrap">
      <li
        class="movie-result py-3 px-1 my-3 d-flex flex-wrap align-items-center shadow-lg"
        v-for="(result, index) in paginatedSortedResults"
        :key="index"
        @click="showInfo(`Info-${result.movie.id}`)"
      >
        <label class="number col-1 text-center">
          {{index + 1}}
        </label>
        <div class="poster col-2">
          <img
            class="col-12"
            @click.stop="goToWikipedia(result.movie.title)"
            v-lazy="`https://image.tmdb.org/t/p/original${result.movie.poster_path}`"
          >
        </div>
        <div class="details px-4 col-7">
          <p class="title mb-1">
            <span class="fs-4">
              {{result.movie.title}}
            </span>
            <a class="link mx-2" @click.stop="searchFor(`y:${getYear(result.movie.release_date)}`)">({{getYear(result.movie.release_date)}})</a>
          </p>
          <p class="etc m-0 d-flex flex-wrap">
            <span class="col-12">{{prettifyRuntime(result.movie.runtime)}}</span>
            <span class="col-12">{{turnArrayIntoList(result.movie.genres, "name")}}</span>
            <span class="col-12">
              <a class="link" @click.stop="searchFor(`p:\'${getCrewMember(result.movie.crew, 'Director', 'strict')}\'`)">{{getCrewMember(result.movie.crew, 'Director', 'strict')}}</a>
            </span>
          </p>
        </div>
        <div class="rating col-2 d-flex justify-content-center flex-wrap">
          <p class="col-12 m-0 fs-3 text-center">{{parseFloat(mostRecentRating(result).rating).toFixed(2)}}</p>
          <p class="rank col-12 m-0 text-center">({{getOrdinal(getRankById(result.movie.id))}})</p>
        </div>

        <div :id="`Info-${result.movie.id}`" class="full-info ps-3 hidden">
          <hr class="my-4">
          <h3 class="mt-3 mb-2 fs-5">Full Rating</h3>
          <p class="rating-categories m-3">
            <span>Direction: {{mostRecentRating(result).direction}},&nbsp;</span>
            <span>Imagery: {{mostRecentRating(result).imagery}},&nbsp;</span>
            <span>Story: {{mostRecentRating(result).story}},&nbsp;</span>
            <span>Performance: {{mostRecentRating(result).performance}},&nbsp;</span>
            <span>Soundtrack: {{mostRecentRating(result).soundtrack}},&nbsp;</span>
            <span>Impression: {{mostRecentRating(result).impression}},&nbsp;</span>
            <span>Love: {{mostRecentRating(result).love}},&nbsp;</span>
            <span>Overall: {{mostRecentRating(result).overall}}</span>
          </p>

          <hr>

          <h3 class="mt-3 mb-2 fs-5">Production Companies</h3>
          <p class="m-3">{{turnArrayIntoList(result.movie.production_companies, "name")}}</p>

          <hr>

          <h3 class="mt-3 mb-2 fs-5">Producer(s)</h3>
          <p class="m-3">{{getCrewMember(result.movie.crew, "Producer")}}</p>

          <hr>

          <h3 class="mt-3 mb-2 fs-5">Writer(s)</h3>
          <p class="m-3">{{getCrewMember(result.movie.crew, "Writer")}}</p>

          <hr>

          <h3 class="mt-3 mb-2 fs-5">Actors</h3>
          <div class="actors">
            <p class="m-3">{{turnArrayIntoList(result.movie.cast, "name")}}</p>
          </div>

          <hr>

          <h3 class="mt-3 mb-2 fs-5">Composer(s)</h3>
          <p class="m-3">{{getCrewMember(result.movie.crew, "Composer")}}</p>

          <hr>

          <h3 class="mt-3 mb-2 fs-5">Editor(s)</h3>
          <p class="m-3">{{getCrewMember(result.movie.crew, "Editor", "strict")}}</p>

          <hr>

          <h3 class="mt-3 mb-2 fs-5">Cinematographer(s)</h3>
          <p class="m-3">{{getCrewMember(result.movie.crew, "Photo")}}</p>

          <hr>

          <h3 class="mt-3 mb-2 fs-5">Tags</h3>
          <p class="m-3">{{turnArrayIntoList(mostRecentRating(result).tags, "title")}}</p>

          <hr v-if="turnArrayIntoList(result.awards?.oscarWins).length || turnArrayIntoList(result.awards?.oscarNoms).length">

          <h3 class="mt-3 mb-2 fs-5" v-if="turnArrayIntoList(result.awards?.oscarWins).length || turnArrayIntoList(result.awards?.oscarNoms).length">Academy Awards</h3>
          <div class="awards m-3">
            <p v-if="turnArrayIntoList(result.awards?.oscarWins).length">Won: {{turnArrayIntoList(result.awards?.oscarWins)}}</p>
            <p v-if="turnArrayIntoList(result.awards?.oscarNoms).length">Nominated: {{turnArrayIntoList(result.awards?.oscarNoms)}}</p>
          </div>

          <hr>

          <h3 class="mt-3 mb-2 fs-5">Viewings</h3>
          <p class="m-3" v-for="(rating, index) in result.ratings" :key="index">
            {{rating.medium}}
            <span v-if="rating.medium && rating.date">on</span>
            <span v-else-if="rating.date">On</span>
            {{rating.date}}
          </p>

          <hr>

          <p class="m-3">
            <a :href="`https://www.imdb.com/title/${result.movie.imdb_id}/`" target="_blank">View on IMDb</a>
            <span> | </span>
            <a class="link" @click.prevent="reRateMovie(result.movie)">
              Re-Rate ({{mostRecentRating(result).rating}})
            </a>
          </p>
        </div>
      </li>
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
import axios from 'axios';
import { getDatabase, ref, set } from "firebase/database";
import { createPopper } from '@popperjs/core';
import ordinal from "ordinal-js";
import Fuse from 'fuse.js';
import inRange from 'lodash/inRange';
import minBy from 'lodash/minBy';
import searchQuery from 'search-query-parser';
import Charts from "./Charts.vue";

export default {
  components: {
    Charts
  },
  data () {
    return {
      popperInstance: null,
      sortOrder: "ascending",
      sortValue: null,
      value: "",
      numberOfResultsToShow: 50,
      sharing: false
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

    this.popperInstance = createPopper(this.$refs.target, this.$refs.popper, {
      modifiers: [
        {
          name: 'offset',
          options: {
            offset: [50, 8],
          },
        },
        {
          name: 'preventOverflow',
          options: {
            mainAxis: true,
            padding: 12
          },
        }
      ],
    });
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
    database () {
      return this.$store.state.database;
    },
    allMoviesAsArray () {
      return this.$store.getters.allMoviesAsArray;
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
    sortedResults () {
      const sorted = [...this.results];
      return sorted.sort(this.sortResults);
    },
    sortedByRating () {
      const sorted = [...this.allMoviesAsArray];
      return sorted.sort(this.sortByRating);
    },
    threshold () {
      if (this.value) {
        return 0.6;
      } else {
        return 1;
      }
    },
    results () {
      const options = {
        alwaysArray: true,
        offsets: false,
        keywords: ["p", "person", "g", "genre", "t", "tag", "annual"],
        ranges: ["y", "year"]
      }

      let cleanQuery = this.value ? this.value : "";
      cleanQuery = cleanQuery ? cleanQuery.toLowerCase() : "";
      cleanQuery = cleanQuery.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
      cleanQuery = searchQuery.parse(cleanQuery, options);

      if (!this.value) {
        return this.allMoviesAsArray;
      } else if (cleanQuery.y || cleanQuery.year) {
        const keys = ["y", "year"];
        return this.yearSearch(cleanQuery[keys.find((key) => cleanQuery[key])]);
      } else if (cleanQuery.p || cleanQuery.person) {
        const keys = ["p", "person"];
        return this.personSearch(cleanQuery[keys.find((key) => cleanQuery[key])]);
      } else if (cleanQuery.g || cleanQuery.genre) {
        const keys = ["g", "genre"];
        return this.genreSearch(cleanQuery[keys.find((key) => cleanQuery[key])][0]);
      } else if (cleanQuery.t || cleanQuery.tag) {
        const keys = ["t", "tag"];
        return this.tagSearch(cleanQuery[keys.find((key) => cleanQuery[key])][0]);
      } else if (cleanQuery === "annual") {
        return this.bestMovieFromEachYear();
      } else {
        return this.fuzzySearch();
      }
    },
    paginatedSortedResults () {
      return this.sortedResults.slice(0, this.numberOfResultsToShow);
    }
  },
  methods: {
    searchFor (term) {
      this.value = term;

      window.scroll({
        top: top,
        behavior: 'smooth'
      })
    },
    fuzzySearch () {
      const options = {
        threshold: this.threshold,
        keys: [
          "movie.title",
          "movie.release_date",
          "movie.id",
          "movie.imdb_id",
          "movie.original_title",
          "movie.overview",
          "movie.tagline"
        ]
      };

      const fuse = new Fuse(this.allMoviesAsArray, options);

      const results = fuse.search(`"${this.value}"`);

      return results.map((result) => result.item);
    },
    yearSearch (range) {
      if (range.to) {
        return this.allMoviesAsArray.filter((movie) => {
          return inRange(this.getYear(movie.movie.release_date), range.from, parseInt(range.to) + 1);
        });
      } else {
        return this.allMoviesAsArray.filter((movie) => {
          return inRange(this.getYear(movie.movie.release_date), range.from, parseInt(range.from) + 1);
        });
      }
    },
    personSearch (names) {
      return this.allMoviesAsArray.filter((movie) => {
        // this is a sort of crazy thing to do. It might be kind of slow.
        const everyone = `${JSON.stringify(movie.movie.crew)} ${JSON.stringify(movie.movie.cast)}`;

        return names.every((name) => everyone.toLowerCase().includes(name.toLowerCase()));
      })
    },
    genreSearch (genre) {
      return this.allMoviesAsArray.filter((entry) => {
        const genres = entry.movie.genres.map((genre) => genre.name.toLowerCase());
        return genres.includes(genre);
      })
    },
    tagSearch (tag) {
      return this.allMoviesAsArray.filter((entry) => {
        const tags = entry.ratings.map((rating) => rating.tags).filter((rating) => rating);

        if (tags.length) {
          const tagString = tags[0].map((tag) => tag.title).toString().toLowerCase();
          return tagString.includes(tag);
        } else {
          return false;
        }
      })
    },
    bestMovieFromEachYear () {
      const years = {};

      this.allMoviesAsArray.forEach((result) => {
        const year = new Date(result.movie.release_date).getFullYear();

        if (!years[year]) {
          years[year] = result;
        } else if (this.mostRecentRating(result).rating > this.mostRecentRating(years[year]).rating) {
          years[year] = result;
        }
      })

      return Object.keys(years).map((year) => years[year]);
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
        sortValueA = new Date(b.movie.release_date);
        sortValueB = new Date(a.movie.release_date);
      } else if (this.sortValue === "title") {
        sortValueA = b.movie.title;
        sortValueB = a.movie.title;
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
    averageRating (results) {
      const ratedMovies = results.filter((result) => this.mostRecentRating(result).rating);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).rating));
      const total = ratings.reduce((a, b) => a + b, 0);
      return (total / ratings.length).toFixed(2);
    },
    getRankById (id) {
      return this.sortedByRating.map((movie) => movie.movie.id).indexOf(id) + 1;
    },
    getOrdinal (number) {
      return ordinal.toOrdinal(number);
    },
    setValue (value) {
      this.value = value;
    },
    getYear (date) {
      return new Date(date).getFullYear();
    },
    prettifyRuntime (minutes) {
      return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    },
    turnArrayIntoList (array, key) {
      if (!array) {
        return ""
      }

      let arr = [...array];

      if (arr[0][key] && !key) {
        return "";
      }

      if (key && arr[0][key]) {
        arr = arr.map((el) => el[key]);
      }

      if (arr.length > 1) {
        return arr.join(", ");
      } else {
        return arr[0];
      }
    },
    getCrewMember (crew, title, strict) {
      let matches;
      if (strict) {
        matches = crew.filter((crew) => crew.job === title);
      } else {
        matches = crew.filter((crew) => crew.job.includes(title));
      }

      const names = matches.map((match) => match.name);

      if (!names) {
        return "";
      } else if (names.length > 1) {
        return names.join(", ");
      } else {
        return names[0];
      }
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
    reRateMovie (movie) {
      this.$emit('reRateMovie', movie);
    },
    showInfo (id) {
      const x = document.getElementById(id);

      if (!x) {
        return;
      }

      if (x.classList.contains("hidden")) {
        x.classList.remove("hidden");
        x.classList.add("shown");
      } else {
        x.classList.add("hidden");
        x.classList.remove("shown");
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
    async goToWikipedia (title) {
      window.open(await this.wikiLinkFor(title));
    },
    async wikiLinkFor (title) {
      const wiki = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrnamespace=0&gsrlimit=5&gsrsearch=%27${title}%27`);
      const pages = wiki.data.query.pages;
      const pagesArray = Object.keys(pages).map((page) => pages[page]);
      const bestMatch = minBy(pagesArray, (page) => page.index);

      return `https://en.wikipedia.org/w/index.php?curid=${bestMatch.pageid}`;
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

      const dbKey = crypto.randomUUID();
      const db = getDatabase();

      await set(ref(db, `${this.$store.state.databaseTopKey}/sharedDBSearches/${dbKey}`), shareObject);

      this.sharing = false;
      this.value = "";
      this.$router.push(`/share/${this.$store.state.databaseTopKey}/${dbKey}`);
    },
    updateUrl () {
      this.$router.push({ query: { search: encodeURIComponent(this.value) } });
    }
  },
}
</script>

<style lang="scss">
  .db-search-results {
    max-width: 832px;

    .search-bar {
      max-width: 416px;

      .search-help-icon {
        cursor: pointer;
      }

      #search-help-popper {
        background: #333;
        border-radius: 4px;
        color: white;
        display: none;
        padding: 1rem;
        z-index: 1;

        &[data-show] {
          display: block;
        }

        &[data-popper-placement^='top'] > #arrow {
          bottom: -4px;
        }

        &[data-popper-placement^='bottom'] > #arrow {
          top: -4px;
        }

        &[data-popper-placement^='left'] > #arrow {
          right: -4px;
        }

        &[data-popper-placement^='right'] > #arrow {
          left: -4px;
        }

        .help {
          .title {
            font-size: 1rem;
          }

          .example {
            font-size: 0.75rem;
          }
        }

        #arrow,
        #arrow::before {
          background: inherit;
          height: 8px;
          position: absolute;
          width: 8px;
        }

        #arrow {
          visibility: hidden;
        }

        #arrow::before {
          content: '';
          transform: rotate(45deg);
          visibility: visible;
        }
      }

      svg {
        height: 18px;
        width: 18px;
      }
    }

    ul {
      list-style: none;

      .movie-result {
        border: 1px solid black;
        cursor: pointer;
        overflow: hidden;

        .details {
          .etc {
            font-size: 0.75rem;

            span {
              margin-right: 0.5rem;
            }
          }
        }

        .rating {
          .rank {
            font-size: 0.65rem;
          }
        }

        .full-info {
          overflow: hidden;

          &.hidden {
            max-height: 0;
            transition: max-height 0.5s ease-in-out;
          }

          &.shown {
            max-height: 6000px;
            transition: max-height 0.5s ease-in-out;
          }

          .rating-categories {
            display: flex;
            flex-wrap: wrap;
            span {
              white-space: nowrap;
            }
          }

          .actors {
            p {
              overflow-y: scroll;
              max-height: 100px;
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
</style>
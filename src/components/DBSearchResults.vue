<template>
  <div class="db-search-results p-3">
    <div class="search-bar">
      <div class="form-group mb-3">
        <!-- todo: add info here about how to use the search bar -->
        <label class="form-label" for="search">Search</label>
        <input class="form-control" type="text" name="search" id="search" placeholder="search..." v-model="value">
      </div>
      <div class="form-group mb-3">
        <label class="form-label" for="sortValue">Sort by</label>
        <select class="form-select" name="sortValue" id="sortValue" v-model="sortValue">
          <option value="rating">Rating</option>
          <option value="best">Best Match</option>
          <option value="date">Date</option>
          <option value="title">Title</option>
        </select>
      </div>
    </div>
    <hr class="mt-4">
    <ul class="col-12 py-3 px-0 d-flex flex-wrap">
      <li 
        class="movie-result py-3 px-1 my-3 d-flex flex-wrap align-items-center shadow-lg"
        v-for="(result, index) in sortedResults"
        :key="index"
        @click="showInfo(`Info-${result.movie.id}`)"
      >
        <label class="number col-1 text-center">
          {{index + 1}}
        </label>
        <div class="poster col-2">
          <img class="col-12" :src="`https://image.tmdb.org/t/p/original${result.movie.poster_path}`">
        </div>
        <div class="details px-4 col-7">
          <p class="title mb-1">
            <span class="fs-4">
              {{result.movie.title}}
            </span>
            <a class="link mx-2" @click.stop="searchFor(`y:${getYear(result.movie.release_date)}`)">({{getYear(result.movie.release_date)}})</a>
          </p>
          <p class="etc m-0 d-flex flex-wrap">
            <span>{{prettifyRuntime(result.movie.runtime)}}</span>
            <span>{{turnArrayIntoList(result.movie.genres, "name")}}</span>
            <span>
              Director:
              <a class="link" @click.stop="searchFor(`p:\'${getCrewMember(result.movie.crew, 'Director', 'strict')}\'`)">{{getCrewMember(result.movie.crew, 'Director', 'strict')}}</a>
            </span>
          </p>
        </div>
        <div class="rating col-2 d-flex justify-content-center">
          <p class="m-0 fs-3">{{mostRecentRating(result).rating.toFixed(2)}}</p>
        </div>

        <div :id="`Info-${result.movie.id}`" class="full-info ps-3 hidden">
          <hr class="my-4">
          <h3 class="mt-3 mb-2 fs-5">Full Rating</h3>
          <p class="m-3">
            Direction: {{mostRecentRating(result).direction}} | Imagery:
            {{mostRecentRating(result).imagery}} | Story: {{mostRecentRating(result).story}} | Performance: {{mostRecentRating(result).performance}} |
            Soundtrack: {{mostRecentRating(result).soundtrach}} | Impression: {{mostRecentRating(result).impression}} | Love: {{mostRecentRating(result).love}} |
            Overall: {{mostRecentRating(result).overall}}
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
            <!-- todo: this isn't working -->
            <a class="link" @click.prevent="reRateMovie(result.movie)">
              Re-Rate ({{mostRecentRating(result).rating}})
            </a>
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
import Fuse from 'fuse.js';
import searchQuery from 'search-query-parser';
import inRange from 'lodash/inRange';

export default {
  props: {
    database: {
      type: Object,
      required: true
    },
    initialValue: {
      type: String,
      required: false,
      default: ""
    }
  },
  data() {
    return {
      value: "",
      sortValue: "rating"
    }
  },
  watch: {
    initialValue (newVal) {
      if (newVal) {
        this.value = newVal;
      }
    },
    value (newVal) {
      this.$emit('clearSearch');
    }
  },
  mounted() {
    this.value = this.initialValue;
  },
  computed: {
    allMoviesAsArray () {
      return Object.keys(this.database).map((key) => {
        return this.database[key];
      })
    },
    sortedResults () {
      const sorted = [...this.results];
      return sorted.sort(this.sortResults);
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
        keywords: ["p", "person"],
        ranges: ["y", "year"]
      }

      const query = searchQuery.parse(this.value, options);

      if (!this.value) {
        return this.allMoviesAsArray;
      } else if (query.y) {
        return this.yearSearch(query.y);
      } else if (query.year) {
        return this.yearSearch(query.year);
      } else if (query.p) {
        return this.personSearch(query.p);
      } else if (query.person) {
        return this.personSearch(query.person);
      } else {
        return this.fuzzySearch();
      }
    }
  },
  methods: {
    searchFor (term) {
      this.$emit('search', term);
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
    sortResults (a, b) {
      let sortValueA;
      let sortValueB;

      if (!this.value || this.sortValue === "rating") {
        sortValueA = this.mostRecentRating(a).rating;
        sortValueB = this.mostRecentRating(b).rating;
      } else if (this.sortValue === "date") {
        sortValueA = new Date(b.movie.release_date);
        sortValueB = new Date(a.movie.release_date);
      } else if (this.sortValue === "title") {
        sortValueA = b.movie.title;
        sortValueB = a.movie.title;
      } else {
        sortValueA = 0;
        sortValueB = 0;
      }

      if (sortValueA < sortValueB) {
        return 1;
      }
      if (sortValueA > sortValueB) {
        return -1;
      }

      return 0;
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
        if (rating.date && rating.date > mostRecentRating.date) {
          mostRecentRating = rating;
        }
      })

      return mostRecentRating;
    },
    reRateMovie (movie) {
      this.$emit('reRateMovie', movie);
    },
    showInfo(id) {
      var x = document.getElementById(id);

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
    }
  },
}
</script>

<style lang="scss">
  .db-search-results {
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

          .actors {
            p {
              overflow-y: scroll;
              max-height: 100px;
            }
          }
        }
      }
    }

  }
</style>
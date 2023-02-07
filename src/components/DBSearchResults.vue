<template>
  <div class="db-search-results p-3">
    <div class="search-bar">
      <div class="input-group mb-3">
        <span ref="target" class="search-help-icon input-group-text" @click="togglePopper" v-click-away="onClickAway">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-info-circle" viewBox="0 0 16 16">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
          </svg>
        </span>
        <div ref=popperWrapper>
          <div ref="popper" id="search-help-popper" class="popper" role="tooltip">
            <div class="year help mb-1">
              <p class="title m-0">Search by year</p>
              <p class="example my-0 px-3">y:2002</p>
              <p class="example my-0 px-3">y:1990-1998</p>
            </div>
            <div class="person help mb-1">
              <p class="title m-0">Search for cast or crew</p>
              <p class="example my-0 px-3">p:"Natalie Portman"</p>
            </div>
            <div id="arrow" data-popper-arrow></div>
          </div>
        </div>
        <input class="form-control" type="text" name="search" id="search" placeholder="search..." v-model="value">
      </div>
      <div class="input-group mb-3">
        <select class="form-select" name="sortValue" id="sortValue" v-model="sortValue">
          <option value="rating" selected>Rating</option>
          <option value="best">Best Match</option>
          <option value="date">Date</option>
          <option value="title">Title</option>
        </select>
        <label class="input-group-text" @click="sortDescending = !sortDescending">
          <div v-if="sortDescending" class="descending">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down-alt" viewBox="0 0 16 16">
              <path d="M3.5 3.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 12.293V3.5zm4 .5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z"/>
            </svg>
          </div>
          <div v-if="!sortDescending" class="ascending">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up-alt" viewBox="0 0 16 16">
              <path d="M3.5 13.5a.5.5 0 0 1-1 0V4.707L1.354 5.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 4.707V13.5zm4-9.5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z"/>
            </svg>
          </div>
        </label>
      </div>
    </div>
    <hr class="mt-4">
    <p v-if="results.length === allMoviesAsArray.length" class="fs-5 my-2 text-center">
      You've rated {{allMoviesAsArray.length}} movies.
    </p>
    <p v-else class="fs-5 my-2 text-center">
      {{results.length}} out of {{allMoviesAsArray.length}} movies match your search.
    </p>
    <hr>
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
          <p class="m-0 fs-3">{{parseFloat(mostRecentRating(result).rating).toFixed(2)}}</p>
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
import { createPopper } from '@popperjs/core';
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
      sortValue: "rating",
      popperInstance: null,
      sortDescending: true
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

    this.popperInstance = createPopper(this.$refs.target, this.$refs.popper, {
      modifiers: [
        {
          name: 'offset',
          options: {
            offset: [50, 8],
          },
        },
      ],
    });
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
    sortResults (a, b) {
      let sortValueA;
      let sortValueB;

      if (!this.sortValue || this.sortValue === "rating") {
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
        if (this.sortDescending) {
          return 1;
        } else {
          return -1;
        }
      }
      if (sortValueA > sortValueB) {
        if (this.sortDescending) {
          return -1;
        } else {
          return 1;
        }
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
    }
  },
}
</script>

<style lang="scss">
  .db-search-results {
    .search-bar {
      .search-help-icon {
        cursor: pointer;
      }

      #search-help-popper {
        background: #333;
        color: white;
        border-radius: 4px;
        padding: 1rem;
        display: none;
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
            font-size: 1.2rem;
          }

          .example {
            font-size: 0.9rem;
          }
        }

        #arrow,
        #arrow::before {
          position: absolute;
          width: 8px;
          height: 8px;
          background: inherit;
        }

        #arrow {
          visibility: hidden;
        }

        #arrow::before {
          visibility: visible;
          content: '';
          transform: rotate(45deg);
        }
      }

      svg {
        width: 18px;
        height: 18px;
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
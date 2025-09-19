<template>
  <div class="rate-movie">
    <div class="rate-movie-header">
      <div class="home-link" @click="returnHome">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-left-fill" viewBox="0 0 16 16">
          <path d="m3.86 8.753 5.482 4.796c.646.566 1.658.106 1.658-.753V3.204a1 1 0 0 0-1.659-.753l-5.48 4.796a1 1 0 0 0 0 1.506z"/>
        </svg>
        <span>
          Home
        </span>
      </div>
      <img v-if="rateBannerUrl" 
           :src="rateBannerUrl" 
           :alt="`${title} backdrop`"
           class="backdrop-image">
      <h1 class="text-light m-0 px-3 py-2">Rate {{title}}</h1>
    </div>
    <div class="rate-movie-content container-fluid">
      <div class="row p-3">
      <div class="col-12 mb-4">
        <label class="form-label fs-4" for="title">Title</label>
        <input class="form-control" name="title" type="text" id="title" v-model="title">
      </div>

      <div class="col-12 my-3">
        <div class="row g-3">
          <div class="col-3">
            <label class="form-label fs-4" for="year">Year</label>
            <input class="form-control" name="year" id="year" type="text" v-model="year">
          </div>
          <div class="col-4">
            <label class="form-label fs-4" for="medium">Medium</label>
            <select class="form-select" name="medium" id="medium" v-model="medium">
              <option value=""></option>
              <option value="Theater">Theater</option>
              <option value="Physical Media">Physical Media</option>
              <option value="Streaming">Streaming</option>
              <option value="Download">Download</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="col-5">
            <label class="form-label fs-4" for="date">Date</label>
            <input class="form-control" name="date" id="date" type="datetime-local" v-model="date">
          </div>
        </div>
      </div>

      <hr>

      <div class="col-12 my-3">
        <label class="form-label fs-4 mb-0" for="direction">Direction</label>
        <p class="fs-6 fst-italic">Rate the film's directing and editing. Does the film seem to have a consistent and intentional voice?</p>
        <select class="form-select" name="direction" id="direction" v-model="direction">
          <option value=""></option>
          <option value="0">
            0 - Worst in class
          </option>
          <option value="1">
            1 - Among the worst in class
          </option>
          <option value="2">
            2 - Terrible
          </option>
          <option value="3">
            3 - Really Bad
          </option>
          <option value="4">
            4 - Bad
          </option>
          <option value="5">
            5 - Average
          </option>
          <option value="6">
            6 - Good
          </option>
          <option value="7">
            7 - Great
          </option>
          <option value="8">
            8 - Incredible
          </option>
          <option value="9">
            9 - Among the best in class
          </option>
          <option value="10">
            10 - Best in class
          </option>
        </select>
      </div>

      <div class="col-12 my-3">
        <label class="form-label fs-4 mb-0" for="imagery">Imagery</label>
        <p class="fs-6 fst-italic">
          Rate the film's cinematography, visual effects, production design, costume design, and/or animation.
        </p>
        <select class="form-select" name="imagery" id="imagery" v-model="imagery">
          <option value=""></option>
          <option value="0">
            0 - Worst in class
          </option>
          <option value="1">
            1 - Among the worst in class
          </option>
          <option value="2">
            2 - Terrible
          </option>
          <option value="3">
            3 - Really Bad
          </option>
          <option value="4">
            4 - Bad
          </option>
          <option value="5">
            5 - Average
          </option>
          <option value="6">
            6 - Good
          </option>
          <option value="7">
            7 - Great
          </option>
          <option value="8">
            8 - Incredible
          </option>
          <option value="9">
            9 - Among the best in class
          </option>
          <option value="10">
            10 - Best in class
          </option>
        </select>
      </div>

      <div class="col-12 my-3">
        <label class="form-label fs-4 mb-0" for="story">Story</label>
        <p class="fs-6 fst-italic">
          Rate the film's story, screenplay, and writing.
        </p>
        <select class="form-select" name="story" id="story" v-model="story">
          <option value=""></option>
          <option value="0">
            0 - Worst in class
          </option>
          <option value="1">
            1 - Among the worst in class
          </option>
          <option value="2">
            2 - Terrible
          </option>
          <option value="3">
            3 - Really Bad
          </option>
          <option value="4">
            4 - Bad
          </option>
          <option value="5">
            5 - Average
          </option>
          <option value="6">
            6 - Good
          </option>
          <option value="7">
            7 - Great
          </option>
          <option value="8">
            8 - Incredible
          </option>
          <option value="9">
            9 - Among the best in class
          </option>
          <option value="10">
            10 - Best in class
          </option>
        </select>
      </div>

      <div class="col-12 my-3">
        <label class="form-label fs-4 mb-0" for="performance">Performance</label>
        <p class="fs-6 fst-italic">
          Rate the performances in the film. In the case of documentaries, rate the interest of the subject matter.
        </p>
        <select class="form-select" name="performance" id="performance" v-model="performance">
          <option value=""></option>
          <option value="0">
            0 - Worst in class
          </option>
          <option value="1">
            1 - Among the worst in class
          </option>
          <option value="2">
            2 - Terrible
          </option>
          <option value="3">
            3 - Really Bad
          </option>
          <option value="4">
            4 - Bad
          </option>
          <option value="5">
            5 - Average
          </option>
          <option value="6">
            6 - Good
          </option>
          <option value="7">
            7 - Great
          </option>
          <option value="8">
            8 - Incredible
          </option>
          <option value="9">
            9 - Among the best in class
          </option>
          <option value="10">
            10 - Best in class
          </option>
        </select>
      </div>

      <div class="col-12 my-3">
        <label class="form-label fs-4 mb-0" for="soundtrack">Soundtrack</label>
        <p class="fs-6 fst-italic">
          Rate the film's score, songs, and sound design.
        </p>
        <select class="form-select" name="soundtrack" id="soundtrack" v-model="soundtrack">
          <option value=""></option>
          <option value="0">
            0 - Worst in class
          </option>
          <option value="1">
            1 - Among the worst in class
          </option>
          <option value="2">
            2 - Terrible
          </option>
          <option value="3">
            3 - Really Bad
          </option>
          <option value="4">
            4 - Bad
          </option>
          <option value="5">
            5 - Average
          </option>
          <option value="6">
            6 - Good
          </option>
          <option value="7">
            7 - Great
          </option>
          <option value="8">
            8 - Incredible
          </option>
          <option value="9">
            9 - Among the best in class
          </option>
          <option value="10">
            10 - Best in class
          </option>
        </select>
      </div>

      <div class="col-12 my-3">
        <label class="form-label fs-4 mb-0" for="stickiness">Stickiness</label>
        <p class="fs-6 fst-italic">
          How much of a lasting impression do you think the film will have?
        </p>
        <select class="form-select" name="stickiness" id="stickiness" v-model="stickiness">
          <option value=""></option>
          <option value="0">
            0 - If I think of it at all it will be to warn others away
          </option>
          <option value="1">
            1 - I doubt I'll think of it or recommend it to anyone
          </option>
          <option value="2">
            2 - I think I'll mention it fondly to some people
          </option>
          <option value="3">
            3 - I'm going to think about it often and will look for chances to bring it up
          </option>
          <option value="4">
            4 - This is going to stay with me all the time and I will quote it often
          </option>
          <option value="5">
            5 - This movie will change the way I think and has expanded what I think movies can be
          </option>
        </select>
      </div>

      <div class="col-12 my-3">
        <label class="form-label fs-4 mb-0" for="love">Love</label>
        <p class="fs-6 fst-italic">
          The intangible quality of a film that seems to speak to you specifically.
        </p>
        <select class="form-select" name="love" id="love" v-model="love">
          <option value=""></option>
          <option value="0">
            -5 - The worst ever
          </option>
          <option value="1">
            -4 - One of the worst ever
          </option>
          <option value="2">
            -3 - I hated it
          </option>
          <option value="3">
            -2 - I really didn't like it
          </option>
          <option value="4">
            -1 - I didn't like it
          </option>
          <option value="5">
            0 - No love
          </option>
          <option value="6">
            1 - I liked it
          </option>
          <option value="7">
            2 - I really liked it
          </option>
          <option value="8">
            3 - A genre favorite
          </option>
          <option value="9">
            4 - An overall favorite
          </option>
          <option value="10">
            5 - My favorite
          </option>
        </select>
      </div>

      <div class="col-12 my-3">
        <label class="form-label fs-4 mb-0" for="overall">Overall</label>
        <p class="fs-6 fst-italic">
          Gut sense of the film's overall rating.
        </p>
        <select class="form-select" name="overall" id="overall" v-model="overall">
          <option value=""></option>
          <option value="0">
            0 - Worst in class
          </option>
          <option value="1">
            1 - Among the worst in class
          </option>
          <option value="2">
            2 - Terrible
          </option>
          <option value="3">
            3 - Really Bad
          </option>
          <option value="4">
            4 - Bad
          </option>
          <option value="5">
            5 - Average
          </option>
          <option value="6">
            6 - Good
          </option>
          <option value="7">
            7 - Great
          </option>
          <option value="8">
            8 - Incredible
          </option>
          <option value="9">
            9 - Among the best in class
          </option>
          <option value="10">
            10 - Best in class
          </option>
        </select>
      </div>

      <hr>

      <div class="col-12 my-3">
        <p class="rating text-center mb-0" id="rating">
          <span class="fw-bold">Rating: {{rating.calculatedTotal}}</span>
          <i class="bi bi-info-circle ms-2" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseRatingBreakdown" aria-expanded="true" aria-controls="panelsStayOpen-collapseRatingBreakdown"></i>
          <span class="mx-2">|</span>
          <span>#{{indexIfSortedIntoArray(movieAsRatedOnPage, allMoviesRanked) + 1}}/{{numberOfMoviesAfterRating}}</span>
          <span class="mx-2">|</span>
          <span>#{{indexIfSortedIntoArray(movieAsRatedOnPage, moviesRankedFromYear) + 1}} in {{movieYear(movieToRate)}}</span>
        </p>
      </div>

      <div class="rating-breakdown-accordion accordion" id="ratingBreakdownAccordion">
        <div class="accordion-item" >
          <div id="panelsStayOpen-collapseRatingBreakdown" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingRatingBreakdown">
            <div class="accordion-body">
              <table class="table table-striped table-bordered">
                <tbody>
                  <tr v-for="(value, key) in ratingWithoutDate" :key="key">
                    <td>{{ key }}</td>
                    <td>{{ value }}</td>
                    <td>x</td>
                    <td>{{ weights[key] }}</td>
                    <td>=</td>
                    <td>{{ weights[key] * value }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>Total</td>
                    <td></td>
                    <td>{{weightedTotal}}</td>
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>Rating</td>
                    <td></td>
                    <td>{{rating.calculatedTotal}}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="best-since">
        <p v-if="lastHigherRatedMovie">
          <span>This is the best movie you've watched since:</span>
          <span class="best-since-movie">
            <strong>{{ lastHigherRatedMovie.title }}</strong>
            <span v-if="lastHigherRatedMovie.date">&nbsp;({{ relativeTime(lastHigherRatedMovie.date) }})</span>
          </span>
        </p>
        <p v-else>
          This is your highest rated movie!
        </p>
      </div>

      <div v-if="movieToRate" class="col-12">
        <div ref="neighbors" class="neighbors">
          <div class="hide-neighbors" @click="toggleNeighbors">
            <i class="bi bi-arrow-bar-down"/>
            <i class="bi bi-arrow-bar-up"/>
          </div>
          <div v-if="neighborTwoAhead" class="neighbor-two-ahead">
            <img :src="posterUrl(neighborTwoAhead.movie)" :alt="`${neighborTwoAhead.movie.title} poster`">
          </div>
          <div v-if="neighborAhead" class="neighbor-ahead">
            <img :src="posterUrl(neighborAhead.movie)" :alt="`${neighborAhead.movie.title} poster`">
          </div>
          <div v-if="movieToRate" class="current-movie">
            <img :src="posterUrl(movieToRate)" :alt="`${movieToRate.title} poster`">
          </div>
          <div v-if="neighborBehind" class="neighbor-behind">
            <img :src="posterUrl(neighborBehind.movie)" :alt="`${neighborBehind.movie.title} poster`">
          </div>
          <div v-if="neighborTwoBehind" class="neighbor-two-behind">
            <img :src="posterUrl(neighborTwoBehind.movie)" :alt="`${neighborTwoBehind.movie.title} poster`">
          </div>
        </div>
      </div>

      <hr>

      <div class="col-12 my-3 viewing-tags">
        <label class="form-label">Tags for this viewing</label>
        <div class="tag-list d-flex flex-wrap column-gap-2 row-gap-1">
          <div v-for="(tag, index) in viewingTags" :key="index" class="tag-pill-container">
            <span 
              class="badge me-1 mb-1 d-inline-flex align-items-center"
              :class="viewingTagChecked(tag) ? 'text-bg-primary' : 'text-bg-secondary'"
              @click="toggleViewingTag(tag)"
              style="cursor: pointer;">
              {{tag.title}}
              <button 
                class="btn-close btn-close-white ms-1" 
                @click.stop="deleteViewingTag(tag)"
                title="Delete tag"
                style="font-size: 0.5rem; opacity: 0.6;">
              </button>
            </span>
          </div>
        </div>

        <div class="input-group mt-2">
          <input type="text" class="form-control" placeholder="Add new tag" v-model="newViewingTagTitle" @keyup.enter.prevent="addViewingTag">
          <button class="btn btn-outline-primary" type="button" @click.prevent="addViewingTag">
            <i class="bi bi-plus"></i> Add
          </button>
        </div>
      </div>

      <hr>

      <button
        class="submit-button btn btn-primary col-12 mt-5 mb-4"
        @click.prevent="addRating"
        type="submit"
        value="Submit"
        :disabled="loading"
      >
        <span v-if="!loading">Submit</span>
        <span v-if="loading" class="disabled-show spinner-border spinner-border-sm mx-2" role="status" aria-hidden="true"></span>
        <span v-if="loading" class="disabled-show ">Submiting...</span>
      </button>
    </div>

    <div v-if="getAllRatings(previousEntry)" class="previous-ratings my-3 mb-5 px-4 pt-3 pb-5">
      <label class="fs-4">Previous Viewings</label>
      <div class="accordion" id="previous-ratings-accordion">
        <div class="accordion-item" v-for="(rating, index) in getAllRatings(previousEntry)" :key="index">
          <h2 class="accordion-header" :id="`heading-${index}`">
            <button class="accordion-button px-5" type="button" data-bs-toggle="collapse" :data-bs-target="`#collapse-${index}`" aria-expanded="false" :aria-controls="`collapse-${index}`">
              <div class="col-12 d-flex">
                <p class="col-7 m-0 text-start border-end">
                  <span v-if="rating.date">{{ new Date(rating.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) }}</span>
                  <span v-else>-</span>
                </p>
                <p class="col-5 m-0 text-center border-start">{{rating.calculatedTotal}}</p>
              </div>
            </button>
          </h2>
          <div :id="`collapse-${index}`" class="accordion-collapse collapse" :aria-labelledby="`heading-${index}`">
            <div class="accordion-body">
              <table class="table mb-0 col-12 table-striped-columns">
                <thead>
                  <tr>
                    <th class="col-1"><span>dir</span></th>
                    <th class="col-1"><span>img</span></th>
                    <th class="col-1"><span>stry</span></th>
                    <th class="col-1"><span>perf</span></th>
                    <th class="col-1"><span>sndtk</span></th>
                    <th class="col-1"><span>stick</span></th>
                    <th class="col-1"><span>love</span></th>
                    <th class="col-1"><span>ovral</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="table-secondary">
                    <td class="col-1">{{rating.direction}}</td>
                    <td class="col-1">{{rating.imagery}}</td>
                    <td class="col-1">{{rating.story}}</td>
                    <td class="col-1">{{rating.performance}}</td>
                    <td class="col-1">{{rating.soundtrack}}</td>
                    <td class="col-1">{{rating.stickiness}}</td>
                    <td class="col-1">{{rating.love}}</td>
                    <td class="col-1">{{rating.overall}}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      </div><!-- end row -->
    </div><!-- end container-fluid -->

    <!-- Delete Tag Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content bg-dark text-light">
          <div class="modal-header border-secondary">
            <h5 class="modal-title text-light">Delete Tag</h5>
            <button type="button" class="btn-close btn-close-white" @click="showDeleteModal = false"></button>
          </div>
          <div class="modal-body">
            <p class="text-light">Are you sure you want to delete the tag <strong>"{{ tagToDelete?.title }}"</strong>?</p>
            <p class="text-muted small mb-0">This will remove it from your tag list permanently.</p>
          </div>
          <div class="modal-footer border-secondary">
            <button class="btn btn-secondary" @click="showDeleteModal = false">Cancel</button>
            <button class="btn btn-danger" @click="confirmDeleteTag">Delete Tag</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from "axios";
import addRating from "../assets/javascript/AddRating.js";
import { getRating, getAllRatings } from "../assets/javascript/GetRating.js";
import ErrorLogService from "../services/ErrorLogService.js";

export default {
  data () {
    return {
      direction: null,
      imagery: null,
      story: null,
      performance: null,
      soundtrack: null,
      stickiness: null,
      love: null,
      overall: null,
      date: new Date().toLocaleString('sv-SE', { timeZoneName: 'short' }).slice(0, 16),
      id: null,
      loading: false,
      medium: "",
      newMovieTagTitle: null,
      newViewingTagTitle: null,
      selectedMovieTags: [],
      selectedViewingTags: [],
      title: null,
      year: null,
      getAllRatings: getAllRatings,
      dbEntry: null,
      chatGPTKeywords: [],
      showDeleteModal: false,
      tagToDelete: null,
      tagType: null
    }
  },
  mounted () {
    this.$store.commit("setShowHeader", false);
    this.title = this.movieToRate.title;
    this.year = new Date(this.movieToRate.release_date).getFullYear();
    this.id = this.movieToRate.id;

    this.selectedMovieTags = this.previousEntry ? this.previousEntry.movie.tags || [] : [];
    this.getChatGPTKeywords();
  },
  beforeRouteLeave () {
    this.$store.commit("setShowHeader", true);
  },
  computed: {
    database () {
      return this.$store.state.movieLog;
    },
    movieToRate () {
      return this.$store.state.movieToRate;
    },
    settings () {
      return this.$store.state.settings;
    },
    rating () {
      const ratingOnPage = {
        ratings: [
          {
            direction: this.direction ? parseFloat(this.direction) : 5,
            imagery: this.imagery ? parseFloat(this.imagery) : 5,
            love: this.love ? parseFloat(this.love) : 5,
            overall: this.overall ? parseFloat(this.overall) : 5,
            performance: this.performance ? parseFloat(this.performance) : 5,
            soundtrack: this.soundtrack ? parseFloat(this.soundtrack) : 5,
            stickiness: this.stickiness,
            story: this.story ? parseFloat(this.story) : 5,
            date: this.date
          }
        ]
      }

      return getRating(ratingOnPage);
    },
    ratingWithoutDate () {
      const { date, calculatedTotal, ...ratingWithoutDate } = this.rating;
      return ratingWithoutDate;
    },
    weights () {
      const weights = {};

      this.$store.state.weights.forEach((weight) => {
        weights[weight.name] = weight.weight;
      })

      return weights;
    },
    weightedTotal () {
      let total = 0;

      for (const key in this.ratingWithoutDate) {
        total += this.ratingWithoutDate[key] * this.weights[key];
      }

      return total;
    },
    movieAsRatedOnPage () {
      return {
        movie: this.movieToRate,
        ratings: [this.rating]
      };
    },
    numberOfMoviesAfterRating () {
      if (this.previousEntry) {
        return this.$store.getters.allMoviesAsArray.length;
      } else {
        return this.$store.getters.allMoviesAsArray.length + 1;
      }
    },
    movieIndex () {
      return this.indexIfSortedIntoArray(this.movieAsRatedOnPage, this.allMoviesRanked);
    },
    neighborAhead () {
      const index = this.movieIndex - 1;
      return index >= 0 ? this.allMoviesRanked[index] : undefined;
    },
    neighborTwoAhead () {
      const index = this.movieIndex - 2;
      return index >= 0 ? this.allMoviesRanked[index] : undefined;
    },
    neighborBehind () {
      const index = this.movieIndex;
      return index < this.allMoviesRanked.length ? this.allMoviesRanked[index] : undefined;
    },
    neighborTwoBehind () {
      const index = this.movieIndex + 1;
      return index < this.allMoviesRanked.length ? this.allMoviesRanked[index] : undefined;
    },
    allMoviesRanked () {
      const movies = [...this.$store.getters.allMoviesAsArray];
      return movies.sort(this.sortByRating);
    },
    moviesRankedFromYear () {
      const moviesFromYear = this.$store.getters.allMoviesAsArray.filter((movie) => {
        return this.movieYear(movie.movie) === this.movieYear(this.movieToRate);
      })

      return moviesFromYear.sort(this.sortByRating);
    },
    previousEntry () {
      return this.$store.getters.allMoviesAsArray.find((entry) => {
        return entry.movie.id === this.id;
      })
    },
    viewingTags () {
      if (!this.settings || !this.settings.tags) {
        return [];
      }

      // Convert to array and sort alphabetically by title
      return Object.values(this.settings.tags["viewing-tags"] || {}).sort((a, b) => 
        a.title.localeCompare(b.title)
      );
    },
    movieTags () {
      if (!this.settings || !this.settings.tags) {
        return [];
      }

      // Convert to array and sort alphabetically by title
      return Object.values(this.settings.tags["movie-tags"] || {}).sort((a, b) => 
        a.title.localeCompare(b.title)
      );
    },
    rateBannerUrl () {
      if (this.movieToRate) {
        return `https://image.tmdb.org/t/p/w500${this.movieToRate.backdrop_path}`;
      } else {
        return false;
      }
    },
    databaseTopKey () {
      return this.$store.state.databaseTopKey;
    },
    selectedViewingTagNames () {
      return this.selectedViewingTags.map((tag) => tag.title);
    },
    selectedMovieTagNames () {
      return this.selectedMovieTags.map((tag) => tag.title);
    },
    lastHigherRatedMovie() {
      // Get all movies as array, including the current one as rated on page
      const allMovies = [...this.$store.getters.allMoviesAsArray];
      const current = this.movieAsRatedOnPage;

      // Add current if not already present (by id)
      if (!allMovies.some(entry => entry.movie.id === current.movie.id)) {
        allMovies.push(current);
      }

      // Get current movie's rating
      const currentRating = this.rating.calculatedTotal;
      // Find all movies with higher rating
      const higherRated = allMovies.filter(entry => {
        const entryRating = getRating(entry).calculatedTotal;
        return entryRating > currentRating;
      });
      
      if (!higherRated.length) return null;
      
      // Filter out movies without valid dates, then find the most recent
      const moviesWithDates = higherRated.filter(entry => {
        const rating = this.mostRecentRating(entry);
        return rating && rating.date;
      });
      
      if (!moviesWithDates.length) return null;
      
      // Find the one with the most recent rating date
      let mostRecent = moviesWithDates[0];
      let mostRecentDate = typeof this.mostRecentRating(moviesWithDates[0]).date === 'number' ? this.mostRecentRating(moviesWithDates[0]).date : new Date(this.mostRecentRating(moviesWithDates[0]).date).getTime();
      
      for (let i = 1; i < moviesWithDates.length; i++) {
        const entry = moviesWithDates[i];
        const entryDate = typeof this.mostRecentRating(entry).date === 'number' ? this.mostRecentRating(entry).date : new Date(this.mostRecentRating(entry).date).getTime();
        if (entryDate > mostRecentDate) {
          mostRecent = entry;
          mostRecentDate = entryDate;
        }
      }

      return {
        title: mostRecent.movie.title,
        date: this.mostRecentRating(mostRecent).date,
        movie: mostRecent.movie
      };
    }
  },
  methods: {
    movieYear (movie) {
      return new Date(movie.release_date).getFullYear();
    },
    mostRecentRating (movie) {
      if (!movie?.ratings?.length) {
        return null;
      }

      let mostRecentRating = movie.ratings[0];

      movie.ratings.forEach((rating) => {
        if (!mostRecentRating?.date) {
          mostRecentRating = rating;
        } else if (rating.date && (typeof rating.date === 'number' ? rating.date : new Date(rating.date).getTime()) > (typeof mostRecentRating.date === 'number' ? mostRecentRating.date : new Date(mostRecentRating.date).getTime())) {
          mostRecentRating = rating;
        }
      });

      return mostRecentRating;
    },
    sortByRating (a, b) {
      const aRating = getRating(a).calculatedTotal;
      const bRating = getRating(b).calculatedTotal;

      if (aRating < bRating) {
        return 1;
      }
      if (aRating > bRating) {
        return -1;
      }

      return 0;
    },
    indexIfSortedIntoArray (movie, array) {
      const arr = [...array];
      arr.push(movie);

      arr.sort(this.sortByRating);

      return arr.indexOf(movie);
    },
    async addViewingTag () {
      if (!this.settings.tags || !this.settings.tags["viewing-tags"]) {
        const dbEntry = {
          path: `settings`,
          value: {
            tags: {
              "viewing-tags": { title: "default viewing tag" },
              "movie-tags": { title: "default movie tag" },
            }
          }
        }

        await this.$store.dispatch('setDBValue', dbEntry);
      }
      const viewingTagsArray = Object.keys(this.settings.tags["viewing-tags"]).map((key) => this.settings.tags["viewing-tags"][key]);
      if (!viewingTagsArray.find((tag) => tag.title === this.newViewingTagTitle)) {
        const dbKey = `${new Date().getTime()}-${crypto.randomUUID()}`;

        let dbEntry;
        if (this.settings.tags["viewing-tags"].title === "default viewing tag") {
          dbEntry = {
            path: `settings`,
            value: {
              tags: {
                "viewing-tags": {
                  [dbKey]: { title: this.newViewingTagTitle }
                },
                "movie-tags": { title: "default movie tag" }
              }
            }
          }
        } else {
          dbEntry = {
            path: `settings/tags/viewing-tags/${dbKey}`,
            value: { title: this.newViewingTagTitle }
          }
        }

        this.$store.dispatch('setDBValue', dbEntry);
      }

      this.newViewingTagTitle = null;
    },
    async addMovieTag () {
      if (!this.settings.tags || !this.settings.tags["movie-tags"]) {
        return;
      }

      const movieTagsArray = Object.keys(this.settings.tags["movie-tags"]).map((key) => this.settings.tags["movie-tags"][key]);

      if (!movieTagsArray.find((tag) => tag.title === this.newMovieTagTitle)) {
        const dbKey = `${new Date().getTime()}-${crypto.randomUUID()}`;

        const dbEntry = {
          path: `settings/tags/movie-tags/${dbKey}`,
          value: { title: this.newMovieTagTitle }
        }

        this.$store.dispatch('setDBValue', dbEntry);
      }

      this.newMovieTagTitle = null;
    },
    toggleViewingTag (tag) {
      if (this.viewingTagChecked(tag)) {
        this.selectedViewingTags.splice(this.selectedViewingTags.indexOf(tag), 1);
      } else {
        this.selectedViewingTags.push(tag);
      }
    },
    toggleMovieTag (tag) {
      if (this.movieTagChecked(tag)) {
        this.selectedMovieTags.splice(this.selectedMovieTags.indexOf(tag), 1);
      } else {
        this.selectedMovieTags.push(tag);
      }
    },
    posterUrl (movie) {
      return `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
    },
    async addRating () {
      this.loading = true;

      let ratings = [];

      if (this.previousEntry?.ratings) {
        ratings = [...this.previousEntry.ratings];
      }

      const rating = {
        chatGPTKeywords: this.chatGPTKeywords,
        date: this.date ? new Date(this.date).getTime() : new Date().getTime(),
        direction: this.direction ? this.direction : 5,
        id: this.id,
        imagery: this.imagery ? this.imagery : 5,
        love: this.love ? this.love : 5,
        medium: this.medium ? this.medium : "Other",
        overall: this.overall ? this.overall : 5,
        performance: this.performance ? this.performance : 5,
        rating: this.rating,
        soundtrack: this.soundtrack ? this.soundtrack : 5,
        stickiness: this.stickiness,
        story: this.story ? this.story : 5,
        tags: this.selectedViewingTags,
        title: this.title,
        year: this.year
      };

      ratings.push(rating);

      const dbEntry = await addRating(ratings, this.selectedMovieTags);
      this.dbEntry = dbEntry;

      window.scroll({
        top: top,
        behavior: 'smooth'
      })

      this.$store.commit("setShowHeader", true);
      this.returnHome();
    },
    returnHome () {
      this.$store.commit("setShowHeader", true);
      this.$router.push({ path: '/', query: { movieDbKey: this.dbEntry?.path?.split("movieLog/")[1] } });
    },
    viewingTagChecked (tag) {
      if (!this.selectedViewingTagNames) {
        return false;
      }

      return this.selectedViewingTagNames.includes(tag.title);
    },
    deleteViewingTag(tag) {
      this.tagToDelete = tag;
      this.tagType = 'viewing';
      this.showDeleteModal = true;
    },
    movieTagChecked (tag) {
      if (!this.selectedMovieTagNames) {
        return false;
      }

      return this.selectedMovieTagNames.includes(tag.title);
    },
    deleteMovieTag(tag) {
      this.tagToDelete = tag;
      this.tagType = 'movie';
      this.showDeleteModal = true;
    },
    confirmDeleteTag() {
      if (!this.tagToDelete || !this.tagType) return;
      
      const tag = this.tagToDelete;
      const isViewingTag = this.tagType === 'viewing';
      const tagCategory = isViewingTag ? 'viewing-tags' : 'movie-tags';
      
      // Remove from settings
      if (this.settings.tags && this.settings.tags[tagCategory]) {
        const tagKey = Object.keys(this.settings.tags[tagCategory]).find(
          key => this.settings.tags[tagCategory][key].title === tag.title
        );
        if (tagKey) {
          delete this.settings.tags[tagCategory][tagKey];
          this.$store.dispatch('setDBValue', { 
            path: `settings/tags/${tagCategory}`, 
            value: this.settings.tags[tagCategory] 
          });
        }
      }
      
      // Remove from selected tags if it was selected
      if (isViewingTag) {
        if (this.selectedViewingTagNames && this.selectedViewingTagNames.includes(tag.title)) {
          this.selectedViewingTags = this.selectedViewingTags.filter(t => t.title !== tag.title);
        }
      } else {
        if (this.selectedMovieTagNames && this.selectedMovieTagNames.includes(tag.title)) {
          this.selectedMovieTags = this.selectedMovieTags.filter(t => t.title !== tag.title);
        }
      }
      
      // Close modal and reset state
      this.showDeleteModal = false;
      this.tagToDelete = null;
      this.tagType = null;
    },
    toggleMovieTagList () {
      this.$refs.movieTagList.classList.toggle("collapsed");
    },
    async getChatGPTKeywords () {
      try {
        const apiKey = process.env.VUE_APP_chatGPTAPIKey;
        const apiEndpoint = 'https://api.openai.com/v1/chat/completions';
        const title = this.movieToRate.title;
        const date = new Date(this.movieToRate.release_date).getFullYear() || "";
        const prompt = `Please give me a list of keywords for the movie ${title} from ${date} as a JSON array.
        Please try to include keywords for the location or locations where the movie takes place.
        Make sure the array is under the key "keywords".`;

        const response = await axios.post(
          apiEndpoint,
          {
            model: 'gpt-4o',
            messages: [
              {
                role: "user",
                content: prompt
              }
            ],
            response_format: { type: "json_object" }
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });

        const parsedResponse = JSON.parse(response.data.choices[0].message.content);

        this.chatGPTKeywords = parsedResponse.keywords?.map(keyword => keyword.toLowerCase());
      } catch (error) {
        console.error('Failed to fetch ChatGPT keywords:', error);
        ErrorLogService.logError(error, "Failed to fetch ChatGPT keywords");
        this.chatGPTKeywords = [];
      }
    },
    toggleNeighbors () {
      this.$refs.neighbors.classList.toggle("unstuck");
    },
    // Returns a human-friendly relative time string for a given timestamp
    relativeTime(date) {
      if (!date) return '';
      const now = Date.now();
      const then = typeof date === 'string' ? new Date(date).getTime() : date;
      const diff = now - then;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const months = Math.floor(days / 30);
      const years = Math.floor(days / 365);
      if (seconds < 60) return 'just now';
      if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
      if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
      if (days === 1) return 'yesterday';
      if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
      if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
      return `${years} year${years === 1 ? '' : 's'} ago`;
    },
  },
}
</script>

<style lang="scss">
  .rate-movie {
    .rate-movie-header {
      position: relative;
      height: 200px;
      overflow: hidden;

      .home-link {
        align-items: center;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 4px;
        color: white;
        cursor: pointer;
        display: flex;
        font-size: 1rem;
        left: 0;
        margin: 6px;
        padding: 2px 8px;
        position: absolute;
        text-decoration: none;
        top: 0;
      }

      h1 {
        background-color: #000000a3;
        bottom: 0;
        position: absolute;
      }

      .backdrop-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .rate-movie-content {
      margin: 0 auto;
      max-width: 650px;
    }

    .rating {
      i {
        cursor: pointer;
      }
    }

    .best-since {
      padding: 0.5rem;

      span {
        display: block;
      }

      .best-since-movie {
        display: flex;
        justify-content: center;
        align-items: center;
      }
    }

    .neighbors {
      align-items: center;
      background: #212529;
      border-bottom: 1px solid white;
      border-top: 1px solid white;
      display: flex;
      justify-content: space-between;
      margin: 0 -1rem; /* Extend to edges, counteracting parent p-3 padding */
      padding: 6px;
      position: relative;

      &.unstuck {
        bottom: 0;
        position: relative;

        .bi-arrow-bar-down {
          display: none;
        }

        .bi-arrow-bar-up {
          display: block;
        }
      }

      .bi-arrow-bar-up {
        display: none;
      }

      .bi-arrow-bar-down {
        display: block;
      }

      .hide-neighbors {
        cursor: pointer;
        position: absolute;
        right: 10px;
        top: 3px;
      }

      .neighbor-two-ahead {
        width: 18%;
        padding: 0 2px;
      }

      .neighbor-ahead {
        width: 18%;
        padding: 0 2px;
      }

      .current-movie {
        width: 28%;
        padding: 0 2px;
      }

      .neighbor-behind {
        width: 18%;
        padding: 0 2px;
      }

      .neighbor-two-behind {
        width: 18%;
        padding: 0 2px;
      }

      img {
        max-width: 100%;
      }
    }

    .rating-breakdown-accordion {
      .accordion-item {
        border: 0;

        .accordion-collapse.show {
          margin-bottom: 1rem;
        }
      }

      table {
        font-size: 0.75rem;

        td:nth-child(1) {
          text-align: right;
        }

        tfoot {
          td {
            font-weight: bold;
          }
        }
      }
    }

    .movie-tags {
      .movie-tags-toggle {
        align-items: center;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;

        label {
          cursor: pointer;
          line-height: 16px;
          margin: 0;
        }

        svg {
          transform: rotate(90deg);
          transition: all 0.3s ease;
        }
      }

      .movie-tags-content {
        max-height: 500px;
        overflow: hidden;
        transition: all 0.3s ease;
      }

      &.collapsed {
        .movie-tags-toggle {
          svg {
            transform: rotate(0deg);
          }
        }

        .movie-tags-content {
          max-height: 0;
        }
      }
    }

    .submit-button {
      &[disabled] {
        .disabled-show {
          display: inline-block;
        }
      }

      .disabled-show {
        display: none;
      }
    }

    .previous-ratings {
      .accordion-button {
        background-color: white;
        color: black;

        &:focus {
          box-shadow: none;
        }
      }

      table {
        th {
          span {
            display: inline-block;
            font-size: 0.6rem;
            transform: rotate(60deg);
          }
        }

        td {
          font-size: 0.6rem;
        }
      }
    }
  }

  .bg-dark {
    .rate-movie {
      color: white;
    }
  }
</style>
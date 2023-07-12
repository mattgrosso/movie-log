<template>
  <div class="rate-movie mx-auto">
    <div class="rate-movie-header">
      <div class="home-link" @click="returnHome">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-left-fill" viewBox="0 0 16 16">
          <path d="m3.86 8.753 5.482 4.796c.646.566 1.658.106 1.658-.753V3.204a1 1 0 0 0-1.659-.753l-5.48 4.796a1 1 0 0 0 0 1.506z"/>
        </svg>
        <span>
          Home
        </span>
      </div>
      <img v-if="rateBannerUrl" class="col-12" :src="rateBannerUrl">
      <h1 class="text-light col-12 m-0 px-3 py-2">Rate {{title}}</h1>
    </div>
    <div class="p-4">
      <div class="col-12 mb-4">
        <label class="form-label fs-4" for="title">Title</label>
        <input class="form-control" name="title" type="text" id="title" v-model="title">
      </div>

      <div class="year-medium-date col-12 my-4 d-flex justify-content-between">
        <div class="year col-2">
          <label class="form-label fs-4" for="year">Year</label>
          <input class="form-control" name="year" id="year" type="text" v-model="year">
        </div>
        <div class="medium col-3">
          <label class="form-label fs-4" for="medium">Medium</label>
          <select class="form-select" name="medium" id="medium" v-model="medium">
            <option value=""></option>
            <option value="Theater">Theater</option>
            <option value="Bluray">Bluray</option>
            <option value="4K">4K</option>
            <option value="DVD">DVD</option>
            <option value="Netflix">Netflix</option>
            <option value="Netflix">Youtube</option>
            <option value="Vudu">Vudu</option>
            <option value="HBO">HBO</option>
            <option value="Hulu">Hulu</option>
            <option value="Amazon Prime">Amazon Prime</option>
            <option value="Disney+">Disney+</option>
            <option value="Paramount+">Paramount+</option>
            <option value="Kanopy">Kanopy</option>
            <option value="Criterion">Criterion</option>
            <option value="Apple+">Apple+</option>
            <option value="Peacock">Peacock</option>
            <option value="Download">Download</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="date col-5">
          <label class="form-label fs-4" for="date">Date</label>
          <input class="form-control" name="date" id="date" type="date" v-model="date">
        </div>
      </div>

      <div class="col-12 mt-4 mb-3 movie-tags collapsed" ref="movieTagList">
        <div class="movie-tags-toggle d-flex justify-content-between align-items-center" @click="toggleMovieTagList">
          <label class="form-label">Tags for the movie itself
            <span v-if="selectedMovieTagNames.length">({{ selectedMovieTagNames.length }})</span>
          </label>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-right" viewBox="0 0 16 16">
            <path d="M6 12.796V3.204L11.481 8 6 12.796zm.659.753 5.48-4.796a1 1 0 0 0 0-1.506L6.66 2.451C6.011 1.885 5 2.345 5 3.204v9.592a1 1 0 0 0 1.659.753z"/>
          </svg>
        </div>
        <div class="movie-tags-content">
          <div class="tag-list d-flex flex-wrap">
            <div v-for="(tag, index) in movieTags" :key="index" class='form-check mx-2 mb-2'>
              <input class='form-check-input' :checked="movieTagChecked(tag)" type='checkbox' :id="`tag-${index}`" @click="toggleMovieTag(tag)">
              <label class="form-check-label" :for="`tag-${index}`">
                {{tag.title}}
              </label>
            </div>
          </div>

          <div class="input-group">
            <input type="text" class="form-control" placeholder="new tag" v-model="newMovieTagTitle" @keyup.enter.prevent>
            <button class="btn btn-dark" type="button" @click.prevent="addMovieTag">
              add
            </button>
          </div>
        </div>
      </div>

      <hr>

      <div class="col-12 my-5">
        <label class="form-label fs-4 mb-0" for="direction">Direction</label>
        <p class="fs-6 fst-italic">Rate the film's directing and editing.</p>
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

      <div class="col-12 my-5">
        <label class="form-label fs-4 mb-0" for="imagery">Imagery</label>
        <p class="fs-6 fst-italic">
          Rate the film's cinematography, visual effects, production design,costume design, and/or animation.
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

      <div class="col-12 my-5">
        <label class="form-label fs-4 mb-0" for="story">Story</label>
        <p class="fs-6 fst-italic">
          Rate the film's story and screenplay.
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

      <div class="col-12 my-5">
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

      <div class="col-12 my-5">
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

      <div class="col-12 my-5">
        <label class="form-label fs-4 mb-0" for="impression">Impression</label>
        <p class="fs-6 fst-italic">
          Give your sense of the film's longevity or impact.
        </p>
        <select class="form-select" name="impression" id="impression" v-model="impression">
          <option value=""></option>
          <option value="0">
            0 - None
          </option>
          <option value="1">
            1 - Will be remembered
          </option>
          <option value="2">
            2 - Will be referenced
          </option>
          <option value="3">
            3 - Influenced me
          </option>
          <option value="4">
            4 - Important to me
          </option>
          <option value="5">
            5 - Central to my life
          </option>
        </select>
      </div>

      <div class="col-12 my-5">
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

      <div class="col-12 my-5">
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

      <p class="rating col-12 my-3 d-flex justify-content-center align-items-center" id="rating">
        Rating: {{rating}}
        <span class="mx-3 d-flex justify-content-center align-items-center">|</span>
        #{{indexIfSortedIntoArray(movieAsRatedOnPage, allMoviesRanked) + 1}}/{{numberOfMoviesAfterRating}}
        <span class="mx-3 d-flex justify-content-center align-items-center">|</span>
        #{{indexIfSortedIntoArray(movieAsRatedOnPage, moviesRankedFromYear) + 1}} in {{movieYear(this.movieToRate)}}
      </p>

      <hr>

      <div class="col-12 my-5 viewing-tags">
        <label class="form-label">Tags for this viewing</label>
        <div class="tag-list d-flex flex-wrap">
          <div v-for="(tag, index) in viewingTags" :key="index" class='form-check mx-2 mb-2'>
            <input class='form-check-input' type='checkbox' :id="`tag-${index}`" @click="toggleViewingTag(tag)">
            <label class="form-check-label" :for="`tag-${index}`">
              {{tag.title}}
            </label>
          </div>
        </div>

        <div class="input-group">
          <input type="text" class="form-control" placeholder="new tag" v-model="newViewingTagTitle" @keyup.enter.prevent>
          <button class="btn btn-dark" type="button" @click.prevent="addViewingTag">
            add
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

    <hr>

    <div v-if="previousEntry?.ratings" class="previous-ratings my-3 mb-5 px-4 pt-3 pb-5">
      <label class="fs-4">Previous Viewings</label>
      <div class="accordion" id="previous-ratings-accordion">
        <div class="accordion-item" v-for="(rating, index) in previousEntry.ratings" :key="index">
          <h2 class="accordion-header" :id="`heading-${index}`">
            <button class="accordion-button px-5" type="button" data-bs-toggle="collapse" :data-bs-target="`#collapse-${index}`" aria-expanded="false" :aria-controls="`collapse-${index}`">
              <div class="col-12 d-flex">
                <p class="col-7 m-0 text-center border-end">
                  <span v-if="rating.date">{{rating.date}}</span>
                  <span v-else>-</span>
                </p>
                <p class="col-5 m-0 text-center border-start">{{rating.rating}}</p>
              </div>
            </button>
          </h2>
          <div :id="`collapse-${index}`" class="accordion-collapse collapse" :aria-labelledby="`heading-${index}`">
            <div class="accordion-body">
              <table class="table mb-0 col-12 table-striped-columns">
                <thead>
                  <th class="col-1"><span>dir</span></th>
                  <th class="col-1"><span>img</span></th>
                  <th class="col-1"><span>stry</span></th>
                  <th class="col-1"><span>perf</span></th>
                  <th class="col-1"><span>sndtk</span></th>
                  <th class="col-1"><span>imp</span></th>
                  <th class="col-1"><span>love</span></th>
                  <th class="col-1"><span>ovral</span></th>
                </thead>
                <tbody>
                  <tr class="table-secondary">
                    <td class="col-1">{{rating.direction}}</td>
                    <td class="col-1">{{rating.imagery}}</td>
                    <td class="col-1">{{rating.story}}</td>
                    <td class="col-1">{{rating.performance}}</td>
                    <td class="col-1">{{rating.soundtrack}}</td>
                    <td class="col-1">{{rating.impression}}</td>
                    <td class="col-1">{{rating.love}}</td>
                    <td class="col-1">{{rating.overall}}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import addRating from "../assets/javascript/AddRating.js";

export default {
  data () {
    return {
      date: null,
      direction: null,
      id: null,
      imagery: null,
      impression: null,
      loading: false,
      love: null,
      medium: "",
      newViewingTagTitle: null,
      newMovieTagTitle: null,
      overall: null,
      performance: null,
      soundtrack: null,
      story: null,
      selectedViewingTags: [],
      selectedMovieTags: [],
      title: null,
      year: null
    }
  },
  mounted () {
    this.$store.commit("setShowHeader", false);
    this.title = this.movieToRate.title;
    this.year = new Date(this.movieToRate.release_date).getFullYear();
    this.id = this.movieToRate.id;

    this.selectedMovieTags = this.previousEntry ? this.previousEntry.movie.tags || [] : [];
  },
  beforeRouteLeave () {
    this.$store.commit("setShowHeader", true);
  },
  computed: {
    database () {
      return this.$store.state.database;
    },
    movieToRate () {
      return this.$store.state.movieToRate;
    },
    settings () {
      return this.$store.state.settings;
    },
    rating () {
      const direction = this.getRatingFor("direction") >= 0 ? this.getRatingFor("direction") : 5;
      const imagery = this.getRatingFor("imagery") >= 0 ? this.getRatingFor("imagery") : 5;
      const story = this.getRatingFor("story") >= 0 ? this.getRatingFor("story") : 5;
      const performance = this.getRatingFor("performance") >= 0 ? this.getRatingFor("performance") : 5;
      const soundtrack = this.getRatingFor("soundtrack") >= 0 ? this.getRatingFor("soundtrack") : 5;
      const impression = this.getRatingFor("impression") >= 0 ? this.getRatingFor("impression") : 0;
      const love = this.getRatingFor("love") >= 0 ? this.getRatingFor("love") : 5;
      const overall = this.getRatingFor("overall") >= 0 ? this.getRatingFor("overall") : 5;

      const total = direction + imagery + story + performance + soundtrack + impression + love + overall;

      return parseFloat(total / 10).toFixed(2);
    },
    movieAsRatedOnPage () {
      return {
        ...this.movieToRate,
        ratings: [{ rating: this.rating }]
      };
    },
    numberOfMoviesAfterRating () {
      if (this.previousEntry) {
        return this.$store.getters.allMoviesAsArray.length;
      } else {
        return this.$store.getters.allMoviesAsArray.length + 1;
      }
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

      return this.settings.tags["viewing-tags"];
    },
    movieTags () {
      if (!this.settings || !this.settings.tags) {
        return [];
      }

      return this.settings.tags["movie-tags"];
    },
    rateBannerUrl () {
      if (this.movieToRate) {
        return `https://image.tmdb.org/t/p/original${this.movieToRate.backdrop_path}`;
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
    }
  },
  methods: {
    movieYear (movie) {
      return new Date(movie.release_date).getFullYear();
    },
    previouslyRated (id) {
      const ids = Object.keys(this.database).map((key) => this.database[key].movie.id);

      return ids.includes(id);
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
    sortByRating (a, b) {
      const aRating = this.mostRecentRating(a).rating;
      const bRating = this.mostRecentRating(b).rating;

      if (aRating < bRating) {
        return 1;
      }
      if (aRating > bRating) {
        return -1;
      }

      return 0;
    },
    getWeight (weightName) {
      const weightObj = this.settings?.weights?.find((weight) => {
        return weight.name === weightName;
      });

      return weightObj ? weightObj.weight : 0;
    },
    getScore (scoreName) {
      const lowerCase = scoreName.toLowerCase();
      const property = this[lowerCase];

      return parseFloat(property);
    },
    getRatingFor (category) {
      if (!category || !this.getWeight(category) || !this.getScore(category)) {
        return;
      }

      return this.getWeight(category) * this.getScore(category);
    },
    indexIfSortedIntoArray (movie, array) {
      const arr = [...array];
      arr.push(movie);

      arr.sort(this.sortByRating);

      return arr.indexOf(movie);
    },
    async addViewingTag () {
      if (!this.settings.tags || !this.settings.tags["viewing-tags"]) {
        return;
      }

      const viewingTagsArray = Object.keys(this.settings.tags["viewing-tags"]).map((key) => this.settings.tags["viewing-tags"][key]);

      if (!viewingTagsArray.find((tag) => tag.title === this.newViewingTagTitle)) {
        const dbKey = `${new Date().getTime()}-${crypto.randomUUID()}`;

        const dbEntry = {
          path: `settings/tags/viewing-tags/${dbKey}`,
          value: { title: this.newViewingTagTitle }
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
    async addRating () {
      this.loading = true;

      let ratings = [];

      if (this.previousEntry?.ratings) {
        ratings = [...this.previousEntry.ratings];
      }

      const rating = {
        date: this.date ? this.date : new Date().getTime(),
        direction: this.direction ? this.direction : 5,
        id: this.id,
        imagery: this.imagery ? this.imagery : 5,
        impression: this.impression ? this.impression : 0,
        love: this.love ? this.love : 5,
        medium: this.medium ? this.medium : "Other",
        overall: this.overall ? this.overall : 5,
        performance: this.performance ? this.performance : 5,
        rating: this.rating,
        soundtrack: this.soundtrack ? this.soundtrack : 5,
        story: this.story ? this.story : 5,
        tags: this.selectedViewingTags,
        title: this.title,
        year: this.year
      };

      ratings.push(rating);

      await addRating(ratings, false, this.selectedMovieTags);

      const routeAfterRating = this.settings?.routeAfterRating?.value;

      window.scroll({
        top: top,
        behavior: 'smooth'
      })

      this.$store.commit("setShowHeader", true);
      if (routeAfterRating === "recentlyViewed") {
        this.$store.commit("setDBSortValue", "watched");
        this.$router.push("/db-search");
      } else if (routeAfterRating === "allRatings") {
        this.$store.commit("setDBSortValue", "rating");
        this.$router.push("/db-search");
      } else if (routeAfterRating === "sameYear") {
        this.$store.commit("setDBSearchValue", `y:${rating.year}`);
        this.$store.commit("setDBSortValue", "rating");
        this.$router.push("/db-search");
      } else {
        this.$router.push("/");
      }
    },
    returnHome () {
      this.$router.push("/");
    },
    viewingTagChecked (tag) {
      if (!this.selectedViewingTagNames) {
        return false;
      }

      return this.selectedViewingTagNames.includes(tag.title);
    },
    movieTagChecked (tag) {
      if (!this.selectedMovieTagNames) {
        return false;
      }

      return this.selectedMovieTagNames.includes(tag.title);
    },
    toggleMovieTagList () {
      this.$refs.movieTagList.classList.toggle("collapsed");
    }
  },
}
</script>

<style lang="scss">
  .rate-movie {
    max-width: 832px;

    .rate-movie-header {
      position: relative;

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
    }

    .year-medium-date {
      column-gap: 1rem;
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
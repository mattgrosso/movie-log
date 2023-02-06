<template>
  <div class="rate-movie">
    <form class="p-4" @submit.prevent="addRating">
      <!--- Title --->
      <div class="col-12 my-5">
        <label class="form-label fs-4" for="title">Title</label>
        <input class="form-control" name="title" type="text" id="title" v-model="title">
      </div>

      <!--- Year / Medium / Date / PJ Theater--->
      <div class="year-medium-date col-12 my-5 d-flex justify-content-between">
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

      <!--- Direction --->
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

      <!--- Imagery --->
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

      <!--- Story --->
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

      <!--- Performance --->
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

      <!--- Soundtrack --->
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

      <!--- Impression --->
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

      <!--- Love --->
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

      <!--- Overall --->
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

      <p class="rating col-12 my-3 fs-5 text-center" id="rating">
        Rating: {{rating}}
        <span class="mx-3 fs-1">|</span>
        #{{indexIfSortedIntoArray(movieAsRatedOnPage, allMoviesRanked)}}/{{allMoviesAsArray.length}}
        <span class="mx-3 fs-1">|</span>
        #{{indexIfSortedIntoArray(movieAsRatedOnPage, moviesRankedFromYear)}} in {{movieYear(this.movieToRate)}}
      </p>

      <hr>

      <!--- Tags --->
      <div class="col-12 my-5 tags">
        <label class="form-label">Select Additional Tags</label>
        <div class="tag-list d-flex flex-wrap">
          <div v-for="(tag, index) in settings.tags" :key="index" class='form-check mx-2 mb-2'>
            <input class='form-check-input' type='checkbox' :id="`tag-${index}`" @click="toggleTag(tag)">
            <label class="form-check-label" :for="`tag-${index}`">
              {{tag.title}}
            </label>
          </div>
        </div>

        <div class="input-group">
          <input type="text" class="form-control" placeholder="new tag" v-model="newTagTitle">
          <button class="btn btn-dark" type="button" @click="addTag">
            add
          </button>
        </div>
      </div>

      <hr>

      <!-- Submit -->
      <button class="btn btn-primary col-12 mt-5 mb-4" type="submit" value="Submit">
        <span>Submit</span>
      </button>
    </form>

    <hr>

    <div v-if="movieToRate.ratings" class="previous-ratings my-3 mb-5 px-4 pt-3 pb-5">
      <label class="fs-4">Previous Viewings</label>
      <table class="table table-small table-striped-columns">
        <thead>
          <th><span>date</span></th>
          <th><span>dir</span></th>
          <th><span>img</span></th>
          <th><span>stry</span></th>
          <th><span>perf</span></th>
          <th><span>sndtk</span></th>
          <th><span>imp</span></th>
          <th><span>love</span></th>
          <th><span>ovral</span></th>
          <th><span>rating</span></th>
        </thead>
        <tbody>
          <tr class="col-12" v-for="(rating, index) in movieToRate.ratings" :key="index">
            <td class="col-2">{{rating.date}}</td>
            <td class="col-1">{{rating.direction}}</td>
            <td class="col-1">{{rating.imagery}}</td>
            <td class="col-1">{{rating.story}}</td>
            <td class="col-1">{{rating.performance}}</td>
            <td class="col-1">{{rating.soundtrack}}</td>
            <td class="col-1">{{rating.impression}}</td>
            <td class="col-1">{{rating.love}}</td>
            <td class="col-1">{{rating.overall}}</td>
            <td class="col-2">{{rating.rating}}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    database: {
      type: Object,
      required: true
    },
    movieToRate: {
      type: Object,
      required: true
    },
    settings: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      title: null,
      year: null,
      id: this.movieToRate.movie.id,
      medium: "",
      date: null,
      direction: null,
      imagery: null,
      story: null,
      performance: null,
      soundtrack: null,
      impression: null,
      love: null,
      overall: null,
      tags: [],
      newTagTitle: null
    }
  },
  mounted() {
    this.title = this.movieToRate.movie.title;
    this.year = new Date(this.movieToRate.movie.release_date).getFullYear();
  },
  computed: {
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
        ratings: [{rating: this.rating}]
      };
    },
    allMoviesAsArray () {
      return Object.keys(this.database).map((key) => {
        return this.database[key];
      })
    },
    allMoviesRanked () {
      const movies = [...this.allMoviesAsArray];
      return movies.sort(this.sortByRating);
    },
    moviesRankedFromYear () {
      const moviesFromYear = this.allMoviesAsArray.filter((movie) => {
        return this.movieYear(movie) === this.movieYear(this.movieToRate);
      })

      return moviesFromYear.sort(this.sortByRating);
    }
  },
  methods: {
    movieYear (movie) {
      return new Date(movie.movie.release_date).getFullYear();
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
      const weightObj = this.settings.weights.find((weight) => {
        return weight.name === weightName;
      });

      return weightObj.weight;
    },
    getScore (scoreName) {
      const lowerCase = scoreName.toLowerCase();
      const property = this[lowerCase];

      return parseFloat(property);
    },
    getRatingFor (category) {
      return this.getWeight(category) * this.getScore(category);
    },
    indexIfSortedIntoArray (movie, array) {
      const arr = [...array];
      arr.push(movie);

      arr.sort(this.sortByRating);

      return arr.indexOf(movie);
    },
    addTag () {
      this.$emit("addNewTag", { title: this.newTagTitle });
      this.newTagTitle = null;
    },
    toggleTag (tag) {
      if (this.tags.includes(tag)) {
        this.tags.splice(this.tags.indexOf(tag), 1);
      } else {
        this.tags.push(tag);
      }
    },
    addRating () {
      let ratings = [];
      
      if (this.movieToRate.ratings) {
        ratings = [...this.movieToRate.ratings];
      }

      const rating = {
        title: this.title,
        year: this.year,
        id: this.id,
        medium: this.medium,
        date: this.date,
        tags: this.tags,
        direction: this.direction,
        imagery: this.imagery,
        story: this.story,
        performance: this.performance,
        soundtrack: this.soundtrack,
        impression: this.impression,
        love: this.love,
        overall: this.overall,
        rating: this.rating
      };

      ratings.push(rating);

      this.$emit('addRating', ratings);
    }
  },
}
</script>

<style lang="scss">
  .rate-movie {
    .year-medium-date {
      column-gap: 1rem;
    }
  
    .previous-ratings {
      table {
        th {
          span {
            display: inline-block;
            transform: rotate(60deg);
            font-size: 0.6rem;
          }
        }
  
        td {
          font-size: 0.6rem;
        }
      }
    }
  }
</style>
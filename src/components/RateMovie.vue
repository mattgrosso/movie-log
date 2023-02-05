<template>
  <div class="rate-movie">
    <form class="p-4" @submit.prevent="addRating">
      <!--- Title --->
      <div class="col-12 my-5">
        <label class="form-label fs-4" for="title">Title</label>
        <input class="form-control" name="title" type="text" id="title" v-model="title">
      </div>

      <!--- Year / Medium / Date / PJ Theater--->
      <div class="year-medium-date col-12 my-5 d-flex">
        <div class="year">
          <label class="form-label fs-4" for="year">Year</label>
          <input class="form-control" name="year" id="year" type="text" v-model="year">
        </div>
        <div class="medium">
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
        <div class="date">
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

      <p class="rating col-12 my-3 fs-3 text-center" id="rating">
        Rating: {{rating}}
      </p>

      <hr>

      <!--- Tags --->
      <div class="col-12 my-5 tags">
        <label class="form-label">Select Additional Tags</label>
        <div class="tag-list d-flex flex-wrap">
          <div v-for="(tag, index) in settings.tags" :key="index" class='form-check mx-2 mb-2'>
            <input class='form-check-input' type='checkbox' :id="`tag-${index}`">
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
      <button class="btn btn-primary col-12 my-5" type="submit" value="Submit">
        <span>Submit</span>
      </button>
    </form>
  </div>
</template>

<script>
export default {
  props: {
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
      id: this.movieToRate.id,
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
      newTagTitle: null
    }
  },
  mounted() {
    this.title = this.movieToRate.title;
    this.year = new Date(this.movieToRate.release_date).getFullYear();
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
      
      return total / 10;
    }
  },
  methods: {
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
    addTag () {
      this.$emit("addNewTag", { title: this.newTagTitle });
      this.newTagTitle = null;
    },
    addRating () {
      const rating = {
        title: this.title,
        year: this.year,
        id: this.id,
        medium: this.medium,
        date: this.date,
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

      this.$emit('addRating', rating);
    }
  },
}
</script>

<style lang="scss">
  .year-medium-date {
    column-gap: 1rem;
  }

  .year {
    width: calc(((100% - 2rem) / 12) * 2);
  }

  .medium {
    width: calc(((100% - 2rem) / 12) * 5);
  }

  .date {
    width: calc(((100% - 2rem) / 12) * 5);

  }
</style>
<template>
  <div class="rate-tv-show mx-auto">
    <div class="rate-tv-show-header">
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

      <div class="season-and-episode d-flex justify-content-between">
        <div class="season col-4 my-4">
          <label class="form-label fs-4" for="season">Season</label>
          <select class="form-select" name="season" id="season" v-model="season" @change="selectSeason">
            <option value="all_seasons">All Seasons</option>
            <option v-for="(season, index) in seasons" :key="index" :value="season">{{season.name}}</option>
          </select>
        </div>
        <div class="episode col-7 my-4">
          <label class="form-label fs-4" for="episode">Episode</label>
          <select class="form-select" name="episode" id="episode" v-model="episode">
            <option value="all_episodes">All Episodes</option>
            <option v-for="(episode, index) in episodes" :key="index" :value="episode">{{episode.episode_number}} - {{episode.name}}</option>
          </select>
        </div>
      </div>

      <div class="date col-12 mb-4">
        <label class="form-label fs-4" for="date">Watch Date</label>
        <input class="form-control" name="date" id="date" type="date" v-model="date">
      </div>

      <div class="col-12 mt-4 mb-3 media-tags collapsed" ref="mediaTagList">
        <div class="media-tags-toggle d-flex justify-content-between align-items-center" @click="toggleTVShowTagList">
          <label class="form-label">Tags for the show itself
            <span v-if="selectedTVShowTagNames.length">({{ selectedTVShowTagNames.length }})</span>
          </label>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-right" viewBox="0 0 16 16">
            <path d="M6 12.796V3.204L11.481 8 6 12.796zm.659.753 5.48-4.796a1 1 0 0 0 0-1.506L6.66 2.451C6.011 1.885 5 2.345 5 3.204v9.592a1 1 0 0 0 1.659.753z"/>
          </svg>
        </div>
        <div class="media-tags-content">
          <div class="tag-list d-flex flex-wrap">
            <div v-for="(tag, index) in mediaTags" :key="index" class='form-check mx-2 mb-2'>
              <input class='form-check-input' :checked="mediaTagChecked(tag)" type='checkbox' :id="`tag-${index}`" @click="toggleMediaTag(tag)">
              <label class="form-check-label" :for="`tag-${index}`">
                {{tag.title}}
              </label>
            </div>
          </div>

          <div class="input-group">
            <input type="text" class="form-control" placeholder="new tag" v-model="newMediaTagTitle" @keyup.enter.prevent>
            <button class="btn btn-dark" type="button" @click.prevent="addMediaTag">
              add
            </button>
          </div>
        </div>
      </div>

      <hr>

      <div class="col-12 my-5">
        <label class="form-label fs-4 mb-0" for="direction">Direction</label>
        <p class="fs-6 fst-italic">Rate the {{episodeSeasonOrShow}}'s directing and editing.</p>
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
          Rate the {{episodeSeasonOrShow}}'s cinematography, visual effects, production design,costume design, and/or animation.
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
          Rate the {{episodeSeasonOrShow}}'s story and screenplay.
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
          Rate the performances in the {{episodeSeasonOrShow}}. In the case of documentaries, rate the interest of the subject matter.
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
          Rate the {{episodeSeasonOrShow}}'s score, songs, and sound design.
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
        <label class="form-label fs-4 mb-0" for="stickiness">Stickiness</label>
        <p class="fs-6 fst-italic">
          How much of a lasting impression do you think the {{episodeSeasonOrShow}} will have?
        </p>
        <select class="form-select" name="stickiness" id="stickiness" v-model="stickiness">
          <option value=""></option>
          <option value="0">
            0 - If I think of it at all it will be to warn others away
          </option>
          <option value="1">
            1 - I'm having a hard time remembering it already
          </option>
          <option value="2">
            2 - I think I'll mention it to some people
          </option>
          <option value="3">
            3 - I'm going to think about it often
          </option>
          <option value="4">
            4 - This is going to stay with me all the time
          </option>
          <option value="5">
            5 - This movie will change the way I think
          </option>
        </select>
      </div>

      <div class="col-12 my-5">
        <label class="form-label fs-4 mb-0" for="love">Love</label>
        <p class="fs-6 fst-italic">
          The intangible quality of a {{episodeSeasonOrShow}} that seems to speak to you specifically.
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
          Gut sense of the {{episodeSeasonOrShow}}'s overall rating.
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
        Rating: {{rating.calculatedTotal}}
        <span class="mx-3 d-flex justify-content-center align-items-center">|</span>
        #{{indexIfSortedIntoArray(tvShowAsRatedOnPage, allTVShowsRanked) + 1}}/{{numberOfTVShowsAfterRating}}
        <span class="mx-3 d-flex justify-content-center align-items-center">|</span>
        #{{indexIfSortedIntoArray(tvShowAsRatedOnPage, tvShowsRankedFromYear) + 1}} in {{tvShowYear(this.tvShowToRate)}}
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
        class="submit-button btn btn-primary col-12 mt-5"
        @click.prevent="addRating"
        type="submit"
        value="Submit"
        :disabled="loading"
      >
        <span v-if="!loading">Rate {{episodeSeasonOrShow}}</span>
        <span v-if="loading" class="disabled-show spinner-border spinner-border-sm mx-2" role="status" aria-hidden="true"></span>
        <span v-if="loading" class="disabled-show ">Submiting...</span>
      </button>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import addRating from "../assets/javascript/AddRating.js";
import { getRating } from "../assets/javascript/GetRating.js";

export default {
  data () {
    return {
      date: new Date().toISOString().substr(0, 10),
      direction: null,
      tvShowId: null,
      imagery: null,
      loading: false,
      love: null,
      medium: "",
      newViewingTagTitle: null,
      newMediaTagTitle: null,
      overall: null,
      performance: null,
      soundtrack: null,
      stickiness: null,
      story: null,
      selectedViewingTags: [],
      selectedMediaTags: [],
      title: null,
      year: null,
      season: "all_seasons",
      seasons: [],
      episode: "all_episodes",
      episodes: []
    }
  },
  async mounted () {
    this.$store.commit("setShowHeader", false);
    this.title = this.tvShowToRate.name;
    this.year = new Date(this.tvShowToRate.first_air_date).getFullYear();
    this.tvShowId = this.tvShowToRate.id;

    const seasons = await axios.get(`https://api.themoviedb.org/3/tv/${this.tvShowId}?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US`);
    this.seasons = seasons.data.seasons;

    this.selectedMediaTags = this.previousEntry ? this.previousEntry.tvShow.tags || [] : [];
  },
  beforeRouteLeave () {
    this.$store.commit("setShowHeader", true);
  },
  computed: {
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    database () {
      return this.$store.state.tvLog;
    },
    tvShowToRate () {
      return this.$store.state.tvShowToRate;
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
    tvShowAsRatedOnPage () {
      return {
        ...this.tvShowToRate,
        ratings: [{ rating: this.rating }]
      };
    },
    episodeSeasonOrShow () {
      if (this.season === "all_seasons") {
        return "show";
      } else if (this.episode === "all_episodes") {
        return "season";
      } else {
        return "episode";
      }
    },
    numberOfTVShowsAfterRating () {
      if (this.previousEntry) {
        return this.$store.getters.allTVShowsAsArray.length;
      } else {
        return this.$store.getters.allTVShowsAsArray.length + 1;
      }
    },
    allTVShowsRanked () {
      const tvShows = [...this.$store.getters.allTVShowsAsArray];
      return tvShows.sort(this.sortByRating);
    },
    tvShowsRankedFromYear () {
      const tvShowsFromYear = this.$store.getters.allTVShowsAsArray.filter((tvShow) => {
        return this.tvShowYear(tvShow.tvShow) === this.tvShowYear(this.tvShowToRate);
      })

      return tvShowsFromYear.sort(this.sortByRating);
    },
    previousEntry () {
      return this.$store.getters.allTVShowsAsArray.find((entry) => {
        return entry.tvShow.id === this.tvShowId;
      })
    },
    viewingTags () {
      if (!this.settings || !this.settings.tags) {
        return [];
      }

      return this.settings.tags["viewing-tags"];
    },
    mediaTags () {
      if (!this.settings || !this.settings.tags) {
        return [];
      }

      return this.settings.tags["media-tags"];
    },
    rateBannerUrl () {
      if (this.tvShowToRate) {
        return `https://image.tmdb.org/t/p/original${this.tvShowToRate.backdrop_path}`;
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
    selectedTVShowTagNames () {
      return this.selectedMediaTags.map((tag) => tag.title);
    }
  },
  methods: {
    tvShowYear (tvShow) {
      const startDate = tvShow.release_date || tvShow.first_air_date;
      return new Date(startDate).getFullYear();
    },
    previouslyRated (id) {
      const ids = Object.keys(this.database).map((key) => this.database[key].tvShow.id);

      return ids.includes(id);
    },
    mostRecentRating (tvShow) {
      return tvShow.ratings.tvShow;
    },
    sortByRating (a, b) {
      const aRating = this.mostRecentRating(a)?.rating;
      const bRating = this.mostRecentRating(b)?.rating;

      if (aRating < bRating) {
        return 1;
      }
      if (aRating > bRating) {
        return -1;
      }

      return 0;
    },
    getWeight (weightName) {
      const weightObj = this.$store.state.weights?.find((weight) => {
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
    indexIfSortedIntoArray (tvShow, array) {
      const arr = [...array];
      arr.push(tvShow);

      arr.sort(this.sortByRating);

      return arr.indexOf(tvShow);
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
    async addMediaTag () {
      if (!this.settings.tags || !this.settings.tags["media-tags"]) {
        return;
      }

      const mediaTagsArray = Object.keys(this.settings.tags["media-tags"]).map((key) => this.settings.tags["media-tags"][key]);

      if (!mediaTagsArray.find((tag) => tag.title === this.newMediaTagTitle)) {
        const dbKey = `${new Date().getTime()}-${crypto.randomUUID()}`;

        const dbEntry = {
          path: `settings/tags/movie-tags/${dbKey}`,
          value: { title: this.newMediaTagTitle }
        }

        this.$store.dispatch('setDBValue', dbEntry);
      }

      this.newMediaTagTitle = null;
    },
    toggleViewingTag (tag) {
      if (this.viewingTagChecked(tag)) {
        this.selectedViewingTags.splice(this.selectedViewingTags.indexOf(tag), 1);
      } else {
        this.selectedViewingTags.push(tag);
      }
    },
    toggleMediaTag (tag) {
      if (this.mediaTagChecked(tag)) {
        this.selectedMediaTags.splice(this.selectedMediaTags.indexOf(tag), 1);
      } else {
        this.selectedMediaTags.push(tag);
      }
    },
    previouslyRatedEpisode (episodes, episode) {
      return episodes.findIndex((oldEpisode) => {
        return oldEpisode?.episode?.id === episode?.id;
      })
    },
    async addRating () {
      this.loading = true;

      let ratings = {};

      if (this.previousEntry?.ratings) {
        ratings = { ...this.previousEntry.ratings };
      }

      const rating = {
        date: this.date ? this.date : new Date().getTime(),
        direction: this.direction ? this.direction : 5,
        tvShowId: this.tvShowId,
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
        year: this.year,
        season: this.season,
        episode: this.episode
      };

      if (!ratings.episodes) {
        ratings.episodes = [];
      }

      if (this.season === "all_seasons") {
        for (const season of this.seasons) {
          const episodes = await axios.get(`https://api.themoviedb.org/3/tv/${this.tvShowId}/season/${season.season_number}?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US`);

          for (const episode of episodes.data.episodes) {
            const loopRating = { ...rating, season: season, episode: episode };

            if (this.previouslyRatedEpisode(ratings.episodes, loopRating.episode) > -1) {
              ratings.episodes.splice(this.previouslyRatedEpisode(ratings.episodes, loopRating.episode), 1, loopRating);
            } else {
              ratings.episodes.push(loopRating);
            }
          }
        }
      } else if (this.episode === "all_episodes") {
        const episodes = await axios.get(`https://api.themoviedb.org/3/tv/${this.tvShowId}/season/${this.season.season_number}?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US`);

        for (const episode of episodes.data.episodes) {
          const loopRating = { ...rating, episode: episode };

          if (this.previouslyRatedEpisode(ratings.episodes, loopRating.episode) > -1) {
            ratings.episodes.splice(this.previouslyRatedEpisode(ratings.episodes, loopRating.episode), 1, loopRating);
          } else {
            ratings.episodes.push(loopRating);
          }
        }
      } else if (this.previouslyRatedEpisode(ratings.episodes, rating.episode) > -1) {
        ratings.episodes.splice(this.previouslyRatedEpisode(ratings.episodes, rating.episode), 1, rating);
      } else {
        ratings.episodes.push(rating);
      }

      if (this.previouslyRatedEpisode(ratings.episodes, rating.episode) > -1) {
        ratings.episodes.splice(this.previouslyRatedEpisode(ratings.episodes, rating.episode), 1, rating);
      } else {
        ratings.episodes.push(rating);
      }

      const dbEntry = await addRating(ratings, this.selectedMediaTags);

      this.$store.dispatch("addToRecentlyRatedTVShows", dbEntry.value.tvShow);

      window.scroll({
        top: top,
        behavior: 'smooth'
      })

      this.$store.commit("setShowHeader", true);
      this.returnHome();
    },
    returnHome () {
      this.$store.commit("setShowHeader", true);
      this.$router.push("/");
    },
    viewingTagChecked (tag) {
      if (!this.selectedViewingTagNames) {
        return false;
      }

      return this.selectedViewingTagNames.includes(tag.title);
    },
    mediaTagChecked (tag) {
      if (!this.selectedTVShowTagNames) {
        return false;
      }

      return this.selectedTVShowTagNames.includes(tag.title);
    },
    toggleTVShowTagList () {
      this.$refs.mediaTagList.classList.toggle("collapsed");
    },
    async selectSeason () {
      if (this.season === "all_seasons") {
        this.episodes = [];
      } else {
        const episodes = await axios.get(`https://api.themoviedb.org/3/tv/${this.tvShowId}/season/${this.season.season_number}?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US`);
        this.episodes = episodes.data.episodes;
      }
    }
  },
}
</script>

<style lang="scss">
  .rate-tv-show {
    max-width: 832px;

    .rate-tv-show-header {
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

    .media-tags {
      .media-tags-toggle {
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

      .media-tags-content {
        max-height: 500px;
        overflow: hidden;
        transition: all 0.3s ease;
      }

      &.collapsed {
        .media-tags-toggle {
          svg {
            transform: rotate(0deg);
          }
        }

        .media-tags-content {
          max-height: 0;
        }
      }
    }

    .submit-button {
      margin-bottom: 25vh;

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
    .rate-tv-show {
      color: white;
    }
  }
</style>
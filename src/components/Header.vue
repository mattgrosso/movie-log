<template>
  <div class="header col-12" :class="{'d-none': !$store.state.showHeader}">
    <div class="overflow-wrapper">
      <div class="poster-grid" :class="posterCount">
        <img v-for="(image, index) in postersForHeader" :src="image" :key="index">
      </div>
      <div class="settings-toggle" @click="toggleSettings">
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-gear-wide-connected" viewBox="0 0 16 16">
          <path d="M7.068.727c.243-.97 1.62-.97 1.864 0l.071.286a.96.96 0 0 0 1.622.434l.205-.211c.695-.719 1.888-.03 1.613.931l-.08.284a.96.96 0 0 0 1.187 1.187l.283-.081c.96-.275 1.65.918.931 1.613l-.211.205a.96.96 0 0 0 .434 1.622l.286.071c.97.243.97 1.62 0 1.864l-.286.071a.96.96 0 0 0-.434 1.622l.211.205c.719.695.03 1.888-.931 1.613l-.284-.08a.96.96 0 0 0-1.187 1.187l.081.283c.275.96-.918 1.65-1.613.931l-.205-.211a.96.96 0 0 0-1.622.434l-.071.286c-.243.97-1.62.97-1.864 0l-.071-.286a.96.96 0 0 0-1.622-.434l-.205.211c-.695.719-1.888.03-1.613-.931l.08-.284a.96.96 0 0 0-1.186-1.187l-.284.081c-.96.275-1.65-.918-.931-1.613l.211-.205a.96.96 0 0 0-.434-1.622l-.286-.071c-.97-.243-.97-1.62 0-1.864l.286-.071a.96.96 0 0 0 .434-1.622l-.211-.205c-.719-.695-.03-1.888.931-1.613l.284.08a.96.96 0 0 0 1.187-1.186l-.081-.284c-.275-.96.918-1.65 1.613-.931l.205.211a.96.96 0 0 0 1.622-.434l.071-.286zM12.973 8.5H8.25l-2.834 3.779A4.998 4.998 0 0 0 12.973 8.5zm0-1a4.998 4.998 0 0 0-7.557-3.779l2.834 3.78h4.723zM5.048 3.967c-.03.021-.058.043-.087.065l.087-.065zm-.431.355A4.984 4.984 0 0 0 3.002 8c0 1.455.622 2.765 1.615 3.678L7.375 8 4.617 4.322zm.344 7.646.087.065-.087-.065z"/>
        </svg>
      </div>
      <router-link class="home-link" :class="posterCount" to="/">
        <span>
          Movie Log
        </span>
      </router-link>
    </div>
    <Settings :showSettings="showSettings" @hideSettings="showSettings = false"/>
  </div>
</template>

<script>
import Settings from "./Settings.vue";

export default {
  components: {
    Settings
  },
  data () {
    return {
      showSettings: false
    }
  },
  computed: {
    database () {
      return this.$store.state.database;
    },
    allMoviePostersRanked () {
      const movies = [...this.$store.getters.allMoviesAsArray];
      return movies.sort(this.sortByRating).map((movie) => {
        return `https://image.tmdb.org/t/p/w94_and_h141_bestv2${movie.movie.poster_path}`;
      });
    },
    postersForHeader () {
      if (this.$store.getters.allMoviesAsArray.length < 24) {
        return [this.randomBanner()];
      } else if (this.$store.getters.allMoviesAsArray.length < 120) {
        return this.allMoviePostersRanked.slice(0, 24);
      } else {
        return this.allMoviePostersRanked.slice(0, 120);
      }
    },
    posterCount () {
      if (this.$store.getters.allMoviesAsArray.length < 24) {
        return "single";
      } else if (this.$store.getters.allMoviesAsArray.length < 120) {
        return "twenty-four";
      } else {
        return "one-twenty";
      }
    }
  },
  methods: {
    toggleSettings () {
      this.$el.querySelector(".settings-toggle").classList.toggle("rotated");
      this.showSettings = !this.showSettings;
    },
    mostRecentRating (movie) {
      let mostRecentRating = movie.ratings[0];
      movie.ratings.forEach((rating) => {
        if (rating.date && rating.date > mostRecentRating.date) {
          mostRecentRating = rating;
        } else if (!mostRecentRating.date) {
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
    randomBanner () {
      const rand = Math.floor(Math.random() * this.$store.getters.allMoviesAsArray.length);

      if (this.$store.getters.allMoviesAsArray[rand]) {
        return `https://image.tmdb.org/t/p/original${this.$store.getters.allMoviesAsArray[rand].movie.backdrop_path}`;
      } else {
        return "https://image.tmdb.org/t/p/original/1TvNazsE9WvRIxxeZkvL7IVVgzD.jpg";
      }
    }
  }
}
</script>

<style lang="scss">
  .header {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    justify-content: end;
    position: relative;

    .overflow-wrapper {
      height: 100%;
      width: 100%;
      position: relative;
      overflow: hidden;

      .home-link {
        background: rgba(0, 0, 0, 0.5);
        border-radius: 100px;
        border: 2px solid white;
        color: white;
        font-family: "Anton", sans-serif;
        font-size: 1rem;
        left: 50%;
        margin: 0;
        padding: 0 36px;
        position: absolute;
        text-decoration: none;
        top: 50%;
        transform: translate(-50%, -50%);
        white-space: nowrap;

        &.single {
          background: none;
          border: 0;
          font-size: 2.5rem;
          left: 0;
          padding: 0 24px;
          text-shadow: -5px 5px 10px black;
          top: 100%;
          transform: translate(0, -100%);
        }

        @media screen and (min-width: 320px) {
          font-size: 2rem;
        }
      }
    }

    .poster-grid {
      position: relative;
      column-gap: 0;
      display: flex;
      flex-wrap: wrap;
      row-gap: 0;

      &.single {
        max-height: 150px;
        align-content: center;

        img {
          width: 100%;
        }
      }

      &.twenty {
        img {
          width: calc(100% / 12);

          @media screen and (min-width: 1024px) {
            width: calc(100% / 24 );
          }

          &:hover {
            transform: scale(2);
          }
        }
      }

      &.one-twenty {
        img {
          width: 5%;

          @media screen and (min-width: 640px) {
            width: calc(100% / 30);
          }

          @media screen and (min-width: 1024px) {
            width: calc(100% / 40);
          }

          @media screen and (min-width: 2000px) {
            width: calc(100% / 60);
          }

          &:hover {
            transform: scale(2);
          }
        }
      }
    }

    .settings-toggle {
      align-items: center;
      background: black;
      bottom: -7px;
      cursor: pointer;
      display: flex;
      justify-content: center;
      padding: 6px 50px 12px;
      position: absolute;
      right: -47px;
      transform: rotate(-45deg);

      &.rotated {
        svg {
          transform: rotate(-200deg);
        }
      }

      svg {
        color: white;
        height: 24px;
        transition: transform 0.75s ease;
        width: 24px;
      }
    }
  }
</style>

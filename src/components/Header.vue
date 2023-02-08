<template>
  <div class="header col-12 d-flex justify-content-center align-items-center">
    <div class="overflow-wrapper">
      <div class="poster-grid">
        <img v-for="(image, index) in postersForHeader" :src="image" :key="index" :class="posterWidth">
      </div>
      <div class="settings" @click="openSettings">
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-gear-wide-connected" viewBox="0 0 16 16">
          <path d="M7.068.727c.243-.97 1.62-.97 1.864 0l.071.286a.96.96 0 0 0 1.622.434l.205-.211c.695-.719 1.888-.03 1.613.931l-.08.284a.96.96 0 0 0 1.187 1.187l.283-.081c.96-.275 1.65.918.931 1.613l-.211.205a.96.96 0 0 0 .434 1.622l.286.071c.97.243.97 1.62 0 1.864l-.286.071a.96.96 0 0 0-.434 1.622l.211.205c.719.695.03 1.888-.931 1.613l-.284-.08a.96.96 0 0 0-1.187 1.187l.081.283c.275.96-.918 1.65-1.613.931l-.205-.211a.96.96 0 0 0-1.622.434l-.071.286c-.243.97-1.62.97-1.864 0l-.071-.286a.96.96 0 0 0-1.622-.434l-.205.211c-.695.719-1.888.03-1.613-.931l.08-.284a.96.96 0 0 0-1.186-1.187l-.284.081c-.96.275-1.65-.918-.931-1.613l.211-.205a.96.96 0 0 0-.434-1.622l-.286-.071c-.97-.243-.97-1.62 0-1.864l.286-.071a.96.96 0 0 0 .434-1.622l-.211-.205c-.719-.695-.03-1.888.931-1.613l.284.08a.96.96 0 0 0 1.187-1.186l-.081-.284c-.275-.96.918-1.65 1.613-.931l.205.211a.96.96 0 0 0 1.622-.434l.071-.286zM12.973 8.5H8.25l-2.834 3.779A4.998 4.998 0 0 0 12.973 8.5zm0-1a4.998 4.998 0 0 0-7.557-3.779l2.834 3.78h4.723zM5.048 3.967c-.03.021-.058.043-.087.065l.087-.065zm-.431.355A4.984 4.984 0 0 0 3.002 8c0 1.455.622 2.765 1.615 3.678L7.375 8 4.617 4.322zm.344 7.646.087.065-.087-.065z"/>
        </svg>
      </div>
      <a class="home-link" :class="{'needs-contrast': posterLayout}" @click="$emit('showHome')">
        Movie Log
      </a>
    </div>
    <a class="home-link-inverted" :class="{'needs-contrast': posterLayout}" @click="$emit('showHome')">
      Movie Log
    </a>
  </div>
</template>

<script>
export default {
  props: {
    database: {
      type: Object,
      required: true
    },
    posterLayout: {
      type: Boolean,
      required: false,
      default: true
    }
  },
  computed: {
    allMoviesAsArray () {
      return Object.keys(this.database).map((key) => {
        return this.database[key];
      })
    },
    allMoviePostersRanked () {
      const movies = [...this.allMoviesAsArray];
      return movies.sort(this.sortByRating).map((movie) => {
        return `https://image.tmdb.org/t/p/w94_and_h141_bestv2${movie.movie.poster_path}`;
      });
    },
    postersForHeader () {
      if (!this.posterLayout) {
        return [this.randomPoster()];
      } else if (this.allMoviesAsArray.length < 30) {
        return ["https://live.staticflickr.com/65535/47980547206_7a02cb7f3f_h.jpg"];
      } else if (this.allMoviesAsArray.length < 120) {
        return this.allMoviePostersRanked.slice(0, 30);
      } else {
        return this.allMoviePostersRanked.slice(0, 120);
      }
    },
    posterWidth () {
      if (!this.posterLayout) {
        return "single";
      } else if (this.allMoviesAsArray.length < 30) {
        return "single";
      } else if (this.allMoviesAsArray.length < 120) {
        return "ten";
      } else {
        return "twenty";
      }
    }
  },
  methods: {
    openSettings () {
      this.$el.querySelector(".settings").classList.toggle("rotated");
      this.$emit('openSettings');
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
    randomPoster () {
      const rand = Math.floor(Math.random() * this.allMoviesAsArray.length);

      if (this.allMoviesAsArray[rand]) {
        return `https://image.tmdb.org/t/p/original${this.allMoviesAsArray[rand].movie.poster_path}`;
      } else {
        return "https://live.staticflickr.com/65535/47980547206_7a02cb7f3f_h.jpg";
      }
    }
  }
}
</script>

<style lang="scss">
  .header {
    height: 200px;
    position: relative;

    .overflow-wrapper {
      height: 100%;
      width: 100%;
      position: relative;
      overflow: hidden;
    }

    .poster-grid {
      bottom: 0;
      column-gap: 0;
      display: flex;
      flex-wrap: wrap;
      left: 0;
      position: absolute;
      right: 0;
      row-gap: 0;
      top: 0;

      .single {
        width: 100%;
      }

      .ten {
        width: 10%;

        &:hover {
          transform: scale(2);
          transition: transform 0.1s ease-out;
        }

        @media screen and (min-width: 832px) {
          &:hover {
            transform: scale(1.2);
            transition: transform 0.1s ease-out;
          }
        }

      }

      .twenty {
        width: 5%;

        @media screen and (min-width: 832px) {
          width: 2.5%;
        }

        &:hover {
          transform: scale(3);
          transition: transform 0.1s ease-out;
        }
      }
    }

    .home-link {
      cursor: pointer;
      z-index: 1;
    }

    .settings {
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

    .home-link,
    .home-link-inverted {
      color: white;
      font-family: "Anton", sans-serif;
      font-size: 4rem;
      margin: 0;
      text-decoration: none;
      padding: 0 12px;
      position: absolute;
      bottom: -40px;
      left: 0px;
      transition: all 1s ease-in-out;

      &.needs-contrast {
        background: rgba(0, 0, 0, 0.5);
        bottom: 50%;
        left: 50%;
        transform: translate(-50%, 50%);
        font-size: 2rem;
        border-radius: 100px;
        padding: 0 36px;
        border: 2px solid white;
      }
    }

    .home-link-inverted {
      color: black;
    }
  }
</style>

<template>
  <div class="header col-12" :class="{'d-none': !$store.state.showHeader}">
    <div class="overflow-wrapper">
      <div class="poster-grid" :class="posterCount">
        <img v-for="(image, index) in postersForHeader" :src="image" :key="index">
      </div>
      <div v-if="devMode" class="dev-mode-flag">
        Dev Mode!
      </div>
      <div class="home-link" :class="posterCount" @click="goHome">
        <span class="app-title">Cinema Roll</span>
        <span class="version">{{version}}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { getRating } from "../assets/javascript/GetRating.js";

export default {
  name: "Header",
  computed: {
    version () {
      return process.env.VUE_APP_VERSION;
    },
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    allPostersRanked () {
      const media = [...this.$store.getters.allMediaAsArray];
      return media.sort(this.sortByRating).map((media) => {
        return `https://image.tmdb.org/t/p/w94_and_h141_bestv2${this.topStructure(media).poster_path}`;
      });
    },
    postersForHeader () {
      if (this.$store.getters.allMediaAsArray.length < 24) {
        return [this.randomBanner()];
      } else if (this.$store.getters.allMediaAsArray.length < 80) {
        return this.allPostersRanked.slice(0, 24);
      } else {
        return this.allPostersRanked.slice(0, 80);
      }
    },
    posterCount () {
      if (this.$store.getters.allMediaAsArray.length < 24) {
        return "single";
      } else if (this.$store.getters.allMediaAsArray.length < 80) {
        return "twenty-four";
      } else {
        return "eighty";
      }
    },
    devMode () {
      return this.$store.getters.devMode;
    }
  },
  methods: {
    mostRecentRating (media) {
      if (this.currentLogIsTVLog) {
        return media.ratings.tvShow;
      } else {
        return getRating(media);
      }
    },
    sortByRating (a, b) {
      const aRating = this.mostRecentRating(a).calculatedTotal;
      const bRating = this.mostRecentRating(b).calculatedTotal;

      if (aRating < bRating) {
        return 1;
      }
      if (aRating > bRating) {
        return -1;
      }

      return 0;
    },
    randomBanner () {
      const rand = Math.floor(Math.random() * this.$store.getters.allMediaAsArray.length);

      if (this.$store.getters.allMediaAsArray[rand]) {
        return `https://image.tmdb.org/t/p/original${this.topStructure(this.$store.getters.allMediaAsArray[rand]).backdrop_path}`;
      } else {
        return "https://www.solidbackgrounds.com/images/1920x1080/1920x1080-black-solid-color-background.jpg";
      }
    },
    async goHome () {
      await this.$store.commit("setGoHome", true);
      this.$router.push("/");
    },
    topStructure (result) {
      if (this.currentLogIsTVLog) {
        return result.tvShow;
      } else {
        return result.movie;
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
    justify-content: flex-end;
    position: relative;

    .overflow-wrapper {
      height: 100%;
      overflow: hidden;
      position: relative;
      width: 100%;

      .dev-mode-flag {
        background-color: #dc3545;
        border: 2px solid white;
        box-shadow: 0px 0px 9px 0px #424242;
        color: white;
        font-size: 1rem;
        left: 0;
        padding: 6px 64px;
        pointer-events: none;
        position: fixed;
        top: 0;
        transform: rotate(-45deg) translate(-55px, -33px);
        z-index: 1;
      }

      .home-link {
        background: rgba(0, 0, 0, 0.6);
        border-top-left-radius: 6px;
        bottom: -2px;
        color: white;
        cursor: pointer;
        font-family: "Lobster", sans-serif;
        font-size: 3rem;
        font-weight: 700;
        margin: 0;
        padding: 0 10px 0 16px;
        position: absolute;
        right: 0;
        white-space: nowrap;

        .version {
          bottom: 0;
          font-family: "Roboto Condensed", sans-serif;
          font-size: 0.5rem;
          position: absolute;
          right: 3px;
        }
      }
    }

    .poster-grid {
      column-gap: 0;
      display: flex;
      flex-wrap: wrap;
      position: relative;
      row-gap: 0;

      &.single {
        align-content: center;
        max-height: 150px;

        img {
          width: 100%;
        }
      }

      &.twenty-four {
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

      &.eighty {
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
  }
</style>

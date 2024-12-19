<template>
  <div class="header col-12" :class="{'d-none': !$store.state.showHeader}">
    <div class="overflow-wrapper">
      <div class="random-banner">
        <img :src="randomBannerUrl" :key="index">
      </div>
      <div class="top-posters">
        <img v-for="(poster, index) in topTenPosters" :src="poster" :key="index">
      </div>
      <div v-if="devMode" class="dev-mode-flag">
        Dev Mode!
      </div>
      <div class="home-link" @click="goHome">
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
    devMode () {
      return this.$store.getters.devMode;
    },
    randomBannerUrl () {
      const filteredResults = this.$store.state.filteredResults;
      let mediaArray = filteredResults.length ? filteredResults : this.$store.getters.allMediaAsArray;
      if (mediaArray.length === 0) return null; // Handle empty array case

      const onlyRatedOverSix = mediaArray.filter((media) => {
        const mostRecentRating = this.mostRecentRating(media);
        return mostRecentRating && mostRecentRating.calculatedTotal > 6;
      });

      if (onlyRatedOverSix && onlyRatedOverSix.length > 0) {
        mediaArray = onlyRatedOverSix;
      }

      const randomIndex = Math.floor(Math.random() * mediaArray.length);
      const randomMedia = mediaArray[randomIndex];

      const topStructure = this.topStructure(randomMedia);
      if (topStructure && topStructure.backdrop_path) {
        return `https://image.tmdb.org/t/p/w500${topStructure.backdrop_path}`;
      } else {
        return "https://www.solidbackgrounds.com/images/1920x1080/1920x1080-black-solid-color-background.jpg";
      }
    },
    topTenPosters () {
      return this.allPostersRanked.slice(0, 10);
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
    async sortByRating (a, b) {
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

    .random-banner {
      column-gap: 0;
      display: flex;
      flex-wrap: wrap;
      position: relative;
      row-gap: 0;
      align-content: center;

      img {
        width: 100%;
      }

      @media screen and (min-width: 600px) {
        display: none;
      }
    }

    .top-posters {
      display: none;

      @media screen and (min-width: 600px) {
        display: flex;

        img {
          width: 10%;
        }
      }
    }
  }
</style>
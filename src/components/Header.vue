<template>
  <div class="header col-12" :class="{'d-none': !$store.state.showHeader}">
    <div class="overflow-wrapper">
      <div class="poster-grid" :class="posterCount">
        <img v-for="(image, index) in postersForHeader" :src="image" :key="index">
      </div>
      <div v-if="devMode" class="dev-mode-flag">
        Dev Mode!
      </div>
      <div class="settings-link" @click="toggleSettings">
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-gear-wide-connected" viewBox="0 0 16 16">
          <path d="M7.068.727c.243-.97 1.62-.97 1.864 0l.071.286a.96.96 0 0 0 1.622.434l.205-.211c.695-.719 1.888-.03 1.613.931l-.08.284a.96.96 0 0 0 1.187 1.187l.283-.081c.96-.275 1.65.918.931 1.613l-.211.205a.96.96 0 0 0 .434 1.622l.286.071c.97.243.97 1.62 0 1.864l-.286.071a.96.96 0 0 0-.434 1.622l.211.205c.719.695.03 1.888-.931 1.613l-.284-.08a.96.96 0 0 0-1.187 1.187l.081.283c.275.96-.918 1.65-1.613.931l-.205-.211a.96.96 0 0 0-1.622.434l-.071.286c-.243.97-1.62.97-1.864 0l-.071-.286a.96.96 0 0 0-1.622-.434l-.205.211c-.695.719-1.888.03-1.613-.931l.08-.284a.96.96 0 0 0-1.186-1.187l-.284.081c-.96.275-1.65-.918-.931-1.613l.211-.205a.96.96 0 0 0-.434-1.622l-.286-.071c-.97-.243-.97-1.62 0-1.864l.286-.071a.96.96 0 0 0 .434-1.622l-.211-.205c-.719-.695-.03-1.888.931-1.613l.284.08a.96.96 0 0 0 1.187-1.186l-.081-.284c-.275-.96.918-1.65 1.613-.931l.205.211a.96.96 0 0 0 1.622-.434l.071-.286zM12.973 8.5H8.25l-2.834 3.779A4.998 4.998 0 0 0 12.973 8.5zm0-1a4.998 4.998 0 0 0-7.557-3.779l2.834 3.78h4.723zM5.048 3.967c-.03.021-.058.043-.087.065l.087-.065zm-.431.355A4.984 4.984 0 0 0 3.002 8c0 1.455.622 2.765 1.615 3.678L7.375 8 4.617 4.322zm.344 7.646.087.065-.087-.065z"/>
        </svg>
      </div>
      <div class="home-link" :class="posterCount" @click="goHome">
        <span v-if="currentLogIsTVLog">TV Log</span>
        <span v-else>Movie Log</span>
      </div>
    </div>
  </div>
</template>

<script>
import { get } from "firebase/database";
import { getRating } from "../assets/javascript/GetRating.js";

export default {
  data () {
    return {
      showSettings: false
    }
  },
  computed: {
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
      } else if (this.$store.getters.allMediaAsArray.length < 120) {
        return this.allPostersRanked.slice(0, 24);
      } else {
        return this.allPostersRanked.slice(0, 120);
      }
    },
    posterCount () {
      if (this.$store.getters.allMediaAsArray.length < 24) {
        return "single";
      } else if (this.$store.getters.allMediaAsArray.length < 120) {
        return "twenty-four";
      } else {
        return "one-twenty";
      }
    },
    devMode () {
      return this.$store.getters.devMode;
    }
  },
  methods: {
    toggleSettings () {
      this.$el.querySelector(".settings-link").classList.toggle("rotated");

      if (this.$router.currentRoute.value.name === "Settings") {
        this.$router.push("/");
      } else {
        this.$router.push("/settings");
      }
    },
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
      width: 100%;
      position: relative;
      overflow: hidden;

      .dev-mode-flag {
        background-color: #dc3545;
        border: 2px solid white;
        box-shadow: 0px 0px 9px 0px #424242;
        font-size: 1rem;
        left: 0;
        padding: 6px 64px;
        pointer-events: none;
        position: fixed;
        top: 0;
        transform: rotate(-45deg) translate(-55px, -33px);
        color: white;
        z-index: 1;
      }

      .home-link {
        background: rgba(0, 0, 0, 0.5);
        border-radius: 100px;
        border: 2px solid white;
        color: white;
        cursor: pointer;
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

    .settings-link {
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

<template>
  <div class="share-db-results">
    <div class="share-header">
      <img v-if="shareBannerUrl" class="col-12" :src="shareBannerUrl">
      <h1 class="text-light col-12 m-0 px-3 py-2">Movie Log</h1>
    </div>
    <div v-if="shareObject" class="terms d-flex justify-content-between align-items-center p-3">
      <div>
        <span class="badge rounded-pill text-bg-dark mx-2">{{shareObject.value}}</span>
        <span class="badge rounded-pill text-bg-dark mx-2">{{shareObject.sortValue}}</span>
        <span class="badge rounded-pill text-bg-dark mx-2">{{shareObject.sortOrder}}</span>
      </div>
      <button
        class="keyword-style-toggle btn btn-sm btn-dark"
        type="button"
        @click="gridView = !gridView"
      >
        <span v-if="!gridView">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-columns-gap" viewBox="0 0 16 16">
            <path d="M6 1v3H1V1zM1 0a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1zm14 12v3h-5v-3zm-5-1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zM6 8v7H1V8zM1 7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm14-6v7h-5V1zm-5-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1z"/>
          </svg>
        </span>
        <span v-else>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-card-list" viewBox="0 0 16 16">
            <path d="M14.5 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5zm-13-1A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2z"/>
            <path d="M5 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 5 8m0-2.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5m0 5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5m-1-5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0M4 8a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m0 2.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>
          </svg>
        </span>
      </button>
    </div>
    <div class="poster-grid" v-if="gridView">
      <div
        v-for="(result, index) in filteredResults"
        :key="index"
        class="poster-frame-wrapper"
      >
        <a
          class="poster-grid-item"
          :href="`https://www.google.com/search?q=${result.movie.title} movie`"
          target="_blank"
        >
          <img
            v-if="result.movie.poster_path"
            class="poster-grid-item-image"
            :src="`https://image.tmdb.org/t/p/w500${result.movie.poster_path}`"
            :alt="result.movie.title"
          >
          <div class="poster-grid-item-rating-ribbon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-award-fill" viewBox="0 0 16 16">
              <path d="m8 0 1.669.864 1.858.282.842 1.68 1.337 1.32L13.4 6l.306 1.854-1.337 1.32-.842 1.68-1.858.282L8 12l-1.669-.864-1.858-.282-.842-1.68-1.337-1.32L2.6 6l-.306-1.854 1.337-1.32.842-1.68L6.331.864 8 0z"/>
              <path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1 4 11.794z"/>
            </svg>
            <p class="poster-grid-item-rating">{{Math.round(parseFloat(mostRecentRating(result).calculatedTotal))}}</p>
          </div>
        </a>
      </div>
    </div>
    <table
      v-if="!gridView"
      class="table table-hover table-striped"
      :class="inDarkMode ? 'table-dark' : 'table-light'"
    >
      <thead>
        <tr>
          <th scope="col-1">#</th>
          <th scope="col-4">Title</th>
          <th scope="col-4">Release</th>
          <th scope="col-2">Rating</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(result, index) in filteredResults" :key="index">
          <th class="col-1" scope="row">{{index + 1}}</th>
          <td class="col-4">{{result.movie.title}}</td>
          <td class="col-4">{{result.movie.release_date}}</td>
          <td class="col-2">{{parseFloat(mostRecentRating(result).calculatedTotal).toFixed(2)}}</td>
        </tr>
      </tbody>
    </table>
    <button
      v-if="showMoreButton"
      class="btn btn-secondary mb-5 mx-3 float-end"
      @click="addMoreResults"
    >
      More...
    </button>
  </div>
</template>

<script>
import { getRating } from "@/assets/javascript/GetRating";
import { getDatabase, ref, child, get } from "firebase/database";

export default {
  data () {
    return {
      shareObject: {},
      numberOfResultsToShow: 50,
      gridView: true
    }
  },
  async mounted () {
    this.$store.commit("setShowHeader", false);

    const userDBKey = this.$route.params.userDBKey;
    const shareKey = this.$route.params.shareKey;

    const shareObject = await get(child(ref(getDatabase()), `${userDBKey}/sharedDBSearches/${shareKey}`));
    if (shareObject.exists()) {
      this.shareObject = shareObject.val();
    } else {
      console.error('No share data');
    }
  },
  beforeRouteLeave () {
    this.$store.commit("setShowHeader", true);
  },
  computed: {
    inDarkMode () {
      return document.querySelector("body").classList.contains('bg-dark');
    },
    shareBannerUrl () {
      if (this.shareObject.results) {
        return `https://image.tmdb.org/t/p/original${this.shareObject.results[0].movie.backdrop_path}`;
      } else {
        return false;
      }
    },
    filteredResults () {
      if (!this.shareObject.results) {
        return [];
      }

      const filteredResults = this.shareObject.results.filter((result) => getRating(result));

      return filteredResults.slice(0, this.numberOfResultsToShow);
    },
    showMoreButton () {
      if (!this.shareObject.results) {
        return false;
      }

      return this.shareObject.results.length > this.numberOfResultsToShow;
    }
  },
  methods: {
    mostRecentRating (movie) {
      return getRating(movie);
    },
    addMoreResults () {
      this.numberOfResultsToShow = this.numberOfResultsToShow + 50;

      this.$nextTick(() => {
        window.scrollBy({
          top: 500,
          behavior: 'smooth'
        })
      });
    }
  },
}
</script>

<style lang="scss">
  .share-db-results {
    background-color: #3c3c3c;

    .share-header {
      position: relative;

      h1 {
        background-color: #000000a3;
        bottom: 0;
        position: absolute;
      }
    }

    .poster-grid {
      display: grid;
      grid-auto-flow: dense;
      grid-template-columns: repeat(4, 1fr);
      margin-bottom: 48px;

      .poster-frame-wrapper {
        padding: 4px;

        &:nth-child(-n+1) {
          grid-column: 1/3;
          grid-row: 1/3;
        }

        .poster-grid-item {
          background: #fff;
          border: 4px solid #000;
          display: block;
          padding: 3px;
          position: relative;

          .poster-grid-item-image {
            width: 100%;
          }

          .poster-grid-item-rating-ribbon {
            align-items: center;
            bottom: 5px;
            display: flex;
            justify-content: center;
            position: absolute;
            right: 1px;
            z-index: 1;

            svg {
              height: 30px;
              width: 30px;

              path {
                fill: #0064f6;
                stroke-width: 0.5px;
                stroke: #fff;
              }
            }

            .poster-grid-item-rating {
              color: #fff;
              font-size: .6rem;
              margin-bottom: 0;
              position: absolute;
              top: 5px;
            }
          }
        }
      }
    }
  }
</style>
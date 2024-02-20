<template>
  <div class="pick-media mx-auto">
    <ul class="p-0 d-flex justify-content-around flex-wrap">
      <li class="card shadow border" v-for="media in searchResults" :key="media.id" @click="rateMedia(media)">
        <img
          v-if="media.poster_path"
          class="card-img-top"
          :src="`https://image.tmdb.org/t/p/original${media.poster_path}`"
          align="center"
        >
        <img
          v-else
          class="card-img-top not-found"
          src="../assets/images/Image_not_available.png"
          align="center"
        >
        <p class="my-3 mx-1 card-text text-center" :title="getTitle(media)">
          {{truncate(getTitle(media))}}
          <br>
          {{getReleaseDate(media)}}
        </p>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  props: {
    quickPick: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  computed: {
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    searchResults () {
      if (this.quickPick) {
        return this.$store.state.newEntrySearchResults.slice(0, 3);
      } else {
        return this.$store.state.newEntrySearchResults;
      }
    }
  },
  methods: {
    rateMedia (media) {
      if (this.currentLogIsTVLog) {
        this.$store.commit('setTVShowToRate', media);
        this.$router.push('/rate-tv-show');
      } else {
        this.$store.commit('setMovieToRate', media);
        this.$router.push('/rate-movie');
      }
    },
    getTitle (media) {
      if (this.currentLogIsTVLog) {
        return media.name;
      } else {
        return media.title;
      }
    },
    getReleaseDate (media) {
      if (this.currentLogIsTVLog) {
        return media.first_air_date;
      } else {
        return media.release_date;
      }
    },
    truncate (string) {
      if (string.length > 15) {
        return `${string.substr(0, 13)}...`;
      } else {
        return string;
      }
    }
  },
}
</script>

<style lang="scss">
  .pick-media {
    max-width: 832px;

    ul {
      column-gap: 1rem;
      list-style: none;
      margin: 1rem 1rem 2rem;
      row-gap: 1rem;

      .card {
        border-radius: 4px;
        cursor: pointer;
        width: calc((100% - 2rem) / 3);

        .not-found {
          padding: 48px 0;
        }

        p {
          color: black;
          font-size: .75rem;
        }
      }
    }
  }
</style>
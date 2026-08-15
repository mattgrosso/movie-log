<template>
  <div class="media-result-grid mx-auto">
    <ul class="p-0 d-flex justify-content-around flex-wrap">
      <li class="card shadow border" v-for="media in mediaList" :key="media.id" @click="$emit('select', media)">
        <!-- Taste-match badge (Brian-survey D1): rendered only when the
             caller computed matchPct — search results never carry it. -->
        <span v-if="media.matchPct" class="match-badge">{{ media.matchPct }}% match</span>
        <img
          v-if="media.poster_path"
          class="card-img-top"
          :src="`https://image.tmdb.org/t/p/w500${media.poster_path}`"
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
// Pure presentational card grid for a list of TMDB search results - extracted
// out of PickMedia.vue so the reconciliation flow (ReconcilePlaceholder.vue,
// matching an offline placeholder rating against real TMDB results) can
// reuse the exact same rendering instead of a second, drifting copy.
// PickMedia.vue keeps its own navigation (setMovieToRate + push) as its
// @select handler; ReconcilePlaceholder.vue uses a different one.
export default {
  props: {
    mediaList: {
      type: Array,
      required: false,
      default: () => []
    },
    isTVShow: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  emits: ['select'],
  methods: {
    getTitle (media) {
      return this.isTVShow ? media.name : media.title;
    },
    getReleaseDate (media) {
      return this.isTVShow ? media.first_air_date : media.release_date;
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
  .media-result-grid {
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

.card {
  position: relative;
}

.match-badge {
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #3a3a3a;
  border-radius: 999px;
  color: #ffc107;
  font-size: 0.65rem;
  font-weight: 700;
  left: 6px;
  padding: 0.15rem 0.5rem;
  position: absolute;
  top: 6px;
  z-index: 2;
}
</style>

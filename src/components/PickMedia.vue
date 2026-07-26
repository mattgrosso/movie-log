<template>
  <MediaResultGrid :mediaList="displayList" :isTVShow="currentLogIsTVLog" @select="rateMedia" />
</template>

<script>
import MediaResultGrid from './MediaResultGrid.vue';

export default {
  components: { MediaResultGrid },
  props: {
    quickPick: {
      type: Boolean,
      required: false,
      default: false
    },
    mediaList: {
      type: Array,
      required: false,
      default: null
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
    },
    displayList () {
      if (this.mediaList && this.mediaList.length) {
        return this.mediaList;
      } else {
        return this.searchResults;
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
  },
}
</script>

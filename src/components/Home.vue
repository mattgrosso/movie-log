<template>
  <div class="home">
    <NewRatingSearch />
    <hr>
    <SearchDatabase @dBSearch="dBSearch"/>
    <hr>
    <QuickSearch @dBSearch="dBSearch"/>
  </div>
</template>

<script>
import NewRatingSearch from "./NewRatingSearch.vue";
import SearchDatabase from "./SearchDatabase.vue";
import QuickSearch from "./QuickSearch.vue";

export default {
  components: {
    NewRatingSearch,
    SearchDatabase,
    QuickSearch
  },
  methods: {
    dBSearch (value, sortValue) {
      this.$store.commit('setDBSearchValue', value);

      if (sortValue) {
        this.$store.commit('setDBSearchValue', sortValue);
      }

      this.$router.push('/db-search');
    }
  },
}
</script>
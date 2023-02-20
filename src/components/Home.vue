<template>
  <div class="home">
    <NewRatingSearch />
    <hr>
    <SearchDatabase/>
    <hr>
    <QuickSearch/>
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
  }
}
</script>

<style lang="scss">
  hr {
    border-top: 1px solid;
    margin: 0 10%;
    opacity: 0.3;
  }
</style>
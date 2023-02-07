<template>
  <div class="quick-search my-3 mx-3 mb-5">
    <label class="mb-3 text-center col-12">Quick Search</label>
    <ul class="p-0 d-flex justify-content-around flex-wrap">
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase(`y:${currentYear}`)">
          <span>{{currentYear}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase(`y:${currentYear - 1}`)">
          <span>{{currentYear - 1}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase(`y:${currentYear - 2}`)">
          <span>{{currentYear - 2}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase(`y:${currentYear - 3}`)">
          <span>{{currentYear - 3}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase(`y:${currentYear - 4}`)">
          <span>{{currentYear - 4}}</span>
        </button>
      </li>
      <li class="col-12"></li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('y:1970-1979')">
          <span>1970s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('y:1980-1989')">
          <span>1980s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('y:1990-1999')">
          <span>1990s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('y:2000-2010')">
          <span>2000s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('y:2010-2020')">
          <span>2010s</span>
        </button>
      </li>
      <li class="col-12"></li>
      <li class="col-5">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('')">
          <span>All</span>
        </button>
      </li>
      <li class="col-5">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('', 'watched')">
          <span>Recently Watched</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  computed: {
    currentYear () {
      return new Date().getFullYear();
    }
  },
  methods: {
    searchDatabase (searchTerm, sortValue) {
      this.$emit("dBSearch", searchTerm, sortValue);
    }
  },
}
</script>

<style lang="scss">
  .quick-search {
    ul {
      column-gap: 0.35rem;
      list-style: none;
      row-gap: 0.35rem;
    }
  }
</style>
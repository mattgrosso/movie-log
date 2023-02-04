<template>
  <div class="my-3 mx-3">
    <label class="mb-3 text-center col-12">Quick Search</label>
    <ul class="p-0 d-flex justify-content-around flex-wrap">
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase(currentYear)">
          <span>{{currentYear}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase(currentYear - 1)">
          <span>{{currentYear - 1}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase(currentYear - 2)">
          <span>{{currentYear - 2}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase(currentYear - 3)">
          <span>{{currentYear - 3}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase(currentYear - 4)">
          <span>{{currentYear - 4}}</span>
        </button>
      </li>
      <li class="col-12"></li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('1970s')">
          <span>1970s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('1980s')">
          <span>1980s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('1990s')">
          <span>1990s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('2000s')">
          <span>2000s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('2010s')">
          <span>2010s</span>
        </button>
      </li>
      <li class="col-12"></li>
      <li class="col-5">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('Dont Own')">
          <span>Don't Own</span>
        </button>
      </li>
      <li class="col-5">
        <button class="shadow-lg btn btn-secondary col-12" @click="searchDatabase('Recently Watched')">
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
    searchDatabase (searchTerm) {
      console.log('searchTerm: ', searchTerm);
      console.log("Search database and show search page");
    }
  },
}
</script>

<style lang="scss">
  ul {
    column-gap: 0.35rem;
    list-style: none;
    row-gap: 0.35rem;
  }
</style>
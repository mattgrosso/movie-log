<template>
  <div class="quick-search my-3 mx-3 mb-5">
    <label class="mb-3 text-center col-12">Quick Search</label>
    <ul class="p-0 d-flex justify-content-around flex-wrap">
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase(`y:${currentYear}`, 'rating')">
          <span>{{currentYear}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase(`y:${currentYear - 1}`, 'rating')">
          <span>{{currentYear - 1}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase(`y:${currentYear - 2}`, 'rating')">
          <span>{{currentYear - 2}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase(`y:${currentYear - 3}`, 'rating')">
          <span>{{currentYear - 3}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase(`y:${currentYear - 4}`, 'rating')">
          <span>{{currentYear - 4}}</span>
        </button>
      </li>
      <li class="col-12"></li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase('y:1970-1979', 'rating')">
          <span>1970s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase('y:1980-1989', 'rating')">
          <span>1980s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase('y:1990-1999', 'rating')">
          <span>1990s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase('y:2000-2010', 'rating')">
          <span>2000s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase('y:2010-2020', 'rating')">
          <span>2010s</span>
        </button>
      </li>
      <li class="col-12"></li>
      <li class="col-3">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase('annual', 'release', 'descending')">
          <span>Winners</span>
        </button>
      </li>
      <li class="col-3">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase('', 'rating', 'ascending')">
          <span>All</span>
        </button>
      </li>
      <li class="col-3">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase('', 'watched', 'ascending')">
          <span>Recent</span>
        </button>
      </li>
      <hr class="col-8 my-2">
      <li  v-for="(tag, index) in tags" :key="index">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase(`tag:'${tag.title}'`, 'rating', 'ascending')">
          <span>{{ tag.title }}</span>
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
    },
    settings () {
      return this.$store.state.settings;
    },
    tags () {
      if (!this.settings) {
        return [];
      }

      return this.settings.tags;
    },
  },
  methods: {
    searchDatabase (searchTerm, sortValue, sortOrder) {
      if (searchTerm) {
        this.$store.commit('setDBSearchValue', searchTerm);
      }

      if (sortValue) {
        this.$store.commit('setDBSortValue', sortValue);
      }

      if (sortOrder) {
        this.$store.commit('setDBSortOrder', sortOrder);
      }

      this.$router.push('/db-search');
    }
  }
}
</script>

<style lang="scss">
  hr {
    border-top: 1px solid;
    margin: 0 10%;
    opacity: 0.3;
  }

  .quick-search {
    ul {
      column-gap: 0.35rem;
      list-style: none;
      row-gap: 0.35rem;

      li {
        button {
          span {
            font-size: 0.75rem;
          }
        }
      }
    }
  }

  .bg-dark {
    .quick-search {
      ul {
        li {
          button {
            background-color: lightgray;

            span {
              color: black;
            }
          }
        }
      }
    }
  }
</style>
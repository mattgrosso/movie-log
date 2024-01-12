<template>
  <div class="quick-search my-3 mx-3 mb-5">
    <label class="mb-3 text-center col-12">Quick Search</label>
    <ul class="p-0 d-flex justify-content-around flex-wrap">
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: `${currentYear}`, searchType: 'year', sortValue: 'rating', sortOrder: null})">
          <span>{{currentYear}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: `${currentYear - 1}`, searchType: 'year', sortValue: 'rating', sortOrder: null})">
          <span>{{currentYear - 1}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: `${currentYear - 2}`, searchType: 'year', sortValue: 'rating', sortOrder: null})">
          <span>{{currentYear - 2}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: `${currentYear - 3}`, searchType: 'year', sortValue: 'rating', sortOrder: null})">
          <span>{{currentYear - 3}}</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: `${currentYear - 4}`, searchType: 'year', sortValue: 'rating', sortOrder: null})">
          <span>{{currentYear - 4}}</span>
        </button>
      </li>
      <li class="col-12"></li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: '70s', searchType: 'year', sortValue: 'rating', sortOrder: null})">
          <span>1970s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: '80s', searchType: 'year', sortValue: 'rating', sortOrder: null})">
          <span>1980s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: '90s', searchType: 'year', sortValue: 'rating', sortOrder: null})">
          <span>1990s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: '2000s', searchType: 'year', sortValue: 'rating', sortOrder: null})">
          <span>2000s</span>
        </button>
      </li>
      <li class="col-2">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: '2010s', searchType: 'year', sortValue: 'rating', sortOrder: null})">
          <span>2010s</span>
        </button>
      </li>
      <li class="col-12"></li>
      <li class="col-3">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: ' ', searchType: 'annual', sortValue: 'release', sortOrder: null})">
          <span>Winners</span>
        </button>
      </li>
      <li class="col-3">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: '', searchType: 'title', sortValue: 'rating', sortOrder: 'ascending'})">
          <span>All</span>
        </button>
      </li>
      <li class="col-3">
        <button class="shadow-lg btn btn-secondary col-12 d-flex justify-content-center" @click="searchDatabase({searchTerm: '', searchType: 'title', sortValue: 'watched', sortOrder: 'ascending'})">
          <span>Recent</span>
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
  },
  methods: {
    searchDatabase (config) {
      if (!config.searchTerm) {
        this.$store.commit('setDBSearchValue', '');
      }

      if (config.searchTerm) {
        this.$store.commit('setDBSearchValue', config.searchTerm);
      }

      if (config.searchType) {
        this.$store.commit('setDBSearchType', config.searchType);
      }

      if (config.sortValue) {
        this.$store.commit('setDBSortValue', config.sortValue);
      }

      if (config.sortOrder) {
        this.$store.commit('setDBSortOrder', config.sortOrder);
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
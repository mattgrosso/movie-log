<template>
  <div class="custom-lists">
    <BackLink label="Home" @click="$router.push('/')"/>
    <h1 class="cl-title">Your Lists</h1>
    <p class="cl-subtitle">Standing collections from your own library — comfort watches, the ones you show people, whatever you like.</p>

    <!-- Create -->
    <div class="cl-create">
      <input
        v-model="newListName"
        type="text"
        class="form-control cl-create-input"
        placeholder="Name a new list"
        maxlength="60"
        @keyup.enter="create"
      >
      <button type="button" class="btn btn-primary cl-create-button" :disabled="!newListName.trim() || creating" @click="create">
        <span v-if="creating" class="spinner-border spinner-border-sm" role="status"></span>
        <span v-else>Create</span>
      </button>
    </div>

    <p v-if="!lists.length" class="cl-empty">
      No lists yet. Name one above — then add movies from any movie's page, or from inside the list.
    </p>

    <div v-for="list in listCards" :key="list.id" class="cl-card" @click="$router.push(`/lists/${list.id}`)">
      <p class="cl-card-name">{{ list.name }}</p>
      <div class="cl-card-body">
        <div v-if="list.rows.length" class="cl-poster-row">
          <img
            v-for="row in list.rows.slice(0, 8)"
            :key="row.tmdbId"
            :src="poster(row.entry)"
            :alt="row.entry.movie.title"
            class="cl-poster"
          >
        </div>
        <p v-else class="cl-card-empty">Empty so far.</p>
        <p class="cl-card-stats">
          {{ list.stats.count }} film{{ list.stats.count === 1 ? '' : 's' }}
          <span v-if="list.stats.average"> · {{ list.stats.average.toFixed(2) }} average</span>
          <span v-if="list.stats.earliest"> · {{ list.stats.earliest }}–{{ list.stats.latest }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script>
// Custom Lists index (/lists). Brian-survey B1, approved 2026-08-15.
// All list logic is pure in customLists.js; this screen renders and
// dispatches. Fully offline — reads the library and settings from the store.
import BackLink from './games/BackLink.vue';
import { getRating } from '../assets/javascript/GetRating.js';
import { resolveListEntries, listStats } from '../assets/javascript/customLists.js';

export default {
  name: 'CustomListsScreen',
  components: { BackLink },
  data () {
    return {
      newListName: '',
      creating: false
    };
  },
  computed: {
    lists () {
      return this.$store.getters.customLists || [];
    },
    library () {
      return this.$store.getters.allMoviesAsArray || [];
    },
    listCards () {
      return this.lists.map((list) => {
        const { rows } = resolveListEntries(list, this.library, getRating);
        return { ...list, rows, stats: listStats(rows) };
      });
    }
  },
  methods: {
    poster (entry) {
      return `https://image.tmdb.org/t/p/w92${entry.movie.poster_path}`;
    },
    async create () {
      const name = this.newListName.trim();
      if (!name || this.creating) return;
      this.creating = true;
      try {
        const id = await this.$store.dispatch('createCustomList', name);
        this.newListName = '';
        if (id) this.$router.push(`/lists/${id}`);
      } finally {
        this.creating = false;
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.custom-lists {
  color: #eee;
  min-width: 0;
  padding: 0.75rem 1rem 72px;
  width: 100%;
}

.cl-title { margin: 0.25rem 0 0; }
.cl-subtitle { color: #ccc; font-size: 0.85rem; margin: 0.25rem 0 1rem; }
.cl-empty { color: #ccc; font-size: 0.85rem; }

.cl-create {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;

  .cl-create-input {
    background: #161616;
    border: 1px solid white;
    border-radius: 3px;
    color: white;
    min-width: 0;

    &::placeholder { color: #888; }
  }

  .cl-create-button {
    background: #3b5aaa;
    border: 1px solid white;
    border-radius: 3px;
    flex: 0 0 auto;
  }
}

/* House tile language: white border, blue name strip (see
   .insights-pane-item / the Insights rework). */
.cl-card {
  border: 1px solid white;
  border-radius: 3px;
  cursor: pointer;
  margin-bottom: 0.75rem;
  overflow: hidden;

  &:active { background: rgba(59, 90, 170, 0.25); }

  .cl-card-name {
    background: #3b5aaa;
    border-bottom: 1px solid white;
    color: white;
    font-size: 0.9rem;
    font-weight: 700;
    margin: 0;
    padding: 2px 8px;
    text-align: center;
  }

  .cl-card-body { padding: 0.5rem 0.6rem; }

  .cl-poster-row {
    align-items: flex-start;
    display: flex;
    gap: 0.3rem;
    overflow: hidden;
  }

  .cl-poster {
    border-radius: 3px;
    flex: 0 0 auto;
    height: 69px;
    object-fit: cover;
    width: 46px;
  }

  .cl-card-empty { color: #ccc; font-size: 0.8rem; margin: 0; }

  .cl-card-stats {
    color: #ccc;
    font-size: 0.75rem;
    margin: 0.35rem 0 0;
  }
}
</style>

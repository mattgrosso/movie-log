<template>
  <div class="list-detail">
    <BackLink label="Lists" @click="$router.push('/lists')"/>

    <p v-if="!list" class="ld-empty">That list no longer exists.</p>

    <template v-else>
      <input
        v-model="nameDraft"
        type="text"
        class="ld-name"
        maxlength="60"
        aria-label="List name"
        @change="saveName"
        @keyup.enter="saveName"
      >
      <p class="ld-stats">
        {{ stats.count }} film{{ stats.count === 1 ? '' : 's' }}
        <span v-if="stats.average"> · {{ stats.average.toFixed(2) }} average</span>
        <span v-if="stats.earliest"> · {{ stats.earliest }}–{{ stats.latest }}</span>
      </p>

      <!-- Add a movie from your library -->
      <div class="ld-add">
        <input
          v-model="query"
          type="text"
          class="form-control ld-add-input"
          placeholder="Add a movie from your library"
        >
        <div v-if="suggestions.length" class="suggestions">
          <button
            v-for="option in suggestions"
            :key="option.movie.id"
            type="button"
            class="suggestion"
            @click="add(option)"
          >
            <img v-if="option.movie.poster_path" :src="thumb(option)" :alt="option.movie.title" class="suggestion-poster">
            <span class="suggestion-title">{{ option.movie.title }}<span v-if="year(option)" class="suggestion-year"> ({{ year(option) }})</span></span>
          </button>
        </div>
      </div>

      <!-- Sort -->
      <div class="ld-sorts">
        <button
          v-for="mode in sortModes"
          :key="mode.key"
          type="button"
          class="ld-sort"
          :class="{ active: list.sortMode === mode.key }"
          @click="setSort(mode.key)"
        >
          {{ mode.label }}
        </button>
      </div>

      <p v-if="missing" class="ld-missing">
        {{ missing }} movie{{ missing === 1 ? ' is' : 's are' }} no longer in your library and won't show here.
        <button type="button" class="ld-prune" @click="prune">Remove {{ missing === 1 ? 'it' : 'them' }}</button>
      </p>

      <p v-if="!rows.length" class="ld-empty">Nothing in this list yet — add something above.</p>

      <div v-for="(row, index) in rows" :key="row.tmdbId" class="ld-row">
        <img
          v-if="row.entry.movie.poster_path"
          :src="thumb(row.entry)"
          :alt="row.entry.movie.title"
          class="ld-poster"
          @click="goToMovie(row)"
        >
        <div class="ld-row-info" @click="goToMovie(row)">
          <span class="ld-row-title">{{ row.entry.movie.title }}</span>
          <span class="ld-row-detail">
            <span v-if="year(row.entry)">{{ year(row.entry) }}</span>
            <span v-if="row.rating != null"> · {{ row.rating.toFixed(2) }}</span>
          </span>
        </div>
        <div class="ld-row-actions">
          <template v-if="list.sortMode === 'manual'">
            <button type="button" class="ld-action" :disabled="index === 0" aria-label="Move up" @click.stop="move(row, 'up')">
              <i class="bi bi-chevron-up"></i>
            </button>
            <button type="button" class="ld-action" :disabled="index === rows.length - 1" aria-label="Move down" @click.stop="move(row, 'down')">
              <i class="bi bi-chevron-down"></i>
            </button>
          </template>
          <button type="button" class="ld-action ld-remove" aria-label="Remove from list" @click.stop="remove(row)">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <button type="button" class="ld-delete" @click="confirmDelete">
        {{ confirmingDelete ? 'Tap again to delete this list' : 'Delete this list' }}
      </button>
    </template>
  </div>
</template>

<script>
// A single Custom List (/lists/:listId): rename, sort, add/remove, and
// hand-order. All list math is pure in customLists.js. Manual reorder uses
// up/down buttons rather than drag — this is a touch-first PWA and drag
// competes with page scrolling.
import BackLink from './games/BackLink.vue';
import { getRating } from '../assets/javascript/GetRating.js';
import { resolveListEntries, listStats, reorderUpdates, listContains, SORT_MODES } from '../assets/javascript/customLists.js';

export default {
  name: 'CustomListDetail',
  components: { BackLink },
  data () {
    return {
      nameDraft: '',
      query: '',
      confirmingDelete: false
    };
  },
  computed: {
    listId () {
      return this.$route.params.listId;
    },
    list () {
      return (this.$store.getters.customLists || []).find((candidate) => candidate.id === this.listId) || null;
    },
    library () {
      return this.$store.getters.allMoviesAsArray || [];
    },
    sortModes () {
      return SORT_MODES;
    },
    resolved () {
      if (!this.list) return { rows: [], missing: 0 };
      return resolveListEntries(this.list, this.library, getRating);
    },
    rows () {
      return this.resolved.rows;
    },
    missing () {
      return this.resolved.missing;
    },
    missingIds () {
      return this.resolved.missingIds || [];
    },
    stats () {
      return listStats(this.rows);
    },
    suggestions () {
      const term = this.query.trim().toLowerCase();
      if (term.length < 2 || !this.list) return [];
      const out = [];
      for (const entry of this.library) {
        if (out.length >= 8) break;
        const title = entry?.movie?.title || '';
        if (!title.toLowerCase().includes(term)) continue;
        if (listContains(this.list, entry.movie.id)) continue; // already in
        out.push(entry);
      }
      return out;
    }
  },
  watch: {
    list: {
      immediate: true,
      handler (list) {
        // Only seed the draft when it isn't being edited, so a live
        // settings echo can't yank text out from under the cursor.
        if (list && document.activeElement !== this.$el?.querySelector?.('.ld-name')) {
          this.nameDraft = list.name;
        }
      }
    }
  },
  methods: {
    thumb (entry) {
      return `https://image.tmdb.org/t/p/w92${entry.movie.poster_path}`;
    },
    year (entry) {
      const y = new Date(entry?.movie?.release_date ?? NaN).getFullYear();
      return Number.isFinite(y) ? y : null;
    },
    goToMovie (row) {
      this.$router.push(`/movie/${row.entry.movie.id}`);
    },
    saveName () {
      const name = this.nameDraft.trim();
      if (!name || !this.list || name === this.list.name) return;
      this.$store.dispatch('renameCustomList', { listId: this.listId, name });
    },
    setSort (sortMode) {
      this.$store.dispatch('setCustomListSort', { listId: this.listId, sortMode });
    },
    add (entry) {
      this.$store.dispatch('addToCustomList', { listId: this.listId, tmdbId: entry.movie.id });
      this.query = '';
    },
    prune () {
      if (!this.missingIds.length) return;
      this.$store.dispatch('pruneCustomList', { listId: this.listId, tmdbIds: this.missingIds });
    },
    remove (row) {
      this.$store.dispatch('removeFromCustomList', { listId: this.listId, tmdbId: row.tmdbId });
    },
    move (row, direction) {
      const updates = reorderUpdates(this.rows, row.tmdbId, direction);
      if (Object.keys(updates).length) {
        this.$store.dispatch('applyCustomListOrder', { listId: this.listId, updates });
      }
    },
    confirmDelete () {
      if (!this.confirmingDelete) {
        this.confirmingDelete = true;
        setTimeout(() => { this.confirmingDelete = false; }, 4000);
        return;
      }
      this.$store.dispatch('deleteCustomList', this.listId);
      this.$router.push('/lists');
    }
  }
};
</script>

<style lang="scss" scoped>
.list-detail {
  color: #eee;
  min-width: 0;
  padding: 0.75rem 1rem 72px;
  width: 100%;
}

.ld-name {
  background: none;
  border: none;
  border-bottom: 1px solid #444;
  color: white;
  font-size: 1.5rem;
  font-weight: 700;
  padding: 0.15rem 0;
  width: 100%;

  &:focus {
    border-bottom-color: #3b5aaa;
    outline: none;
  }
}

.ld-stats { color: #ccc; font-size: 0.8rem; margin: 0.35rem 0 0.75rem; }
.ld-empty { color: #ccc; font-size: 0.85rem; }

.ld-prune {
  background: none;
  border: none;
  color: #9ec5fe;
  padding: 0 0 0 0.35rem;
  text-decoration: underline;
}
.ld-missing { color: #ccc; font-size: 0.75rem; margin: 0.5rem 0 0; }

.ld-add {
  margin-bottom: 0.75rem;
  position: relative;

  .ld-add-input {
    background: #161616;
    border: 1px solid white;
    border-radius: 3px;
    color: white;

    &::placeholder { color: #888; }
  }

  /* Panel styling lives on .suggestions; rows stay transparent (house
     typeahead rule — bordered rows read as a stack of separate boxes). */
  .suggestions {
    background: #161616;
    border: 1px solid white;
    border-radius: 3px;
    left: 0;
    max-height: 260px;
    overflow-y: auto;
    position: absolute;
    right: 0;
    top: calc(100% + 2px);
    z-index: 20;
  }

  .suggestion {
    align-items: center;
    background: none;
    border: none;
    color: white;
    display: flex;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    text-align: left;
    width: 100%;

    &:active { background: rgba(59, 90, 170, 0.35); }
  }

  .suggestion-poster { border-radius: 3px; flex: 0 0 auto; height: 48px; object-fit: cover; width: 32px; }
  .suggestion-title { min-width: 0; overflow-wrap: anywhere; }
  .suggestion-year { color: #ccc; }
}

.ld-sorts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0.75rem;

  .ld-sort {
    background: none;
    border: 1px solid white;
    border-radius: 999px;
    color: white;
    font-size: 0.75rem;
    min-height: 34px;
    padding: 0.2rem 0.7rem;

    &.active { background: #3b5aaa; }
    &:active { opacity: 0.7; }
  }
}

.ld-row {
  align-items: center;
  border-top: 1px solid #2e2e2e;
  display: flex;
  gap: 0.6rem;
  padding: 0.4rem 0;

  &:first-of-type { border-top: none; }
}

.ld-poster {
  border-radius: 3px;
  cursor: pointer;
  flex: 0 0 auto;
  height: 69px;
  object-fit: cover;
  width: 46px;
}

.ld-row-info {
  cursor: pointer;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.ld-row-title { font-weight: 600; overflow-wrap: anywhere; }
.ld-row-detail { color: #ccc; font-size: 0.75rem; }

.ld-row-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 0.25rem;
}

.ld-action {
  align-items: center;
  background: none;
  border: 1px solid #444;
  border-radius: 3px;
  color: white;
  display: flex;
  height: 40px;
  justify-content: center;
  width: 34px;

  &:disabled { opacity: 0.3; }
  &:active { background: rgba(59, 90, 170, 0.35); }
}

.ld-remove { border-color: #7a3b3b; }

.ld-delete {
  background: none;
  border: 1px solid #7a3b3b;
  border-radius: 3px;
  color: #e88;
  margin-top: 1.5rem;
  min-height: 44px;
  width: 100%;

  &:active { background: rgba(122, 59, 59, 0.35); }
}
</style>

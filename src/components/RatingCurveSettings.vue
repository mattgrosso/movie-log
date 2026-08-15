<template>
  <div class="rating-curve-settings">
    <h6 class="curve-title">Rating Curve</h6>
    <p class="curve-explainer">
      Anchor the scale with your own movies. Everything else stretches to fit.
    </p>

    <div class="anchor-slots">
      <div v-for="slot in slots" :key="slot.key" class="anchor-slot">
        <span class="anchor-label">{{ slot.label }}</span>

        <template v-if="anchorEntry(slot.key)">
          <img
            class="anchor-poster"
            :src="posterUrl(anchorEntry(slot.key))"
            :alt="anchorEntry(slot.key).movie.title"
            @click="openPicker(slot.key)"
          >
          <span class="anchor-movie-title">{{ anchorEntry(slot.key).movie.title }}</span>
          <button type="button" class="anchor-clear" @click="clearAnchor(slot.key)">Clear</button>
        </template>

        <button
          v-else
          type="button"
          class="anchor-choose"
          :disabled="slot.key === 'five' && !anchors.ten"
          @click="openPicker(slot.key)"
        >
          <i class="bi bi-plus-lg"></i>
          <span>{{ slot.key === 'five' && !anchors.ten ? 'Pick a 10 first' : 'Choose a movie' }}</span>
        </button>
      </div>
    </div>

    <div v-if="picking" class="anchor-picker">
      <input
        ref="pickerSearch"
        v-model="pickerQuery"
        type="search"
        class="form-control picker-search"
        :placeholder="picking === 'ten' ? 'Search for your last true 10…' : 'Search for your lowest 5…'"
      >
      <div class="picker-results">
        <div
          v-for="candidate in pickerCandidates"
          :key="candidate.dbKey"
          class="picker-card"
          @click="chooseAnchor(candidate)"
        >
          <img class="picker-poster" :src="posterUrl(candidate)" :alt="candidate.movie.title">
          <span class="picker-name">{{ candidate.movie.title }}</span>
        </div>
        <p v-if="!pickerCandidates.length" class="picker-empty">
          No eligible matches{{ picking === 'five' ? ' (must score below your 10 anchor)' : '' }}.
        </p>
      </div>
      <button type="button" class="picker-cancel" @click="picking = null">Cancel</button>
    </div>

    <div v-if="!anchors.ten" class="manual-offset">
      <label for="normalizationTweak" class="manual-label">Manual offset (no anchors set):</label>
      <input
        type="number"
        class="form-control"
        id="normalizationTweak"
        v-model.number="manualTweak"
        min="0"
        max="1"
        step="0.01"
        @change="saveManualTweak"
      >
    </div>
  </div>
</template>

<script>
// The normalization control as a first-order settings section (feedback:
// "have it show posters instead of a list... its own little first order
// thing"). Two movie anchors define the display curve — "This is a 10"
// (ceiling/slope) and "My lowest 5" (pivot) — resolved in GetRating.js via
// applyNormalization. Anchors are dbKeys in settings.normalizationAnchors,
// so re-rating an anchor movie updates the curve automatically. The legacy
// numeric offset remains as the fallback control when no anchor is chosen.
import { getRating } from '../assets/javascript/GetRating.js';

export default {
  name: 'RatingCurveSettings',
  data () {
    return {
      picking: null, // 'ten' | 'five' | null
      pickerQuery: '',
      manualTweak: this.$store.state.settings?.normalizationTweak ?? 0.25,
      slots: [
        { key: 'ten', label: 'This is a 10' },
        { key: 'five', label: 'My lowest 5' }
      ]
    };
  },
  computed: {
    anchors () {
      return this.$store.state.settings?.normalizationAnchors || {};
    },
    library () {
      return this.$store.getters.allMoviesAsArray || [];
    },
    ratedLibrary () {
      return this.library
        .map((entry) => ({ ...entry, curveTotal: getRating(entry)?.calculatedTotal }))
        .filter((entry) => Number.isFinite(entry.curveTotal));
    },
    tenAnchorTotal () {
      const entry = this.anchorEntry('ten');
      return entry ? getRating(entry)?.calculatedTotal : null;
    },
    pickerCandidates () {
      const query = this.pickerQuery.trim().toLowerCase();
      let pool = this.ratedLibrary;

      // The five-anchor must sit below the ten-anchor or the curve inverts.
      if (this.picking === 'five' && Number.isFinite(this.tenAnchorTotal)) {
        pool = pool.filter((entry) => entry.curveTotal < this.tenAnchorTotal);
      }
      if (query) {
        pool = pool.filter((entry) => (entry.movie.title || '').toLowerCase().includes(query));
      }
      return [...pool].sort((a, b) => b.curveTotal - a.curveTotal).slice(0, 24);
    }
  },
  methods: {
    anchorEntry (key) {
      const dbKey = this.anchors[key];
      if (!dbKey) return null;
      return this.library.find((entry) => entry.dbKey === dbKey) || null;
    },
    posterUrl (entry) {
      return entry.movie.poster_path
        ? `https://image.tmdb.org/t/p/w185${entry.movie.poster_path}`
        : '';
    },
    openPicker (key) {
      this.picking = key;
      this.pickerQuery = '';
      this.$nextTick(() => this.$refs.pickerSearch?.focus?.());
    },
    chooseAnchor (candidate) {
      this.$store.dispatch('writeDurably', {
        path: `settings/normalizationAnchors/${this.picking}`,
        value: candidate.dbKey
      });
      this.picking = null;
    },
    clearAnchor (key) {
      this.$store.dispatch('writeDurably', {
        path: `settings/normalizationAnchors/${key}`,
        value: null
      });
      // A cleared 10 makes a dangling 5 meaningless — clear it too.
      if (key === 'ten' && this.anchors.five) {
        this.$store.dispatch('writeDurably', {
          path: 'settings/normalizationAnchors/five',
          value: null
        });
      }
    },
    saveManualTweak () {
      this.$store.dispatch('writeDurably', {
        path: 'settings/normalizationTweak',
        value: this.manualTweak
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.rating-curve-settings {
  background: #161616;
  border: 1px solid #2e2e2e;
  border-radius: 10px;
  margin-bottom: 1rem;
  padding: 0.9rem 1rem;
}

.curve-title {
  color: #eee;
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.curve-explainer {
  color: #ccc;
  font-size: 0.78rem;
  margin-bottom: 0.9rem;
}

.anchor-slots {
  display: flex;
  gap: 1rem;
}

.anchor-slot {
  align-items: center;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  row-gap: 0.4rem;
}

.anchor-label {
  color: #eee;
  font-size: 0.8rem;
  font-weight: 600;
}

.anchor-poster {
  border: 1px solid #2e2e2e;
  border-radius: 6px;
  height: 138px;
  object-fit: cover;
  width: 92px;
}

.anchor-poster:active {
  opacity: 0.7;
}

.anchor-movie-title {
  color: #ccc;
  font-size: 0.75rem;
  line-height: 1.25;
  text-align: center;
}

.anchor-clear {
  background: none;
  border: none;
  color: #999;
  font-size: 0.72rem;
  min-height: 32px;
  text-decoration: underline;
}

.anchor-choose {
  align-items: center;
  background: #101010;
  border: 1px dashed #3a3a3a;
  border-radius: 6px;
  color: #999;
  display: flex;
  flex-direction: column;
  font-size: 0.72rem;
  height: 138px;
  justify-content: center;
  row-gap: 0.4rem;
  width: 92px;

  &:active {
    background: #1f1f1f;
  }

  &:disabled {
    opacity: 0.5;
  }
}

.anchor-picker {
  margin-top: 1rem;
}

.picker-search {
  background: #101010;
  border-color: #3a3a3a;
  color: #eee;
  margin-bottom: 0.6rem;
  min-width: 0;

  &::placeholder {
    color: #888;
  }

  &:focus {
    background: #101010;
    border-color: #666;
    box-shadow: none;
    color: #eee;
  }
}

.picker-results {
  align-items: flex-start;
  display: flex;
  gap: 0.6rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;
}

.picker-card {
  cursor: pointer;
  flex: 0 0 92px;
  width: 92px;
}

.picker-card:active .picker-poster {
  opacity: 0.7;
}

.picker-poster {
  border: 1px solid #2e2e2e;
  border-radius: 6px;
  display: block;
  height: 138px;
  object-fit: cover;
  width: 92px;
}

.picker-name {
  color: #ccc;
  display: block;
  font-size: 0.7rem;
  line-height: 1.25;
  margin-top: 0.3rem;
  text-align: center;
}

.picker-empty {
  color: #999;
  font-size: 0.78rem;
}

.picker-cancel {
  background: none;
  border: none;
  color: #999;
  font-size: 0.75rem;
  min-height: 36px;
  text-decoration: underline;
}

.manual-offset {
  margin-top: 0.75rem;

  .manual-label {
    color: #ccc;
    display: block;
    font-size: 0.75rem;
    margin-bottom: 0.3rem;
  }

  .form-control {
    background: #101010;
    border-color: #3a3a3a;
    color: #eee;
    min-width: 0;
  }
}
</style>

<template>
  <div class="rating-curve-settings">
    <p class="curve-explainer">
      Anchor the scale with your own movies: your lowest rated 10, and your
      dead-average 5. Everything else stretches to fit.
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
        :placeholder="picking === 'ten' ? 'Search for your lowest rated 10…' : 'Search, or pick from your middle…'"
      >
      <p v-if="picking === 'five' && !pickerQuery.trim()" class="picker-hint">
        The middle of your library — scroll either way until one feels dead
        average. Half of everything you've rated will land above it, half below.
      </p>
      <div ref="pickerResults" class="picker-results" @scroll.passive="onPickerScroll">
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

    <!-- What these two anchors actually do to the library. Both halves update
         live as an anchor moves, which is the loop this exists for — pick,
         look, adjust. -->
    <div v-if="curveRows.length" class="curve-ladder">
      <h4 class="ladder-heading">How your library lands</h4>

      <p v-if="lowShare >= 40" class="ladder-warning">
        {{ lowShare }}% of your library rates 4 or below. Your "This is a 5" pick sets
        that floor: everything scoring under it has to land lower.
      </p>

      <!-- The shape, always on: it's one glance and it's the thing that
           answers "does this feel skewed?". The 11-row table behind it is
           reference, so it collapses. -->
      <div class="curve-chart">
        <LineChart :chartData="curveChartData" :options="curveChartOptions"/>
      </div>
      <p class="chart-explainer">
        How many movies land at each rating. Grey is the shape your actual scores make;
        orange is the shape the curve forces them into. Where orange sits left of grey,
        the curve is marking your library down.
      </p>

      <button
        type="button"
        class="ladder-toggle"
        :aria-expanded="showLadder ? 'true' : 'false'"
        @click="showLadder = !showLadder"
      >
        <i :class="showLadder ? 'bi bi-chevron-down' : 'bi bi-chevron-right'"></i>
        <span>Movie at each rating</span>
      </button>

      <div v-if="showLadder" class="ladder-body">
        <p class="ladder-explainer">
          Every row is the <strong>lowest-scoring movie that still earns that number</strong> —
          the one sitting right on the line. If a row feels wrong, move an anchor.
        </p>

        <table class="ladder-table">
          <thead>
            <tr>
              <th scope="col" class="ladder-col-grade">Rating</th>
              <th scope="col" class="ladder-col-count">Movies</th>
              <th scope="col">Lowest movie at that rating</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in curveRows" :key="row.grade" :class="{ 'is-anchor': isAnchorRow(row) }">
              <td class="ladder-grade">{{ row.grade }}</td>
              <td class="ladder-count">{{ row.count }}</td>
              <td class="ladder-film">
                <span class="ladder-title">{{ row.lowest.entry.movie.title }}</span>
                <span class="ladder-score">
                  scored {{ formatScore(row.lowest.total) }}, curves to {{ formatScore(row.lowest.value) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <p class="ladder-footnote">
          "Curves to" is the number before rounding — 4.30 becomes a 4. Your raw scores
          don't spread evenly over 0–10, so the middle of your library sits higher than
          you'd expect.
        </p>
      </div>
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
import { initialPickerWindow } from '../assets/javascript/normalizationPicker.js';
import { curveLadder, curveDistribution, shareAtOrBelow } from '../assets/javascript/curvePreview.js';
import { Chart, registerables } from 'chart.js';
import { LineChart } from 'vue-chart-3';
import { formatScore } from '../assets/javascript/formatScore.js';

Chart.register(...registerables);

export default {
  name: 'RatingCurveSettings',
  components: { LineChart },
  data () {
    return {
      picking: null, // 'ten' | 'five' | null
      showLadder: false, // the per-rating table is reference, not a default view
      pickerQuery: '',
      windowStart: 0, // lazy-loading window into pickerPool
      windowEnd: 0,
      manualTweak: this.$store.state.settings?.normalizationTweak ?? 0.25,
      slots: [
        { key: 'ten', label: 'My lowest rated 10' },
        { key: 'five', label: 'This is a 5' }
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
    fiveAnchorTotal () {
      const entry = this.anchorEntry('five');
      return entry ? getRating(entry)?.calculatedTotal : null;
    },
    // The curve as real movies, recomputed whenever an anchor moves. Anchor
    // TOTALS go in, not bases — curveLadder derives the library's min/max
    // itself so this can't drift out of step with GetRating.js.
    curveRows () {
      return curveLadder(
        this.ratedLibrary.map((entry) => ({ entry, total: entry.curveTotal })),
        {
          tenTotal: this.tenAnchorTotal,
          fiveTotal: this.fiveAnchorTotal,
          tweak: this.manualTweak,
          // So a row whose score TIES an anchor names the anchor itself —
          // twelve of his films score exactly 5.78, and the 5 row has to say
          // the movie he picked or the table can't confirm anything.
          anchorKeys: [this.anchors.ten, this.anchors.five]
        }
      );
    },
    // The sentence that actually explained the surprise: naming a mid-library
    // film "my lowest 5" declares everything under it a 4 or worse, and that
    // was 43% of the library without anything saying so.
    lowShare () {
      return shareAtOrBelow(this.curveRows, 4);
    },
    curvePoints () {
      return curveDistribution(
        this.ratedLibrary.map((entry) => ({ entry, total: entry.curveTotal })),
        {
          tenTotal: this.tenAnchorTotal,
          fiveTotal: this.fiveAnchorTotal,
          tweak: this.manualTweak
        }
      );
    },
    curveChartData () {
      return {
        labels: this.curvePoints.map((point) => point.rating),
        datasets: [
          {
            label: 'Your real ratings',
            data: this.curvePoints.map((point) => point.actual),
            borderColor: '#9a9a9a',
            backgroundColor: 'rgba(154, 154, 154, 0.15)',
            borderDash: [5, 4],
            borderWidth: 2,
            fill: true,
            pointRadius: 2,
            tension: 0.35
          },
          {
            label: 'After the curve',
            data: this.curvePoints.map((point) => point.adjusted),
            borderColor: '#e8833a',
            backgroundColor: 'rgba(232, 131, 58, 0.15)',
            borderWidth: 2.5,
            fill: true,
            pointRadius: 2,
            tension: 0.35
          }
        ]
      };
    },
    curveChartOptions () {
      return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            display: true,
            labels: { color: '#ccc', boxWidth: 14, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              title: (items) => `Rated ${items[0].label}`,
              label: (item) => `${item.dataset.label}: ${item.parsed.y} movies`
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true, text: 'Rating', color: '#ccc', font: { size: 10 }
            },
            ticks: { color: '#ccc', font: { size: 9 } },
            grid: { color: '#2a2a2a' }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true, text: 'Movies', color: '#ccc', font: { size: 10 }
            },
            ticks: { color: '#ccc', font: { size: 9 }, maxTicksLimit: 5 },
            grid: { color: '#2a2a2a' }
          }
        }
      };
    },
  },
  watch: {
    pickerQuery () {
      this.resetPickerWindow();
    }
  },
  methods: {
    resetPickerWindow () {
      // Five-picker with no query opens CENTERED on the rank-median; the
      // ten-picker (and any search) opens at the top.
      const centered = this.picking === 'five' && !this.pickerQuery.trim();
      const { start, end } = initialPickerWindow(this.pickerPool.length, { centered, size: centered ? 21 : 24 });
      this.windowStart = start;
      this.windowEnd = end;
      this.$nextTick(() => {
        const el = this.$refs.pickerResults;
        if (el) el.scrollLeft = 0;
      });
    },
    onPickerScroll () {
      const el = this.$refs.pickerResults;
      if (!el) return;

      // Nearing the right edge: extend deeper into the ranks.
      if (el.scrollWidth - el.scrollLeft - el.clientWidth < 300 && this.windowEnd < this.pickerPool.length) {
        this.windowEnd = Math.min(this.pickerPool.length, this.windowEnd + 20);
      }

      // Nearing the left edge (five-picker upward): prepend, then compensate
      // scrollLeft so the content doesn't jump under the finger.
      if (el.scrollLeft < 300 && this.windowStart > 0) {
        const widthBefore = el.scrollWidth;
        this.windowStart = Math.max(0, this.windowStart - 20);
        this.$nextTick(() => {
          el.scrollLeft += el.scrollWidth - widthBefore;
        });
      }
    },
    formatScore,
    isAnchorRow (row) {
      const dbKey = row?.lowest?.entry?.dbKey;
      return Boolean(dbKey) && (dbKey === this.anchors.ten || dbKey === this.anchors.five);
    },
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
      this.resetPickerWindow();
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
/* Lives inside a SettingsSection now, which supplies the card chrome and
   the heading — a second border and title here would just double it up. */
.rating-curve-settings {
  margin-bottom: 1rem;
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

.picker-hint {
  color: #ccc;
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
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

/* The curve ladder. Deliberately plain: this is a reference table people read
   top to bottom, so the only emphasis is the rating itself and the anchor
   rows. Contrast checked against the #4a4a4a settings panel — #ccc, never
   Bootstrap's .text-muted (vue-ui rule). */
.curve-ladder {
  border-top: 1px solid #3a3a3a;
  margin-top: 1.25rem;
  padding-top: 1rem;
}

.ladder-heading {
  color: #eee;
  font-size: 0.9rem;
  margin-bottom: 0.35rem;
}

.ladder-explainer {
  color: #ccc;
  font-size: 0.78rem;
  margin-bottom: 0.6rem;
}

.ladder-warning {
  background: #2e2e2e;
  border-radius: 6px;
  color: #ffd479;
  font-size: 0.78rem;
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.6rem;
}

/* Wide content scrolls in its own container so the page body never scrolls
   sideways (vue-ui rule). */
.ladder-table {
  border-collapse: collapse;
  color: #eee;
  font-size: 0.8rem;
  width: 100%;

  th {
    border-bottom: 1px solid #3a3a3a;
    color: #ccc;
    font-size: 0.7rem;
    font-weight: 600;
    padding-bottom: 0.3rem;
    text-align: left;
    text-transform: uppercase;
  }

  td {
    border-bottom: 1px solid #2a2a2a;
    padding: 0.45rem 0.35rem 0.45rem 0;
    vertical-align: top;
  }

  tr.is-anchor td {
    background: #2e2e2e;
  }
}

.ladder-col-grade { width: 3.2rem; }
.ladder-col-count { width: 3.6rem; }

.ladder-grade {
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
}

.ladder-count {
  color: #ccc;
}

/* Titles wrap to as many lines as they need — never clamped (vue-ui rule). */
.ladder-film {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.ladder-title {
  color: #eee;
}

.ladder-score {
  color: #ccc;
  font-size: 0.72rem;
}

.ladder-footnote {
  color: #ccc;
  font-size: 0.72rem;
  margin-top: 0.6rem;
}

.curve-chart {
  /* maintainAspectRatio is off, so the canvas needs a height from CSS. A
     percentage height here would silently do nothing (vue-ui rule). */
  height: 190px;
  margin-bottom: 0.4rem;
}

.chart-explainer {
  color: #ccc;
  font-size: 0.72rem;
  margin-bottom: 0.75rem;
}

/* Accordion header. Full width and 44px tall so it's a comfortable tap
   (40px minimum, vue-ui rule), and :active rather than :hover — a tapped
   element keeps :hover on iOS with no mouse to leave it. */
.ladder-toggle {
  align-items: center;
  background: #2e2e2e;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  color: #eee;
  display: flex;
  font-size: 0.8rem;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0 0.7rem;
  text-align: left;
  width: 100%;

  &:active {
    background: #383838;
  }

  .bi {
    color: #ccc;
    font-size: 0.75rem;
  }
}

.ladder-body {
  padding-top: 0.75rem;
}
</style>

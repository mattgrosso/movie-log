<template>
  <div class="connections-game">
    <BackLink label="Games" @click="$router.push('/games')"/>
    <h1 class="game-title">Connections</h1>

    <div v-if="!puzzle" class="not-enough-movies">
      <p>Not enough rated movies with shared directors/genres/decades/cast/keywords yet to build a puzzle. Rate a few more and try again.</p>
    </div>

    <template v-else>
      <p class="game-subtitle">Find four groups of four. {{ mistakes }} mistake{{ mistakes === 1 ? '' : 's' }} so far.</p>

      <p class="category-legend">
        Categories can be:
        <span v-for="kind in categoryKinds" :key="kind.kind" class="legend-chip" :style="{ color: kind.color }">{{ kind.label }}</span>
      </p>

      <div class="solved-groups">
        <div v-for="category in solvedCategories" :key="category.label" class="solved-group" :style="{ borderColor: category.difficulty?.color }">
          <div class="solved-group-label" :style="{ color: category.difficulty?.color }">{{ category.label }}</div>
          <div class="solved-group-tiles">
            <div v-for="tile in category.tiles" :key="tile.key" class="solved-tile">
              <img v-if="gamePosterUrl(tile.entry)" :src="gamePosterUrl(tile.entry)" :alt="tile.entry.movie.title">
            </div>
          </div>
        </div>
      </div>

      <div v-if="status === 'playing'" class="tile-grid">
        <button
          v-for="tile in remainingTiles"
          :key="tile.key"
          type="button"
          class="tile"
          :class="{ selected: selectedKeys.includes(tile.key) }"
          @click="toggleTile(tile.key)"
        >
          <img v-if="gamePosterUrl(tile.entry)" :src="gamePosterUrl(tile.entry)" :alt="tile.entry.movie.title">
          <span
            v-if="tileHints[tile.key]"
            class="tile-hint-badge"
            :style="{ backgroundColor: tileHints[tile.key].color }"
          >{{ tileHints[tile.key].number }}</span>
        </button>
      </div>

      <p v-if="status === 'playing'" class="guess-feedback" :class="{ 'is-empty': !lastGuessFeedback }">{{ lastGuessFeedback || ' ' }}</p>

      <div v-if="status === 'playing'" class="game-actions">
        <button type="button" class="btn-game btn-game-secondary btn-game-sm" :disabled="selectedKeys.length === 0" @click="deselectAll">Deselect</button>
        <button type="button" class="btn-game btn-game-primary btn-game-sm" :disabled="selectedKeys.length !== 4" @click="submitGuess">Submit</button>
      </div>

      <div v-else class="result-banner won">
        <p>Solved it in {{ mistakes }} mistake{{ mistakes === 1 ? '' : 's' }}!</p>
        <button type="button" class="btn-game btn-game-primary btn-game-sm mt-2 full-width" @click="start">New Puzzle</button>
      </div>
    </template>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { generateConnectionsPuzzle, CATEGORY_KIND_LABELS } from '../../assets/javascript/games/connectionsGenerator.js';

export default {
  name: 'ConnectionsGame',
  components: { BackLink },
  mixins: [gameDataMixin],
  data () {
    return {
      puzzle: null,
      solvedLabels: [],
      selectedKeys: [],
      mistakes: 0,
      lastGuessFeedback: null,
      categoryKinds: CATEGORY_KIND_LABELS,
      // Discovered-but-not-yet-solved category tracking (bug report: "tell
      // me WHICH two were in a group, sort of label them" instead of just a
      // count). categoryHintNumbers assigns each category a stable 1-4 label
      // the first time a wrong guess reveals 2+ of its members together;
      // tileHints denormalizes that onto individual tile keys so the
      // template can render a badge without a reverse lookup.
      categoryHintNumbers: {},
      tileHints: {}
    };
  },
  computed: {
    solvedCategories () {
      if (!this.puzzle) return [];
      return this.puzzle.categories
        .filter((category) => this.solvedLabels.includes(category.label))
        .map((category) => ({
          label: category.label,
          difficulty: category.difficulty,
          tiles: category.keys
            .map((key) => {
              const tile = this.puzzle.tiles.find((t) => t.key === key);
              return tile ? { key, entry: tile.entry } : null;
            })
            .filter(Boolean)
        }));
    },
    remainingTiles () {
      if (!this.puzzle) return [];
      const solvedKeys = new Set(this.solvedCategories.flatMap((c) => this.puzzle.categories.find((cat) => cat.label === c.label).keys));
      return this.puzzle.tiles.filter((tile) => !solvedKeys.has(tile.key));
    },
    // No loss state anymore (bug report: "get rid of the limited number of
    // guesses") — status is just 'playing' until every category is solved.
    status () {
      if (!this.puzzle) return 'playing';
      if (this.solvedLabels.length === this.puzzle.categories.length) return 'won';
      return 'playing';
    }
  },
  created () {
    this.start();
  },
  methods: {
    start () {
      this.puzzle = generateConnectionsPuzzle(this.eligibleGameEntries, Math.random);
      this.solvedLabels = [];
      this.selectedKeys = [];
      this.mistakes = 0;
      this.lastGuessFeedback = null;
      this.categoryHintNumbers = {};
      this.tileHints = {};
    },
    toggleTile (key) {
      if (this.status !== 'playing') return;
      this.lastGuessFeedback = null;
      if (this.selectedKeys.includes(key)) {
        this.selectedKeys = this.selectedKeys.filter((k) => k !== key);
        return;
      }
      if (this.selectedKeys.length >= 4) return;
      this.selectedKeys = [...this.selectedKeys, key];
    },
    deselectAll () {
      this.selectedKeys = [];
    },
    submitGuess () {
      if (this.selectedKeys.length !== 4) return;

      const matchingCategory = this.puzzle.categories.find((category) => {
        return category.keys.length === 4 && this.selectedKeys.every((key) => category.keys.includes(key));
      });

      if (matchingCategory) {
        this.solvedLabels = [...this.solvedLabels, matchingCategory.label];
        this.lastGuessFeedback = null;
      } else {
        this.mistakes += 1;
        // Find the SPECIFIC category (not just a count) with the largest
        // overlap against this guess, and permanently label those tiles —
        // per bug report, "say which two were in a group together... I could
        // group those two together, figure out what else goes with them."
        const overlaps = this.puzzle.categories.map((category) => ({
          category,
          keys: this.selectedKeys.filter((key) => category.keys.includes(key))
        }));
        const best = overlaps.reduce((a, b) => (b.keys.length > a.keys.length ? b : a), { keys: [] });

        if (best.keys.length >= 2) {
          let hintNumber = this.categoryHintNumbers[best.category.label];
          if (!hintNumber) {
            hintNumber = Object.keys(this.categoryHintNumbers).length + 1;
            this.categoryHintNumbers = { ...this.categoryHintNumbers, [best.category.label]: hintNumber };
          }
          const color = best.category.difficulty?.color;
          const newTileHints = { ...this.tileHints };
          best.keys.forEach((key) => { newTileHints[key] = { number: hintNumber, color }; });
          this.tileHints = newTileHints;
          this.lastGuessFeedback = `${best.keys.length} of those share group ${hintNumber} — now labeled below.`;
        } else {
          this.lastGuessFeedback = "Not even a pair in there — try a different mix.";
        }
      }
      this.selectedKeys = [];
    }
  }
};
</script>

<style lang="scss" scoped>
@import '@/assets/scss/game-buttons';

.connections-game {
  color: #eee;
  min-height: 100vh;
  // top padding is a safety margin, not decoration — BackLink is fixed at
  // (6,6) of the viewport regardless of whether the global Header currently
  // has any real height (e.g. a direct/fresh navigation before Home ever
  // set a banner leaves it at 0px), so without this the back-link and this
  // screen's own h1 can visually overlap. See the identical fix in the
  // other 3 game components + GamesHub.
  padding: 2.5rem 1rem 2rem;
  text-align: center;
}

.game-title {
  margin: 0.5rem 0 0.25rem;
}

.game-subtitle {
  color: #adb5bd;
  margin-bottom: 1rem;
}

.not-enough-movies {
  color: #adb5bd;
  margin-top: 2rem;
}

.category-legend {
  color: #adb5bd;
  font-size: 0.75rem;
  margin-bottom: 1rem;
}

.legend-chip {
  font-weight: 600;
  margin-left: 0.4rem;
}

.solved-groups {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
}

/* Difficulty color (yellow/green/blue/purple, NYT-Connections-style) is
   applied via the border + label text color, set inline from each solved
   category's difficulty — see solvedCategories. Background stays neutral so
   the color signal (and the text riding on it) stays readable regardless of
   which of the 4 tiers a group happens to be. */
.solved-group {
  background: #1a1a1a;
  border: 2px solid #4caf50;
  border-radius: 0.4rem;
  padding: 0.5rem;
  text-align: left;
}

.solved-group-label {
  font-weight: 700;
  font-size: 0.75rem;
  margin-bottom: 0.35rem;
}

/* Same 4-column grid as .tile-grid below, so a solved row visually lines up
   with the still-unsolved tiles under it — per bug report, solved posters
   should stay visible (as a labeled row), not vanish into a text summary. */
.solved-group-tiles {
  display: grid;
  gap: 0.3rem;
  grid-template-columns: repeat(4, 1fr);
}

.solved-tile {
  border-radius: 0.3rem;
  overflow: hidden;
}

.solved-tile img {
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  display: block;
}

.tile-grid {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(4, 1fr);
  margin: 0 auto;
  max-width: 480px;
}

.tile {
  background: #1a1a1a;
  border: 2px solid #333;
  border-radius: 0.4rem;
  color: #eee;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  position: relative;
}

.tile img {
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  display: block;
}

.tile.selected {
  border-color: #ffc107;
}

/* Marks a tile as "known to share a group with some other tile(s)" after a
   wrong guess revealed the overlap — the number disambiguates which
   discovered group (independent of color, since two categories can share a
   difficulty tier/color); the color itself is that category's real
   difficulty tier, same legend as .legend-chip above. */
.tile-hint-badge {
  align-items: center;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  color: #000;
  display: flex;
  font-size: 0.7rem;
  font-weight: 700;
  height: 1.3rem;
  justify-content: center;
  position: absolute;
  right: 4px;
  top: 4px;
  width: 1.3rem;
}

/* Always rendered (see the template) with a min-height, so a wrong-guess
   message appearing/disappearing doesn't reflow the Deselect/Submit buttons
   right below it. */
.guess-feedback {
  color: #ffc107;
  font-size: 0.8rem;
  min-height: 1.2rem;
  margin: 0.6rem 0 0;
}

.guess-feedback.is-empty {
  visibility: hidden;
}

/* Deselect + Submit fill the row together (each flex: 1) rather than
   sitting as two small auto-width buttons with space around them — per bug
   report, "more of the buttons [should] go full width." */
.game-actions {
  display: flex;
  gap: 0.75rem;
  margin: 1rem auto 0;
  max-width: 480px;
}

.game-actions .btn-game {
  flex: 1;
}

/* A left accent bar instead of a uniformly-tinted box — reads as a
   purpose-built callout rather than a generic (Bootstrap-alert-shaped)
   colored rectangle. */
.result-banner {
  background: #1a1a1a;
  border-left: 4px solid #4caf50;
  border-radius: 0.4rem;
  margin: 1rem auto 0;
  max-width: 480px;
  padding: 1rem;
}
</style>

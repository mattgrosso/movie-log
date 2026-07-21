<template>
  <div class="connections-game">
    <BackLink label="Games" @click="$router.push('/games')"/>
    <h1 class="game-title">Connections</h1>

    <div v-if="!puzzle" class="not-enough-movies">
      <p>Not enough rated movies with shared directors/genres/decades/cast/keywords yet to build a puzzle. Rate a few more and try again.</p>
    </div>

    <template v-else>
      <p class="game-subtitle">Find four groups of four. {{ mistakesRemaining }} mistake{{ mistakesRemaining === 1 ? '' : 's' }} remaining.</p>

      <div class="solved-groups">
        <div v-for="category in solvedCategories" :key="category.label" class="solved-group">
          <div class="solved-group-label">{{ category.label }}</div>
          <div class="solved-group-movies">{{ category.titles.join(', ') }}</div>
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
          <span class="tile-title">{{ tile.entry.movie.title }}</span>
        </button>
      </div>

      <div v-if="status === 'playing'" class="game-actions">
        <button type="button" class="btn btn-outline-light btn-sm" :disabled="selectedKeys.length === 0" @click="deselectAll">Deselect</button>
        <button type="button" class="btn btn-warning btn-sm" :disabled="selectedKeys.length !== 4" @click="submitGuess">Submit</button>
      </div>

      <div v-else class="result-banner" :class="status">
        <p v-if="status === 'won'">Solved it in {{ mistakes }} mistake{{ mistakes === 1 ? '' : 's' }}!</p>
        <p v-else>Out of guesses — here's the rest:</p>
        <button type="button" class="btn btn-warning btn-sm mt-2" @click="start">New Puzzle</button>
      </div>
    </template>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { generateConnectionsPuzzle } from '../../assets/javascript/games/connectionsGenerator.js';

const MAX_MISTAKES = 4;

export default {
  name: 'ConnectionsGame',
  components: { BackLink },
  mixins: [gameDataMixin],
  data () {
    return {
      puzzle: null,
      solvedLabels: [],
      selectedKeys: [],
      mistakes: 0
    };
  },
  computed: {
    mistakesRemaining () {
      return MAX_MISTAKES - this.mistakes;
    },
    solvedCategories () {
      if (!this.puzzle) return [];
      return this.puzzle.categories
        .filter((category) => this.solvedLabels.includes(category.label))
        .map((category) => ({
          label: category.label,
          titles: category.keys.map((key) => this.puzzle.tiles.find((tile) => tile.key === key)?.entry.movie.title).filter(Boolean)
        }));
    },
    remainingTiles () {
      if (!this.puzzle) return [];
      const solvedKeys = new Set(this.solvedCategories.flatMap((c) => this.puzzle.categories.find((cat) => cat.label === c.label).keys));
      return this.puzzle.tiles.filter((tile) => !solvedKeys.has(tile.key));
    },
    status () {
      if (!this.puzzle) return 'playing';
      // Checked before the win condition on purpose: submitGuess() marks
      // every remaining category "solved" on a loss too (so the reveal UI
      // can reuse the same solved-group rendering) — without this order, a
      // loss would satisfy "every category solved" and read as a win.
      if (this.mistakes >= MAX_MISTAKES) return 'lost';
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
    },
    toggleTile (key) {
      if (this.status !== 'playing') return;
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
      } else {
        this.mistakes += 1;
        if (this.mistakes >= MAX_MISTAKES) {
          // Reveal everything by "solving" every remaining category.
          this.solvedLabels = this.puzzle.categories.map((c) => c.label);
        }
      }
      this.selectedKeys = [];
    }
  }
};
</script>

<style scoped>
.connections-game {
  color: #eee;
  min-height: 100vh;
  padding: 0 1rem 2rem;
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

.solved-groups {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
}

.solved-group {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid #4caf50;
  border-radius: 0.4rem;
  padding: 0.5rem;
  text-align: left;
}

.solved-group-label {
  font-weight: 700;
  font-size: 0.8rem;
}

.solved-group-movies {
  color: #ccc;
  font-size: 0.75rem;
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
}

.tile img {
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  display: block;
}

.tile-title {
  font-size: 0.6rem;
  font-weight: 600;
  line-height: 1.1;
  padding: 0.25rem;
}

.tile.selected {
  border-color: #ffc107;
}

.game-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 1rem;
}

.result-banner {
  border-radius: 0.5rem;
  margin-top: 1rem;
  padding: 1rem;
}

.result-banner.won {
  background: rgba(76, 175, 80, 0.15);
}

.result-banner.lost {
  background: rgba(255, 106, 106, 0.15);
}
</style>

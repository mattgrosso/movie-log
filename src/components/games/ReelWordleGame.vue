<template>
  <div class="reel-wordle-game">
    <BackLink label="Games" @click="$router.push('/games')"/>
    <h1 class="game-title">Reel Wordle</h1>
    <p class="game-subtitle">
      <span v-if="isManualPuzzle">Practice puzzle — </span>
      Guess the movie from your own library.
      {{ guesses.length }} guess{{ guesses.length === 1 ? '' : 'es' }}<span v-if="activeClues.length"> · {{ activeClues.length }} clue{{ activeClues.length === 1 ? '' : 's' }} used</span>.
    </p>

    <div v-if="!target" class="not-enough-movies">
      <p>Not enough rated movies yet to build a puzzle.</p>
    </div>

    <template v-else>
      <div v-if="status === 'playing'" class="guess-form">
        <input
          v-model="guessInput"
          type="text"
          class="form-control"
          placeholder="Type a movie from your library…"
          @input="onInput"
        >
        <ul v-if="suggestions.length" class="suggestions">
          <li v-for="entry in suggestions" :key="entryKeyFor(entry)">
            <button type="button" class="suggestion-item" @click="submitGuess(entry)">
              {{ entry.movie.title }}
            </button>
          </li>
        </ul>
      </div>

      <div v-else class="result-banner won">
        <p>You got it in {{ guesses.length }} guess{{ guesses.length === 1 ? '' : 'es' }} (score: {{ score }})!</p>
        <img v-if="gamePosterUrl(target)" :src="gamePosterUrl(target, 'w342')" :alt="target.movie.title" class="reveal-poster">
      </div>

      <ul v-if="activeClues.length" class="target-clues">
        <li v-for="(clue, index) in activeClues" :key="index">{{ clue }}</li>
      </ul>

      <div v-if="guesses.length" class="clue-grid">
        <div class="clue-header">
          <span>Movie</span>
          <span>Year</span>
          <span>Decade</span>
          <span>Director</span>
          <span>Genres</span>
          <span>Runtime</span>
          <span>Your Rating</span>
        </div>
        <div v-for="(clue, index) in guesses" :key="index" class="clue-row" :class="{ correct: clue.isCorrect }">
          <span class="clue-title">{{ clue.title }}</span>
          <span :class="directionClass(clue.year)">{{ clue.year.direction === 'match' ? clue.year.value : arrowFor(clue.year) }}</span>
          <span :class="clue.decade.match ? 'match' : 'no-match'">{{ clue.decade.match ? `${clue.decade.value}s` : '✗' }}</span>
          <span :class="clue.director.match ? 'match' : 'no-match'">{{ clue.director.match ? clue.director.matchedNames.join(', ') : '✗' }}</span>
          <span :class="clue.genres.allMatch ? 'match' : (clue.genres.shared.length ? 'partial' : 'no-match')">
            {{ clue.genres.shared.length ? clue.genres.shared.join(', ') : '✗' }}
          </span>
          <span :class="directionClass(clue.runtime)">{{ arrowFor(clue.runtime) }}</span>
          <span :class="directionClass(clue.yourRating)">{{ arrowFor(clue.yourRating) }}</span>
        </div>
      </div>

      <button type="button" class="btn btn-sm btn-outline-light new-puzzle-btn" @click="startNewPuzzle">
        New Puzzle (practice)
      </button>
    </template>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { pickDailyEntry, todayDateString, entryKey } from '../../assets/javascript/games/gameUtils.js';
import { compareGuessToTarget, buildTargetClues, unlockedClueCount } from '../../assets/javascript/games/wordleClues.js';

export default {
  name: 'ReelWordleGame',
  components: { BackLink },
  mixins: [gameDataMixin],
  data () {
    return {
      guessInput: '',
      suggestions: [],
      guesses: [],
      // Overrides the daily pick when set — "New Puzzle (practice)" lets you
      // play again immediately instead of waiting for tomorrow's puzzle.
      // Deliberately session-only (not persisted): a reload always returns
      // to today's daily puzzle.
      manualTarget: null
    };
  },
  computed: {
    dailyTarget () {
      return pickDailyEntry(this.eligibleGameEntries, todayDateString());
    },
    target () {
      return this.manualTarget || this.dailyTarget;
    },
    isManualPuzzle () {
      return Boolean(this.manualTarget);
    },
    storageKey () {
      return `cinemaRoll.reelWordle.${todayDateString()}`;
    },
    status () {
      return this.guesses.some((clue) => clue.isCorrect) ? 'won' : 'playing';
    },
    wrongGuessCount () {
      return this.guesses.filter((clue) => !clue.isCorrect).length;
    },
    targetClues () {
      return this.target ? buildTargetClues(this.target) : [];
    },
    // Clues about the target itself, unlocked progressively as wrong
    // guesses accumulate — replaces the old hard "lost after 6" cap, since
    // guesses are now unlimited.
    activeClues () {
      const count = unlockedClueCount(this.wrongGuessCount, this.targetClues.length);
      return this.targetClues.slice(0, count);
    },
    // Golf-style: fewer guesses is better, but leaning on clues costs too.
    score () {
      return this.guesses.length - this.activeClues.length;
    }
  },
  watch: {
    // Only the DAILY target's guesses persist across sessions — a manual
    // practice puzzle (see startNewPuzzle) is reset synchronously and
    // intentionally not part of this at all, so this only ever needs to
    // watch dailyTarget, not the combined `target`.
    dailyTarget: {
      immediate: true,
      handler () {
        if (!this.isManualPuzzle) this.loadPersistedGuesses();
      }
    }
  },
  methods: {
    entryKeyFor: entryKey,
    onInput () {
      const term = this.guessInput.trim().toLowerCase();
      if (term.length < 2) {
        this.suggestions = [];
        return;
      }
      const guessedKeys = new Set(this.guesses.map((clue) => clue.entryKey));
      this.suggestions = this.eligibleGameEntries
        .filter((entry) => !guessedKeys.has(entryKey(entry)) && entry.movie.title.toLowerCase().includes(term))
        .slice(0, 8);
    },
    submitGuess (entry) {
      if (this.status !== 'playing' || !this.target) return;
      const clue = compareGuessToTarget(entry, this.target, this.gameRatingFor);
      clue.entryKey = entryKey(entry);
      this.guesses.push(clue);
      this.guessInput = '';
      this.suggestions = [];
      if (!this.isManualPuzzle) this.persistGuesses();
    },
    // Picks a fresh random target (not date-seeded) and resets progress —
    // lets testing/practice happen without waiting for the next calendar day.
    startNewPuzzle () {
      const pool = this.eligibleGameEntries;
      if (!pool.length) return;
      const excludeKey = entryKey(this.target);
      const candidates = pool.filter((entry) => entryKey(entry) !== excludeKey);
      const choices = candidates.length ? candidates : pool;
      this.manualTarget = choices[Math.floor(Math.random() * choices.length)];
      this.guesses = [];
      this.guessInput = '';
      this.suggestions = [];
    },
    directionClass (comparison) {
      if (!comparison.direction || comparison.direction === 'match') return 'match';
      return 'no-match';
    },
    arrowFor (comparison) {
      if (comparison.direction === 'match') return '✓';
      if (comparison.direction === 'up') return '↑';
      if (comparison.direction === 'down') return '↓';
      return '—';
    },
    persistGuesses () {
      try {
        const guessedKeys = this.guesses.map((clue) => clue.entryKey);
        window.localStorage.setItem(this.storageKey, JSON.stringify(guessedKeys));
      } catch (error) {
        // localStorage can throw in private-browsing/quota-exceeded situations;
        // the puzzle still works for this session, it just won't persist.
        console.error('Failed to persist Reel Wordle progress:', error);
      }
    },
    loadPersistedGuesses () {
      this.guesses = [];
      if (!this.dailyTarget) return;
      try {
        const raw = window.localStorage.getItem(this.storageKey);
        if (!raw) return;
        const guessedKeys = JSON.parse(raw);
        if (!Array.isArray(guessedKeys)) return;
        guessedKeys.forEach((key) => {
          const entry = this.eligibleGameEntries.find((candidate) => entryKey(candidate) === key);
          if (!entry) return;
          const clue = compareGuessToTarget(entry, this.dailyTarget, this.gameRatingFor);
          clue.entryKey = key;
          this.guesses.push(clue);
        });
      } catch (error) {
        console.error('Failed to load persisted Reel Wordle progress:', error);
      }
    }
  }
};
</script>

<style scoped>
.reel-wordle-game {
  color: #eee;
  min-height: 100vh;
  padding: 0 1rem 2rem;
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
  text-align: center;
  margin-top: 2rem;
}

.guess-form {
  position: relative;
  margin-bottom: 1rem;
}

.suggestions {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 0.35rem;
  list-style: none;
  margin: 0.25rem 0 0;
  max-height: 220px;
  overflow-y: auto;
  padding: 0;
  position: absolute;
  width: 100%;
  z-index: 5;
}

.suggestion-item {
  background: transparent;
  border: none;
  color: #eee;
  display: block;
  padding: 0.5rem 0.75rem;
  text-align: left;
  width: 100%;
}

.suggestion-item:active {
  background: #333;
}

.result-banner {
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  padding: 1rem;
  text-align: center;
}

.result-banner.won {
  background: rgba(76, 175, 80, 0.15);
}

.reveal-poster {
  border-radius: 0.35rem;
  max-width: 160px;
  margin-top: 0.5rem;
  width: 100%;
}

.target-clues {
  background: rgba(255, 193, 7, 0.1);
  border-radius: 0.35rem;
  color: #ffc107;
  font-size: 0.85rem;
  list-style: none;
  margin: 0 0 1rem;
  padding: 0.6rem 0.9rem;
}

.new-puzzle-btn {
  margin-top: 1rem;
}

.clue-grid {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-x: auto;
}

.clue-header,
.clue-row {
  display: grid;
  grid-template-columns: 2fr repeat(6, 1fr);
  gap: 0.4rem;
  align-items: center;
  min-width: 480px;
}

.clue-header {
  color: #adb5bd;
  font-size: 0.7rem;
  text-transform: uppercase;
}

.clue-row {
  background: #1a1a1a;
  border-radius: 0.35rem;
  padding: 0.5rem 0.4rem;
  text-align: center;
  font-size: 0.85rem;
}

.clue-row.correct {
  outline: 2px solid #4caf50;
}

.clue-title {
  text-align: left;
  font-weight: 600;
}

.match {
  color: #4caf50;
}

.partial {
  color: #ffc107;
}

.no-match {
  color: #ff6a6a;
}
</style>

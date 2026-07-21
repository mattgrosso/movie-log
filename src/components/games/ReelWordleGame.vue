<template>
  <div class="reel-wordle-game">
    <BackLink label="Games" @click="$router.push('/games')"/>
    <h1 class="game-title">Reel Wordle</h1>
    <p class="game-subtitle">Today's movie, guessed from your own library. {{ maxGuesses - guesses.length }} guesses left.</p>

    <div v-if="!target" class="not-enough-movies">
      <p>Not enough rated movies yet to build a daily puzzle.</p>
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

      <div v-else class="result-banner" :class="status">
        <p v-if="status === 'won'">You got it in {{ guesses.length }} {{ guesses.length === 1 ? 'guess' : 'guesses' }}!</p>
        <p v-else>Out of guesses — it was <strong>{{ target.movie.title }}</strong>.</p>
        <img v-if="gamePosterUrl(target)" :src="gamePosterUrl(target, 'w342')" :alt="target.movie.title" class="reveal-poster">
      </div>

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
          <span :class="directionClass(clue.year)">{{ arrowFor(clue.year) }}</span>
          <span :class="clue.decade.match ? 'match' : 'no-match'">{{ clue.decade.match ? '✓' : '✗' }}</span>
          <span :class="clue.director.match ? 'match' : 'no-match'">{{ clue.director.match ? '✓' : '✗' }}</span>
          <span :class="clue.genres.allMatch ? 'match' : (clue.genres.shared.length ? 'partial' : 'no-match')">
            {{ clue.genres.shared.length }}/{{ clue.genres.value.length }}
          </span>
          <span :class="directionClass(clue.runtime)">{{ arrowFor(clue.runtime) }}</span>
          <span :class="directionClass(clue.yourRating)">{{ arrowFor(clue.yourRating) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { pickDailyEntry, todayDateString, entryKey } from '../../assets/javascript/games/gameUtils.js';
import { compareGuessToTarget } from '../../assets/javascript/games/wordleClues.js';

const MAX_GUESSES = 6;

export default {
  name: 'ReelWordleGame',
  components: { BackLink },
  mixins: [gameDataMixin],
  data () {
    return {
      guessInput: '',
      suggestions: [],
      guesses: [],
      maxGuesses: MAX_GUESSES
    };
  },
  computed: {
    target () {
      return pickDailyEntry(this.eligibleGameEntries, todayDateString());
    },
    storageKey () {
      return `cinemaRoll.reelWordle.${todayDateString()}`;
    },
    status () {
      if (this.guesses.some((clue) => clue.isCorrect)) return 'won';
      if (this.guesses.length >= this.maxGuesses) return 'lost';
      return 'playing';
    }
  },
  watch: {
    target: {
      immediate: true,
      handler () {
        this.loadPersistedGuesses();
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
      this.persistGuesses();
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
      if (!this.target) return;
      try {
        const raw = window.localStorage.getItem(this.storageKey);
        if (!raw) return;
        const guessedKeys = JSON.parse(raw);
        if (!Array.isArray(guessedKeys)) return;
        guessedKeys.forEach((key) => {
          const entry = this.eligibleGameEntries.find((candidate) => entryKey(candidate) === key);
          if (!entry) return;
          const clue = compareGuessToTarget(entry, this.target, this.gameRatingFor);
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

.result-banner.lost {
  background: rgba(255, 106, 106, 0.15);
}

.reveal-poster {
  border-radius: 0.35rem;
  max-width: 160px;
  margin-top: 0.5rem;
  width: 100%;
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

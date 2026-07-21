<template>
  <div class="reel-wordle-game">
    <BackLink label="Games" @click="$router.push('/games')"/>
    <h1 class="game-title">Reel Wordle</h1>
    <p class="game-subtitle">
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
        New Puzzle
      </button>
    </template>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { entryKey } from '../../assets/javascript/games/gameUtils.js';
import { compareGuessToTarget, buildTargetClues, unlockedClueCount } from '../../assets/javascript/games/wordleClues.js';

const STORAGE_KEY = 'cinemaRoll.reelWordle.current';

export default {
  name: 'ReelWordleGame',
  components: { BackLink },
  mixins: [gameDataMixin],
  data () {
    return {
      guessInput: '',
      suggestions: [],
      guesses: [],
      // No more "today's puzzle" — this is just whichever movie the current
      // round is testing you on, picked at random. Persisted (by key, not by
      // calendar day — see persistState) so a reload resumes the SAME
      // in-progress round rather than silently starting a new one.
      target: null
    };
  },
  computed: {
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
    // guesses are unlimited.
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
    // Fires once eligibleGameEntries has real data (it may be empty for a
    // tick while the library is still loading). Only initializes if nothing
    // is loaded yet — a later change to the library (e.g. rating a movie
    // mid-round) must not yank the current puzzle out from under the player.
    eligibleGameEntries: {
      immediate: true,
      handler (entries) {
        if (this.target || !entries.length) return;
        this.loadOrStartPuzzle();
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
      this.persistState();
    },
    // Picks a fresh random target and resets progress — the only way to
    // move on, whether after a win or mid-round. No cooldown, no daily cap:
    // it's just Math.random() over the whole eligible library each time.
    startNewPuzzle () {
      const pool = this.eligibleGameEntries;
      if (!pool.length) return;
      const excludeKey = this.target ? entryKey(this.target) : null;
      const candidates = excludeKey ? pool.filter((entry) => entryKey(entry) !== excludeKey) : pool;
      const choices = candidates.length ? candidates : pool;
      this.target = choices[Math.floor(Math.random() * choices.length)];
      this.guesses = [];
      this.guessInput = '';
      this.suggestions = [];
      this.persistState();
    },
    persistState () {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          targetKey: entryKey(this.target),
          guessedKeys: this.guesses.map((clue) => clue.entryKey)
        }));
      } catch (error) {
        // localStorage can throw in private-browsing/quota-exceeded situations;
        // the puzzle still works for this session, it just won't persist.
        console.error('Failed to persist Reel Wordle progress:', error);
      }
    },
    // Resumes an in-progress round from localStorage if one exists and its
    // target is still in the library; otherwise starts a fresh one.
    loadOrStartPuzzle () {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const target = this.eligibleGameEntries.find((entry) => entryKey(entry) === saved?.targetKey);
          if (target) {
            this.target = target;
            this.guesses = (saved.guessedKeys || [])
              .map((key) => this.eligibleGameEntries.find((entry) => entryKey(entry) === key))
              .filter(Boolean)
              .map((entry) => {
                const clue = compareGuessToTarget(entry, target, this.gameRatingFor);
                clue.entryKey = entryKey(entry);
                return clue;
              });
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load persisted Reel Wordle progress:', error);
      }
      this.startNewPuzzle();
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

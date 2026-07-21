<template>
  <div class="higher-lower-game">
    <BackLink label="Games" @click="$router.push('/games')"/>
    <h1 class="game-title">Higher or Lower</h1>

    <div v-if="!revealed" class="setup">
      <p>See a movie's real Cinema Roll score, then guess whether the next one scored higher or lower.</p>
      <button type="button" class="btn btn-warning" @click="start">Start</button>
    </div>

    <template v-else>
      <div class="streak-row">
        <span>Streak: <strong>{{ streak }}</strong></span>
        <span>Best: <strong>{{ bestStreak }}</strong></span>
      </div>

      <p v-if="!guessed && !gameOver" class="guess-prompt">Tap the poster you think scored higher.</p>

      <div class="cards-row">
        <div
          class="hl-card"
          :class="{ tappable: !guessed && !gameOver }"
          @click="guess('lower')"
        >
          <img v-if="gamePosterUrl(revealed)" :src="gamePosterUrl(revealed, 'w342')" :alt="revealed.movie.title">
          <p class="hl-card-title">{{ revealed.movie.title }}</p>
          <p class="hl-card-score">{{ formattedRating(revealed) }}</p>
        </div>

        <div
          class="hl-card"
          :class="{ tappable: !guessed && !gameOver }"
          @click="guess('higher')"
        >
          <img v-if="gamePosterUrl(challenger)" :src="gamePosterUrl(challenger, 'w342')" :alt="challenger.movie.title">
          <p class="hl-card-title">{{ challenger.movie.title }}</p>
          <p class="hl-card-score" :class="resultClass">
            {{ guessed ? formattedRating(challenger) : '?' }}
          </p>
        </div>
      </div>

      <div v-if="gameOver" class="game-over">
        <p>{{ resultMessage }}</p>
        <button type="button" class="btn btn-warning" @click="start">Play Again</button>
      </div>

      <div v-else-if="guessed" class="game-over">
        <p>{{ resultMessage }}</p>
      </div>

      <p v-if="ranOutOfMovies" class="ran-out">You've compared your whole library! Restart to shuffle a new run.</p>
    </template>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { shuffle, entryKey } from '../../assets/javascript/games/gameUtils.js';

export default {
  name: 'HigherLowerGame',
  components: { BackLink },
  mixins: [gameDataMixin],
  data () {
    return {
      pool: [],
      poolIndex: 0,
      revealed: null,
      challenger: null,
      streak: 0,
      guessed: false,
      lastGuessCorrect: null,
      gameOver: false,
      ranOutOfMovies: false
    };
  },
  computed: {
    bestStreak () {
      return this.$store.state.settings?.games?.higherLowerBestStreak || 0;
    },
    resultClass () {
      if (!this.guessed) return '';
      return this.lastGuessCorrect ? 'correct' : 'incorrect';
    },
    resultMessage () {
      if (!this.guessed) return '';
      if (this.lastGuessCorrect) return "Correct — that one's now the card to beat.";
      return `Streak over at ${this.streak}. Correct score was ${this.formattedRating(this.challenger)}.`;
    }
  },
  methods: {
    formattedRating (entry) {
      // GetRating.js's calculatedTotal carries 2 decimal places (see
      // GetRating.js's toFixed(2)) — showing only 1 hid the difference
      // between genuinely-tied and merely-close scores.
      const value = this.gameRatingFor(entry);
      return Number.isFinite(value) ? value.toFixed(2) : '—';
    },
    start () {
      this.pool = shuffle(this.eligibleGameEntries, Math.random);
      this.poolIndex = 2;
      this.revealed = this.pool[0];
      this.challenger = this.pool[1];
      this.streak = 0;
      this.guessed = false;
      this.gameOver = false;
      this.ranOutOfMovies = false;
    },
    nextChallenger (excludeKey) {
      while (this.poolIndex < this.pool.length) {
        const candidate = this.pool[this.poolIndex];
        this.poolIndex += 1;
        if (entryKey(candidate) !== excludeKey) return candidate;
      }
      return null;
    },
    guess (direction) {
      if (this.guessed || this.gameOver) return;

      const revealedRating = this.gameRatingFor(this.revealed);
      const challengerRating = this.gameRatingFor(this.challenger);
      const isTie = challengerRating === revealedRating;
      const isCorrect = isTie || (direction === 'higher' ? challengerRating > revealedRating : challengerRating < revealedRating);

      this.guessed = true;
      this.lastGuessCorrect = isCorrect;

      if (!isCorrect) {
        this.gameOver = true;
        return;
      }

      this.streak += 1;
      if (this.streak > this.bestStreak) {
        this.$store.dispatch('setDBValue', { path: 'settings/games/higherLowerBestStreak', value: this.streak });
      }

      const settledChallenger = this.challenger;
      setTimeout(() => {
        const next = this.nextChallenger(entryKey(settledChallenger));
        if (!next) {
          this.ranOutOfMovies = true;
          this.gameOver = true;
          return;
        }
        this.revealed = settledChallenger;
        this.challenger = next;
        this.guessed = false;
      }, 900);
    }
  }
};
</script>

<style scoped>
.higher-lower-game {
  color: #eee;
  min-height: 100vh;
  padding-bottom: 2rem;
  text-align: center;
}

.game-title {
  margin: 0.5rem 0 1rem;
}

.setup p {
  color: #adb5bd;
  margin: 0 1.5rem 1.5rem;
}

.streak-row {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.cards-row {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  padding: 0 0.5rem;
}

.hl-card {
  width: 45vw;
  max-width: 220px;
}

.hl-card img {
  border-radius: 0.35rem;
  width: 100%;
}

.hl-card-title {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0.4rem 0 0.1rem;
}

.hl-card-score {
  color: #adb5bd;
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0;
}

.hl-card-score.correct {
  color: #4caf50;
}

.hl-card-score.incorrect {
  color: #ff6a6a;
}

.guess-prompt {
  color: #adb5bd;
  text-align: center;
  margin-bottom: 0.75rem;
}

/* Tap-the-poster affordance, mobile-first: an :active press state only —
   no :hover, which is what left the previous button-based UI visibly
   "stuck" highlighted after a tap on iOS (no real mouse to leave). */
.hl-card.tappable {
  cursor: pointer;
  border-radius: 0.35rem;
  transition: transform 0.15s ease;
}

.hl-card.tappable:active {
  transform: scale(0.97);
  opacity: 0.85;
}

.game-over {
  margin-top: 1.5rem;
  padding: 0 1.5rem;
}

.game-over p {
  color: #adb5bd;
}

.ran-out {
  color: #adb5bd;
  margin-top: 1rem;
  padding: 0 1.5rem;
}
</style>

<template>
  <div class="tagline-quiz-game">
    <BackLink label="Games" @click="$router.push('/games')"/>

    <div v-if="eligibleGameEntries.length < 4" class="not-enough-movies">
      <p>Rate a few more movies before there's enough to build a round with.</p>
      <NewRatingSearch value="" :suggestionsMode="true"/>
    </div>

    <template v-else>
      <p class="game-subtitle">See the tagline, guess the poster.</p>

      <p class="status-line">{{ statusMessage }}</p>
      <p class="streak-line">Streak {{ streak }} · Best {{ bestStreak }}</p>

      <p v-if="tagline" class="tagline-text">&ldquo;{{ tagline }}&rdquo;</p>

      <div v-if="options.length" class="tq-options-grid">
        <button
          v-for="entry in options"
          :key="entryKey(entry)"
          type="button"
          class="tq-option"
          :class="{ tappable: !revealed && !loading }"
          :disabled="revealed || loading"
          @click="guess(entry)"
        >
          <div class="tq-poster-wrap">
            <img v-if="gamePosterUrl(entry)" :src="gamePosterUrl(entry, 'w342')" :alt="entry.movie.title">
            <div v-if="badgeFor(entry)" class="tq-guess-badge" :class="badgeFor(entry)">
              <i :class="badgeFor(entry) === 'correct' ? 'bi bi-check-lg' : 'bi bi-x-lg'"></i>
            </div>
          </div>
        </button>
      </div>

      <div v-if="gameOver" class="game-over">
        <button type="button" class="btn-game btn-game-primary cta-btn full-width" @click="playAgain">Play Again</button>
      </div>
      <div v-else-if="noTaglineFound" class="game-over">
        <button type="button" class="btn-game btn-game-primary cta-btn full-width" @click="playAgain">Try Again</button>
      </div>
    </template>
  </div>
</template>

<script>
import axios from 'axios';
import BackLink from './BackLink.vue';
import NewRatingSearch from '../NewRatingSearch.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { entryKey } from '../../assets/javascript/games/gameUtils.js';
import { buildRoundOptions } from '../../assets/javascript/games/taglineQuiz.js';

export default {
  name: 'TaglineQuizGame',
  components: { BackLink, NewRatingSearch },
  mixins: [gameDataMixin],
  data () {
    return {
      target: null,
      tagline: null,
      options: [],
      loading: false,
      revealed: false,
      selectedKey: null,
      lastGuessCorrect: null,
      streak: 0,
      gameOver: false,
      noTaglineFound: false,
      // Bumped at the start of every startNewRound() call and captured
      // locally as roundId — the sequential retry loop inside checks this
      // after each await and bails if a NEWER round has since started (e.g.
      // the player double-tapped "Try Again"), so two overlapping rounds
      // can never both try to finish setting up state.
      roundId: 0
    };
  },
  computed: {
    bestStreak () {
      return this.$store.state.settings?.games?.taglineQuizBestStreak || 0;
    },
    statusMessage () {
      if (this.loading) return 'Loading a tagline...';
      if (this.noTaglineFound) return "Couldn't find a movie with a tagline in your library — try again.";
      if (!this.revealed) return 'Which movie has this tagline?';
      if (this.lastGuessCorrect) return 'Correct!';
      return `Not quite — final streak: ${this.streak}.`;
    }
  },
  created () {
    this.startNewRound();
  },
  methods: {
    entryKey,
    // "Play Again"/"Try Again" — the ONLY path that resets the streak.
    // startNewRound() itself deliberately does NOT touch streak, since it's
    // also what advances to the NEXT round after a correct guess (where the
    // streak needs to carry forward, not reset).
    playAgain () {
      this.streak = 0;
      this.startNewRound();
    },
    badgeFor (entry) {
      if (!this.revealed) return null;
      const isSelected = entryKey(entry) === this.selectedKey;
      const isTarget = entryKey(entry) === entryKey(this.target);
      if (isSelected) return this.lastGuessCorrect ? 'correct' : 'incorrect';
      // On a wrong guess, also mark the actual correct poster so the
      // player can see where it was — same "reveal the true answer"
      // convention used elsewhere in Games (e.g. Timeline's correctSlotOnLoss).
      if (isTarget && this.lastGuessCorrect === false) return 'correct';
      return null;
    },
    async fetchTagline (candidate) {
      const movieId = candidate?.movie?.id;
      if (movieId == null) return null;
      try {
        const response = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US`);
        const tagline = response?.data?.tagline;
        return tagline && tagline.trim() ? tagline.trim() : null;
      } catch {
        return null;
      }
    },
    async startNewRound () {
      this.roundId += 1;
      const myRoundId = this.roundId;

      this.loading = true;
      this.tagline = null;
      this.options = [];
      this.target = null;
      this.revealed = false;
      this.selectedKey = null;
      this.lastGuessCorrect = null;
      this.gameOver = false;
      this.noTaglineFound = false;

      const attemptedKeys = new Set();
      const maxAttempts = 8;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidates = this.eligibleGameEntries.filter((entry) => !attemptedKeys.has(entryKey(entry)));
        if (!candidates.length) break;
        const candidate = candidates[Math.floor(Math.random() * candidates.length)];
        attemptedKeys.add(entryKey(candidate));

        const tagline = await this.fetchTagline(candidate);
        if (myRoundId !== this.roundId) return; // a newer round has since started

        if (tagline) {
          this.target = candidate;
          this.tagline = tagline;
          this.options = buildRoundOptions(candidate, this.eligibleGameEntries, Math.random);
          this.loading = false;
          return;
        }
      }

      this.loading = false;
      this.noTaglineFound = true;
    },
    guess (entry) {
      if (this.revealed || this.gameOver || this.loading) return;

      this.revealed = true;
      this.selectedKey = entryKey(entry);
      const isCorrect = entryKey(entry) === entryKey(this.target);
      this.lastGuessCorrect = isCorrect;

      if (!isCorrect) {
        this.gameOver = true;
        return;
      }

      this.streak += 1;
      if (this.streak > this.bestStreak) {
        this.$store.dispatch('setDBValue', { path: 'settings/games/taglineQuizBestStreak', value: this.streak });
      }

      setTimeout(() => {
        this.startNewRound();
      }, 900);
    }
  }
};
</script>

<style lang="scss" scoped>
@import '@/assets/scss/game-buttons';

.tagline-quiz-game {
  color: #eee;
  min-height: 100vh;
  // Safety margin against BackLink overlapping this screen's own content
  // when the global Header happens to have zero height — same fix as the
  // other game components.
  padding: 2.5rem 0 2rem;
  text-align: center;
}

.not-enough-movies {
  color: #adb5bd;
  margin: 2rem 1.5rem;
}

.game-subtitle {
  color: #adb5bd;
  margin: 0.5rem 1rem 0;
}

.streak-line {
  color: #777;
  font-size: 0.8rem;
  margin: 0 0 0.75rem;
}

/* Always rendered so its text can swap in place without adding/removing an
   element — same anti-layout-jump convention used across every game here. */
.status-line {
  color: #adb5bd;
  text-align: center;
  min-height: 1.6rem;
  margin: 0.5rem 0.5rem 0.15rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tagline-text {
  color: #fff;
  font-size: 1.15rem;
  font-style: italic;
  font-weight: 600;
  margin: 0.5rem 1.25rem 1.25rem;
  min-height: 3rem;
}

.tq-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  max-width: 420px;
  margin: 0 auto;
  padding: 0 0.75rem;
}

.tq-option {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.tq-poster-wrap {
  position: relative;
}

.tq-option img {
  border-radius: 0.4rem;
  width: 100%;
  display: block;
}

/* Mobile-first: :active only, no :hover (this app has no reliable pointer
   device — see CLAUDE.md). */
.tq-option.tappable:active {
  opacity: 0.8;
  transform: scale(0.97);
}

.tq-guess-badge {
  align-items: center;
  background: #4caf50;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  font-size: 1.1rem;
  height: 28px;
  justify-content: center;
  position: absolute;
  right: 6px;
  top: 6px;
  width: 28px;
}

.tq-guess-badge.incorrect {
  background: #ff6a6a;
}

.game-over {
  margin-top: 1.5rem;
  padding: 0 1.5rem;
}

.cta-btn {
  margin: 0 auto;
  max-width: 320px;
}
</style>

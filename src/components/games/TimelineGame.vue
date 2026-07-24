<template>
  <div class="timeline-game">
    <BackLink label="Games" @click="$router.push('/games')"/>

    <div v-if="eligibleGameEntries.length < 5" class="not-enough-movies">
      <p>Rate a few more movies before there's enough to build a timeline with.</p>
      <NewRatingSearch value="" :suggestionsMode="true"/>
    </div>

    <div v-else-if="!started" class="setup">
      <p>Guess where each movie belongs, chronologically, among your own rated library — building a timeline one card at a time. Ties count either way.</p>
      <button type="button" class="btn-game btn-game-primary cta-btn full-width" @click="start">Start</button>
    </div>

    <template v-else>
      <div class="streak-row">
        <span>Streak: <strong>{{ streak }}</strong></span>
        <span>Best: <strong>{{ bestStreak }}</strong></span>
      </div>

      <p class="status-line">{{ statusMessage }}</p>

      <div v-if="mysteryCard" class="mystery-card">
        <img v-if="gamePosterUrl(mysteryCard)" :src="gamePosterUrl(mysteryCard, 'w342')" :alt="mysteryCard.movie.title">
        <p class="mystery-title">{{ mysteryCard.movie.title }}</p>
        <p class="mystery-year" :class="{ correct: revealed && lastGuessCorrect, incorrect: revealed && lastGuessCorrect === false }">
          {{ revealed ? mysteryYearDisplay : '?' }}
        </p>
      </div>

      <div class="timeline-row">
        <template v-for="item in timelineDisplayItems" :key="item.key">
          <button
            v-if="item.type === 'gap'"
            type="button"
            class="timeline-gap"
            :class="{ 'correct-gap': item.slotIndex === correctSlotOnLoss }"
            :disabled="revealed || !mysteryCard"
            @click="guess(item.slotIndex)"
          >+</button>
          <div v-else class="timeline-card">
            <img v-if="gamePosterUrl(item.entry)" :src="gamePosterUrl(item.entry, 'w185')" :alt="item.entry.movie.title">
            <p class="timeline-year">{{ movieYear(item.entry) }}</p>
          </div>
        </template>
      </div>

      <div v-if="gameOver" class="game-over">
        <button type="button" class="btn-game btn-game-primary cta-btn full-width" @click="start">Play Again</button>
      </div>
    </template>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import NewRatingSearch from '../NewRatingSearch.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { shuffle, entryKey, movieYear } from '../../assets/javascript/games/gameUtils.js';
import { isValidPlacement, insertAtSlot, correctSlotIndex } from '../../assets/javascript/games/timeline.js';

export default {
  name: 'TimelineGame',
  components: { BackLink, NewRatingSearch },
  mixins: [gameDataMixin],
  data () {
    return {
      started: false,
      pool: [],
      poolIndex: 0,
      timeline: [],
      mysteryCard: null,
      revealed: false,
      lastGuessCorrect: null,
      streak: 0,
      gameOver: false,
      ranOutOfMovies: false
    };
  },
  computed: {
    bestStreak () {
      return this.$store.state.settings?.games?.timelineBestStreak || 0;
    },
    mysteryYearDisplay () {
      return movieYear(this.mysteryCard) ?? '?';
    },
    // The gap between two placed cards a wrong guess actually belonged in —
    // shown as a highlight on the loss screen so the player sees the near
    // miss instead of just "wrong." Only meaningful right after a loss (not
    // the ran-out-of-movies win state, which has no wrong guess to explain).
    correctSlotOnLoss () {
      if (!this.revealed || this.lastGuessCorrect !== false || !this.mysteryCard) return null;
      return correctSlotIndex(this.timeline, this.mysteryCard);
    },
    statusMessage () {
      if (this.ranOutOfMovies) return `You've placed your whole library! Final streak: ${this.streak}.`;
      if (!this.mysteryCard) return '';
      if (!this.revealed) return 'Where does this belong? Tap a gap in the timeline.';
      if (this.lastGuessCorrect) return `Correct — ${this.mysteryCard.movie.title} (${this.mysteryYearDisplay}).`;
      return `Not quite — ${this.mysteryCard.movie.title} was ${this.mysteryYearDisplay}. Final streak: ${this.streak}.`;
    },
    // Alternates gap/card/gap/card/.../gap so the template can render one
    // flat, horizontally-scrolling row (same pattern as Six Degrees'
    // .chain-row) — N placed cards always have exactly N+1 gaps around them.
    timelineDisplayItems () {
      const items = [];
      this.timeline.forEach((entry, index) => {
        items.push({ type: 'gap', key: `gap-${index}`, slotIndex: index });
        items.push({ type: 'card', key: entryKey(entry) || `card-${index}`, entry });
      });
      items.push({ type: 'gap', key: `gap-${this.timeline.length}`, slotIndex: this.timeline.length });
      return items;
    }
  },
  methods: {
    movieYear,
    start () {
      this.pool = shuffle(this.eligibleGameEntries, Math.random);
      this.timeline = [this.pool[0]];
      this.poolIndex = 1;
      this.mysteryCard = this.nextCard();
      this.revealed = false;
      this.lastGuessCorrect = null;
      this.streak = 0;
      this.gameOver = false;
      this.ranOutOfMovies = false;
      this.started = true;
    },
    nextCard () {
      if (this.poolIndex >= this.pool.length) return null;
      const next = this.pool[this.poolIndex];
      this.poolIndex += 1;
      return next;
    },
    guess (slotIndex) {
      if (this.revealed || this.gameOver || !this.mysteryCard) return;

      const correct = isValidPlacement(this.timeline, slotIndex, this.mysteryCard);
      this.revealed = true;
      this.lastGuessCorrect = correct;

      if (!correct) {
        this.gameOver = true;
        return;
      }

      // Brief pause so the revealed year is actually readable before the
      // card slides into the timeline and the next mystery card appears —
      // same reveal-then-advance pacing as Higher or Lower.
      setTimeout(() => {
        this.timeline = insertAtSlot(this.timeline, slotIndex, this.mysteryCard);
        this.streak += 1;
        if (this.streak > this.bestStreak) {
          this.$store.dispatch('setDBValue', { path: 'settings/games/timelineBestStreak', value: this.streak });
        }

        const next = this.nextCard();
        if (!next) {
          this.mysteryCard = null;
          this.ranOutOfMovies = true;
          this.gameOver = true;
          return;
        }

        this.mysteryCard = next;
        this.revealed = false;
        this.lastGuessCorrect = null;
      }, 900);
    }
  }
};
</script>

<style lang="scss" scoped>
@import '@/assets/scss/game-buttons';

.timeline-game {
  color: #eee;
  min-height: 100vh;
  // Safety margin against BackLink overlapping this screen's own content
  // when the global Header happens to have zero height — same fix as the
  // other 4 game components.
  padding: 2.5rem 1rem 2rem;
  text-align: center;
}

.not-enough-movies {
  color: #adb5bd;
  margin: 2rem 0;
}

.setup p {
  color: #adb5bd;
  margin: 0.75rem 0 1.5rem;
}

.cta-btn {
  margin: 0 auto;
  max-width: 320px;
}

.streak-row {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 0.75rem;
  margin-bottom: 1rem;
}

// Always rendered so its text can swap in place without adding/removing an
// element (that add/remove is what caused a reported layout jump in Higher
// or Lower before it adopted this same pattern).
.status-line {
  color: #adb5bd;
  text-align: center;
  min-height: 2.6rem;
  margin: 0 0.5rem 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mystery-card {
  margin: 0 auto 1.25rem;
  max-width: 220px;
}

.mystery-card img {
  border-radius: 0.35rem;
  width: 100%;
}

.mystery-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0.4rem 0 0.1rem;
}

.mystery-year {
  color: #adb5bd;
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0;
}

.mystery-year.correct {
  color: #4caf50;
}

.mystery-year.incorrect {
  color: #ff6a6a;
}

// Horizontally-scrolling row so a growing timeline never makes the page
// taller — same convention as Six Degrees' .chain-row.
.timeline-row {
  align-items: flex-end;
  display: flex;
  flex-wrap: nowrap;
  gap: 0.35rem;
  justify-content: flex-start;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  margin: 0 -1rem;
  padding: 0 1rem 0.5rem;
}

.timeline-card {
  flex-shrink: 0;
  width: 84px;
}

.timeline-card img {
  border-radius: 0.3rem;
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
}

.timeline-year {
  color: #adb5bd;
  font-size: 0.75rem;
  font-weight: 600;
  margin: 0.25rem 0 0;
}

.timeline-gap {
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1.5px dashed rgba(255, 255, 255, 0.3);
  border-radius: 0.3rem;
  color: #adb5bd;
  cursor: pointer;
  display: flex;
  flex-shrink: 0;
  font-size: 1.1rem;
  height: 126px;
  justify-content: center;
  width: 34px;
}

// Mobile-first: :active only, no :hover (this app has no reliable pointer
// device — see CLAUDE.md).
.timeline-gap:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.14);
  transform: scale(0.94);
}

.timeline-gap:disabled {
  cursor: default;
  opacity: 0.35;
}

// Highlighted on a loss to show where the mystery card actually belonged.
.timeline-gap.correct-gap {
  border-color: #4caf50;
  border-style: solid;
  color: #4caf50;
  opacity: 1;
}

.game-over {
  margin-top: 1.5rem;
}
</style>

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
      <p class="status-line">{{ statusMessage }}</p>
      <p class="streak-line">Streak {{ streak }} · Best {{ bestStreak }}</p>

      <div class="timeline-row" ref="timelineRow">
        <template v-for="item in timelineDisplayItems" :key="item.key">
          <button
            v-if="item.type === 'gap'"
            type="button"
            ref="gapButtons"
            class="timeline-gap"
            :class="{ 'correct-gap': item.slotIndex === correctSlotOnLoss, 'drag-over': item.slotIndex === dragOverSlot }"
            :disabled="revealed || !mysteryCard"
            @click="guess(item.slotIndex)"
          >+</button>
          <div v-else class="timeline-card">
            <img v-if="gamePosterUrl(item.entry)" :src="gamePosterUrl(item.entry, 'w185')" :alt="item.entry.movie.title">
            <p class="timeline-year">{{ movieYear(item.entry) }}</p>
          </div>
        </template>
      </div>

      <!-- No title/year shown here — the poster is draggable up into the
           timeline row above (or tap a gap directly); correct/incorrect
           feedback is a border-color change on the card itself instead of
           separate text, and the year appears once it joins the timeline. -->
      <div
        v-if="mysteryCard"
        class="mystery-card"
        :class="{ dragging, correct: revealed && lastGuessCorrect, incorrect: revealed && lastGuessCorrect === false }"
        :style="dragging ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : null"
        @pointerdown="onMysteryPointerDown"
        @pointermove="onMysteryPointerMove"
        @pointerup="onMysteryPointerUp"
        @pointercancel="onMysteryPointerUp"
      >
        <img v-if="gamePosterUrl(mysteryCard)" :src="gamePosterUrl(mysteryCard, 'w342')" :alt="mysteryCard.movie.title" draggable="false">
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
import { isValidPlacement, insertAtSlot, correctSlotIndex, closestSlotIndex } from '../../assets/javascript/games/timeline.js';
import timelineBanner from '../../assets/images/games/timeline-banner.jpg';

export default {
  name: 'TimelineGame',
  components: { BackLink, NewRatingSearch },
  mixins: [gameDataMixin],
  // Custom banner graphic (with its own "Timeline / Cinema Roll Games"
  // branding baked in) in place of the usual movie-backdrop banner, and
  // hides the "Cinema Roll" title overlay so it doesn't compete with that
  // baked-in branding — same pattern as the other 4 games, see CLAUDE.md.
  created () {
    this.previousBannerUrl = this.$store.state?.bannerUrl;
    this.$store.commit?.('setBannerUrl', timelineBanner);
    this.$store.commit?.('setHideHeaderLogo', true);
  },
  beforeUnmount () {
    this.$store.commit?.('setBannerUrl', this.previousBannerUrl || null);
    this.$store.commit?.('setHideHeaderLogo', false);
  },
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
      ranOutOfMovies: false,
      // Drag-to-place state — see onMysteryPointerDown/Move/Up.
      dragging: false,
      dragOffset: { x: 0, y: 0 },
      dragOverSlot: null,
      dragStartX: 0,
      dragStartY: 0
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
    },
    onMysteryPointerDown (event) {
      if (this.revealed || this.gameOver || !this.mysteryCard) return;
      this.dragging = true;
      this.dragStartX = event.clientX;
      this.dragStartY = event.clientY;
      this.dragOffset = { x: 0, y: 0 };
      this.dragOverSlot = null;
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    },
    onMysteryPointerMove (event) {
      if (!this.dragging) return;
      this.dragOffset = {
        x: event.clientX - this.dragStartX,
        y: event.clientY - this.dragStartY
      };
      this.dragOverSlot = this.resolveDragSlot(event.clientX, event.clientY);
    },
    onMysteryPointerUp () {
      if (!this.dragging) return;
      const targetSlot = this.dragOverSlot;
      this.dragging = false;
      this.dragOffset = { x: 0, y: 0 };
      this.dragOverSlot = null;
      if (targetSlot !== null) this.guess(targetSlot);
    },
    // Which gap (if any) a drag currently resolves to. The timeline row sits
    // ABOVE the draggable card, so a drag only "arrives" once it's been
    // pulled up near/into the row — dragging that never leaves the card's
    // own vicinity harmlessly snaps back on release instead of guessing.
    resolveDragSlot (clientX, clientY) {
      const rowEl = this.$refs.timelineRow;
      const gapEls = this.$refs.gapButtons;
      if (!rowEl || !gapEls || !gapEls.length) return null;
      const rowRect = rowEl.getBoundingClientRect();
      if (clientY > rowRect.bottom + 40) return null;
      const centers = gapEls.map((el) => {
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2;
      });
      return closestSlotIndex(clientX, centers);
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
  // other 4 game components. Trimmed from 2.5rem (bug report: "move the
  // whole thing up higher") — same tradeoff Six Degrees already made.
  padding: 1.75rem 1rem 2rem;
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

// Always rendered so its text can swap in place without adding/removing an
// element (that add/remove is what caused a reported layout jump in Higher
// or Lower before it adopted this same pattern). Bug report: this used to
// sit BELOW a prominent streak/best row — now it's the top item, and the
// streak/best line below it is small/secondary instead.
.status-line {
  color: #adb5bd;
  text-align: center;
  min-height: 2.2rem;
  margin: 0 0.5rem 0.15rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.streak-line {
  color: #777;
  font-size: 0.8rem;
  margin: 0 0 1rem;
}

// Horizontally-scrolling row so a growing timeline never makes the page
// taller — same convention as Six Degrees' .chain-row. Bug report: this now
// sits ABOVE the mystery card (the card you drag UP into a gap here).
.timeline-row {
  align-items: flex-end;
  display: flex;
  flex-wrap: nowrap;
  gap: 0.3rem;
  justify-content: flex-start;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  margin: 0 -1rem 1.5rem;
  padding: 0 1rem 0.5rem;
}

// Bug report: "make the one that we know about a little bit smaller" — the
// already-placed (revealed) cards, shrunk down from the original 84px.
.timeline-card {
  flex-shrink: 0;
  width: 62px;
}

.timeline-card img {
  border-radius: 0.3rem;
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
}

.timeline-year {
  color: #adb5bd;
  font-size: 0.7rem;
  font-weight: 600;
  margin: 0.2rem 0 0;
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
  font-size: 1rem;
  height: 93px;
  justify-content: center;
  width: 28px;
  transition: transform 0.1s ease, border-color 0.1s ease, background 0.1s ease;
}

// Highlighted while a drag is hovering over this gap, distinct from the
// (green) correct-gap reveal so "drop here" and "this is where it belonged"
// never look the same.
.timeline-gap.drag-over {
  background: rgba(232, 163, 61, 0.25);
  border-color: #e8a33d;
  border-style: solid;
  color: #e8a33d;
  transform: scale(1.12);
}

// No title/year text below it anymore (bug report) — just the poster,
// draggable up into the timeline row above. touch-action:none hands the
// gesture entirely to our own pointer handlers instead of the browser's
// native scroll/pan.
.mystery-card {
  margin: 0.5rem auto 0;
  max-width: 190px;
  touch-action: none;
  user-select: none;
  -webkit-user-drag: none;
  border-radius: 0.4rem;
  border: 3px solid transparent;
  transition: border-color 0.15s ease;
}

.mystery-card img {
  border-radius: 0.3rem;
  width: 100%;
  display: block;
  pointer-events: none;
}

.mystery-card.dragging {
  cursor: grabbing;
  transition: none;
  z-index: 5;
  filter: drop-shadow(0 10px 14px rgba(0, 0, 0, 0.5));
}

.mystery-card:not(.dragging) {
  cursor: grab;
}

.mystery-card.correct {
  border-color: #4caf50;
}

.mystery-card.incorrect {
  border-color: #ff6a6a;
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

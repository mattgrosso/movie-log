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

      <div class="timeline-row">
        <template v-for="item in timelineDisplayItems" :key="item.key">
          <button
            v-if="item.type === 'gap'"
            type="button"
            class="timeline-gap"
            :class="{ 'correct-gap': item.slotIndex === correctSlotOnLoss, growing: item.slotIndex === growingGapIndex }"
            :disabled="revealed || !mysteryCard"
            @click="guess(item.slotIndex, $event)"
          >+</button>
          <div v-else class="timeline-card" :data-card-key="item.key">
            <img v-if="gamePosterUrl(item.entry)" :src="gamePosterUrl(item.entry, 'w185')" :alt="item.entry.movie.title">
            <p class="timeline-year">{{ movieYear(item.entry) }}</p>
          </div>
        </template>
      </div>

      <!-- No title/year shown here — tap a gap directly; correct/incorrect
           feedback is a border-color change on the card itself instead of
           separate text, and the year appears once it joins the timeline.
           Hidden the instant flightCard takes over (it starts at exactly
           this element's own position/size, so the swap is invisible). -->
      <div
        v-if="mysteryCard && !flyingCard"
        ref="mysteryCardEl"
        class="mystery-card"
        :class="{ correct: revealed && lastGuessCorrect, incorrect: revealed && lastGuessCorrect === false }"
      >
        <img v-if="gamePosterUrl(mysteryCard)" :src="gamePosterUrl(mysteryCard, 'w342')" :alt="mysteryCard.movie.title">
      </div>

      <!-- The poster mid-flight from the mystery card's spot up into the
           gap the player tapped — see guess() for how fromRect/toRect
           drive :style. position:fixed means its place in the template
           doesn't matter for layout. -->
      <img
        v-if="flyingCard"
        class="flying-card"
        :src="flyingCard.posterUrl"
        :style="flyingCard.style"
        alt=""
      >

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
      flyingCard: null,
      growingGapIndex: null
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
    wait (ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    // Two animation frames, not one: a single forced-reflow (the previous
    // approach here) isn't reliably enough to make a transition actually
    // play on an element created THIS SAME TICK — without a real committed
    // paint of the "from" state to transition away from, browsers can just
    // jump straight to the end state with no visible motion at all. That
    // turned out to be exactly why "there's really no animation at all"
    // (bug report) despite the FLIP math itself being correct. Two rAFs is
    // the standard, reliable fix. vi.advanceTimersByTimeAsync fakes
    // requestAnimationFrame too, so this stays fully testable.
    nextFrame () {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    },
    async guess (slotIndex, event) {
      if (this.revealed || this.gameOver || !this.mysteryCard) return;

      const correct = isValidPlacement(this.timeline, slotIndex, this.mysteryCard);
      this.revealed = true;
      this.lastGuessCorrect = correct;

      if (!correct) {
        this.gameOver = true;
        return;
      }

      const placedEntry = this.mysteryCard;
      const posterUrl = this.gamePosterUrl(placedEntry, 'w342');
      const fromRect = this.$refs.mysteryCardEl ? this.$refs.mysteryCardEl.getBoundingClientRect() : null;
      const toRect = event && event.currentTarget ? event.currentTarget.getBoundingClientRect() : null;

      // Brief pause so the green border is actually readable before the
      // poster launches — bug report: "when I click a slot, I want it to
      // look like the poster from the bottom slides up into the slot I
      // chose and the slot gets larger to accommodate it."
      await this.wait(150);

      if (fromRect && fromRect.width && toRect && toRect.width) {
        this.growingGapIndex = slotIndex;
        this.flyingCard = {
          posterUrl,
          style: {
            position: 'fixed',
            left: `${fromRect.left}px`,
            top: `${fromRect.top}px`,
            width: `${fromRect.width}px`,
            height: `${fromRect.height}px`,
            transition: 'none'
          }
        };

        await this.nextFrame();

        // Now flip to the target values WITH a transition — the gap
        // (.timeline-gap.growing, driven by CSS) widens on the same
        // timeline so the poster and its destination grow into place
        // together, not the poster arriving at a slot that's still narrow.
        this.flyingCard = {
          posterUrl,
          style: {
            position: 'fixed',
            left: `${toRect.left}px`,
            top: `${toRect.top}px`,
            width: `${toRect.width}px`,
            height: `${toRect.height}px`,
            transition: 'left 0.45s cubic-bezier(0.22, 1, 0.36, 1), top 0.45s cubic-bezier(0.22, 1, 0.36, 1), width 0.45s cubic-bezier(0.22, 1, 0.36, 1), height 0.45s cubic-bezier(0.22, 1, 0.36, 1)'
          }
        };

        await this.wait(450);
      }

      this.timeline = insertAtSlot(this.timeline, slotIndex, placedEntry);
      this.streak += 1;
      if (this.streak > this.bestStreak) {
        this.$store.dispatch('setDBValue', { path: 'settings/games/timelineBestStreak', value: this.streak });
      }

      this.flyingCard = null;
      this.growingGapIndex = null;

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
// sits ABOVE the mystery card.
.timeline-row {
  align-items: flex-end;
  display: flex;
  flex-wrap: nowrap;
  gap: 0.3rem;
  // Bug report: "at the start of the game the timeline should be centered
  // horizontally, not off to the left." Plain `center` would make the FRONT
  // of a timeline that later grows wider than the screen unreachable by
  // scroll in some engines — `safe center` centers while it fits, then
  // falls back to start-alignment (still fully scrollable) once it doesn't.
  justify-content: safe center;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  margin: 0 -1rem 1.5rem;
  padding: 0 1rem 0.5rem;
}

// Sized back up to the original 84px (bug report: an earlier "make the
// already-placed cards a little smaller" pass shrunk this to 62px, then a
// LATER, unrelated request to shrink the mystery card down 25% got
// misremembered as having shrunk this too — regardless, "bigger than they
// are right now" is unambiguous, so back to 84px).
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
  // Matches .timeline-card's restored 84px width (2:3 poster aspect ratio).
  height: 126px;
  justify-content: center;
  width: 34px;
  transition: transform 0.1s ease, border-color 0.1s ease, background 0.1s ease, width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

// Widens to match .timeline-card's own width while the poster is flying
// into it (see guess()'s growingGapIndex) — the "+" fades out at the same
// time so the slot reads as emptying out to make room, not just resizing.
.timeline-gap.growing {
  width: 84px;
  color: transparent;
  border-style: solid;
}

// A cloned poster driven entirely by inline :style (see guess() in the
// script) — position:fixed makes its place in the DOM/template irrelevant,
// it's positioned purely by the left/top/width/height values set there.
.flying-card {
  position: fixed;
  z-index: 50;
  border-radius: 0.3rem;
  object-fit: cover;
  pointer-events: none;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}

// No title/year text below it anymore — just the poster; correct/incorrect
// feedback on reveal is this border color, and tapping a gap in the row
// above places it. (Drag-to-place was tried and removed — bug report: it
// was leaving visual trails on some devices — see CLAUDE.md.) Sized 25%
// smaller than the original 190px per follow-up feedback.
.mystery-card {
  margin: 0.5rem auto 0;
  max-width: 143px;
  border-radius: 0.4rem;
  border: 3px solid transparent;
  transition: border-color 0.15s ease;
}

.mystery-card img {
  border-radius: 0.3rem;
  width: 100%;
  display: block;
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

<template>
  <div class="timeline-game" :style="started ? { '--step-duration': stepDurationMs + 'ms' } : {}">
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
          <!-- Step 2/3 mid-flight: the tapped gap itself (a real flex
               child, not an overlay) hosts the settling poster and widens
               in place -- see guess()/expandInPlace. -->
          <div
            v-if="item.type === 'gap' && item.slotIndex === placingGapIndex"
            class="timeline-gap placing-gap"
            :class="{ wide: placingWide }"
          >
            <img v-if="placingPosterUrl" :src="placingPosterUrl" alt="">
          </div>
          <button
            v-else-if="item.type === 'gap'"
            type="button"
            class="timeline-gap"
            :class="{ 'correct-gap': item.slotIndex === correctSlotOnLoss, entering: enteringGapIndices.includes(item.slotIndex) }"
            :disabled="revealed || !mysteryCard"
            @click="guess(item.slotIndex, $event)"
          >{{ plusHiddenGapIndices.includes(item.slotIndex) ? '' : '+' }}</button>
          <div v-else class="timeline-card" :data-card-key="item.key">
            <img v-if="gamePosterUrl(item.entry)" :src="gamePosterUrl(item.entry, 'w185')" :alt="item.entry.movie.title">
            <p class="timeline-year">{{ movieYear(item.entry) }}</p>
          </div>
        </template>
      </div>

      <!-- No title/year shown here — tap a gap directly; correct/incorrect
           feedback is a border-color change on the card itself instead of
           separate text, and the year appears once it joins the timeline.
           Hidden for the ENTIRE placement sequence (isPlacing), not just
           while the step-1 clone is mid-flight -- it starts pixel-aligned
           with the clone, so the swap is invisible, and it must stay
           hidden through steps 2/3 too or it'd reappear at the bottom
           while the poster is still settling into the timeline above. -->
      <div
        v-if="mysteryCard && !isPlacing"
        ref="mysteryCardEl"
        class="mystery-card"
        :class="{ correct: revealed && lastGuessCorrect, incorrect: revealed && lastGuessCorrect === false }"
      >
        <img v-if="gamePosterUrl(mysteryCard)" :src="gamePosterUrl(mysteryCard, 'w342')" :alt="mysteryCard.movie.title">
      </div>

      <!-- Step 1: the poster mid-flight from the mystery card's spot to
           the tapped gap's own (narrow) position — see guess()/
           flyToGap. position:fixed means its place in the template
           doesn't matter for layout. -->
      <img
        v-if="flyingCard"
        class="flying-card"
        :class="{ animating: flyingCardAnimating }"
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
      // The placement animation is 3 sequential steps, all driven by this
      // ONE duration (bound to --step-duration on the root element so the
      // CSS transitions below and the JS `wait`s in guess() can never
      // drift out of sync with each other). Deliberately slow right now
      // (bug report: "make it really slow... so that we can lock in the
      // sequence and then we'll adjust the times") — tune this single
      // number once the sequence itself is confirmed correct.
      stepDurationMs: 2000,
      // True for the entire 3-step placement sequence (not just step 1) —
      // gates the real .mystery-card so it doesn't reappear at the bottom
      // mid-sequence once the step-1 clone hands off to step 2.
      isPlacing: false,
      // Step 1: a position:fixed clone that slides+shrinks from the
      // mystery card's spot to the tapped gap's own (narrow) position.
      flyingCard: null,
      flyingCardAnimating: false,
      // Step 2: the clone is gone — the REAL tapped gap element now hosts
      // the poster (still narrow) and then widens to the final card size.
      // Using the real flex child (not another fixed-position clone)
      // means the row reflows around it naturally via normal layout, no
      // manual "where do the neighbors end up" math needed.
      placingGapIndex: null,
      placingPosterUrl: null,
      placingWide: false,
      // Step 3: after the real data insertion, the two gaps now flanking
      // the placed card grow in from 0 width instead of just popping in.
      enteringGapIndices: [],
      // The "+" glyph doesn't grow smoothly the way the box's width does —
      // a fixed-size character revealed by a widening overflow:hidden edge
      // reads as a jarring pop mid-grow, not part of the same motion (bug
      // report: "adding the actual '+' is causing it to snap open"). So the
      // "+" itself stays out of a gap's rendered content for the WHOLE
      // width-grow, not just its brief collapsed-state window, only
      // appearing once the box has already settled at its full resting
      // size. See growInNewGaps for why this clears later than
      // enteringGapIndices, not at the same moment.
      plusHiddenGapIndices: []
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
    //
    // Gap keys are based on the card immediately BEFORE them (or
    // 'gap-start' for the very first one), NOT their raw array index.
    // Index-based keys are unstable across insertion — inserting a card
    // shifts every subsequent gap's index, so Vue's keyed diffing would
    // treat most gaps after the insertion point as "the same element,
    // just moved" rather than tracking real identity. That mismatch was
    // why the two gaps newly flanking a placed card didn't reliably grow
    // from a clean 0 width (bug report: "they aren't expanding from 0
    // width they pop in with some amount of width and border") — at
    // least one of the two was actually a REUSED, already-painted-at-
    // normal-size DOM node, not a fresh mount. Keying by neighboring card
    // identity means inserting a card only ever creates exactly one
    // genuinely NEW gap (the other flanking gap correctly continues the
    // identity of whichever old gap it's a continuation of) — gaps
    // elsewhere in the row, unrelated to this insertion, keep their exact
    // same DOM node.
    timelineDisplayItems () {
      const items = [];
      let previousCardKey = 'start';
      this.timeline.forEach((entry, index) => {
        items.push({ type: 'gap', key: `gap-after-${previousCardKey}`, slotIndex: index });
        const cardKey = entryKey(entry) || `card-${index}`;
        items.push({ type: 'card', key: cardKey, entry });
        previousCardKey = cardKey;
      });
      items.push({ type: 'gap', key: `gap-after-${previousCardKey}`, slotIndex: this.timeline.length });
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
      this.isPlacing = false;
      this.flyingCard = null;
      this.flyingCardAnimating = false;
      this.placingGapIndex = null;
      this.placingPosterUrl = null;
      this.placingWide = false;
      this.enteringGapIndices = [];
      this.plusHiddenGapIndices = [];
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
    // Two animation frames, not one: a single forced-reflow isn't reliably
    // enough to make a transition actually play on a value that was just
    // set THIS SAME TICK — without a real committed paint of the "from"
    // state to transition away from, browsers can just jump straight to
    // the end state with no visible motion at all (this is what "there's
    // really no animation at all" turned out to be, the first time this
    // was attempted with a single `el.offsetHeight` reflow instead). Two
    // rAFs is the standard, reliable fix. vi.advanceTimersByTimeAsync
    // fakes requestAnimationFrame too, so this stays fully testable.
    nextFrame () {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    },
    // Step 1: slide + shrink a decoupled clone from the mystery card's own
    // spot to the tapped gap's position/size.
    async flyToGap (posterUrl, fromRect, toRect) {
      this.flyingCard = { posterUrl, style: { left: `${fromRect.left}px`, top: `${fromRect.top}px`, width: `${fromRect.width}px`, height: `${fromRect.height}px` } };
      this.flyingCardAnimating = false;
      await this.nextFrame();
      this.flyingCard = { posterUrl, style: { left: `${toRect.left}px`, top: `${toRect.top}px`, width: `${toRect.width}px`, height: `${toRect.height}px` } };
      this.flyingCardAnimating = true;
      await this.wait(this.stepDurationMs);
      this.flyingCard = null;
      this.flyingCardAnimating = false;
    },
    // Step 2: the poster now lives inside the REAL tapped gap element
    // (already sitting at that exact spot, so no jump from step 1), then
    // that real flex child widens to the final card size — a plain CSS
    // width transition on a real layout element, so neighboring cards/
    // gaps reflow around it naturally without any manual position math.
    // Deliberately does NOT clear placingGapIndex/placingPosterUrl/
    // placingWide once the wait resolves — that has to happen in the SAME
    // synchronous block as the real timeline insertion (see guess()), or
    // the microtask boundary introduced by awaiting this function's own
    // return lets Vue paint an intermediate "back to a blank + gap" frame
    // before the real card lands (bug report: "the poster disappears...
    // then reappears").
    async expandInPlace (posterUrl, slotIndex) {
      this.placingPosterUrl = posterUrl;
      this.placingGapIndex = slotIndex;
      this.placingWide = false;
      await this.nextFrame();
      this.placingWide = true;
      await this.wait(this.stepDurationMs);
    },
    // Step 3's settle half: waits a frame (to trigger the width
    // transition on the already-collapsed gaps — see guess() for where
    // they're marked collapsed) then waits for it to finish before
    // revealing the "+". Assumes the caller already set
    // enteringGapIndices/plusHiddenGapIndices synchronously alongside the
    // real timeline insertion — see guess().
    async settleNewGaps () {
      await this.nextFrame();
      this.enteringGapIndices = [];
      await this.wait(this.stepDurationMs);
      this.plusHiddenGapIndices = [];
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
      const gapEl = event && event.currentTarget ? event.currentTarget : null;
      const narrowRect = gapEl ? gapEl.getBoundingClientRect() : null;
      const canAnimate = !!(fromRect && fromRect.width && narrowRect && narrowRect.width);

      // Brief pause so the green border is actually readable before the
      // 3-step placement sequence begins — bug report: "when I click a
      // slot, I want it to look like the poster from the bottom slides up
      // into the slot I chose and the slot gets larger to accommodate it."
      await this.wait(400);

      if (canAnimate) {
        this.isPlacing = true;
        await this.flyToGap(posterUrl, fromRect, narrowRect);
        await this.expandInPlace(posterUrl, slotIndex);
      }

      // Everything below is deliberately ONE synchronous block, with no
      // `await` between any of these statements: clearing step 2's
      // placing-gap state, committing the real timeline insertion, AND
      // marking the two new flanking gaps as collapsed all batch into a
      // SINGLE Vue update/paint this way. Splitting them across an await
      // boundary (the previous version) let Vue paint an intermediate
      // frame — poster gone, real card not yet inserted, gaps not yet
      // marked collapsed — which is what read as "the poster disappears
      // and the plus sign boxes appear on either side of a blank space...
      // then the poster reappears" (bug report).
      this.placingGapIndex = null;
      this.placingPosterUrl = null;
      this.placingWide = false;

      this.timeline = insertAtSlot(this.timeline, slotIndex, placedEntry);
      this.streak += 1;
      if (this.streak > this.bestStreak) {
        this.$store.dispatch('setDBValue', { path: 'settings/games/timelineBestStreak', value: this.streak });
      }

      if (canAnimate) {
        this.enteringGapIndices = [slotIndex, slotIndex + 1];
        this.plusHiddenGapIndices = [slotIndex, slotIndex + 1];
      }

      if (canAnimate) {
        await this.settleNewGaps();
        this.isPlacing = false;
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
  // Bug report: "the plus sign slots are shifted down relative to the
  // posters" — cards (poster + year label below) are taller than gaps
  // (a fixed-height box), so bottom-aligning (the old flex-end) left the
  // gap's TOP sitting lower than the poster's own top. Top-aligning makes
  // a gap's box and a card's poster image start at the same Y position —
  // required for the flying/placing animation below to land in the right
  // spot, not just a cosmetic nicety.
  align-items: flex-start;
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
  overflow: hidden;
  width: 34px;
  // width/opacity duration comes from --step-duration (set on the root
  // element from stepDurationMs) so step 2's widen and step 3's grow-in
  // can never drift out of sync with the JS `wait`s driving them.
  transition: transform 0.1s ease, border-color 0.1s ease, background 0.1s ease, width var(--step-duration, 0.45s) ease, opacity var(--step-duration, 0.45s) ease;
}

// Step 3: newly-mounted flanking gaps start collapsed (0 width, invisible)
// and grow in once the class is removed a frame later (see growInNewGaps).
.timeline-gap.entering {
  width: 0;
  opacity: 0;
  border-width: 0;
}

// Step 2: the tapped gap itself hosts the settling poster — solid border,
// no "+", not interactive while it's mid-placement.
.timeline-gap.placing-gap {
  border-style: solid;
  cursor: default;
  padding: 0;
}

.timeline-gap.placing-gap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.timeline-gap.placing-gap.wide {
  width: 84px;
}

// Step 1: the clone that travels from the mystery card's spot to the
// tapped gap's (narrow) position — position:fixed so its place in the
// DOM/template doesn't matter, purely driven by :style + this class.
.flying-card {
  position: fixed;
  z-index: 50;
  border-radius: 0.3rem;
  object-fit: cover;
  pointer-events: none;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}

.flying-card.animating {
  transition: left var(--step-duration, 0.45s) cubic-bezier(0.22, 1, 0.36, 1), top var(--step-duration, 0.45s) cubic-bezier(0.22, 1, 0.36, 1), width var(--step-duration, 0.45s) cubic-bezier(0.22, 1, 0.36, 1), height var(--step-duration, 0.45s) cubic-bezier(0.22, 1, 0.36, 1);
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

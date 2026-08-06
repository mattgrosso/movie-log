<template>
  <div class="stamp-game">
    <BackLink label="Games" @click="$router.push('/games')"/>

    <div v-if="!round" class="not-enough-tags">
      <p v-if="eligibleGameEntries.length < 5">Rate a few more movies before there's enough to work with.</p>
      <p v-else>Nothing to sweep right now — no keyword sits on enough movies yet.</p>
      <NewRatingSearch v-if="eligibleGameEntries.length < 5" value="" :suggestionsMode="true"/>
    </div>

    <!-- Round finished -->
    <template v-else-if="finished">
      <p class="game-subtitle">Done with &ldquo;{{ round.keyword }}&rdquo;.</p>
      <ul class="summary">
        <li><strong>{{ tally.confirmed }}</strong> confirmed</li>
        <li><strong>{{ tally.added }}</strong> newly tagged</li>
        <li><strong>{{ tally.removed }}</strong> removed</li>
        <li><strong>{{ tally.skipped }}</strong> passed over</li>
      </ul>
      <div class="end-actions">
        <button type="button" class="btn-game btn-game-primary cta-btn" @click="startRound()">Next Keyword</button>
        <button type="button" class="btn-game btn-game-secondary cta-btn" @click="$router.push('/games')">Back to Games</button>
      </div>
    </template>

    <!-- Playing -->
    <template v-else>
      <p class="game-subtitle">
        Is this <strong>{{ round.keyword }}</strong>?
      </p>
      <p class="progress-line">{{ currentIndex + 1 }} of {{ round.cards.length }}</p>

      <!-- A real stack: the next few posters are rendered behind the top one,
           already loaded. That's both the look ("you can only see the top
           one") and the fix for the pause that used to sit between swiping and
           the next poster appearing — that pause was the next image being
           fetched. -->
      <div class="card-area">
        <div
          v-for="item in visibleStack"
          :key="entryKey(item.card.entry)"
          class="stamp-card"
          :class="{ top: item.isTop, dragging: item.isTop && dragging }"
          :style="item.isTop ? topCardStyle : null"
          @pointerdown="onPointerDown($event, item.isTop)"
          @pointermove="onPointerMove($event, item.isTop)"
          @pointerup="onPointerUp($event, item.isTop)"
          @pointercancel="onPointerUp($event, item.isTop)"
        >
          <!-- Deliberately no "already has it" marker. Knowing anchors the
               judgement, and the point is to decide blind and see what falls
               out at the end: "we don't want to know. We just have to be able
               to see what comes out." `hasTag` is still tracked internally to
               work out whether a swipe is a real change. -->
          <img v-if="gamePosterUrl(item.card.entry)" :src="gamePosterUrl(item.card.entry, 'w342')" :alt="item.card.entry.movie.title" draggable="false">

          <template v-if="item.isTop">
            <span class="verdict yes" :style="{ opacity: dragX > 0 ? Math.min(dragX / swipeThreshold, 1) : 0 }">Yes</span>
            <span class="verdict no" :style="{ opacity: dragX < 0 ? Math.min(-dragX / swipeThreshold, 1) : 0 }">No</span>
          </template>
        </div>
      </div>

      <p class="card-title">{{ currentCard ? currentCard.entry.movie.title : '' }}</p>

      <div class="decide-actions">
        <button type="button" class="btn-game btn-game-secondary decide-btn" @click="decide(false)">
          <i class="bi bi-x-lg"></i> No
        </button>
        <button type="button" class="btn-game btn-game-primary decide-btn" @click="decide(true)">
          <i class="bi bi-check-lg"></i> Yes
        </button>
      </div>

      <div class="secondary-actions">
        <button v-if="history.length" type="button" class="text-action undo-btn" @click="undo">
          <i class="bi bi-arrow-counterclockwise"></i> Undo {{ lastActionLabel }}
        </button>
        <button type="button" class="text-action skip-keyword-btn" @click="startRound()">Different keyword</button>
      </div>
    </template>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import NewRatingSearch from '../NewRatingSearch.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { entryKey } from '../../assets/javascript/games/gameUtils.js';
import {
  collectPlayableKeywords,
  pickKeyword,
  buildStampRound,
  resolveSwipe,
  keywordChangeFor
} from '../../assets/javascript/games/stamp.js';
import stampBanner from '../../assets/images/games/stamp-banner.jpg';

export default {
  name: 'StampGame',
  components: { BackLink, NewRatingSearch },
  mixins: [gameDataMixin],
  data () {
    return {
      round: null,
      currentIndex: 0,
      // One entry per decided card, enough to undo it: { card, keep, outcome,
      // previousRatings }.
      history: [],
      dragging: false,
      dragX: 0,
      dragStartX: 0,
      pointerId: null,
      swipeThreshold: 90,
      // How many posters are mounted at once. Three is enough for the stack to
      // read as a stack and for the next couple of images to be fetched before
      // they're needed.
      stackDepth: 3,
      // 0 while resting; ±1 while the top card is flying off. Kept separate
      // from dragX so the fly-out is one clean committed transition rather
      // than a continuation of the drag.
      flyDirection: 0,
      // Must match the CSS transition on .stamp-card.top. In data so tests can
      // set it to 0 rather than waiting out real animations.
      flyDuration: 320
    };
  },
  computed: {
    playableKeywords () {
      return collectPlayableKeywords(this.eligibleGameEntries);
    },
    currentCard () {
      return this.round?.cards[this.currentIndex] || null;
    },
    // Deepest card FIRST, so the current one is painted last and therefore on
    // top — no z-index needed on every card.
    visibleStack () {
      if (!this.round) return [];
      return this.round.cards
        .slice(this.currentIndex, this.currentIndex + this.stackDepth)
        .map((card, offset) => ({ card, offset, isTop: offset === 0 }))
        .reverse();
    },
    finished () {
      return Boolean(this.round) && this.currentIndex >= this.round.cards.length;
    },
    tally () {
      const counts = { confirmed: 0, added: 0, removed: 0, skipped: 0 };
      this.history.forEach((item) => { counts[item.outcome] += 1; });
      return counts;
    },
    lastActionLabel () {
      const outcome = this.history[this.history.length - 1]?.outcome;
      return { added: 'tagging', removed: 'removal', confirmed: 'confirm', skipped: 'pass' }[outcome] || '';
    },
    topCardStyle () {
      // translate3d + a rotation throughout, and deliberately NO
      // filter/drop-shadow. Timeline's drag-to-place was removed for leaving
      // visual trails on a real device, traced to drop-shadow being recomputed
      // on every pointermove. A composited transform alone doesn't do that.
      if (this.flyDirection) {
        // Far enough to clear any viewport, so the card genuinely leaves rather
        // than stopping at the edge.
        return {
          transform: `translate3d(${this.flyDirection * 140}vw, 0, 0) rotate(${this.flyDirection * 18}deg)`,
          opacity: 0
        };
      }
      if (!this.dragX) return {};
      return {
        transform: `translate3d(${this.dragX}px, 0, 0) rotate(${this.dragX / 22}deg)`
      };
    }
  },
  created () {
    this.startRound();
    this.previousBannerUrl = this.$store.state?.bannerUrl;
    this.$store.commit?.('setBannerUrl', stampBanner);
    this.$store.commit?.('setHideHeaderLogo', true);
  },
  beforeUnmount () {
    this.$store.commit?.('setBannerUrl', this.previousBannerUrl || null);
    this.$store.commit?.('setHideHeaderLogo', false);
  },
  methods: {
    // No picker — a keyword is chosen for you and you just start swiping.
    // Passing the current one as `exclude` means "Different keyword" and
    // "Next Keyword" never hand back the one just finished.
    startRound () {
      const chosen = pickKeyword(this.playableKeywords, Math.random, this.round?.keyword);
      if (!chosen) {
        this.round = null;
        return;
      }

      this.round = buildStampRound(this.eligibleGameEntries, chosen.keyword);
      this.currentIndex = 0;
      this.history = [];
      this.resetDrag();
    },
    resetDrag () {
      this.dragging = false;
      this.dragX = 0;
      this.pointerId = null;
    },
    wait (ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    // `isTop` is passed rather than inferred: CSS pointer-events keeps a real
    // finger off the cards behind, but nothing stops a synthetic event, and a
    // drag on a buried card would be silently wrong.
    onPointerDown (event, isTop) {
      if (!isTop || !this.currentCard || this.flyDirection) return;
      this.pointerId = event.pointerId;
      this.dragStartX = event.clientX;
      this.dragging = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove (event, isTop) {
      if (!isTop || !this.dragging || event.pointerId !== this.pointerId) return;
      this.dragX = event.clientX - this.dragStartX;
    },
    onPointerUp (event, isTop) {
      if (!isTop || !this.dragging) return;
      const travelled = this.dragX;
      event.currentTarget?.releasePointerCapture?.(this.pointerId);
      this.resetDrag();

      if (Math.abs(travelled) >= this.swipeThreshold) {
        this.decide(travelled > 0);
      }
    },
    async decide (keep) {
      const card = this.currentCard;
      // Ignore anything that arrives while a card is still flying off — a
      // second commit mid-flight would advance twice and skip a poster.
      if (!card || this.flyDirection) return;

      const outcome = resolveSwipe({ hasTag: card.hasTag, keep });
      // Read fresh from the store rather than the captured card — the entry may
      // have been touched since the round was built.
      const dbKey = card.entry.dbKey;
      const liveMovie = this.$store.state?.movieLog?.[dbKey]?.movie || card.entry.movie;
      const previous = {
        customKeywords: liveMovie.customKeywords || [],
        removedKeywords: liveMovie.removedKeywords || []
      };

      this.history = [...this.history, { card, keep, outcome, previous }];

      // Fling the top card clear before advancing. Dragging stops, but the
      // index deliberately does NOT move yet — the card has to stay mounted to
      // be animated.
      this.dragging = false;
      this.pointerId = null;
      this.dragX = 0;
      this.flyDirection = keep ? 1 : -1;

      // The save doesn't wait for the animation; the animation doesn't wait for
      // the save. 'confirmed' and 'skipped' change nothing and are never
      // written.
      if (outcome === 'added' || outcome === 'removed') {
        this.saveKeywords(dbKey, keywordChangeFor(liveMovie, this.round.keyword, keep));
      }

      await this.wait(this.flyDuration);
      this.flyDirection = 0;
      this.currentIndex += 1;
    },
    async undo () {
      const last = this.history[this.history.length - 1];
      if (!last || this.flyDirection) return;

      this.history = this.history.slice(0, -1);
      this.currentIndex = Math.max(0, this.currentIndex - 1);
      this.resetDrag();

      if (last.outcome === 'added' || last.outcome === 'removed') {
        await this.saveKeywords(last.card.entry.dbKey, last.previous);
      }
    },
    async saveKeywords (dbKey, { customKeywords, removedKeywords }) {
      try {
        // Leaf paths, not the whole entry — writing the entry would risk
        // clobbering siblings (and the store injects dbKey at read time, which
        // shouldn't be persisted).
        await this.$store.dispatch('writeDurably', {
          path: `movieLog/${dbKey}/movie/customKeywords`,
          value: customKeywords
        });
        await this.$store.dispatch('writeDurably', {
          path: `movieLog/${dbKey}/movie/removedKeywords`,
          value: removedKeywords
        });
      } catch (error) {
        console.error('Could not save keyword change:', error);
      }
    },
    entryKey
  }
};
</script>

<style lang="scss" scoped>
@import '@/assets/scss/game-buttons';

.stamp-game {
  color: #eee;
  min-height: 100vh;
  padding: 1.75rem 1rem 2rem;
  text-align: center;
}

.not-enough-tags {
  color: #adb5bd;
  margin: 2rem 0.5rem;
}

.game-subtitle {
  color: #adb5bd;
  margin: 0.75rem 0;
}

.progress-line {
  color: #777;
  font-size: 0.8rem;
  margin: 0 0 0.75rem;
}

.card-area {
  align-items: center;
  display: flex;
  height: 300px;
  justify-content: center;
  // The cards stack on top of each other inside this box.
  position: relative;
}

.stamp-card {
  position: absolute;
  touch-action: pan-y;
  user-select: none;
  // Hints the compositor without forcing a layer permanently.
  will-change: transform;

  // Only the top card takes input; the ones behind are scenery.
  &:not(.top) {
    pointer-events: none;
  }

  // Snapping back from a short drag, and the fly-out, share this transition —
  // flyDuration in data has to match it. Suppressed while actually dragging so
  // the card tracks the finger exactly.
  &.top:not(.dragging) {
    transition: transform 0.32s ease-out, opacity 0.32s ease-out;
  }

  img {
    border-radius: 8px;
    display: block;
    height: 300px;
    pointer-events: none;
    width: auto;
  }
}

/* Verdict stamps fade in as you drag, so the swipe says what it will do
   before you commit to it. */
.verdict {
  border: 3px solid;
  border-radius: 6px;
  font-size: 1.4rem;
  font-weight: 800;
  padding: 0.1rem 0.6rem;
  pointer-events: none;
  position: absolute;
  text-transform: uppercase;
  top: 14px;
}

.verdict.yes {
  border-color: #4caf50;
  color: #4caf50;
  left: 12px;
  transform: rotate(-14deg);
}

.verdict.no {
  border-color: #ff6a6a;
  color: #ff6a6a;
  right: 12px;
  transform: rotate(14deg);
}

.card-title {
  color: #eee;
  font-size: 0.9rem;
  margin: 0.6rem 0 1rem;
  min-height: 1.2rem;
}

.decide-actions {
  display: flex;
  gap: 0.75rem;
  margin: 0 auto;
  max-width: 340px;
}

.decide-btn {
  flex: 1;
}

.secondary-actions {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 1.25rem;
}

.text-action {
  background: none;
  border: none;
  color: #777;
  font-size: 0.78rem;
  text-decoration: underline;

  &:active {
    opacity: 0.6;
  }
}

.summary {
  color: #adb5bd;
  list-style: none;
  margin: 1rem auto 1.5rem;
  max-width: 260px;
  padding: 0;

  li {
    padding: 0.2rem 0;
  }

  strong {
    color: #f0ad4e;
  }
}
</style>

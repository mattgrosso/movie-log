<template>
  <div class="stamp-game">
    <BackLink label="Games" @click="$router.push('/games')"/>

    <div v-if="playableTags.length === 0" class="not-enough-tags">
      <p v-if="eligibleGameEntries.length < 5">Rate a few more movies before there's enough to work with.</p>
      <p v-else>
        You need a tag on at least {{ minTagged }} movies before this game has anything to go on.
        Add some tags from a movie's page and come back.
      </p>
      <NewRatingSearch v-if="eligibleGameEntries.length < 5" value="" :suggestionsMode="true"/>
    </div>

    <!-- Tag picker -->
    <template v-else-if="!round">
      <p class="game-subtitle">Pick a tag, then sort your movies by whether it fits.</p>
      <div class="tag-list">
        <button
          v-for="tag in playableTags"
          :key="tag.title"
          type="button"
          class="tag-choice"
          @click="startRound(tag.title)"
        >
          <span class="tag-choice-title">{{ tag.title }}</span>
          <span class="tag-choice-count">{{ tag.count }}</span>
        </button>
      </div>
    </template>

    <!-- Round finished -->
    <template v-else-if="finished">
      <p class="game-subtitle">Done with &ldquo;{{ round.tag }}&rdquo;.</p>
      <ul class="summary">
        <li><strong>{{ tally.confirmed }}</strong> confirmed</li>
        <li><strong>{{ tally.added }}</strong> newly tagged</li>
        <li><strong>{{ tally.removed }}</strong> removed</li>
        <li><strong>{{ tally.skipped }}</strong> passed over</li>
      </ul>
      <div class="end-actions">
        <button type="button" class="btn-game btn-game-primary cta-btn" @click="round = null">Another Tag</button>
        <button type="button" class="btn-game btn-game-secondary cta-btn" @click="$router.push('/games')">Back to Games</button>
      </div>
    </template>

    <!-- Playing -->
    <template v-else>
      <p class="game-subtitle">
        Is this <strong>{{ round.tag }}</strong>?
      </p>
      <p class="progress-line">{{ currentIndex + 1 }} of {{ round.cards.length }}</p>

      <div class="card-area">
        <div
          v-if="currentCard"
          ref="cardEl"
          class="stamp-card"
          :class="{ dragging }"
          :style="cardStyle"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <img v-if="gamePosterUrl(currentCard.entry)" :src="gamePosterUrl(currentCard.entry, 'w342')" :alt="currentCard.entry.movie.title" draggable="false">
          <span v-if="currentCard.hasTag" class="already-tagged">Currently tagged</span>

          <span class="verdict yes" :style="{ opacity: dragX > 0 ? Math.min(dragX / swipeThreshold, 1) : 0 }">Yes</span>
          <span class="verdict no" :style="{ opacity: dragX < 0 ? Math.min(-dragX / swipeThreshold, 1) : 0 }">No</span>
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

      <button v-if="history.length" type="button" class="undo-btn" @click="undo">
        <i class="bi bi-arrow-counterclockwise"></i> Undo {{ lastActionLabel }}
      </button>
    </template>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import NewRatingSearch from '../NewRatingSearch.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { entryKey } from '../../assets/javascript/games/gameUtils.js';
import {
  collectPlayableTags,
  buildStampRound,
  resolveSwipe,
  ratingsWithTag,
  MIN_TAGGED_TO_PLAY
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
      minTagged: MIN_TAGGED_TO_PLAY
    };
  },
  computed: {
    playableTags () {
      return collectPlayableTags(this.eligibleGameEntries);
    },
    currentCard () {
      return this.round?.cards[this.currentIndex] || null;
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
    cardStyle () {
      if (!this.dragX) return {};
      return {
        // translate3d + a rotation, and deliberately NO filter/drop-shadow.
        // Timeline's drag-to-place was removed for leaving visual trails on a
        // real device, which was traced to drop-shadow being recomputed on
        // every pointermove. A composited transform alone doesn't do that.
        transform: `translate3d(${this.dragX}px, 0, 0) rotate(${this.dragX / 22}deg)`
      };
    }
  },
  created () {
    this.previousBannerUrl = this.$store.state?.bannerUrl;
    this.$store.commit?.('setBannerUrl', stampBanner);
    this.$store.commit?.('setHideHeaderLogo', true);
  },
  beforeUnmount () {
    this.$store.commit?.('setBannerUrl', this.previousBannerUrl || null);
    this.$store.commit?.('setHideHeaderLogo', false);
  },
  methods: {
    startRound (tagTitle) {
      this.round = buildStampRound(this.eligibleGameEntries, tagTitle);
      this.currentIndex = 0;
      this.history = [];
      this.resetDrag();
    },
    resetDrag () {
      this.dragging = false;
      this.dragX = 0;
      this.pointerId = null;
    },
    onPointerDown (event) {
      if (!this.currentCard) return;
      this.pointerId = event.pointerId;
      this.dragStartX = event.clientX;
      this.dragging = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove (event) {
      if (!this.dragging || event.pointerId !== this.pointerId) return;
      this.dragX = event.clientX - this.dragStartX;
    },
    onPointerUp (event) {
      if (!this.dragging) return;
      const travelled = this.dragX;
      event.currentTarget?.releasePointerCapture?.(this.pointerId);
      this.resetDrag();

      if (Math.abs(travelled) >= this.swipeThreshold) {
        this.decide(travelled > 0);
      }
    },
    async decide (keep) {
      const card = this.currentCard;
      if (!card) return;

      const outcome = resolveSwipe({ hasTag: card.hasTag, keep });
      // Read fresh from the store rather than the captured card — the entry may
      // have been touched since the round was built.
      const dbKey = card.entry.dbKey;
      const liveEntry = this.$store.state?.movieLog?.[dbKey];
      const previousRatings = liveEntry?.ratings || card.entry.ratings;

      this.history = [...this.history, { card, keep, outcome, previousRatings }];
      this.currentIndex += 1;
      this.resetDrag();

      // 'confirmed' and 'skipped' change nothing, so they're never written.
      if (outcome === 'added' || outcome === 'removed') {
        await this.saveRatings(dbKey, ratingsWithTag(previousRatings, this.round.tag, keep));
      }
    },
    async undo () {
      const last = this.history[this.history.length - 1];
      if (!last) return;

      this.history = this.history.slice(0, -1);
      this.currentIndex = Math.max(0, this.currentIndex - 1);
      this.resetDrag();

      if (last.outcome === 'added' || last.outcome === 'removed') {
        await this.saveRatings(last.card.entry.dbKey, last.previousRatings);
      }
    },
    async saveRatings (dbKey, ratings) {
      try {
        // The ratings leaf, not the whole entry — writing the entry would risk
        // clobbering siblings (and the store injects dbKey at read time, which
        // shouldn't be persisted).
        await this.$store.dispatch('writeDurably', {
          path: `movieLog/${dbKey}/ratings`,
          value: ratings
        });
      } catch (error) {
        console.error('Could not save tag change:', error);
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

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0 auto;
  max-width: 340px;
}

.tag-choice {
  align-items: center;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 8px;
  color: #eee;
  display: flex;
  justify-content: space-between;
  padding: 0.7rem 0.9rem;

  // Mobile-first: press feedback only, no :hover (see CLAUDE.md).
  &:active {
    transform: scale(0.98);
  }
}

.tag-choice-count {
  background: #333;
  border-radius: 10px;
  color: #adb5bd;
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
}

.card-area {
  align-items: center;
  display: flex;
  justify-content: center;
  // Reserved so the layout doesn't jump between cards.
  min-height: 300px;
}

.stamp-card {
  position: relative;
  touch-action: pan-y;
  user-select: none;
  // Hints the compositor without forcing a layer permanently.
  will-change: transform;

  &:not(.dragging) {
    transition: transform 0.2s ease;
  }

  img {
    border-radius: 8px;
    display: block;
    max-height: 300px;
    pointer-events: none;
    width: auto;
  }
}

.already-tagged {
  background: rgba(0, 0, 0, 0.75);
  border-radius: 4px;
  color: #f0ad4e;
  font-size: 0.68rem;
  left: 6px;
  padding: 2px 6px;
  position: absolute;
  top: 6px;
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

.undo-btn {
  background: none;
  border: none;
  color: #777;
  font-size: 0.78rem;
  margin-top: 1.25rem;
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

<template>
  <div class="higher-lower-game">
    <BackLink label="Games" @click="$router.push('/games')"/>

    <div v-if="!leftCard" class="setup">
      <p>See a movie's real Cinema Roll score, then guess whether the next one scored higher or lower.</p>
      <button type="button" class="btn-game btn-game-primary cta-btn" @click="start">Start</button>
    </div>

    <template v-else>
      <div class="streak-row">
        <span>Streak: <strong>{{ streak }}</strong></span>
        <span>Best: <strong>{{ bestStreak }}</strong></span>
      </div>

      <p class="status-line">{{ statusMessage }}</p>

      <div class="cards-row">
        <div
          class="hl-card"
          :class="{ tappable: !guessed && !gameOver }"
          @click="guess('left')"
        >
          <img v-if="gamePosterUrl(leftCard)" :src="gamePosterUrl(leftCard, 'w342')" :alt="leftCard.movie.title">
          <p class="hl-card-title">{{ leftCard.movie.title }}</p>
          <p class="hl-card-score" :class="scoreClass('left')">{{ scoreDisplay('left') }}</p>
        </div>

        <div
          class="hl-card"
          :class="{ tappable: !guessed && !gameOver }"
          @click="guess('right')"
        >
          <img v-if="gamePosterUrl(rightCard)" :src="gamePosterUrl(rightCard, 'w342')" :alt="rightCard.movie.title">
          <p class="hl-card-title">{{ rightCard.movie.title }}</p>
          <p class="hl-card-score" :class="scoreClass('right')">{{ scoreDisplay('right') }}</p>
        </div>
      </div>

      <div v-if="gameOver" class="game-over">
        <button type="button" class="btn-game btn-game-primary cta-btn" @click="start">Play Again</button>
      </div>
    </template>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { shuffle, entryKey } from '../../assets/javascript/games/gameUtils.js';
import higherLowerBanner from '../../assets/images/games/higher-lower-banner.jpg';

export default {
  name: 'HigherLowerGame',
  components: { BackLink },
  mixins: [gameDataMixin],
  // Custom banner graphic (with its own "Higher or Lower / Cinema Roll
  // Games" branding baked in) in place of the usual movie-backdrop banner,
  // and hides the "Cinema Roll" title overlay so it doesn't compete with
  // that baked-in branding - same pattern as Six Degrees, see CLAUDE.md.
  created () {
    this.previousBannerUrl = this.$store.state?.bannerUrl;
    this.$store.commit?.('setBannerUrl', higherLowerBanner);
    this.$store.commit?.('setHideHeaderLogo', true);
  },
  beforeUnmount () {
    this.$store.commit?.('setBannerUrl', this.previousBannerUrl || null);
    this.$store.commit?.('setHideHeaderLogo', false);
  },
  data () {
    return {
      pool: [],
      poolIndex: 0,
      // Two fixed screen slots, left/right, each independently holding
      // whatever card currently lives there. Per bug report (and its
      // immediate self-correction): a card must never visually "jump" from
      // one slot to the other — whichever slot a card occupies, it keeps
      // occupying that SAME slot for as long as it keeps winning; only the
      // slot that just lost its relevance gets replaced with a fresh
      // challenger. revealedSide tracks which slot currently shows a real
      // (already-confirmed) score; the other is the mystery/tap-to-guess one.
      leftCard: null,
      rightCard: null,
      revealedSide: 'left',
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
    mysterySide () {
      return this.revealedSide === 'left' ? 'right' : 'left';
    },
    revealedCard () {
      return this.revealedSide === 'left' ? this.leftCard : this.rightCard;
    },
    mysteryCard () {
      return this.mysterySide === 'left' ? this.leftCard : this.rightCard;
    },
    resultClass () {
      if (!this.guessed) return '';
      return this.lastGuessCorrect ? 'correct' : 'incorrect';
    },
    // A single always-rendered status line (see .status-line) instead of
    // separately mounting/unmounting a prompt above the cards and a result
    // message below them — that add/remove was the reported "jump" every
    // time you tapped a poster. Swapping this one line's text in place keeps
    // the cards themselves stationary.
    statusMessage () {
      if (this.ranOutOfMovies) return "You've compared your whole library! Restart to shuffle a new run.";
      if (!this.guessed) return 'Tap the poster you think scored higher.';
      if (this.lastGuessCorrect) return "Correct — that one's now the card to beat.";
      return `Streak over at ${this.streak}. Correct score was ${this.formattedRating(this.mysteryCard)}.`;
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
    cardFor (side) {
      return side === 'left' ? this.leftCard : this.rightCard;
    },
    // Score text/color for a given slot — the revealed side always shows its
    // real score; the mystery side shows '?' until guessed, then reveals
    // with correct/incorrect coloring.
    scoreDisplay (side) {
      if (side !== this.mysterySide || this.guessed) return this.formattedRating(this.cardFor(side));
      return '?';
    },
    scoreClass (side) {
      if (side !== this.mysterySide || !this.guessed) return '';
      return this.resultClass;
    },
    start () {
      this.pool = shuffle(this.eligibleGameEntries, Math.random);
      this.poolIndex = 2;
      this.leftCard = this.pool[0];
      this.rightCard = this.pool[1];
      this.revealedSide = 'left';
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
    // tappedSide is 'left' or 'right' — whichever poster was actually
    // tapped. Tapping the mystery card means "I think this one's higher";
    // tapping the already-revealed card means "I think the mystery one's
    // lower" — same tap semantics as before, just resolved against whichever
    // side is currently the mystery one instead of a fixed position.
    guess (tappedSide) {
      if (this.guessed || this.gameOver) return;

      const guessHigher = tappedSide === this.mysterySide;
      const revealedRating = this.gameRatingFor(this.revealedCard);
      const mysteryRating = this.gameRatingFor(this.mysteryCard);
      const isTie = mysteryRating === revealedRating;
      const isCorrect = isTie || (guessHigher ? mysteryRating > revealedRating : mysteryRating < revealedRating);

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

      // The mystery card just proved itself and becomes the new reference
      // for next round — but it stays in its OWN slot (no cross-slot copy).
      // The OLD revealed slot is what gets replaced with a fresh challenger.
      const sideToReplace = this.revealedSide;
      const winnerKey = entryKey(this.mysteryCard);
      const newRevealedSide = this.mysterySide;

      setTimeout(() => {
        const next = this.nextChallenger(winnerKey);
        if (!next) {
          this.ranOutOfMovies = true;
          this.gameOver = true;
          return;
        }
        if (sideToReplace === 'left') {
          this.leftCard = next;
        } else {
          this.rightCard = next;
        }
        this.revealedSide = newRevealedSide;
        this.guessed = false;
      }, 900);
    }
  }
};
</script>

<style lang="scss" scoped>
@import '@/assets/scss/game-buttons';

.higher-lower-game {
  color: #eee;
  min-height: 100vh;
  // See the identical comment in ConnectionsGame.vue — top padding is a
  // safety margin against BackLink overlapping this screen's own h1 when
  // the global Header happens to have zero height.
  padding: 2.5rem 0 2rem;
  text-align: center;
}

.setup {
  padding: 0 1.5rem;
}

// No more <h1> (the banner graphic already carries the game's name) - this
// picks up the top spacing that used to come from .game-title's own margin.
.setup p {
  color: #adb5bd;
  margin: 0.75rem 0 1.5rem;
}

// Per follow-up bug report ("more of the buttons go full width") — capped
// at a sane max so it doesn't stretch edge-to-edge on a wide viewport.
.cta-btn {
  margin: 0 auto;
  max-width: 320px;
  width: 100%;
}

.streak-row {
  display: flex;
  justify-content: center;
  gap: 2rem;
  // No more <h1> above - same top-spacing reasoning as .setup p.
  margin-top: 0.75rem;
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

/* Always rendered (see statusMessage) so its text can swap in place without
   adding/removing an element — that reflow was the reported jump. min-height
   covers the longest message (2 lines on a narrow phone) so even that swap
   doesn't shift the cards below it. */
.status-line {
  color: #adb5bd;
  text-align: center;
  min-height: 2.6rem;
  margin: 0 0.5rem 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
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
</style>

<template>
  <div ref="root" class="poster-zoom-game" :style="rootStyle">
    <BackLink label="Games" @click="$router.push('/games')"/>

    <div v-if="zoomablePool.length < 5" class="not-enough-movies">
      <p>Rate a few more movies (with posters) before there's enough to zoom into.</p>
      <NewRatingSearch value="" :suggestionsMode="true"/>
    </div>

    <template v-else>
      <p class="game-subtitle">Name it from a close-up — every zoom-out costs a point.</p>

      <!-- The stage takes whatever vertical space is left over, and the
           poster fills it. That's what makes the game fit on a phone
           without scrolling regardless of how tall the header banner is —
           sizing the poster as a fixed fraction of the viewport can't
           account for that. -->
      <div ref="stage" class="zoom-stage">
        <!-- The crop is done by scaling the image inside a clipped window
             rather than by resizing anything, so the box never moves on the
             page as the zoom changes. -->
        <div class="zoom-viewport" :style="viewportStyle">
          <img
            v-if="posterUrl"
            :src="posterUrl"
            :alt="status === 'playing' ? 'A close-up of a movie poster' : target.movie.title"
            class="zoom-image"
            :style="zoomStyle"
          >
          <!-- On the poster rather than in their own row: a separate score
               row cost a full line of the one thing in short supply here. -->
          <span class="zoom-stat">{{ zoomOuts }} out{{ zoomOuts === 1 ? '' : 's' }}<span v-if="bestZoomOuts != null"> · best {{ bestZoomOuts }}</span></span>
          <span v-if="status === 'playing' && !isFullyOut" class="zoom-badge">{{ currentZoomLabel }}</span>
        </div>
      </div>

      <p class="status-line">{{ statusMessage }}</p>

      <div v-if="status === 'playing'" class="guess-form">
        <input
          v-model="guessInput"
          type="text"
          class="game-input"
          placeholder="Name the movie…"
          @input="onInput"
        >
        <ul v-if="suggestions.length" class="suggestions">
          <li v-for="entry in suggestions" :key="entryKeyFor(entry)">
            <button type="button" class="suggestion-item" @click="submitGuess(entry)">
              {{ entry.movie.title }} <span class="suggestion-year">({{ suggestionYear(entry) }})</span>
            </button>
          </li>
        </ul>

        <div class="playing-actions">
          <button
            type="button"
            class="btn-game btn-game-secondary btn-game-sm"
            :disabled="isFullyOut"
            @click="zoomOut"
          >
            {{ isFullyOut ? 'Fully zoomed out' : 'Zoom out' }}
          </button>
          <button type="button" class="btn-game btn-game-secondary btn-game-sm give-up" @click="giveUp">Give up</button>
        </div>
      </div>

      <div v-else class="result-banner" :class="status">
        <button type="button" class="reveal-title" @click="goToMovie(target)">
          {{ target.movie.title }} <span class="reveal-year">({{ suggestionYear(target) }})</span>
        </button>
        <div class="end-actions">
          <button type="button" class="btn-game btn-game-primary cta-btn" @click="startNewRound">New Poster</button>
          <button type="button" class="btn-game btn-game-secondary cta-btn" @click="$router.push('/games')">Back to Games</button>
        </div>
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
  ZOOM_LEVELS,
  pickZoomOrigin,
  pickZoomTarget,
  clampZoomIndex,
  zoomLevelAt,
  isFullyZoomedOut,
  zoomStyleFor,
  entriesWithPosters,
  isNewBestScore
} from '../../assets/javascript/games/posterZoom.js';
import posterZoomBanner from '../../assets/images/games/poster-zoom-banner.jpg';

const STORAGE_KEY = 'cinemaRoll.posterZoom.current';

// Bigger than the w342 used across the library grid: this is the one screen
// that magnifies a poster several times over, and w342 at 6x is mush. One
// image per round, and the service worker's CacheFirst rule for
// image.tmdb.org keeps it after the first view.
const POSTER_SIZE = 'w780';

export default {
  name: 'PosterZoomGame',
  components: { BackLink, NewRatingSearch },
  mixins: [gameDataMixin],
  // Custom banner + hidden logo, same pattern as every other game (see
  // CLAUDE.md) — the artwork carries its own branding.
  created () {
    this.previousBannerUrl = this.$store.state?.bannerUrl;
    this.$store.commit?.('setBannerUrl', posterZoomBanner);
    this.$store.commit?.('setHideHeaderLogo', true);
  },
  mounted () {
    this.$nextTick(this.measureAvailableHeight);
    window.addEventListener('resize', this.measureAvailableHeight);
    // The header banner loads asynchronously and changes this screen's top
    // offset when it does, so a single measurement at mount is too early.
    // Observing the body catches that, plus orientation changes and the
    // mobile browser chrome collapsing on scroll.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.measureAvailableHeight);
      this.resizeObserver.observe(document.body);
    }
  },
  beforeUnmount () {
    window.removeEventListener('resize', this.measureAvailableHeight);
    this.resizeObserver?.disconnect();
    this.$store.commit?.('setBannerUrl', this.previousBannerUrl || null);
    this.$store.commit?.('setHideHeaderLogo', false);
  },
  data () {
    return {
      availableHeight: null,
      stageHeight: null,
      target: null,
      zoomIndex: 0,
      origin: { x: 50, y: 50 },
      status: 'playing',
      guessInput: '',
      suggestions: [],
      lastWrongTitle: null
    };
  },
  computed: {
    // Caps the game at the space actually left below the header, which is
    // what lets the stage shrink the poster to fit. A CSS-only version of
    // this can't work: the header banner is 16:9 of the SCREEN WIDTH on a
    // phone (and hidden entirely above 600px), so its height isn't
    // expressible as a fraction of the viewport.
    rootStyle () {
      // Only while actually playing. The "not enough movies" screen has its
      // own suggestions list that should be free to be as tall as it needs.
      if (!this.availableHeight || this.zoomablePool.length < 5) return {};
      return { maxHeight: `${this.availableHeight}px` };
    },
    // Capping by height is what makes aspect-ratio derive the WIDTH. Every
    // CSS-only way of expressing "as tall as the row it's in" failed here:
    // a percentage height doesn't resolve against a flex-determined parent,
    // and cross-axis stretch sets the height but then lets flex sizing pick
    // the width, which produced a landscape box on a 2:3 poster.
    viewportStyle () {
      return this.stageHeight ? { maxHeight: `${this.stageHeight}px` } : {};
    },
    // Only entries with a poster can be a target — the whole game is the
    // poster. Kept separate from eligibleGameEntries because the guess
    // typeahead can still legitimately offer anything in the library.
    zoomablePool () {
      return entriesWithPosters(this.eligibleGameEntries);
    },
    bestZoomOuts () {
      return this.$store.state.settings?.games?.posterZoomBestZoomOuts ?? null;
    },
    posterUrl () {
      return this.target ? this.gamePosterUrl(this.target, POSTER_SIZE) : null;
    },
    // Once the round is over the poster is shown whole, however far in the
    // player had got.
    zoomStyle () {
      if (this.status !== 'playing') return zoomStyleFor(ZOOM_LEVELS.length - 1, this.origin);
      return zoomStyleFor(this.zoomIndex, this.origin);
    },
    zoomOuts () {
      return clampZoomIndex(this.zoomIndex);
    },
    isFullyOut () {
      return isFullyZoomedOut(this.zoomIndex);
    },
    currentZoomLabel () {
      return `${zoomLevelAt(this.zoomIndex)}×`;
    },
    // One always-rendered line rather than blocks appearing and
    // disappearing, so the viewport above it never shifts on the page —
    // same reflow-avoidance as Higher or Lower's status line.
    statusMessage () {
      if (this.status === 'won') {
        return this.zoomOuts === 0
          ? 'Got it from the tightest crop. Show-off.'
          : `Got it after ${this.zoomOuts} zoom-out${this.zoomOuts === 1 ? '' : 's'}.`;
      }
      if (this.status === 'revealed') return 'Gave up — here it is.';
      if (this.lastWrongTitle) return `Not ${this.lastWrongTitle}. Zoomed out a little.`;
      if (this.isFullyOut) return "That's the whole poster — last chance.";
      return 'Name the movie.';
    }
  },
  // Same "wait for real data, only act once it's there" pattern the other
  // games use — the library may still be loading at mount.
  watch: {
    zoomablePool: {
      immediate: true,
      handler (pool) {
        if (this.target || !pool.length) return;
        this.loadOrStart();
      }
    }
  },
  methods: {
    entryKeyFor: entryKey,
    measureAvailableHeight () {
      const el = this.$refs.root;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      // Document coordinates, so scroll position doesn't skew the result.
      const topInDocument = rect.top + window.scrollY;
      // Whatever renders after this screen — the app's footer sits below the
      // routed view, and ignoring it left the page a footer's height too tall.
      const below = Math.max(0, document.documentElement.scrollHeight - (topInDocument + rect.height));
      const next = Math.round(window.innerHeight - topInDocument - below);

      // Only react to real changes: setting maxHeight resizes the body,
      // which re-fires the observer, and without this that would loop.
      if (next > 200 && Math.abs(next - (this.availableHeight || 0)) > 1) {
        this.availableHeight = next;
      }

      // The stage's own height is flex-determined and therefore real, even
      // though CSS can't reference it. Safe to read in the same pass: the
      // stage fills leftover space, so capping the poster inside it can't
      // change it back.
      const stage = this.$refs.stage;
      if (stage) {
        const stageNext = Math.round(stage.getBoundingClientRect().height);
        if (stageNext > 0 && Math.abs(stageNext - (this.stageHeight || 0)) > 1) {
          this.stageHeight = stageNext;
        }
      }
    },
    goToMovie (entry) {
      // == null rather than a bare falsy check: a real TMDB id is never 0,
      // but treating it as missing is a bug this codebase has shipped before.
      if (entry?.movie?.id == null) return;
      this.$router.push(`/movie/${entry.movie.id}`);
    },
    suggestionYear (entry) {
      const date = entry?.movie?.release_date;
      return date ? new Date(date).getFullYear() : 'Unknown';
    },
    onInput () {
      const term = this.guessInput.trim().toLowerCase();
      if (term.length < 2) {
        this.suggestions = [];
        return;
      }
      this.suggestions = this.eligibleGameEntries
        .filter((entry) => entry.movie.title.toLowerCase().includes(term))
        .slice(0, 8);
    },
    // Guesses always come from the player's own library via the dropdown,
    // never free text, so comparing identity beats fuzzy title matching —
    // and handles remakes sharing a title for free.
    submitGuess (entry) {
      if (this.status !== 'playing' || !this.target) return;
      this.guessInput = '';
      this.suggestions = [];

      if (entryKey(entry) === entryKey(this.target)) {
        this.win();
        return;
      }

      // A wrong guess costs exactly what tapping "Zoom out" costs. Guessing
      // early is meant to be worth trying, not punished beyond the reveal
      // it buys you — and the score is zoom-outs either way.
      this.lastWrongTitle = entry?.movie?.title || null;
      this.revealNextStep();
    },
    zoomOut () {
      if (this.status !== 'playing') return;
      this.lastWrongTitle = null;
      this.revealNextStep();
    },
    revealNextStep () {
      if (this.isFullyOut) {
        this.persistState();
        return;
      }
      this.zoomIndex = clampZoomIndex(this.zoomIndex + 1);
      this.persistState();
    },
    giveUp () {
      if (this.status !== 'playing') return;
      this.status = 'revealed';
      this.persistState(); // no longer 'playing', so this clears the save
    },
    win () {
      this.status = 'won';
      this.lastWrongTitle = null;
      this.recordGameWin();
      if (isNewBestScore(this.zoomOuts, this.bestZoomOuts)) {
        this.$store.dispatch('setDBValue', {
          path: 'settings/games/posterZoomBestZoomOuts',
          value: this.zoomOuts
        });
      }
      this.persistState(); // no longer 'playing', so this clears the save
    },
    startNewRound () {
      const pool = this.zoomablePool;
      if (!pool.length) return;

      const excludeKey = this.target ? entryKey(this.target) : null;
      this.target = pickZoomTarget(pool, excludeKey, Math.random);
      this.origin = pickZoomOrigin();
      this.zoomIndex = 0;
      this.status = 'playing';
      this.guessInput = '';
      this.suggestions = [];
      this.lastWrongTitle = null;
      this.persistState();
    },
    persistState () {
      try {
        if (this.status !== 'playing' || !this.target) {
          window.localStorage.removeItem(STORAGE_KEY);
          return;
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          targetKey: entryKey(this.target),
          zoomIndex: this.zoomIndex,
          // The focal point is random, so it has to be stored — recomputing
          // it would silently turn a resumed round into a different puzzle.
          origin: this.origin
        }));
      } catch (error) {
        console.error('Failed to persist Poster Zoom progress:', error);
      }
    },
    loadOrStart () {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const target = this.zoomablePool.find((entry) => entryKey(entry) === saved?.targetKey);
          // A finished round is never resumed (same rule as every other
          // persisted game); persistState only ever writes while playing,
          // so anything found here was genuinely in progress.
          if (target) {
            this.target = target;
            this.zoomIndex = clampZoomIndex(saved.zoomIndex);
            this.origin = saved.origin && Number.isFinite(saved.origin.x) && Number.isFinite(saved.origin.y)
              ? saved.origin
              : { x: 50, y: 50 };
            this.status = 'playing';
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load persisted Poster Zoom progress:', error);
      }
      this.startNewRound();
    }
  }
};
</script>

<style lang="scss" scoped>
@import '@/assets/scss/game-buttons';
@import '@/assets/scss/game-inputs';

.poster-zoom-game {
  color: #eee;
  /* A flex column so the stage below can absorb the leftover height. The
     app shell already stretches a routed component to fill the space under
     the header (see App.vue's .app-main), so "leftover" is real here. */
  display: flex;
  flex-direction: column;
  /* Safety margin: BackLink is fixed at (6,6) of the viewport whether or not
     the global header currently has any height, so without this it can
     overlap this screen's own content. Same in every game component. */
  padding: 1.25rem 1rem 1rem;
}

.not-enough-movies {
  color: #adb5bd;
  margin: 2rem 0;
  text-align: center;
}

.game-subtitle {
  color: #adb5bd;
  font-size: 0.8rem;
  margin: 0.4rem 0;
  text-align: center;
}

/* Absorbs whatever height is left after the fixed chrome above and below.
   min-height: 0 is required — a flex item defaults to min-height: auto and
   would refuse to shrink below its content, which is exactly the overflow
   this exists to prevent. */
.zoom-stage {
  display: flex;
  flex: 1 1 auto;
  justify-content: center;
  margin: 0.25rem 0;
  min-height: 0;
  align-items: center;
}

.zoom-viewport {
  /* Height comes from the stage's cross-axis stretch, width from the aspect
     ratio. Sizing this as a fixed fraction of the viewport was tried and
     can't work: it has no way to know how tall the header banner is, and
     that banner is 16:9 of the screen width on a phone. */
  aspect-ratio: 2 / 3;
  background: #000;
  flex: 0 0 auto;
  border: 1px solid #333;
  border-radius: 0.5rem;
  /* max-height is set inline from the measured stage height; this is just
     the ceiling for a tall desktop window. */
  max-height: 460px;
  max-width: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
  width: auto;
}

.zoom-image {
  display: block;
  height: 100%;
  object-fit: cover;
  /* The zoom itself. transform is composited, so this stays smooth on a
     phone — the same reason Timeline's placement animation uses transforms
     rather than animating layout properties. */
  transition: transform 0.45s ease;
  width: 100%;
}

.zoom-stat {
  background: rgba(0, 0, 0, 0.65);
  border-radius: 999px;
  color: #adb5bd;
  font-size: 0.7rem;
  left: 6px;
  padding: 2px 8px;
  position: absolute;
  top: 6px;
}

.zoom-badge {
  background: rgba(0, 0, 0, 0.65);
  border-radius: 999px;
  bottom: 6px;
  color: #ffc107;
  font-size: 0.75rem;
  padding: 2px 8px;
  position: absolute;
  right: 6px;
}

.status-line {
  color: #adb5bd;
  font-size: 0.85rem;
  margin: 0.5rem 0;
  /* Reserved so the message changing length never nudges the controls. */
  min-height: 1.3rem;
  text-align: center;
}

.guess-form {
  margin: 0 auto;
  max-width: 320px;
  /* Anchors the absolutely-positioned dropdown below the input. */
  position: relative;
}

/* One panel with rows inside it, matching the typeahead in every other
   game. Styling each row as its own bordered card instead reads as a stack
   of separate boxes rather than a dropdown. Absolute so opening it doesn't
   push the buttons down the page. */
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

.suggestion-year {
  color: #adb5bd;
  font-size: 0.8rem;
}

.playing-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.playing-actions .btn-game {
  flex: 1;
}

.give-up {
  border-color: #a33;
  color: #e88;
}

.result-banner {
  margin: 0 auto;
  max-width: 320px;
  text-align: center;
}

.reveal-title {
  background: none;
  border: none;
  color: #ffc107;
  font-size: 1.15rem;
  font-weight: 600;
  padding: 0;
}

.reveal-title:active {
  opacity: 0.7;
}

.reveal-year {
  color: #adb5bd;
  font-size: 0.9rem;
  font-weight: 400;
}
</style>

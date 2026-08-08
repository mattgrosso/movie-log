<template>
  <div class="poster-zoom-game">
    <BackLink label="Games" @click="$router.push('/games')"/>

    <div v-if="zoomablePool.length < 5" class="not-enough-movies">
      <p>Rate a few more movies (with posters) before there's enough to zoom into.</p>
      <NewRatingSearch value="" :suggestionsMode="true"/>
    </div>

    <template v-else>
      <p class="game-subtitle">Name the movie from a close-up. Every zoom-out costs you a point, so guess as early as you dare.</p>

      <div class="score-row">
        <span>Zoom-outs: <strong>{{ zoomOuts }}</strong></span>
        <span>Best: <strong>{{ bestZoomOuts != null ? bestZoomOuts : '—' }}</strong></span>
      </div>

      <!-- The crop is done by scaling the image inside a fixed, clipped
           window rather than by resizing anything, so the box never moves
           on the page as the zoom changes. -->
      <div class="zoom-viewport">
        <img
          v-if="posterUrl"
          :src="posterUrl"
          :alt="status === 'playing' ? 'A close-up of a movie poster' : target.movie.title"
          class="zoom-image"
          :style="zoomStyle"
        >
        <span v-if="status === 'playing' && !isFullyOut" class="zoom-badge">{{ currentZoomLabel }}</span>
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
  beforeUnmount () {
    this.$store.commit?.('setBannerUrl', this.previousBannerUrl || null);
    this.$store.commit?.('setHideHeaderLogo', false);
  },
  data () {
    return {
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
  /* Safety margin: BackLink is fixed at (6,6) of the viewport whether or not
     the global header currently has any height, so without this it can
     overlap this screen's own content. Same in every game component. */
  padding: 1.75rem 1rem 2rem;
}

.not-enough-movies {
  color: #adb5bd;
  margin: 2rem 0;
  text-align: center;
}

.game-subtitle {
  color: #adb5bd;
  font-size: 0.9rem;
  margin: 0.75rem 0;
  text-align: center;
}

.score-row {
  color: #adb5bd;
  display: flex;
  font-size: 0.85rem;
  gap: 1.25rem;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.zoom-viewport {
  /* Poster aspect. Fixed so the page never reflows between zoom steps. */
  aspect-ratio: 2 / 3;
  background: #000;
  border: 1px solid #333;
  border-radius: 0.5rem;
  margin: 0 auto;
  max-width: 300px;
  overflow: hidden;
  position: relative;
  width: 100%;
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
  font-size: 0.9rem;
  margin: 0.75rem 0;
  /* Reserved so the message changing length never nudges the controls. */
  min-height: 1.4rem;
  text-align: center;
}

.guess-form {
  margin: 0 auto;
  max-width: 320px;
}

.suggestions {
  list-style: none;
  margin: 0.35rem 0 0;
  padding: 0;
}

.suggestion-item {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 0.35rem;
  color: #eee;
  display: block;
  margin-bottom: 0.25rem;
  padding: 0.45rem 0.6rem;
  text-align: left;
  width: 100%;
}

.suggestion-item:active {
  background: #242424;
}

.suggestion-year {
  color: #adb5bd;
  font-size: 0.8rem;
}

.playing-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
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

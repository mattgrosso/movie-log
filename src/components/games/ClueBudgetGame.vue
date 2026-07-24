<template>
  <div class="clue-budget-game">
    <BackLink label="Games" @click="$router.push('/games')"/>

    <div v-if="eligibleGameEntries.length < 5" class="not-enough-movies">
      <p>Rate a few more movies before there's enough to quiz you on.</p>
      <NewRatingSearch value="" :suggestionsMode="true"/>
    </div>

    <template v-else>
      <p class="game-subtitle">Spend your ${{ startingBudget }} budget on clues, then guess the movie before you're broke.</p>

      <div class="budget-row">
        <span>Budget: <strong :class="{ low: budget <= 20 }">${{ budget }}</strong></span>
        <span>Best: <strong>{{ bestSavings != null ? `$${bestSavings} saved` : '—' }}</strong></span>
      </div>

      <div v-if="status === 'playing'" class="guess-form">
        <input
          v-model="guessInput"
          type="text"
          class="game-input"
          placeholder="Guess the movie…"
          @input="onInput"
        >
        <ul v-if="suggestions.length" class="suggestions">
          <li v-for="entry in suggestions" :key="entryKeyFor(entry)">
            <button type="button" class="suggestion-item" @click="submitGuess(entry)">
              {{ entry.movie.title }} <span class="suggestion-year">({{ suggestionYear(entry) }})</span>
            </button>
          </li>
        </ul>
      </div>

      <div v-else class="result-banner" :class="status">
        <p v-if="status === 'won'">Got it — <strong>{{ target.movie.title }}</strong>! ${{ budget }} left over.</p>
        <p v-else>Out of budget — it was <strong>{{ target.movie.title }}</strong>.</p>
        <img v-if="gamePosterUrl(target)" :src="gamePosterUrl(target, 'w342')" :alt="target.movie.title" class="reveal-poster">
        <button type="button" class="btn-game btn-game-primary btn-game-sm full-width" @click="startNewRound">New Round</button>
      </div>

      <ul v-if="purchasedClues.length" class="purchased-clues">
        <li v-for="clue in purchasedClues" :key="clue.key"><strong>{{ clue.label }}:</strong> {{ clue.value }}</li>
      </ul>

      <div v-if="status === 'playing'" class="clue-shop">
        <button
          v-for="clue in availableClues"
          :key="clue.key"
          type="button"
          class="clue-chip"
          :disabled="clue.cost > budget"
          @click="buyClue(clue)"
        >
          <span class="clue-chip-label">{{ clue.label }}</span>
          <span class="clue-chip-cost">${{ clue.cost }}</span>
        </button>

        <button type="button" class="clue-chip poster-chip" @click="revealPoster">
          <span class="clue-chip-label">Reveal Poster (give up)</span>
          <span class="clue-chip-cost">${{ budget }}</span>
        </button>
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
import { buildClueDeck, STARTING_BUDGET } from '../../assets/javascript/games/clueBudget.js';
import clueBudgetBanner from '../../assets/images/games/clue-budget-banner.jpg';

export default {
  name: 'ClueBudgetGame',
  components: { BackLink, NewRatingSearch },
  mixins: [gameDataMixin],
  // Custom banner graphic (with its own "Clue Budget / Cinema Roll Games"
  // branding baked in) in place of the usual movie-backdrop banner, and
  // hides the "Cinema Roll" title overlay so it doesn't compete with that
  // baked-in branding — same pattern as the other 5 games, see CLAUDE.md.
  created () {
    this.previousBannerUrl = this.$store.state?.bannerUrl;
    this.$store.commit?.('setBannerUrl', clueBudgetBanner);
    this.$store.commit?.('setHideHeaderLogo', true);
  },
  beforeUnmount () {
    this.$store.commit?.('setBannerUrl', this.previousBannerUrl || null);
    this.$store.commit?.('setHideHeaderLogo', false);
  },
  data () {
    return {
      startingBudget: STARTING_BUDGET,
      target: null,
      budget: STARTING_BUDGET,
      clueDeck: [],
      purchasedKeys: [],
      status: 'playing',
      guessInput: '',
      suggestions: []
    };
  },
  computed: {
    bestSavings () {
      return this.$store.state.settings?.games?.clueBudgetBestSavings ?? null;
    },
    availableClues () {
      return this.clueDeck.filter((clue) => !this.purchasedKeys.includes(clue.key));
    },
    purchasedClues () {
      return this.purchasedKeys
        .map((key) => this.clueDeck.find((clue) => clue.key === key))
        .filter(Boolean);
    }
  },
  watch: {
    // Same "wait for real data, only act if nothing's loaded yet" pattern
    // as Reel Wordle/Six Degrees — the library may still be loading when
    // this component mounts.
    eligibleGameEntries: {
      immediate: true,
      handler (entries) {
        if (this.target || !entries.length) return;
        this.startNewRound();
      }
    }
  },
  methods: {
    entryKeyFor: entryKey,
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
    // A guess is always picked from the player's own library (via the
    // suggestions dropdown, never free text), so it's always a real movie
    // — comparing identity (dbKey/id) is simpler and more reliable than
    // fuzzy title matching (handles remakes/shared titles for free too).
    submitGuess (entry) {
      if (this.status !== 'playing' || !this.target) return;
      this.guessInput = '';
      this.suggestions = [];
      if (entryKey(entry) === entryKey(this.target)) this.win();
    },
    buyClue (clue) {
      if (this.status !== 'playing' || this.purchasedKeys.includes(clue.key) || clue.cost > this.budget) return;
      this.budget -= clue.cost;
      this.purchasedKeys.push(clue.key);
      if (this.budget <= 0) this.lose();
    },
    // The one rule handed down whole: revealing the poster always costs
    // whatever's left, in full — effectively "give up," available any time
    // regardless of how much budget remains.
    revealPoster () {
      if (this.status !== 'playing') return;
      this.budget = 0;
      this.lose();
    },
    lose () {
      this.status = 'lost';
    },
    win () {
      this.status = 'won';
      if (this.bestSavings == null || this.budget > this.bestSavings) {
        this.$store.dispatch('setDBValue', { path: 'settings/games/clueBudgetBestSavings', value: this.budget });
      }
    },
    startNewRound () {
      const pool = this.eligibleGameEntries;
      if (!pool.length) return;
      const excludeKey = this.target ? entryKey(this.target) : null;
      const candidates = excludeKey ? pool.filter((entry) => entryKey(entry) !== excludeKey) : pool;
      const choices = candidates.length ? candidates : pool;
      this.target = choices[Math.floor(Math.random() * choices.length)];
      this.budget = STARTING_BUDGET;
      this.purchasedKeys = [];
      this.status = 'playing';
      this.guessInput = '';
      this.suggestions = [];
      this.clueDeck = buildClueDeck(this.target);
      this.fetchTagline();
    },
    // Tagline isn't persisted locally (see CLAUDE.md) — fetched live, once
    // per round, and folded into the deck if it arrives. Best-effort: on
    // failure, or if this movie genuinely has no tagline on TMDB, the deck
    // just never gets a Tagline clue this round.
    async fetchTagline () {
      const movieId = this.target?.movie?.id;
      if (!movieId) return;
      const roundTarget = this.target;
      try {
        const response = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US`);
        const tagline = response?.data?.tagline;
        // Guards against a slow response landing after "New Round" already
        // moved on to a different target.
        if (tagline && this.target === roundTarget) {
          this.clueDeck = buildClueDeck(this.target, { tagline });
        }
      } catch {
        // Best-effort — see above.
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import '@/assets/scss/game-buttons';
@import '@/assets/scss/game-inputs';

.clue-budget-game {
  color: #eee;
  min-height: 100vh;
  // Safety margin against BackLink overlapping this screen's own content
  // when the global Header happens to have zero height — same fix as the
  // other 5 game components.
  padding: 1.75rem 1rem 2rem;
}

.game-subtitle {
  color: #adb5bd;
  margin-top: 0.75rem;
  margin-bottom: 1rem;
}

.not-enough-movies {
  color: #adb5bd;
  text-align: center;
  margin-top: 2rem;
}

.budget-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.budget-row strong {
  color: #4caf50;
}

.budget-row strong.low {
  color: #ff6a6a;
}

.guess-form {
  position: relative;
  margin-bottom: 1rem;
}

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
  font-size: 0.85em;
}

// Left-accent-bar callout, same treatment as Reel Wordle/Connections'
// result banners — a purpose-built look rather than a generic colored box.
.result-banner {
  background: #1a1a1a;
  border-left: 4px solid #4caf50;
  border-radius: 0.4rem;
  margin-bottom: 1rem;
  padding: 1rem;
  text-align: center;
}

.result-banner.lost {
  border-left-color: #ff6a6a;
}

.reveal-poster {
  border-radius: 0.35rem;
  max-width: 160px;
  margin: 0.5rem auto;
  display: block;
  width: 100%;
}

.purchased-clues {
  background: #1a1a1a;
  border-left: 4px solid #ffc107;
  border-radius: 0.4rem;
  color: #eee;
  font-size: 0.9rem;
  list-style: none;
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
}

.purchased-clues li + li {
  margin-top: 0.4rem;
}

.purchased-clues strong {
  color: #ffc107;
}

.clue-shop {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(2, 1fr);
}

.clue-chip {
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1.5px solid #333;
  border-radius: 0.5rem;
  color: #eee;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.6rem 0.4rem;
  text-align: center;
  transition: transform 0.1s ease, border-color 0.1s ease;
}

// Mobile-first: :active only, no :hover (this app has no reliable pointer
// device — see CLAUDE.md).
.clue-chip:active:not(:disabled) {
  border-color: #ffb300;
  transform: scale(0.96);
}

.clue-chip:disabled {
  cursor: default;
  opacity: 0.35;
}

.clue-chip-label {
  font-size: 0.75rem;
  font-weight: 600;
}

.clue-chip-cost {
  color: #4caf50;
  font-size: 0.85rem;
  font-weight: 700;
}

.clue-chip:disabled .clue-chip-cost {
  color: #adb5bd;
}

// The one clue that always spends everything — visually distinct (a red
// tint) from the neutral cost-based chips above it, since it's a
// deliberate "give up," not a normal purchase.
.poster-chip {
  border-color: #ff6a6a;
  grid-column: 1 / -1;
}

.poster-chip .clue-chip-cost {
  color: #ff6a6a;
}
</style>

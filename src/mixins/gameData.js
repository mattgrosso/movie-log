import { getRating } from '../assets/javascript/GetRating.js';
import { getEligibleEntries, ratingFor } from '../assets/javascript/games/gameUtils.js';

// localStorage key recording whichever individual game route was last
// visited (NOT the hub itself — see created() below) — Home.vue's
// goToGames() reads this so the controller-icon entry point jumps back into
// the game you were actually playing instead of always landing on the hub.
export const LAST_PLAYED_KEY = 'cinemaRoll.games.lastPlayed';

// Single source of truth for each game's icon — shared by GamesHub's tile
// grid and Home.vue's Games entry-point button, which shows whichever
// game's icon LAST_PLAYED_KEY points back to (falling back to a generic
// controller icon when nothing specific is stored).
export const GAME_ICONS = {
  '/games/higher-lower': 'bi-arrow-down-up',
  '/games/wordle': 'bi-grid-3x3-gap-fill',
  '/games/connections': 'bi-grid-fill',
  '/games/six-degrees': 'bi-diagram-3-fill',
  '/games/timeline': 'bi-clock-history'
};

// Shared plumbing for every game in src/components/games/ — which library
// entries are usable (poster + release date + at least one rating) and how
// to read a numeric rating off one. Kept as a mixin (matching the
// favoriteTuning.js precedent) so each game's own file stays focused on its
// own rules/UI rather than re-deriving this every time.
export default {
  created () {
    // GamesHub also mixes this in (for the eligibleGameEntries gate check)
    // but visiting the hub itself shouldn't count as "the game you were
    // playing" — only record an actual individual game route.
    if (this.$route?.path && this.$route.path !== '/games') {
      try {
        window.localStorage.setItem(LAST_PLAYED_KEY, this.$route.path);
      } catch (error) {
        // localStorage can throw in private-browsing/quota-exceeded situations;
        // harmless to skip, it just means goToGames falls back to the hub.
      }
    }
  },
  computed: {
    eligibleGameEntries () {
      // Same default-false-unless-explicitly-true convention as Home.vue's
      // own showShorts computed. Optional-chained on state itself too since
      // several game test mocks stub $store without a state object at all.
      const includeShorts = this.$store.state?.settings?.includeShorts === true;
      return getEligibleEntries(this.$store.getters.allMediaAsArray, includeShorts);
    }
  },
  methods: {
    gameRatingFor (entry) {
      return ratingFor(entry, getRating);
    },
    gamePosterUrl (entry, size = 'w342') {
      const path = entry?.movie?.poster_path;
      return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
    }
  }
};

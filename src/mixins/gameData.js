import { getRating } from '../assets/javascript/GetRating.js';
import { getEligibleEntries, ratingFor } from '../assets/javascript/games/gameUtils.js';

// Shared plumbing for every game in src/components/games/ — which library
// entries are usable (poster + release date + at least one rating) and how
// to read a numeric rating off one. Kept as a mixin (matching the
// favoriteTuning.js precedent) so each game's own file stays focused on its
// own rules/UI rather than re-deriving this every time.
export default {
  computed: {
    eligibleGameEntries () {
      return getEligibleEntries(this.$store.getters.allMediaAsArray);
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

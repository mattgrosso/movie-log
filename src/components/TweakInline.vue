<template>
  <div v-if="showTweakModal && (currentTournament || tiedGroupDbKeys.length >= 2)" class="tweak-inline">
    <!-- Single container that changes its content -->
    <Transition name="tweak-expand" mode="out-in">
      <!-- Prompt -->
      <div v-if="!showTweakInline" key="notice" class="tweak-container rounded p-3 mb-3" @click="toggleTweakInline">
        <div class="tweak-notice-content">
          You have a tie to deal with.
          <a class="alert-link" @click.stop="toggleTweakInline"><br/>Click to break the tie.</a>
        </div>
      </div>

      <!-- Tournament just completed: show final standings -->
      <div v-else-if="tournamentIsComplete" key="results" class="tweak-container rounded p-3 mb-3">
        <div class="text-center mb-3">
          <h5 class="text-light mb-0">Tournament Complete!</h5>
          <p class="text-light small mb-0">Final standings for this tie</p>
        </div>
        <ol class="tournament-results list-unstyled mb-3">
          <li v-for="entry in resultsForDisplay" :key="entry.dbKey" class="d-flex align-items-center gap-2 mb-2">
            <span class="result-rank">{{ entry.rank + 1 }}</span>
            <img
              class="rounded result-thumb"
              :src="`https://image.tmdb.org/t/p/w92${topStructure(entry.movie).poster_path}`"
              :alt="topStructure(entry.movie).title"
            >
            <span class="text-light result-title">{{ topStructure(entry.movie).title }}</span>
            <span class="result-wins small ms-auto">{{ entry.wins }} win{{ entry.wins === 1 ? '' : 's' }}</span>
          </li>
        </ol>
        <div class="text-center">
          <button type="button" class="btn btn-sm btn-outline-light" @click="acknowledgeResults">Done</button>
        </div>
      </div>

      <!-- Current match (guarded so a momentary null pair can never throw
           trying to render a poster for a movie that isn't there) -->
      <div v-else-if="firstResult && secondResult" key="form" class="tweak-container rounded p-3 mb-3">
        <!-- Title -->
        <div class="text-center mb-2">
          <h5 class="text-light mb-0">Break the Tie</h5>
          <p v-if="progressLabel" class="text-light small mb-0">{{ progressLabel }}</p>
        </div>

        <!-- Two posters side by side -->
        <div class="d-flex justify-content-center gap-4">
          <div class="poster-container text-center" @click="chooseWinner(firstResult)">
            <div class="poster-wrapper">
              <img
                class="rounded poster-image"
                :src="`https://image.tmdb.org/t/p/w500${topStructure(firstResult).poster_path}`"
                :alt="topStructure(firstResult).title"
              >
            </div>
          </div>

          <div class="vs-divider d-flex align-items-center">
            <span class="text-light">vs</span>
          </div>

          <div class="poster-container text-center" @click="chooseWinner(secondResult)">
            <div class="poster-wrapper">
              <img
                class="rounded poster-image"
                :src="`https://image.tmdb.org/t/p/w500${topStructure(secondResult).poster_path}`"
                :alt="topStructure(secondResult).title"
              >
            </div>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="submitting" class="text-center">
          <span class="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></span>
          <span class="text-light ms-2">Processing...</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script>
import { getRating } from "../assets/javascript/GetRating.js";
import {
  findTiedGroup,
  createRoundRobinTournament,
  currentMatch,
  isComplete,
  recordMatchResult,
  progress,
  tweakDeltaForRank
} from "../assets/javascript/tieBreakTournament.js";

export default {
  name: "TweakInline",
  props: {
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    },
    showTweakModal: {
      type: Boolean,
      required: true
    }
  },
  emits: ['tweak-updated'],
  data () {
    return {
      showTweakInline: false,
      submitting: false,
      // Optimistic local copy of the tournament, set whenever this component
      // creates/updates it — Firebase's realtime round-trip back into
      // $store.state.settings.tieBreakTournament isn't synchronous, so
      // without this the UI would flash back to a stale state between
      // dispatch and the listener catching up. A fresh mount (no local copy
      // yet) just reads straight from the store, which is how a
      // days-spanning tournament survives across sessions.
      localTournament: null
    }
  },
  computed: {
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    allMoviesRanked () {
      const movies = [...this.$store.getters.allMoviesAsArray];
      return movies.sort(this.sortByRating);
    },
    // The full contiguous group of movies tied on rating score right now —
    // only relevant when there's no tournament already in progress (a
    // tournament's contestantIds are frozen at creation, see
    // tieBreakTournament.js, so this must never override an active one).
    tiedGroupDbKeys () {
      return findTiedGroup(this.allMoviesRanked, (movie) => getRating(movie).calculatedTotal)
        .map((movie) => movie.dbKey);
    },
    currentTournament () {
      return this.localTournament || this.$store.state.settings?.tieBreakTournament || null;
    },
    tournamentIsComplete () {
      return Boolean(this.currentTournament && isComplete(this.currentTournament));
    },
    currentMatchup () {
      if (!this.currentTournament || this.tournamentIsComplete) return null;
      return currentMatch(this.currentTournament);
    },
    firstResult () {
      if (!this.currentMatchup) return null;
      return this.allMoviesRanked.find((movie) => movie.dbKey === this.currentMatchup.a) || null;
    },
    secondResult () {
      if (!this.currentMatchup) return null;
      return this.allMoviesRanked.find((movie) => movie.dbKey === this.currentMatchup.b) || null;
    },
    progressLabel () {
      if (!this.currentTournament) return '';
      const p = progress(this.currentTournament);
      // A 2-way tie is exactly one match (round-robin on 2 contestants) — not
      // really a "tournament", so don't narrate a contestant count/match
      // progress for what's just a single pick.
      if (p.total <= 1) return '';
      return `${p.contestants} contestants · match ${p.current} of ${p.total}`;
    },
    resultsForDisplay () {
      if (!this.tournamentIsComplete) return [];
      return this.currentTournament.finalRanking
        .map((entry) => ({ ...entry, movie: this.allMoviesRanked.find((movie) => movie.dbKey === entry.dbKey) }))
        .filter((entry) => entry.movie);
    },
    // True exactly when this is visible, nothing is currently in progress,
    // and there's a fresh group to start one for.
    needsNewTournament () {
      return this.showTweakModal && !this.currentTournament && this.tiedGroupDbKeys.length >= 2;
    }
  },
  watch: {
    // Reacts to the STATE, not to showTweakModal merely changing value — with
    // "force tiebreak to show" enabled in settings, showTweakModal is pinned
    // true throughout, so a watcher on showTweakModal itself only ever fires
    // once (on mount) and never again once a tournament completes and
    // clears, leaving the next tied group undetected (reported bug: forcing
    // a tiebreak, finishing it, then tapping the next "you have a tie"
    // notice rendered nothing because no tournament existed for it to show).
    // Watching this computed instead re-fires whenever currentTournament
    // drops back to null while there's still something to start.
    needsNewTournament: {
      immediate: true,
      handler (needsOne) {
        if (needsOne) this.ensureTournamentStarted();
      }
    }
  },
  methods: {
    toggleTweakInline () {
      this.showTweakInline = true;
    },
    closeTweakInline () {
      this.showTweakInline = false;
    },
    topStructure (result) {
      if (this.currentLogIsTVLog) {
        return result.tvShow;
      } else {
        return result.movie;
      }
    },
    sortByRating (a, b) {
      const aRating = getRating(a)?.calculatedTotal;
      const bRating = getRating(b)?.calculatedTotal;

      if (aRating < bRating) {
        return 1;
      }
      if (aRating > bRating) {
        return -1;
      }

      return 0;
    },
    mostRecentRatingIndex (result) {
      let mostRecentRating = result.ratings[0];
      let mostRecentRatingIndex = 0;

      result.ratings.forEach((rating, index) => {
        const ratingDate = rating.date ? new Date(rating.date).getTime() : 0;
        const mostRecentRatingDate = mostRecentRating.date ? new Date(mostRecentRating.date).getTime() : 0;

        if (!mostRecentRating.date) {
          mostRecentRating = rating;
          mostRecentRatingIndex = index;
        } else if (ratingDate && ratingDate > mostRecentRatingDate) {
          mostRecentRating = rating;
          mostRecentRatingIndex = index;
        }
      })

      return mostRecentRatingIndex;
    },
    // Returns true if a tournament is (now) in progress, false if there was
    // nothing left to start it for — callers use this to decide whether to
    // keep the panel open on the next match or collapse it.
    ensureTournamentStarted () {
      if (this.currentTournament) return true;
      if (this.tiedGroupDbKeys.length < 2) return false;

      const tournament = createRoundRobinTournament(this.tiedGroupDbKeys);
      this.localTournament = tournament;
      this.$store.dispatch('setDBValue', { path: 'settings/tieBreakTournament', value: tournament });
      return true;
    },
    clearCompletedTournament () {
      this.localTournament = null;
      this.$store.dispatch('setDBValue', { path: 'settings/tieBreakTournament', value: null });
    },
    chooseWinner (winnerResult) {
      if (!winnerResult || !this.currentTournament) return;
      this.submitting = true;

      const updatedTournament = recordMatchResult(this.currentTournament, winnerResult.dbKey);
      this.localTournament = updatedTournament;
      this.$store.dispatch('setDBValue', { path: 'settings/tieBreakTournament', value: updatedTournament });
      this.$store.dispatch('setDBValue', { path: 'settings/lastTweak', value: Date.now() });

      if (isComplete(updatedTournament)) {
        this.applyTournamentResults(updatedTournament);

        // A 2-way tie completes in exactly one match — showing the
        // "Tournament Complete!" standings screen (which needs an explicit
        // "Done" tap) is needless ceremony for what's really just picking a
        // winner. Skip straight past it: clear this tournament and, if
        // there's another tied group, show its first match immediately
        // instead of waiting for a tap; otherwise collapse the panel.
        if (updatedTournament.contestantIds.length <= 2) {
          this.clearCompletedTournament();
          if (!this.ensureTournamentStarted()) this.closeTweakInline();
        }
      }

      this.submitting = false;

      // Emit event to parent to update data
      this.$emit('tweak-updated');
    },
    // Applies the rank-based score adjustment to every contestant in one
    // batch, once the tournament's last match has been decided. The top
    // rank (0) is left untouched, matching the old single-pair tiebreak's
    // "winner untouched, loser penalized" behavior.
    applyTournamentResults (tournament) {
      tournament.finalRanking.forEach((entry) => {
        const delta = tweakDeltaForRank(entry.rank);
        if (delta === 0) return;

        const movie = this.allMoviesRanked.find((m) => m.dbKey === entry.dbKey);
        if (!movie) return;

        const ratingIndex = this.mostRecentRatingIndex(movie);
        const currentTweakValue = movie.ratings[ratingIndex].tweakValue || 0;

        const movieWithRating = {
          ...movie,
          ratings: movie.ratings.slice().map((rating, index) => {
            if (index === ratingIndex) {
              return { ...rating, tweakValue: currentTweakValue + delta, userTweaked: true };
            }
            return rating;
          })
        };

        this.$store.dispatch('setDBValue', { path: `movieLog/${movie.dbKey}`, value: movieWithRating });
      });
    },
    acknowledgeResults () {
      this.clearCompletedTournament();
      this.closeTweakInline();
      // Immediately (rather than waiting on the watcher's next tick) start
      // the next tournament if another tied group is already sitting there —
      // most relevant with "force tiebreak" enabled, where showTweakModal
      // never toggles to re-trigger detection on its own.
      this.ensureTournamentStarted();

      // Emit event to parent to update data
      this.$emit('tweak-updated');
    }
  }
}
</script>

<style lang="scss" scoped>
// Tweak inline animation
.tweak-expand-enter-active,
.tweak-expand-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.tweak-expand-enter-from {
  opacity: 0;
}

.tweak-expand-enter-to {
  opacity: 1;
}

.tweak-expand-leave-from {
  opacity: 1;
}

.tweak-expand-leave-to {
  opacity: 0;
}

// Tweak content styling
.tweak-inline {
  .tweak-container {
    background: #4a4a4a;
    border: 1px solid #666;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition: all 0.2s ease;

    .tweak-notice-content {
      color: #fff;

      .alert-link {
        cursor: pointer;
        text-decoration: none;
        color: #fff;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    // Remove cursor pointer when showing form
    &:has(.poster-container) {
      cursor: default;
    }
  }

  .poster-container {
    cursor: pointer;
    transition: transform 0.2s ease;

    &:hover {
      transform: scale(1.05);
    }

    .poster-wrapper {
      position: relative;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      overflow: hidden;
      transition: border-color 0.2s ease;

      &:hover {
        border-color: rgba(255, 255, 255, 0.6);
      }
    }

    .poster-image {
      width: 120px;
      height: 180px;
      object-fit: cover;
      display: block;
    }
  }

  .vs-divider {
    font-size: 1.2rem;
    font-weight: bold;
    opacity: 0.7;
  }

  .tournament-results {
    max-height: 260px;
    overflow-y: auto;

    .result-rank {
      color: #ccc;
      font-weight: bold;
      min-width: 1.2rem;
      text-align: center;
    }

    .result-thumb {
      width: 32px;
      height: 48px;
      object-fit: cover;
      flex-shrink: 0;
    }

    .result-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    // Bootstrap's .text-muted (~#6c757d) fails contrast against this card's
    // #4a4a4a background — matches .result-rank's lighter grey instead.
    .result-wins {
      color: #ccc;
      flex-shrink: 0;
    }
  }

  .btn {
    min-width: 120px;
  }
}
</style>
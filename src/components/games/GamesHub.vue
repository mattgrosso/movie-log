<template>
  <div class="games-hub">
    <BackLink @click="$router.push('/')"/>
    <h1 class="games-hub-title">Games</h1>
    <p class="games-hub-subtitle">Little games built from your own rated library.</p>

    <div v-if="eligibleGameEntries.length < 4" class="not-enough-movies">
      <p>Rate at least a handful of movies (with posters) before these games have enough to work with.</p>
    </div>

    <div v-else class="game-tile-grid">
      <button
        v-for="game in games"
        :key="game.path"
        type="button"
        class="game-tile"
        @click="$router.push(game.path)"
      >
        <i :class="['bi', game.icon]"></i>
        <span class="game-tile-name">{{ game.name }}</span>
        <span class="game-tile-description">{{ game.description }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import gameDataMixin, { LAST_PLAYED_KEY } from '../../mixins/gameData.js';

export default {
  name: 'GamesHub',
  components: { BackLink },
  mixins: [gameDataMixin],
  // Landing on the hub is the "let me pick again" signal — bug report: a
  // player who finished a Wordle round and deliberately tapped back to the
  // hub still got dropped straight back into that (completed) round the
  // next time they used Home's games shortcut, because LAST_PLAYED_KEY only
  // ever got overwritten by visiting ANOTHER game, never cleared. Mixin
  // hooks run before the component's own of the same name (Vue's merge
  // order), so this runs after gameDataMixin's created() — which itself
  // skips writing anything for the hub's own route — and clears whatever
  // the previous game left behind.
  created () {
    try {
      window.localStorage.removeItem(LAST_PLAYED_KEY);
    } catch (error) {
      // localStorage can throw in private-browsing/quota-exceeded situations.
    }
  },
  data () {
    return {
      games: [
        {
          path: '/games/higher-lower',
          name: 'Higher or Lower',
          icon: 'bi-arrow-down-up',
          description: "See a movie's real score, guess whether the next one scored higher or lower. Keep your streak alive."
        },
        {
          path: '/games/wordle',
          name: 'Reel Wordle',
          icon: 'bi-grid-3x3-gap-fill',
          description: "A random movie from your library. Guess it using year/genre/director clues — as many tries and as many rounds as you want."
        },
        {
          path: '/games/connections',
          name: 'Connections',
          icon: 'bi-grid-fill',
          description: 'Find four groups of four — movies linked by shared director, genre, decade, cast, or studio.'
        },
        {
          path: '/games/six-degrees',
          name: 'Six Degrees',
          icon: 'bi-diagram-3-fill',
          description: 'Two movies, one shared-cast chain between them. Build the connection yourself, hop by hop.'
        }
      ]
    };
  }
};
</script>

<style scoped>
.games-hub {
  color: #eee;
  min-height: 100vh;
  /* top padding is a safety margin, not decoration — BackLink is fixed at
     (6,6) of the viewport regardless of whether the global Header currently
     has any real height (e.g. a direct/fresh navigation before Home ever
     set a banner leaves it at 0px), so without this the back-link and this
     screen's own h1 can visually overlap. Same fix in the 4 game components. */
  padding: 2.5rem 0 2rem;
}

.games-hub-title {
  margin: 0.5rem 1rem 0;
}

.games-hub-subtitle {
  color: #adb5bd;
  margin: 0.25rem 1rem 1.5rem;
}

.not-enough-movies {
  color: #adb5bd;
  margin: 2rem;
  text-align: center;
}

.game-tile-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  margin: 0 1rem;
}

@media (min-width: 600px) {
  .game-tile-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.game-tile {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 0.5rem;
  color: #eee;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1.25rem;
  text-align: left;
}

.game-tile:active {
  background: #242424;
  border-color: #666;
}

.game-tile i {
  color: #ffc107;
  font-size: 1.6rem;
}

.game-tile-name {
  font-size: 1.15rem;
  font-weight: 600;
}

.game-tile-description {
  color: #adb5bd;
  font-size: 0.85rem;
}
</style>

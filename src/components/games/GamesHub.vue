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
import gameDataMixin from '../../mixins/gameData.js';

export default {
  name: 'GamesHub',
  components: { BackLink },
  mixins: [gameDataMixin],
  data () {
    return {
      games: [
        {
          path: '/games/rate-off',
          name: 'Rate-Off',
          icon: 'bi-trophy-fill',
          description: 'A single-elimination bracket of your own posters — pick a favorite each round until a champion remains.'
        },
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
          description: "One movie from your library, picked fresh each day. Guess it in 6 tries using year/genre/director clues."
        },
        {
          path: '/games/quiz',
          name: 'Taste Quiz',
          icon: 'bi-patch-question-fill',
          description: 'A multiple-choice quiz generated from your own viewing stats. How well do you know your taste?'
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
  padding-bottom: 2rem;
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

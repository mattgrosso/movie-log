<template>
  <div class="game-stats-screen">
    <BackLink label="Games" @click="$router.push('/games')"/>
    <h1 class="stats-title">Game Stats</h1>
    <p class="stats-subtitle">How your games have gone, round by round.</p>

    <div v-if="!gamesWithData.length" class="no-stats">
      <p>No rounds recorded yet — finish a round of any game and it'll show up here.</p>
    </div>

    <div v-for="game in gamesWithData" :key="game.key" class="game-stats-card">
      <div class="game-stats-header">
        <i :class="['bi', game.icon]"></i>
        <span class="game-stats-name">{{ game.name }}</span>
        <span class="game-stats-plays">{{ game.plays }} session{{ game.plays === 1 ? '' : 's' }}</span>
      </div>

      <div v-if="game.stats.length" class="game-stat-lines">
        <div v-for="line in game.stats" :key="line.label" class="game-stat-line">
          <span class="game-stat-label">{{ line.label }}</span>
          <span class="game-stat-value">{{ line.value }}</span>
        </div>
      </div>
      <p v-else class="game-stats-pending">Rounds finished from here on will be recorded.</p>

      <!-- Newest first, capped — the "history" half of the request. -->
      <div v-if="game.recentRounds.length" class="recent-rounds">
        <span
          v-for="(round, index) in game.recentRounds"
          :key="`${game.key}-${index}`"
          class="round-chip"
        >{{ round }}</span>
      </div>
    </div>
  </div>
</template>

<script>
// Feature request: "Let's add a history for each game with some good
// statistics on how they've gone." Round records are written by each game
// via gameData.recordGameRound (settings/games/history/<key>, capped);
// this screen reads them plus the lifetime session counters. Deliberately
// does NOT use the gameData mixin — its created() counts a play session
// for any /games/* route, and looking at stats is not playing.
import BackLink from './BackLink.vue';
import { GAME_ICONS, GAME_NAMES } from '../../mixins/gameData.js';
import { summarizeGame, formatRound } from '../../assets/javascript/games/gameHistory.js';

const RECENT_ROUNDS_SHOWN = 8;

export default {
  name: 'GameStatsScreen',
  components: { BackLink },
  computed: {
    gamesWithData () {
      const games = this.$store.state.settings?.games || {};
      const plays = games.plays || {};
      const history = games.history || {};

      return Object.entries(GAME_NAMES)
        .map(([path, name]) => {
          const key = path.slice('/games/'.length);
          const records = Array.isArray(history[key]) ? history[key] : Object.values(history[key] || {});
          return {
            key,
            name,
            icon: GAME_ICONS[path],
            plays: plays[key] || 0,
            stats: summarizeGame(key, records),
            recentRounds: [...records]
              .slice(-RECENT_ROUNDS_SHOWN)
              .reverse()
              .map((record) => formatRound(key, record))
          };
        })
        .filter((game) => game.plays > 0 || game.recentRounds.length > 0)
        // Most-played first, matching the hub's own ordering logic.
        .sort((a, b) => b.plays - a.plays);
    }
  }
};
</script>

<style lang="scss" scoped>
.game-stats-screen {
  color: #eee;
  /* Safety margin against BackLink overlap — same as every game screen. */
  padding: 2.5rem 1rem 2rem;
}

.stats-title {
  margin: 0.5rem 0 0;
}

.stats-subtitle {
  color: #adb5bd;
  font-size: 0.85rem;
  margin: 0.25rem 0 1.25rem;
}

.no-stats {
  color: #adb5bd;
  margin-top: 2rem;
  text-align: center;
}

.game-stats-card {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
  padding: 0.75rem 0.9rem;
}

.game-stats-header {
  align-items: center;
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;

  i {
    color: #ffc107;
  }
}

.game-stats-name {
  font-weight: 600;
}

.game-stats-plays {
  color: #adb5bd;
  font-size: 0.75rem;
  margin-left: auto;
}

.game-stat-lines {
  display: grid;
  gap: 0.25rem 1rem;
  grid-template-columns: 1fr 1fr;
}

.game-stat-line {
  display: flex;
  font-size: 0.8rem;
  justify-content: space-between;
}

.game-stat-label {
  color: #adb5bd;
}

.game-stat-value {
  color: #eee;
  font-weight: 600;
}

.game-stats-pending {
  color: #adb5bd;
  font-size: 0.78rem;
  margin: 0;
}

.recent-rounds {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.6rem;
}

.round-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #333;
  border-radius: 999px;
  color: #ccc;
  font-size: 0.7rem;
  padding: 0.15rem 0.55rem;
}
</style>

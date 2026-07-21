<template>
  <div class="rate-off-game">
    <BackLink label="Games" @click="$router.push('/games')"/>
    <h1 class="game-title">Rate-Off</h1>

    <div v-if="!bracket" class="setup">
      <p>Pick a bracket size and tap your favorite poster each round until a champion remains.</p>
      <div class="size-buttons">
        <button
          v-for="size in availableSizes"
          :key="size"
          type="button"
          class="btn btn-outline-warning size-button"
          @click="start(size)"
        >
          {{ size }}
        </button>
      </div>
    </div>

    <div v-else-if="champion" class="champion-reveal">
      <p class="champion-label">Champion</p>
      <img v-if="gamePosterUrl(champion)" :src="gamePosterUrl(champion, 'w500')" :alt="champion.movie.title" class="champion-poster">
      <h2>{{ champion.movie.title }}</h2>
      <button type="button" class="btn btn-warning mt-3" @click="reset">New Tournament</button>
    </div>

    <div v-else class="matchup">
      <p class="progress-label">Round {{ progress.round }} &middot; Match {{ progress.current }} of {{ progress.total }}</p>
      <div class="matchup-cards">
        <button
          v-for="entry in pair"
          :key="entryKeyFor(entry)"
          type="button"
          class="matchup-card"
          @click="choose(entry)"
        >
          <img v-if="gamePosterUrl(entry)" :src="gamePosterUrl(entry, 'w500')" :alt="entry.movie.title">
          <span class="matchup-card-title">{{ entry.movie.title }}</span>
        </button>
      </div>
      <p class="vs-label">vs</p>
    </div>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { createBracket, pickWinner, currentPair, roundProgress } from '../../assets/javascript/games/bracket.js';
import { shuffle, entryKey } from '../../assets/javascript/games/gameUtils.js';

export default {
  name: 'RateOffGame',
  components: { BackLink },
  mixins: [gameDataMixin],
  data () {
    return {
      bracket: null
    };
  },
  computed: {
    availableSizes () {
      return [8, 16, 32].filter((size) => this.eligibleGameEntries.length >= size);
    },
    pair () {
      return this.bracket ? currentPair(this.bracket) : null;
    },
    champion () {
      return this.bracket ? this.bracket.champion : null;
    },
    progress () {
      return this.bracket ? roundProgress(this.bracket) : null;
    }
  },
  methods: {
    entryKeyFor: entryKey,
    start (size) {
      const pool = shuffle(this.eligibleGameEntries, Math.random);
      this.bracket = createBracket(pool, size);
    },
    choose (entry) {
      this.bracket = pickWinner(this.bracket, entryKey(entry));
    },
    reset () {
      this.bracket = null;
    }
  }
};
</script>

<style scoped>
.rate-off-game {
  color: #eee;
  min-height: 100vh;
  padding-bottom: 2rem;
  text-align: center;
}

.game-title {
  margin: 0.5rem 0 1rem;
}

.setup p {
  color: #adb5bd;
  margin: 0 1.5rem 1.5rem;
}

.size-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.size-button {
  min-width: 4rem;
}

.progress-label {
  color: #adb5bd;
  margin-bottom: 1rem;
}

.matchup-cards {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  padding: 0 0.5rem;
}

.matchup-card {
  background: transparent;
  border: 2px solid #333;
  border-radius: 0.5rem;
  color: #eee;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
  width: 45vw;
  max-width: 220px;
}

.matchup-card:active {
  border-color: #ffc107;
}

.matchup-card img {
  border-radius: 0.35rem;
  width: 100%;
}

.matchup-card-title {
  font-size: 0.85rem;
  font-weight: 600;
}

.vs-label {
  color: #666;
  margin-top: 1rem;
}

.champion-reveal {
  padding: 1rem 1.5rem;
}

.champion-label {
  color: #ffc107;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.champion-poster {
  border-radius: 0.5rem;
  max-width: 280px;
  width: 100%;
}
</style>

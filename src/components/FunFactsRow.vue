<template>
  <section v-if="facts.length" class="fun-facts">
    <div class="fun-facts-header">
      <h2 class="fun-facts-title">Fun Facts</h2>
      <button type="button" class="fun-facts-more" @click="$router.push('/stats')">
        Deep Stats <i class="bi bi-chevron-right"></i>
      </button>
    </div>
    <div class="fun-facts-row">
      <div v-for="fact in facts" :key="fact.key" class="fun-fact-card">
        <span class="fun-fact-label">{{ fact.label }}</span>
        <span class="fun-fact-value">{{ fact.value }}</span>
        <span v-if="fact.detail" class="fun-fact-detail">{{ fact.detail }}</span>
      </div>
    </div>
  </section>
</template>

<script>
// The "more fun data about my ratings and watching habits" request, wired
// at last (board item 8): funFacts.js has been pure and tested since the
// overnight build — this is just the shelf it sits on. Lives at the top of
// Insights; fully offline (store reads only).
import { getRating } from '../assets/javascript/GetRating.js';
import { allFunFacts } from '../assets/javascript/funFacts.js';

export default {
  name: 'FunFactsRow',
  computed: {
    facts () {
      return allFunFacts(this.$store.getters.allMoviesAsArray || [], getRating);
    }
  }
};
</script>

<style lang="scss" scoped>
.fun-facts {
  margin: 0 0 1rem;
}

.fun-facts-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.fun-facts-more {
  background: none;
  border: none;
  color: #ffc107;
  font-size: 0.8rem;
  min-height: 36px;
}

.fun-facts-more:active {
  opacity: 0.6;
}

.fun-facts-title {
  color: #eee;
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
}

.fun-facts-row {
  display: flex;
  gap: 0.6rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;
}

.fun-fact-card {
  background: #161616;
  border: 1px solid #2e2e2e;
  border-radius: 10px;
  display: flex;
  flex: 0 0 190px;
  flex-direction: column;
  padding: 0.75rem 0.9rem;
  row-gap: 0.25rem;
}

.fun-fact-label {
  color: #ccc;
  font-size: 0.72rem;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.fun-fact-value {
  color: #ffc107;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.15;
}

.fun-fact-detail {
  color: #ccc;
  font-size: 0.75rem;
  line-height: 1.3;
}
</style>

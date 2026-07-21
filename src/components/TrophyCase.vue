<template>
  <div class="trophy-case">
    <div class="home-link" @click="returnHome">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-left-fill" viewBox="0 0 16 16">
        <path d="m3.86 8.753 5.482 4.796c.646.566 1.658.106 1.658-.753V3.204a1 1 0 0 0-1.659-.753l-5.48 4.796a1 1 0 0 0 0 1.506z"/>
      </svg>
      <span>Home</span>
    </div>

    <h1 class="trophy-case-title">Trophy Case</h1>

    <div v-if="totalWins === 0" class="empty-state">
      <p>No personal awards completed yet — wins will show up here once you've picked a winner in at least one category.</p>
    </div>

    <template v-else>
      <p class="trophy-case-subtitle">{{ totalWins }} award{{ totalWins === 1 ? '' : 's' }} across {{ yearsRepresented }} year{{ yearsRepresented === 1 ? '' : 's' }}</p>

      <div v-if="mostDecoratedPeople.length" class="most-decorated">
        <h2 class="section-title">Most Decorated</h2>
        <div class="decorated-list">
          <div v-for="person in mostDecoratedPeople" :key="person.name" class="decorated-person" @click="goToMovie(person.wins[0])">
            <img v-if="winnerImage(person.wins[0])" :src="winnerImage(person.wins[0])" :alt="person.name" class="decorated-photo">
            <div v-else class="decorated-photo decorated-photo-placeholder">{{ person.name.charAt(0) }}</div>
            <div class="decorated-name">{{ person.name }}</div>
            <div class="decorated-count">{{ person.count }}&times; winner</div>
          </div>
        </div>
      </div>

      <div v-for="category in categoriesInOrder" :key="category.key" class="trophy-category">
        <h2 class="section-title">{{ category.name }}</h2>
        <div class="trophy-row">
          <div v-for="win in categorizedWins[category.key]" :key="`${win.year}-${winnerKey(win.expanded)}`" class="trophy-card" @click="goToMovie(win)">
            <img v-if="winnerImage(win.expanded)" :src="winnerImage(win.expanded)" :alt="winnerTitle(win.expanded)" class="trophy-image">
            <div v-else class="trophy-image trophy-image-placeholder">{{ winnerTitle(win.expanded).charAt(0) }}</div>
            <div class="trophy-year">{{ win.year }}</div>
            <div class="trophy-title">{{ winnerTitle(win.expanded) }}</div>
            <div v-if="win.expanded.movie && win.expanded.name" class="trophy-subtitle">{{ win.expanded.movie.title }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { PERSONAL_AWARD_CATEGORIES } from '../assets/javascript/personalAwardsCategories.js';
import { expandNomineeFromMinimal } from '../assets/javascript/personalAwards.js';

export default {
  name: 'TrophyCase',
  created () {
    this.$store.commit('setShowHeader', false);
  },
  beforeUnmount () {
    this.$store.commit('setShowHeader', true);
  },
  computed: {
    // Every personal-award WIN, expanded to a displayable object and grouped
    // by category key, sorted newest-year-first within each category.
    categorizedWins () {
      const personalAwards = this.$store.state.settings?.personalAwards || {};
      const library = this.$store.getters.allMediaAsArray;
      const byCategory = {};

      Object.keys(personalAwards).forEach((year) => {
        const categories = personalAwards[year]?.categories || {};
        Object.keys(categories).forEach((categoryKey) => {
          const winner = categories[categoryKey]?.winner;
          if (!winner) return;

          const expanded = expandNomineeFromMinimal(winner, library);
          if (!expanded) return;

          if (!byCategory[categoryKey]) byCategory[categoryKey] = [];
          byCategory[categoryKey].push({ year: Number(year), expanded });
        });
      });

      Object.values(byCategory).forEach((wins) => wins.sort((a, b) => b.year - a.year));

      return byCategory;
    },
    categoriesInOrder () {
      return PERSONAL_AWARD_CATEGORIES.filter((category) => this.categorizedWins[category.key]?.length);
    },
    totalWins () {
      return Object.values(this.categorizedWins).reduce((sum, wins) => sum + wins.length, 0);
    },
    yearsRepresented () {
      const years = new Set();
      Object.values(this.categorizedWins).forEach((wins) => wins.forEach((win) => years.add(win.year)));
      return years.size;
    },
    // Person-type winners who've won more than once, ranked by win count —
    // the "show off people" angle: recurring favorites across categories/years.
    mostDecoratedPeople () {
      const counts = {};

      Object.values(this.categorizedWins).forEach((wins) => {
        wins.forEach((win) => {
          const { expanded } = win;
          if (!expanded.name || !expanded.movieId) return; // movie-type win, not a person

          if (!counts[expanded.name]) {
            counts[expanded.name] = { name: expanded.name, count: 0, wins: [] };
          }
          counts[expanded.name].count += 1;
          counts[expanded.name].wins.push(win);
        });
      });

      return Object.values(counts)
        .filter((person) => person.count > 1)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }
  },
  methods: {
    winnerKey (expanded) {
      return expanded.id || expanded.movie?.id || expanded.name;
    },
    winnerTitle (expanded) {
      return expanded.name || expanded.movie?.title || 'Unknown';
    },
    winnerImage (expanded) {
      if (expanded.details?.profile_path) {
        return `https://image.tmdb.org/t/p/w185${expanded.details.profile_path}`;
      }
      if (expanded.movie?.poster_path) {
        return `https://image.tmdb.org/t/p/w185${expanded.movie.poster_path}`;
      }
      return null;
    },
    goToMovie (win) {
      const movieId = win.expanded.movie?.id || win.expanded.movieId;
      if (movieId) {
        this.$router.push(`/movie/${movieId}`);
      }
    },
    returnHome () {
      this.$store.commit('setShowHeader', true);
      this.$router.push('/');
    }
  }
};
</script>

<style lang="scss" scoped>
.trophy-case {
  color: #eee;
  min-height: 100vh;
  padding: 0 1rem 2rem;
}

.home-link {
  align-items: center;
  color: white;
  column-gap: 4px;
  cursor: pointer;
  display: flex;
  padding: 12px 0;
}

.home-link:active {
  opacity: 0.7;
}

.trophy-case-title {
  margin: 0.25rem 0 0;
}

.trophy-case-subtitle {
  color: #adb5bd;
  margin-bottom: 1.5rem;
}

.empty-state {
  color: #adb5bd;
  margin-top: 2rem;
  text-align: center;
}

.section-title {
  border-bottom: 1px solid #333;
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.35rem;
}

.trophy-category {
  margin-bottom: 1.75rem;
}

.trophy-row,
.decorated-list {
  display: flex;
  gap: 0.9rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;
}

.trophy-card,
.decorated-person {
  cursor: pointer;
  flex: 0 0 auto;
  text-align: center;
  width: 100px;
}

.trophy-image,
.decorated-photo {
  border-radius: 0.35rem;
  height: 140px;
  object-fit: cover;
  width: 100px;
}

.trophy-image-placeholder,
.decorated-photo-placeholder {
  align-items: center;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #666;
  display: flex;
  font-size: 2rem;
  justify-content: center;
}

.trophy-year {
  color: #ffc107;
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 0.35rem;
}

.trophy-title,
.decorated-name {
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
  margin-top: 0.1rem;
}

.trophy-subtitle {
  color: #adb5bd;
  font-size: 0.7rem;
  line-height: 1.2;
}

.decorated-count {
  color: #ffc107;
  font-size: 0.7rem;
}

.most-decorated {
  margin-bottom: 2rem;
}
</style>

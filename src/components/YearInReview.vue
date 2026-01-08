<template>
  <div class="year-in-review">
    <!-- Header -->
    <div class="page-header">
      <h2 class="page-title">Year in Review</h2>
      <!-- Year Selector -->
      <div class="year-selector">
        <select v-model="selectedYear" class="form-select" data-bs-theme="dark">
          <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
        </select>
      </div>
    </div>

    <div class="page-content">
      <!-- Hero Stats -->
      <div class="hero-stats row g-2 mb-2">
        <div class="col-6">
          <div class="stat-card stat-card-watched">
            <div class="stat-label text-white">You watched</div>
            <div class="stat-value text-white">{{ moviesWatchedCount }}</div>
            <div class="stat-sublabel text-white">movies in {{ selectedYear }}</div>
          </div>
        </div>
        <div class="col-6">
          <div class="stat-card stat-card-rated">
            <div class="stat-label text-white">You rated</div>
            <div class="stat-value text-white">{{ moviesRatedCount }}</div>
            <div class="stat-sublabel text-white">movies from {{ selectedYear }}</div>
          </div>
        </div>
      </div>

      <!-- Time Stats -->
      <div class="time-stats card mb-3">
        <div class="card-body text-white">
          <p class="mb-1 text-white small">Time spent watching movies:</p>
          <p class="time-display mb-1 text-white">
            <strong>{{ timeStats.days }}</strong> days,
            <strong>{{ timeStats.hours }}</strong> hours,
            <strong>{{ timeStats.minutes }}</strong> minutes
            <span class="text-muted small">({{ totalMinutes.toLocaleString() }} total minutes)</span>
          </p>
          <p class="text-white small mb-0">That is about <strong class="text-white">{{ percentOfYear }}%</strong> of your waking hours.</p>
        </div>
      </div>

      <!-- Movies by Month Chart -->
      <div class="chart-section card text-bg-dark mb-3">
        <div class="card-body">
          <h5 class="card-title text-white mb-2"># of Movies by Month</h5>
          <BarChart :chartData="monthlyChartData" :options="monthlyChartOptions" />
        </div>
      </div>

      <!-- Top Actors -->
      <div class="top-actors card text-bg-dark mb-3" v-if="topActors.length > 0">
        <div class="card-body">
          <h5 class="card-title mb-2 text-white">Top Actors</h5>
          <div class="actor-grid">
            <div v-for="actor in topActors.slice(0, 5)" :key="actor.id" class="actor-card">
              <img
                v-if="actor.profile_path"
                :src="`https://image.tmdb.org/t/p/w185${actor.profile_path}`"
                :alt="actor.name"
                class="actor-image"
              />
              <div v-else class="actor-image-placeholder">
                <i class="bi bi-person-fill"></i>
              </div>
              <div class="actor-name text-white">{{ actor.name }}</div>
              <div class="actor-count text-white-50">{{ actor.count }} movie{{ actor.count > 1 ? 's' : '' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Directors -->
      <div class="top-directors card text-bg-dark mb-3" v-if="topDirectors.length > 0">
        <div class="card-body">
          <h5 class="card-title mb-2 text-white">Top Directors</h5>
          <div class="list-group list-group-flush">
            <div v-for="(director, index) in topDirectors.slice(0, 5)" :key="director.name" class="list-group-item bg-dark text-white d-flex justify-content-between align-items-center">
              <span class="text-white"><strong>{{ index + 1 }}.</strong> {{ director.name }}</span>
              <span class="badge director-badge text-white rounded-pill" :class="`director-badge-${index % 3}`">{{ director.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { BarChart } from 'vue-chart-3';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export default {
  name: 'YearInReview',
  components: {
    BarChart
  },
  data() {
    return {
      selectedYear: new Date().getFullYear() - 1, // Default to last year
      actorDetails: {} // Store fetched actor details
    };
  },
  watch: {
    selectedYear() {
      this.fetchActorDetails();
    }
  },
  mounted() {
    this.$nextTick(() => {
      // Scroll to top of Year in Review component
      const yearInReview = document.querySelector('.year-in-review');
      if (yearInReview) {
        yearInReview.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
      this.fetchActorDetails();
    });
  },
  computed: {
    availableYears() {
      const years = new Set();
      this.$store.getters.allMediaAsArray.forEach(entry => {
        if (entry.ratings && entry.ratings.length > 0) {
          entry.ratings.forEach(rating => {
            if (rating.date) {
              const year = new Date(parseInt(rating.date)).getFullYear();
              years.add(year);
            }
          });
        }
      });
      return Array.from(years).sort((a, b) => b - a);
    },
    includeShorts() {
      return this.$store.state.settings?.includeShorts === true;
    },
    allWatchedMoviesInYear() {
      return this.$store.getters.allMediaAsArray.filter(entry => {
        return entry.ratings && entry.ratings.some(rating => {
          if (!rating.date) return false;
          const ratingYear = new Date(parseInt(rating.date)).getFullYear();
          return ratingYear === this.selectedYear;
        });
      });
    },
    watchedMoviesInYear() {
      if (this.includeShorts) return this.allWatchedMoviesInYear;

      // Exclude shorts: genre 'Short' or runtime <= 40
      return this.allWatchedMoviesInYear.filter(entry => {
        const genres = entry.movie.genres || [];
        const isShortGenre = genres.some(g => g.name && g.name.toLowerCase() === 'short');
        const runtime = entry.movie.runtime;
        return !isShortGenre && !(runtime && runtime <= 40);
      });
    },
    releasedMoviesInYear() {
      return this.$store.getters.allMediaAsArray.filter(entry => {
        if (!entry.movie.release_date) return false;
        const releaseYear = new Date(entry.movie.release_date).getFullYear();
        return releaseYear === this.selectedYear;
      });
    },
    moviesWatchedCount() {
      return this.watchedMoviesInYear.length;
    },
    moviesRatedCount() {
      return this.releasedMoviesInYear.length;
    },
    totalMinutes() {
      let total = 0;
      this.watchedMoviesInYear.forEach(entry => {
        if (entry.movie.runtime) {
          total += entry.movie.runtime;
        }
      });
      return total;
    },
    timeStats() {
      const days = Math.floor(this.totalMinutes / (60 * 24));
      const hours = Math.floor((this.totalMinutes % (60 * 24)) / 60);
      const minutes = this.totalMinutes % 60;
      return { days, hours, minutes };
    },
    percentOfYear() {
      // Assuming 16 waking hours per day, 365 days
      const wakingMinutesInYear = 16 * 60 * 365;
      const percent = (this.totalMinutes / wakingMinutesInYear) * 100;
      return percent.toFixed(1);
    },
    moviesByMonth() {
      const months = Array(12).fill(0);
      this.watchedMoviesInYear.forEach(entry => {
        entry.ratings.forEach(rating => {
          if (rating.date) {
            const date = new Date(parseInt(rating.date));
            if (date.getFullYear() === this.selectedYear) {
              months[date.getMonth()]++;
            }
          }
        });
      });
      return months;
    },
    monthlyChartData() {
      // Create gradient colors for each bar
      const barColors = this.moviesByMonth.map((_, index) => {
        const colorSets = [
          '#667eea', // purple
          '#f093fb', // pink
          '#4facfe'  // cyan
        ];
        return colorSets[index % 3];
      });

      return {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          label: 'Movies Watched',
          data: this.moviesByMonth,
          backgroundColor: barColors,
          borderWidth: 0,
          borderRadius: 8,
          borderSkipped: false
        }]
      };
    },
    monthlyChartOptions() {
      return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 5,
              color: '#adb5bd'
            },
            grid: {
              color: '#495057'
            }
          },
          x: {
            ticks: {
              color: '#adb5bd'
            },
            grid: {
              color: '#495057'
            }
          }
        }
      };
    },
    topActors() {
      const actorCounts = {};

      this.watchedMoviesInYear.forEach(entry => {
        if (entry.movie.cast) {
          entry.movie.cast.slice(0, 10).forEach(castMember => {
            if (castMember.name) {
              actorCounts[castMember.name] = (actorCounts[castMember.name] || 0) + 1;
            }
          });
        }
      });

      return Object.entries(actorCounts)
        .map(([name, count]) => ({
          name,
          count,
          id: this.actorDetails[name]?.id || name,
          profile_path: this.actorDetails[name]?.profile_path
        }))
        .sort((a, b) => b.count - a.count);
    },
    topDirectors() {
      const directorCounts = {};

      this.watchedMoviesInYear.forEach(entry => {
        if (entry.movie.crew) {
          const directors = entry.movie.crew.filter(member => member.job === 'Director');
          directors.forEach(director => {
            if (director.name) {
              directorCounts[director.name] = (directorCounts[director.name] || 0) + 1;
            }
          });
        }
      });

      return Object.entries(directorCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    },
    topGenres() {
      const genreCounts = {};

      this.watchedMoviesInYear.forEach(entry => {
        if (entry.movie.genres) {
          entry.movie.genres.forEach(genre => {
            if (genre.name) {
              genreCounts[genre.name] = (genreCounts[genre.name] || 0) + 1;
            }
          });
        }
      });

      return Object.entries(genreCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    },
    bestRatedMovies() {
      return this.releasedMoviesInYear
        .map(entry => {
          const mostRecentRating = entry.ratings[entry.ratings.length - 1];
          return {
            ...entry.movie,
            rating: mostRecentRating?.calculatedTotal || 0
          };
        })
        .sort((a, b) => b.rating - a.rating);
    },
    longestMovie() {
      let longest = null;
      this.watchedMoviesInYear.forEach(entry => {
        if (entry.movie.runtime && (!longest || entry.movie.runtime > longest.runtime)) {
          longest = entry.movie;
        }
      });
      return longest;
    },
    shortestMovie() {
      let shortest = null;
      this.watchedMoviesInYear.forEach(entry => {
        if (entry.movie.runtime && entry.movie.runtime > 0 && (!shortest || entry.movie.runtime < shortest.runtime)) {
          shortest = entry.movie;
        }
      });
      return shortest;
    },
    oldestMovie() {
      let oldest = null;
      this.watchedMoviesInYear.forEach(entry => {
        if (entry.movie.release_date && (!oldest || new Date(entry.movie.release_date) < new Date(oldest.release_date))) {
          oldest = entry.movie;
        }
      });
      return oldest;
    },
    busiestMonth() {
      const maxCount = Math.max(...this.moviesByMonth);
      const monthIndex = this.moviesByMonth.indexOf(maxCount);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return {
        month: months[monthIndex],
        count: maxCount
      };
    },
    averageRating() {
      if (this.watchedMoviesInYear.length === 0) return 0;
      const sum = this.watchedMoviesInYear.reduce((acc, entry) => {
        const rating = entry.ratings[entry.ratings.length - 1]?.calculatedTotal || 0;
        return acc + rating;
      }, 0);
      return (sum / this.watchedMoviesInYear.length).toFixed(1);
    },
    mostCommonDecade() {
      const decadeCounts = {};
      this.watchedMoviesInYear.forEach(entry => {
        if (entry.movie.release_date) {
          const year = new Date(entry.movie.release_date).getFullYear();
          const decade = Math.floor(year / 10) * 10;
          decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
        }
      });

      const decades = Object.entries(decadeCounts).map(([decade, count]) => ({
        decade: `${decade}s`,
        count
      }));

      decades.sort((a, b) => b.count - a.count);
      return decades[0] || { decade: 'N/A', count: 0 };
    }
  },
  methods: {
    returnHome() {
      this.$router.push('/insights');
    },
    goToMovie(movie) {
      this.$router.push(`/movie/${movie.id}`);
    },
    getBadgeSizeClass(index) {
      if (index === 0) return 'bg-primary';
      if (index === 1) return 'bg-info';
      if (index === 2) return 'bg-success';
      return 'bg-secondary';
    },
    getGenreFontSize(index) {
      if (index === 0) return '1rem';
      if (index === 1) return '0.9rem';
      if (index === 2) return '0.85rem';
      return '0.75rem';
    },
    async fetchActorDetails() {
      // Get top actors from current year
      const actorCounts = {};

      this.watchedMoviesInYear.forEach(entry => {
        if (entry.movie.cast) {
          entry.movie.cast.slice(0, 10).forEach(castMember => {
            if (castMember.name) {
              actorCounts[castMember.name] = (actorCounts[castMember.name] || 0) + 1;
            }
          });
        }
      });

      // Get top 5 actors
      const topActorNames = Object.entries(actorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      // Fetch details for each
      const newDetails = {};
      for (const name of topActorNames) {
        const query = encodeURIComponent(name);
        const url = `https://api.themoviedb.org/3/search/person?api_key=${process.env.VUE_APP_TMDB_API_KEY}&query=${query}`;

        try {
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
              newDetails[name] = data.results[0];
            }
          }
        } catch (error) {
          console.error('Error fetching actor details:', error);
        }
      }

      this.actorDetails = newDetails;
    }
  }
};
</script>

<style scoped lang="scss">
.year-in-review {
  position: relative;
  min-height: 100vh;
  padding-bottom: 4rem;
  color: #ffffff;

  // Force all text to be white
  h1, h2, h3, h4, h5, h6, p, span, li, div, strong {
    color: #ffffff;
  }

  .text-muted {
    color: rgba(255, 255, 255, 0.6) !important;
  }

  .badge {
    color: #ffffff !important;
  }

  .page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  padding: 1.25rem 1rem;
  margin-bottom: 0.75rem;
  border-bottom: 3px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);

  .page-title {
    text-align: center;
    margin: 0 0 0.75rem 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: #ffffff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    letter-spacing: 0.5px;
  }

  .year-selector {
    display: flex;
    justify-content: center;

    select {
      text-align: center;
      font-weight: 600;
      font-size: 1rem;
      background: rgba(255, 255, 255, 0.15);
      border: 2px solid rgba(255, 255, 255, 0.3);
      color: #ffffff;
      padding: 0.5rem 1.5rem;
      border-radius: 25px;
      backdrop-filter: blur(10px);
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.25);
        border-color: rgba(255, 255, 255, 0.5);
        transform: translateY(-1px);
      }

      &:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
      }

      option {
        background: #212529;
        color: #ffffff;
      }
    }
  }
}

  .page-content {
    padding: 0.75rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .hero-stats {
  .stat-card {
    border-radius: 0.5rem;
    padding: 0.75rem;
    text-align: center;
    color: white;
    border: 2px solid;

    .stat-label {
      font-size: 0.75rem;
      margin-bottom: 0.25rem;
      opacity: 0.9;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      line-height: 1;
      margin-bottom: 0.25rem;
    }

    .stat-sublabel {
      font-size: 0.7rem;
      opacity: 0.9;
    }

    &.stat-card-watched {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: #8b5cf6;
    }

    &.stat-card-rated {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      border-color: #ec4899;
    }
    }
  }

  .time-stats {
    background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
    border: 2px solid #06b6d4;
    border-radius: 0.5rem;

    .card-body {
      padding: 0.75rem;
    }

    .time-display {
      font-size: 0.95rem;
    }
  }

  .chart-section {
    canvas {
      max-height: 250px;
    }
  }

  .actor-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;

    .actor-card {
      text-align: center;
      position: relative;

      .actor-rank {
        position: absolute;
        top: -5px;
        left: -5px;
        background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
        color: #1a1d20;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 0.75rem;
        z-index: 1;
        border: 2px solid #212529;
        box-shadow: 0 2px 4px rgba(255, 215, 0, 0.3);
      }

      .actor-image,
      .actor-image-placeholder {
        width: 100%;
        aspect-ratio: 2/3;
        object-fit: cover;
        border-radius: 0.3rem;
        margin-bottom: 0.25rem;
      }

      .actor-image-placeholder {
        background: #495057;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        color: #adb5bd;
      }

      .actor-name {
        font-weight: 500;
        font-size: 0.7rem;
        margin-bottom: 0.1rem;
        line-height: 1.1;
      }

      .actor-count {
        font-size: 0.65rem;
        color: #adb5bd;
      }
    }
  }

  .top-directors {
    .director-badge {
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border: 1px solid;

      &.director-badge-0 {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        border-color: #8b5cf6;
      }

      &.director-badge-1 {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%) !important;
        border-color: #ec4899;
      }

      &.director-badge-2 {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%) !important;
        border-color: #06b6d4;
      }
    }
  }

  .genre-cloud {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25rem;

    .badge {
      transition: transform 0.2s;
      cursor: default;
      padding: 0.25rem 0.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      border: 1px solid #8b5cf6;

      &:hover {
        transform: scale(1.05);
      }

      &:nth-child(3n+2) {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%) !important;
        border-color: #ec4899;
      }

      &:nth-child(3n+3) {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%) !important;
        border-color: #06b6d4;
      }
    }
  }

  .movie-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.75rem;

    .movie-poster-card {
      cursor: pointer;
      position: relative;
      transition: transform 0.2s;

      &:hover {
        transform: scale(1.05);
      }

      .movie-poster,
      .movie-poster-placeholder {
        width: 100%;
        aspect-ratio: 2/3;
        object-fit: cover;
        border-radius: 0.4rem;
      }

      .movie-poster-placeholder {
        background: #495057;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2.5rem;
        color: #adb5bd;
      }

      .movie-rating-badge {
        position: absolute;
        bottom: 6px;
        right: 6px;
        background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
        color: #1a1d20;
        padding: 0.2rem 0.4rem;
        border-radius: 0.25rem;
        font-weight: bold;
        font-size: 0.7rem;
        border: 1px solid rgba(255, 215, 0, 0.5);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }
    }
  }

  .fun-facts {
    ul li {
      padding: 0.35rem 0;
      border-bottom: 1px solid #495057;
      font-size: 0.9rem;

      &:last-child {
        border-bottom: none;
      }
    }
  }
}
</style>

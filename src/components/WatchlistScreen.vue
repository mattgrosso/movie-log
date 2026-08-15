<template>
  <div class="watchlist-screen">
    <BackLink label="Home" @click="$router.push('/')"/>
    <h1 class="watchlist-title">Watchlist</h1>
    <p class="watchlist-subtitle">Built from your own ratings — what to revisit, and what to see next.</p>

    <!-- Local, always available: movies you loved but haven't logged in a
         long time. -->
    <section v-if="rewatchList.length" class="watchlist-section">
      <h2 class="section-title">Worth a rewatch</h2>
      <div class="rewatch-row">
        <button
          v-for="candidate in rewatchList"
          :key="candidate.entry.dbKey"
          type="button"
          class="rewatch-card"
          @click="goToMovie(candidate.entry)"
        >
          <img
            v-if="posterUrl(candidate.entry)"
            :src="posterUrl(candidate.entry)"
            :alt="candidate.entry.movie.title"
            class="rewatch-poster"
            loading="lazy"
          >
          <div v-else class="rewatch-poster rewatch-poster-placeholder">{{ candidate.entry.movie.title.charAt(0) }}</div>
          <span class="rewatch-name">{{ candidate.entry.movie.title }}</span>
          <span class="rewatch-meta">{{ candidate.rating.toFixed(1) }} · {{ yearsAgoLabel(candidate.yearsSince) }}</span>
        </button>
      </div>
    </section>

    <!-- TMDB-fed: unseen movies from the people your ratings favor. Tapping
         one drops into the normal rating flow (you've just watched it) —
         the same setMovieToRate + /rate-movie handoff PickMedia uses. -->
    <section v-for="section in peopleSections" :key="section.key" class="watchlist-section">
      <h2 class="section-title">{{ section.title }}</h2>
      <p class="section-caption">Based on {{ section.names.join(', ') }}.</p>
      <p v-if="section.loading" class="section-loading">Looking up filmographies&hellip;</p>
      <MediaResultGrid v-else-if="section.movies.length" :mediaList="section.movies" @select="rateMedia"/>
      <p v-else class="section-loading">Nothing new found — you've seen the good ones.</p>
    </section>

    <p v-if="!$store.state.isOnline" class="watchlist-offline-note">
      You're offline — the "what to see next" lists need a connection, so only the rewatch list is shown.
    </p>
  </div>
</template>

<script>
// Bug-report request: "I should figure out how to generate watchlists based
// on my ratings and also maybe a way to make a list of movies that I should
// consider rewatching." All the judgment lives in discover.js (pure,
// tested); this screen fetches the TMDB filmographies for the top people
// and renders. Library crew/cast entries store names only (no TMDB person
// ids), so each person costs a /search/person + /movie_credits pair — six
// people means ~12 requests once per visit.
import axios from 'axios';
import BackLink from './games/BackLink.vue';
import MediaResultGrid from './MediaResultGrid.vue';
import { getRating } from '../assets/javascript/GetRating.js';
import { rewatchCandidates, favoritePeople, rankWatchlistCandidates, ratedTmdbIds } from '../assets/javascript/discover.js';

export default {
  name: 'WatchlistScreen',
  components: { BackLink, MediaResultGrid },
  data () {
    return {
      directorMovies: [],
      actorMovies: [],
      directorsLoading: true,
      actorsLoading: true,
      // One-shot guard for the library watcher below.
      loaded: false
    };
  },
  computed: {
    library () {
      return this.$store.getters.allMoviesAsArray || [];
    },
    rewatchList () {
      return rewatchCandidates(this.library, getRating);
    },
    favoriteDirectors () {
      return favoritePeople(this.library, getRating, { role: 'director' });
    },
    favoriteActors () {
      return favoritePeople(this.library, getRating, { role: 'actor' });
    },
    peopleSections () {
      if (!this.$store.state.isOnline) return [];
      return [
        {
          key: 'directors',
          title: 'From directors you love',
          names: this.favoriteDirectors.map((p) => p.name),
          movies: this.directorMovies,
          loading: this.directorsLoading
        },
        {
          key: 'actors',
          title: 'From actors you love',
          names: this.favoriteActors.map((p) => p.name),
          movies: this.actorMovies,
          loading: this.actorsLoading
        }
      ].filter((section) => section.names.length);
    }
  },
  watch: {
    // Same wait-for-the-library pattern as the games: a deep link mounts
    // before Firebase data arrives.
    library: {
      immediate: true,
      handler (entries) {
        if (this.loaded || !entries.length) return;
        this.loaded = true;
        this.buildWatchlists();
      }
    }
  },
  methods: {
    posterUrl (entry) {
      const path = entry?.movie?.poster_path;
      return path ? `https://image.tmdb.org/t/p/w342${path}` : null;
    },
    yearsAgoLabel (years) {
      const rounded = Math.round(years);
      if (rounded < 1) return 'a while ago';
      return rounded === 1 ? 'a year ago' : `${rounded} years ago`;
    },
    goToMovie (entry) {
      if (entry?.movie?.id == null) return;
      this.$router.push(`/movie/${entry.movie.id}`);
    },
    rateMedia (media) {
      this.$store.commit('setMovieToRate', media);
      this.$router.push('/rate-movie');
    },
    async buildWatchlists () {
      if (!this.$store.state.isOnline) {
        this.directorsLoading = false;
        this.actorsLoading = false;
        return;
      }
      const rated = ratedTmdbIds(this.library);
      const [directorMovies, actorMovies] = await Promise.all([
        this.moviesFromPeople(this.favoriteDirectors, 'crew', rated),
        this.moviesFromPeople(this.favoriteActors, 'cast', rated)
      ]);
      this.directorMovies = directorMovies;
      this.directorsLoading = false;
      this.actorMovies = actorMovies;
      this.actorsLoading = false;
    },
    // credits kind: 'crew' keeps only their Director credits; 'cast' keeps
    // reasonably-billed roles (order < 10) so cameos don't flood the list.
    async moviesFromPeople (people, kind, rated) {
      const apiKey = process.env.VUE_APP_TMDB_API_KEY;
      const allCredits = [];

      await Promise.all(people.map(async (person) => {
        try {
          const search = await axios.get(`https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(person.name)}`);
          const personId = search.data?.results?.[0]?.id;
          if (personId == null) return;
          const credits = await axios.get(`https://api.themoviedb.org/3/person/${personId}/movie_credits?api_key=${apiKey}`);
          const list = kind === 'crew'
            ? (credits.data?.crew || []).filter((credit) => credit.job === 'Director')
            : (credits.data?.cast || []).filter((credit) => (credit.order ?? 99) < 10);
          allCredits.push(...list);
        } catch (error) {
          // Best-effort per person — one failed lookup shouldn't empty the list.
          console.error('Watchlist lookup failed for', person.name, error);
        }
      }));

      return rankWatchlistCandidates(allCredits, rated);
    }
  }
};
</script>

<style lang="scss" scoped>
.watchlist-screen {
  color: #eee;
  /* BackLink safety margin, same as every screen using it. */
  padding: 2.5rem 1rem 2rem;
}

.watchlist-title {
  margin: 0.5rem 0 0;
}

.watchlist-subtitle {
  color: #adb5bd;
  font-size: 0.85rem;
  margin: 0.25rem 0 1.25rem;
}

.watchlist-section {
  margin-bottom: 1.75rem;
}

.section-title {
  border-bottom: 1px solid #333;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.35rem;
}

.section-caption {
  color: #adb5bd;
  font-size: 0.78rem;
  margin: 0 0 0.5rem;
}

.section-loading {
  color: #adb5bd;
  font-size: 0.85rem;
}

.rewatch-row {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;
}

.rewatch-card {
  background: none;
  border: none;
  color: #eee;
  flex: 0 0 auto;
  padding: 0;
  text-align: center;
  width: 100px;
}

/* Mobile-first press feedback, no :hover. */
.rewatch-card:active {
  opacity: 0.7;
}

.rewatch-poster {
  border-radius: 0.35rem;
  height: 150px;
  object-fit: cover;
  width: 100px;
}

.rewatch-poster-placeholder {
  align-items: center;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #666;
  display: flex;
  font-size: 2rem;
  justify-content: center;
}

.rewatch-name {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  margin-top: 0.3rem;
}

.rewatch-meta {
  color: #ffc107;
  display: block;
  font-size: 0.7rem;
}

.watchlist-offline-note {
  color: #adb5bd;
  font-size: 0.8rem;
  text-align: center;
}
</style>

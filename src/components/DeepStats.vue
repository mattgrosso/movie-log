<template>
  <div class="deep-stats">
    <BackLink/>
    <h1 class="ds-title">Deep Stats</h1>
    <p class="ds-subtitle">Your library, interrogated.</p>

    <!-- The Crown -->
    <section v-if="crown.length" class="ds-section">
      <h2 class="ds-section-title">The Crown</h2>
      <p class="ds-section-caption">Starting from the oldest release you've rated, each new high score starts a reign.</p>
      <!-- Sideways: as a vertical list this was the tallest thing on the
           page by a distance, and it reads better as a succession anyway. -->
      <div class="ds-poster-row">
        <div
          v-for="reign in crown"
          :key="reign.entry.dbKey"
          class="ds-poster-card crown-card"
          :class="{ current: reign.current }"
          role="button"
          :aria-label="reign.entry.movie.title"
          @click="goToMovie(reign.entry)"
        >
          <img v-if="reign.entry.movie.poster_path" :src="poster(reign.entry)" :alt="reign.entry.movie.title" class="ds-poster">
          <span class="crown-card-year">
            {{ reign.year }}
            <span v-if="reign.current" class="crown-current-tag">now</span>
          </span>
          <span class="ds-poster-note">{{ reign.rating.toFixed(2) }} · {{ reign.reignYears }}y</span>
        </div>
      </div>
    </section>

    <!-- The Pantheon -->
    <section v-if="pantheonData.constellations.length" class="ds-section">
      <h2 class="ds-section-title">The Pantheon</h2>
      <p class="ds-section-caption">
        Perfection, category by category — {{ pantheonData.perfectFilms }} film{{ pantheonData.perfectFilms === 1 ? '' : 's' }},
        {{ pantheonData.totalMarks }} perfect marks.
      </p>
      <!-- The per-category lists are gone: with this many perfect marks in
           each one they were long without being interesting ("I have too many
           movies in each of these categories for it to be really
           fascinating"). Constellations survive because scoring perfectly in
           more than one category at once still means something. -->
      <div v-if="pantheonData.constellations.length" class="pantheon-category">
        <h3 class="pantheon-label">Constellations <span class="pantheon-count">{{ pantheonData.constellations.length }}</span></h3>
        <p class="ds-section-caption">Perfect in more than one category at once.</p>
        <div class="ds-poster-row">
          <div v-for="star in pantheonData.constellations" :key="star.entry.dbKey" class="ds-poster-card" @click="goToMovie(star.entry)">
            <img v-if="star.entry.movie.poster_path" :src="poster(star.entry)" :alt="star.entry.movie.title" class="ds-poster">
            <span class="ds-poster-note gold">{{ star.count }} perfect marks</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Rewatches -->
    <section v-if="rewatches" class="ds-section">
      <h2 class="ds-section-title">Rewatches</h2>
      <p class="ds-section-caption">The films you keep returning to — and how long they make you wait.</p>
      <div class="ds-strip">
        <div class="ds-strip-item"><span class="ds-strip-value">{{ rewatches.repeatViewings }}</span><span class="ds-strip-label">repeat viewings</span></div>
        <div class="ds-strip-item"><span class="ds-strip-value">{{ rewatches.filmsRevisited }}</span><span class="ds-strip-label">films revisited</span></div>
        <div class="ds-strip-item"><span class="ds-strip-value">{{ Math.round(rewatches.rewatchRate * 100) }}%</span><span class="ds-strip-label">rewatch rate</span></div>
        <div class="ds-strip-item"><span class="ds-strip-value">{{ rewatches.medianReturnYears.toFixed(1) }}y</span><span class="ds-strip-label">median return</span></div>
      </div>
      <h3 class="pantheon-label">Most rewatched</h3>
      <div class="ds-poster-row">
        <div v-for="film in rewatches.mostRewatched" :key="film.entry.dbKey" class="ds-poster-card" @click="goToMovie(film.entry)">
          <img v-if="film.entry.movie.poster_path" :src="poster(film.entry)" :alt="film.entry.movie.title" class="ds-poster">
          <span class="ds-poster-note gold">{{ film.viewings }} viewings</span>
        </div>
      </div>
      <h3 class="pantheon-label">Quickest returns</h3>
      <div class="ds-poster-row">
        <div v-for="film in rewatches.quickestReturns" :key="`q-${film.entry.dbKey}`" class="ds-poster-card" @click="goToMovie(film.entry)">
          <img v-if="film.entry.movie.poster_path" :src="poster(film.entry)" :alt="film.entry.movie.title" class="ds-poster">
          <span class="ds-poster-note gold">{{ gapLabel(film.gapDays) }}</span>
        </div>
      </div>
    </section>

    <!-- Marathon Club -->
    <section v-if="marathon" class="ds-section">
      <h2 class="ds-section-title">Marathon Club</h2>
      <p class="ds-section-caption">
        How much you've packed into a single stretch — the most films you've watched in one
        day, one week and one month, and how many days you've watched anything at all.
        Not consecutive days; the biggest ones.
      </p>
      <div class="ds-strip">
        <div class="ds-strip-item"><span class="ds-strip-value">{{ marathon.dayRecord.count }}</span><span class="ds-strip-label">day record · {{ duration(marathon.dayRecord.minutes) }}</span></div>
        <div class="ds-strip-item"><span class="ds-strip-value">{{ marathon.weekRecord.count }}</span><span class="ds-strip-label">week record · {{ duration(marathon.weekRecord.minutes) }}</span></div>
        <div class="ds-strip-item"><span class="ds-strip-value">{{ marathon.monthRecord.count }}</span><span class="ds-strip-label">month record · {{ duration(marathon.monthRecord.minutes) }}</span></div>
        <div class="ds-strip-item"><span class="ds-strip-value">{{ marathon.movieDays }}</span><span class="ds-strip-label">movie days</span></div>
      </div>
      <h3 class="pantheon-label">Biggest days</h3>
      <ol class="top-days">
        <li v-for="(dayEntry, index) in marathon.topDays" :key="dayEntry.day" class="top-day">
          <span class="top-day-rank">{{ index + 1 }}</span>
          <div class="top-day-info">
            <span class="top-day-date">{{ dayEntry.day }}</span>
            <span class="top-day-detail">{{ dayEntry.count }} movies · {{ duration(dayEntry.minutes) }}</span>
          </div>
        </li>
      </ol>
    </section>

    <!-- Years -->
    <section v-if="years.length" class="ds-section">
      <h2 class="ds-section-title">Years</h2>
      <p class="ds-section-caption">
        How good each year of watching was, by Log Score — quality and depth together, so a
        year of many good films beats a year of two great ones. The poster is that year's best.
      </p>
      <div class="ds-poster-row">
        <div
          v-for="year in years"
          :key="year.year"
          class="ds-poster-card"
          role="button"
          :aria-label="`${year.year}: ${year.watched} watched`"
          @click="year.top && goToMovie(year.top)"
        >
          <img v-if="year.top && year.top.movie.poster_path" :src="poster(year.top)" :alt="year.top.movie.title" class="ds-poster">
          <div v-else class="ds-poster ds-poster-blank">{{ year.year }}</div>
          <span class="crown-card-year">{{ year.year }}</span>
          <span class="ds-poster-note gold">{{ year.score ?? '—' }}</span>
          <span class="ds-poster-note">{{ year.watched }} watched</span>
        </div>
      </div>
    </section>

    <!-- Standouts -->
    <section v-if="standoutList.length" class="ds-section">
      <h2 class="ds-section-title">Standouts</h2>
      <p class="ds-section-caption">
        The corners of your library you rate unusually well, ranked against each other — genres,
        keywords, directors, actors, studios, decades. The number is how far above your own average
        each one sits, pulled back toward that average when there's little evidence, so eight films
        can beat four hundred but one lucky film can't beat anything.
      </p>
      <div class="standouts">
        <div v-for="standout in standoutList" :key="`${standout.facet}-${standout.value}`" class="standout">
          <div class="standout-head">
            <span class="standout-facet">{{ standout.facet }}</span>
            <span class="standout-value">{{ standout.value }}</span>
            <span class="standout-score" :class="{ gold: standout.lift > 0 }">
              {{ standout.lift > 0 ? '+' : '' }}{{ standout.lift.toFixed(2) }}
            </span>
          </div>
          <p class="standout-detail">
            {{ standout.count }} rated · {{ standout.mean.toFixed(2) }} average · {{ standout.score }} log score
          </p>
          <div class="ds-poster-row">
            <div
              v-for="film in standout.top"
              :key="`${standout.value}-${film.dbKey}`"
              class="ds-poster-card"
              role="button"
              :aria-label="film.movie.title"
              @click="goToMovie(film)"
            >
              <img v-if="film.movie.poster_path" :src="poster(film)" :alt="film.movie.title" class="ds-poster">
              <div v-else class="ds-poster ds-poster-blank">{{ film.movie.title }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Genres -->
    <section v-if="genres.length" class="ds-section">
      <h2 class="ds-section-title">Genres</h2>
      <p class="ds-section-caption">Ranked by log score — favorites rewarded, small samples humbled.</p>
      <div v-for="(genre, index) in genres" :key="genre.name" class="pantheon-category">
        <h3 class="pantheon-label">
          <span class="genre-rank">#{{ index + 1 }}</span> {{ genre.name }}
          <span class="pantheon-count">{{ genre.count }} rated</span>
          <span class="genre-score">{{ genre.score }}</span>
        </h3>
        <div class="ds-poster-row">
          <div v-for="film in genre.top" :key="`${genre.name}-${film.dbKey}`" class="ds-poster-card" @click="goToMovie(film)">
            <img v-if="film.movie.poster_path" :src="poster(film)" :alt="film.movie.title" class="ds-poster">
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
// Deep Stats (/stats): the best of Brian's Movie Log stats suite, adapted
// (surveyed live 2026-08-15 — Crown, Pantheon, Rewatches, Marathon, plus
// log-scored Years and Genres). All computation is pure in deepStats.js /
// logScore.js; this screen only renders. Fully offline.
import BackLink from './games/BackLink.vue';
import { getRating } from '../assets/javascript/GetRating.js';
import { crownTimeline, pantheon, rewatchStats, marathonStats, yearStats, genreStats, standouts } from '../assets/javascript/deepStats.js';
import { logScoreSettings } from '../assets/javascript/logScore.js';

export default {
  name: 'DeepStats',
  components: { BackLink },
  computed: {
    library () {
      return this.$store.getters.allMoviesAsArray || [];
    },
    weights () {
      return logScoreSettings(this.$store.state.settings);
    },
    crown () {
      return crownTimeline(this.library, getRating);
    },
    pantheonData () {
      return pantheon(this.library, getRating);
    },
    rewatches () {
      return rewatchStats(this.library);
    },
    marathon () {
      return marathonStats(this.library, { includeShorts: Boolean(this.$store.state.settings?.includeShorts) });
    },
    years () {
      return yearStats(this.library, getRating, this.weights);
    },
    standoutList () {
      return standouts(this.library, getRating, this.weights);
    },
    genres () {
      return genreStats(this.library, getRating, this.weights);
    }
  },
  methods: {
    poster (entry) {
      return `https://image.tmdb.org/t/p/w185${entry.movie.poster_path}`;
    },
    goToMovie (entry) {
      if (entry?.movie?.id == null) return;
      this.$router.push(`/movie/${entry.movie.id}`);
    },
    duration (minutes) {
      if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      const mins = Math.round(minutes % 60);
      return [days ? `${days}d` : null, hours ? `${hours}h` : null, `${mins}m`].filter(Boolean).join(' ');
    },
    gapLabel (days) {
      if (days < 1) return 'same day';
      if (days < 60) {
        const whole = Math.round(days);
        return `${whole} ${whole === 1 ? 'day' : 'days'}`;
      }
      if (days < 700) {
        const months = Math.round(days / 30.4);
        return `${months} ${months === 1 ? 'month' : 'months'}`;
      }
      return `${(days / 365.25).toFixed(1)} years`;
    }
  }
};
</script>

<style lang="scss" scoped>
.deep-stats {
  color: #eee;
  padding: 0.75rem 1rem 2rem;
}

.ds-title { margin: 0.25rem 0 0; }
.ds-subtitle { color: #ccc; font-size: 0.85rem; margin: 0.25rem 0 1rem; }

.ds-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.ds-strip-item {
  background: #161616;
  border: 1px solid #2e2e2e;
  border-radius: 10px;
  display: flex;
  flex: 1 1 100px;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
}

.ds-strip-value { color: #ffc107; font-size: 1.15rem; font-weight: 700; }
.ds-strip-label { color: #ccc; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.4px; }

.ds-section {
  background: #161616;
  border: 1px solid #2e2e2e;
  border-radius: 10px;
  margin-bottom: 1rem;
  padding: 0.9rem 1rem;
}

.ds-section-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.25rem; }

/* Sideways rows carry most of this page now: a section is one row tall
   however much is in it. */
.crown-card-year {
  color: #fff;
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  margin-top: 0.2rem;
}

.crown-card.current .crown-card-year { color: #ffd700; }

.crown-current-tag {
  background: #ffd700;
  border-radius: 3px;
  color: #000;
  font-size: 0.58rem;
  margin-left: 0.25rem;
  padding: 0 3px;
  text-transform: uppercase;
}

.ds-poster-blank {
  align-items: center;
  background: #2b2b2b;
  color: #ccc;
  display: flex;
  font-size: 0.68rem;
  justify-content: center;
  padding: 0.3rem;
  text-align: center;
}

.standouts {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.standout-head {
  align-items: baseline;
  display: flex;
  gap: 0.4rem;
}

.standout-facet {
  /* #9a9a9a on this background is ~7:1. */
  color: #9a9a9a;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.standout-value {
  color: #fff;
  flex: 1 1 auto;
  font-size: 0.95rem;
  font-weight: 700;
  min-width: 0;
}

.standout-score {
  color: #b9b9b9;
  font-size: 0.95rem;
  font-weight: 700;
}

.standout-score.gold { color: #ffc107; }

.standout-detail {
  color: #b9b9b9;
  font-size: 0.72rem;
  margin: 0.1rem 0 0.3rem;
}
.ds-section-caption { color: #ccc; font-size: 0.78rem; margin: 0 0 0.75rem; }

.crown-timeline { display: flex; flex-direction: column; row-gap: 0.75rem; }

.crown-reign {
  align-items: center;
  border-left: none;
  display: flex;
  gap: 0.75rem;

  &.current .crown-name { color: #ffc107; }
}

.crown-poster { border-radius: 6px; height: 108px; width: 72px; object-fit: cover; flex: 0 0 72px; }
.crown-info { display: flex; flex-direction: column; min-width: 0; row-gap: 2px; }
.crown-year { color: #ccc; font-size: 0.75rem; font-weight: 700; }
.crown-current-tag {
  background: rgba(255, 193, 7, 0.15);
  border-radius: 999px;
  color: #ffc107;
  font-size: 0.65rem;
  margin-left: 0.4rem;
  padding: 0.1rem 0.45rem;
  text-transform: uppercase;
}
.crown-name { font-size: 0.95rem; font-weight: 600; }
.crown-detail { color: #ccc; font-size: 0.75rem; }
.crown-score { color: #ffc107; font-size: 1.05rem; font-weight: 700; margin-left: auto; }

.pantheon-category { margin-top: 0.75rem; }
.pantheon-label { color: #eee; font-size: 0.85rem; font-weight: 700; margin: 0 0 0.4rem; }
.pantheon-count { color: #999; font-size: 0.72rem; font-weight: 400; margin-left: 0.35rem; }
.genre-rank { color: #ffc107; }
.genre-score { color: #ffc107; float: right; }

.ds-poster-row {
  align-items: flex-start;
  display: flex;
  gap: 0.6rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;
}

.ds-poster-card { cursor: pointer; flex: 0 0 92px; width: 92px; }
.ds-poster { border-radius: 6px; display: block; height: 138px; object-fit: cover; width: 92px; }
/* Left, not centred: these sit under a fixed-width poster, and centring made
   the label and the note under it disagree about where the card starts. */
.ds-poster-note { color: #ccc; display: block; font-size: 0.7rem; line-height: 1.25; margin-top: 0.25rem; }
.ds-poster-note.gold { color: #ffc107; }

.top-days { list-style: none; margin: 0; padding: 0; }
.top-day { align-items: center; display: flex; gap: 0.75rem; padding: 0.35rem 0; }
.top-day-rank {
  align-items: center;
  background: #101010;
  border: 1px solid #3a3a3a;
  border-radius: 50%;
  color: #ffc107;
  display: flex;
  flex: 0 0 28px;
  font-size: 0.8rem;
  font-weight: 700;
  height: 28px;
  justify-content: center;
}
.top-day-info { display: flex; flex-direction: column; }
.top-day-date { font-size: 0.85rem; font-weight: 600; }
.top-day-detail { color: #ccc; font-size: 0.72rem; }

.year-cards { display: flex; flex-direction: column; row-gap: 0.6rem; }
.year-card {
  align-items: center;
  background: #101010;
  border: 1px solid #2e2e2e;
  border-radius: 10px;
  display: flex;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
}
.year-label { color: #ffc107; font-size: 1.05rem; font-weight: 700; flex: 0 0 3.2rem; }
.year-numbers { display: flex; flex-direction: column; row-gap: 2px; }
.year-stat { color: #ccc; font-size: 0.78rem; }
.year-stat strong { color: #eee; }
.year-stat.gold strong { color: #ffc107; }
.year-top-poster { border-radius: 6px; cursor: pointer; height: 84px; margin-left: auto; width: 56px; object-fit: cover; }
</style>

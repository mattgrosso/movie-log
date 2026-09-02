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

      <!-- The other end of the same list (2026-08-17). -->
      <h3 v-if="rewatches.longestReturns.length" class="pantheon-label">Longest waits</h3>
      <div v-if="rewatches.longestReturns.length" class="ds-poster-row">
        <div v-for="film in rewatches.longestReturns" :key="`l-${film.entry.dbKey}`" class="ds-poster-card" @click="goToMovie(film.entry)">
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
            <!-- "Should show the posters of the movies I watched on the
                 longest days. Make sure [they] be pretty small though."
                 (2026-08-17) -->
            <div class="day-posters">
              <img
                v-for="(watched, position) in dayEntry.entries"
                :key="`${dayEntry.day}-${watched.dbKey}-${position}`"
                v-show="watched.movie.poster_path"
                :src="poster(watched)"
                :alt="watched.movie.title"
                :title="watched.movie.title"
                class="day-poster"
                loading="lazy"
                @click="goToMovie(watched)"
              >
            </div>
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
      <!-- "I should be able to sort it chronologically, which you already
           have, or I should be able to sort it by rank." (2026-08-17) -->
      <div class="ds-sort">
        <button
          type="button"
          class="ds-sort-btn"
          :class="{ active: yearSort === 'chronological' }"
          @click="yearSort = 'chronological'"
        >Chronological</button>
        <button
          type="button"
          class="ds-sort-btn"
          :class="{ active: yearSort === 'rank' }"
          @click="yearSort = 'rank'"
        >By rank</button>
      </div>
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

    <!-- Decade Championship -->
    <section v-if="championship" class="ds-section decade-championship">
      <h2 class="ds-section-title">Decade Championship</h2>
      <p class="ds-section-caption">
        Who dominated each decade of your library, by release year. Log Score throughout, so depth
        counts alongside quality and a decade you've barely explored can't crown anyone on one lucky
        film — nobody qualifies on fewer than two.
      </p>
      <!-- The same strip the year screens use: every decade visible, not
           hidden behind a select. Newest first, like the year strips. -->
      <div class="ds-decade-scroller">
        <button
          v-for="candidate in decades"
          :key="candidate.decade"
          type="button"
          class="btn btn-sm ds-decade-pill"
          :class="candidate.decade === activeDecade ? 'btn-primary selected' : 'btn-outline-secondary'"
          @click="selectedDecade = candidate.decade"
        >{{ candidate.label }}</button>
      </div>
      <p class="ds-section-caption decade-count">
        {{ championship.filmCount }} film{{ championship.filmCount === 1 ? '' : 's' }} rated from the {{ championship.label }}.
      </p>

      <!-- One winner per category, one row each. The first cut showed a
           podium of three per category as poster rows, and Matt found it too
           much: "I don't think we need three winners per category." -->
      <div class="champions">
        <div
          v-for="category in championshipCategories"
          :key="`${championship.decade}-${category.key}`"
          class="champion"
          :data-category="category.key"
          role="button"
          :aria-label="category.champion ? `${category.label}: ${category.champion.name}` : category.label"
          @click="tapChampion(category)"
        >
          <span class="champion-category">{{ category.label }}</span>
          <template v-if="category.champion">
            <img
              v-if="category.champion.best && category.champion.best.movie.poster_path"
              :src="poster(category.champion.best)"
              :alt="category.champion.best.movie.title"
              class="champion-poster"
              loading="lazy"
            >
            <div v-else class="champion-poster champion-poster-blank"></div>
            <div class="champion-info">
              <span class="champion-name">{{ category.champion.name }}</span>
              <span class="champion-detail">
                <span class="champion-score">{{ category.champion.scoreLabel }}</span>
                <template v-if="category.champion.count"> · {{ category.champion.count }} films</template>
                <template v-if="category.note"> · {{ category.note }}</template>
              </span>
            </div>
          </template>
          <span v-else class="champion-detail decade-looking">Looking them up…</span>
        </div>
      </div>
      <p v-if="!championshipCategories.length" class="ds-section-caption">
        Not enough from the {{ championship.label }} yet to crown anyone.
      </p>

      <PersonModal
        v-if="selectedChampion"
        :person="selectedChampion.person"
        :role-label="selectedChampion.roleLabel"
        :library-average="championship.globalAvg"
        @close="selectedChampion = null"
        @search="searchForChampion"
        @select-film="selectChampionFilm"
      />
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
import PersonModal from './PersonModal.vue';
import { getRating } from '../assets/javascript/GetRating.js';
import { crownTimeline, pantheon, rewatchStats, marathonStats, yearStats, genreStats, standouts } from '../assets/javascript/deepStats.js';
import { logScoreSettings } from '../assets/javascript/logScore.js';
import { decadesAvailable, defaultDecade, decadeChampionship, DECADE_DEFAULTS } from '../assets/javascript/decadeChampionship.js';
import { isEligibleForActingCategory } from '../assets/javascript/genderEligibility.js';
import { formatScore } from '../assets/javascript/formatScore.js';
import { lookupPerson } from '../utils/personLookup.js';

// Decade Championship's Actor/Actress split walks the decade's ranked cast
// with one TMDB lookup per name until both podiums are full. A thin decade
// may never fill one of them; this stops the walk from turning into a
// lookup per credited actor in the decade.
const CAST_LOOKUP_CAP = 40;

export default {
  name: 'DeepStats',
  components: { BackLink, PersonModal },
  data () {
    return {
      // Years section ordering — see the Years block.
      yearSort: 'chronological',
      // Decade Championship. `selectedDecade` is the tapped pill; null means
      // "the best-evidenced decade" (see activeDecade).
      selectedDecade: null,
      // The Actor/Actress podiums for the active decade, resolved
      // asynchronously (the stored cast carries no gender).
      cast: { loading: false, actors: [], actresses: [] },
      castSeq: 0,
      // A tapped champion: { person, roleLabel, rank, rankOf } for PersonModal.
      selectedChampion: null
    };
  },
  computed: {
    library () {
      return this.$store.getters.allMoviesAsArray || [];
    },
    weights () {
      return logScoreSettings(this.$store.state.settings);
    },
    decades () {
      return decadesAvailable(this.library, getRating);
    },
    // Falls back to the decade with the most rated films — both before any
    // tap and if the library changes under a selection.
    activeDecade () {
      if (this.decades.some((candidate) => candidate.decade === this.selectedDecade)) return this.selectedDecade;
      return defaultDecade(this.decades);
    },
    championship () {
      if (this.activeDecade === null) return null;
      return decadeChampionship(this.library, getRating, this.weights, this.activeDecade);
    },
    // The section's categories in display order, each with its one winner
    // (`champion`, null while a category is still being looked up). Actor
    // and Actress need the async gender split; offline they collapse into
    // one Performer row rather than disappearing.
    championshipCategories () {
      const championship = this.championship;
      if (!championship) return [];
      const person = (champion) => (champion ? { ...champion, scoreLabel: formatScore(champion.score) } : null);
      const people = (key, label, ranked, extra = {}) => ({ key, label, kind: 'person', champion: person(ranked[0]), ...extra });

      const best = championship.films[0];
      const categories = [{
        key: 'film',
        label: 'Film',
        kind: 'film',
        champion: best
          ? { name: best.entry.movie.title, best: best.entry, entries: [best.entry], scoreLabel: formatScore(best.rating), count: 0 }
          : null
      }];
      const crew = new Map(championship.crew.map((category) => [category.key, category]));
      categories.push(people('director', 'Director', crew.get('director').ranked));

      if (this.$store.state.isOnline === false) {
        categories.push(people('performer', 'Performer', championship.performers, { note: 'offline, actors and actresses together' }));
      } else {
        categories.push(people('actor', 'Actor', this.cast.actors, { loading: this.cast.loading }));
        categories.push(people('actress', 'Actress', this.cast.actresses, { loading: this.cast.loading }));
      }

      championship.crew
        .filter((category) => category.key !== 'director')
        .forEach((category) => categories.push(people(category.key, category.label, category.ranked)));

      return categories.filter((category) => category.champion || category.loading);
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
      const stats = yearStats(this.library, getRating, this.weights);
      if (this.yearSort !== 'rank') return stats;
      // A year with no score sorts last rather than to the top on a null.
      return [...stats].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
    },
    standoutList () {
      return standouts(this.library, getRating, this.weights);
    },
    genres () {
      return genreStats(this.library, getRating, this.weights);
    }
  },
  watch: {
    // A new championship object means the decade or the library changed;
    // either way the cast podiums are rebuilt. The person lookups are cached
    // by name at module scope, so flipping back to a decade is free.
    championship: { immediate: true, handler () { this.resolveCast(); } }
  },
  methods: {
    async resolveCast () {
      const seq = ++this.castSeq;
      const championship = this.championship;
      this.cast = { loading: false, actors: [], actresses: [] };
      if (!championship || this.$store.state.isOnline === false) return;

      const podium = DECADE_DEFAULTS.podium;
      const actors = [];
      const actresses = [];
      const publish = (loading) => {
        this.cast = { loading, actors: [...actors], actresses: [...actresses] };
      };
      publish(true);

      let lookups = 0;
      for (const performer of championship.performers) {
        if (actors.length >= podium && actresses.length >= podium) break;
        if (lookups >= CAST_LOOKUP_CAP) break;
        lookups += 1;
        const details = await lookupPerson(performer.name);
        if (seq !== this.castSeq) return; // superseded by a newer decade
        // Someone TMDB can't identify is skipped, as the Favorite sections
        // do — a wrong crown is worse than a missing one. A FOUND person
        // with no definite reading (not specified, non-binary) goes on both
        // podiums, per genderEligibility.js.
        if (!details) continue;
        const champion = { ...performer, details };
        if (actors.length < podium && isEligibleForActingCategory(details.gender, { isActress: false })) actors.push(champion);
        if (actresses.length < podium && isEligibleForActingCategory(details.gender, { isActress: true })) actresses.push(champion);
        publish(true);
      }
      publish(false);
    },
    async tapChampion (category) {
      const champion = category.champion;
      if (!champion) return;
      if (category.kind === 'film') {
        this.goToMovie(champion.best);
        return;
      }
      // Crew champions were never looked up (nothing needed their gender), so
      // the modal's portrait and biography take one lookup on open.
      const details = champion.details ?? await lookupPerson(champion.name);
      this.selectedChampion = {
        person: { name: champion.name, entries: champion.entries, count: champion.count, finalScore: champion.score, details },
        roleLabel: `${category.label} of the ${this.championship.label}`
      };
    },
    searchForChampion () {
      const name = this.selectedChampion?.person?.name;
      this.selectedChampion = null;
      if (name) this.$router.push({ name: 'Home', query: { search: encodeURIComponent(name) } });
    },
    selectChampionFilm (film) {
      this.selectedChampion = null;
      this.goToMovie(film);
    },
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

/* Decade Championship. The pill strip is YearInReview's, so the two screens
   read as the same control. */
.ds-decade-scroller {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
  overflow-x: auto;
  padding-bottom: 0.2rem;
  -webkit-overflow-scrolling: touch;
}

.ds-decade-pill { flex-shrink: 0; min-height: 40px; white-space: nowrap; }

/* Bootstrap paints btn-outline-secondary's label #6c757d — ~2.6:1 on this
   surface, the same failure as .text-muted. */
.ds-decade-pill.btn-outline-secondary { border-color: #4a4a4a; color: #ccc; }

/* Press feedback is :active only — a tapped pill on iOS keeps :hover. */
.ds-decade-pill:active { transform: scale(0.96); }

.decade-count { margin-bottom: 0.5rem; }
.decade-looking { color: #ccc; }

/* One row per category: label, the champion's best film of the decade as a
   small poster, then name and numbers. Eight rows at most. */
.champions { display: flex; flex-direction: column; }

.champion {
  align-items: center;
  border-top: 1px solid #2e2e2e;
  cursor: pointer;
  display: flex;
  gap: 0.6rem;
  min-height: 44px;
  padding: 0.4rem 0;
}

.champion:first-child { border-top: none; }
.champion:active { opacity: 0.7; }

.champion-category {
  /* #9a9a9a on #161616 is ~7:1. */
  color: #9a9a9a;
  flex: 0 0 6.2rem;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.champion-poster {
  border-radius: 4px;
  display: block;
  flex: 0 0 34px;
  height: 51px;
  object-fit: cover;
  width: 34px;
}

.champion-poster-blank { background: #2b2b2b; }

.champion-info { display: flex; flex-direction: column; min-width: 0; row-gap: 2px; }
.champion-name { color: #fff; font-size: 0.9rem; font-weight: 700; line-height: 1.2; }
.champion-detail { color: #ccc; font-size: 0.72rem; }
.champion-score { color: #ffc107; font-weight: 700; }

.ds-sort { display: flex; gap: 0.4rem; margin-bottom: 0.6rem; }

.ds-sort-btn {
  background: #101010;
  border: 1px solid #3a3a3a;
  border-radius: 999px;
  color: #ccc;
  font-size: 0.7rem;
  /* 40px minimum tap target. */
  min-height: 40px;
  padding: 0 0.85rem;
}

.ds-sort-btn.active { background: #ffc107; border-color: #ffc107; color: #101010; font-weight: 700; }
.ds-sort-btn:active { opacity: 0.75; }

.day-posters { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 0.3rem; }

/* Small on purpose — they're a reminder of the day, not the subject. */
.day-poster {
  border-radius: 3px;
  cursor: pointer;
  display: block;
  height: 45px;
  object-fit: cover;
  width: 30px;
}

.day-poster:active { opacity: 0.7; }

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

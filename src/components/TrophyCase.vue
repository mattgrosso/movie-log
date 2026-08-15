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
          <div v-for="person in mostDecoratedPeople" :key="person.name" class="decorated-person" @click="searchForPerson(person.name)">
            <!-- .expanded, not the win wrapper. mostDecoratedPeople pushes
                 whole WIN objects ({year, expanded, …}) into person.wins,
                 and winnerImage reads .details/.movie off an EXPANDED
                 nominee - so passing the wrapper meant both lookups were
                 undefined and every single person in this row fell through
                 to the initial-letter placeholder (bug report: "missing a
                 bunch of images on that top row... they just have letters
                 for all their names"). The category rows below always got
                 this right, which is why only this row was affected. -->
            <img v-if="winnerImage(person.wins[0].expanded)" :src="winnerImage(person.wins[0].expanded)" :alt="person.name" class="decorated-photo">
            <div v-else class="decorated-photo decorated-photo-placeholder">{{ person.name.charAt(0) }}</div>
            <div class="decorated-name">{{ person.name }}</div>
            <div class="decorated-count">{{ person.count }}&times; winner</div>
          </div>
        </div>
      </div>

      <!-- Leaderboards (user request: "movies with the most wins, movies
           with the most nominations... people with the most nominations").
           Each hides itself when nothing clears the repeat threshold, so a
           small or brand-new awards history doesn't render empty shelves. -->
      <div v-if="mostNominatedPeople.length" class="most-decorated">
        <h2 class="section-title">Most Nominated People</h2>
        <div class="decorated-list">
          <div v-for="person in mostNominatedPeople" :key="person.name" class="decorated-person" @click="searchForPerson(person.name)">
            <img v-if="winnerImage(person.entries[0].expanded)" :src="winnerImage(person.entries[0].expanded)" :alt="person.name" class="decorated-photo">
            <div v-else class="decorated-photo decorated-photo-placeholder">{{ person.name.charAt(0) }}</div>
            <div class="decorated-name">{{ person.name }}</div>
            <div class="decorated-count">{{ person.count }} nomination{{ person.count === 1 ? '' : 's' }}</div>
          </div>
        </div>
      </div>

      <!-- User request: "the ability to see who has the most nominations
           without a win" — the perpetually passed-over. -->
      <div v-if="mostNominatedNeverWon.length" class="most-decorated">
        <h2 class="section-title">Always the Bridesmaid</h2>
        <div class="decorated-list">
          <div v-for="person in mostNominatedNeverWon" :key="person.name" class="decorated-person" @click="searchForPerson(person.name)">
            <img v-if="winnerImage(person.entries[0].expanded)" :src="winnerImage(person.entries[0].expanded)" :alt="person.name" class="decorated-photo">
            <div v-else class="decorated-photo decorated-photo-placeholder">{{ person.name.charAt(0) }}</div>
            <div class="decorated-name">{{ person.name }}</div>
            <div class="decorated-count">{{ person.count }} nomination{{ person.count === 1 ? '' : 's' }}, no wins</div>
          </div>
        </div>
      </div>

      <div v-if="mostAwardedMovies.length" class="most-decorated">
        <h2 class="section-title">Most Awarded Movies</h2>
        <div class="decorated-list">
          <div v-for="film in mostAwardedMovies" :key="film.movieId" class="decorated-person" @click="goToMovieId(film.movieId)">
            <img v-if="film.movie.poster_path" :src="`https://image.tmdb.org/t/p/w185${film.movie.poster_path}`" :alt="film.movie.title" class="decorated-poster">
            <div v-else class="decorated-poster decorated-photo-placeholder">{{ film.movie.title.charAt(0) }}</div>
            <div class="decorated-name">{{ film.movie.title }}</div>
            <div class="decorated-count">{{ film.count }} win{{ film.count === 1 ? '' : 's' }}</div>
          </div>
        </div>
      </div>

      <div v-if="mostNominatedMovies.length" class="most-decorated">
        <h2 class="section-title">Most Nominated Movies</h2>
        <div class="decorated-list">
          <div v-for="film in mostNominatedMovies" :key="film.movieId" class="decorated-person" @click="goToMovieId(film.movieId)">
            <img v-if="film.movie.poster_path" :src="`https://image.tmdb.org/t/p/w185${film.movie.poster_path}`" :alt="film.movie.title" class="decorated-poster">
            <div v-else class="decorated-poster decorated-photo-placeholder">{{ film.movie.title.charAt(0) }}</div>
            <div class="decorated-name">{{ film.movie.title }}</div>
            <div class="decorated-count">{{ film.count }} nomination{{ film.count === 1 ? '' : 's' }}</div>
          </div>
        </div>
      </div>

      <!-- User feedback: the per-category winner lists ("just every winner
           from each of the years going back") carried no insight and are
           gone. Everything below is a DERIVED shape — see awardStats.js. -->
      <div v-if="biggestSweeps.length" class="most-decorated">
        <h2 class="section-title">Biggest Sweeps</h2>
        <div class="decorated-list">
          <div v-for="sweep in biggestSweeps" :key="`${sweep.movieId}-${sweep.year}`" class="decorated-person" @click="goToMovieId(sweep.movieId)">
            <img v-if="sweep.movie.poster_path" :src="`https://image.tmdb.org/t/p/w185${sweep.movie.poster_path}`" :alt="sweep.movie.title" class="decorated-poster">
            <div v-else class="decorated-poster decorated-photo-placeholder">{{ sweep.movie.title.charAt(0) }}</div>
            <div class="decorated-name">{{ sweep.movie.title }}</div>
            <div class="decorated-count">{{ sweep.count }} wins · {{ sweep.year }}</div>
          </div>
        </div>
      </div>

      <div v-if="backToBackWinners.length" class="most-decorated">
        <h2 class="section-title">Back-to-Back</h2>
        <div class="decorated-list">
          <div v-for="streak in backToBackWinners" :key="streak.name" class="decorated-person" @click="searchForPerson(streak.name)">
            <img v-if="winnerImage(streak.sample.expanded)" :src="winnerImage(streak.sample.expanded)" :alt="streak.name" class="decorated-photo">
            <div v-else class="decorated-photo decorated-photo-placeholder">{{ streak.name.charAt(0) }}</div>
            <div class="decorated-name">{{ streak.name }}</div>
            <div class="decorated-count">{{ streak.length }} years running · {{ streak.startYear }}–{{ String(streak.endYear).slice(2) }}</div>
          </div>
        </div>
      </div>

      <div v-if="categoryOwnersList.length" class="most-decorated">
        <h2 class="section-title">Owns the Category</h2>
        <div class="decorated-list">
          <div v-for="owner in categoryOwnersList" :key="`${owner.name}-${owner.categoryKey}`" class="decorated-person" @click="searchForPerson(owner.name)">
            <img v-if="winnerImage(owner.sample.expanded)" :src="winnerImage(owner.sample.expanded)" :alt="owner.name" class="decorated-photo">
            <div v-else class="decorated-photo decorated-photo-placeholder">{{ owner.name.charAt(0) }}</div>
            <div class="decorated-name">{{ owner.name }}</div>
            <div class="decorated-count">{{ owner.count }}× {{ categoryName(owner.categoryKey) }}</div>
          </div>
        </div>
      </div>

      <div v-if="overdueWinners.length" class="most-decorated">
        <h2 class="section-title">Worth the Wait</h2>
        <div class="decorated-list">
          <div v-for="wait in overdueWinners" :key="wait.name" class="decorated-person" @click="searchForPerson(wait.name)">
            <img v-if="winnerImage(wait.sample.expanded)" :src="winnerImage(wait.sample.expanded)" :alt="wait.name" class="decorated-photo">
            <div v-else class="decorated-photo decorated-photo-placeholder">{{ wait.name.charAt(0) }}</div>
            <div class="decorated-name">{{ wait.name }}</div>
            <div class="decorated-count">won after {{ wait.wait }} years · first nod {{ wait.firstNomination }}</div>
          </div>
        </div>
      </div>

      <!-- User request: "find some categories where I differ from the
           Academy Awards." Your winners vs the real ceremony, joined on
           film year (the dataset's year IS the film year) + tmdb/person. -->
      <div v-if="academyOverall.contests" class="most-decorated">
        <h2 class="section-title">You vs. the Academy</h2>
        <p class="academy-headline">
          You and the Academy agree {{ Math.round(academyOverall.rate * 100) }}% of the time
          ({{ academyOverall.agreements }} of {{ academyOverall.contests }} shared categories).
        </p>
        <div class="academy-scorecard">
          <div v-for="row in academyScorecard" :key="row.categoryKey" class="academy-score-line">
            <span class="academy-score-label">{{ categoryName(row.categoryKey) }}</span>
            <span class="academy-score-value" :class="{ contrarian: row.rate < 0.34 }">
              {{ Math.round(row.rate * 100) }}% ({{ row.agreements }}/{{ row.contests }})
            </span>
          </div>
        </div>
        <ul v-if="academyDisagreements.length" class="upset-list academy-clashes">
          <li v-for="clash in academyDisagreements" :key="`${clash.year}-${clash.categoryKey}`" class="upset-row academy-row">
            <span class="upset-context">{{ clash.year }} · {{ categoryName(clash.categoryKey) }}</span>
            <span class="upset-text">
              You: <strong>{{ clash.yoursLabel }}</strong> — Academy: {{ clash.academyLabel }}
              <em v-if="clash.outcome === 'snubbed'">(yours wasn't even nominated)</em>
            </span>
          </li>
        </ul>
      </div>

      <!-- Your own ratings vs your own ceremony picks. -->
      <div v-if="upsets.length" class="most-decorated">
        <h2 class="section-title">Robbed, By Your Own Ratings</h2>
        <ul class="upset-list">
          <li v-for="upset in upsets" :key="`${upset.year}-${upset.categoryKey}`" class="upset-row" @click="goToMovieId(upset.robbed.movie.id)">
            <span class="upset-context">{{ upset.year }} · {{ categoryName(upset.categoryKey) }}</span>
            <span class="upset-text">
              <strong>{{ upset.robbed.name || upset.robbed.movie.title }}</strong> ({{ upset.robbedRating.toFixed(1) }})
              lost to {{ upset.winner.name || upset.winner.movie.title }} ({{ upset.winnerRating.toFixed(1) }})
            </span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script>
import { PERSONAL_AWARD_CATEGORIES } from '../assets/javascript/personalAwardsCategories.js';
import { expandNomineeFromMinimal } from '../assets/javascript/personalAwards.js';
import { collectAwardEntries, rankPeople, rankMovies, rankPeopleWithoutWins, rankSweeps, winStreaks, categoryOwners, longestWaits, rankUpsets } from '../assets/javascript/awardStats.js';
import { getRating } from '../assets/javascript/GetRating.js';
import { compareWithAcademy, categoryScorecard, overallAgreement, biggestDisagreements } from '../assets/javascript/academyComparison.js';

export default {
  name: 'TrophyCase',
  // Deliberately does NOT hide the app header (it used to): every other
  // screen keeps the header space — games swap in their own art, the rest
  // carry whatever banner was up when you arrived — and this page going
  // headerless made it the odd one out (user feedback). No bespoke Trophy
  // Case artwork exists yet, so the standard header/banner rides along.
  data () {
    return {
      // { [personName]: profilePath | null } - see ensurePersonPhoto.
      personPhotoCache: {}
    };
  },
  watch: {
    // Looks up a photo for every person winner that doesn't already carry
    // one. Deduped by name via the cache, so a repeat winner across
    // categories/years costs a single request.
    personWinnersNeedingPhotos: {
      immediate: true,
      handler (names) {
        names.forEach((name) => this.ensurePersonPhoto(name));
      }
    }
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
    // Every win AND nomination, expanded once and shared by the three
    // leaderboards below (see awardStats.js - a winner is also a nominee,
    // and a person's award counts for their film, both deliberate).
    awardEntries () {
      return collectAwardEntries(
        this.$store.state.settings?.personalAwards || {},
        this.$store.getters.allMediaAsArray
      );
    },
    mostNominatedPeople () {
      return rankPeople(this.awardEntries.nominations);
    },
    mostNominatedNeverWon () {
      return rankPeopleWithoutWins(this.awardEntries.nominations, this.awardEntries.wins);
    },
    biggestSweeps () {
      return rankSweeps(this.awardEntries.wins);
    },
    backToBackWinners () {
      return winStreaks(this.awardEntries.wins);
    },
    categoryOwnersList () {
      return categoryOwners(this.awardEntries.wins, { minCount: 3 });
    },
    overdueWinners () {
      return longestWaits(this.awardEntries.nominations, this.awardEntries.wins);
    },
    // One getRating pass over the library, shared by every upset lookup —
    // never inside the ranking itself (GetRating is uncached).
    ratingByMovieId () {
      const map = new Map();
      (this.$store.getters.allMediaAsArray || []).forEach((entry) => {
        if (entry?.movie?.id == null) return;
        const rating = getRating(entry)?.calculatedTotal;
        if (Number.isFinite(rating)) map.set(entry.movie.id, rating);
      });
      return map;
    },
    academyContests () {
      return compareWithAcademy(this.awardEntries.wins, this.$store.state.allAcademyAwards || []);
    },
    academyOverall () {
      return overallAgreement(this.academyContests);
    },
    academyScorecard () {
      return categoryScorecard(this.academyContests);
    },
    academyDisagreements () {
      return biggestDisagreements(this.academyContests);
    },
    upsets () {
      const ratings = this.ratingByMovieId;
      return rankUpsets(this.awardEntries.wins, this.awardEntries.nominations, (movieId) => ratings.get(movieId) ?? null, { limit: 8 });
    },
    mostAwardedMovies () {
      return rankMovies(this.awardEntries.wins);
    },
    mostNominatedMovies () {
      return rankMovies(this.awardEntries.nominations);
    },
    // Distinct names of person winners with no profile path already stored
    // (older awards, picked before that was captured). Drives the lookup
    // watcher above.
    // Covers nominees as well as winners now that Most Nominated People
    // shows faces too - a person can be nominated without ever winning.
    personWinnersNeedingPhotos () {
      const names = new Set();
      [...this.awardEntries.wins, ...this.awardEntries.nominations].forEach(({ expanded }) => {
        if (expanded?.name && !expanded.details?.profile_path) names.add(expanded.name);
      });
      return [...names];
    },
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
    categoryName (categoryKey) {
      return PERSONAL_AWARD_CATEGORIES.find((category) => category.key === categoryKey)?.name || categoryKey;
    },
    // A PERSON gets a picture of the person - never a poster of one of
    // their films (bug report: "I don't wanna show Steven Spielberg but
    // then show the poster for one of his movies, that's not right"). The
    // preferred source is the profile path captured when the award was
    // picked; failing that we look the person up on TMDB by name (see
    // ensurePersonPhoto), and failing THAT we show their initial rather
    // than falling back to a poster, which would be actively misleading.
    // Only movie-type winners resolve to a poster.
    winnerImage (expanded) {
      if (expanded?.name) {
        const storedPath = expanded.details?.profile_path;
        const lookedUpPath = this.personPhotoCache[expanded.name];
        const profilePath = storedPath || lookedUpPath;
        return profilePath ? `https://image.tmdb.org/t/p/w185${profilePath}` : null;
      }
      if (expanded?.movie?.poster_path) {
        return `https://image.tmdb.org/t/p/w185${expanded.movie.poster_path}`;
      }
      return null;
    },
    // Same shape as SixDegreesGame's own person-photo lookup: undefined =
    // never looked up, null = looked up and there's nothing (or a lookup is
    // in flight, marked immediately so concurrent calls for the same name
    // don't double-fetch). Person photos aren't stored locally at rating
    // time (AddRating.js keeps only {name, character} for cast), so this is
    // the only way to get one for a winner whose award predates the
    // profilePath capture.
    async ensurePersonPhoto (name) {
      if (!name || Object.prototype.hasOwnProperty.call(this.personPhotoCache, name)) return;
      this.personPhotoCache = { ...this.personPhotoCache, [name]: null };
      try {
        const query = encodeURIComponent(name);
        const url = `https://api.themoviedb.org/3/search/person?api_key=${process.env.VUE_APP_TMDB_API_KEY}&query=${query}`;
        const response = await fetch(url);
        const data = await response.json();
        this.personPhotoCache = { ...this.personPhotoCache, [name]: data?.results?.[0]?.profile_path || null };
      } catch {
        // Best-effort - stays null, falls back to the initial.
      }
    },
    goToMovieId (movieId) {
      if (movieId) this.$router.push(`/movie/${movieId}`);
    },
    // Bug report: "When I click on an actor in the trophy case, it seems to
    // take me to one random film of theirs" — the old handler pushed to
    // whichever win/nomination happened to be first in the person's list. A
    // person card now opens that person's whole filmography in the Home
    // grid instead: same store-commit sequence as MovieDetail's
    // searchFor(name, 'cast') and SixDegreesGame.searchForPerson,
    // replicated for the same reason (small, component-local navigation
    // with no shared base). Category trophy cards are unchanged — their
    // film is the specific movie the award was won for, not a random one.
    searchForPerson (name) {
      if (!name) return;
      this.$store.commit('setHomePageNavigationIntent', 'search');
      this.$store.commit('setHomePagePromoteGroup', 'cast');
      this.$store.commit('setHomePageSearchValue', name);
      this.$store.commit('setHomePageSearchChips', []);
      this.$store.commit('setHomePageScrollPosition', 0);
      this.$store.commit('setBannerRequest', { type: 'fromResults' });
      this.$router.push('/');
    },
    goToMovie (win) {
      const movieId = win.expanded.movie?.id || win.expanded.movieId;
      if (movieId) {
        this.$router.push(`/movie/${movieId}`);
      }
    },
    returnHome () {
      this.$router.push('/');
    }
  }
};
</script>

<style lang="scss" scoped>
.trophy-case {
  color: #eee;
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

.decorated-list {
  display: flex;
  gap: 0.9rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;
}

.decorated-person {
  cursor: pointer;
  flex: 0 0 auto;
  text-align: center;
  width: 100px;
}

.decorated-photo {
  border-radius: 0.35rem;
  height: 140px;
  object-fit: cover;
  width: 100px;
}

/* Same footprint as .decorated-photo so the movie leaderboards line up with
   the people ones - posters just aren't cropped, since a cropped poster
   loses the title. */
.decorated-poster {
  border-radius: 0.35rem;
  height: 140px;
  object-fit: contain;
  width: 100px;
}

.decorated-photo-placeholder {
  align-items: center;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #666;
  display: flex;
  font-size: 2rem;
  justify-content: center;
}

.decorated-name {
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
  margin-top: 0.1rem;
}

.decorated-count {
  color: #ffc107;
  font-size: 0.7rem;
}

.most-decorated {
  margin-bottom: 2rem;
}

.academy-headline {
  color: #ccc;
  font-size: 0.9rem;
  margin: 0 0 0.75rem;
}

.academy-scorecard {
  display: grid;
  gap: 0.25rem 1rem;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 0.75rem;
}

.academy-score-line {
  display: flex;
  font-size: 0.8rem;
  justify-content: space-between;
}

.academy-score-label {
  color: #adb5bd;
}

.academy-score-value {
  color: #eee;
  font-weight: 600;
}

/* The categories where you actively go your own way. */
.academy-score-value.contrarian {
  color: #ffc107;
}

.academy-row {
  border-left-color: #6ec1e4;
}

.academy-row .upset-text strong {
  color: #6ec1e4;
}

.academy-row .upset-text em {
  color: #adb5bd;
  font-style: normal;
  font-size: 0.75rem;
}

.upset-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.upset-row {
  background: #1a1a1a;
  border-left: 3px solid #ff6a6a;
  border-radius: 0.35rem;
  cursor: pointer;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.75rem;
}

/* Mobile-first: press feedback only. */
.upset-row:active {
  background: #242424;
}

.upset-context {
  color: #adb5bd;
  display: block;
  font-size: 0.7rem;
  margin-bottom: 0.15rem;
}

.upset-text {
  color: #ccc;
  font-size: 0.85rem;

  strong {
    color: #ff6a6a;
  }
}
</style>

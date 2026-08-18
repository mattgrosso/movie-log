<template>
  <div class="watchlist-screen">
    <BackLink/>
    <h1 class="watchlist-title">Watchlist</h1>
    <p class="watchlist-subtitle">Built from your own ratings — what to revisit, and what to see next.</p>

    <!-- Local, always available: movies you loved but haven't logged in a
         long time. -->
    <section v-if="rewatchList.length" class="watchlist-section">
      <h2 class="section-title">Worth a rewatch</h2>
      <WatchlistRow :items="rewatchItems" puntable hat-note="Worth a rewatch" @select="goToMovie" @punt="punt" @hatted="puntAll"/>
    </section>

    <!-- Local, always available: movies the world loves more than you did
         (feedback: "if I rated something and didn't really love it, and
         the community loves it... should I give this another chance?"). -->
    <section v-if="anotherShotList.length" class="watchlist-section">
      <h2 class="section-title">Give these another shot</h2>
      <!-- "You were cool on them; the wider world wasn't" read backwards to
           Natalie (2026-08-16) — she took it as "I liked these and everyone
           else didn't". Say which way round it is in plain words. -->
      <p class="section-caption">You rated these low. Almost everyone else loves them.</p>
      <WatchlistRow :items="anotherShotItems" puntable hat-note="Worth a second look — rated low here, loved elsewhere" @select="goToMovie" @punt="punt" @hatted="puntAll"/>
    </section>

    <!-- TMDB-fed: well-regarded movies from years sitting just under the
         awards threshold (feedback: "I'm often trying to get my years up
         to 10 so I can fill in my awards"). -->
    <section v-for="section in yearSections" :key="`year-${section.year}`" class="watchlist-section">
      <h2 class="section-title">Get {{ section.year }} to {{ awardsThreshold }}</h2>
      <p class="section-caption">{{ section.count }} rated — {{ section.missing }} to go for awards.</p>
      <p v-if="yearsLoading" class="section-loading">Looking up {{ section.year }}&hellip;</p>
      <WatchlistRow v-else-if="section.movies.length" :items="mediaItems(section.movies)" :hat-note="sectionHatNote(section)" @select="rateMedia" @hatted="puntAll"/>
      <p v-else class="section-loading">Nothing well-regarded found that you haven't already rated.</p>
    </section>

    <!-- TMDB-fed: unseen movies from the people your ratings favor. Tapping
         one drops into the normal rating flow (you've just watched it) —
         the same setMovieToRate + /rate-movie handoff PickMedia uses. -->
    <!-- Film Club picks: the strongest signal in the app, and until now it
         only existed on the per-friend comparison page. -->
    <section v-if="friendPickMedia.length" class="watchlist-section">
      <h2 class="section-title">Your Film Club loves these</h2>
      <p class="section-caption">Rated 8 or better by friends, never rated by you. Agreement sorts first.</p>
      <WatchlistRow :items="mediaItems(friendPickMedia)" hat-note="Loved by the film club" @select="rateMedia" @hatted="puntAll"/>
    </section>

    <section v-for="section in rankedSections" :key="section.key" class="watchlist-section">
      <h2 class="section-title">{{ section.title }}</h2>
      <p class="section-caption">
        Based on {{ section.names.join(', ') }}.
        <span v-if="section.record" class="section-record">{{ section.record.hits }} of {{ section.record.suggested }} watched</span>
      </p>
      <p v-if="section.loading" class="section-loading">Looking up filmographies&hellip;</p>
      <WatchlistRow v-else-if="section.movies.length" :items="mediaItems(section.movies)" :hat-note="sectionHatNote(section)" @select="rateMedia" @hatted="puntAll"/>
      <p v-else class="section-loading">Nothing new found — you've seen the good ones.</p>
    </section>

    <DrawFromHat/>

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
import WatchlistRow from './WatchlistRow.vue';
import DrawFromHat from './DrawFromHat.vue';
import { getRating } from '../assets/javascript/GetRating.js';
import { friendsLoveUnseen } from '../assets/javascript/social.js';
import { rankSections, sourceSummary } from '../assets/javascript/recommendationStats.js';
import { rewatchCandidates, anotherShotCandidates, nearThresholdYears, favoritePeople, peopleYouRateHigher, rankWatchlistCandidates, ratedTmdbIds, topRatedSeeds, tasteProfile, puntKeyFor, nextPunt, isPunted } from '../assets/javascript/discover.js';
import { awardsYearThreshold } from '../assets/javascript/personalAwards.js';
import { formatScore } from '../assets/javascript/formatScore.js';

// Long enough to read the "added to <hat>" confirmation before the card that
// owns it leaves the list.
const PUNT_AFTER_HAT_MS = 4000;

export default {
  name: 'WatchlistScreen',
  components: {
    BackLink,
    DrawFromHat,
    WatchlistRow
  },
  data () {
    return {
      // Pending hat-punts, cleared on unmount — see puntAll.
      puntTimers: [],
      yearSections: [], // { year, count, missing, movies }
      gemMovies: [],
      gemsLoading: true,
      yearsLoading: true,
      directorMovies: [],
      actorMovies: [],
      actressMovies: [],
      underratedMovies: [],
      actorNames: [],
      actressNames: [],
      underratedNames: [],
      similarMovies: [],
      directorsLoading: true,
      actorsLoading: true,
      similarLoading: true,
      // One-shot guard for the library watcher below.
      loaded: false
    };
  },
  computed: {
    rewatchItems () {
      return this.rewatchList.map((candidate) => ({
        key: candidate.entry.dbKey,
        title: candidate.entry.movie.title,
        poster: this.posterUrl(candidate.entry),
        // The poster already says which film it is; this says why it's here.
        meta: `${formatScore(candidate.rating)} · ${this.yearsAgoLabel(candidate.yearsSince)}`,
        source: candidate.entry
      }));
    },
    anotherShotItems () {
      return this.anotherShotList.map((candidate) => ({
        key: candidate.entry.dbKey,
        title: candidate.entry.movie.title,
        poster: this.posterUrl(candidate.entry),
        meta: `You ${formatScore(candidate.yours)} · World ${formatScore(candidate.community)}`,
        source: candidate.entry
      }));
    },
    library () {
      return this.$store.getters.allMoviesAsArray || [];
    },
    punts () {
      return this.$store.state.settings?.watchlistPunts || {};
    },
    taste () {
      return tasteProfile(this.library, getRating);
    },
    rewatchList () {
      return rewatchCandidates(this.library, getRating)
        .filter((candidate) => !isPunted(candidate.entry, this.punts));
    },
    anotherShotList () {
      return anotherShotCandidates(this.library, getRating)
        .filter((candidate) => !isPunted(candidate.entry, this.punts));
    },
    // Your two strongest genre affinities, named (for Hidden Gems).
    topTasteGenres () {
      const nameById = new Map();
      this.library.forEach((entry) => (entry.movie?.genres || []).forEach((g) => {
        if (g?.id != null && g?.name) nameById.set(g.id, g.name);
      }));
      return Object.entries(this.taste)
        .filter(([id]) => nameById.has(Number(id)))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([id]) => ({ id: Number(id), name: nameById.get(Number(id)) }));
    },
    nearYears () {
      return nearThresholdYears(this.library, awardsYearThreshold(this.$store.state.settings));
    },
    awardsThreshold () {
      return awardsYearThreshold(this.$store.state.settings);
    },
    favoriteDirectors () {
      return favoritePeople(this.library, getRating, { role: 'director' });
    },
    favoriteActors () {
      return favoritePeople(this.library, getRating, { role: 'actor' });
    },
    // Wide, because the top three overall could be three actors and leave
    // the actresses row empty. Split down to three each after gender lands.
    favoritePerformerPool () {
      return favoritePeople(this.library, getRating, { role: 'actor', cap: 12 });
    },
    underratedPerformers () {
      return peopleYouRateHigher(this.library, getRating, { role: 'actor' });
    },
    recommendationSeeds () {
      return topRatedSeeds(this.library, getRating);
    },
    // Film Club's strongest signal, previously stranded on the per-friend
    // comparison page: what your friends love that you've never rated.
    socialFriendKeys () {
      return this.$store.getters.socialFriendKeys || [];
    },
    friendPicks () {
      // Includes friends on other apps — a Movie Log friend's raves count
      // exactly like a Cinema Roll friend's.
      return friendsLoveUnseen(this.library, getRating, this.$store.getters.filmClubProfiles || {});
    },
    friendPickMedia () {
      return this.friendPicks.map((pick) => ({
        id: pick.id,
        title: pick.title,
        poster_path: pick.poster_path,
        note: pick.fanCount > 1
          ? `${pick.fanCount} friends · ${formatScore(pick.average)} avg`
          : `${pick.fans[0].name} · ${formatScore(pick.fans[0].rating)}`
      }));
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
          key: 'actresses',
          title: 'From actresses you love',
          names: this.actressNames.map((p) => p.name),
          movies: this.actressMovies,
          loading: this.actorsLoading
        },
        {
          key: 'actors',
          title: 'From actors you love',
          names: this.actorNames.map((p) => p.name),
          movies: this.actorMovies,
          loading: this.actorsLoading
        },
        {
          // Not "who you rate highly" — who you rate higher than everyone
          // else does, which fills with different people entirely.
          key: 'underrated',
          title: 'From people you rate higher than most',
          names: this.underratedNames.map((p) => p.name),
          movies: this.underratedMovies,
          loading: this.actorsLoading
        },
        {
          key: 'similar',
          title: 'More like your favorites',
          names: this.recommendationSeeds.map((entry) => entry.movie.title),
          movies: this.similarMovies,
          loading: this.similarLoading
        },
        {
          key: 'gems',
          title: 'Hidden gems',
          names: this.topTasteGenres.map((g) => g.name),
          movies: this.gemMovies,
          loading: this.gemsLoading
        }
      ].filter((section) => section.names.length);
    },
    // Order by what has actually earned watches (recommendationStats.js).
    // Sources with no history sit at the neutral prior, so a new section
    // still gets a fair showing rather than being buried.
    sectionHatNoteMap () {
      // Plain language, readable by whoever draws it out of a shared hat —
      // so it says what Cinema Roll thought, not which code path ran.
      return {
        directors: 'From a director you love',
        actors: 'Starring an actor you love',
        actresses: 'Starring an actress you love',
        underrated: 'Starring someone you rate higher than most people do',
        similar: 'Like one of your favorites',
        gems: 'A hidden gem'
      };
    },
    rankedSections () {
      const sources = this.$store.state.settings?.watchlistLearning?.sources || {};
      return rankSections(this.peopleSections, sources).map((section) => ({
        ...section,
        record: sourceSummary(sources[section.key])
      }));
    }
  },
  beforeUnmount () {
    // A pending punt must not fire into a torn-down component.
    this.puntTimers.forEach((timer) => clearTimeout(timer));
    this.puntTimers = [];
  },
  created () {
    // Film Club picks need friends' published profiles; the watchlist is
    // reachable without ever visiting the club, so bootstrap them here too.
    this.$store.dispatch('attachSocialListeners');
    this.$store.dispatch('fetchFriendProfiles');
    this.$store.dispatch('syncExternalFriends');
  },
  watch: {
    // Friend edges arrive asynchronously from the listener, so refetch when
    // the mutual set changes.
    socialFriendKeys: {
      handler (keys) {
        if (keys?.length) this.$store.dispatch('fetchFriendProfiles');
      }
    },
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
    // TMDB-shaped lists (year fillers, Film Club picks, ranked sections).
    mediaItems (movies) {
      return this.notPunted(movies).map((media) => ({
        key: media.id,
        title: media.title || media.name || '',
        poster: media.poster_path ? `https://image.tmdb.org/t/p/w342${media.poster_path}` : null,
        // Only ever a reason to be here — never the title, which the poster
        // is already carrying.
        meta: media.note || (media.matchPct ? `${media.matchPct}% match` : null),
        source: media
      }));
    },
    posterUrl (entry) {
      const path = entry?.movie?.poster_path;
      return path ? `https://image.tmdb.org/t/p/w342${path}` : null;
    },
    // Not-yet punt: snoozes the item (60d, doubling per repeat punt) and
    // records it — the punt history is future threshold-tuning signal.
    // A movie you've put in a hat is a decision made; it shouldn't keep
    // showing up as a suggestion. Reuses the punt machinery rather than
    // inventing a second kind of hidden: it snoozes for 60 days and comes
    // back if you never got round to watching it.
    //
    // Deliberately delayed. The confirmation toast lives inside SendToHat,
    // which lives inside the card — so punting immediately unmounted the card,
    // took the toast with it, and you got no confirmation at all that
    // anything had happened. Waiting lets you read "X was added to Y" and
    // then watch it leave, which reads as cause and effect.
    puntAll (items) {
      const timer = setTimeout(() => {
        (items || []).forEach((item) => this.punt(item));
        this.puntTimers = this.puntTimers.filter((pending) => pending !== timer);
      }, PUNT_AFTER_HAT_MS);
      this.puntTimers.push(timer);
    },
    punt (item) {
      const key = puntKeyFor(item);
      if (!key) return;
      this.$store.dispatch('writeDurably', {
        path: `settings/watchlistPunts/${key}`,
        value: nextPunt(this.punts[key])
      });
    },
    notPunted (movies) {
      return (movies || []).filter((movie) => !isPunted(movie, this.punts));
    },
    dueLabel (candidate) {
      // Cycle-based (discover.js): 1.0 = exactly due.
      if (candidate.overdue >= 1.5) return 'long overdue';
      if (candidate.overdue >= 1) return 'due for a rewatch';
      return 'coming due';
    },
    yearsAgoLabel (years) {
      const rounded = Math.round(years);
      if (rounded < 1) return 'a while ago';
      return rounded === 1 ? 'a year ago' : `${rounded} years ago`;
    },
    // Year sections carry the year; the people sections carry their key.
    sectionHatNote (section) {
      if (section?.year) return `Filling out ${section.year}`;
      return this.sectionHatNoteMap[section?.key] || 'From your Cinema Roll watchlist';
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
        this.gemsLoading = false;
        this.yearsLoading = false;
        this.directorsLoading = false;
        this.actorsLoading = false;
        this.similarLoading = false;
        return;
      }
      const rated = ratedTmdbIds(this.library);

      // Resolve gender first so the performer list can be split three ways.
      // A wide pool goes in, since taking the top three overall could turn
      // out to be three actors and leave the actresses row empty.
      const performers = await this.resolvePerformers(this.favoritePerformerPool);
      this.actressNames = performers.filter((p) => p.gender === 1).slice(0, 3);
      this.actorNames = performers.filter((p) => p.gender === 2).slice(0, 3);
      this.underratedNames = await this.resolvePerformers(this.underratedPerformers);

      const [directorMovies, actressMovies, actorMovies, underratedMovies, similarMovies, yearSections, gemMovies] = await Promise.all([
        this.moviesFromPeople(this.favoriteDirectors, 'crew', rated),
        this.moviesFromPeople(this.actressNames, 'cast', rated),
        this.moviesFromPeople(this.actorNames, 'cast', rated),
        this.moviesFromPeople(this.underratedNames, 'cast', rated),
        this.moviesLikeFavorites(this.recommendationSeeds, rated),
        this.moviesForNearYears(this.nearYears, rated),
        this.hiddenGems(this.topTasteGenres, rated)
      ]);
      this.gemMovies = gemMovies;
      this.gemsLoading = false;
      this.yearSections = yearSections;
      this.yearsLoading = false;
      this.directorMovies = directorMovies;
      this.directorsLoading = false;
      this.actressMovies = actressMovies;
      this.actorMovies = actorMovies;
      this.underratedMovies = underratedMovies;
      this.actorsLoading = false;
      this.similarMovies = similarMovies;
      this.similarLoading = false;

      // Learning loop: credit sources whose earlier suggestions have since
      // been rated, then record whatever is on screen now. Recording after
      // reconciling means a movie can't be credited in the same pass it was
      // first offered.
      //
      // Each step is guarded separately, and neither is allowed to take the
      // other down. Reconciling used to throw on every visit after the first
      // (it was handed a Set where it expected an array), and because the
      // dispatch is awaited, recording never ran again either — one type
      // error froze the entire learning loop. This is best-effort
      // bookkeeping; the lists are already on screen by this point, so
      // nothing here is worth failing the page for.
      try {
        await this.$store.dispatch('reconcileWatchlistLearning', rated);
      } catch (error) {
        console.error('Watchlist learning: reconcile failed', error);
      }

      try {
        await this.$store.dispatch('recordWatchlistSuggestions', {
          directors: directorMovies.map((movie) => movie.id),
          actors: actorMovies.map((movie) => movie.id),
          similar: similarMovies.map((movie) => movie.id),
          gems: gemMovies.map((movie) => movie.id),
          friends: this.friendPickMedia.map((movie) => movie.id)
        });
      } catch (error) {
        console.error('Watchlist learning: recording failed', error);
      }
    },
    // Hidden Gems (Brian-survey D2): well-loved but little-seen — high
    // TMDB score, LOW vote count (the inverse of every popularity filter),
    // pulled from your two strongest taste genres.
    async hiddenGems (genres, rated) {
      const apiKey = process.env.VUE_APP_TMDB_API_KEY;
      const pools = await Promise.all((genres.length ? genres : [{ id: null }]).map(async ({ id }) => {
        try {
          const genreParam = id != null ? `&with_genres=${id}` : '';
          const response = await axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}${genreParam}&vote_average.gte=7.2&vote_count.gte=60&vote_count.lte=1200&sort_by=vote_average.desc&page=1`);
          return response.data?.results || [];
        } catch {
          return [];
        }
      }));
      const candidates = pools.flat().map((movie) => ({
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        release_date: movie.release_date,
        vote_average: movie.vote_average,
        vote_count: movie.vote_count,
        genre_ids: movie.genre_ids
      }));
      return rankWatchlistCandidates(candidates, rated, Date.now(), { cap: 12, profile: this.taste });
    },
    // Per near-threshold year: TMDB discover, well-voted first, then the
    // shared unseen-only quality ranking.
    async moviesForNearYears (years, rated) {
      const apiKey = process.env.VUE_APP_TMDB_API_KEY;
      const sections = await Promise.all(years.map(async ({ year, count, missing }) => {
        try {
          const response = await axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&primary_release_year=${year}&sort_by=vote_count.desc&vote_count.gte=200&page=1`);
          const candidates = (response.data?.results || []).map((movie) => ({
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            vote_count: movie.vote_count,
            popularity: movie.popularity
          }));
          const movies = rankWatchlistCandidates(candidates, rated, Date.now(), { cap: 12, profile: this.taste });
          return { year, count, missing, movies };
        } catch {
          return { year, count, missing, movies: [] };
        }
      }));
      return sections;
    },
    // credits kind: 'crew' keeps only their Director credits; 'cast' keeps
    // reasonably-billed roles (order < 10) so cameos don't flood the list.
    async moviesFromPeople (people, kind, rated) {
      const apiKey = process.env.VUE_APP_TMDB_API_KEY;
      const allCredits = [];

      await Promise.all(people.map(async (person) => {
        try {
          // The gender pass has usually already resolved this id — reuse it
          // rather than searching for the same name twice.
          let personId = person.id;
          if (personId == null) {
            const search = await axios.get(`https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(person.name)}`);
            personId = search.data?.results?.[0]?.id;
          }
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

      return rankWatchlistCandidates(allCredits, rated, Date.now(), { profile: this.taste });
    },
    /**
     * Resolve gender (and id) for the top cast names, so the performer list
     * can be split. "There should be a separate one for actors and actresses"
     * (2026-08-17).
     *
     * The library doesn't carry gender — storedEntry.js trims it — so it has
     * to come from TMDB, the same way FavoriteActors/FavoriteActresses get
     * it. The id that comes back is kept and handed to moviesFromPeople, so
     * this costs no extra requests overall.
     */
    async resolvePerformers (people) {
      const apiKey = process.env.VUE_APP_TMDB_API_KEY;

      return (await Promise.all(people.map(async (person) => {
        try {
          const search = await axios.get(`https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(person.name)}`);
          const match = search.data?.results?.[0];
          if (!match) return null;
          return { ...person, id: match.id, gender: match.gender };
        } catch (error) {
          console.error('Performer lookup failed for', person.name, error);
          return null;
        }
      }))).filter(Boolean);
    },
    // Recommendations v1 (bug report: 'some kind of a recommendation
    // system you and I will work out together') — TMDB's own
    // /recommendations for each of your top-rated movies, pooled and run
    // through the same unseen-only quality ranking. A deliberately simple
    // first pass to react to; the 'work out together' design conversation
    // can replace the seeding/scoring without touching the screen.
    async moviesLikeFavorites (seeds, rated) {
      const apiKey = process.env.VUE_APP_TMDB_API_KEY;
      const pooled = [];

      await Promise.all(seeds.map(async (seed) => {
        try {
          const response = await axios.get(`https://api.themoviedb.org/3/movie/${seed.movie.id}/recommendations?api_key=${apiKey}`);
          pooled.push(...(response.data?.results || []));
        } catch (error) {
          console.error('Recommendations lookup failed for', seed.movie.title, error);
        }
      }));

      return rankWatchlistCandidates(pooled, rated, Date.now(), { profile: this.taste });
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

.section-record {
  color: #9ec5fe;
  white-space: nowrap;
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
  /* Poster-row rule: fixed image heights + top alignment; titles below
     flow to any length without disturbing the posters. */
  align-items: flex-start;
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;
}

.rewatch-card {
  cursor: pointer;
  position: relative;
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

.punt-btn {
  align-items: center;
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid #3a3a3a;
  border-radius: 50%;
  color: #ccc;
  display: flex;
  height: 28px;
  justify-content: center;
  position: absolute;
  right: 2px;
  top: 2px;
  width: 28px;
  z-index: 2;
}

.punt-btn:active {
  background: rgba(0, 0, 0, 0.95);
}

.rewatch-due {
  color: #ffd700;
  display: block;
  font-size: 0.68rem;
  margin-top: 0.1rem;
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

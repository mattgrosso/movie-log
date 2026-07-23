<template>
  <div class="six-degrees-game">
    <BackLink label="Games" @click="$router.push('/games')"/>
    <h1 class="game-title">Six Degrees</h1>

    <!-- Bug report: needs a well-connected cast graph, more than the bare
         GamesHub gate guarantees. Same "help me get started" quick-pick
         suggestions as GamesHub/Connections/Home.vue's new-user onboarding. -->
    <div v-if="!pair" class="not-enough-movies">
      <p>Couldn't find a well-connected pair of movies in your library yet — rate a few more (especially ones sharing cast members) and try again.</p>
      <!-- Only relevant when a specific difficulty was the reason nothing was
           found - "Any" already searches the full range, so a narrower pick
           can't recover what "Any" itself couldn't find. -->
      <div v-if="selectedDifficulty" class="difficulty-picker">
        <button
          v-for="level in difficultyOptions"
          :key="level.key"
          type="button"
          class="btn-game btn-game-sm"
          :class="selectedDifficulty === level.key ? 'btn-game-primary' : 'btn-game-secondary'"
          @click="selectDifficulty(level.key)"
        >{{ level.label }}</button>
      </div>
      <NewRatingSearch value="" :suggestionsMode="true"/>
    </div>

    <template v-else>
      <p class="game-subtitle">Connect these two through shared cast members. {{ hopsSoFar }} hop{{ hopsSoFar === 1 ? '' : 's' }} so far.</p>

      <!-- Each button starts a fresh pair right away (see selectDifficulty) -
           these are actions, not a persistent filter toggle, hence "New ___
           Game" rather than a bare difficulty label. -->
      <div class="difficulty-picker">
        <button
          v-for="level in difficultyOptions"
          :key="level.key"
          type="button"
          class="btn-game btn-game-sm"
          :class="selectedDifficulty === level.key ? 'btn-game-primary' : 'btn-game-secondary'"
          @click="selectDifficulty(level.key)"
        >{{ level.label }}</button>
      </div>

      <!-- The connection, built visually between the two posters as you go -
           source through however much of the chain you've found, then (while
           still unsolved) a dimmed/dashed "goal" marker for the target. Movie
           steps show the real poster; person steps show a TMDB profile photo
           (fetched + cached per name, see ensurePersonPhoto) or initials if
           none is found. -->
      <div class="chain-row">
        <template v-for="(item, index) in chainDisplayItems" :key="item.itemKey">
          <div class="chain-step" :class="[item.type, { goal: item.isGoal }]">
            <img v-if="item.type === 'movie'" :src="gamePosterUrl(item.entry, 'w185')" :alt="item.entry.movie.title" class="chain-poster">
            <template v-else>
              <img v-if="personPhotoUrl(item.name)" :src="personPhotoUrl(item.name)" :alt="item.name" class="chain-photo">
              <div v-else class="chain-photo chain-photo-fallback">{{ personInitials(item.name) }}</div>
            </template>
            <span class="chain-step-label" :title="item.type === 'movie' ? item.entry.movie.title : item.name">{{ item.type === 'movie' ? item.entry.movie.title : item.name }}</span>
          </div>
          <i v-if="index < chainDisplayItems.length - 1" class="bi bi-arrow-right chain-arrow"></i>
        </template>
      </div>

      <div v-if="status === 'playing'" class="guess-form">
        <input
          v-model="guessInput"
          type="text"
          class="game-input"
          :placeholder="needType === 'person' ? 'Who was in that movie?' : 'What else were they in?'"
          @input="onInput"
        >
        <ul v-if="suggestions.length" class="suggestions">
          <li v-for="suggestion in suggestions" :key="suggestion.key || suggestion.name">
            <button type="button" class="suggestion-item" @click="pick(suggestion)">
              {{ suggestion.label }}
            </button>
          </li>
        </ul>
        <button type="button" class="btn-game btn-game-secondary btn-game-sm mt-2 full-width" @click="revealPath">Reveal shortest path</button>
      </div>

      <div v-else class="result-banner" :class="status">
        <p v-if="status === 'won'">
          Connected in {{ hopsSoFar }} hop{{ hopsSoFar === 1 ? '' : 's' }}
          <span v-if="pair.optimalHops != null"> (shortest possible: {{ pair.optimalHops }})</span>.
        </p>
        <p v-else>Here's the shortest path:</p>
        <div v-if="status === 'revealed'" class="chain-row revealed-chain">
          <template v-for="(link, index) in revealedChain" :key="index">
            <div class="chain-step" :class="link.type">
              <img v-if="link.type === 'movie'" :src="gamePosterUrl(link.entry, 'w185')" :alt="link.entry.movie.title" class="chain-poster">
              <template v-else>
                <img v-if="personPhotoUrl(link.name)" :src="personPhotoUrl(link.name)" :alt="link.name" class="chain-photo">
                <div v-else class="chain-photo chain-photo-fallback">{{ personInitials(link.name) }}</div>
              </template>
              <span class="chain-step-label" :title="link.type === 'movie' ? link.entry.movie.title : link.name">{{ link.type === 'movie' ? link.entry.movie.title : link.name }}</span>
            </div>
            <i v-if="index < revealedChain.length - 1" class="bi bi-arrow-right chain-arrow"></i>
          </template>
        </div>
        <button type="button" class="btn-game btn-game-primary btn-game-sm mt-2 full-width" @click="start">New Pair</button>
      </div>
    </template>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import NewRatingSearch from '../NewRatingSearch.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { buildCastGraph, pickConnectedPair, shortestPath, scorePathDifficulty, difficultyForScore, DIFFICULTY_LEVELS } from '../../assets/javascript/games/sixDegrees.js';
import { entryKey } from '../../assets/javascript/games/gameUtils.js';

const STORAGE_KEY = 'cinemaRoll.sixDegrees.current';

export default {
  name: 'SixDegreesGame',
  components: { BackLink, NewRatingSearch },
  mixins: [gameDataMixin],
  data () {
    return {
      // Two separate graphs on purpose. `graph` is capped at the 10 most-
      // billed cast per movie — that sparsity is what keeps puzzle
      // generation/optimal-path interesting (see sixDegrees.js's own
      // comment: uncapped, nearly every movie is "1 hop" from nearly every
      // other one). `playGraph` is uncapped (full cast) and is what actually
      // powers the in-play suggestions — per bug report, a real connection
      // through a supporting actor outside the top 10 was silently absent
      // from the capped graph, so typing a movie you genuinely knew the
      // actor was in surfaced nothing. Restricting to the top 10 only makes
      // sense when CHOOSING the puzzle, not when the player is doing the
      // work of recalling/typing a real connection themselves.
      graph: null,
      playGraph: null,
      pair: null,
      chain: [],
      guessInput: '',
      suggestions: [],
      revealedChain: null,
      // null = "Any" (the original unconstrained 2-4 hop range) - not
      // persisted across sessions, same as other purely-in-session game
      // preferences elsewhere (e.g. Reel Wordle's local-only round state).
      selectedDifficulty: null,
      // name -> TMDB profile_path (or null on a miss/in-flight fetch).
      // Cached so re-rendering the chain never re-fetches a name already
      // seen this session. Bug report follow-up ("actual photos of the
      // people... between the first two posters").
      personPhotoCache: {}
    };
  },
  computed: {
    difficultyOptions () {
      return [
        { key: null, label: 'New Game' },
        ...Object.entries(DIFFICULTY_LEVELS).map(([key, level]) => ({ key, label: `New ${level.label} Game` }))
      ];
    },
    pairDifficulty () {
      return this.pair?.difficulty || null;
    },
    // The chain built so far, plus (only while still unsolved) a trailing
    // "goal" marker for the target movie - once won, the real chain already
    // ends at the target, so no synthetic marker is added on top of it.
    chainDisplayItems () {
      const items = this.chain.map((link, index) => ({ ...link, itemKey: `chain-${index}` }));
      if (this.status !== 'won' && this.pair?.target) {
        items.push({ type: 'movie', entry: this.pair.target, itemKey: 'target-goal', isGoal: true });
      }
      return items;
    },
    needType () {
      const last = this.chain[this.chain.length - 1];
      return last?.type === 'movie' ? 'person' : 'movie';
    },
    hopsSoFar () {
      return Math.floor((this.chain.length - 1) / 2);
    },
    usedPersonNames () {
      return new Set(this.chain.filter((link) => link.type === 'person').map((link) => link.name));
    },
    usedMovieKeys () {
      return new Set(this.chain.filter((link) => link.type === 'movie').map((link) => entryKey(link.entry)));
    },
    status () {
      if (this.revealedChain) return 'revealed';
      const last = this.chain[this.chain.length - 1];
      if (last?.type === 'movie' && this.pair && entryKey(last.entry) === entryKey(this.pair.target)) return 'won';
      return 'playing';
    }
  },
  watch: {
    // eligibleGameEntries can be empty for a tick while the library is still
    // loading from Firebase (most visible on a direct/deep-link navigation
    // straight to this route, before dbLoaded settles) — calling loadOrStart
    // unconditionally from created() could build an empty cast graph and
    // never retry once real data arrived, silently stranding the page on
    // "not enough movies" forever. Same fix Reel Wordle already has for the
    // identical race (see its eligibleGameEntries watcher).
    eligibleGameEntries: {
      immediate: true,
      handler (entries) {
        if (this.pair || !entries.length) return;
        this.loadOrStart();
      }
    }
  },
  methods: {
    // Resumes an in-progress pair+chain from localStorage if one exists and
    // both its endpoints are still in the library; otherwise starts fresh.
    // Same pattern as Reel Wordle's persistence (see cinemaRoll.reelWordle.
    // current) — per bug report, leaving the page (e.g. to poke around Home
    // for inspiration) and coming back was silently discarding progress.
    loadOrStart () {
      this.graph = buildCastGraph(this.eligibleGameEntries);
      this.playGraph = buildCastGraph(this.eligibleGameEntries, Infinity);
      if (this.tryRestore()) return;
      this.start();
    },
    tryRestore () {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const saved = JSON.parse(raw);

        const source = this.eligibleGameEntries.find((entry) => entryKey(entry) === saved?.sourceKey);
        const target = this.eligibleGameEntries.find((entry) => entryKey(entry) === saved?.targetKey);
        if (!source || !target) return false;

        const path = shortestPath(this.graph, entryKey(source), entryKey(target));
        if (!path) return false;

        const chain = (saved.chain || [])
          .map((link) => {
            if (link.type === 'person') return { type: 'person', name: link.name };
            const entry = this.eligibleGameEntries.find((e) => entryKey(e) === link.key);
            return entry ? { type: 'movie', entry } : null;
          })
          .filter(Boolean);
        if (!chain.length) return false;

        // difficulty/difficultyScore aren't persisted (deterministically
        // re-derivable from the path + library, same reasoning as not
        // persisting optimalPath/optimalHops themselves).
        const entriesByKey = new Map(this.eligibleGameEntries.map((entry) => [entryKey(entry), entry]));
        const difficultyScore = scorePathDifficulty(path, entriesByKey);
        this.pair = {
          source,
          target,
          optimalPath: path,
          optimalHops: (path.length - 1) / 2,
          difficultyScore,
          difficulty: difficultyForScore(difficultyScore)
        };
        this.chain = chain;
        this.guessInput = '';
        this.suggestions = [];
        this.revealedChain = null;
        this.ensurePersonPhotosFor(this.chain);
        if (saved.revealed) this.revealPath();
        return true;
      } catch (error) {
        console.error('Failed to load persisted Six Degrees progress:', error);
        return false;
      }
    },
    persistState () {
      if (!this.pair) return;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          sourceKey: entryKey(this.pair.source),
          targetKey: entryKey(this.pair.target),
          chain: this.chain.map((link) => (
            link.type === 'movie' ? { type: 'movie', key: entryKey(link.entry) } : { type: 'person', name: link.name }
          )),
          revealed: Boolean(this.revealedChain)
        }));
      } catch (error) {
        // localStorage can throw in private-browsing/quota-exceeded situations;
        // the game still works for this session, it just won't persist.
        console.error('Failed to persist Six Degrees progress:', error);
      }
    },
    start () {
      this.graph = buildCastGraph(this.eligibleGameEntries);
      this.playGraph = buildCastGraph(this.eligibleGameEntries, Infinity);
      const options = this.selectedDifficulty ? { difficulty: this.selectedDifficulty } : {};
      this.pair = pickConnectedPair(this.eligibleGameEntries, this.graph, Math.random, options);
      this.chain = this.pair ? [{ type: 'movie', entry: this.pair.source }] : [];
      this.guessInput = '';
      this.suggestions = [];
      this.revealedChain = null;
      this.persistState();
    },
    // Changing difficulty replaces the current puzzle immediately rather
    // than waiting for the next "New Pair" tap - picking "Hard" mid-game
    // should give you a hard puzzle right away, not on your next visit.
    selectDifficulty (level) {
      this.selectedDifficulty = level;
      this.start();
    },
    onInput () {
      const term = this.guessInput.trim().toLowerCase();
      if (term.length < 2) {
        this.suggestions = [];
        return;
      }

      if (this.needType === 'person') {
        const lastMovie = this.chain[this.chain.length - 1].entry;
        const cast = (this.playGraph.peopleByMovie.get(entryKey(lastMovie)) || new Set());
        this.suggestions = [...cast]
          .filter((name) => !this.usedPersonNames.has(name) && name.toLowerCase().includes(term))
          .slice(0, 8)
          .map((name) => ({ name, label: name }));
      } else {
        const lastPerson = this.chain[this.chain.length - 1].name;
        const movieKeys = [...(this.playGraph.moviesByPerson.get(lastPerson) || new Set())];
        this.suggestions = movieKeys
          .filter((key) => !this.usedMovieKeys.has(key))
          .map((key) => this.eligibleGameEntries.find((entry) => entryKey(entry) === key))
          .filter(Boolean)
          .filter((entry) => entry.movie.title.toLowerCase().includes(term))
          .slice(0, 8)
          .map((entry) => ({ key: entryKey(entry), entry, label: entry.movie.title }));
      }
    },
    pick (suggestion) {
      if (this.needType === 'person') {
        this.chain = [...this.chain, { type: 'person', name: suggestion.name }];
        this.ensurePersonPhoto(suggestion.name);
      } else {
        this.chain = [...this.chain, { type: 'movie', entry: suggestion.entry }];
      }
      this.guessInput = '';
      this.suggestions = [];
      this.persistState();
    },
    revealPath () {
      if (!this.pair?.optimalPath) return;
      const path = this.pair.optimalPath;
      const links = [];
      for (let i = 0; i < path.length; i++) {
        if (i % 2 === 0) {
          const entry = this.eligibleGameEntries.find((e) => entryKey(e) === path[i]);
          links.push({ type: 'movie', entry });
        } else {
          links.push({ type: 'person', name: path[i] });
        }
      }
      this.revealedChain = links;
      this.ensurePersonPhotosFor(links);
      this.persistState();
    },
    // Circular avatar image for a chain "person" step. Not stored locally
    // (AddRating.js only keeps {name, character} for cast, no profile_path -
    // see CLAUDE.md), so this looks it up live from TMDB by name, same
    // pattern favoriteTuning.js's getDetailsForCastMember already uses for
    // the Favorites sections' person photos.
    personPhotoUrl (name) {
      const path = this.personPhotoCache[name];
      return path ? `https://image.tmdb.org/t/p/w185${path}` : null;
    },
    personInitials (name) {
      if (!name) return '?';
      return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
    },
    async ensurePersonPhoto (name) {
      // Undefined = never looked up; null = looked up, no photo (or an
      // in-flight lookup, marked immediately below so concurrent calls for
      // the same name don't double-fetch). Both fall back to initials.
      if (!name || Object.prototype.hasOwnProperty.call(this.personPhotoCache, name)) return;
      this.personPhotoCache = { ...this.personPhotoCache, [name]: null };
      try {
        const query = encodeURIComponent(name);
        const url = `https://api.themoviedb.org/3/search/person?api_key=${process.env.VUE_APP_TMDB_API_KEY}&query=${query}`;
        const response = await fetch(url);
        const data = await response.json();
        const profilePath = data?.results?.[0]?.profile_path || null;
        this.personPhotoCache = { ...this.personPhotoCache, [name]: profilePath };
      } catch {
        // Best-effort - stays null, falls back to initials.
      }
    },
    ensurePersonPhotosFor (links) {
      links.filter((link) => link.type === 'person').forEach((link) => this.ensurePersonPhoto(link.name));
    }
  }
};
</script>

<style lang="scss" scoped>
@import '@/assets/scss/game-buttons';
@import '@/assets/scss/game-inputs';

.six-degrees-game {
  color: #eee;
  min-height: 100vh;
  // Reduced from 2.5rem per feedback ("margin above the title is too
  // large"). This is still a safety margin against BackLink overlapping
  // this screen's own h1 when the global Header happens to have zero height
  // (see the identical comment in ConnectionsGame.vue/GamesHub.vue, which
  // keep the original 2.5rem) - just a smaller one. If the overlap bug
  // resurfaces on a genuine fresh/direct navigation, bump this back up.
  padding: 1.75rem 1rem 2rem;
}

.game-title {
  margin: 0.5rem 0 0.25rem;
}

.game-subtitle {
  color: #adb5bd;
  margin-bottom: 1rem;
}

.difficulty-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.not-enough-movies {
  color: #adb5bd;
  text-align: center;
  margin-top: 2rem;
}

// The connection itself: source poster -> however much of the chain has
// been found -> (while unsolved) a dimmed goal marker for the target.
// Replaces the old separate endpoints row + text-pill chain (bug report:
// "the series of pills... a bit ugly... show actual photos of the people
// and posters of the movies for the steps in between").
.chain-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.chain-step {
  text-align: center;
  // Larger than the old 100px endpoint width, per feedback ("posters a bit larger").
  width: 118px;
}

.chain-step.person {
  width: 84px;
}

.chain-poster {
  border-radius: 0.35rem;
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
}

.chain-photo {
  border-radius: 50%;
  display: block;
  width: 76px;
  height: 76px;
  margin: 0 auto;
  object-fit: cover;
}

.chain-photo-fallback {
  align-items: center;
  background: #333;
  color: #adb5bd;
  display: flex;
  font-size: 1.1rem;
  font-weight: 700;
  justify-content: center;
}

.chain-step-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 600;
  margin-top: 0.3rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// The not-yet-reached target - dashed/dimmed so it reads as "the goal", not
// a completed step of the chain.
.chain-step.goal {
  opacity: 0.5;
}

.chain-step.goal .chain-poster {
  border: 2px dashed #888;
}

.chain-arrow {
  color: #666;
  font-size: 0.9rem;
}

.guess-form {
  position: relative;
}

.suggestions {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 0.35rem;
  list-style: none;
  margin: 0.25rem 0 0;
  max-height: 220px;
  overflow-y: auto;
  padding: 0;
  position: absolute;
  width: 100%;
  z-index: 5;
}

.suggestion-item {
  background: transparent;
  border: none;
  color: #eee;
  display: block;
  padding: 0.5rem 0.75rem;
  text-align: left;
  width: 100%;
}

.suggestion-item:active {
  background: #333;
}

.result-banner {
  border-radius: 0.5rem;
  margin-top: 1rem;
  padding: 1rem;
}

.result-banner.won {
  background: rgba(76, 175, 80, 0.15);
}

.revealed-chain {
  margin-top: 0.5rem;
}
</style>

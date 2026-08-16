<template>
  <div class="favorite-directors">
    <FavoriteTuner :levers="tunerLevers" @update="onTunerUpdate" @reset="resetTuner" />
    <ul>
      <li v-for="entry in topTenList" :key="entry.name" class="favorite-list-item col-3" @click="openDirectorModal(entry)">
        <div class="portrait-wrapper" v-if="entry.details && entry.details.profile_path">
          <img
            :src="`https://image.tmdb.org/t/p/w92${entry.details.profile_path}`"
            :alt="entry.name"
            class="portrait"
          />
        </div>
        <div class="portrait-wrapper" v-else>
          <img
            src="../assets/images/Image_not_available.png"
            :alt="entry.name"
            class="portrait"
          />
        </div>
        <span class="name">{{ entry.name }}</span>
      </li>
    </ul>
    <div v-if="showModal && selectedDirector" class="director-modal-overlay">
      <div class="director-modal">
        <button class="close-btn" @click="closeDirectorModal">&times;</button>
        <h2>{{ selectedDirector.name }}</h2>
        <div class="portrait-wrapper" v-if="selectedDirector.details && selectedDirector.details.profile_path">
          <img
            :src="`https://image.tmdb.org/t/p/w185${selectedDirector.details.profile_path}`"
            :alt="selectedDirector.name"
            class="portrait"
            style="margin-bottom: 1rem; width: 120px; height: auto; display: block; margin-left: auto; margin-right: auto;"
          />
        </div>
        <div class="portrait-wrapper" v-else>
          <img
            src="../assets/images/Image_not_available.png"
            :alt="selectedDirector.name"
            class="portrait"
            style="margin-bottom: 1rem; width: 120px; height: auto; display: block; margin-left: auto; margin-right: auto;"
          />
        </div>
        <div class="modal-section">
          <h3>Rated Films</h3>
          <ul class="films-list">
            <li v-for="film in selectedDirector.entries" class="col-12" :key="film.movie.id">
              <strong>{{ film.movie.title }}</strong>
            </li>
          </ul>
        </div>
        <button class="search-btn" @click="searchForDirector">Search for this director</button>
      </div>
    </div>
  </div>
</template>

<script>
import FavoriteTuner from "./FavoriteTuner.vue";
import favoriteTuning from "../mixins/favoriteTuning.js";
import { getRating } from "../assets/javascript/GetRating.js";
import { globalAverage } from "../assets/javascript/logScore.js";
import { personLogScore } from "../assets/javascript/logScoreRankings.js";

// Persisted under settings/favoriteTuning/<TUNING_KEY>. Each section uses its own
// key so its levers stay independent of the others.
const TUNING_KEY = 'director';
const TUNING_DEFAULTS = Object.freeze({
  minEntries: 4,
  // Brian's method (adopted for every Favorite section, 2026-08-15) has
  // exactly these levers — see personLogScore in logScoreRankings.js.
  rankWeight: 7,
  bayesianWeight: 7,
});

export default {
  components: { FavoriteTuner },
  mixins: [favoriteTuning],
  props: {
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    }
  },
  data () {
    return {
      topTenList: [],
      tuningKey: TUNING_KEY,
      tuningDefaults: TUNING_DEFAULTS,
      minEntries: TUNING_DEFAULTS.minEntries,
      rankWeight: TUNING_DEFAULTS.rankWeight,
      bayesianWeight: TUNING_DEFAULTS.bayesianWeight,
      // minEntries: Minimum number of movies you must have seen from a director for them to be considered.
      //   Increase: Only directors you've seen more movies from will appear (list is more exclusive).
      //   Decrease: Directors with fewer movies seen can appear (list is more inclusive).
      showModal: false,
      selectedDirector: null,
    }
  },
  computed: {
    tunerLevers () {
      return [
        {
          key: 'minEntries',
          label: 'Minimum films',
          value: this.minEntries,
          min: 1,
          max: 15,
          step: 1,
          help: 'How many of their films you must have rated before they qualify. Higher = shorter, more exclusive list.'
        },
        {
          key: 'rankWeight',
          label: 'Best-work emphasis',
          value: this.rankWeight,
          min: 1,
          max: 15,
          step: 1,
          help: 'Films count best-first with declining weight R/(R+rank). Low = masterpieces dominate; high = the whole filmography matters.'
        },
        {
          key: 'bayesianWeight',
          label: 'Small-sample caution',
          value: this.bayesianWeight,
          min: 0,
          max: 15,
          step: 1,
          help: "How many films someone needs before you believe their average — thin filmographies get pulled toward your library average by B/(B+n). 0 = no pull; high = only deep careers can top the list."
        },
      ];
    },
  },
  methods: {
    async buildTopTwelveList () {
      // Phase 1 (runs once per data load): gather every director and their rated
      // films into peopleData. No minEntries filter and no TMDB fetch here, so
      // re-tuning never has to re-gather. Scoring + fetching happen in rescore().
      const allEntries = this.allEntriesWithFlatKeywordsAdded;
      const valueToMovies = {};

      allEntries.forEach(entry => {
        const movie = entry.movie;
        const crew = movie.crew;
        if (!crew || !Array.isArray(crew)) return;
        crew.forEach((person) => {
          if (person.job === 'Director' && person.name) {
            if (!valueToMovies[person.name]) valueToMovies[person.name] = [];
            valueToMovies[person.name].push({ entry, billing: 0 });
          }
        });
      });

      this.peopleData = Object.entries(valueToMovies).map(([name, appearances]) => {
        // DETERMINISTIC SORT: sort by movie title, then billing, then id.
        const sortedAppearances = appearances.slice().sort((a, b) => {
          const titleA = (a.entry.movie.title || '').trim().toLowerCase();
          const titleB = (b.entry.movie.title || '').trim().toLowerCase();
          if (titleA < titleB) return -1;
          if (titleA > titleB) return 1;
          if (a.billing !== b.billing) return a.billing - b.billing;
          const idA = a.entry.movie.id || 0;
          const idB = b.entry.movie.id || 0;
          return idA - idB;
        });
        return {
          name,
          entries: sortedAppearances.map(a => a.entry),
          weights: sortedAppearances.map(() => 1) // All weights 1 for directors
        };
      });

      await this.rescore();
    },
    async getCachedDetails (name) {
      // Cache by name so slider re-scores never re-hit TMDB.
      if (Object.prototype.hasOwnProperty.call(this.detailsCache, name)) {
        return this.detailsCache[name];
      }
      const details = await this.getDetailsForCastMember(name);
      this.detailsCache[name] = details;
      return details;
    },
    async rescore () {
      // Phase 2 (every tuner change): Brian's method, nothing else — plain
      // composite ratings through personLogScore (rank weighting + Bayesian
      // pull). TMDB details are fetched only for portraits.
      const seq = ++this.rescoreSeq;
      const globalAvg = globalAverage(this.allEntriesWithFlatKeywordsAdded, getRating);
      const scored = this.peopleData
        .filter(p => p.entries.length >= this.minEntries)
        .map(p => ({
          name: p.name,
          entries: p.entries,
          count: p.entries.length,
          finalScore: personLogScore(p, getRating, globalAvg, { rankWeight: this.rankWeight, bayesianWeight: this.bayesianWeight })
        }))
        .filter(p => p.finalScore !== null)
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, 12);
      await Promise.all(scored.map(async (p) => { p.details = await this.getCachedDetails(p.name); }));
      if (seq !== this.rescoreSeq) return;
      this.topTenList = scored;
    },
    openDirectorModal (entry) {
      this.selectedDirector = entry;
      this.showModal = true;
      document.body.classList.add('no-scroll');
    },
    closeDirectorModal () {
      this.showModal = false;
      this.selectedDirector = null;
      document.body.classList.remove('no-scroll');
    },
    searchForDirector () {
      const name = this.selectedDirector?.name;
      this.closeDirectorModal();
      if (name) this.updateSearchValue(name);
    },
  }
};
</script>

<style lang="scss">
.favorite-directors {
  align-items: center;
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;

  ul {
    display: flex;
    flex-wrap: wrap;
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;

    .favorite-list-item {
      align-items: center;
      cursor: pointer;
      display: flex;
      min-height: 36px;
      position: relative;

      .portrait-wrapper {
        align-items: center;
        display: flex;
        justify-content: center;
        padding: 4px;
        width: 100%;

        .portrait {
          border-radius: 6px;
          height: auto;
          object-fit: cover;
          width: 100%;
        }

        .placeholder {
          background: #444;
          height: auto;
          width: 48px;
        }
      }

      .name {
        background: #00000069;
        border-bottom-left-radius: 6px;
        border-bottom-right-radius: 6px;
        bottom: 4px;
        color: #fff;
        font-size: 0.5rem;
        left: 4px;
        padding: 2px 4px;
        position: absolute;
        right: 4px;
      }
    }
  }

  .director-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;

    .director-modal {
      background: #222;
      color: #fff;
      border-radius: 10px;
      padding: 2rem;
      min-width: 320px;
      max-width: 90vw;
      box-shadow: 0 2px 16px #000a;
      position: relative;

      .close-btn {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        background: none;
        border: none;
        color: #fff;
        font-size: 2rem;
        cursor: pointer;
      }

      .modal-section {
        margin-bottom: 1.5rem;
      }

      .search-btn {
        background: #1976d2;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 0.5rem 1.5rem;
        font-size: 1rem;
        cursor: pointer;
        margin-top: 1rem;
      }

      .breakdown-list {
        padding-left: 0;
        list-style: none;
        margin-bottom: 1rem;

        li {
          display: block;
          margin-bottom: 0.25rem;
          word-break: break-word;
          width: 100%;
        }
      }

      .films-list {
        padding-left: 0;
        list-style: none;
        max-height: 250px;
        overflow-y: auto;
        margin-bottom: 1rem;
        position: relative;

        // Fade indicator for scrollable content
        &::after {
          content: "";
          display: block;
          position: sticky;
          left: 0;
          right: 0;
          bottom: 0;
          height: 32px;
          pointer-events: none;
          background: linear-gradient(to bottom, rgba(34,34,34,0), rgba(34,34,34,0.95) 90%);
          z-index: 2;
        }

        li {
          display: block;
          margin-bottom: 0.25rem;
          word-break: break-word;
        }
      }
    }
  }
}
body.no-scroll {
  overflow: hidden !important;
}
</style>
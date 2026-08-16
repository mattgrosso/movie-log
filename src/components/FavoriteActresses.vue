<template>
  <div class="favorite-actresses">
    <ul>
      <li v-for="entry in topTenList" :key="entry.name" class="favorite-list-item col-3" @click="openActressModal(entry)">
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
    <FavoriteTuner :levers="tunerLevers" @update="onTunerUpdate" @reset="resetTuner" />
    <div v-if="showModal && selectedActress" class="actress-modal-overlay">
      <div class="actress-modal">
        <button class="close-btn" @click="closeActressModal">&times;</button>
        <h2>{{ selectedActress.name }}</h2>
        <div class="portrait-wrapper" v-if="selectedActress.details && selectedActress.details.profile_path">
          <img
            :src="`https://image.tmdb.org/t/p/w185${selectedActress.details.profile_path}`"
            :alt="selectedActress.name"
            class="portrait"
            style="margin-bottom: 1rem; width: 120px; height: auto; display: block; margin-left: auto; margin-right: auto;"
          />
        </div>
        <div class="portrait-wrapper" v-else>
          <img
            src="../assets/images/Image_not_available.png"
            :alt="selectedActress.name"
            class="portrait"
            style="margin-bottom: 1rem; width: 120px; height: auto; display: block; margin-left: auto; margin-right: auto;"
          />
        </div>
        <div class="modal-section">
          <h3>Rated Films:</h3>
          <ul class="films-list">
            <li v-for="film in selectedActress.entries" class="col-12" :key="film.movie.id">
              <strong>{{ film.movie.title }}</strong>
            </li>
          </ul>
        </div>
        <button class="search-btn col-12" @click="searchForActress">Search for this actress</button>
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

const TUNING_KEY = 'actress';
const TUNING_DEFAULTS = Object.freeze({
  minEntries: 3,
  // Brian's method (adopted for every Favorite section, 2026-08-15) has
  // exactly these levers — see personLogScore in logScoreRankings.js.
  rankWeight: 7,
  bayesianWeight: 7,
  billingWeight: 7,
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
      billingWeight: TUNING_DEFAULTS.billingWeight,
      showModal: false,
      selectedActress: null,
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
        {
          key: 'billingWeight',
          label: 'Lead-role emphasis',
          value: this.billingWeight,
          min: 1,
          max: 15,
          step: 1,
          help: "A small role never changes what a film says about them — it adds less CONFIDENCE (W/(W+billing) of a film toward escaping the library-average pull). Low = leads dominate; high = supporting parts count almost like leads."
        },
      ];
    },
  },
  methods: {
    gatherCastPeople () {
      // Gather cast appearances with their billing positions. A fixed cap
      // bounds noise and work — beyond it, W/(W+billing) contributes almost
      // nothing to confidence anyway. Billing feeds personLogScore, never a
      // pre-weight: a small role adds less CONFIDENCE, not a worse rating.
      const BILLING_CAP = 20;
      const allEntries = this.allEntriesWithFlatKeywordsAdded;
      const valueToMovies = {};
      allEntries.forEach(entry => {
        const value = entry.movie.cast;
        if (!value) return;
        if (Array.isArray(value)) {
          value.forEach((val, idx) => {
            if (idx >= BILLING_CAP) return;
            const name = val.name || val;
            if (!valueToMovies[name]) valueToMovies[name] = [];
            valueToMovies[name].push({ entry, billing: idx });
          });
        } else {
          const name = value.name || value;
          if (!valueToMovies[name]) valueToMovies[name] = [];
          valueToMovies[name].push({ entry, billing: 0 });
        }
      });
      return Object.entries(valueToMovies).map(([name, appearances]) => {
        const sortedAppearances = appearances.slice().sort((a, b) => {
          const titleA = a.entry.movie.title || '';
          const titleB = b.entry.movie.title || '';
          if (titleA < titleB) return -1;
          if (titleA > titleB) return 1;
          return a.billing - b.billing;
        });
        return {
          name,
          entries: sortedAppearances.map(a => a.entry),
          billings: sortedAppearances.map(a => a.billing)
        };
      });
    },
    async buildTopTwelveList () {
      // The gather is cheap (no TMDB calls), so
      // rescore() re-gathers each pass. TMDB gender lookups are still cached.
      await this.rescore();
    },
    async rescore () {
      // Brian's method for cast: billing shrinks a credit's share of the
      // effective film count (confidence), never the rating itself. Gender
      // gating walks the ranked list with cached TMDB lookups, as before.
      const seq = ++this.rescoreSeq;
      const globalAvg = globalAverage(this.allEntriesWithFlatKeywordsAdded, getRating);
      const ranked = this.gatherCastPeople()
        .filter(p => p.entries.length >= this.minEntries)
        .map(p => ({
          name: p.name,
          entries: p.entries,
          count: p.entries.length,
          finalScore: personLogScore(p, getRating, globalAvg, { rankWeight: this.rankWeight, bayesianWeight: this.bayesianWeight, billingWeight: this.billingWeight })
        }))
        .filter(p => p.finalScore !== null)
        .sort((a, b) => b.finalScore - a.finalScore);
      const top = [];
      for (let i = 0; i < ranked.length && top.length < 12; i++) {
        const cand = ranked[i];
        const details = await this.getCachedDetails(cand.name);
        if (seq !== this.rescoreSeq) return; // superseded by a newer rescore
        if (!details || typeof details.gender !== 'number') continue;
        if (details.gender === 1) {
          top.push({ ...cand, details });
        }
      }
      if (seq !== this.rescoreSeq) return;
      this.topTenList = top;
    },
    openActressModal (entry) {
      this.selectedActress = entry;
      this.showModal = true;
      document.body.classList.add('no-scroll');
    },
    closeActressModal () {
      this.showModal = false;
      this.selectedActress = null;
      document.body.classList.remove('no-scroll');
    },
    searchForActress () {
      const name = this.selectedActress?.name;
      this.closeActressModal();
      if (name) this.updateSearchValue(name);
    },
  }
};
</script>

<style lang="scss">
.favorite-actresses {
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
          background: #eee;
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

  .actress-modal-overlay {
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

    .actress-modal {
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
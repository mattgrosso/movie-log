<template>
  <div class="favorite-cinematographers">
    <ul>
      <li v-for="entry in topTenList" :key="entry.name" class="favorite-list-item col-3" @click="openCinematographerModal(entry)">
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
        <span class="name">
          {{ entry.name }}
          <span v-if="entry.finalScore != null" class="person-score">{{ entry.finalScore.toFixed(2) }}</span>
        </span>
      </li>
    </ul>
    <FavoriteTuner :levers="tunerLevers" @update="onTunerUpdate" @reset="resetTuner" />
    <!-- One shared modal for all eight sections; each used to carry
         its own copy, which is how they drifted apart. -->
    <PersonModal
      v-if="showModal && selectedCinematographer"
      :person="selectedCinematographer"
      role-label="Cinematographer"
      :rank="rankOfCinematographer"
      :library-average="libraryAverageScore"
      @close="closeCinematographerModal"
      @search="searchForCinematographer"
      @select-film="goToFilm"
    />
  </div>
</template>

<script>
import FavoriteTuner from "./FavoriteTuner.vue";
import favoriteTuning from "../mixins/favoriteTuning.js";
import { getRating } from "../assets/javascript/GetRating.js";
import { globalAverage } from "../assets/javascript/logScore.js";
import { personLogScore } from "../assets/javascript/logScoreRankings.js";
import { dedupeAppearancesByFilm } from "../assets/javascript/personCredits.js";
import PersonModal from "./PersonModal.vue";

const TUNING_KEY = 'cinematographer';
const TUNING_DEFAULTS = Object.freeze({
  minEntries: 5,
  // Brian's method (adopted for every Favorite section, 2026-08-15) has
  // exactly these levers — see personLogScore in logScoreRankings.js.
  rankWeight: 7,
  bayesianWeight: 7,
});

export default {
  components: { FavoriteTuner, PersonModal },
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
      minEntries: 5,
      // minEntries: Minimum number of movies you must have seen from a cinematographer for them to be considered.
      //   Increase: Only cinematographers you've seen more movies from will appear (list is more exclusive).
      //   Decrease: cinematographers with fewer movies seen can appear (list is more inclusive).
      showModal: false,
      selectedCinematographer: null,
    }
  },
  computed: {
    rankOfCinematographer () {
      if (!this.selectedCinematographer) return null;
      const index = this.topTenList.findIndex((p) => p.name === this.selectedCinematographer.name);
      return index >= 0 ? index + 1 : null;
    },
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
      // Phase 1 (once per data load): gather every cinematographer + their films.
      const allEntries = this.allEntriesWithFlatKeywordsAdded;
      const valueToMovies = {};

      allEntries.forEach(entry => {
        const movie = entry.movie;
        const crew = movie.crew;
        if (!crew || !Array.isArray(crew)) return;
        crew.forEach((person) => {
          if ((person.job === 'Director of Photography' || person.job === 'Cinematographer') && person.name) {
            if (!valueToMovies[person.name]) valueToMovies[person.name] = [];
            valueToMovies[person.name].push({ entry, billing: 0 });
          }
        });
      });

      this.peopleData = Object.entries(valueToMovies).map(([name, appearances]) => {
        const sortedAppearances = dedupeAppearancesByFilm(appearances).sort((a, b) => {
          const titleA = a.entry.movie.title || '';
          const titleB = b.entry.movie.title || '';
          if (titleA < titleB) return -1;
          if (titleA > titleB) return 1;
          return a.billing - b.billing;
        });
        return {
          name,
          entries: sortedAppearances.map(a => a.entry),
          weights: sortedAppearances.map(() => 1) // All weights 1 for cinematographers
        };
      });

      await this.rescore();
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
      // Render the ranking IMMEDIATELY — it is computed entirely from local
      // data. Portraits are a TMDB lookup and stream in after. Awaiting all
      // 12 lookups before assigning meant a slow/throttled TMDB left the
      // whole section blank, names and scores included.
      if (seq !== this.rescoreSeq) return;
      this.topTenList = scored;
      scored.forEach((person, index) => {
        this.getCachedDetails(person.name).then((details) => {
          if (seq === this.rescoreSeq) {
            const row = this.topTenList[index];
            if (row && row.name === person.name) {
              this.topTenList[index] = { ...row, details };
            }
          }
          return null;
        }).catch(() => null);
      });
    },
    // Where they sit in this list, for the modal's "#3" badge.
    goToFilm (film) {
      this.closeCinematographerModal();
      const id = film?.movie?.id;
      if (id) this.$router.push(`/movie/${id}`);
    },
    openCinematographerModal (entry) {
      this.selectedCinematographer = entry;
      this.showModal = true;
      document.body.classList.add('no-scroll');
    },
    closeCinematographerModal () {
      this.showModal = false;
      this.selectedCinematographer = null;
      document.body.classList.remove('no-scroll');
    },
    searchForCinematographer () {
      const name = this.selectedCinematographer?.name;
      this.closeCinematographerModal();
      if (name) this.updateSearchValue(name);
    },
  }
};
</script>

<style lang="scss">
.favorite-cinematographers {
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
        /* Name left, Log Score right — "so I can see how close the races
           are". The score never shrinks; the name gives way instead. */
        align-items: baseline;
        display: flex;
        gap: 3px;
        justify-content: space-between;
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

        .person-score {
          color: #9ec5fe;
          flex: 0 0 auto;
          font-weight: 700;
        }
      }
    }
  }

}

body.no-scroll {
  overflow: hidden !important;
}
</style>
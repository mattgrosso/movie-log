<template>
  <div class="personal-awards-screen">
    <BackLink label="Back" @click="leave"/>

    <!-- Year strip, same idea as the home screen's year scroller: every
         eligible year, ascending, scrolled side to side, current one
         centered. This is how you reach a single year's awards — before it
         there was no way to ask for one (Matt, 2026-08-16). -->
    <div v-if="awardsYears.length" ref="yearScroller" class="awards-year-scroller">
      <button
        v-for="yearData in awardsYears"
        :key="yearData.year"
        type="button"
        class="awards-year-pill"
        :class="{
          selected: yearData.year === activeYear,
          completed: yearData.completed,
          started: yearData.started && !yearData.completed
        }"
        @click="selectYear(yearData.year)"
      >
        <span class="awards-year-label">{{ yearData.year }}</span>
        <span class="awards-year-progress">
          <i v-if="yearData.completed" class="bi bi-trophy-fill"></i>
          <template v-else-if="yearData.started">{{ yearData.completedCategories }}/{{ yearData.totalCategories }}</template>
          <template v-else>&mdash;</template>
        </span>
      </button>
    </div>

    <PersonalAwardsModal
      :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"
      :personalAwardName="personalAwardName"
      :awardNameWithThe="awardNameWithTheLabel"
      :awardNameSingular="awardNameSingularLabel"
      :selectedYear="yearFromRoute"
      :autoOpen="true"
      :pageMode="true"
      @closed="leave"
      @yearChanged="activeYear = $event"
    />
  </div>
</template>

<script>
// The Personal Awards flow as a real page (feedback: the modal "always
// feels a little bit janky... maybe it would feel better if it was just a
// full page like we do for other things"). This also fixes the
// intermittent open-failure for good: Insights/MovieDetail used to write
// three settings flags via setDBValue — which never commits locally — then
// navigate Home and hope the Firebase echo arrived before the modal gate
// looked. Now the year rides in the URL (/awards?year=1997) and there is
// no handoff to race.
//
// The old AwardsResults browser used to sit below this — a year <select>
// plus a winners table, relocated here from Insights. It's gone: the page
// above it now IS the view of a year's awards, and the year strip replaces
// its dropdown ("I don't think we need that anymore. I think we've replaced
// it with what we're looking at now", 2026-08-16).
import PersonalAwardsModal from './PersonalAwardsModal.vue';
import BackLink from './games/BackLink.vue';
import {
  awardNameWithThe,
  awardNameSingular,
  awardsYearsWithProgress
} from '../assets/javascript/personalAwards.js';
import { PERSONAL_AWARD_CATEGORIES } from '../assets/javascript/personalAwardsCategories.js';

export default {
  name: 'PersonalAwardsScreen',
  components: { PersonalAwardsModal, BackLink },
  data () {
    return {
      // Mirrors whichever year the modal is actually showing, which is not
      // always the one in the URL: arriving at /awards with no year lets the
      // modal pick, and the strip has to highlight what you're looking at.
      activeYear: null
    };
  },
  computed: {
    yearFromRoute () {
      const year = Number(this.$route.query.year);
      return Number.isFinite(year) ? year : null;
    },
    awardsYears () {
      return awardsYearsWithProgress(
        this.allEntriesWithFlatKeywordsAdded,
        this.$store.state.settings,
        PERSONAL_AWARD_CATEGORIES.length
      );
    },
    personalAwardName () {
      const value = this.$store.state.settings?.personalAwardName;
      return (typeof value === 'string' && value.length > 0) ? value : 'Oscar';
    },
    awardNameWithTheLabel () {
      return awardNameWithThe(this.personalAwardName);
    },
    awardNameSingularLabel () {
      return awardNameSingular(this.personalAwardName);
    },
    // Same movie-entry shape Home/Insights hand the awards component.
    allEntriesWithFlatKeywordsAdded () {
      return (this.$store.getters.allMoviesAsArray || []).map((result) => ({
        ...result,
        movie: {
          ...result.movie,
          flatKeywords: result.movie.keywords ? result.movie.keywords.map((keyword) => keyword.name) : []
        }
      }));
    }
  },
  watch: {
    activeYear () {
      this.$nextTick(() => this.centerYearPill());
    },
    awardsYears (years) {
      // The library arrives after the first render, so the strip is empty on
      // a cold load and can't be centered until it isn't.
      if (years.length) this.$nextTick(() => this.centerYearPill());
    }
  },
  methods: {
    selectYear (year) {
      if (year === this.activeYear) return;
      // replace, not push: stepping through years shouldn't bury the way back.
      this.$router.replace({ path: '/awards', query: { year } });
    },
    centerYearPill () {
      const pill = this.$refs.yearScroller?.querySelector('.awards-year-pill.selected');
      // Guarded: jsdom has no scrollIntoView at all.
      if (pill && typeof pill.scrollIntoView === 'function') {
        pill.scrollIntoView({ inline: 'center', block: 'nearest' });
      }
    },
    leave () {
      if (window.history.length > 1) {
        this.$router.back();
      } else {
        this.$router.push('/');
      }
    }
  }
};
</script>

<style scoped>
.personal-awards-screen {
  color: #eee;
  /* Side padding only. The old 2.5rem top "BackLink safety margin" was a
     misunderstanding: BackLink is position:absolute and floats over the
     global header banner, so the reserved space was pure dead air below
     the header image (feedback, twice). */
  padding: 0.75rem 1rem 2rem;
}

.awards-year-scroller {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.9rem;
  overflow-x: auto;
  padding: 0.15rem 0.1rem;
  -webkit-overflow-scrolling: touch;
}

.awards-year-pill {
  align-items: center;
  background: #161616;
  border: 1px solid #2e2e2e;
  border-radius: 8px;
  color: #ccc;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 0.1rem;
  /* 40px minimum touch target. */
  min-height: 44px;
  padding: 0.35rem 0.6rem;
}

/* Mobile-first: press feedback is :active only. A tapped pill would keep a
   hover state forever on an installed PWA. */
.awards-year-pill:active {
  opacity: 0.7;
}

.awards-year-pill.started {
  border-color: #4a4a4a;
  color: #eee;
}

.awards-year-pill.completed {
  border-color: #6b5a1f;
  color: #eee;
}

.awards-year-pill.selected {
  background: #3b5aaa;
  border-color: #fff;
  color: #fff;
}

.awards-year-label {
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.1;
}

.awards-year-progress {
  /* #9a9a9a on #161616 clears 7:1; the selected pill's own color wins over it. */
  color: #9a9a9a;
  font-size: 0.65rem;
  line-height: 1.1;
}

.awards-year-pill.selected .awards-year-progress {
  color: #dfe6f7;
}

.awards-year-pill.completed .awards-year-progress {
  color: #ffd700;
}

.awards-year-pill.selected.completed .awards-year-progress {
  color: #ffd700;
}
</style>

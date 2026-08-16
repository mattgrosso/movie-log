<template>
  <div class="personal-awards-screen">
    <BackLink label="Back" @click="leave"/>
    <PersonalAwardsModal
      :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"
      :personalAwardName="personalAwardName"
      :awardNameWithThe="awardNameWithTheLabel"
      :awardNameSingular="awardNameSingularLabel"
      :selectedYear="yearFromRoute"
      :autoOpen="true"
      :pageMode="true"
      @closed="leave"
    />
    <!-- Past-results browser, relocated from Insights (2026-08-15 tabbed
         rework). Trophy Case deliberately has no per-year winner lists,
         so this is where a completed year is reviewed in full. -->
    <AwardsResults :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"/>
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
import PersonalAwardsModal from './PersonalAwardsModal.vue';
import AwardsResults from './AwardsResults.vue';
import BackLink from './games/BackLink.vue';
import { awardNameWithThe, awardNameSingular } from '../assets/javascript/personalAwards.js';

export default {
  name: 'PersonalAwardsScreen',
  components: { PersonalAwardsModal, AwardsResults, BackLink },
  computed: {
    yearFromRoute () {
      const year = Number(this.$route.query.year);
      return Number.isFinite(year) ? year : null;
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
  methods: {
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
</style>

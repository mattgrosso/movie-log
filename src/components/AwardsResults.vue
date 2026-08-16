<template>
  <div class="awards-results-panel">
      <div class="insights-pane-header">
        <p>Personal Awards Results</p>
      </div>
      <div class="awards-year-selector mb-3 w-100">
        <div class="form-floating" data-bs-theme="dark">
          <select id="awards-year-select" class="form-select w-100" v-model="selectedAwardsYear">
            <option v-for="yearData in allAwardsYears" :key="yearData.year" :value="yearData.year">
              {{ yearData.year }}
              <span v-if="yearData.completedCategories < yearData.totalCategories"> ({{ yearData.completedCategories }}/{{ yearData.totalCategories }} complete)</span>
            </option>
          </select>
          <label for="awards-year-select">Select Year</label>
        </div>

        <!-- Edit/Resume button -->
        <div class="d-flex gap-2 mt-2">
          <button
            v-if="selectedYearData && !selectedYearData.completed"
            class="btn btn-outline-primary btn-sm flex-fill"
            @click="resumeAwards(selectedAwardsYear)"
          >
            <i class="fas fa-edit me-1"></i>
            Resume Awards
          </button>

          <button
            v-else-if="selectedYearData && selectedYearData.completed"
            class="btn btn-outline-secondary btn-sm flex-fill"
            @click="resumeAwards(selectedAwardsYear)"
          >
            <i class="fas fa-edit me-1"></i>
            Edit Awards
          </button>

          <button
            v-if="hasEligibleYears && isWithinDailyLimit"
            class="btn btn-outline-warning btn-sm"
            @click="startNewAwards"
          >
            <span v-if="startingNewAwards" class="spinner-border spinner-border-sm me-2" role="status"></span>
            <i v-else class="fas fa-refresh"></i>
            <span v-if="startingNewAwards">Resetting...</span>
            <span v-else>Reset daily limit</span>
          </button>
        </div>
        <button class="btn btn-outline-light btn-sm w-100 mt-2" @click="goToTrophyCase">
          <i class="bi bi-trophy me-1"></i>
          Trophy Case
        </button>
      </div>
      <div v-if="selectedAwardsData" class="awards-results">

        <!-- Compact view: just category + winner -->
        <div v-if="compactAwardsView">
          <table class="table table-sm table-dark mb-2 text-light">
            <tbody>
              <template v-for="category in awardCategories" :key="category.key">
                <tr v-if="shouldShowCategory(category.key)">
                  <td class="text-secondary small" style="width: 45%">{{ category.name }}</td>
                  <td class="text-light small">
                    <span v-if="selectedAwardsData[category.key] && selectedAwardsData[category.key].winner">
                      <span v-if="isPersonCategory(category.key)">
                        <span class="text-light">{{ getPersonTitle(selectedAwardsData[category.key].winner) }}</span>
                        <span class="text-secondary"> for </span>
                        <span class="text-light">{{ getMovieTitle(selectedAwardsData[category.key].winner) }}</span>
                      </span>
                      <span v-else>{{ getOptionTitle(selectedAwardsData[category.key].winner) }}</span>
                    </span>
                    <span v-else class="text-secondary fst-italic">—</span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
          <button class="btn btn-outline-secondary btn-sm w-100" @click="compactAwardsView = false">
            Show full results
          </button>
        </div>

        <!-- Full view: posters + nominees -->
        <div v-else>
          <template v-for="category in awardCategories" :key="category.key">
            <div v-if="shouldShowCategory(category.key)" class="award-category mb-3">
              <h6 class="category-title mb-2">{{ category.name }}</h6>
              <div v-if="selectedAwardsData[category.key]" class="category-results">
                <div class="award-display d-flex align-items-start">
                  <!-- Winner Poster -->
                  <div v-if="selectedAwardsData[category.key].winner" class="winner-section me-3">
                    <div class="winner-poster">
                      <img
                        v-if="getMoviePoster(selectedAwardsData[category.key].winner)"
                        :src="getMoviePoster(selectedAwardsData[category.key].winner)"
                        :alt="getOptionTitle(selectedAwardsData[category.key].winner)"
                        class="poster-img"
                      >
                      <div v-else class="poster-placeholder">
                        {{ getOptionTitle(selectedAwardsData[category.key].winner).charAt(0) }}
                      </div>
                      <div class="winner-badge">WINNER</div>
                    </div>
                    <div v-if="isPersonCategory(category.key)" class="winner-title mt-1">
                      {{ getPersonTitle(selectedAwardsData[category.key].winner) }}<br/>
                      ({{ getMovieTitle(selectedAwardsData[category.key].winner) }})
                    </div>
                  </div>
                  <!-- Nominees List -->
                  <div v-if="getNomineesExcludingWinner(selectedAwardsData[category.key]).length > 0" class="nominees-section flex-grow-1">
                    <div class="nominees-label">Also nominated:</div>
                    <ul class="nominees-list mb-0">
                      <li v-for="nominee in getNomineesExcludingWinner(selectedAwardsData[category.key])"
                          :key="getOptionId(nominee)"
                          class="nominee-item">
                        <span v-if="isPersonCategory(category.key)">{{ getPersonTitle(nominee) }} ({{ getMovieTitle(nominee) }})</span>
                        <span v-else>{{ getOptionTitle(nominee) }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div v-else class="no-data">
                <em>No data for this category</em>
              </div>
            </div>
          </template>
          <button class="btn btn-outline-secondary btn-sm w-100 mt-2" @click="compactAwardsView = true">
            Show compact view
          </button>
        </div>

      </div>
  </div>
</template>

<script>
// Year-by-year Personal Awards results browser, extracted verbatim from
// Insights during the 2026-08-15 tabbed rework (Matt: fold it into the
// awards world; Trophy Case deliberately doesn't list per-year winners,
// so this is the only place to review a specific year in full). Rendered
// on /awards below the ceremony flow.
import { expandNomineeFromMinimal as expandNomineeFromMinimalShared } from "../assets/javascript/personalAwards.js";

export default {
  name: 'AwardsResults',
  props: {
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    }
  },
  data () {
    return {
      selectedAwardsYear: null,
      compactAwardsView: true,
      startingNewAwards: false
    };
  },
  watch: {
    selectedAwardsYear () {
      this.compactAwardsView = true;
    }
  },
  computed: {
    includeShorts () {
      return this.$store.state.settings.includeShorts === true;
    },
    filteredEntriesWithFlatKeywordsAdded () {
      if (this.includeShorts) return this.allEntriesWithFlatKeywordsAdded;
      // Exclude shorts: genre 'Short' or runtime <= 40
      return this.allEntriesWithFlatKeywordsAdded.filter(result => {
        const structure = this.topStructure(result);
        const genres = structure.genres || [];
        const isShortGenre = genres.some(g => g.name && g.name.toLowerCase() === 'short');
        const runtime = structure.runtime;
        return !isShortGenre && !(runtime && runtime <= 40);
      });
    },
    completedAwardsYears () {
      // Get all years that have completed personal awards
      const personalAwards = this.$store.state.settings.personalAwards;
      if (!personalAwards) return [];

      const years = Object.keys(personalAwards)
        .filter(year => personalAwards[year].completed)
        .map(year => parseInt(year))
        .sort((a, b) => b - a); // Most recent first

      // Set default selected year to random year if not already set.
      // TODO: same computed-side-effect debt as allAwardsYears above.
      if (years.length > 0 && !this.selectedAwardsYear) {
        const randomIndex = Math.floor(Math.random() * years.length);
        // eslint-disable-next-line vue/no-side-effects-in-computed-properties
        this.selectedAwardsYear = years[randomIndex];
      }

      return years;
    },
    partialAwardsYears () {
      // Get all years with partial awards progress that can be resumed
      const personalAwards = this.$store.state.settings.personalAwards;
      if (!personalAwards) return [];

      const yearCounts = {};
      // Calculate eligible years based on movie counts
      this.filteredEntriesWithFlatKeywordsAdded.forEach(entry => {
        if (entry.movie.runtime && entry.movie.runtime <= 40) return; // Exclude shorts
        const year = new Date(entry.movie.release_date).getFullYear();
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      });

      const eligibleYears = Object.keys(yearCounts)
        .filter(year => yearCounts[year] >= 10)
        .map(year => parseInt(year));

      return eligibleYears
        .map(year => {
          const awardData = personalAwards[year];
          if (!awardData || !awardData.categories) return null;

          // Count completed categories (have nominees and winner, or marked as no nominees)
          const categories = Object.values(awardData.categories);
          const completedCategories = categories.filter(cat =>
            (cat.nominees?.length > 0 && cat.winner) || cat.noNominees === true
          ).length;

          // Only include if there's partial progress but not completed via the "Complete Awards" button
          if (completedCategories === 0) return null; // No progress

          // Check for new movies since last update
          const currentMovieIds = this.filteredEntriesWithFlatKeywordsAdded
            .filter(entry => {
              const entryYear = new Date(entry.movie.release_date).getFullYear();
              const notShort = !entry.movie.runtime || entry.movie.runtime > 40;
              return entryYear === year && notShort;
            })
            .map(entry => entry.movie.id);

          const hasNewMovies = awardData.availableMovieIds
            ? currentMovieIds.some(id => !awardData.availableMovieIds.includes(id))
            : true;

          const newMoviesCount = hasNewMovies && awardData.availableMovieIds
            ? currentMovieIds.filter(id => !awardData.availableMovieIds.includes(id)).length
            : 0;

          return {
            year,
            completedCategories,
            totalCategories: 13, // Total possible categories
            hasNewMovies,
            newMoviesCount
          };
        })
        .filter(yearData => yearData !== null)
        .sort((a, b) => b.year - a.year); // Most recent first
    },
    allAwardsYears () {
      // Calculate completion status for all years with award data
      const personalAwards = this.$store.state.settings.personalAwards;
      if (!personalAwards) return [];

      const allYears = [];

      // Get all years that have enough movies (10+) for awards
      const yearCounts = {};
      this.filteredEntriesWithFlatKeywordsAdded.forEach(entry => {
        if (entry.movie.runtime && entry.movie.runtime <= 40) return; // Exclude shorts
        const year = new Date(entry.movie.release_date).getFullYear();
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      });

      const eligibleYears = Object.keys(yearCounts)
        .filter(year => yearCounts[year] >= 10)
        .map(year => parseInt(year));

      // Process each eligible year
      eligibleYears.forEach(year => {
        const awardData = personalAwards[year];

        if (!awardData) {
          return;
        }

        // Handle missing categories (treat as 0 completed categories)
        if (!awardData.categories) {
          allYears.push({
            year,
            completed: awardData.completed === true,
            completedCategories: 0,
            totalCategories: 13,
            hasNewMovies: false
          });
          return;
        }

        // Count completed categories
        const categories = Object.values(awardData.categories);
        const completedCategories = categories.filter(cat =>
          (cat.nominees?.length > 0 && cat.winner) || cat.noNominees === true
        ).length;

        // Determine if year is completed: either all 13 categories done OR explicitly marked complete
        const isCompleted = completedCategories === 13 || awardData.completed === true;

        allYears.push({
          year,
          completed: isCompleted,
          completedCategories,
          totalCategories: 13,
          hasNewMovies: false // Could add new movies logic here if needed
        });
      });

      // Sort by year (most recent first)
      const sortedYears = allYears.sort((a, b) => b.year - a.year);

      // Set default selected year to random year if not already set.
      // TODO: this side effect belongs in a watcher/mounted, not a computed —
      // deferred because the awards-year selection has a documented history of
      // bugs and no test coverage yet. Suppressing rather than risk a blind move.
      if (sortedYears.length > 0 && !this.selectedAwardsYear) {
        const randomIndex = Math.floor(Math.random() * sortedYears.length);
        // eslint-disable-next-line vue/no-side-effects-in-computed-properties
        this.selectedAwardsYear = sortedYears[randomIndex].year;
      }

      return sortedYears;
    },
    selectedYearData () {
      // Get data for the currently selected year
      return this.allAwardsYears.find(yearData => yearData.year === this.selectedAwardsYear);
    },
    selectedAwardsData () {
      if (!this.selectedAwardsYear) return null;
      const rawCategories = this.$store.state.settings.personalAwards?.[this.selectedAwardsYear]?.categories;
      if (!rawCategories) return null;

      // Expand minimal data back to full objects for display
      const expandedCategories = {};
      Object.keys(rawCategories).forEach(categoryKey => {
        const categoryData = rawCategories[categoryKey];
        if (categoryData) {
          expandedCategories[categoryKey] = {
            nominees: (categoryData.nominees || [])
              .map(nominee => this.expandNomineeFromMinimal(nominee))
              .filter(nominee => nominee !== null),
            winner: categoryData.winner ? this.expandNomineeFromMinimal(categoryData.winner) : null,
            noNominees: categoryData.noNominees || false
          };
        }
      });

      return expandedCategories;
    },
    awardCategories () {
      return [
        { key: 'bestPicture', name: 'Best Picture' },
        { key: 'bestDirector', name: 'Best Director' },
        { key: 'bestActor', name: 'Best Actor' },
        { key: 'bestActress', name: 'Best Actress' },
        { key: 'bestSupportingActor', name: 'Best Supporting Actor' },
        { key: 'bestSupportingActress', name: 'Best Supporting Actress' },
        { key: 'bestScreenplay', name: 'Best Screenplay or Writing' },
        { key: 'bestCinematography', name: 'Best Cinematography' },
        { key: 'bestEditing', name: 'Best Editing' },
        { key: 'bestScore', name: 'Best Score or Music' },
        { key: 'bestVisualEffects', name: 'Best Visual Effects or Production Design' },
        { key: 'bestAnimatedFeature', name: 'Best Animated Feature' },
        { key: 'bestDocumentaryFeature', name: 'Best Documentary Feature' }
      ];
    },
    hasEligibleYears () {
      // Check if there are any incomplete years that could have awards
      const yearsEligibleForAwards = this.allEntriesWithFlatKeywordsAdded
        .map(entry => new Date(entry.movie.release_date).getFullYear())
        .filter(year => year >= 2010) // Or whatever your earliest year is
        .filter((year, index, array) => array.indexOf(year) === index) // Unique years
        .sort((a, b) => b - a);

      return yearsEligibleForAwards.some(year => {
        const existingAwards = this.$store.state.settings.personalAwards?.[year];
        return !existingAwards?.completed;
      });
    },
    isWithinDailyLimit () {
      const settings = this.$store.state.settings;
      const today = new Date().toDateString();
      const lastAwardDate = settings.lastAwardCompletionDate;

      // Return true if we're within the daily limit (i.e., already completed awards today)
      return lastAwardDate === today;
    },
  },
  methods: {
    topStructure (media) {
      return media.movie;
    },
    expandNomineeFromMinimal (minimalNominee) {
      return expandNomineeFromMinimalShared(minimalNominee, this.filteredEntriesWithFlatKeywordsAdded);
    },
    shouldShowCategory (categoryKey) {
      // Hide categories that have no nominees (marked as noNominees)
      if (!this.selectedAwardsData || !this.selectedAwardsData[categoryKey]) {
        return false;
      }

      const categoryData = this.selectedAwardsData[categoryKey];

      // Don't show if explicitly marked as no nominees
      if (categoryData.noNominees === true) {
        return false;
      }

      // Show if there's a winner or nominees
      return categoryData.winner || (categoryData.nominees && categoryData.nominees.length > 0);
    },
    goToTrophyCase () {
      this.$router.push('/trophy-case');
    },
    getOptionTitle (option) {
      // Helper method to get the title of an award nominee/winner
      if (!option) return '';
      return option.name || option.movie?.title || 'Unknown';
    },
    getOptionId (option) {
      // Helper method to get unique ID for an award nominee/winner
      if (!option) return '';
      return option.id || option.movie?.id || Math.random().toString(36);
    },
    getMoviePoster (option) {
      // Helper method to get movie poster URL
      if (!option) return null;

      // For person awards (actors, directors, etc.)
      if (option.details?.profile_path) {
        return `https://image.tmdb.org/t/p/w185${option.details.profile_path}`;
      }

      // For movie awards
      if (option.movie?.poster_path) {
        return `https://image.tmdb.org/t/p/w185${option.movie.poster_path}`;
      }

      return null;
    },
    getNomineesExcludingWinner (categoryData) {
      // Filter nominees to exclude the winner to avoid duplication
      if (!categoryData?.nominees || !categoryData.winner) {
        return categoryData?.nominees || [];
      }

      const winnerId = this.getOptionId(categoryData.winner);
      return categoryData.nominees.filter(nominee => this.getOptionId(nominee) !== winnerId);
    },
    isPersonCategory (categoryKey) {
      // Determine if this category is for people (actors, directors, etc) vs movies
      const personCategories = ['bestDirector', 'bestActor', 'bestActress', 'bestSupportingActor', 'bestSupportingActress'];
      return personCategories.includes(categoryKey);
    },
    getPersonTitle (option) {
      // Get person name and movie for person categories
      if (!option) return '';
      return option.name || 'Unknown';
    },
    async startNewAwards () {
      this.startingNewAwards = true;
      try {
        // Override the daily limit by clearing the last completion date
        await this.$store.dispatch('writeDurably', {
          path: 'settings/lastAwardCompletionDate',
          value: null
        });

        // Navigate to home page which will now show the awards prompt
        this.$router.push('/');
      } finally {
        // Note: loading state will be cleared when component unmounts due to navigation
        this.startingNewAwards = false;
      }
    },
    getMovieTitle (option) {
      // Get movie title for movie categories
      if (!option) return '';
      return option.movie?.title || 'Unknown Movie';
    },
    resumeAwards (year) {
      // Straight to the awards page with the year in the URL. This used to
      // write three settings flags (setDBValue — no local commit) and
      // navigate Home hoping the Firebase echo beat the modal gate; when it
      // didn't, the tap landed on Home and nothing opened (reported bug).
      this.$router.push({ path: '/awards', query: { year } });
    },
  }
};
</script>

<style lang="scss" scoped>
.awards-results-panel {
  color: #eee;
  width: 100%;

    .awards-results {
      .award-category {
        .category-title {
          color: #f8f9fa;
          font-weight: 600;
          font-size: 0.9em;
          border-bottom: 1px solid #495057;
          padding-bottom: 4px;
          text-align: end;
        }

        .category-results {
          padding-top: 12px;
        }

        .award-display {
          .winner-section {
            .winner-poster {
              position: relative;
              width: 100px;

              .poster-img, .poster-placeholder {
                width: 100%;
                aspect-ratio: 2/3;
                border-radius: 4px;
                object-fit: cover;
              }

              .poster-placeholder {
                background: #495057;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5em;
                font-weight: bold;
                color: #ffd700;
              }

              .winner-badge {
                position: absolute;
                top: -6px;
                left: 50%;
                transform: translateX(-50%);
                background: #ffd700;
                color: #000;
                font-size: 0.6em;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 8px;
                white-space: nowrap;
              }
            }

            .winner-title {
              font-size: 0.75em;
              font-weight: 600;
              text-align: center;
              line-height: 1.2;
              max-width: 100px;
            }
          }

          .nominees-section {
            .nominees-label {
              font-size: 0.8em;
              color: #adb5bd;
              font-weight: 600;
              margin-bottom: 4px;
            }

            .nominees-list {
              list-style: none;
              padding-left: 0;

              .nominee-item {
                font-size: 0.8em;
                color: #e9ecef;
                line-height: 1.3;
                margin-bottom: 2px;
                padding-left: 12px;
                position: relative;

                &::before {
                  content: "•";
                  color: #6c757d;
                  position: absolute;
                  left: 0;
                }
              }
            }
          }
        }

        .no-data {
          color: #6c757d;
          font-style: italic;
          font-size: 0.85em;
          text-align: center;
          padding: 20px;
        }
      }
    }
}
</style>

<template>
  <div class="personal-awards">
    <div class="awards-notice alert alert-warning my-2" role="alert">
      <a class="alert-link" @click.stop="openModal">
        {{ firstEligibleYear }} is ready for your {{ awardNameSingular }} choices
      </a>
    </div>
    <Modal :show="showModal" @close="closeModal">
      <template v-slot:header>
        <div v-if="!selectedCategory" class="text-center awards-header">
          <h2 class="mb-1">{{ awardNameWithThe }} {{ currentYear }}</h2>
          <p class="mb-0">Your own annual awards</p>
          
          <!-- New Movies Notification -->
          <div v-if="hasNewMovies" class="alert alert-info mt-2 mb-0 text-start">
            <h6 class="mb-2">
              <i class="fas fa-star"></i>
              New movies to consider ({{ newMoviesForCurrentYear.length }})
            </h6>
            <div class="new-movies-list">
              <div v-for="entry in newMoviesForCurrentYear" :key="entry.movie.id" class="new-movie-item">
                <strong>{{ entry.movie.title }}</strong>
                <span class="text-muted"> • {{ mostRecentRating(entry).calculatedTotal }}/10</span>
              </div>
            </div>
            <small class="text-muted">
              These movies weren't available when you last completed {{ currentYear }} awards.
            </small>
          </div>
        </div>
      </template>
      <template v-slot:body>
        <div class="awards-form">
          <!-- Mobile-First Category Grid -->
          <div v-if="!selectedCategory" class="category-grid">
            <div class="category-buttons">
              <button 
                v-for="category in categories" 
                :key="category.key"
                type="button" 
                class="category-btn"
                :class="[
                  {'completed': category.completed, 'disabled': category.disabled}, 
                  'text-bg-dark'
                ]"
                :disabled="category.disabled"
                :title="category.disabledReason || ''"
                @click="category.disabled ? null : selectCategory(category.key)"
              >
                <span class="category-status" v-if="category.completed">
                  <span class="green-checkmark">
                    <i class="bi bi-check"></i>
                  </span>
                </span>
                <span class="category-name">{{ category.name }}</span>
                <span class="category-meta" v-if="!category.disabled">
                  {{ getCategoryNomineeCount(category.key) }} nominees
                </span>
                <span class="category-winner" v-if="getCategoryWinner(category.key)">
                  👑 {{ getCategoryWinner(category.key) }}
                </span>
                <span class="category-no-nominees" v-if="isCategoryMarkedAsNoNominees(category.key)">
                  🚫 No nominees
                </span>
              </button>
            </div>
          </div>

          <!-- Category Detail View -->
          <div v-if="selectedCategory" class="category-detail">
            <!-- Sticky Top Section -->
            <div class="sticky-top-section">
              <div class="category-header d-flex justify-content-between align-items-center mb-3">
                <button class="btn btn-sm btn-outline-secondary" @click="backToCategories">
                  ← Back
                </button>
                <h5 class="mb-0 text-center flex-grow-1">{{ getCurrentCategoryName() }}</h5>
              </div>
              
              <!-- Current Nominees - Always visible -->
              <div class="current-nominees-section">
                <h6 class="section-title">Current Nominees: <span class="instruction-text">Click a nominee to select winner</span></h6>
                <div class="current-nominees-gallery">
                  <!-- No nominees button when category is empty -->
                  <div v-if="getCurrentNominees().length === 0" class="no-nominees-placeholder">
                    <button 
                      class="btn btn-sm btn-outline-secondary no-nominees-btn text-bg-dark"
                      @click="markCategoryAsNoNominees"
                    >
                      <i class="fas fa-ban"></i>
                      No nominees for now
                    </button>
                    <div class="helper-text">
                      Click options below to nominate
                    </div>
                  </div>
                  
                  <div 
                    v-for="nominee in getCurrentNominees()" 
                    :key="getOptionId(nominee)"
                    class="current-nominee-poster"
                    :class="{'winner': isWinner(nominee)}"
                    @click="selectWinner(nominee)"
                    :title="getOptionTitle(nominee)"
                  >
                    <!-- Image -->
                    <div class="nominee-poster-image">
                      <img 
                        v-if="isActingCategory(selectedCategory) && nominee.details && nominee.details.profile_path"
                        :src="`https://image.tmdb.org/t/p/w92${nominee.details.profile_path}`" 
                        :alt="nominee.name"
                      >
                      <img 
                        v-else-if="isActingCategory(selectedCategory)"
                        src="../assets/images/Image_not_available.png"
                        :alt="nominee.name"
                      >
                      <img 
                        v-else-if="nominee.movie && nominee.movie.poster_path"
                        :src="`https://image.tmdb.org/t/p/w92${nominee.movie.poster_path}`" 
                        :alt="getOptionTitle(nominee)"
                      >
                      <img 
                        v-else
                        src="../assets/images/Image_not_available.png"
                        :alt="getOptionTitle(nominee)"
                      >
                      
                      <!-- Winner crown overlay -->
                      <div v-if="isWinner(nominee)" class="winner-overlay">
                        <span class="winner-crown">👑</span>
                      </div>
                      
                      <!-- Remove button -->
                      <button class="remove-nominee-btn" @click.stop="toggleNominee(nominee)">
                        <i class="bi bi-x"></i>
                      </button>
                    </div>
                    
                    <!-- Name below -->
                    <div class="nominee-poster-name">
                      <div class="actor-name">
                        {{ getOptionTitle(nominee).length > 10 ? getOptionTitle(nominee).substring(0, 9) + '...' : getOptionTitle(nominee) }}
                      </div>
                      <!-- Show all roles for acting categories -->
                      <div v-if="isActingCategory(selectedCategory) && nominee.allRoles" class="all-roles">
                        <div v-for="movieGroup in getGroupedRolesByMovie(nominee.allRoles)" :key="movieGroup.movieId" class="movie-group-entry">
                          <div class="role-movie">{{ movieGroup.movieTitle }}</div>
                          <div v-for="character in movieGroup.characters" :key="character" class="role-character">{{ character }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>
            </div>
            
            <!-- Available Options Section -->
            <div class="available-options-section">
              <h6 class="section-title">Available Options:</h6>
              <!-- Loading state -->
              <div v-if="loadingOptions" class="loading-container">
                <div class="spinner-border" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading nominees...</p>
              </div>
              
              <!-- Movie-grouped options (for acting categories) -->
              <div v-else-if="isActingCategory(selectedCategory)" class="movie-groups">
                <div 
                  v-for="movieGroup in eligibleOptionsByMovie" 
                  :key="movieGroup.movieId"
                  class="movie-group"
                >
                  <!-- Movie header -->
                  <div class="movie-group-header">
                    <h6 class="movie-title">{{ movieGroup.movie.title }}</h6>
                    <span class="movie-year">({{ new Date(movieGroup.movie.release_date).getFullYear() }})</span>
                  </div>
                  
                  <!-- Cast members grid for this movie -->
                  <div class="nominees-grid">
                    <div 
                      v-for="option in movieGroup.loadedCast" 
                      :key="getOptionId(option)"
                      class="nominee-tile text-bg-dark"
                      :class="[{'winner': isWinner(option)}]"
                      @click="toggleNominee(option)"
                    >
                      <!-- Image container -->
                      <div class="nominee-image">
                        <img 
                          v-if="isActingCategory(selectedCategory) && option.details && option.details.profile_path"
                          :src="`https://image.tmdb.org/t/p/w154${option.details.profile_path}`" 
                          :alt="option.name"
                        >
                        <img 
                          v-else-if="isActingCategory(selectedCategory)"
                          src="../assets/images/Image_not_available.png"
                          :alt="option.name"
                        >
                        <img 
                          v-else-if="option.movie && option.movie.poster_path"
                          :src="`https://image.tmdb.org/t/p/w154${option.movie.poster_path}`" 
                          :alt="getOptionTitle(option)"
                        >
                        
                        <!-- Status overlay -->
                        <div class="nominee-status-overlay">
                          <span v-if="isWinner(option)" class="status-icon winner">👑</span>
                          <span v-else-if="isNominee(option)" class="status-icon nominee"><i class="bi bi-check"></i></span>
                        </div>
                      </div>
                      
                      <!-- Text overlay -->
                      <div class="nominee-info-overlay">
                        <div class="nominee-title">{{ getOptionTitle(option) }}</div>
                        <div class="nominee-movie" v-if="getOptionMovie(option)">
                          {{ getOptionMovie(option) }}
                        </div>
                        <div class="nominee-role" v-if="getOptionRole(option)">
                          {{ getOptionRole(option) }}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Load more button for this movie -->
                  <div v-if="movieGroup.hasMore || movieGroup.isLoading" class="load-more-section">
                    <button 
                      class="btn btn-sm btn-outline-secondary load-more-btn"
                      :disabled="movieGroup.isLoading"
                      @click="loadMoreForMovie(movieGroup.movieId)"
                    >
                      <span v-if="movieGroup.isLoading" class="spinner-border spinner-border-sm me-2" role="status"></span>
                      <i v-else class="fas fa-plus me-2"></i>
                      {{ movieGroup.isLoading ? 'Loading...' : 'Load more cast' }}
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Simple grid for non-acting categories -->
              <div v-else class="simple-options">
                <div class="nominees-grid">
                  <div 
                    v-for="option in eligibleOptions" 
                    :key="getOptionId(option)"
                    class="nominee-tile text-bg-dark"
                    :class="[{'winner': isWinner(option)}]"
                    @click="toggleNominee(option)"
                  >
                    <!-- Image container -->
                    <div class="nominee-image">
                      <img 
                        v-if="option.movie && option.movie.poster_path"
                        :src="`https://image.tmdb.org/t/p/w154${option.movie.poster_path}`" 
                        :alt="getOptionTitle(option)"
                      >
                      <img 
                        v-else
                        src="../assets/images/Image_not_available.png"
                        :alt="getOptionTitle(option)"
                      >
                      
                      <!-- Status overlay -->
                      <div class="nominee-status-overlay">
                        <span v-if="isWinner(option)" class="status-icon winner">👑</span>
                        <span v-else-if="isNominee(option)" class="status-icon nominee"><i class="bi bi-check"></i></span>
                      </div>
                    </div>
                    
                    <!-- Text overlay - conditional based on category -->
                    <div v-if="shouldShowTextOverlay(selectedCategory)" class="nominee-info-overlay">
                      <div class="nominee-title" :class="{ 'allow-wrap': selectedCategory === 'bestDirector' }">
                        {{ getOptionTitle(option) }}
                      </div>
                      <div v-if="isActingCategory(selectedCategory) && getOptionMovie(option)" class="nominee-movie">
                        {{ getOptionMovie(option) }}
                      </div>
                      <div v-if="isActingCategory(selectedCategory) && getOptionRole(option)" class="nominee-role">
                        {{ getOptionRole(option) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template v-slot:footer>
        <!-- Only show footer on category screen, not nomination screens -->
        <div v-if="!selectedCategory" class="awards-modal-footer w-100">
          <div v-if="completedCategories === totalCategories" class="completion-section w-100">
            <button 
              class="btn btn-success w-100"
              @click="completeYearAndClose"
              :disabled="savingState"
            >
              <span v-if="savingState" class="spinner-border spinner-border-sm me-2" role="status"></span>
              <i v-else class="fas fa-trophy me-2"></i>
              {{ savingState ? 'Completing...' : `Complete ${currentYear} Awards` }}
            </button>
          </div>
          
          <div v-else class="progress-section text-center">
            <small>
              {{ completedCategories }} of {{ totalCategories }} categories complete
            </small>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal.vue';
import { getRating } from '../assets/javascript/GetRating.js';
import ErrorLogService from '../services/ErrorLogService.js';

export default {
  name: "PersonalAwardsModal",
  props: {
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    },
    personalAwardName: {
      type: String,
      default: 'Oscar'
    },
    awardNameWithThe: {
      type: String,
      default: 'The Oscars'
    },
    awardNameSingular: {
      type: String,
      default: 'Oscar'
    },
    selectedYear: {
      type: Number,
      default: null
    }
  },
  components: {
    Modal
  },
  data() {
    return {
      showModal: false,
      savingState: false,
      completingYear: false, // Flag to prevent saves after completion starts
      selectedCategory: null,
      currentYear: null,
      awardsData: {},
      eligibleOptions: [], // For movie categories: simple array. For acting: movie-grouped array
      loadingOptions: false,
      // Cache expensive operations per year/category
      optionsCache: {}, // Format: { "1994-bestActor": [{ movieId, movie, loadedCast, hasMore }] }
      // Cache TMDb person details across all categories
      personDetailsCache: {} // Format: { "Tom Hanks": { gender, profile_path, etc. } }
    };
  },
  computed: {
    yearsEligibleForAwards() {
      try {
        if (!this.allEntriesWithFlatKeywordsAdded || !Array.isArray(this.allEntriesWithFlatKeywordsAdded)) {
          return [];
        }
        
        const yearCounts = {};
        
        this.allEntriesWithFlatKeywordsAdded.forEach(entry => {
          try {
            if (!entry || !entry.movie || !entry.movie.release_date) {
              return;
            }
            
            // Exclude shorts (<40min) from awards consideration
            if (entry.movie.runtime && entry.movie.runtime <= 40) {
              return;
            }
            
            const year = new Date(entry.movie.release_date).getFullYear();
            if (isNaN(year)) return;
            
            yearCounts[year] = (yearCounts[year] || 0) + 1;
          } catch (error) {
            console.error('Error processing entry for year calculation:', entry, error);
            ErrorLogService.error('Error processing entry for year calculation:', entry, error);
          }
        });

        const eligibleYears = Object.keys(yearCounts)
          .filter(year => yearCounts[year] >= 10)
          .map(year => parseInt(year))
          .filter(year => !isNaN(year))
          .sort((a, b) => b - a); // Most recent first

        // Filter out years that are already completed (optional - since this is a "living record")
        return eligibleYears.filter(year => {
          try {
            const existingAwards = this.$store.state.settings?.personalAwards?.[year];
            return !existingAwards?.completed || this.hasNewMoviesForYear(year, existingAwards);
          } catch (error) {
            console.error('Error checking year eligibility:', year, error);
            ErrorLogService.error('Error checking year eligibility:', year, error);
            return false;
          }
        });
      } catch (error) {
        console.error('Error in yearsEligibleForAwards:', error);
        ErrorLogService.error('Error in yearsEligibleForAwards:', error);
        return [];
      }
    },
    categories() {
      return [
        { key: 'bestPicture', name: 'Best Picture', type: 'movie' },
        { key: 'bestDirector', name: 'Best Director', type: 'person' },
        { key: 'bestActor', name: 'Best Actor', type: 'person' },
        { key: 'bestActress', name: 'Best Actress', type: 'person' },
        { key: 'bestSupportingActor', name: 'Best Supporting Actor', type: 'person' },
        { key: 'bestSupportingActress', name: 'Best Supporting Actress', type: 'person' },
        { key: 'bestScreenplay', name: 'Best Screenplay or Writing', type: 'movie' },
        { key: 'bestCinematography', name: 'Best Cinematography', type: 'movie' },
        { key: 'bestEditing', name: 'Best Editing', type: 'movie' },
        { key: 'bestScore', name: 'Best Score or Music', type: 'movie' },
        { key: 'bestVisualEffects', name: 'Best Visual Effects or Production Design', type: 'movie' },
        { key: 'bestAnimatedFeature', name: 'Best Animated Feature', type: 'movie' },
        { key: 'bestDocumentaryFeature', name: 'Best Documentary Feature', type: 'movie' }
      ].map(category => ({
        ...category,
        completed: this.isCategoryCompleted(category.key),
        disabled: this.isCategoryDisabled(category.key),
        disabledReason: this.getCategoryDisabledReason(category.key)
      }));
    },
    totalCategories() {
      return this.categories.filter(cat => !cat.disabled).length;
    },
    completedCategories() {
      return this.categories.filter(cat => cat.completed && !cat.disabled).length;
    },
    newMoviesForCurrentYear() {
      // Get movies that weren't available when this year was last completed
      const existingAwards = this.$store.state.settings.personalAwards?.[this.currentYear];
      if (!existingAwards || !existingAwards.completed) {
        return []; // No previous completion or not completed yet
      }
      
      return this.getNewMoviesForYear(this.currentYear, existingAwards);
    },
    hasNewMovies() {
      return this.newMoviesForCurrentYear.length > 0;
    },
    firstEligibleYear() {
      try {
        if (!this.yearsEligibleForAwards || this.yearsEligibleForAwards.length === 0) return null;
        
        // Filter to only incomplete years (years that need awards or have new movies)
        const incompleteYears = this.yearsEligibleForAwards.filter(year => {
          try {
            const existingAwards = this.$store.state.settings?.personalAwards?.[year];
            if (!existingAwards) return true; // New year needs awards
            
            // CRITICAL FIX: If awards exist but were NOT explicitly completed via "Complete Awards" button,
            // the year should still be considered incomplete (this covers partial progress)
            if (!existingAwards.completed) {
              return true;
            }
            
            // If explicitly completed, check if there are new movies since last awards update
            if (!existingAwards.lastUpdated) return true;
            
            if (!this.allEntriesWithFlatKeywordsAdded) return false;
            
            const newMovies = this.allEntriesWithFlatKeywordsAdded.filter(entry => {
              try {
                if (!entry || !entry.movie || !entry.movie.release_date) return false;
                const entryYear = new Date(entry.movie.release_date).getFullYear();
                if (entryYear !== year) return false;
                
                const movieDate = new Date(entry.ratings?.[0]?.date || entry.movie.release_date);
                return movieDate.getTime() > existingAwards.lastUpdated;
              } catch (error) {
                console.error('Error checking new movies for year:', year, entry, error);
                ErrorLogService.error('Error checking new movies for year:', year, entry, error);
                return false;
              }
            });
            
            return newMovies.length > 0;
          } catch (error) {
            console.error('Error filtering incomplete years:', year, error);
            ErrorLogService.error('Error filtering incomplete years:', year, error);
            return false;
          }
        });
        
        // Only return a year if there are incomplete years - don't show message if all years are complete
        if (incompleteYears.length === 0) return null;
        
        // Check if we have a daily selected year that's still valid
        const settings = this.$store.state.settings || {};
        const today = new Date().toDateString();
        const dailySelection = settings.dailyAwardsYear;
        const dailySelectionDate = settings.dailyAwardsYearDate;
        
        // If we have a selection from today, use it (don't re-check if it's incomplete)
        // Only override if the year is actually completed
        if (dailySelection && dailySelectionDate === today) {
          const existingAwards = settings.personalAwards?.[dailySelection];
          const isCompleted = existingAwards && existingAwards.completed;
          
          if (!isCompleted) {
            return dailySelection; // Always return today's selection unless it's completed
          }
        }
        
        // Otherwise, pick a new year and persist it
        // Prioritize years with partial progress (some categories have nominees/winners)
        const yearsWithPartialProgress = incompleteYears.filter(year => {
          try {
            const existingAwards = this.$store.state.settings?.personalAwards?.[year];
            if (!existingAwards || !existingAwards.categories) return false;
            
            // Check if any category has nominees or winners
            return Object.values(existingAwards.categories).some(categoryData => 
              (categoryData.nominees && categoryData.nominees.length > 0) || 
              categoryData.winner ||
              categoryData.noNominees
            );
          } catch (error) {
            console.error('Error checking partial progress for year:', year, error);
            ErrorLogService.error('Error checking partial progress for year:', year, error);
            return false;
          }
        });
        
        let selectedYear;
        if (yearsWithPartialProgress.length > 0) {
          // Prioritize years with partial progress
          const randomIndex = Math.floor(Math.random() * yearsWithPartialProgress.length);
          selectedYear = yearsWithPartialProgress[randomIndex];
        } else {
          // Fall back to any incomplete year
          const randomIndex = Math.floor(Math.random() * incompleteYears.length);
          selectedYear = incompleteYears[randomIndex];
        }
        
        // Persist the daily selection (don't await to avoid blocking UI)
        // Only persist if no selectedYear prop was provided (don't override Resume/Edit actions)
        if (!this.selectedYear) {
          // Wrap in try-catch to prevent dispatch errors from crashing
          try {
            this.$store.dispatch('setDBValue', { 
              path: 'settings/dailyAwardsYear',
              value: selectedYear
            });
            this.$store.dispatch('setDBValue', {
              path: 'settings/dailyAwardsYearDate',
              value: today
            });
          } catch (error) {
            console.error('Error persisting daily selection:', error);
            ErrorLogService.error('Error persisting daily selection:', error);
          }
        }
        
        return selectedYear;
      } catch (error) {
        console.error('Error in firstEligibleYear:', error);
        ErrorLogService.error('Error in firstEligibleYear:', error);
        return null;
      }
    },
    eligibleOptionsByMovie() {
      // Only return movie-grouped data for acting categories
      if (this.isActingCategory(this.selectedCategory)) {
        return this.eligibleOptions;
      }
      return [];
    }
  },
  created() {
    // If we reach this point, it means Home.vue has decided to show the awards modal
    // For Resume/Edit actions, we should automatically open the modal
    const settings = this.$store.state.settings;
    const today = new Date().toDateString();
    
    // Check if this is a Resume/Edit action (bypass was triggered)
    if (settings && settings.dailyAwardsYear && settings.dailyAwardsYearDate === today) {
      this.$nextTick(() => {
        this.openModal();
      });
    }
  },
  methods: {
    markCategoryAsNoNominees() {
      // Mark category as having no worthy nominees for now
      if (!this.awardsData[this.selectedCategory]) {
        this.awardsData[this.selectedCategory] = {};
      }
      
      this.awardsData[this.selectedCategory].nominees = [];
      this.awardsData[this.selectedCategory].winner = null;
      this.awardsData[this.selectedCategory].noNominees = true; // Special flag
      
      // Save removed - will save on Back/Complete/Close only
      
      // Navigate back to category grid to show updated status
      this.selectedCategory = null;
    },
    async backToCategories() {
      this.selectedCategory = null;
      
      // Queue save in background - store handles deduplication and sequencing
      setTimeout(() => {
        this.saveCurrentState()
      }, 0);
    },
    async completeYearAndClose() {      
      try {
        this.completingYear = true; // Set flag to prevent further saves
        // Record completion date
        await this.$store.dispatch('setDBValue', {
          path: 'settings/lastAwardCompletionDate',
          value: new Date().toDateString()
        });
        
        // Clear daily selection
        await this.$store.dispatch('setDBValue', {
          path: 'settings/dailyAwardsYear',
          value: null
        });

        // Before completing, ensure all disabled categories are marked as noNominees
        this.ensureDisabledCategoriesMarked();

        // Temporarily allow save during completion by clearing the flag
        this.completingYear = false;
        
        // Save state first, then close modal  
        await this.saveCurrentState();
        
        // Restore the completing flag and close modal
        this.completingYear = true;
        this.closeModal();
      } catch (error) {
        console.error('🚨 COMPLETE YEAR FAILED:', error.message);
        ErrorLogService.error('Error completing year:', error);
        // Still close even if save fails
        this.closeModal();
      } finally {
        this.savingState = false;
      }
    },
    openModal() {
      try {
        this.showModal = true;
        this.currentYear = this.selectedYear || this.firstEligibleYear;
        this.initializeAwardsData();
        
        // Clear options cache for new session
        this.optionsCache = {};
        this.personDetailsCache = {};
        
        // Clean up old localStorage entries (24+ hours old)
        this.cleanupLocalStorageCache();
        
      } catch (error) {
        console.error('🚨 MODAL OPEN FAILED:', error.message);
        ErrorLogService.error('Error opening Personal Awards modal:', error);
      }
    },
    closeModal() {
      try {
        this.showModal = false;
        this.selectedCategory = null;
        // Don't clear awardsData if we're in the middle of saving (completing)
        if (!this.savingState) {
          this.awardsData = {};
        }

        this.eligibleOptions = [];
      } catch (error) {
        console.error('🚨 MODAL CLOSE FAILED:', error.message);
        ErrorLogService.error('Error closing Personal Awards modal:', error);
      }
    },
    async saveCurrentState() {
      // Prevent multiple clicks or saves after completion
      if (this.savingState || this.completingYear) {
        return;
      }
      this.savingState = true;

      try {
        const isNowComplete = this.completedCategories === this.totalCategories;
        
        // Optimize: Only get movie IDs if we don't already have them
        let movieIds = [];
        const existingData = this.$store.state.settings.personalAwards?.[this.currentYear];
        if (existingData?.availableMovieIds) {
          movieIds = existingData.availableMovieIds;
        } else {
          const moviesForYear = this.getMoviesForYear();
          movieIds = moviesForYear.map(entry => entry?.movie?.id).filter(id => id);
        }
        
        // Create minimal data structure by removing huge movie objects
        const cleanedCategories = {};
        Object.keys(this.awardsData).forEach(key => {
          const categoryData = this.awardsData[key];
          if (categoryData) {
            cleanedCategories[key] = {
              nominees: (categoryData.nominees || []).map(nominee => this.convertNomineeToMinimal(nominee)).filter(n => n),
              winner: categoryData.winner ? this.convertNomineeToMinimal(categoryData.winner) : null,
              noNominees: categoryData.noNominees || false
            };
          }
        });
        
        const awardsEntry = {
          completed: isNowComplete,
          lastUpdated: Date.now(),
          availableMovieIds: movieIds,
          categories: cleanedCategories
        };
        

        
        // Queue the save - store handles deduplication and sequencing
        await this.$store.dispatch('setDBValue', {
          path: `settings/personalAwards/${this.currentYear}`,
          value: awardsEntry
        });
        
        this.savingState = false;
      } catch (error) {
        console.error('🚨 SAVE PREPARATION FAILED:', error.message);
        ErrorLogService.error('Error saving Personal Awards state:', error);
      }
    },
    initializeAwardsData() {
      try {
        const existingAwards = this.$store.state.settings.personalAwards?.[this.currentYear];
        if (existingAwards && existingAwards.categories) {
          // Expand minimal nominees back to full objects for display
          this.awardsData = {};
          Object.keys(existingAwards.categories).forEach(categoryKey => {
            const categoryData = existingAwards.categories[categoryKey];
            this.awardsData[categoryKey] = {
              nominees: (categoryData.nominees || [])
                .map(nominee => this.expandNomineeFromMinimal(nominee))
                .filter(nominee => nominee !== null), // Remove any that couldn't be expanded
              winner: categoryData.winner ? this.expandNomineeFromMinimal(categoryData.winner) : null,
              noNominees: categoryData.noNominees || false
            };
          });
        } else {
          this.awardsData = {};
        }
      } catch (error) {
        console.error('🚨 INIT FAILED:', error.message);
        ErrorLogService.error('Error initializing awards data:', error);
        this.awardsData = {};
      }
    },
    async selectCategory(categoryKey) {
      this.selectedCategory = categoryKey;
      this.loadingOptions = true;
      try {
        this.eligibleOptions = await this.getEligibleOptionsByMovie();
        
        // Auto-detect empty categories and manage noNominees flag
        this.updateNoNomineesFlag(categoryKey);
      } catch (error) {
        ErrorLogService.error('Error fetching eligible options:', error);
        this.eligibleOptions = []; // Fallback to empty array
        
        // Still check for empty category even on error
        this.updateNoNomineesFlag(categoryKey);
      } finally {
        this.loadingOptions = false;
      }
    },
    getCurrentCategoryName() {
      const category = this.categories.find(cat => cat.key === this.selectedCategory);
      return category ? category.name : '';
    },
    updateNoNomineesFlag(categoryKey) {
      // Safely manage the noNominees flag based on available options and existing nominees
      try {
        // Initialize category data if it doesn't exist
        if (!this.awardsData[categoryKey]) {
          this.awardsData[categoryKey] = { nominees: [], winner: null };
        }
        
        const categoryData = this.awardsData[categoryKey];
        const hasEligibleOptions = this.eligibleOptions && this.eligibleOptions.length > 0;
        const hasExistingNominees = categoryData.nominees && categoryData.nominees.length > 0;
        
        if (!hasEligibleOptions && !hasExistingNominees) {
          // No eligible options AND no existing nominees = auto-set noNominees to true
          if (!categoryData.noNominees) {
            categoryData.noNominees = true;
          }
        } else if (hasExistingNominees && categoryData.noNominees) {
          // Has nominees but noNominees is still true = clear the flag
          categoryData.noNominees = false;
        }
        // If there are eligible options but no nominees yet, leave noNominees as-is (user can choose)
      } catch (error) {
        console.error('🚨 Error updating noNominees flag:', error);
        ErrorLogService.error('Error updating noNominees flag:', error);
      }
    },
    ensureDisabledCategoriesMarked() {
      // Check all categories and mark disabled ones as noNominees during completion
      try {
        this.categories.forEach(category => {
          if (this.isCategoryDisabled(category.key)) {
            // Initialize category data if it doesn't exist
            if (!this.awardsData[category.key]) {
              this.awardsData[category.key] = { nominees: [], winner: null };
            }
            
            const categoryData = this.awardsData[category.key];
            
            // Only set noNominees if it's not already set and there are no nominees
            if (!categoryData.noNominees && (!categoryData.nominees || categoryData.nominees.length === 0)) {
              categoryData.noNominees = true;
            }
          }
        });
      } catch (error) {
        console.error('🚨 Error marking disabled categories:', error);
        ErrorLogService.error('Error marking disabled categories:', error);
      }
    },
    isCategoryCompleted(categoryKey) {
      const categoryData = this.awardsData[categoryKey];
      // Category is complete if it has nominees + winner OR is marked as no nominees
      return (categoryData && categoryData.nominees?.length > 0 && categoryData.winner) || 
             (categoryData && categoryData.noNominees === true);
    },
    isCategoryDisabled(categoryKey) {
      // Check if there are no eligible options for this category
      if (categoryKey === 'bestAnimatedFeature') {
        const animatedFilms = this.getMoviesForYear().filter(entry => 
          entry.movie.genres && entry.movie.genres.some(genre => genre.name === 'Animation')
        );
        return animatedFilms.length === 0;
      } else if (categoryKey === 'bestDocumentaryFeature') {
        const documentaries = this.getMoviesForYear().filter(entry => 
          entry.movie.genres && entry.movie.genres.some(genre => genre.name === 'Documentary')
        );
        return documentaries.length === 0;
      }
      return false; // Other categories are never disabled
    },
    getCategoryDisabledReason(categoryKey) {
      if (!this.isCategoryDisabled(categoryKey)) {
        return null;
      }
      
      if (categoryKey === 'bestAnimatedFeature') {
        return 'No animated films rated this year';
      } else if (categoryKey === 'bestDocumentaryFeature') {
        return 'No documentaries rated this year';
      }
      
      return null;
    },
    getMoviesForYear() {
      try {
        if (!this.allEntriesWithFlatKeywordsAdded || !Array.isArray(this.allEntriesWithFlatKeywordsAdded)) {
          return [];
        }
        
        return this.allEntriesWithFlatKeywordsAdded.filter(entry => {
          try {
            if (!entry || !entry.movie || !entry.movie.release_date) {
              return false;
            }
            const yearMatch = new Date(entry.movie.release_date).getFullYear() === this.currentYear;
            const notShort = !entry.movie.runtime || entry.movie.runtime > 40; // Exclude shorts
            return yearMatch && notShort;
          } catch (error) {
            console.error('Error processing movie entry:', entry, error);
            ErrorLogService.error('Error processing movie entry:', entry, error);
            return false;
          }
        });
      } catch (error) {
        console.error('Error in getMoviesForYear:', error);
        ErrorLogService.error('Error in getMoviesForYear:', error);
        return [];
      }
    },
    async getEligibleOptions() {
      // Check cache first
      const cacheKey = `${this.currentYear}-${this.selectedCategory}`;
      if (this.optionsCache[cacheKey]) {
        return this.optionsCache[cacheKey];
      }
      
      const category = this.categories.find(cat => cat.key === this.selectedCategory);
      if (!category) {
        return [];
      }
      
      let moviesForYear = this.getMoviesForYear();
      
      // Apply genre filtering for specific categories
      if (this.selectedCategory === 'bestAnimatedFeature') {
        moviesForYear = moviesForYear.filter(entry => 
          entry.movie.genres && entry.movie.genres.some(genre => genre.name === 'Animation')
        );
      } else if (this.selectedCategory === 'bestDocumentaryFeature') {
        moviesForYear = moviesForYear.filter(entry => 
          entry.movie.genres && entry.movie.genres.some(genre => genre.name === 'Documentary')
        );
      }
      
      let options;
      if (category.type === 'movie') {
        options = moviesForYear;
      } else {
        // For person categories, extract people and filter by gender via API
        const allPeople = this.extractPeopleFromMovies(moviesForYear, this.selectedCategory);
        options = await this.filterPeopleByGender(allPeople);
      }
      
      // Sort by relevant rating category
      const sortedOptions = this.sortOptionsByRelevantRating(options, this.selectedCategory);
      
      // Cache the results to avoid expensive recomputation
      this.optionsCache[cacheKey] = sortedOptions;
      
      return sortedOptions;
    },
    async getEligibleOptionsByMovie() {
      // Check cache first
      const cacheKey = `${this.currentYear}-${this.selectedCategory}`;
      if (this.optionsCache[cacheKey]) {
        // For cached data, show all immediately (no API calls needed)
        return this.optionsCache[cacheKey];
      }
      
      const category = this.categories.find(cat => cat.key === this.selectedCategory);
      if (!category) {
        return {};
      }
      
      let moviesForYear = this.getMoviesForYear();
      
      // Apply genre filtering for specific categories
      if (this.selectedCategory === 'bestAnimatedFeature') {
        moviesForYear = moviesForYear.filter(entry => 
          entry.movie.genres && entry.movie.genres.some(genre => genre.name === 'Animation')
        );
      } else if (this.selectedCategory === 'bestDocumentaryFeature') {
        moviesForYear = moviesForYear.filter(entry => 
          entry.movie.genres && entry.movie.genres.some(genre => genre.name === 'Documentary')
        );
      }
      
      if (category.type === 'movie') {
        // For movie categories, use simple array (like old system)
        const sortCriteria = this.getCategorySortKey(this.selectedCategory);
        const sortedMovies = this.sortOptionsByRelevantRating(moviesForYear, this.selectedCategory);
        
        // Cache and return simple array
        this.optionsCache[cacheKey] = sortedMovies;
        return sortedMovies;
      } else {
        // For acting categories, use movie-grouped approach
        const optionsByMovie = await this.extractAndGroupPeopleByMovie(moviesForYear, this.selectedCategory);

        // Sort movies by their performance rating (same as old system)
        // First create array of movie entries for sorting
        const movieEntries = Object.keys(optionsByMovie).map(movieId => {
          const movieEntry = moviesForYear.find(entry => entry.movie.id == movieId);
          return { movieId, movieEntry };
        }).filter(item => item.movieEntry);
        
        // Sort movie entries using the same logic as old system
        const sortCriteria = this.getCategorySortKey(this.selectedCategory);
        movieEntries.sort((a, b) => {
          return this.sortResultsLikeMainApp(a.movieEntry, b.movieEntry, sortCriteria);
        });
        
        // Extract sorted movie IDs
        const sortedMovieIds = movieEntries.map(item => item.movieId);
        
        // Convert to array to preserve sort order
        const sortedMovieArray = sortedMovieIds.map(movieId => ({
          movieId,
          ...optionsByMovie[movieId]
        }));
        
        // Cache the results
        this.optionsCache[cacheKey] = sortedMovieArray;
        
        return sortedMovieArray;
      }
    },
    async extractAndGroupPeopleByMovie(movies, categoryKey) {
      const isActress = categoryKey.includes('Actress');
      const isSupporting = categoryKey.includes('Supporting');
      const movieGroups = {};
      
      // Group cast members by movie
      movies.forEach(entry => {
        if (categoryKey === 'bestDirector') {
          const crew = entry.movie.crew || [];
          const directors = crew.filter(person => person.job === 'Director');
          
          if (directors.length > 0) {
            const directorNames = directors.map(d => d.name);
            movieGroups[entry.movie.id] = {
              movie: entry.movie,
              allCast: [{
                id: `directors-${entry.movie.id}`,
                name: directorNames.join(' & '),
                directors: directors,
                movie: entry.movie,
                movieId: entry.movie.id
              }],
              loadedCast: [],
              hasMore: false,
              isLoading: false
            };
          }
        } else if (categoryKey.includes('Actor') || categoryKey.includes('Actress')) {
          const cast = entry.movie.cast || [];
          
          // Use full cast list - no artificial limits
          const eligibleCast = cast.map((person, index) => {
            
            return {
              id: person.id || person.name, // Use name as fallback for grouping
              name: person.name,
              character: person.character,
              movie: entry.movie,
              movieId: entry.movie.id,
              castPosition: index,
              isActress: isActress,
              needsGenderCheck: true
            };
          });
          
          if (eligibleCast.length > 0) {
            movieGroups[entry.movie.id] = {
              movie: entry.movie,
              allCast: eligibleCast,
              loadedCast: [],
              processedIndex: 0, // Track how far into allCast we've processed
              hasMore: eligibleCast.length > 0,
              isLoading: false
            };
          }
        }
      });
      
      // Load initial cast for each movie (3 people per movie)
      const movieIds = Object.keys(movieGroups);
      
      for (const movieId of movieIds) {
        const movieGroup = movieGroups[movieId];
        
        if (movieGroup.allCast.length > 0) {
          // Load people in batches until we get 3 valid ones (accounting for gender filtering)
          let processedCast = [];
          let currentIndex = 0;
          
          while (processedCast.length < 3 && currentIndex < movieGroup.allCast.length) {
            const batchSize = 3;
            const castBatch = movieGroup.allCast.slice(currentIndex, currentIndex + batchSize);
            if (castBatch.length === 0) break;

            const filteredBatch = await this.filterCastMembersByGender(castBatch);
            processedCast.push(...filteredBatch);
            currentIndex += batchSize;
          }
          
          movieGroup.loadedCast = processedCast.slice(0, 3); // Show first 3 valid people
          movieGroup.processedIndex = currentIndex;
          movieGroup.hasMore = currentIndex < movieGroup.allCast.length;
        }
      }
      
      return movieGroups;
    },
    async filterCastMembersByGender(castMembers) {
      // Process a specific set of cast members (same logic as filterPeopleByGender but for subset)
      const filteredCast = [];
      
      for (const person of castMembers) {
        try {
          if (!person.needsGenderCheck) {
            filteredCast.push(person);
            continue;
          }
          
          const details = await this.getDetailsForCastMember(person.name);
          // If we can't determine gender, include the person (inclusive approach)
          if (!details || typeof details.gender !== 'number') {
            filteredCast.push({
              ...person,
              details: details,
              needsGenderCheck: false
            });
            continue;
          }
          
          // Apply inclusive gender logic
          let genderMatches = false;
          if (person.isActress) {
            genderMatches = details.gender === 0 || details.gender === 1 || details.gender === 3; // Female + Other
          } else {
            genderMatches = details.gender === 0 || details.gender === 2 || details.gender === 3; // Male + Other
          }
          
          if (genderMatches) {
            filteredCast.push({
              ...person,
              details: details,
              needsGenderCheck: false
            });
          }
        } catch (error) {
          console.error('Error filtering cast member by gender:', person.name, error);
          ErrorLogService.error('Error filtering cast member by gender:', person.name, error);
        // Note: ErrorLogService will be imported if needed for production logging
        }
      }
      
      return filteredCast;
    },
    getCategorySortKey(categoryKey) {
      // Map awards categories to Cinema Roll sort keys
      const categoryMappings = {
        'bestPicture': 'rating',
        'bestDirector': 'direction',
        'bestActor': 'performance',
        'bestActress': 'performance',
        'bestSupportingActor': 'performance',
        'bestSupportingActress': 'performance',
        'bestScreenplay': 'story',
        'bestCinematography': 'imagery',
        'bestEditing': 'direction',
        'bestScore': 'soundtrack',
        'bestVisualEffects': 'imagery',
        'bestAnimatedFeature': 'rating',
        'bestDocumentaryFeature': 'rating'
      };
      return categoryMappings[categoryKey] || 'rating';
    },
    async loadMoreForMovie(movieId) {
      const movieGroup = this.eligibleOptionsByMovie.find(group => group.movieId === movieId);
      if (!movieGroup || !movieGroup.hasMore || movieGroup.isLoading) return;
      
      movieGroup.isLoading = true;
      
      try {
        // Keep loading batches until we get 3 valid people (accounting for gender filtering)
        let newlyLoadedCast = [];
        const targetCount = 3;
        
        while (newlyLoadedCast.length < targetCount && movieGroup.processedIndex < movieGroup.allCast.length) {
          const batchSize = 3;
          const nextBatch = movieGroup.allCast.slice(movieGroup.processedIndex, movieGroup.processedIndex + batchSize);
          
          if (nextBatch.length === 0) break;
          
          const filteredBatch = await this.filterCastMembersByGender(nextBatch);
          newlyLoadedCast.push(...filteredBatch);
          movieGroup.processedIndex += batchSize;
        }
        
        // Add the new cast members (up to 3) to the loaded cast
        movieGroup.loadedCast.push(...newlyLoadedCast.slice(0, targetCount));
        movieGroup.hasMore = movieGroup.processedIndex < movieGroup.allCast.length;
      } catch (error) {
        console.error('Error loading more cast for movie:', movieId, error);
        ErrorLogService.error('Error loading more cast for movie:', movieId, error);
      } finally {
        movieGroup.isLoading = false;
      }
    },
    extractPeopleFromMovies(movies, categoryKey) {
      const people = [];
      
      movies.forEach(entry => {
        if (categoryKey === 'bestDirector') {
          const crew = entry.movie.crew || [];
          const directors = crew.filter(person => person.job === 'Director');
          
          if (directors.length > 0) {
            // Check if we already have an entry for this movie
            const existingEntry = people.find(p => p.movieId === entry.movie.id);
            
            if (!existingEntry) {
              // Create a single entry for the movie with all directors
              const directorNames = directors.map(d => d.name);
              people.push({
                id: `directors-${entry.movie.id}`,
                name: directorNames.join(' & '), // Combine director names
                directors: directors, // Store all director info
                movie: entry.movie,
                movieId: entry.movie.id
              });
            }
          }
        } else if (categoryKey.includes('Actor') || categoryKey.includes('Actress')) {
          const isActress = categoryKey.includes('Actress');
          const isSupporting = categoryKey.includes('Supporting');
          
          const cast = entry.movie.cast || [];
          
          // We'll need to make API calls to get proper gender and profile_path data
          // For now, store the cast members and we'll process them with API calls later
          cast.forEach((person, index) => {
            // Basic eligibility check by position first
            let eligible = false;
            if (isSupporting) {
              eligible = index < 10; // Top 8 for supporting
            } else {
              eligible = index < 5; // Top 4 for leads
            }
            
            if (eligible && !people.find(p => p.name === person.name && p.movieId === entry.movie.id)) {
              
              people.push({
                id: person.id || person.name, // Use name as fallback for grouping
                name: person.name,
                character: person.character,
                movie: entry.movie,
                movieId: entry.movie.id,
                castPosition: index,
                isActress: isActress, // Store which category this is for
                needsGenderCheck: true // Flag that we need to check gender via API
              });
            }
          });
        }
      });
      
      return people;
    },
    async getDetailsForCastMember(actorName) {
      // Check in-memory cache first
      if (this.personDetailsCache[actorName]) {
        return this.personDetailsCache[actorName];
      }
      
      // Check localStorage fallback (helpful for iOS PWAs with memory pressure)
      try {
        const cacheKey = `person_${actorName}_${this.currentYear}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsedData = JSON.parse(cached);
          const isExpired = Date.now() - parsedData.timestamp > (24 * 60 * 60 * 1000); // 24 hours
          if (!isExpired) {
            this.personDetailsCache[actorName] = parsedData.data;
            return parsedData.data;
          } else {
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (error) {
        console.warn('LocalStorage cache read failed:', error);
      }
      
      // Fetch from TMDb API
      const query = encodeURIComponent(actorName);
      const url = `https://api.themoviedb.org/3/search/person?api_key=${process.env.VUE_APP_TMDB_API_KEY}&query=${query}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch from TMDB');
        }
        const data = await response.json();
        const personDetails = data.results && data.results.length > 0 ? data.results[0] : null;
        
        // Cache the result in memory
        this.personDetailsCache[actorName] = personDetails;
        
        // Also cache in localStorage for persistence (especially helpful on iOS PWAs)
        try {
          const cacheKey = `person_${actorName}_${this.currentYear}`;
          const cacheData = {
            data: personDetails,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (error) {
          console.warn('LocalStorage cache write failed:', error);
        }
        
        return personDetails;
      } catch (error) {
        console.error('Error fetching TMDB person:', error);
        ErrorLogService.error('Error fetching TMDB person:', error);
        // Cache the null result to avoid retrying failed requests
        this.personDetailsCache[actorName] = null;
        
        // Also cache the failure in localStorage
        try {
          const cacheKey = `person_${actorName}_${this.currentYear}`;
          const cacheData = {
            data: null,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (localStorageError) {
          console.warn('LocalStorage cache write failed:', localStorageError);
        }
        
        return null;
      }
    },
    cleanupLocalStorageCache() {
      // Clean up old person cache entries from localStorage
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('person_')) {
            try {
              const cached = localStorage.getItem(key);
              if (cached) {
                const parsedData = JSON.parse(cached);
                const isExpired = Date.now() - parsedData.timestamp > (24 * 60 * 60 * 1000); // 24 hours
                if (isExpired) {
                  keysToRemove.push(key);
                }
              }
            } catch (parseError) {
              // Invalid entry, mark for removal
              keysToRemove.push(key);
            }
          }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (error) {
        console.warn('LocalStorage cleanup failed:', error);
      }
    },
    async filterPeopleByGender(people) {
      // Filter people by gender using TMDb API calls (same as FavoriteActors.vue)
      const filteredPeople = [];
      let count = 0;
      
      for (const person of people) {
        try {
          if (!person.needsGenderCheck) {
            filteredPeople.push(person);
            continue;
          }
          
          count++;
          const details = await this.getDetailsForCastMember(person.name);
          
          // If we can't determine gender, include the person (inclusive approach)
          if (!details || typeof details.gender !== 'number') {
            filteredPeople.push({
              ...person,
              details: details, // Include the full TMDb details
              needsGenderCheck: false
            });
            continue;
          }
          
          // Apply inclusive gender logic
          let genderMatches = false;
          if (person.isActress) {
            genderMatches = details.gender === 1 || details.gender === 3; // Female + Other for actress categories
          } else {
            genderMatches = details.gender === 2 || details.gender === 3; // Male + Other for actor categories
          }
          
          if (genderMatches) {
            filteredPeople.push({
              ...person,
              details: details, // Include the full TMDb details
              needsGenderCheck: false
            });
          }
        } catch (error) {
          console.error('Error filtering person by gender:', person.name, error);
          ErrorLogService.error('Error filtering person by gender:', person.name, error);
          // Continue with next person - don't let one API failure crash everything
        }
      }
      
      return filteredPeople;
    },
    getOptionId(option) {
      try {
        if (!option) return 'unknown';
        
        if (option.movie && !option.id) {
          // This is a movie option
          return `movie-${option.movie.id || 'unknown'}`;
        } else {
          // This is a person option
          return `person-${option.id || 'unknown'}-${option.movieId || 'unknown'}`;
        }
      } catch (error) {
        console.error('Error getting option ID:', option, error);
        ErrorLogService.error('Error getting option ID:', option, error);
        return 'error';
      }
    },
    getOptionTitle(option) {
      try {
        if (!option) return 'Unknown';
        
        // Special case for Best Director - extract director name from movie-grouped data structure
        if (this.selectedCategory === 'bestDirector') {
          // For Best Director, option might be a movie group with allCast containing director info
          if (option.allCast && option.allCast.length > 0) {
            return option.allCast[0].name || 'Unknown Director';
          }
          // Fallback: if it's already a director object with name
          if (option.name) {
            return option.name;
          }
          // Fallback: extract from movie crew
          if (option.movie && option.movie.crew) {
            const directors = option.movie.crew.filter(person => person.job === 'Director');
            if (directors.length > 0) {
              return directors.map(d => d.name).join(' & ');
            }
          }
          return 'Unknown Director';
        }
        
        if (option.movie && !option.id) {
          // This is a movie option
          return option.movie.title || 'Unknown Movie';
        } else {
          // This is a person option
          return option.name || 'Unknown Person';
        }
      } catch (error) {
        console.error('Error getting option title:', option, error);
        ErrorLogService.error('Error getting option title:', option, error);
        return 'Error';
      }
    },
    getOptionMovie(option) {
      if (option.movie && !option.id) {
        // This is a movie option, no separate movie line needed
        return null;
      } else {
        // This is a person option, show just the movie title
        return option.movie.title;
      }
    },
    getOptionRole(option) {
      if (option.movie && !option.id) {
        // This is a movie option, no role to show
        return null;
      } else {
        // This is a person option, show just the character/role
        return option.character || null;
      }
    },
    toggleNominee(option) {
      const categoryData = this.awardsData[this.selectedCategory] || { nominees: [], winner: null };
      
      if (this.isActingCategory(this.selectedCategory)) {
        // For acting categories, handle multi-role nominations
        this.toggleActorNomination(option, categoryData);
      } else {
        // For non-acting categories, use simple single nomination logic
        this.toggleSingleNomination(option, categoryData);
      }
      
      this.awardsData[this.selectedCategory] = categoryData;
    },
    
    toggleActorNomination(option, categoryData) {
      const actorId = option.id; // The person's TMDb ID
      
      
      // Find all roles for this actor in the current year
      const allActorRoles = this.getAllActorRolesInYear(actorId);
      
      
      // Check if any role for this actor is already nominated
      const hasAnyNomination = allActorRoles.some(role => 
        categoryData.nominees.some(nom => this.getOptionId(nom) === this.getOptionId(role))
      );
      
      if (hasAnyNomination) {
        // Remove all roles for this actor
        categoryData.nominees = categoryData.nominees.filter(nom => {
          const nomPersonId = nom.id;
          return nomPersonId !== actorId;
        });
        
        // If any of their roles was the winner, clear winner
        if (categoryData.winner && categoryData.winner.id === actorId) {
          categoryData.winner = null;
        }
      } else {
        // Add all roles for this actor
        const wasEmpty = categoryData.nominees.length === 0;
        
        allActorRoles.forEach(role => {
          categoryData.nominees.push(role);
        });
        
        // Clear the "no nominees" flag if it was set
        if (categoryData.noNominees) {
          categoryData.noNominees = false;
        }
        
        // If we just added nominees, scroll to the right to show them
        if (!wasEmpty) {
          this.$nextTick(() => {
            this.scrollNomineesToRight();
          });
        }
      }
    },
    
    toggleSingleNomination(option, categoryData) {
      const optionId = this.getOptionId(option);
      const existingIndex = categoryData.nominees.findIndex(nom => this.getOptionId(nom) === optionId);
      
      if (existingIndex >= 0) {
        // Remove nominee
        categoryData.nominees.splice(existingIndex, 1);
        // If this was the winner, clear winner
        if (categoryData.winner && this.getOptionId(categoryData.winner) === optionId) {
          categoryData.winner = null;
        }
      } else {
        // Add nominee
        const wasEmpty = categoryData.nominees.length === 0;
        categoryData.nominees.push(option);
        // Clear the "no nominees" flag if it was set
        if (categoryData.noNominees) {
          categoryData.noNominees = false;
        }
        
        // If we just added a nominee, scroll to the right to show it
        if (!wasEmpty) {
          this.$nextTick(() => {
            this.scrollNomineesToRight();
          });
        }
      }
    },
    
    getAllActorRolesInYear(actorId) {
      // Find all roles for this actor across all movies in the current year
      const allRoles = [];
      const seenRoles = new Set(); // Prevent duplicates
      
      if (this.isActingCategory(this.selectedCategory)) {
        // Search through the movie-grouped data
        this.eligibleOptionsByMovie.forEach(movieGroup => {
          // Check allCast (unloaded cast members) - this is where Steve Jobs cast likely is
          if (movieGroup.allCast) {
            movieGroup.allCast.forEach(person => {
              if (person.id === actorId) {
                const roleKey = `${person.movie.id}-${person.character || 'unknown'}`;
                if (!seenRoles.has(roleKey)) {
                  allRoles.push(person);
                  seenRoles.add(roleKey);
                }
              }
            });
          }
          // Check loadedCast (visible cast members) - this is where The Martian cast is
          if (movieGroup.loadedCast) {
            movieGroup.loadedCast.forEach(person => {
              if (person.id === actorId) {
                const roleKey = `${person.movie.id}-${person.character || 'unknown'}`;
                if (!seenRoles.has(roleKey)) {
                  allRoles.push(person);
                  seenRoles.add(roleKey);
                }
              }
            });
          }
        });
      }
      
      
      return allRoles;
    },
    scrollNomineesToRight() {
      // Find the nominees gallery and scroll to the right
      const gallery = document.querySelector('.current-nominees-gallery');
      if (gallery) {
        gallery.scrollTo({
          left: gallery.scrollWidth,
          behavior: 'smooth'
        });
      }
    },
    selectWinner(option) {
      const categoryData = this.awardsData[this.selectedCategory] || { nominees: [], winner: null };
      categoryData.winner = option;
      this.awardsData[this.selectedCategory] = categoryData;
      
      // Save removed - will save on Back/Complete/Close only
    },
    isNominee(option) {
      const categoryData = this.awardsData[this.selectedCategory];
      if (!categoryData || !categoryData.nominees) return false;
      
      if (this.isActingCategory(this.selectedCategory)) {
        // For acting categories, check if any role for this actor is nominated
        const actorId = option.id;
        return categoryData.nominees.some(nom => nom.id === actorId);
      } else {
        // For non-acting categories, check exact match
        const optionId = this.getOptionId(option);
        return categoryData.nominees.some(nom => this.getOptionId(nom) === optionId);
      }
    },
    isWinner(option) {
      const categoryData = this.awardsData[this.selectedCategory];
      if (!categoryData || !categoryData.winner) return false;
      
      if (this.isActingCategory(this.selectedCategory)) {
        // For acting categories, check if this actor is the winner (any role)
        const actorId = option.id;
        return categoryData.winner.id === actorId;
      } else {
        // For non-acting categories, check exact match
        return this.getOptionId(categoryData.winner) === this.getOptionId(option);
      }
    },
    getCurrentNominees() {
      const categoryData = this.awardsData[this.selectedCategory];
      if (!categoryData || !categoryData.nominees) return [];
      
      if (this.isActingCategory(this.selectedCategory)) {
        // For acting categories, group by actor and show combined roles
        return this.getGroupedActorNominees(categoryData.nominees);
      } else {
        // For non-acting categories, return nominees as-is
        return categoryData.nominees;
      }
    },
    
    getGroupedActorNominees(nominees) {
      // Group nominees by actor ID
      const groupedByActor = {};
      
      nominees.forEach(nominee => {
        const actorId = nominee.id;
        
        // Try to find profile image from grid data if nominee doesn't have one
        if (!nominee.details || !nominee.details.profile_path) {
          // Look for this actor in the visible grid to get their profile image
          const gridActor = this.findActorInGrid(nominee.name);
          if (gridActor && gridActor.details && gridActor.details.profile_path) {
            nominee.details = gridActor.details;
          }
        }
        
        if (!groupedByActor[actorId]) {
          // Use the nominee with the best profile image as the base
          groupedByActor[actorId] = {
            ...nominee, // Base data from first role
            allRoles: [] // Array to store all roles
          };
        } else {
          // If this nominee has a better profile image, use it as the base
          if (nominee.details && nominee.details.profile_path && 
              (!groupedByActor[actorId].details || !groupedByActor[actorId].details.profile_path)) {
            groupedByActor[actorId].details = nominee.details;
          }
        }
        groupedByActor[actorId].allRoles.push(nominee);
      });
      
      const result = Object.values(groupedByActor);
      
      
      return result;
    },
    
    getGroupedRolesByMovie(roles) {
      // Group roles by movie to avoid duplicate movie titles
      const movieGroups = {};
      
      roles.forEach(role => {
        const movieId = role.movie.id;
        if (!movieGroups[movieId]) {
          movieGroups[movieId] = {
            movieId: movieId,
            movieTitle: role.movie.title,
            characters: []
          };
        }
        if (role.character && !movieGroups[movieId].characters.includes(role.character)) {
          movieGroups[movieId].characters.push(role.character);
        }
      });
      
      return Object.values(movieGroups);
    },
    
    findActorInGrid(actorName) {
      // Search through all visible actors in the grid to find profile image data
      for (const movieGroup of this.eligibleOptionsByMovie) {
        // Check loadedCast (visible actors)
        if (movieGroup.loadedCast) {
          const foundActor = movieGroup.loadedCast.find(actor => actor.name === actorName);
          if (foundActor && foundActor.details && foundActor.details.profile_path) {
            return foundActor;
          }
        }
        // Also check allCast in case it has better data
        if (movieGroup.allCast) {
          const foundActor = movieGroup.allCast.find(actor => actor.name === actorName);
          if (foundActor && foundActor.details && foundActor.details.profile_path) {
            return foundActor;
          }
        }
      }
      return null;
    },
    getCategoryNomineeCount(categoryKey) {
      const categoryData = this.awardsData[categoryKey];
      if (!categoryData) return 0;
      if (categoryData.noNominees) return 0; // Show 0 for "no nominees" categories
      return (categoryData.nominees || []).length;
    },
    getCategoryWinner(categoryKey) {
      const categoryData = this.awardsData[categoryKey];
      if (!categoryData || !categoryData.winner) return null;
      
      // Return a shortened version of the winner name for display
      const winnerTitle = this.getOptionTitle(categoryData.winner);
      return winnerTitle.length > 20 ? winnerTitle.substring(0, 17) + '...' : winnerTitle;
    },
    isCategoryMarkedAsNoNominees(categoryKey) {
      const categoryData = this.awardsData[categoryKey];
      return categoryData && categoryData.noNominees === true;
    },
    hasNewMoviesForYear(year, existingAwards) {
      // Check if there are new movies for this year since last awards completion
      if (!existingAwards.lastUpdated || !existingAwards.availableMovieIds) {
        return true; // Legacy data or no previous awards data
      }
      
      const currentMovieIds = this.allEntriesWithFlatKeywordsAdded
        .filter(entry => {
          const entryYear = new Date(entry.movie.release_date).getFullYear();
          const notShort = !entry.movie.runtime || entry.movie.runtime > 40;
          return entryYear === year && notShort;
        })
        .map(entry => entry.movie.id);
      
      // Check if any current movie IDs are missing from the stored list
      return currentMovieIds.some(id => !existingAwards.availableMovieIds.includes(id));
    },
    getNewMoviesForYear(year, existingAwards) {
      // Get the list of movies that weren't available when awards were last completed
      if (!existingAwards.availableMovieIds) {
        return []; // No stored movie list, can't determine what's new
      }
      
      return this.allEntriesWithFlatKeywordsAdded.filter(entry => {
        const entryYear = new Date(entry.movie.release_date).getFullYear();
        const notShort = !entry.movie.runtime || entry.movie.runtime > 40;
        const isNewMovie = !existingAwards.availableMovieIds.includes(entry.movie.id);
        return entryYear === year && notShort && isNewMovie;
      });
    },
    sortOptionsByRelevantRating(options, categoryKey) {
      // Map awards categories to Cinema Roll sort keys (same as dropdown)
      const categoryMappings = {
        'bestPicture': 'rating', // Overall calculated total
        'bestDirector': 'direction',
        'bestActor': 'performance', 
        'bestActress': 'performance',
        'bestSupportingActor': 'performance',
        'bestSupportingActress': 'performance',
        'bestScreenplay': 'story',
        'bestCinematography': 'imagery',
        'bestEditing': 'direction', // Close to direction
        'bestScore': 'soundtrack',
        'bestVisualEffects': 'imagery',
        'bestAnimatedFeature': 'rating',
        'bestDocumentaryFeature': 'rating'
      };
      
      const sortCriteria = categoryMappings[categoryKey] || 'rating';
      
      // Convert person options to their corresponding movie entries for sorting
      const optionsWithMovieData = options.map(option => {
        if (option.movie && !option.movieId) {
          // This is already a movie entry
          return option;
        } else {
          // This is a person option - find the movie entry
          const movieEntry = this.allEntriesWithFlatKeywordsAdded.find(entry => entry.movie.id === option.movieId);
          // Return the movie entry but keep the original option data
          return { ...movieEntry, originalOption: option };
        }
      }).filter(entry => entry); // Remove any null entries
      
      // Sort using the exact same logic as the main app
      const sortedMovieData = optionsWithMovieData.sort((a, b) => {
        return this.sortResultsLikeMainApp(a, b, sortCriteria);
      });
      
      // Convert back to original options (person or movie)
      return sortedMovieData.map(entry => entry.originalOption || entry);
    },
    sortResultsLikeMainApp(a, b, sortKey) {
      // Exact copy of Home.vue's sortResults method
      const sortValueA = this.getSortValue(a, sortKey);
      const sortValueB = this.getSortValue(b, sortKey);

      if (sortValueA === sortValueB) {
        const secondarySortValueA = this.mostRecentRating(a).calculatedTotal;
        const secondarySortValueB = this.mostRecentRating(b).calculatedTotal;

        if (secondarySortValueA < secondarySortValueB) {
          return 1; // Always sort best on top for awards
        }
        if (secondarySortValueA > secondarySortValueB) {
          return -1; // Always sort best on top for awards
        }
        return 0;
      }

      if (sortValueA < sortValueB) {
        return 1; // Always sort best on top for awards
      }
      if (sortValueA > sortValueB) {
        return -1; // Always sort best on top for awards
      }

      return 0;
    },
    getSortValue(item, key) {
      // Exact copy of Home.vue's getSortValue method
      if (key === "rating") {
        return this.mostRecentRating(item).calculatedTotal;
      } else if (key === "release") {
        return new Date(item.movie.release_date);
      } else if (key === "title") {
        return item.movie.title;
      } else if (key === "watched") {
        const date = this.mostRecentRating(item).date || "3/22/1982";
        return new Date(date);
      } else if (key === "views") {
        return item.ratings.length;
      } else {
        const keyScore = parseInt(this.mostRecentRating(item)[key]);
        const keysToCompare = ["direction", "imagery", "impression", "love", "performance", "soundtrack", "stickiness", "story"];
        const isKeyScoreHighestScore = keysToCompare.some((keyToCompare) => {
          const keyToCompareScore = parseInt(this.mostRecentRating(item)[keyToCompare]);
          return keyToCompareScore >= keyScore;
        });
        return isKeyScoreHighestScore ? keyScore : 0;
      }
    },
    mostRecentRating(media) {
      try {
        // Use the same mostRecentRating logic as the main app
        return getRating(media) || { calculatedTotal: 0 };
      } catch (error) {
        console.error('Error getting most recent rating:', media, error);
        ErrorLogService.error('Error getting most recent rating:', media, error);
        return { calculatedTotal: 0 };
      }
    },
    convertNomineeToMinimal(nominee) {
      // Convert nominees to minimal storage format while preserving role data
      if (!nominee) return null;
      
      // Check if this is a person nominee (has name and movieId)
      if (nominee.name && nominee.movieId) {
        // This is a person (actor/actress/director)
        const minimal = {
          type: 'person',
          id: nominee.id,
          name: nominee.name,
          movieId: nominee.movieId
        };
        
        // Preserve role-specific data
        if (nominee.character) {
          minimal.character = nominee.character; // For actors/actresses
        }
        if (nominee.directors) {
          minimal.directors = nominee.directors; // For directors
        }
        if (nominee.details && nominee.details.profile_path) {
          minimal.profilePath = nominee.details.profile_path; // For display
        }
        
        return minimal;
      } 
      
      // Check if this is a movie nominee (has movie property)
      else if (nominee.movie) {
        // This is a movie entry
        return {
          type: 'movie',
          movieId: nominee.movie.id
          // No additional role data needed for movies
        };
      }
      
      // Fallback - unknown structure
      console.warn('🤔 Unknown nominee structure:', nominee);
      return nominee;
    },
    expandNomineeFromMinimal(minimalNominee) {
      // Convert minimal storage back to full nominee for display
      if (!minimalNominee) return null;
      
      // Handle legacy data - if it already has a movie object, it's not minimal
      if (minimalNominee.movie) {
        return minimalNominee; // Already expanded/legacy format
      }
      
      if (minimalNominee.type === 'person') {
        // Find the movie from our movie log
        const movieEntry = this.allEntriesWithFlatKeywordsAdded.find(entry => 
          entry.movie.id === minimalNominee.movieId
        );
        
        if (!movieEntry) {
          console.warn('⚠️ Could not find movie for person nominee:', minimalNominee);
          return null;
        }
        
        // Reconstruct person nominee
        const expanded = {
          id: minimalNominee.id,
          name: minimalNominee.name,
          movieId: minimalNominee.movieId,
          movie: movieEntry.movie // Add back the movie object for display
        };
        
        // Restore role-specific data
        if (minimalNominee.character) {
          expanded.character = minimalNominee.character;
        }
        if (minimalNominee.directors) {
          expanded.directors = minimalNominee.directors;
        }
        if (minimalNominee.profilePath) {
          expanded.details = { profile_path: minimalNominee.profilePath };
        }
        
        return expanded;
      } else if (minimalNominee.type === 'movie') {
        // Find the full movie entry
        const movieEntry = this.allEntriesWithFlatKeywordsAdded.find(entry => 
          entry.movie.id === minimalNominee.movieId
        );
        
        if (!movieEntry) {
          console.warn('⚠️ Could not find movie entry:', minimalNominee);
          return null;
        }
        
        return movieEntry; // Return the full entry for movie nominees
      }
      
      // Fallback for unknown types or legacy data
      return minimalNominee;
    },
    isActingCategory(categoryKey) {
      return categoryKey && (categoryKey.includes('Actor') || categoryKey.includes('Actress'));
    },
    shouldShowTextOverlay(categoryKey) {
      // Show text overlay for Best Director and all acting categories
      // Hide text overlay for all other categories (Best Picture, etc.)
      return categoryKey === 'bestDirector' || this.isActingCategory(categoryKey);
    },
  }
};
</script>

<style lang="scss">
.personal-awards {
  .awards-notice {
    text-align: center;

    .alert-link {
      cursor: pointer;
    }
  }

  .cinemaroll-modal-body {
    padding-top: 0 !important;
  }

  .awards-header {
    padding: 1rem 0;
    
    h2 {
      font-size: 1.5rem;
      font-weight: 700;
    }
    
    .new-movies-list {
      max-height: 150px;
      overflow-y: auto;
      
      .new-movie-item {
        border-bottom: 1px solid rgba(0,0,0,0.1);
        font-size: 0.9em;
        line-height: 1.4;
        padding: 2px 0;
        
        &:last-child {
          border-bottom: none;
        }
      }
    }
  }

  .awards-form {
    min-height: 500px;
    
    .category-grid {
      .category-buttons {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(2, 1fr);
        padding: 0 4px;
        
        @media (min-width: 576px) {
          gap: 10px;
          grid-template-columns: repeat(3, 1fr);
        }
        
        .category-btn {
          border-radius: 6px;
          border: 1px solid #6c757d;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-height: 60px;
          padding: 12px 8px;
          text-align: center;

          &.text-bg-dark {
            background: #343a40;
            border-color: #6c757d;
            color: #f8f9fa;
            
            &.completed {
              background-color: #1e4620;
              border-color: #28a745;
            }
            
            &.disabled {
              background: #2c3034;
              border-color: #495057;
              color: #6c757d;
              cursor: not-allowed;
              opacity: 0.4;
            }
          }
          
          .category-status {
            font-size: 1em;
          }
          
          .category-name {
            font-size: 0.75em;
            font-weight: 600;
            line-height: 1.1;
          }
          
          .category-meta {
            font-size: 0.6em;
            margin-top: 1px;
            opacity: 0.7;
          }
          
          .category-winner {
            font-size: 0.55em;
            font-weight: 500;
            line-height: 1.1;
            margin-top: 2px;
            opacity: 0.9;
          }
          
          .category-no-nominees {
            color: #6c757d;
            font-size: 0.55em;
            font-style: italic;
            font-weight: 500;
            line-height: 1.1;
            margin-top: 2px;
            opacity: 0.7;
          }
          
          // Checkmark positioning
          position: relative;
          
          .category-status {
            font-size: 0.8em;
            position: absolute;
            right: 6px;
            top: 6px;
            
            .green-checkmark {
              align-items: center;
              background-color: #28a745;
              border-radius: 50%;
              color: white;
              display: flex;
              font-size: 0.7em;
              height: 14px;
              justify-content: center;
              width: 14px;
            }
          }
        }
      }
    }
    
    .category-detail {
      display: flex;
      flex-direction: column;
      
      .section-title {
        font-size: 0.85em;
        font-weight: 600;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
        text-transform: uppercase;
        
        .instruction-text {
          font-size: 0.75em;
          font-style: italic;
          font-weight: 400;
          letter-spacing: normal;
          opacity: 0.8;
          text-transform: none;
        }
      }
      
      .nominees-grid {
        display: grid;
        gap: 6px;
        grid-template-columns: repeat(3, 1fr);
        margin-bottom: 16px;
        
        @media (min-width: 576px) {
          gap: 8px;
        }
        
        .nominee-tile {
          aspect-ratio: 2/3;
          border-radius: 6px;
          cursor: pointer;
          overflow: hidden;
          position: relative;
          transition: border-color 0.1s, box-shadow 0.1s;
          will-change: border-color, box-shadow;

          &.text-bg-dark {
            border: 2px solid #6c757d;
            
            
            
            &.winner {
              border-color: #28a745;
              box-shadow: 0 0 0 2px rgba(40,167,69,0.4);
            }
          }
          
          .nominee-image {
            height: 100%;
            left: 0;
            position: absolute;
            top: 0;
            width: 100%;
            
            img {
              height: 100%;
              object-fit: cover;
              width: 100%;
            }
          }
          
          .nominee-status-overlay {
            position: absolute;
            right: 4px;
            top: 4px;
            z-index: 2;
            
            .status-icon {
              background: rgba(0,0,0,0.7);
              border-radius: 4px;
              color: white;
              font-size: 0.9em;
              padding: 2px 4px;
              
              &.winner {
                background: rgba(40,167,69,0.9);
              }
              
              &.nominee {
                background: #28a745; // Green circle background
                color: white; // White checkmark
                border-radius: 50%; // Make it circular
                width: 20px; // Fixed width for circle
                height: 20px; // Fixed height for circle
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.8em; // Smaller checkmark to fit in circle
                font-weight: bold;
              }
            }
          }
          
          .nominee-info-overlay {
            background: linear-gradient(transparent, rgba(0,0,0,0.8));
            bottom: 0;
            color: white;
            left: 0;
            padding: 8px 6px 6px;
            position: absolute;
            right: 0;
            
            .nominee-title {
              font-size: 0.75em;
              font-weight: 600;
              line-height: 1.2;
              margin-bottom: 1px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              
              &.allow-wrap {
                white-space: normal;
                text-overflow: unset;
                overflow: visible;
              }
            }
            
            .nominee-subtitle {
              font-size: 0.65em;
              opacity: 0.9;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            
            .nominee-movie {
              font-size: 0.65em;
              opacity: 0.9;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              margin-bottom: 1px;
            }
            
            .nominee-role {
              font-size: 0.6em;
              opacity: 0.8;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              font-style: italic;
            }
          }
        }
      }
      
      .sticky-top-section {
        background: #000000;
        border-bottom: 1px solid #333;
        margin: -12px -16px 0;
        padding: 12px 16px 8px;
        position: sticky;
        top: 0;
        z-index: 10;
        
        .category-header h5 {
          color: white;
        }
        
        .section-title {
          color: white;
        }
      }
      
      .current-nominees-section {
        margin-bottom: 8px;
        
        .current-nominees-gallery {
          align-content: flex-start;
          align-items: flex-start;
          display: flex;
          flex-wrap: nowrap; // No wrapping for horizontal scroll
          gap: 4px;
          justify-content: flex-start;
          overflow-x: auto;
          overflow-y: visible;
          padding: 8px 4px;
          position: relative;
          
          .no-nominees-placeholder {
            align-items: center;
            color: #999;
            display: flex;
            flex-direction: column; // Stack vertically
            font-size: 0.8em;
            font-style: italic;
            gap: 8px; // Space between button and text
            height: 98.5px; // Match poster height to prevent jumping
            justify-content: center;
            width: 100%;
            
            .no-nominees-btn {
              border-radius: 6px;
              font-size: 0.8em;
              padding: 6px 12px;
              transition: background-color 0.1s;
              
              i {
                margin-right: 6px;
              }
            }
          }
          
          .current-nominee-poster {
            cursor: pointer;
            flex-grow: 0;
            flex-shrink: 0;
            transition: opacity 0.1s;
            width: 62px;
            
            &.winner {
              .nominee-poster-image {
                border: 2px solid #ffd700;
                box-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
              }
            }
            
            .nominee-poster-image {
              aspect-ratio: 3/4; // Maintain poster ratio
              border-radius: 4px;
              border: 2px solid #333;
              min-width: 40px;
              overflow: hidden;
              position: relative;
              width: 100%;
              
              img {
                height: 100%;
                object-fit: cover;
                width: 100%;
              }
              
              .winner-overlay {
                align-items: center;
                background: rgba(0,0,0,0.8);
                border-radius: 50%;
                display: flex;
                height: 18px;
                justify-content: center;
                position: absolute;
                right: 2px;
                top: 2px;
                width: 18px;
                
                .winner-crown {
                  font-size: 0.7em;
                }
              }
              
              .remove-nominee-btn {
                align-items: center;
                background: rgba(0,0,0,0.8);
                border-radius: 50%;
                border: none;
                color: white;
                cursor: pointer;
                display: flex;
                font-size: 0.7em; // Slightly smaller for better fit
                height: 18px;
                justify-content: center;
                left: 2px;
                line-height: 1;
                opacity: 0.8;
                position: absolute;
                top: 2px;
                width: 18px;
                
                i {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
              }
            }
            
            .nominee-poster-name {
              color: white;
              font-size: 0.6em;
              font-weight: 500;
              line-height: 1.2;
              margin-top: 4px;
              text-align: center;
              
              .actor-name {
                font-weight: 600;
                margin-bottom: 2px;
              }
              
              .all-roles {
                font-size: 0.9em;
                opacity: 0.8;
                margin-top: 2px;
                
                .role-entry {
                  margin-bottom: 1px;
                  
                  .role-movie {
                    font-size: 0.85em;
                    font-weight: 500;
                  }
                  
                  .role-character {
                    font-size: 0.8em;
                    font-style: italic;
                    opacity: 0.9;
                  }
                }
              }
            }
          }
        }
      }
      
      .available-options-section {
        display: flex;
        flex-direction: column;
        flex: 1;
        padding-top: 24px;
        
        .nominees-grid {
          flex: 1;
          overflow-y: auto;
          
          .loading-container {
            align-items: center;
            display: flex;
            flex-direction: column;
            grid-column: 1 / -1; // Span all grid columns
            height: 200px;
            justify-content: center;
            text-align: center;
            
            .spinner-border {
              margin: 0 auto;
            }
            
            p {
              color: #6c757d;
              font-size: 0.9em;
              margin-top: 8px;
            }
          }
        }
        
        .movie-groups {
          display: flex;
          flex-direction: column;
          gap: 24px;
          
          .movie-group {
            .movie-group-header {
              align-items: baseline;
              display: flex;
              gap: 8px;
              margin-bottom: 12px;
              
              .movie-title {
                color: #f8f9fa;
                font-size: 0.9em;
                font-weight: 600;
                margin: 0;
              }
              
              .movie-year {
                color: #adb5bd;
                font-size: 0.8em;
                font-weight: 400;
              }
            }
            
            .nominees-grid {
              display: grid;
              gap: 6px;
              grid-template-columns: repeat(3, 1fr);
              margin-bottom: 12px;
              
              @media (min-width: 576px) {
                gap: 8px;
              }
            }
            
            .load-more-section {
              text-align: center;
              
              .load-more-btn {
                border-color: #6c757d;
                color: #f8f9fa;
                font-size: 0.8em;
                padding: 4px 12px;
                transition: background-color 0.1s, transform 0.1s;
                
                &:hover {
                  background-color: rgba(255, 255, 255, 0.1);
                  border-color: #adb5bd;
                }
                
                &:active {
                  background-color: rgba(255, 255, 255, 0.2);
                  transform: scale(0.98);
                }
                
                &:disabled {
                  opacity: 0.6;
                  cursor: not-allowed;
                }
                
                i {
                  font-size: 0.9em;
                }
              }
            }
          }
        }
        
        .loading-container {
          align-items: center;
          display: flex;
          flex-direction: column;
          height: 200px;
          justify-content: center;
          text-align: center;
          
          .spinner-border {
            margin: 0 auto;
          }
          
          p {
            color: #6c757d;
            font-size: 0.9em;
            margin-top: 8px;
          }
        }
      }
    }
  }
}

// Make modal wider on larger screens
@media (min-width: 768px) {
  :deep(.cinemaroll-modal-content) {
    max-height: 85vh !important;
    max-width: 650px !important;
  }
  
  .awards-form {
    .category-grid,
    .category-detail {
      height: calc(85vh - 200px);
      max-height: 600px;
    }
  }
}

@media (min-width: 992px) {
  :deep(.cinemaroll-modal-content) {
    max-width: 750px !important;
  }
}

.awards-modal-footer {
  .saved-message {
    font-size: 0.9em;
    font-weight: 600;
  }
  
  .auto-save-note {
    font-size: 0.8em;
  }
  
  .completion-section {
    .btn {
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.1s, box-shadow 0.1s;
      
      // Mobile touch feedback
      -webkit-tap-highlight-color: rgba(40, 167, 69, 0.3);
      touch-action: manipulation;
      
      &:active {
        transform: scale(0.98);
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
      }
      
      // Enhanced mobile touch states
      @media (hover: none) and (pointer: coarse) {
        &:active {
          transform: scale(0.95);
          box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
      }
      
      i {
        color: #ffd700;
      }
    }
  }
  
  .progress-section {
    font-size: 0.8em;
    text-align: right;
    color: #f8f9fa; // Ensure text is visible on dark backgrounds
  }
}

// Black background for all themes on sticky section
.sticky-top-section {
  .btn-outline-secondary {
    border-color: #6c757d;
    color: #f8f9fa;
    transition: background-color 0.1s, transform 0.1s;
    
    // Mobile touch feedback
    -webkit-tap-highlight-color: rgba(255, 255, 255, 0.3);
    touch-action: manipulation;
    
    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
      border-color: #adb5bd;
    }
    
    &:active {
      background-color: rgba(255, 255, 255, 0.2);
      transform: scale(0.98);
    }
    
    // Enhanced mobile touch states
    @media (hover: none) and (pointer: coarse) {
      &:active {
        background-color: rgba(255, 255, 255, 0.3);
        transform: scale(0.95);
      }
    }
  }
}
</style>
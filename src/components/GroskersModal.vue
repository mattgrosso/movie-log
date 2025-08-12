<template>
  <div v-if="yearsEligibleForGroskers.length && showGroskersModal" class="groskers">
    <div class="groskers-notice alert alert-warning my-2" role="alert" @click="openModal">
      You have {{ yearsEligibleForGroskers.length }} year{{ yearsEligibleForGroskers.length === 1 ? '' : 's' }} ready for Groskers!<br/>
      <a class="alert-link" @click.stop="openModal">Click to award your personal Oscars.</a>
    </div>
    <Modal :show="showModal" @close="closeModal">
      <template v-slot:header>
        <div class="text-center groskers-header">
          <h2 class="mb-1">The {{ currentYear }} Groskers</h2>
          <p class="mb-0">Your personal Academy Awards</p>
        </div>
      </template>
      <template v-slot:body>
        <div class="groskers-form">
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
                  darkOrLight
                ]"
                :disabled="category.disabled"
                @click="category.disabled ? null : selectCategory(category.key)"
                :title="category.disabledReason || ''"
              >
                <span class="category-status" v-if="category.completed">✅</span>
                <span class="category-name">{{ category.name }}</span>
                <span class="category-meta" v-if="!category.disabled">
                  {{ getCategoryNomineeCount(category.key) }} nominees
                </span>
                <span class="category-winner" v-if="getCategoryWinner(category.key)">
                  👑 {{ getCategoryWinner(category.key) }}
                </span>
              </button>
            </div>
          </div>

          <!-- Category Detail View -->
          <div v-if="selectedCategory" class="category-detail">
            <!-- Sticky Top Section -->
            <div class="sticky-top-section">
              <div class="category-header d-flex justify-content-between align-items-center mb-3">
                <button class="btn btn-sm btn-outline-secondary" @click="selectedCategory = null">
                  ← Back
                </button>
                <h5 class="mb-0 text-center flex-grow-1">{{ getCurrentCategoryName() }}</h5>
              </div>
              
              <!-- Current Nominees - Always visible -->
              <div class="current-nominees-section">
                <h6 class="section-title">Current Nominees:</h6>
                <div class="current-nominees-gallery" :class="{'two-row-layout': getCurrentNominees().length >= 6}">
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
                        ×
                      </button>
                    </div>
                    
                    <!-- Name below -->
                    <div class="nominee-poster-name">
                      {{ getOptionTitle(nominee).length > 12 ? getOptionTitle(nominee).substring(0, 9) + '...' : getOptionTitle(nominee) }}
                    </div>
                  </div>
                  
                  <!-- Placeholder when no nominees -->
                  <div v-if="getCurrentNominees().length === 0" class="no-nominees-placeholder">
                    Click options below to nominate
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Available Options Section -->
            <div class="available-options-section">
              <h6 class="section-title">Available Options:</h6>
              <div class="nominees-grid">
                <div v-if="loadingOptions" class="loading-container">
                  <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                  <p class="mt-2">Loading nominees...</p>
                </div>
                <div 
                  v-else
                  v-for="option in eligibleOptions" 
                  :key="getOptionId(option)"
                  class="nominee-tile"
                  :class="[{'selected': isNominee(option), 'winner': isWinner(option)}, darkOrLight]"
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
                      :src="`https://image.tmdb.org/t/p/w185${option.movie.poster_path}`" 
                      :alt="getOptionTitle(option)"
                    >
                    
                    <!-- Status overlay -->
                    <div class="nominee-status-overlay">
                      <span v-if="isWinner(option)" class="status-icon winner">👑</span>
                      <span v-else-if="isNominee(option)" class="status-icon nominee">✓</span>
                    </div>
                  </div>
                  
                  <!-- Text overlay -->
                  <div class="nominee-info-overlay">
                    <div class="nominee-title">{{ getOptionTitle(option) }}</div>
                    <div class="nominee-subtitle" v-if="getOptionSubtitle(option)">
                      {{ getOptionSubtitle(option) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template v-slot:footer>
        <div class="groskers-modal-footer d-flex justify-content-center w-100">
          <div v-if="showSavedMessage" class="saved-message text-success">
            ✓ Saved!
          </div>
          <div v-else class="auto-save-note text-muted small">
            Changes saved automatically
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal.vue';
import { getRating } from '../assets/javascript/GetRating.js';

export default {
  name: "GroskersModal",
  props: {
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    },
    showGroskersModal: {
      type: Boolean,
      required: true
    }
  },
  components: {
    Modal
  },
  data() {
    return {
      showModal: false,
      submitting: false,
      selectedCategory: null,
      currentYear: null,
      groskersData: {},
      autoSaveTimeout: null,
      eligibleOptions: [],
      loadingOptions: false,
      showSavedMessage: false,
      savedTimeout: null
    };
  },
  computed: {
    yearsEligibleForGroskers() {
      const yearCounts = {};
      
      this.allEntriesWithFlatKeywordsAdded.forEach(entry => {
        // Exclude shorts (<40min) from Groskers consideration
        if (entry.movie.runtime && entry.movie.runtime <= 40) {
          return;
        }
        
        const year = new Date(entry.movie.release_date).getFullYear();
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      });

      const eligibleYears = Object.keys(yearCounts)
        .filter(year => yearCounts[year] >= 10)
        .map(year => parseInt(year))
        .sort((a, b) => b - a); // Most recent first

      // Filter out years that are already completed (optional - since this is a "living record")
      return eligibleYears.filter(year => {
        const existingGroskers = this.$store.state.settings.groskers?.[year];
        return !existingGroskers?.completed || this.hasNewMoviesForYear(year, existingGroskers);
      });
    },
    categories() {
      return [
        { key: 'bestPicture', name: 'Best Picture', type: 'movie' },
        { key: 'bestDirector', name: 'Best Director', type: 'person' },
        { key: 'bestActor', name: 'Best Actor', type: 'person' },
        { key: 'bestActress', name: 'Best Actress', type: 'person' },
        { key: 'bestSupportingActor', name: 'Best Supporting Actor', type: 'person' },
        { key: 'bestSupportingActress', name: 'Best Supporting Actress', type: 'person' },
        { key: 'bestScreenplay', name: 'Best Screenplay', type: 'movie' },
        { key: 'bestCinematography', name: 'Best Cinematography', type: 'movie' },
        { key: 'bestEditing', name: 'Best Editing', type: 'movie' },
        { key: 'bestScore', name: 'Best Score', type: 'movie' },
        { key: 'bestVisualEffects', name: 'Best Visual Effects', type: 'movie' },
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
    progressPercentage() {
      return (this.completedCategories / this.totalCategories) * 100;
    },
    darkOrLight() {
      const inDarkMode = document.querySelector("body").classList.contains('bg-dark');
      return { 'text-bg-dark': inDarkMode, 'text-bg-light': !inDarkMode };
    }
  },
  methods: {
    openModal() {
      this.showModal = true;
      this.currentYear = this.yearsEligibleForGroskers[0]; // Start with most recent eligible year
      this.initializeGroskersData();
    },
    closeModal() {
      this.showModal = false;
      this.selectedCategory = null;
      this.groskersData = {};
    },
    initializeGroskersData() {
      // Load existing Groskers data for this year if it exists
      const existingGroskers = this.$store.state.settings.groskers?.[this.currentYear];
      if (existingGroskers) {
        this.groskersData = { ...existingGroskers.categories };
      } else {
        this.groskersData = {};
      }
    },
    async selectCategory(categoryKey) {
      this.selectedCategory = categoryKey;
      this.loadingOptions = true;
      this.eligibleOptions = await this.getEligibleOptions();
      this.loadingOptions = false;
    },
    getCategoryButtonClass(category) {
      const baseClass = this.selectedCategory === category.key ? 'btn-primary' : 'btn-outline-secondary';
      return baseClass;
    },
    getCurrentCategoryName() {
      const category = this.categories.find(cat => cat.key === this.selectedCategory);
      return category ? category.name : '';
    },
    isCategoryCompleted(categoryKey) {
      const categoryData = this.groskersData[categoryKey];
      return categoryData && categoryData.nominees?.length > 0 && categoryData.winner;
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
      return this.allEntriesWithFlatKeywordsAdded.filter(entry => {
        const yearMatch = new Date(entry.movie.release_date).getFullYear() === this.currentYear;
        const notShort = !entry.movie.runtime || entry.movie.runtime > 40; // Exclude shorts
        return yearMatch && notShort;
      });
    },
    async getEligibleOptions() {
      const category = this.categories.find(cat => cat.key === this.selectedCategory);
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
      return this.sortOptionsByRelevantRating(options, this.selectedCategory);
    },
    extractPeopleFromMovies(movies, categoryKey) {
      const people = [];
      
      movies.forEach(entry => {
        if (categoryKey === 'bestDirector') {
          const crew = entry.movie.crew || [];
          crew.filter(person => person.job === 'Director').forEach(director => {
            if (!people.find(p => p.name === director.name && p.movieId === entry.movie.id)) {
              people.push({
                id: director.id || `${director.name}-${entry.movie.id}`,
                name: director.name,
                movie: entry.movie,
                movieId: entry.movie.id
              });
            }
          });
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
              eligible = index < 8; // Top 8 for supporting
            } else {
              eligible = index < 4; // Top 4 for leads
            }
            
            if (eligible && !people.find(p => p.name === person.name && p.movieId === entry.movie.id)) {
              people.push({
                id: person.id || `${person.name}-${entry.movie.id}`,
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
      // Exact same method as FavoriteActors.vue
      const query = encodeURIComponent(actorName);
      const url = `https://api.themoviedb.org/3/search/person?api_key=${process.env.VUE_APP_TMDB_API_KEY}&query=${query}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch from TMDB');
        }
        const data = await response.json();
        return data.results && data.results.length > 0 ? data.results[0] : null;
      } catch (error) {
        console.error('Error fetching TMDB person:', error);
        return null;
      }
    },
    async filterPeopleByGender(people) {
      // Filter people by gender using TMDb API calls (same as FavoriteActors.vue)
      const filteredPeople = [];
      
      for (const person of people) {
        if (!person.needsGenderCheck) {
          filteredPeople.push(person);
          continue;
        }
        
        const details = await this.getDetailsForCastMember(person.name);
        if (!details || typeof details.gender !== 'number') continue;
        
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
      }
      
      return filteredPeople;
    },
    getOptionId(option) {
      if (option.movie && !option.id) {
        // This is a movie option
        return `movie-${option.movie.id}`;
      } else {
        // This is a person option
        return `person-${option.id}-${option.movieId}`;
      }
    },
    getOptionTitle(option) {
      if (option.movie && !option.id) {
        // This is a movie option
        return option.movie.title;
      } else {
        // This is a person option
        return option.name;
      }
    },
    getOptionSubtitle(option) {
      if (option.movie && !option.id) {
        // This is a movie option, show director or other info
        const director = option.movie.credits?.crew?.find(person => person.job === 'Director');
        return director ? `Directed by ${director.name}` : '';
      } else {
        // This is a person option, show movie and character if applicable
        return `${option.movie.title}${option.character ? ` (${option.character})` : ''}`;
      }
    },
    toggleNominee(option) {
      const categoryData = this.groskersData[this.selectedCategory] || { nominees: [], winner: null };
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
        categoryData.nominees.push(option);
      }
      
      this.groskersData[this.selectedCategory] = categoryData;
      
      // Auto-save
      this.autoSave();
    },
    selectWinner(option) {
      const categoryData = this.groskersData[this.selectedCategory] || { nominees: [], winner: null };
      categoryData.winner = option;
      this.groskersData[this.selectedCategory] = categoryData;
      
      // Auto-save
      this.autoSave();
    },
    isNominee(option) {
      const categoryData = this.groskersData[this.selectedCategory];
      if (!categoryData || !categoryData.nominees) return false;
      
      const optionId = this.getOptionId(option);
      return categoryData.nominees.some(nom => this.getOptionId(nom) === optionId);
    },
    isWinner(option) {
      const categoryData = this.groskersData[this.selectedCategory];
      if (!categoryData || !categoryData.winner) return false;
      
      return this.getOptionId(categoryData.winner) === this.getOptionId(option);
    },
    getCurrentNominees() {
      const categoryData = this.groskersData[this.selectedCategory];
      return categoryData ? categoryData.nominees || [] : [];
    },
    getCategoryNomineeCount(categoryKey) {
      const categoryData = this.groskersData[categoryKey];
      return categoryData ? (categoryData.nominees || []).length : 0;
    },
    getCategoryWinner(categoryKey) {
      const categoryData = this.groskersData[categoryKey];
      if (!categoryData || !categoryData.winner) return null;
      
      // Return a shortened version of the winner name for display
      const winnerTitle = this.getOptionTitle(categoryData.winner);
      return winnerTitle.length > 20 ? winnerTitle.substring(0, 17) + '...' : winnerTitle;
    },
    hasNewMoviesForYear(year, existingGroskers) {
      // Check if there are new movies for this year since last Groskers update
      if (!existingGroskers.lastUpdated) return true;
      
      const newMovies = this.getMoviesForYear().filter(entry => {
        const movieDate = new Date(entry.ratings[0]?.date || entry.movie.release_date);
        return movieDate.getTime() > existingGroskers.lastUpdated;
      });
      
      return newMovies.length > 0;
    },
    sortOptionsByRelevantRating(options, categoryKey) {
      // Map Groskers categories to Cinema Roll sort keys (same as dropdown)
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
          return 1; // Always sort best on top for Groskers
        }
        if (secondarySortValueA > secondarySortValueB) {
          return -1; // Always sort best on top for Groskers
        }
        return 0;
      }

      if (sortValueA < sortValueB) {
        return 1; // Always sort best on top for Groskers
      }
      if (sortValueA > sortValueB) {
        return -1; // Always sort best on top for Groskers
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
      // Use the same mostRecentRating logic as the main app
      return getRating(media);
    },
    isActingCategory(categoryKey) {
      return categoryKey && (categoryKey.includes('Actor') || categoryKey.includes('Actress'));
    },
    async autoSave() {
      // Debounced auto-save to prevent too many Firebase writes
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = setTimeout(async () => {
        const groskersEntry = {
          completed: this.completedCategories === this.totalCategories,
          lastUpdated: Date.now(),
          categories: this.groskersData
        };
        
        const dbEntry = {
          path: `settings/groskers/${this.currentYear}`,
          value: groskersEntry
        };
        
        try {
          await this.$store.dispatch('setDBValue', dbEntry);
          
          // Show saved message briefly
          this.showSavedMessage = true;
          clearTimeout(this.savedTimeout);
          this.savedTimeout = setTimeout(() => {
            this.showSavedMessage = false;
          }, 800); // Show for 0.8 seconds
          
        } catch (error) {
          console.error('Auto-save error:', error);
        }
      }, 1000); // 1 second debounce
    }
  }
};
</script>

<style lang="scss">
.groskers {
  .alert-link {
    cursor: pointer;
  }

  .cinemaroll-modal-body {
    padding-top: 0 !important;
  }

  .groskers-header {
  padding: 1rem 0;
  
  h2 {
    font-size: 1.5rem;
    font-weight: 700;
  }
}

.groskers-form {
  min-height: 500px;
  
  .category-grid {
    height: calc(100vh - 250px);
    max-height: 500px;
    overflow-y: auto;
    
    .category-buttons {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      padding: 0 4px;
      
      @media (min-width: 576px) {
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }
      
      .category-btn {
        border: 1px solid #6c757d;
        border-radius: 6px;
        padding: 8px 6px;
        text-align: center;
        cursor: pointer;
        transition: border-color 0.2s, background-color 0.2s;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-height: 50px;
        
        // Light theme
        &.text-bg-light {
          background: white;
          color: #212529;
          border-color: #dee2e6;
          
          &:hover:not(.disabled) {
            border-color: #007bff;
            background-color: #f8f9fa;
          }
          
          &.completed {
            border-color: #28a745;
            background-color: #f8fff8;
          }
        }
        
        // Dark theme
        &.text-bg-dark {
          background: #343a40;
          color: #f8f9fa;
          border-color: #6c757d;
          
          &:hover:not(.disabled) {
            border-color: #007bff;
            background-color: #495057;
          }
          
          &.completed {
            border-color: #28a745;
            background-color: #1e4620;
          }
          
          &.disabled {
            background: #2c3034;
            border-color: #495057;
            color: #6c757d;
            cursor: not-allowed;
            opacity: 0.4;
          }
        }
        
        // Light theme disabled state
        &.text-bg-light.disabled {
          background: #f8f9fa;
          border-color: #dee2e6;
          color: #6c757d;
          cursor: not-allowed;
          opacity: 0.4;
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
          opacity: 0.7;
          margin-top: 1px;
        }
        
        .category-winner {
          font-size: 0.55em;
          font-weight: 500;
          margin-top: 2px;
          line-height: 1.1;
          opacity: 0.9;
        }
        
        // Checkmark positioning
        position: relative;
        
        .category-status {
          position: absolute;
          top: 2px;
          right: 2px;
          font-size: 0.8em;
        }
      }
    }
  }
  
  .category-detail {
    display: flex;
    flex-direction: column;
    
    .section-title {
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .nominees-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 16px;
      
      @media (min-width: 576px) {
        gap: 8px;
      }
      
      .nominee-tile {
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        overflow: hidden;
        aspect-ratio: 2/3;
        
        // Light theme
        &.text-bg-light {
          border: 2px solid #dee2e6;
          
          &:hover {
            border-color: #007bff;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          
          &.selected {
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
          }
          
          &.winner {
            border-color: #28a745;
            box-shadow: 0 0 0 2px rgba(40,167,69,0.25);
          }
        }
        
        // Dark theme
        &.text-bg-dark {
          border: 2px solid #6c757d;
          
          &:hover {
            border-color: #007bff;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          }
          
          &.selected {
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0,123,255,0.4);
          }
          
          &.winner {
            border-color: #28a745;
            box-shadow: 0 0 0 2px rgba(40,167,69,0.4);
          }
        }
        
        .nominee-image {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          
          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }
        
        .nominee-status-overlay {
          position: absolute;
          top: 4px;
          right: 4px;
          z-index: 2;
          
          .status-icon {
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 2px 4px;
            border-radius: 4px;
            font-size: 0.9em;
            
            &.winner {
              background: rgba(40,167,69,0.9);
            }
            
            &.nominee {
              background: rgba(0,123,255,0.9);
            }
          }
        }
        
        .nominee-info-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(transparent, rgba(0,0,0,0.8));
          color: white;
          padding: 8px 6px 6px;
          
          .nominee-title {
            font-weight: 600;
            font-size: 0.75em;
            line-height: 1.2;
            margin-bottom: 1px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          .nominee-subtitle {
            font-size: 0.65em;
            opacity: 0.9;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }
    }
    
    .sticky-top-section {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #000000;
      padding: 12px 16px 8px;
      margin: -12px -16px 0;
      border-bottom: 1px solid #333;
      
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
        display: flex;
        justify-content: center;
        gap: 4px;
        padding: 8px 4px;
        align-items: flex-start;
        flex-wrap: wrap; // Allow wrapping for 2 rows
        overflow: visible;
        position: relative;
        align-content: flex-start;
        
        .no-nominees-placeholder {
          color: #999;
          font-size: 0.8em;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          font-style: italic;
        }
        
        .current-nominee-poster {
          cursor: pointer;
          transition: transform 0.2s;
          flex-shrink: 0;
          flex-grow: 0;
          min-width: 45px;
          max-width: 60px;
          width: 60px; // Default: 1-5 nominees single row
          
          &:hover {
            transform: scale(1.05);
          }
          
          &.winner {
            .nominee-poster-image {
              border: 2px solid #ffd700;
              box-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
            }
          }
          
          .nominee-poster-image {
            position: relative;
            width: 100%;
            border-radius: 4px;
            overflow: hidden;
            border: 2px solid #333;
            aspect-ratio: 3/4; // Maintain poster ratio
            min-width: 40px;
            
            img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            
            .winner-overlay {
              position: absolute;
              top: 2px;
              right: 2px;
              background: rgba(0,0,0,0.8);
              border-radius: 50%;
              width: 18px;
              height: 18px;
              display: flex;
              align-items: center;
              justify-content: center;
              
              .winner-crown {
                font-size: 0.7em;
              }
            }
            
            .remove-nominee-btn {
              position: absolute;
              top: 2px;
              left: 2px;
              background: rgba(0,0,0,0.8);
              color: white;
              border: none;
              border-radius: 50%;
              width: 18px;
              height: 18px;
              font-size: 0.9em;
              line-height: 1;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              opacity: 0.8;
              
              &:hover {
                opacity: 1;
                background: rgba(255,0,0,0.8);
              }
            }
          }
          
          .nominee-poster-name {
            color: white;
            font-size: 0.6em;
            text-align: center;
            margin-top: 4px;
            line-height: 1.2;
            font-weight: 500;
          }
        }
        
        // 6+ nominees: two rows, smaller size
        &.two-row-layout {
          .current-nominee-poster {
            width: 50px;
            
            @media (max-width: 575px) {
              width: 45px; // Smaller on mobile
            }
          }
        }
      }
    }
    
    .available-options-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding-top: 24px;
      
      .nominees-grid {
        flex: 1;
        overflow-y: auto;
        
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          text-align: center;
        }
      }
    }
  }
}

// Make modal wider on larger screens
@media (min-width: 768px) {
  :deep(.cinemaroll-modal-content) {
    max-width: 650px !important;
    max-height: 85vh !important;
  }
  
  .groskers-form {
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

.groskers-modal-footer {
  .saved-message {
    font-weight: 600;
    font-size: 0.9em;
  }
  
  .auto-save-note {
    font-size: 0.8em;
  }
}

// Black background for all themes on sticky section
.sticky-top-section {
  .btn-outline-secondary {
    border-color: #6c757d;
    color: #f8f9fa;
    
    &:hover {
      background-color: #6c757d;
      border-color: #6c757d;
      color: #fff;
    }
  }
}
}
</style>
<template>
  <div class="home p-3 pt-4 mx-auto">
    <div v-if="$store.state.dbLoaded" class="search-bar mx-auto">
      <div class="input-group mb-1 col-12 md-col-6">
        <input
          class="form-control"
          :class="{'has-content': value}"
          ref="searchInput"
          type="text"
          autocapitalize="none"
          autocorrect="off"
          autocomplete="off"
          name="search"
          id="search"
          :placeholder="placeholder"
          style="font-size: 0.75rem;"
          @focus="focusOnSearchBar"
          @blur="blurSearchBar"
          @input="onInput"
          :value="inputValue"
        >
      </div>
    </div>
    
    <!-- Active Filter Chips - only show when filters are active -->
    <div v-if="activeFilters.length || activeQuickLinkList !== 'title'" class="active-filters-section mx-auto my-2">
      <div class="d-flex flex-wrap align-items-center">
        <!-- Quick Link Filter Chip -->
        <transition name="chip-fade" mode="out-in">
          <span v-if="activeQuickLinkList !== 'title'" class="badge text-bg-primary me-2 my-1 d-inline-flex align-items-center chip-transition" style="padding: 0.25rem 0.4rem; font-weight: normal; font-size: 0.75rem; line-height: 1.2;">
            {{ getQuickLinkDisplayName(activeQuickLinkList) }}
            <button class="btn-close btn-close-white ms-1" @click="clearQuickLink" style="font-size: 0.5rem; line-height: 1;"></button>
          </span>
        </transition>
        
        <!-- Additional Filter Chips -->
        <transition-group name="chip-fade" tag="div" class="d-inline-flex flex-wrap align-items-center">
          <span v-for="filter in activeFilters" :key="filter.id" class="badge text-bg-secondary me-2 my-1 d-inline-flex align-items-center chip-transition" style="padding: 0.25rem 0.4rem; font-weight: normal; font-size: 0.75rem; line-height: 1.2;">
            {{ filter.display }}
            <button 
              class="btn-close btn-close-white ms-1" 
              @click.stop.prevent="removeFilter(filter.id)" 
              style="font-size: 0.5rem; line-height: 1;"
              title="Remove filter">
            </button>
          </span>
        </transition-group>
        
        <!-- Wikipedia Button - only show when there's exactly one chip -->
        <button v-if="activeFilters.length === 1" class="btn btn-link text-light p-0 my-1 d-inline-flex align-items-center" style="font-size: 0.9rem; text-decoration: none; opacity: 0.7;" @click="goToWikipediaForChip" title="Wikipedia Info">
          <i class="bi bi-wikipedia" style="font-size: 1rem;"></i>
        </button>
        
        <!-- Small Add Filter Button -->
        <button class="btn btn-link text-light p-0 my-1 d-inline-flex align-items-center ms-1" style="font-size: 0.9rem; text-decoration: none; opacity: 0.7;" @click="showAddFilterModal = true" title="Add Filter">
          <i class="bi bi-plus-circle" style="font-size: 1rem;"></i>
        </button>
        
        <!-- Small Clear All Button -->
        <button class="btn btn-link text-light p-0 my-1 d-inline-flex align-items-center ms-1" style="font-size: 0.9rem; text-decoration: none; opacity: 0.7;" @click="clearAllFilters" title="Clear All">
          <i class="bi bi-x-circle" style="font-size: 1rem;"></i>
        </button>
      </div>
    </div>
    
    <!-- Suggestions button below search bar if user has rated < 10 movies -->
    <div v-if="$store.state.dbLoaded && !showSuggestionsOnly && userRatedMovieCount < 10 && !value && !resultsAreFiltered" class="text-center my-2">
      <button class="btn btn-success" @click="showSuggestionsOnly = true">{{ suggestionsButtonLabel }}</button>
    </div>
    <NoResults
      v-if="showSuggestionsOnly && userRatedMovieCount < 10"
      :value="value"
      :suggestionsMode="true"
      @cancel-suggestions="showSuggestionsOnly = false"
      style="margin-bottom: 2rem;"
    />
    <div v-else>
      <div v-if="showResultsList" class="results">
        <div v-if="paginatedSortedResults.length" class="results-exist">
          <div class="results-actions col-12 md-col-6 d-flex justify-content-between flex-wrap my-2">
            <div class="btn-group col-12" role="group" aria-label="Button group">
              <!-- Settings (gear) button replaces shorts toggle -->
              <button class="results-actions-button btn btn-secondary" @click="toggleSettingsPanel">
                <i class="bi bi-gear"></i>
              </button>
              <button class="results-actions-button btn btn-warning" @click="shareResults">
                <span v-if="!sharing">
                  <i class="bi bi-share"/>
                </span>
                <div v-else class="spinner-border text-light" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </button>
              <button class="results-actions-button filtered-count-display btn btn-secondary" @click="toggleCountViewsAverage">
                <span v-if="showAverage">
                  <span class="average-label">(avg)</span>
                  <span class="average-value">{{averageRating(filteredResults)}}</span>
                </span>
                <span v-else-if="showViewCount">
                  <span class="average-label">(views)</span>
                  <span class="average-value">{{viewsCount(filteredResults)}}</span>
                </span>
                <span v-else-if="activeQuickLinkList === 'bestPicture'">{{bestPicturesWithRatings.length}}/{{filteredResults.length}}</span>
                <span v-else>{{filteredResults.length}}</span>
              </button>
              <button class="results-actions-button btn btn-info" type="button" @click="goToInsights">
                <i class="bi bi-lightbulb"/>
              </button>
              <button class="results-actions-button btn btn-warning btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#quick-links-accordion" aria-expanded="false" aria-controls="quick-links-accordion" @click="toggleQuickLinksAccordion">
                <i class="bi bi-lightning-charge"/>
              </button>
              <button class="results-actions-button btn btn-info btn-sm" @click="findRandomSearchValue">
                <i class="bi bi-shuffle"/>
              </button>
              <button class="results-actions-button btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i v-if="sortValue === 'rating'" class="bi bi-123"/>
                <i v-if="sortValue === 'watched'" class="bi bi-calendar3"/>
                <i v-if="sortValue === 'release'" class="bi bi-calendar-date"/>
                <i v-if="sortValue === 'title'" class="bi bi-alphabet"></i>
                <i v-if="sortValue === 'views'" class="bi bi-eye"></i>
                <i v-if="sortValue === 'direction'" class="bi bi-dpad"></i>
                <i v-if="sortValue === 'imagery'" class="bi bi-image"></i>
                <i v-if="sortValue === 'story'" class="bi bi-book"></i>
                <i v-if="sortValue === 'performance'" class="bi bi-speedometer"></i>
                <i v-if="sortValue === 'soundtrack'" class="bi bi-music-note-beamed"></i>
                <i v-if="sortValue === 'stickiness'" class="bi bi-sticky"></i>
                <span class="order-arrow">
                  <i v-if="sortOrder !== 'bestOrNewestOnTop'" class="bi bi-arrow-down-short"/>
                  <i v-if="sortOrder === 'bestOrNewestOnTop'" class="bi bi-arrow-up-short"/>
                </span>
                <ul class="dropdown-menu">
                  <li value="rating">
                    <button class="dropdown-item" :class="{active: sortValue === 'rating'}" @click="setOrToggleSortValue('rating')">
                      Rating
                    </button>
                  </li>
                  <li value="watched">
                    <button class="dropdown-item" :class="{active: sortValue === 'watched'}" @click="setOrToggleSortValue('watched')">
                      Watch Date
                    </button>
                  </li>
                  <li value="release">
                    <button class="dropdown-item" :class="{active: sortValue === 'release'}" @click="setOrToggleSortValue('release')">
                      Release Date
                    </button>
                  </li>
                  <li value="title">
                    <button class="dropdown-item" :class="{active: sortValue === 'title'}" @click="setOrToggleSortValue('title')">
                      Title
                    </button>
                  </li>
                  <li value="views">
                    <button class="dropdown-item" :class="{active: sortValue === 'views'}" @click="setOrToggleSortValue('views')">
                      Views
                    </button>
                  </li>
                  <li value="direction">
                    <button class="dropdown-item" :class="{active: sortValue === 'direction'}" @click="setOrToggleSortValue('direction')">
                      Direction
                    </button>
                  </li>
                  <li value="imagery">
                    <button class="dropdown-item" :class="{active: sortValue === 'imagery'}" @click="setOrToggleSortValue('imagery')">
                      Imagery
                    </button>
                  </li>
                  <li value="story">
                    <button class="dropdown-item" :class="{active: sortValue === 'story'}" @click="setOrToggleSortValue('story')">
                      Story
                    </button>
                  </li>
                  <li value="performance">
                    <button class="dropdown-item" :class="{active: sortValue === 'performance'}" @click="setOrToggleSortValue('performance')">
                      Performance
                    </button>
                  </li>
                  <li value="soundtrack">
                    <button class="dropdown-item" :class="{active: sortValue === 'soundtrack'}" @click="setOrToggleSortValue('soundtrack')">
                      Soundtrack
                    </button>
                  </li>
                  <li value="stickiness">
                    <button class="dropdown-item" :class="{active: sortValue === 'stickiness'}" @click="setOrToggleSortValue('stickiness')">
                      Stickiness
                    </button>
                  </li>
                </ul>
              </button>
            </div>
            <div ref="quickLinkTypes" class="quick-link-types d-flex align-items-center flex-wrap col-md-12">
              <div id="quick-links-accordion" class="col-12 mt-1 accordion-collapse collapse">
                <div>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'annual' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleAnnualBestFilter"
                  >
                    Annual Best
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'bestPicture' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleBestPicturesFilter"
                  >
                    Best Picture
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'thisYear' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleThisYearFilter"
                  >
                    This Year
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'lastYear' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleLastYearFilter"
                  >
                    Last Year
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'thisMonth' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleThisMonthFilter"
                  >
                    This Month
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'lastMonth' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleLastMonthFilter"
                  >
                    Last Month
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'notOnLetterboxd' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleNotOnLetterboxdFilter"
                  >
                    Not on Letterboxd
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'genre' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleQuickLinksList('genre')"
                  >
                    Genres
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'keyword' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleQuickLinksList('keyword')"
                  >
                    Keywords
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'year' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleQuickLinksList('year')"
                  >
                    Years
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'director' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleQuickLinksList('director')"
                  >
                    Directors
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'cast/crew' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleQuickLinksList('cast/crew')"
                  >
                    Cast/Crew Members
                  </span>
                  <span
                    class="badge mx-1"
                    :class="activeQuickLinkList === 'studios' ? 'text-bg-success' : 'text-bg-secondary'"
                    @click="toggleQuickLinksList('studios')"
                  >
                    Studios
                  </span>
                  <hr>
                  <div class="tags-quicklinks">
                    <p data-bs-toggle="collapse" data-bs-target="#tagsCollapse" aria-expanded="false" aria-controls="tagsCollapse">
                      Tags
                      <i class="bi bi-caret-right-fill"/>
                    </p>
                    <div class="collapse" id="tagsCollapse">
                      <span
                        v-for="(tag, index) in tags"
                        :key="index"
                        class="badge mx-1"
                        :class="value === tag ? 'text-bg-success' : 'text-bg-secondary'"
                        @click="toggleQuickLinksList(tag)"
                      >
                        {{tag}}
                      </span>
                    </div>
                  </div>
                </div>
                <div v-if="sortedDataForActiveQuickLinkList.length" class="quick-links-list-wrapper mt-2">
                  <div class="accordion-body col-12">
                    <button
                      class="quick-links-list-sort"
                      :class="darkOrLight"
                      @click="toggleQuickLinksSort"
                    >
                      {{quickLinksSortType}}
                    </button>
                    <ul class="quick-link-list p-0 col-12">
                      <li v-for="(value, index) in sortedDataForActiveQuickLinkList" :key="index" @click="updateSearchValue(value.name)">
                        <span class="badge mx-1" :class="darkOrLight">
                          {{ value.name }}<span v-if="quickLinksSortType === 'count' && value.count">&nbsp;({{value.count}})</span>
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <StickinessModal
            v-if="showStickinessModal"
            :showStickinessModal="showStickinessModal"
            :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"Add commentMore actions
          />
          <TweakModal
            v-else-if="showTweakModal"
            :showTweakModal="showTweakModal"
            :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"
          />
          <!-- Inline Settings Panel accordion, right after action buttons and before results list -->
          <div v-if="showSettingsPanel" :class="['settings-panel-inline', 'card', 'card-body', darkOrLight['text-bg-dark'] ? 'dark' : '']">
            <div class="settings-panel-header d-flex justify-content-between align-items-center mb-2">
              <h5 class="mb-0">Settings</h5>
            </div>
            <hr class="mt-0 mb-3">
            <div class="settings-panel-body">
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="shortsToggle" v-model="showShorts">
                <label class="form-check-label" for="shortsToggle">Include short films</label>
              </div>
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="randomSearchToggle" v-model="enableRandomSearch" @change="saveRandomSearchSetting">
                <label class="form-check-label" for="randomSearchToggle">Show random search on page load</label>
              </div>
              <div class="mb-3">
                <label for="normalizationTweak" class="form-label">Normalization offset:</label>
                <input
                  type="number"
                  class="form-control"
                  id="normalizationTweak"
                  v-model.number="normalizationTweak"
                  min="0"
                  max="1"
                  step="0.01"
                  @change="saveNormalizationTweak"
                >
              </div>
              <div class="mb-3">
                <label for="tieBreakTweak" class="form-label">Max daily tiebreak prompts:</label>
                <input
                  type="number"
                  class="form-control"
                  id="tieBreakTweak"
                  v-model.number="tieBreakTweak"
                  min="0"
                  max="1"
                  step="1"
                  @change="saveTieBreakTweak"
                >
              </div>
              <div class="mb-3">
                <label for="letterboxdUsername" class="form-label">Letterboxd Username:</label>
                <div class="input-group">
                  <span class="input-group-text">letterboxd.com/</span>
                  <input
                    type="text"
                    class="form-control"
                    id="letterboxdUsername"
                    v-model="letterboxdUsername"
                    placeholder="username"
                    @blur="saveLetterboxdUsername"
                  >
                  <button v-if="letterboxdUsername" class="btn btn-outline-info" @click="testLetterboxdScraping" :disabled="scrapingTest.loading" title="Refresh Letterboxd Data">
                    <span v-if="scrapingTest.loading">
                      <span class="spinner-border spinner-border-sm" role="status"></span>
                    </span>
                    <span v-else>
                      <i class="bi bi-arrow-clockwise"></i>
                    </span>
                  </button>
                </div>
                <div v-if="letterboxdUsername">
                  <div v-if="scrapingTest.result" class="mt-2">
                    <div v-if="scrapingTest.success" class="alert alert-success alert-sm">
                      ✅ Found {{ scrapingTest.result.films?.length || 0 }} films in your Letterboxd profile!
                    </div>
                    <div v-else class="alert alert-warning alert-sm">
                      ⚠️ {{ scrapingTest.error || 'Testing failed, using mock data instead' }}
                    </div>
                  </div>
                  
                  <div class="text-end">
                    <a href="#" @click.prevent="showOverridePanel = !showOverridePanel" class="text-light text-decoration-none opacity-75" title="Manual overrides" style="font-size: 0.75rem;">
                      overrides <i class="bi bi-plus"></i>
                    </a>
                  </div>
                  
                  <div v-if="showOverridePanel" class="mt-2 border rounded p-2" style="background-color: rgba(255,255,255,0.1);">
                    <small class="text-light opacity-75 d-block mb-2">Mark movies as logged on Letterboxd when auto-detection fails</small>
                    <div class="row g-2 mb-2">
                      <div class="col-7">
                        <input 
                          type="text" 
                          class="form-control form-control-sm" 
                          v-model="newOverrideTitle" 
                          placeholder="Movie title (exact match)"
                        />
                      </div>
                      <div class="col-3">
                        <input 
                          type="number" 
                          class="form-control form-control-sm" 
                          v-model="newOverrideYear" 
                          placeholder="Year"
                        />
                      </div>
                      <div class="col-2">
                        <button 
                          class="btn btn-success btn-sm w-100" 
                          @click="addLetterboxdOverride" 
                          :disabled="!newOverrideTitle || !newOverrideYear"
                          title="Mark as logged on Letterboxd"
                        >
                          <i class="bi bi-plus"></i>
                        </button>
                      </div>
                    </div>
                    
                    <div v-if="letterboxdOverrides && Object.keys(letterboxdOverrides).length" class="mt-2">
                      <div class="override-list">
                        <div v-for="(override, key) in letterboxdOverrides" :key="key" class="d-flex justify-content-between align-items-center py-1 px-2 mb-1 rounded border" style="background-color: rgba(255,255,255,0.1);">
                          <small class="text-light">{{ override.title }} ({{ override.year }})</small>
                          <a href="#" @click.prevent="removeLetterboxdOverride(key)" class="text-danger text-decoration-none opacity-75" title="Remove override">
                            <i class="bi bi-x" style="font-size: 1rem;"></i>
                          </a>
                        </div>
                      </div>
                    </div>
                    
                    <div v-else class="text-light text-center py-2 opacity-75">
                      <small><em>No manual overrides set</em></small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Results list follows the settings panel -->
          <!-- Grouped results by person role -->
          <div v-if="groupedByPersonRole" class="pb-3">
            <div v-for="group in groupedByPersonRole" :key="`${group.personName}-${group.role}`" class="my-4 role-section">
              <h6 class="bg-dark text-white text-end mb-2">{{ group.role }}</h6>
              <ul class="grid-layout" :class="getGridClassesForGroup(group.movies.length)">
                <DBGridLayoutSearchResult
                  v-for="(result, index) in group.movies"
                  :key="topStructure(result).id"
                  :result="result"
                  :keywordCounts="allCounts.keywords"
                  :allCounts="allCounts"
                  :index="index"
                  :resultsAreFiltered="resultsAreFiltered"
                  :sortValue="sortValue"
                  :activeQuickLinkList="activeQuickLinkList"
                  @updateSearchValue="updateSearchValue"
                />
              </ul>
            </div>
          </div>
          <!-- Regular results list -->
          <ul v-else class="grid-layout pb-3" :class="listCountClasses">
            <DBGridLayoutSearchResult
              v-for="(result, index) in paginatedSortedResults"
              :key="topStructure(result).id"
              :result="result"
              :keywordCounts="allCounts.keywords"
              :allCounts="allCounts"
              :index="index"
              :resultsAreFiltered="resultsAreFiltered"
              :sortValue="sortValue"
              :activeQuickLinkList="activeQuickLinkList"
              @updateSearchValue="updateSearchValue"
            />
          </ul>
          <div v-if="!groupedByPersonRole && sortedResults.length > numberOfResultsToShow" class="d-flex justify-content-end mb-5">
            <button
              class="btn btn-secondary"
              @click="addMoreResults"
            >
              More...
            </button>
          </div>
          <!-- Suggestions button/component at the very bottom, only if not searching/filtering and all results are shown and user has rated 10+ movies -->
          <div v-else-if="!value && !resultsAreFiltered && sortedResults.length <= numberOfResultsToShow && userRatedMovieCount >= 10" class="mt-4 mb-5 text-center">
            <button v-if="!showSuggestionsOnly" class="btn btn-success" @click="showSuggestionsOnly = true">{{ suggestionsButtonLabel }}</button>
            <NoResults
              v-if="showSuggestionsOnly"
              :value="value"
              :suggestionsMode="true"
              @cancel-suggestions="showSuggestionsOnly = false"
              style="margin-bottom: 2rem;"
            />
          </div>
          <div v-else-if="noResults" class="button-wrapper d-flex justify-content-end mb-5">
            <div class="alert alert-warning text-center" style="flex: 1; margin-bottom: 0;">
              <p class="mb-2">No movies found on TMDB for "{{effectiveSearchTerm}}"</p>
              <button class="btn btn-sm btn-outline-dark" @click="startNewSearch">Try Another Search</button>
            </div>
          </div>
          <div v-else class="button-wrapper d-flex justify-content-end mb-5">
            <button class="btn btn-primary" @click="searchTMDB" id="new-rating-button">Search TMDB for {{titleCase(effectiveSearchTerm)}}</button>
          </div>
        </div>
        <div v-else class="no-results-but-search-type">
          <p class="text-center">No movies found for your search.</p>
          <button class="btn btn-link col-12" @click="toggleQuickLinksList(null)">Clear quick filters?</button>
        </div>
      </div>
      <NoResults v-else-if="$store.state.dbLoaded" :value="value" @clearValue="clearValue" @startNewSearch="startNewSearch"/>
      <div v-else class="loading-screen d-flex justify-content-center align-items-center my-5">
        <div class="spinner-border text-light" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
      <InsetBrowserModal :show="showInsetBrowserModal" :url="insetBrowserUrl" @close="showInsetBrowserModal = false" />
    </div>
    <!-- Unrated movies section -->
    <div v-if="unratedMoviesLoading" class="unrated-movies-loading text-center my-4">
      <span v-if="unratedMoviesSearchType === 'person'">Loading more movies by this person...</span>
      <span v-else-if="unratedMoviesSearchType === 'year'">Loading popular movies from {{ effectiveSearchTerm }}...</span>
      <span v-else-if="unratedMoviesSearchType === 'yearRange'">Loading popular movies from this time period...</span>
      <span v-else-if="unratedMoviesSearchType === 'genre'">Loading popular {{ effectiveSearchTerm.toLowerCase() }} movies...</span>
      <span v-else-if="unratedMoviesSearchType === 'company'">Loading more movies from {{ effectiveSearchTerm }}...</span>
      <span v-else-if="unratedMoviesSearchType === 'general'">Loading movies matching "{{ effectiveSearchTerm }}"...</span>
      <span v-else>Loading movies...</span>
    </div>
    <div v-else-if="displayableUnratedMovies.length && !unratedMoviesLoading && !unratedMoviesError && paginatedSortedResults.length" class="unrated-movies-grid">
      <!-- Debug: {{ console.log('More from section conditions:', 'displayable:', displayableUnratedMovies.length, 'loading:', unratedMoviesLoading, 'error:', unratedMoviesError) }} -->
      <h3 class="bg-dark">
        <span v-if="unratedMoviesSearchType === 'person'">More from {{ effectiveSearchTerm }}:</span>
        <span v-else-if="unratedMoviesSearchType === 'year'">More from {{ effectiveSearchTerm }}:</span>
        <span v-else-if="unratedMoviesSearchType === 'yearRange'">More from this time period:</span>
        <span v-else-if="unratedMoviesSearchType === 'genre'">More {{ effectiveSearchTerm.toLowerCase() }} movies:</span>
        <span v-else-if="unratedMoviesSearchType === 'company'">More from {{ effectiveSearchTerm }}:</span>
        <span v-else-if="unratedMoviesSearchType === 'general'">Movies matching "{{ effectiveSearchTerm }}":</span>
        <span v-else>More from {{ effectiveSearchTerm }}:</span>
      </h3>
      <div class="d-flex flex-wrap">
        <div v-for="movie in unratedMovies" :key="movie.id" class="unrated-movie-card" :class="columnsForUnratedMovies" @click="showMovieInfo(movie)">
          <img v-if="movie.poster_path" :src="'https://image.tmdb.org/t/p/w185' + movie.poster_path" :alt="movie.title" class="unrated-movie-poster col-12 p-1" style="cursor: pointer;"/>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Add Filter Modal -->
  <div v-if="showAddFilterModal" class="modal-overlay" @click="showAddFilterModal = false">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h5>Add Filter</h5>
        <button class="btn-close" @click="showAddFilterModal = false"></button>
      </div>
      <div class="modal-body">
        
        <!-- Director Filter -->
        <div class="filter-section mb-3">
          <label class="form-label">Director</label>
          <select class="form-select" @change="addDirectorFilter($event)">
            <option value="">Select a director...</option>
            <option v-for="director in topDirectors" :key="director.name" :value="director.name">
              {{ director.name }} ({{ director.count }})
            </option>
          </select>
        </div>
        
        <!-- Year Filter -->
        <div class="filter-section mb-3">
          <label class="form-label">Year</label>
          <select class="form-select" @change="addYearFilter($event)">
            <option value="">Select a year...</option>
            <option v-for="year in availableYears" :key="year" :value="year">
              {{ year }}
            </option>
          </select>
        </div>
        
        <!-- Genre Filter -->
        <div class="filter-section mb-3">
          <label class="form-label">Genre</label>
          <select class="form-select" @change="addGenreFilter($event)">
            <option value="">Select a genre...</option>
            <option v-for="genre in topGenres" :key="genre.name" :value="genre.name">
              {{ genre.name }} ({{ genre.count }})
            </option>
          </select>
        </div>
        
        <!-- Tag Filter -->
        <div class="filter-section mb-3" v-if="userTags.length">
          <label class="form-label">Tag</label>
          <select class="form-select" @change="addTagFilter($event)">
            <option value="">Select a tag...</option>
            <option v-for="tag in userTags" :key="tag" :value="tag">
              {{ tag }}
            </option>
          </select>
        </div>
        
      </div>
    </div>
  </div>

  <!-- Movie Info Modal -->
  <div v-if="showMovieInfoModal" class="modal-overlay" @click="closeMovieInfoModal">
    <div class="modal-content movie-info-modal" @click.stop>
      <div class="modal-header">
        <button class="btn-close btn-close-white" @click="closeMovieInfoModal"></button>
      </div>
      <div class="modal-body movie-info-body">
        <div v-if="selectedMovieInfo" class="movie-info-content">
          <div class="movie-poster-section">
            <img 
              v-if="selectedMovieInfo.poster_path" 
              :src="`https://image.tmdb.org/t/p/w300${selectedMovieInfo.poster_path}`" 
              :alt="selectedMovieInfo.title"
              class="movie-poster"
            >
          </div>
          <div class="movie-details-section">
            <h6 class="movie-title">{{ selectedMovieInfo.title }}</h6>
            <p v-if="selectedMovieInfo.release_date" class="movie-year">
              <strong>Year:</strong> {{ new Date(selectedMovieInfo.release_date).getFullYear() }}
            </p>
            <p v-if="selectedMovieInfo.genres && selectedMovieInfo.genres.length" class="movie-genres">
              <strong>Genres:</strong> {{ selectedMovieInfo.genres.map(g => g.name).join(', ') }}
            </p>
            <p v-if="selectedMovieInfo.overview" class="movie-overview">
              <strong>Synopsis:</strong> {{ selectedMovieInfo.overview }}
            </p>
            <p v-if="selectedMovieInfo.vote_average" class="movie-rating">
              <strong>TMDB Rating:</strong> {{ selectedMovieInfo.vote_average }}/10
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import uniq from 'lodash/uniq';
import minBy from 'lodash/minBy';
import debounce from 'lodash/debounce';
import DBGridLayoutSearchResult from './DBGridLayoutSearchResult.vue';
import StickinessModal from "./StickinessModal.vue";
import TweakModal from "./TweakModal.vue";
import NoResults from "./NoResults.vue";
import InsetBrowserModal from './InsetBrowserModal.vue';
import { getRating } from "../assets/javascript/GetRating.js";

export default {
  components: {
    DBGridLayoutSearchResult,
    InsetBrowserModal,
    StickinessModal,
    TweakModal,
    NoResults,
  },
  data () {
    return {
      sortOrder: "bestOrNewestOnTop",
      value: "",
      inputValue: "", // Visual input value (can be different from internal value)
      activeQuickLinkList: "title",
      sortValue: null,
      quickLinksSortType: "count",
      numberOfResultsToShow: 25,
      sharing: false,
      hasCalledFindFilter: false,
      showInsetBrowserModal: false,
      insetBrowserUrl: "",
      showAverage: false,
      showViewCount: false,
      showSuggestionsOnly: false,
      showShorts: false, // shorts toggle, default to off
      enableRandomSearch: null, // random search on page load toggle, will be set from store
      showSettingsPanel: false, // controls settings panel visibility
      normalizationTweak: 0.25, // default, will be set from store
      tieBreakTweak: 1, // default, will be set from store
      letterboxdConnected: false, // Letterboxd integration toggle
      letterboxdUsername: '', // Letterboxd username
      scrapingTest: {
        loading: false,
        result: null,
        success: false,
        error: null
      },
      unratedMovies: [],
      unratedMoviesLoading: false,
      unratedMoviesError: null,
      unratedMoviesQuery: '',
      unratedMoviesPersonType: '',
      unratedMoviesDebounceTimeout: null,
      unratedMoviesSearchType: null, // 'person', 'year', 'yearRange', 'genre', 'general'
      letterboxdUserData: null,
      letterboxdOverrides: {},
      newOverrideTitle: '',
      newOverrideYear: null,
      showOverridePanel: false,
      activeFilters: [], // New multi-filter system
      activeSearchUnits: [], // Unified search units system
      showAddFilterModal: false,
      searchToChipTimeout: null, // For auto-converting search to chip
      debouncedSearchValue: '', // Debounced value for fuzzy filtering
      hasAutoRandomChip: false, // Track if current chip was added by auto random search
      showMovieInfoModal: false, // Show/hide movie info modal
      selectedMovieInfo: null, // Movie data for the info modal
      noResults: false, // Show no results message for TMDB search
    }
  },
  watch: {
    DBSearchValue (newVal) {
      if (newVal || newVal === "") {
        this.value = newVal;
      }
    },
    value (newVal, oldVal) {
      // Sync local value changes to store (to prevent cycles, only if they're different)
      if (this.$store.state.DBSearchValue !== newVal) {
        this.$store.commit('setDBSearchValue', newVal);
      }
      
      // Auto-chip conversion setup - use same delay as onInput
      clearTimeout(this.searchToChipTimeout);
      if (newVal && newVal.trim() && newVal !== oldVal) {
        this.searchToChipTimeout = setTimeout(() => {
          this.convertSearchToChip();
        }, 2000);
      }
    },
    '$route.query.search'(newVal, oldVal) {
      // When the route query changes, update the value
      if (newVal !== oldVal && typeof newVal === 'string') {
        const decodedValue = decodeURIComponent(newVal);
        this.value = decodedValue;
        // Only commit if different from current store value to prevent cycles
        if (this.$store.state.DBSearchValue !== decodedValue) {
          this.$store.commit('setDBSearchValue', decodedValue);
        }
      }
    },
    DBSortValue (newVal) {
      if (newVal) {
        this.setSortValue(newVal)
      }
    },
    paginatedSortedResults (newVal, oldVal) {
      if (!oldVal.length && newVal.length) {
        this.checkResultsAndFindFilter();
      }
    },
    filteredResults: debounce(function (newVal) {
      this.$store.commit("setFilteredResults", newVal);
    }, 500),
    '$store.state.settings.normalizationTweak': {
      handler(newVal) {
        if (typeof newVal === 'number') {
          this.normalizationTweak = newVal;
        } else {
          this.normalizationTweak = 0.25;
        }
      },
      immediate: true
    },
    '$store.state.settings.tieBreakTweak': {
      handler(newVal) {
        if (typeof newVal === 'number') {
          this.tieBreakTweak = newVal;
        } else {
          this.tieBreakTweak = 1;
        }
      },
      immediate: true
    },
    '$store.state.settings.includeShorts': {
      handler(newVal) {
        if (typeof newVal === 'boolean') {
          this.showShorts = newVal;
        } else {
          this.showShorts = false;
        }
      },
      immediate: true
    },
    '$store.state.settings': {
      handler(newSettings) {
        if (!newSettings) return;
        
        const wasNull = this.enableRandomSearch === null;
        const settingValue = newSettings.enableRandomSearch;
        const settingsKeys = Object.keys(newSettings);
        
        if (typeof settingValue === 'boolean') {
          // We have a definitive boolean value from the user's settings
          this.enableRandomSearch = settingValue;
        } else if (settingsKeys.length > 5) {
          // Settings object is fully loaded but doesn't have enableRandomSearch property
          // This indicates a user who hasn't set this preference yet - default to true
          this.enableRandomSearch = true;
        } else {
          // Settings object is empty or only partially loaded - wait for complete load
          return;
        }
        
        // If this is the first time setting is loaded, trigger random search check
        if (wasNull && this.enableRandomSearch !== null) {
          this.$nextTick(() => {
            this.checkResultsAndFindFilter();
          });
        }
      },
      immediate: true,
      deep: true
    },
    '$store.state.settings.letterboxdConnected': {
      handler(newVal) {
        if (typeof newVal === 'boolean') {
          this.letterboxdConnected = newVal;
        } else {
          this.letterboxdConnected = false;
        }
      },
      immediate: true
    },
    '$store.state.settings.letterboxdUsername': {
      handler(newVal) {
        if (typeof newVal === 'string') {
          this.letterboxdUsername = newVal;
        } else {
          this.letterboxdUsername = '';
        }
      },
      immediate: true
    },
    showShorts(newVal) {
      this.$store.dispatch('setDBValue', { path: 'settings/includeShorts', value: newVal });
    },
    effectiveSearchTerm(newVal, oldVal) {
      // Fetch unrated movies for any non-empty search term (from input or chips)
      if (newVal && newVal !== oldVal) {
        // Determine the context for the search
        let searchContext = null;
        
        // Check if we have active chips - if so, use chip context
        const relevantChips = this.activeFilters.filter(filter => 
          ['search', 'director', 'year', 'genre', 'company', 'tag'].includes(filter.type)
        );
        
        if (relevantChips.length > 0) {
          // Search is from chips - use the chip type and value
          const chip = relevantChips[relevantChips.length - 1];
          // Normalize 'search' type chips to 'general' to match input behavior
          const normalizedType = chip.type === 'search' ? 'general' : chip.type;
          searchContext = { type: normalizedType, value: chip.value };
        } else if (this.value && this.value.trim()) {
          // Search is from input - use auto-detection
          searchContext = null;
        }
        
        this.debouncedFetchUnratedMoviesByValue(newVal, searchContext);
      } else if (!newVal) {
        this.unratedMovies = [];
        this.unratedMoviesError = null;
      }
    },
    // Sync this.value with chips for backward compatibility
    activeFilters: {
      handler(newFilters, oldFilters) {
        // Only sync when the search input is empty (no manual typing)
        if (!this.value || !this.value.trim()) {
          const relevantChips = newFilters.filter(filter => 
            ['search', 'director', 'year', 'genre', 'company', 'tag'].includes(filter.type)
          );
          
          if (relevantChips.length > 0) {
            // Set this.value to the most recent relevant chip value
            const latestChip = relevantChips[relevantChips.length - 1];
            this.value = latestChip.value;
          } else if (oldFilters && oldFilters.length > 0 && newFilters.length === 0) {
            // All chips removed - clear the value
            this.value = '';
          }
        }
      },
      deep: true
    },
    '$store.state.dbLoaded'(newVal) {
      if (newVal) {
        this.checkResultsAndFindFilter();
      }
    }
  },
  created() {
    // Create debounced function for search filtering
    this.updateDebouncedSearch = debounce((searchValue) => {
      this.debouncedSearchValue = searchValue;
    }, 300);
    
    // Initialize debounced search value
    this.debouncedSearchValue = this.value || '';
  },
  mounted () {
    this.value = this.DBSearchValue;
    this.inputValue = this.value; // Sync visual input with internal value
    window.scroll({
      top: 0,
      left: 0,
      behavior: 'instant'
    });

    if (this.$route.query.search) {
      this.value = decodeURIComponent(this.$route.query.search);
      this.inputValue = this.value; // Sync visual input
    } else {
      this.checkResultsAndFindFilter();
    }

    if (this.DBSortValue) {
      this.setSortValue(this.DBSortValue)
    } else {
      this.setSortValue("rating")
    }

    if (this.$route.query.movieDbKey) {
      this.$store.commit("setDBSortValue", "watched");
      this.sortOrder = "bestOrNewestOnTop";
    }

    // Initialize showShorts from store
    if (typeof this.$store.state.settings.includeShorts === 'boolean') {
      this.showShorts = this.$store.state.settings.includeShorts;
    } else {
      this.showShorts = false;
    }
    
    // Initialize enableRandomSearch from store - let the watcher handle defaults
    if (typeof this.$store.state.settings.enableRandomSearch === 'boolean') {
      this.enableRandomSearch = this.$store.state.settings.enableRandomSearch;
    }
    // Note: Don't set a default here - let the settings watcher handle it properly
    
    // Initialize letterboxdOverrides from store
    if (this.$store.state.settings.letterboxdOverrides) {
      this.letterboxdOverrides = this.$store.state.settings.letterboxdOverrides;
    }
  },
  beforeRouteLeave () {
    this.sortOrder = "bestOrNewestOnTop";
    this.setSortValue(null);
    this.value = "";
    this.$store.commit("setDBSearchValue", this.value);
    this.$store.commit("setDBSortValue", this.sortValue);
    
    // Clean up timeouts
    clearTimeout(this.searchToChipTimeout);
  },
  beforeUnmount() {
    // Clean up timeouts when component is destroyed
    clearTimeout(this.searchToChipTimeout);
  },
  computed: {
    isMatt () {
      return this.$store.state.databaseTopKey === "mattgrosso-gmail-com" || !this.$store.state.databaseTopKey;
    },
    darkOrLight () {
      const inDarkMode = document.querySelector("body").classList.contains('bg-dark');

      return { 'text-bg-dark': inDarkMode, 'text-bg-light': !inDarkMode };
    },
    tags () {
      if (this.$store.state?.settings?.tags?.['viewing-tags']) {
        return Object.values(this.$store.state.settings.tags['viewing-tags']).map(tag => tag.title);
      } else {
        return [];
      }
    },
    DBSearchValue () {
      return this.$store.state.DBSearchValue;
    },
    DBSortValue () {
      return this.$store.state.DBSortValue;
    },
    displayableUnratedMovies () {
      const filtered = this.unratedMovies.filter(movie => movie.id && movie.poster_path);
      return filtered;
    },
    allEntriesWithFlatKeywordsAdded () {
      return this.$store.getters.allMediaAsArray.map((result) => {
        const flatTMDBKeywords = result.movie.keywords ? result.movie.keywords.map((keyword) => keyword.name) : [];
        const flatChatGPTKeywords = this.topStructure(result).chatGPTKeywords || [];
        const flatKeywords = uniq([...flatTMDBKeywords, ...flatChatGPTKeywords]);
        return {
          ...result,
          movie: {
            ...this.topStructure(result),
            flatKeywords: flatKeywords || []
          }
        }
      });
    },
    resultsThatNeedStickiness () {
      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const hasntReratedStickinessOneWeek = !this.mostRecentRating(result).userAddedStickiness;
        const hasntReratedStickinessSixMonths = !this.mostRecentRating(result).userAddedSixMonthStickiness;
        const ratingDate = this.mostRecentRating(result).date || "1/1/2021";
        const moreThanAWeekAgo = new Date(ratingDate).getTime() < new Date().getTime() - (604800000);
        const moreThanSixMonthsAgo = new Date(ratingDate).getTime() < new Date().getTime() - (15778476000);

        return (hasntReratedStickinessOneWeek && moreThanAWeekAgo) || (hasntReratedStickinessSixMonths && moreThanSixMonthsAgo);
      }).sort((a, b) => {
        const ratingDateA = this.mostRecentRating(a).date || "1/1/2021";
        const ratingDateB = this.mostRecentRating(b).date || "1/1/2021";
        const dateA = new Date(ratingDateA);
        const dateB = new Date(ratingDateB);
        return dateB - dateA;
      });
    },
    showStickinessModal () {
      return Boolean(this.allEntriesWithFlatKeywordsAdded.length && this.resultsThatNeedStickiness.length);
    },
    showTweakModal () {
      if (this.showStickinessModal) {
        return false;
      }

      const firstTiedPairIndex = this.sortedByRating.findIndex((movie, index) => {
        const nextMovie = this.sortedByRating[index + 1];

        if (!nextMovie) {
          return false;
        }

        return getRating(movie).calculatedTotal === getRating(nextMovie).calculatedTotal;
      });

      if (firstTiedPairIndex === -1) {
        return false;
      }

      const hasTiedResults = Boolean(this.sortedByRating[firstTiedPairIndex] && this.sortedByRating[firstTiedPairIndex + 1]);
      const lastTweak = this.$store.state.settings.lastTweak || Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const maxDailyTieBreaks = this.$store.state.settings.tieBreakTweak || 1;
      const noTieBreakYetToday = Date.now() - lastTweak > (oneDay / maxDailyTieBreaks);

      return hasTiedResults && noTieBreakYetToday;
    },
    filteredResults () {
      // MIGRATED: Now uses the unified filtering system
      return this.unifiedFilteredResults;
    },
    unifiedFilteredResults() {
      // UNIFIED FILTERING: Complete replacement for filteredResults
      // Handles quick links, input text, chips, and shorts filtering in one place
      
      // Step 1: Get base results (from quick links or all entries)
      let results;
      
      if (this.activeQuickLinkList === "annual") {
        results = this.bestMovieFromEachYear;
      } else if (this.activeQuickLinkList === "bestPicture") {
        results = this.bestPictures;
      } else if (this.activeQuickLinkList === "thisYear") {
        results = this.thisYearsMovies;
      } else if (this.activeQuickLinkList === "lastYear") {
        results = this.lastYearsMovies;
      } else if (this.activeQuickLinkList === "thisMonth") {
        results = this.thisMonthsMovies;
      } else if (this.activeQuickLinkList === "lastMonth") {
        results = this.lastMonthsMovies;
      } else if (this.activeQuickLinkList === "notOnLetterboxd") {
        results = this.notOnLetterboxdMovies;
      } else if (this.tags.includes(this.activeQuickLinkList)) {
        results = this.matchingTags;
      } else {
        // No quick link active - start with all entries
        results = this.allEntriesWithFlatKeywordsAdded;
      }
      
      // Step 2: Apply all filters from allActiveFilters (input + chips)
      if (this.allActiveFilters.length > 0) {
        results = results.filter(result => {
          const movie = this.topStructure(result);
          
          // ALL filters must match (AND logic)
          return this.allActiveFilters.every(filter => {
            return this.applyFilter(movie, result, filter);
          });
        });
      }
      
      // Step 3: Exclude shorts if showShorts is false
      if (!this.showShorts) {
        results = results.filter(result => {
          // Try to detect short films by genre or runtime
          const genres = this.topStructure(result).genres || [];
          const isShortGenre = Array.isArray(genres) ? genres.some(g => g.name && g.name.toLowerCase() === 'short') : false;
          const runtime = this.topStructure(result).runtime;
          // Consider as short if genre is 'Short' or runtime <= 40 min
          return !isShortGenre && !(runtime && runtime <= 40);
        });
      }
      
      return results;
    },
    groupedByPersonRole () {
      // Use debounced search for typing performance, but fall back to effectiveSearchTerm for chips
      let searchTerm;
      if (this.debouncedSearchValue) {
        // User is typing - use debounced value for performance
        searchTerm = this.debouncedSearchValue;
      } else if (this.activeFilters.length > 0) {
        // User has chips active - use effectiveSearchTerm 
        searchTerm = this.effectiveSearchTerm;
      } else {
        return null;
      }
      
      if (!searchTerm) return null;
      const normalizedSearchTerm = searchTerm.toLowerCase();
      
      // Only show person role sections when:
      // 1. We have a director chip active, OR
      // 2. The search term looks like a person's name (has spaces, suggesting first/last name)
      const hasDirectorChip = this.activeFilters.some(filter => filter.type === 'director');
      const looksLikePersonName = searchTerm.includes(' ') && searchTerm.split(' ').length >= 2;
      
      if (!hasDirectorChip && !looksLikePersonName) {
        return null;
      }
      
      // Define role hierarchy (higher number = higher priority)
      const roleRanking = {
        'Director': 7,
        'Cast': 6,
        'Producer': 5,
        'Writer': 4,
        'Cinematographer': 3,
        'Music': 2,
        'Editor': 1,
        'Crew': 0
      };
      
      // First pass: collect all movies for each person-role combination
      const personRoleData = {};
      const usedMovies = new Set(); // Track movies that have been assigned to higher priority roles
      
      this.unifiedFilteredResults.forEach((media) => {
        const movieData = this.topStructure(media);
        
        // Check cast
        if (movieData.cast) {
          movieData.cast.forEach((person) => {
            const personName = person.name.toLowerCase();
            const personNames = personName.split(' ');
            
            if (personName.includes(normalizedSearchTerm) || personNames.some(name => name.includes(normalizedSearchTerm))) {
              if (!personRoleData[person.name]) {
                personRoleData[person.name] = {};
              }
              if (!personRoleData[person.name]['Cast']) {
                personRoleData[person.name]['Cast'] = [];
              }
              personRoleData[person.name]['Cast'].push(media);
            }
          });
        }
        
        // Check crew
        if (movieData.crew) {
          movieData.crew.forEach((person) => {
            const personName = person.name.toLowerCase();
            const personNames = personName.split(' ');
            
            if (personName.includes(normalizedSearchTerm) || personNames.some(name => name.includes(normalizedSearchTerm))) {
              let roleCategory = 'Crew';
              
              // Categorize crew roles
              if (person.job === 'Director') {
                roleCategory = 'Director';
              } else if (person.job && person.job.toLowerCase().includes('producer')) {
                roleCategory = 'Producer';
              } else if (person.job && ['Writer', 'Screenplay', 'Story', 'Novel'].includes(person.job)) {
                roleCategory = 'Writer';
              } else if (person.job && person.job.toLowerCase().includes('composer') || 
                        person.job && person.job.toLowerCase().includes('music') ||
                        person.job && person.job.toLowerCase().includes('score')) {
                roleCategory = 'Music';
              } else if (person.job && person.job.toLowerCase().includes('editor')) {
                roleCategory = 'Editor';
              } else if (person.job && (person.job.toLowerCase().includes('photo') ||
                                      person.job.toLowerCase().includes('cinematographer') ||
                                      person.job.toLowerCase().includes('director of photography'))) {
                roleCategory = 'Cinematographer';
              }
              
              if (!personRoleData[person.name]) {
                personRoleData[person.name] = {};
              }
              if (!personRoleData[person.name][roleCategory]) {
                personRoleData[person.name][roleCategory] = [];
              }
              
              // Avoid duplicates in the same role category
              if (!personRoleData[person.name][roleCategory].find(m => this.topStructure(m).id === movieData.id)) {
                personRoleData[person.name][roleCategory].push(media);
              }
            }
          });
        }
      });
      
      // Second pass: build final groups ensuring each movie appears only once, prioritizing by role ranking
      const finalGroups = [];
      
      Object.keys(personRoleData).forEach(personName => {
        const roles = personRoleData[personName];
        
        // Sort roles by ranking (highest first)
        const sortedRoles = Object.keys(roles).sort((a, b) => (roleRanking[b] || 0) - (roleRanking[a] || 0));
        
        sortedRoles.forEach(role => {
          const availableMovies = roles[role].filter(movie => !usedMovies.has(this.topStructure(movie).id));
          
          if (availableMovies.length > 0) {
            // Sort the movies in this group using the same sorting logic as the main list
            const sortedMovies = [...availableMovies].sort(this.sortResults);
            
            finalGroups.push({
              personName: personName,
              role: role,
              movies: sortedMovies,
              ranking: roleRanking[role] || 0
            });
            
            // Mark these movies as used
            availableMovies.forEach(movie => {
              usedMovies.add(this.topStructure(movie).id);
            });
          }
        });
      });
      
      // Sort final groups by person name, then by role ranking (highest first)
      finalGroups.sort((a, b) => {
        if (a.personName !== b.personName) {
          return a.personName.localeCompare(b.personName);
        }
        return b.ranking - a.ranking;
      });
      
      // Only return grouped results if we found person matches and there are multiple groups for at least one person
      const personCounts = {};
      finalGroups.forEach(group => {
        personCounts[group.personName] = (personCounts[group.personName] || 0) + 1;
      });
      
      const hasMultipleRoles = Object.values(personCounts).some(count => count > 1);
      return hasMultipleRoles ? finalGroups : null;
    },
    yearFilter () {
      let parsedYears = [];

      if (this.value.length === 2 && parseInt(this.value) < new Date().getFullYear() - 2000) {
        parsedYears = [`20${this.value}`];
      } else if (this.value.length === 2) {
        parsedYears = [`19${this.value}`];
      } else if (this.value.includes("-") && this.value.includes(" ")) {
        parsedYears = this.value.split(" ").join("").split("-");

        for (let i = parseInt(parsedYears[0]) + 1; i < parseInt(parsedYears[1]); i++) {
          parsedYears.push(i.toString());
        }
      } else if (this.value.includes("-")) {
        parsedYears = this.value.split("-");

        for (let i = parseInt(parsedYears[0]) + 1; i < parseInt(parsedYears[1]); i++) {
          parsedYears.push(i.toString());
        }
      } else if (this.value.length === 5 && this.value.includes("s")) {
        parsedYears = this.value.split("s").filter((x) => x);

        parsedYears.push(`${parseInt(parsedYears[0]) + 1}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 2}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 3}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 4}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 5}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 6}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 7}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 8}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 9}`);
      } else if (this.value.length === 3 && this.value.includes("s")) {
        parsedYears = this.value.split("s").filter((x) => x);

        if (parseInt(this.value) < new Date().getFullYear() - 2000) {
          parsedYears[0] = `20${parsedYears[0]}`;
        } else {
          parsedYears[0] = `19${parsedYears[0]}`;
        }
        parsedYears.push(`${parseInt(parsedYears[0]) + 1}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 2}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 3}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 4}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 5}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 6}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 7}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 8}`);
        parsedYears.push(`${parseInt(parsedYears[0]) + 9}`);
      } else if (this.value.length === 4 && parseInt(this.value)) {
        parsedYears = [this.value];
      }

      return parsedYears;
    },
    bestMovieFromEachYear () {
      const years = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        let year;

        year = new Date(result.movie.release_date).getFullYear();

        if (!years[year]) {
          years[year] = result;
        } else if (this.mostRecentRating(result).calculatedTotal > this.mostRecentRating(years[year]).calculatedTotal) {
          years[year] = result;
        }
      })

      return Object.keys(years).map((year) => years[year]);
    },
    bestPictures () {
      const bestPictureWinners = this.$store.state.academyAwardWinners.bestPicture;

      const allEntryIds = this.allEntriesWithFlatKeywordsAdded.map((result) => {
        return this.topStructure(result).id;
      });

      const bestPictureWinnersWithRatingStatus = [];

      bestPictureWinners.forEach((movie) => {
        if (allEntryIds.includes(movie.id)) {
          bestPictureWinnersWithRatingStatus.push({
            ...this.allEntriesWithFlatKeywordsAdded.find((entry) => entry.movie.id === movie.id),
            ...{
              movie: {
                ...this.allEntriesWithFlatKeywordsAdded.find((entry) => entry.movie.id === movie.id).movie,
                academyAwardsYear: movie.academyAwardsYear
              }
            }
          });
        } else {
          bestPictureWinnersWithRatingStatus.push({
            falseEntry: true,
            movie: movie,
            ratings: [
              {
                date: Date.now(),
                direction: 0,
                id: movie.id,
                imagery: 0,
                impression: 0,
                love: 0,
                medium: "",
                overall: 0,
                performance: 0,
                soundtrack: 0,
                stickiness: 0,
                story: 0,
                title: movie.title,
                year: new Date(movie.release_date).getFullYear()
              }
            ]
          });
        }
      });

      return bestPictureWinnersWithRatingStatus;
    },
    thisYearsMovies () {
      const currentYear = new Date().getFullYear();

      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const mostRecentRating = this.mostRecentRating(result);

        if (mostRecentRating && mostRecentRating.date) {
          const ratingYear = new Date(parseInt(mostRecentRating.date)).getFullYear();
          return ratingYear === currentYear;
        }

        return false;
      });
    },
    lastYearsMovies () {
      const lastYear = new Date().getFullYear() - 1;

      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const mostRecentRating = this.mostRecentRating(result);

        if (mostRecentRating && mostRecentRating.date) {
          const ratingYear = new Date(parseInt(mostRecentRating.date)).getFullYear();
          return ratingYear === lastYear;
        }

        return false;
      });
    },
    thisMonthsMovies () {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const mostRecentRating = this.mostRecentRating(result);

        if (mostRecentRating && mostRecentRating.date) {
          const ratingMonth = new Date(parseInt(mostRecentRating.date)).getMonth();
          const ratingYear = new Date(parseInt(mostRecentRating.date)).getFullYear();
          return ratingMonth === currentMonth && ratingYear === currentYear;
        }

        return false;
      });
    },
    lastMonthsMovies () {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
    
      // Adjust for January
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const mostRecentRating = this.mostRecentRating(result);
    
        if (mostRecentRating && mostRecentRating.date) {
          const ratingDate = new Date(parseInt(mostRecentRating.date));
          const ratingMonth = ratingDate.getMonth();
          const ratingYear = ratingDate.getFullYear();
          return ratingMonth === lastMonth && ratingYear === lastMonthYear;
        }
    
        return false;
      });
    },
    notOnLetterboxdMovies () {
      if (!this.$store.state.settings.letterboxdConnected || !this.$store.state.settings.letterboxdUsername) {
        return [];
      }

      // If we don't have letterboxd data yet, return empty array
      if (!this.letterboxdUserData) {
        return [];
      }

      // Filter movies that are NOT in the user's Letterboxd films
      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        const movie = this.topStructure(result);
        
        // First check manual overrides
        const overrides = this.$store.state.settings.letterboxdOverrides || {};
        const overrideKey = `${movie.title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${new Date(movie.release_date).getFullYear()}`;
        
        if (overrides[overrideKey]) {
          return false; // Manual override says this movie is logged, so exclude from "not on letterboxd"
        }
        
        // Check if this movie exists in the user's Letterboxd films (automatic detection)
        const movieExists = this.letterboxdUserData.films.some(film => {
          const normalizedFilmTitle = this.normalizeMovieTitle(film.title);
          const normalizedSearchTitle = this.normalizeMovieTitle(movie.title);
          return normalizedFilmTitle === normalizedSearchTitle;
        });
        
        // Return movies that are NOT on Letterboxd
        return !movieExists;
      });
    },
    matchingTags () {
      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        return result.ratings.map((rating) => rating.tags || []).flat().map((tag) => tag.title).includes(this.activeQuickLinkList);
      });
    },
    bestPicturesWithRatings () {
      return this.bestPictures.filter((result) => !result.falseEntry);
    },
    showResultsList () {
      return Boolean(this.paginatedSortedResults.length) || this.activeQuickLinkList !== "title";
    },
    sortedResults () {
      return [...this.filteredResults].sort(this.sortResults);
    },
    sortedByRating () {
      const allMediaSortedByRating = this.$store.getters.allMediaSortedByRating;

      if (this.sortOrder === 'bestOrNewestOnTop') {
        return allMediaSortedByRating;
      } else {
        return allMediaSortedByRating.slice().reverse();
      }
    },
    paginatedSortedResults () {
      return this.sortedResults.slice(0, this.numberOfResultsToShow);
    },
    datalistForActiveQuickLink () {
      if (this.activeQuickLinkList === "keyword") {
        return this.allKeywords;
      } else if (this.activeQuickLinkList === "genre") {
        return this.allGenres;
      } else if (this.activeQuickLinkList === "year") {
        return this.allYears;
      } else if (this.activeQuickLinkList === "director") {
        return this.allDirectors;
      } else if (this.activeQuickLinkList === "cast/crew") {
        return this.allCastCrew;
      } else if (this.activeQuickLinkList === "studios") {
        return this.allStudios;
      } else if (this.activeQuickLinkList === "mediums") {
        return this.allMediums;
      } else {
        return [];
      }
    },
    sortedDataForActiveQuickLinkList () {
      const data = [...this.datalistForActiveQuickLink];

      if (this.quickLinksSortType === "a-z") {
        return data.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        return data.sort((a, b) => b.count - a.count);
      }
    },
    allKeywords () {
      return Object.keys(this.countedKeywords).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countedKeywords[keyword]
        }
      });
    },
    allGenres () {
      return Object.keys(this.countedGenres).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countedGenres[keyword]
        }
      });
    },
    allYears () {
      return Object.keys(this.countedYears).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countedYears[keyword]
        }
      });
    },
    allDirectors () {

      return Object.keys(this.countDirectors).map((keyword) => {
        const filmography = this.allEntriesWithFlatKeywordsAdded.find((entry) => {
          return entry.movie.crew.find((person) => person.job === "Director" && person.name === keyword);
        }).movie.crew.find((person) => person.name === keyword && person.filmography)?.filmography;

        return {
          name: this.titleCase(keyword),
          count: this.countDirectors[keyword],
          filmography: filmography ? filmography.filter((film) => new Date(film.release_date) < new Date() && film.popularity > 8.65) : []
        }
      });
    },
    allCastCrew () {
      return Object.keys(this.countCastCrew).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countCastCrew[keyword]
        }
      });
    },
    allStudios () {
      return Object.keys(this.countStudios).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countStudios[keyword]
        }
      });
    },
    allMediums () {
      const mediums = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        result.ratings.forEach((rating) => {
          if (!rating.medium) {
            return;
          } else if (mediums[rating.medium]) {
            mediums[rating.medium]++;
          } else {
            mediums[rating.medium] = 1;
          }
        });
      });

      return Object.keys(mediums).map((medium) => {
        return {
          name: this.titleCase(medium),
          count: mediums[medium]
        }
      });
    },
    allCounts () {
      return {
        keywords: this.countedKeywords,
        genres: this.countedGenres,
        years: this.countedYears,
        directors: this.countDirectors,
        castCrew: this.countCastCrew,
        studios: this.countStudios,
        mediums: this.allMediums,
        filmographies: this.allDirectors
      }
    },
    countedKeywords () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const keywords = this.topStructure(result).flatKeywords;
        if (Array.isArray(keywords)) {
          keywords.forEach((keyword) => {
            if (counts[keyword]) {
              counts[keyword]++;
            } else if (keyword) {
              counts[keyword] = 1;
            }
          })
        }
      })

      return counts;
    },
    countedGenres () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const genres = this.topStructure(result).genres;
        if (Array.isArray(genres)) {
          genres.forEach((genre) => {
            if (counts[genre.name]) {
              counts[genre.name]++;
            } else if (genre.name) {
              counts[genre.name] = 1;
            }
          })
        }
      })

      return counts;
    },
    countedYears () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const year = this.getYear(result);
        if (counts[year]) {
          counts[year]++;
        } else if (year) {
          counts[year] = 1;
        }
      })

      return counts;
    },
    countDirectors () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const crew = result.movie.crew;
        const director = Array.isArray(crew) ? crew.find((person) => person.job === "Director")?.name : null;

        if (director) {
          if (counts[director]) {
            counts[director]++;
          } else if (director) {
            counts[director] = 1;
          }
        }
      })

      return counts;
    },
    countCastCrew () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const castData = this.topStructure(result).cast;
        const crewData = this.topStructure(result).crew;
        const cast = Array.isArray(castData) ? castData.filter((person, index) => index < 10).map(person => person.name) : [];
        const crew = Array.isArray(crewData) ? crewData.filter((person, index) => index < 10).map(person => person.name) : [];
        const castCrewCombined = uniq([...cast, ...crew]);

        castCrewCombined.forEach((person) => {
          if (counts[person]) {
            counts[person]++;
          } else if (person) {
            counts[person] = 1;
          }
        })
      })

      return counts;
    },
    countStudios () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const productionCompanies = this.topStructure(result).production_companies?.map(company => company.name) || [];

        productionCompanies.forEach((company) => {
          if (counts[company]) {
            counts[company]++;
          } else if (company) {
            counts[company] = 1;
          }
        })
      })

      return counts;
    },
    countMediums () {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        result.ratings.forEach((rating) => {
          if (counts[rating.medium]) {
            counts[rating.medium]++;
          } else if (rating.medium) {
            counts[rating.medium] = 1;
          }
        })
      })

      return counts;
    },
    resultsAreFiltered () {
      return Boolean(this.value) || 
             this.activeFilters.length > 0 || 
             this.activeQuickLinkList !== 'title';
    },
    allActiveFilters() {
      // UNIFIED FILTERING: Combine input text and chips into single array
      // This is the bridge between old dual system and new unified approach
      const filters = [];
      
      // Add input text as a special "input" search filter if it exists
      if (this.debouncedSearchValue && this.debouncedSearchValue.trim()) {
        filters.push({
          id: '__input__',
          type: 'search',
          value: this.debouncedSearchValue.trim(),
          display: this.debouncedSearchValue.trim(),
          source: 'input'
        });
      }
      
      // Add all existing chips
      this.activeFilters.forEach(chip => {
        filters.push({
          ...chip,
          source: 'chip'
        });
      });
      
      return filters;
    },
    effectiveSearchTerm() {
      // Return the search term to use for "More from" and "Search TMDB" - either from input or from chips
      if (this.value && this.value.trim()) {
        return this.value.trim();
      }
      
      // Look for chips with priority: search > director > year > genre > company > tag
      const typePriority = ['search', 'director', 'year', 'genre', 'company', 'tag'];
      
      for (const type of typePriority) {
        const chipOfType = this.activeFilters.find(filter => filter.type === type);
        if (chipOfType) {
          return chipOfType.value;
        }
      }
      
      return '';
    },
    placeholder () {
      if (this.activeQuickLinkList === 'annual') {
        return "The best of each year";
      } else if (this.activeQuickLinkList === 'bestPicture') {
        return "The Best Picture winners";
      } else {
        return "Search...";
      }
    },
    listCountClasses () {
      const count = this.paginatedSortedResults.length;

      return {
        "count-is-1": count === 1,
        "count-is-2": count === 2,
        "count-is-3": count === 3,
        "count-is-4": count === 4,
        "count-more-than-4-remainder-0": count > 4 & count % 4 === 0,
        "count-more-than-4-remainder-1": count > 4 & count % 4 === 1,
        "count-more-than-4-remainder-2": count > 4 & count % 4 === 2,
        "count-more-than-4-remainder-3": count > 4 & count % 4 === 3
      }
    },
    userRatedMovieCount() {
      // Count the number of movies the user has rated (not TV shows)
      return this.allEntriesWithFlatKeywordsAdded.length;
    },
    suggestionsButtonLabel() {
      return this.userRatedMovieCount === 0
        ? 'Suggest some movies to rate'
        : 'Suggest more movies to rate';
    },
    columnsForUnratedMovies () {
      if (this.unratedMovies.length % 4 === 0) {
        return "col-3";
      } else {
        return "col-4";
      }
    },
    // Computed properties for filter modal
    topDirectors() {
      return Object.entries(this.allCounts.directors || {})
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    },
    topGenres() {
      return Object.entries(this.allCounts.genres || {})
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    },
    availableYears() {
      const years = this.allEntriesWithFlatKeywordsAdded
        .map(movie => new Date(this.topStructure(movie).release_date).getFullYear())
        .filter(year => !isNaN(year));
      return [...new Set(years)].sort((a, b) => b - a);
    },
    userTags() {
      return this.tags.slice(0, 20); // Limit to 20 most recent tags
    }
  },
  methods: {
    applyFilter(movie, result, filter) {
      // UNIFIED FILTERING: Apply a single filter to a movie
      // This consolidates all filtering logic from fuzzyFilter + activeFilters
      switch (filter.type) {
        case 'search':
          // Handle search filters (from input or search chips)
          const searchValue = filter.value.toLowerCase();
          return (movie.title && movie.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(searchValue)) ||
            (movie.flatKeywords && movie.flatKeywords.includes(searchValue)) ||
            (movie.genres && movie.genres.some((genre) => genre.name && genre.name.toLowerCase() === searchValue)) ||
            (movie.cast && movie.cast.flatMap((person) => {
              const names = person.name ? person.name.toLowerCase().split(' ') : [];
              return person.name ? [person.name.toLowerCase(), ...names] : [];
            }).some(name => name.includes(searchValue))) ||
            (movie.crew && movie.crew.flatMap((person) => {
              const names = person.name ? person.name.toLowerCase().split(' ') : [];
              return person.name ? [person.name.toLowerCase(), ...names] : [];
            }).some(name => name.includes(searchValue))) ||
            (movie.production_companies && movie.production_companies.some((company) => company.name && company.name.toLowerCase().includes(searchValue))) ||
            (this.getYearFiltersForSearch(filter.value).includes(movie.release_date ? movie.release_date.substring(0, 4) : ''));
        
        case 'director':
          return movie.crew && movie.crew.some(crew => 
            crew.job === 'Director' && crew.name === filter.value
          );
        
        case 'person':
          // Check both cast and crew for the person
          const inCast = movie.cast && movie.cast.some(cast => 
            cast.name === filter.value
          );
          const inCrew = movie.crew && movie.crew.some(crew => 
            crew.name === filter.value
          );
          return inCast || inCrew;
        
        case 'year':
          // Extract year directly from release_date string to avoid timezone issues
          const movieYear = movie.release_date ? movie.release_date.substring(0, 4) : '';
          return movieYear === filter.value;
        
        case 'genre':
          return movie.genres && movie.genres.some(genre => 
            genre.name === filter.value
          );
        
        case 'tag':
          return result.ratings && result.ratings.some(rating => 
            rating.tags && rating.tags.some(tag => tag.title === filter.value)
          );
        
        case 'company':
          return movie.production_companies && movie.production_companies.some(company => 
            company.name === filter.value
          );
        
        default:
          return true;
      }
    },
    getYearFiltersForSearch(searchValue) {
      // Extract year filtering logic from yearFilter computed property
      // This allows search filters to also handle year-based searches
      let parsedYears = [];
      
      if (searchValue.length === 2 && parseInt(searchValue) < new Date().getFullYear() - 2000) {
        parsedYears = [`20${searchValue}`];
      } else if (searchValue.length === 2) {
        parsedYears = [`19${searchValue}`];
      } else if (searchValue.includes("-") && searchValue.includes(" ")) {
        parsedYears = searchValue.split(" ").join("").split("-");
        for (let i = parseInt(parsedYears[0]) + 1; i < parseInt(parsedYears[1]); i++) {
          parsedYears.push(i.toString());
        }
      } else if (searchValue.includes("-")) {
        parsedYears = searchValue.split("-");
        for (let i = parseInt(parsedYears[0]) + 1; i < parseInt(parsedYears[1]); i++) {
          parsedYears.push(i.toString());
        }
      } else if (searchValue.length === 5 && searchValue.includes("s")) {
        parsedYears = searchValue.split("s").filter((x) => x);
        const decade = parseInt(parsedYears[0]);
        for (let i = decade; i < decade + 10; i++) {
          parsedYears.push(i.toString());
        }
      } else if (searchValue.length === 3 && searchValue.includes("s")) {
        parsedYears = searchValue.split("s").filter((x) => x);
        if (parseInt(searchValue) < new Date().getFullYear() - 2000) {
          const decade = parseInt(`20${parsedYears[0]}`);
          for (let i = decade; i < decade + 10; i++) {
            parsedYears.push(i.toString());
          }
        } else {
          const decade = parseInt(`19${parsedYears[0]}`);
          for (let i = decade; i < decade + 10; i++) {
            parsedYears.push(i.toString());
          }
        }
      } else if (searchValue.length === 4 && parseInt(searchValue)) {
        parsedYears = [searchValue];
      }
      
      return parsedYears;
    },
    toggleSettingsPanel () {
      this.showSettingsPanel = !this.showSettingsPanel;
    },
    getGridClassesForGroup (count) {
      return {
        "count-is-1": count === 1,
        "count-is-2": count === 2,
        "count-is-3": count === 3,
        "count-is-4": count === 4,
        "count-more-than-4-remainder-0": count > 4 & count % 4 === 0,
        "count-more-than-4-remainder-1": count > 4 & count % 4 === 1,
        "count-more-than-4-remainder-2": count > 4 & count % 4 === 2,
        "count-more-than-4-remainder-3": count > 4 & count % 4 === 3
      }
    },
    checkResultsAndFindFilter () {
      // Don't trigger random search until settings are loaded and we have a definitive value
      if (this.enableRandomSearch === null) {
        return; // Settings not loaded yet, wait
      }
      
      const allowRandomFromSetting = this.enableRandomSearch;
      const allowRandom = allowRandomFromSetting;
      const hasResults = this.paginatedSortedResults?.length > 0;
      const hasNotCalledFindFilter = !this.hasCalledFindFilter;

      if (allowRandom && hasResults && hasNotCalledFindFilter) {
        this.findRandomSearchValue();
        this.hasCalledFindFilter = true;
      }
    },
    findRandomSearchValue () {
      this.$router.push({ query: { ...this.$route.query, returnFromRating: undefined } });
      const countedLists = ["keyword", "genre", "year", "director", "cast/crew", "studios"];
      const randomList = countedLists[Math.floor(Math.random() * countedLists.length)];

      const minimumCount = 3;

      let counts;
      switch (randomList) {
        case "keyword":
          counts = this.countedKeywords;
          break;
        case "genre":
          counts = this.countedGenres;
          break;
        case "year":
          counts = this.countedYears;
          break;
        case "director":
          counts = this.countDirectors;
          break;
        case "cast/crew":
          counts = this.countCastCrew;
          break;
        case "studios":
          counts = this.countStudios;
          break;
      }

      const valuesFromRandomCountedList = Object.keys(counts || {});
      let randomValue;
      let safetyLimit = 100;

      do {
        const randomIndex = Math.floor(Math.random() * valuesFromRandomCountedList.length);
        randomValue = valuesFromRandomCountedList[randomIndex];
        safetyLimit--;
      } while (counts[randomValue] <= minimumCount && safetyLimit > 0);

      if (randomValue && safetyLimit > 0) {
        // Clear existing chips first, then add the random search
        this.clearAllFilters();
        this.updateSearchValue(randomValue, true); // Mark as auto random
        this.sortOrder = "bestOrNewestOnTop";
      } else {
        // If we couldn't find a value with minimum count, try with any count > 0
        const allValues = Object.keys(counts || {}).filter(key => counts[key] > 0);
        if (allValues.length > 0) {
          const randomIndex = Math.floor(Math.random() * allValues.length);
          const fallbackValue = allValues[randomIndex];
          this.clearAllFilters();
          this.updateSearchValue(fallbackValue, true);
          this.sortOrder = "bestOrNewestOnTop";
        } else {
          this.clearValue();
        }
      }
    },
    async wikiLinkFor (searchValue) {
      const wiki = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrnamespace=0&gsrlimit=5&gsrsearch=%27${searchValue}%27`);
      const pages = wiki.data.query.pages;
      const pagesArray = Object.keys(pages).map((page) => pages[page]);
      const bestMatch = minBy(pagesArray, (page) => page.index);

      return `https://en.m.wikipedia.org/w/index.php?curid=${bestMatch.pageid}`;
    },
    async goToWikipedia () {
      this.insetBrowserUrl = await this.wikiLinkFor(this.value);
      this.showInsetBrowserModal = true;
    },
    async goToWikipediaForChip () {
      if (this.activeFilters.length === 1) {
        const chip = this.activeFilters[0];
        this.insetBrowserUrl = await this.wikiLinkFor(chip.value);
        this.showInsetBrowserModal = true;
      }
    },
    showMovieInfo(movie) {
      this.selectedMovieInfo = movie;
      this.showMovieInfoModal = true;
      document.body.classList.add('no-scroll');
    },
    closeMovieInfoModal() {
      this.showMovieInfoModal = false;
      this.selectedMovieInfo = null;
      document.body.classList.remove('no-scroll');
    },
    clearValue () {
      this.inputValue = "";
      this.value = "";
    },
    async fetchLetterboxdData () {
      if (!this.$store.state.settings.letterboxdConnected || !this.$store.state.settings.letterboxdUsername) {
        return;
      }

      const username = this.$store.state.settings.letterboxdUsername;
      
      try {
        // Import the LetterboxdScrapingService dynamically
        const LetterboxdScrapingService = (await import('../services/LetterboxdScrapingService.js')).default;
        
        // Get user's Letterboxd data (this will use cache if available)
        this.letterboxdUserData = await LetterboxdScrapingService.getUserData(username);
        
      } catch (error) {
        console.error('Error fetching Letterboxd data:', error);
        this.letterboxdUserData = null;
      }
    },
    normalizeMovieTitle (title) {
      // Use the same normalization logic as LetterboxdScrapingService
      return title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    },
    updateSearchValue (value, isAutoRandom = false) {
      // If we have a value, clear existing filters first then add the new search
      if (value && value.trim()) {
        this.clearAllFilters();
        this.addSearchFilter(value, isAutoRandom);
      } else {
        this.value = value || "";
      }

      window.scroll({
        top: 0,
        left: 0,
        behavior: 'instant'
      });

      this.$refs.insightsAccordion?.classList.remove("show");
    },
    toggleQuickLinksSort () {
      if (this.quickLinksSortType === "a-z") {
        this.quickLinksSortType = "count";
      } else {
        this.quickLinksSortType = "a-z";
      }
    },
    toggleQuickLinksAccordion (event) {
      if (event.delegateTarget.classList.contains("collapsed")) {
        this.updateSearchValue(null);
        this.activeQuickLinkList = "title";
      }
    },
    toggleQuickLinksList (value) {
      if (this.activeQuickLinkList === value || !value) {
        this.activeQuickLinkList = "title";
        this.updateSearchValue("");
        this.$refs.QuickLinksAccordion?.classList.remove("show");
      } else if (this.tags?.includes(value)) {
        this.activeQuickLinkList = value;
        this.sortOrder = "bestOrNewestOnTop";

        this.updateSearchValue(value);
      } else {
        this.activeQuickLinkList = value;

        this.$refs.QuickLinksAccordion?.classList.add("show");
      }
    },
    toggleAnnualBestFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "annual") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "annual";
        this.$store.commit("setDBSortValue", "release");
      }
    },
    toggleBestPicturesFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "bestPicture") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "bestPicture";
        this.$store.commit("setDBSortValue", "release");
      }
    },
    toggleThisYearFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "thisYear") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "thisYear";
        this.$store.commit("setDBSortValue", "rating");
      }
    },
    toggleLastYearFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "lastYear") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "lastYear";
        this.$store.commit("setDBSortValue", "rating");
      }
    },
    toggleThisMonthFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "thisMonth") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "thisMonth";
        this.$store.commit("setDBSortValue", "rating");
      }
    },
    toggleLastMonthFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "lastMonth") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "lastMonth";
        this.$store.commit("setDBSortValue", "rating");
      }
    },
    async toggleNotOnLetterboxdFilter () {
      this.clearValue();

      if (this.activeQuickLinkList === "notOnLetterboxd") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "notOnLetterboxd";
        this.$store.commit("setDBSortValue", "rating");
        
        // Fetch Letterboxd data if we don't have it yet
        await this.fetchLetterboxdData();
      }
    },
    toggleSortOrder () {
      if (this.sortOrder === "bestOrNewestOnTop") {
        this.setSortOrder("worstOrOldestOnTop");
      } else {
        this.setSortOrder("bestOrNewestOnTop");
      }
    },
    setSortOrder (order) {
      this.sortOrder = order;
    },
    setSortValue (value) {
      this.sortValue = value;
    },
    setOrToggleSortValue (value) {
      if (this.sortValue === value) {
        this.toggleSortOrder();
      } else {
        this.setSortValue(value);
        this.setSortOrder("bestOrNewestOnTop");
      }
    },
    getSortValue (item, key) {
      if (key === "rating") {
        return this.mostRecentRating(item).calculatedTotal;
      } else if (key === "release") {
        return new Date(this.getYear(item), 0, 1);
      } else if (key === "title") {
        return this.topStructure(item).title;
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
    sortResults (a, b) {
      const sortValueA = this.getSortValue(a, this.sortValue || "rating");
      const sortValueB = this.getSortValue(b, this.sortValue || "rating");

      if (sortValueA === sortValueB) {
        const secondarySortValueA = this.mostRecentRating(a).calculatedTotal;
        const secondarySortValueB = this.mostRecentRating(b).calculatedTotal;

        if (secondarySortValueA < secondarySortValueB) {
          return this.sortOrder === "bestOrNewestOnTop" ? 1 : -1;
        }
        if (secondarySortValueA > secondarySortValueB) {
          return this.sortOrder === "bestOrNewestOnTop" ? -1 : 1;
        }
        return 0;
      }

      if (sortValueA < sortValueB) {
        return this.sortOrder === "bestOrNewestOnTop" ? 1 : -1;
      }
      if (sortValueA > sortValueB) {
        return this.sortOrder === "bestOrNewestOnTop" ? -1 : 1;
      }

      return 0;
    },
    toggleCountViewsAverage () {
      if (this.showAverage) {
        this.showAverage = false;
        this.showViewCount = true;
      } else if (this.showViewCount) {
        this.showAverage = false;
        this.showViewCount = false;
      } else {
        this.showAverage = true;
        this.showViewCount = false;
      }
    },
    averageRating (results) {
      if (!Array.isArray(results) || results.length === 0) return '0.00';
      const ratedMovies = results.filter((result) => this.mostRecentRating(result).calculatedTotal);
      if (ratedMovies.length === 0) return '0.00';
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
      const total = ratings.reduce((a, b) => a + b, 0);
      return (total / ratings.length).toFixed(2);
    },
    viewsCount (results) {
      if (!Array.isArray(results)) return 0;
      return results.reduce((total, result) => {
        return total + (Array.isArray(result.ratings) ? result.ratings.length : 0);
      }, 0);
    },
    getYear (media) {
      const date = media.movie.release_date;

      return new Date(date).getFullYear();
    },
    mostRecentRating (media) {
      if (!media || typeof media !== 'object') {
        return { calculatedTotal: null, date: null };
      }
      return getRating(media);
    },
    async searchTMDB () {
      console.error('1');
      if (!this.effectiveSearchTerm) {
        console.error('2');
        return;
      }
      console.error('3');
      const resp = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US&query=${this.effectiveSearchTerm}`);
      console.error('4');
      if (resp.data.results.length) {
        console.error('5');
        this.newEntrySearch(resp.data.results);

        window.scroll({
          top: 0,
          left: 0,
          behavior: 'instant'
        });
      } else {
        console.error('6');
        this.showNoResultsMessage();
      }
      console.error('7');
    },
    newEntrySearch (results) {
      this.$store.commit('setNewEntrySearchResults', results)

      this.$router.push(`/pick-media/${this.effectiveSearchTerm}`);
    },
    showNoResultsMessage () {
      this.noResults = true;

      setTimeout(() => {
        this.noResults = false;
      }, 30000); // Extended from 3 seconds to 30 seconds
    },
    startNewSearch () {
      // Clear current search state
      this.noResults = false;
      this.value = '';
      this.inputValue = '';
      this.activeFilters = [];
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Focus the search input after a short delay for smooth scrolling
      setTimeout(() => {
        if (this.$refs.searchInput) {
          this.$refs.searchInput.focus();
        }
      }, 500);
    },
    addMoreResults () {
      // Add movies in increments of 48 for stable grid layout
      this.numberOfResultsToShow = this.numberOfResultsToShow + 48;

      this.$nextTick(() => {
        window.scrollBy({
          top: 500,
          behavior: 'smooth'
        })
      });
    },
    async shareResults () {
      this.sharing = true;

      const shareObject = {
        results: this.sortedResults,
        sortOrder: this.sortOrder,
        sortValue: this.sortValue,
        value: this.value
      };

      const dbKey = `${new Date().getTime()}-${crypto.randomUUID()}`;

      const dbEntry = {
        path: `sharedDBSearches/${dbKey}`,
        value: shareObject
      }

      this.$store.dispatch('setDBValue', dbEntry);

      this.sharing = false;
      this.value = "";

      this.$nextTick(() => {
        this.$router.push(`/share/${this.$store.state.databaseTopKey}/${dbKey}`);
      });
    },
    topStructure (result) {
      return result.movie;
    },
    titleCase (input) {
      const string = input.toString();
      return string.replace(
        /\w\S*/g,
        function (txt) {
          return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
      );
    },
    focusOnSearchBar (event) {
      event.target.classList.add('font-size-increased');
      event.target.style.fontSize = '16px';

      // If user focuses input and we have an auto random chip, clear it
      if (this.hasAutoRandomChip) {
        requestAnimationFrame(() => {
          this.clearAllFilters();
          this.hasAutoRandomChip = false;
          // Clear the input value so user can start fresh
          event.target.value = '';
          this.inputValue = '';
          this.value = '';
          this.$store.commit('setDBSearchValue', '');
          // Ensure focus remains on the input
          event.target.focus();
        });
        return; // Don't select text since we're about to clear everything
      }

      // Select the text if there is any text in the input
      if (event.target.value) {
        event.target.select();
      }
    },
    blurSearchBar (event) {
      event.target.classList.remove('font-size-increased');
      event.target.style.fontSize = '12px';
    },
    handleTouchStart (event) {
      event.target.classList.add('touch-active');
    },
    handleTouchEnd (event) {
      event.target.classList.remove('touch-active');
    },
    goToInsights () {
      this.$router.push('/insights');
    },
    saveNormalizationTweak() {
      this.$store.dispatch('setDBValue', { path: 'settings/normalizationTweak', value: this.normalizationTweak });
    },
    saveTieBreakTweak() {
      this.$store.dispatch('setDBValue', { path: 'settings/tieBreakTweak', value: this.tieBreakTweak });
    },
    saveLetterboxdConnection() {
      this.$store.dispatch('setDBValue', { path: 'settings/letterboxdConnected', value: this.letterboxdConnected });
    },
    saveLetterboxdUsername() {
      this.$store.dispatch('setDBValue', { path: 'settings/letterboxdUsername', value: this.letterboxdUsername });
      // Auto-enable integration when username is provided
      if (this.letterboxdUsername && !this.letterboxdConnected) {
        this.letterboxdConnected = true;
        this.saveLetterboxdConnection();
      }
    },
    saveRandomSearchSetting() {
      this.$store.dispatch('setDBValue', { path: 'settings/enableRandomSearch', value: this.enableRandomSearch });
    },
    // Test function for Letterboxd URL generation (call from browser console)
    // Test function for Letterboxd scraping (UI button)
    async testLetterboxdScraping() {
      const username = this.letterboxdUsername || this.$store.state.settings.letterboxdUsername;
      
      if (!username) {
        this.scrapingTest.error = 'No Letterboxd username set';
        this.scrapingTest.success = false;
        this.scrapingTest.result = null;
        return;
      }
      
      this.scrapingTest.loading = true;
      this.scrapingTest.result = null;
      this.scrapingTest.error = null;
      
      try {
        // Import the scraping service dynamically
        const LetterboxdScrapingService = (await import('../services/LetterboxdScrapingService.js')).default;
        const result = await LetterboxdScrapingService.testScraping(username);
        
        this.scrapingTest.result = result;
        this.scrapingTest.success = result && result.films && result.films.length > 0;
        this.scrapingTest.loading = false;
        
        // Also log to console for debugging
        console.log('🎬 Letterboxd test results:', result);
        
      } catch (error) {
        console.error('❌ Letterboxd test failed:', error);
        this.scrapingTest.error = error.message || 'Test failed';
        this.scrapingTest.success = false;
        this.scrapingTest.loading = false;
      }
    },
    addLetterboxdOverride() {
      if (!this.newOverrideTitle || !this.newOverrideYear) return;
      
      // Create a unique key for this override (title + year)
      const overrideKey = `${this.newOverrideTitle.toLowerCase().replace(/[^a-z0-9]/g, '')}_${this.newOverrideYear}`;
      
      // Add to local state
      this.letterboxdOverrides[overrideKey] = {
        title: this.newOverrideTitle,
        year: this.newOverrideYear,
        addedAt: new Date().toISOString()
      };
      
      // Update the database
      this.$store.dispatch('setDBValue', {
        path: `settings/letterboxdOverrides`,
        value: this.letterboxdOverrides
      });
      
      // Clear the form
      this.newOverrideTitle = '';
      this.newOverrideYear = null;
    },
    removeLetterboxdOverride(overrideKey) {
      // Remove from local state
      delete this.letterboxdOverrides[overrideKey];
      
      // Update the database
      this.$store.dispatch('setDBValue', {
        path: `settings/letterboxdOverrides`,
        value: this.letterboxdOverrides
      });
    },
    // New multi-filter system methods
    getQuickLinkDisplayName(quickLinkKey) {
      const displayNames = {
        'annual': 'Annual Best',
        'bestPicture': 'Best Picture',
        'thisYear': 'This Year',
        'lastYear': 'Last Year',
        'thisMonth': 'This Month',
        'lastMonth': 'Last Month',
        'notOnLetterboxd': 'Not on Letterboxd'
      };
      return displayNames[quickLinkKey] || quickLinkKey;
    },
    clearQuickLink() {
      this.activeQuickLinkList = 'title';
    },
    removeFilter(filterId) {
      // Blur the search input first to prevent layout shifts from interfering with the click
      if (this.$refs.searchInput) {
        this.$refs.searchInput.blur();
      }
      
      this.activeFilters = this.activeFilters.filter(f => f.id !== filterId);
      
      // Update this.value based on remaining filters
      if (this.activeFilters.length === 0) {
        // No filters remain, clear search values
        this.inputValue = '';
        this.value = '';
        this.$store.commit('setDBSearchValue', '');
      } else {
        // Update this.value to match the remaining search filter (for backward compatibility)
        const relevantChips = this.activeFilters.filter(filter => 
          ['search', 'director', 'year', 'genre', 'company', 'tag'].includes(filter.type)
        );
        
        if (relevantChips.length > 0) {
          const latestChip = relevantChips[relevantChips.length - 1];
          this.value = latestChip.value;
          this.$store.commit('setDBSearchValue', latestChip.value);
        } else {
          // No search-type chips remain, clear value
          this.inputValue = '';
          this.value = '';
          this.$store.commit('setDBSearchValue', '');
        }
      }
    },
    addDirectorFilter(event) {
      const director = event.target.value;
      if (director) {
        this.activeFilters.push({
          id: `director-${Date.now()}`,
          type: 'director',
          value: director,
          display: `Director: ${director}`
        });
        this.hasAutoRandomChip = false; // Reset auto chip flag
        event.target.value = '';
        this.showAddFilterModal = false;
      }
    },
    addYearFilter(event) {
      const year = event.target.value;
      if (year) {
        this.activeFilters.push({
          id: `year-${Date.now()}`,
          type: 'year',
          value: year,
          display: `Year: ${year}`
        });
        this.hasAutoRandomChip = false; // Reset auto chip flag
        event.target.value = '';
        this.showAddFilterModal = false;
      }
    },
    addGenreFilter(event) {
      const genre = event.target.value;
      if (genre) {
        this.activeFilters.push({
          id: `genre-${Date.now()}`,
          type: 'genre',
          value: genre,
          display: `Genre: ${genre}`
        });
        this.hasAutoRandomChip = false; // Reset auto chip flag
        event.target.value = '';
        this.showAddFilterModal = false;
      }
    },
    addTagFilter(event) {
      const tag = event.target.value;
      if (tag) {
        this.activeFilters.push({
          id: `tag-${Date.now()}`,
          type: 'tag',
          value: tag,
          display: `Tag: ${tag}`
        });
        this.hasAutoRandomChip = false; // Reset auto chip flag
        event.target.value = '';
        this.showAddFilterModal = false;
      }
    },
    addCompanyFilter(event) {
      const company = event.target.value;
      if (company) {
        this.activeFilters.push({
          id: `company-${Date.now()}`,
          type: 'company',
          value: company,
          display: company
        });
        this.hasAutoRandomChip = false; // Reset auto chip flag
        event.target.value = '';
        this.showAddFilterModal = false;
      }
    },
    onInput(event) {
      const newVal = event.target.value;
      const oldVal = this.value;
      
      // Update both visual input and value immediately for instant filtering
      this.inputValue = newVal;
      this.value = newVal;
      this.$store.commit('setDBSearchValue', newVal);
      
      // Update search value immediately for instant filtering
      this.debouncedSearchValue = newVal;
      
      // Auto-chip conversion setup
      clearTimeout(this.searchToChipTimeout);
      if (newVal && newVal.trim() && newVal !== oldVal) {
        this.searchToChipTimeout = setTimeout(() => {
          this.convertSearchToChip();
        }, 2000); // Comfortable delay for users to finish typing
      }
    },
    convertSearchToChip() {
      // Use inputValue since this.value isn't updated on every keystroke anymore
      const currentSearch = this.inputValue || this.value;
      if (currentSearch && currentSearch.trim()) {
        const searchTerm = currentSearch.trim();
        
        // Add the chip immediately and clear the input
        this.addSearchFilter(searchTerm);
        
        // Clear visual input but keep this.value for "More from" and "Search TMDB" functionality
        this.inputValue = '';
        this.debouncedSearchValue = '';
        this.$store.commit('setDBSearchValue', '');
        
        // Clear and blur the input
        const inputElement = this.$refs.searchInput;
        if (inputElement) {
          inputElement.blur();
        } // Small delay to show the fade effect
        
        // Clear the timeout
        clearTimeout(this.searchToChipTimeout);
        this.searchToChipTimeout = null;
      }
    },
    addSearchFilter(searchTerm, isAutoRandom = false) {
      if (!searchTerm || !searchTerm.trim()) return;
      
      const trimmedTerm = searchTerm.trim();
      
      // Detect what type of filter this should be
      const filterType = this.detectFilterType(trimmedTerm);
      
      // Check if this exact filter already exists
      const existingFilter = this.activeFilters.find(filter => 
        filter.type === filterType.type && filter.value === filterType.value
      );
      
      if (existingFilter) {
        return; // Don't add duplicate
      }
      
      // Add the appropriate filter chip
      this.activeFilters.push({
        id: `${filterType.type}-${Date.now()}`,
        type: filterType.type,
        value: filterType.value,
        display: filterType.display
      });
      
      // Track if this chip was added by automatic random search
      this.hasAutoRandomChip = isAutoRandom;
    },
    clearAllFilters() {
      // Blur the search input first to prevent layout shifts
      if (this.$refs.searchInput) {
        this.$refs.searchInput.blur();
      }
      
      // Clear all active filters
      this.activeFilters = [];
      // Clear quick link filter
      this.activeQuickLinkList = 'title';
      // Clear search values
      this.inputValue = '';
      this.value = '';
      this.$store.commit('setDBSearchValue', '');
    },
    detectFilterType(term) {
      // Check if it's a 4-digit year
      if (/^\d{4}$/.test(term)) {
        const year = parseInt(term);
        if (year >= 1900 && year <= new Date().getFullYear() + 5) {
          return {
            type: 'year',
            value: term,
            display: term
          };
        }
      }
      
      // Check if it matches any director names in our database
      const allDirectors = this.allDirectors || [];
      const matchingDirector = allDirectors.find(director => 
        director.name && director.name === term
      );
      if (matchingDirector) {
        return {
          type: 'director',
          value: term,
          display: term
        };
      }
      
      // Check if it matches any genre names in our database
      const allGenres = this.allGenres || [];
      const matchingGenre = allGenres.find(genre => 
        genre.name && genre.name === term
      );
      if (matchingGenre) {
        return {
          type: 'genre',
          value: term,
          display: term
        };
      }
      
      // Default to search filter for everything else
      return {
        type: 'search',
        value: term,
        display: term
      };
    }, // Force reload
    debouncedFetchUnratedMoviesByValue(value, searchContext = null) {
      clearTimeout(this.unratedMoviesDebounceTimeout);
      this.unratedMoviesDebounceTimeout = setTimeout(() => {
        this.fetchUnratedMoviesByValue(value, searchContext);
      }, 800);
    },
    // Detection methods for different search types
    detectSearchType(value) {
      const trimmed = value.trim();
      
      // Year patterns
      if (/^\d{4}$/.test(trimmed)) {
        const year = parseInt(trimmed);
        if (year >= 1900 && year <= new Date().getFullYear() + 5) {
          return { type: 'year', value: year };
        }
      }
      
      // 2-digit year (e.g., "95" → 1995)
      if (/^\d{2}$/.test(trimmed)) {
        const shortYear = parseInt(trimmed);
        const currentYear = new Date().getFullYear();
        const currentCentury = Math.floor(currentYear / 100) * 100;
        const fullYear = shortYear <= (currentYear % 100) + 10 ? currentCentury + shortYear : currentCentury - 100 + shortYear;
        return { type: 'year', value: fullYear };
      }
      
      // Year range (e.g., "1990-1995")
      const rangeMatch = trimmed.match(/^(\d{4})-(\d{4})$/);
      if (rangeMatch) {
        const startYear = parseInt(rangeMatch[1]);
        const endYear = parseInt(rangeMatch[2]);
        if (startYear >= 1900 && endYear <= new Date().getFullYear() + 5 && startYear <= endYear) {
          return { type: 'yearRange', startYear, endYear };
        }
      }
      
      // Decade patterns (e.g., "90s", "1990s")
      const decadeMatch = trimmed.match(/^(\d{2,4})s$/i);
      if (decadeMatch) {
        let decade = parseInt(decadeMatch[1]);
        if (decade < 100) {
          // Convert 2-digit to 4-digit (e.g., "90" → "1990")
          const currentYear = new Date().getFullYear();
          const currentCentury = Math.floor(currentYear / 100) * 100;
          decade = decade <= (currentYear % 100) + 10 ? currentCentury + decade : currentCentury - 100 + decade;
        }
        decade = Math.floor(decade / 10) * 10; // Round down to decade
        return { type: 'yearRange', startYear: decade, endYear: decade + 9 };
      }
      
      // Common genre patterns
      const commonGenres = {
        'action': 28, 'adventure': 12, 'animation': 16, 'comedy': 35, 
        'crime': 80, 'documentary': 99, 'drama': 18, 'family': 10751,
        'fantasy': 14, 'history': 36, 'horror': 27, 'music': 10402,
        'mystery': 9648, 'romance': 10749, 'sci-fi': 878, 'science fiction': 878,
        'thriller': 53, 'war': 10752, 'western': 37
      };
      
      const lowerValue = trimmed.toLowerCase();
      if (commonGenres[lowerValue]) {
        return { type: 'genre', genreId: commonGenres[lowerValue], value: trimmed };
      }
      
      // Check if search term matches a known production company
      const matchingCompany = this.findMatchingProductionCompany(lowerValue);
      if (matchingCompany) {
        return { type: 'company', companyName: matchingCompany.name, value: trimmed };
      }
      
      // For everything else, try both person and keyword search
      return { type: 'general', value: trimmed };
    },
    findMatchingProductionCompany(searchTerm) {
      // Get all production companies from existing movies
      const allCompanies = [];
      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const companies = this.topStructure(result).production_companies || [];
        companies.forEach(company => {
          if (company.name && !allCompanies.find(c => c.id === company.id)) {
            allCompanies.push(company);
          }
        });
      });
      
      // Find company by exact name match (case insensitive)
      const exactMatch = allCompanies.find(company => 
        company.name.toLowerCase() === searchTerm
      );
      if (exactMatch) return exactMatch;
      
      // Find company by partial name match (case insensitive)
      const partialMatch = allCompanies.find(company => 
        company.name.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(company.name.toLowerCase())
      );
      return partialMatch;
    },
    async fetchUnratedMoviesByYear(year) {
      // Fetch multiple pages to get more variety
      const allResults = [];
      
      for (let page = 1; page <= 3; page++) { // Get first 3 pages (60 movies)
        const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
          params: {
            api_key: process.env.VUE_APP_TMDB_API_KEY,
            language: 'en-US',
            primary_release_year: year,
            sort_by: 'popularity.desc',
            page: page,
            'vote_count.gte': 25, // Further lowered to include more movies
            include_adult: false, // Explicitly exclude adult content
          }
        });
        
        if (response.data.results) {
          allResults.push(...response.data.results);
        }
        
        // Stop if we've reached the end
        if (page >= response.data.total_pages) break;
      }
      return allResults;
    },
    async fetchUnratedMoviesByYearRange(startYear, endYear) {
      const allResults = [];
      
      for (let page = 1; page <= 2; page++) { // Get first 2 pages (40 movies) for ranges
        const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
          params: {
            api_key: process.env.VUE_APP_TMDB_API_KEY,
            language: 'en-US',
            'primary_release_date.gte': `${startYear}-01-01`,
            'primary_release_date.lte': `${endYear}-12-31`,
            sort_by: 'popularity.desc',
            page: page,
            'vote_count.gte': 25,
            include_adult: false, // Explicitly exclude adult content
          }
        });
        
        if (response.data.results) {
          allResults.push(...response.data.results);
        }
        
        // Stop if we've reached the end
        if (page >= response.data.total_pages) break;
      }
      
      return allResults;
    },
    async fetchUnratedMoviesByGenre(genreId) {
      const allResults = [];
      
      // Filter out movies newer than 2 years to avoid current buzz
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - 2);
      const maxDateString = maxDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      for (let page = 1; page <= 3; page++) { // Get first 3 pages (60 movies)
        const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
          params: {
            api_key: process.env.VUE_APP_TMDB_API_KEY,
            language: 'en-US',
            with_genres: genreId,
            sort_by: 'popularity.desc',
            page: page,
            'vote_count.gte': 50, // Increased vote threshold for better quality
            'primary_release_date.lte': maxDateString, // No movies newer than 2 years
            include_adult: false, // Explicitly exclude adult content
          }
        });
        
        if (response.data.results) {
          allResults.push(...response.data.results);
        }
        
        // Stop if we've reached the end
        if (page >= response.data.total_pages) break;
      }
      
      return allResults;
    },
    async fetchUnratedMoviesByDirector(directorName) {
      try {
        // First, search for the person (director)
        const personResp = await axios.get('https://api.themoviedb.org/3/search/person', {
          params: {
            api_key: process.env.VUE_APP_TMDB_API_KEY,
            language: 'en-US',
            query: directorName,
          }
        });
        
        if (!personResp.data.results || personResp.data.results.length === 0) {
          return [];
        }

        // Take the first (most relevant) person result
        const person = personResp.data.results[0];
        
        // Get their movie credits
        const creditsResp = await axios.get(`https://api.themoviedb.org/3/person/${person.id}/movie_credits`, {
          params: {
            api_key: process.env.VUE_APP_TMDB_API_KEY,
            language: 'en-US',
          }
        });
        
        // Filter for directing credits only
        const directorCredits = (creditsResp.data.crew || []).filter(credit => {
          const job = (credit.job || '').toLowerCase();
          const relevantJobs = ['director', 'co-director'];
          return relevantJobs.includes(job);
        });
        
        return directorCredits;
        
      } catch (error) {
        console.error('Error fetching movies by director:', error);
        return [];
      }
    },
    async fetchUnratedMoviesByKeyword(keyword) {
      // Filter out movies newer than 6 months to avoid current buzz, but be more lenient
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() - 6);
      const maxYear = maxDate.getFullYear();
      
      // First try movie search
      const movieSearchResp = await axios.get('https://api.themoviedb.org/3/search/movie', {
        params: {
          api_key: process.env.VUE_APP_TMDB_API_KEY,
          language: 'en-US',
          query: keyword,
          page: 1,
          include_adult: false, // Explicitly exclude adult content
        }
      });
      
      let allResults = (movieSearchResp.data.results || []).filter(movie => {
        const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 0;
        // More lenient filtering: allow more recent movies and lower vote counts for niche keywords
        return releaseYear <= maxYear + 1 && movie.vote_count >= 10; // Relaxed criteria
      });
      
      // If we don't get enough results, try keyword search
      if (allResults.length < 10) {
        try {
          const keywordSearchResp = await axios.get('https://api.themoviedb.org/3/search/keyword', {
            params: {
              api_key: process.env.VUE_APP_TMDB_API_KEY,
              language: 'en-US',
              query: keyword,
            }
          });
          
          if (keywordSearchResp.data.results && keywordSearchResp.data.results.length > 0) {
            const keywordId = keywordSearchResp.data.results[0].id;
            
            // Get movies with this keyword, filtered by age
            const maxDateString = maxDate.toISOString().split('T')[0]; // YYYY-MM-DD format
            const keywordMoviesResp = await axios.get('https://api.themoviedb.org/3/discover/movie', {
              params: {
                api_key: process.env.VUE_APP_TMDB_API_KEY,
                language: 'en-US',
                with_keywords: keywordId,
                sort_by: 'popularity.desc',
                page: 1,
                'vote_count.gte': 20, // Lower threshold for keyword searches
                'primary_release_date.lte': maxDateString, // No movies newer than 6 months
                include_adult: false, // Explicitly exclude adult content
              }
            });
            
            const keywordResults = keywordMoviesResp.data.results || [];
            // Merge results, prioritizing direct movie search results
            allResults = [...allResults, ...keywordResults];
          }
        } catch (keywordError) {
          console.log('Keyword search failed, using movie search results only:', keywordError);
        }
      }
      
      return allResults;
    },
    async fetchUnratedMoviesByCompany(companyName) {
      try {
        // First, search for the company to get its ID
        const companySearchResp = await axios.get('https://api.themoviedb.org/3/search/company', {
          params: {
            api_key: process.env.VUE_APP_TMDB_API_KEY,
            query: companyName,
          }
        });
        
        if (!companySearchResp.data.results || companySearchResp.data.results.length === 0) {
          return [];
        }
        
        const companyId = companySearchResp.data.results[0].id;
        
        // Use discover API to find movies by this production company
        const allResults = [];
        const maxPages = 3; // Fetch multiple pages for variety
        
        for (let page = 1; page <= maxPages; page++) {
          const discoverResp = await axios.get('https://api.themoviedb.org/3/discover/movie', {
            params: {
              api_key: process.env.VUE_APP_TMDB_API_KEY,
              language: 'en-US',
              with_companies: companyId,
              'primary_release_date.lte': new Date().toISOString().split('T')[0], // Only released movies
              sort_by: 'popularity.desc',
              page: page,
              include_adult: false,
              'vote_count.gte': 20, // Minimum vote threshold
            }
          });
          
          if (discoverResp.data.results) {
            allResults.push(...discoverResp.data.results);
          }
          
          // If we got fewer results than expected, no point in fetching more pages
          if (!discoverResp.data.results || discoverResp.data.results.length < 20) {
            break;
          }
        }
        
        return allResults;
      } catch (error) {
        console.error('Error fetching movies by company:', error);
        return [];
      }
    },
    async fetchUnratedMoviesByValue(value, searchContext = null) {
      this.unratedMoviesLoading = true;
      this.unratedMoviesError = null;
      this.unratedMovies = [];
      
      try {
        // Use provided search context or detect automatically
        let searchInfo;
        if (searchContext) {
          // Use the context from the chip
          searchInfo = searchContext;
        } else {
          // Detect what type of search this is
          searchInfo = this.detectSearchType(value);
        }
        // Map chip types to display types for "More from" section
        if (searchInfo.type === 'director') {
          this.unratedMoviesSearchType = 'person';
        } else {
          this.unratedMoviesSearchType = searchInfo.type;
        }
        
        let relevantList = [];
        
        if (searchInfo.type === 'year') {
          // Fetch movies from specific year
          relevantList = await this.fetchUnratedMoviesByYear(searchInfo.value);
        } else if (searchInfo.type === 'yearRange') {
          // Fetch movies from year range
          relevantList = await this.fetchUnratedMoviesByYearRange(searchInfo.startYear, searchInfo.endYear);
        } else if (searchInfo.type === 'genre') {
          // Fetch movies from specific genre
          relevantList = await this.fetchUnratedMoviesByGenre(searchInfo.genreId);
        } else if (searchInfo.type === 'company') {
          // Fetch movies from specific production company
          relevantList = await this.fetchUnratedMoviesByCompany(searchInfo.companyName);
        } else if (searchInfo.type === 'director') {
          // Fetch movies from specific director
          relevantList = await this.fetchUnratedMoviesByDirector(searchInfo.value);
        } else if (searchInfo.type === 'general') {
          // Try keyword/general search first
          relevantList = await this.fetchUnratedMoviesByKeyword(searchInfo.value);
          
          // If keyword search didn't yield good results, fall back to person search
          if (relevantList.length < 5) {
            try {
              const personResp = await axios.get('https://api.themoviedb.org/3/search/person', {
                params: {
                  api_key: process.env.VUE_APP_TMDB_API_KEY,
                  language: 'en-US',
                  query: searchInfo.value,
                }
              });

              if (personResp.data.results && personResp.data.results.length <= 3 && personResp.data.results.length > 0) {
                const person = personResp.data.results[0];
                const creditsResp = await axios.get(`https://api.themoviedb.org/3/person/${person.id}/movie_credits`, {
                  params: {
                    api_key: process.env.VUE_APP_TMDB_API_KEY,
                    language: 'en-US',
                  }
                });
                
                // Use person search logic
                const department = (person.known_for_department || '').toLowerCase();
                let personRelevantList = [];
                
                if (department === 'acting') {
                  personRelevantList = creditsResp.data.cast || [];
                } else if (department === 'directing') {
                  personRelevantList = (creditsResp.data.crew || []).filter(c => c.department && c.department.toLowerCase() === 'directing');
                  const relevantJobs = ['director', 'co-director', 'second unit director', 'assistant director'];
                  personRelevantList = personRelevantList.filter(c => relevantJobs.includes((c.job || '').toLowerCase()));
                } else {
                  // fallback: show all movies from both cast and crew
                  personRelevantList = [
                    ...(creditsResp.data.cast || []),
                    ...(creditsResp.data.crew || [])
                  ];
                }
                
                // Merge person results with keyword results, giving priority to keyword results
                relevantList = [...relevantList, ...personRelevantList];
                // Only update search type if we found significant person results and no keyword results
                if (relevantList.length < 5 && personRelevantList.length > 0) {
                  this.unratedMoviesSearchType = 'person'; // Update search type for display
                }
              }
            } catch (personError) {
              console.log('Person search fallback failed:', personError);
            }
          }
        } else {
          // This shouldn't happen with our current logic, but keep as fallback
          relevantList = [];
        }
        
        // Filter out already rated movies and remove duplicates
        const ratedIds = new Set(this.allEntriesWithFlatKeywordsAdded.map(r => this.topStructure(r).id));
        const seenIds = new Set();
        const unrated = [];
        
        for (const m of relevantList) {
          if (!ratedIds.has(m.id) && !seenIds.has(m.id)) {
            unrated.push(m);
            seenIds.add(m.id);
          }
        }
        
        // Sort by popularity and apply filtering
        if (unrated.length > 0) {
          unrated.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
          
          const popularities = unrated.map(m => m.popularity).filter(p => typeof p === 'number');
          if (popularities.length > 0) {
            const max = Math.max(...popularities);
            const min = Math.min(...popularities);
            
            // Use more lenient filtering for different search types
            let cutoffPercentage;
            if (this.unratedMoviesSearchType === 'year' || this.unratedMoviesSearchType === 'yearRange') {
              cutoffPercentage = 0.2; // Keep movies in top 80% for year searches
            } else if (this.unratedMoviesSearchType === 'genre') {
              cutoffPercentage = 0.3; // Keep movies in top 70% for genre searches
            } else if (this.unratedMoviesSearchType === 'general') {
              cutoffPercentage = 0.4; // Keep movies in top 60% for keyword searches
            } else {
              cutoffPercentage = 0.6; // Keep original strict filtering for person searches
            }
            
            const cutoff = min + (max - min) * cutoffPercentage;
            let filtered = unrated.filter(m => m.popularity >= cutoff);
            
            // Show more movies for different search types
            let targetCount;
            if (this.unratedMoviesSearchType === 'year' || this.unratedMoviesSearchType === 'yearRange') {
              targetCount = 18;
            } else if (this.unratedMoviesSearchType === 'genre') {
              targetCount = 15;
            } else if (this.unratedMoviesSearchType === 'general') {
              targetCount = 12;
            } else {
              targetCount = 12; // Default for person searches
            }
            
            if (filtered.length < targetCount && unrated.length > targetCount) {
              filtered = unrated.slice(0, targetCount);
            }
            
            this.unratedMovies = filtered;
          } else {
            this.unratedMovies = unrated.slice(0, 12);
          }
        } else {
          this.unratedMovies = [];
        }
        
      } catch (err) {
        console.error('Error fetching unrated movies:', err);
        this.unratedMoviesError = 'Error fetching from TMDB.';
      } finally {
        this.unratedMoviesLoading = false;
      }
    },
  },
}
</script>

<style lang="scss">
  .home {
    max-width: 832px;

    .search-bar {
      max-width: 416px;

      input#search {
        border-bottom-right-radius: .375rem;
        border-top-right-radius: .375rem;

        &.has-content {
          padding-left: 36px;
          padding-right: 36px;
        }

        &.font-size-increased {
          margin: -6px 0 0;

          & + .clear-button {
            transform: translateY(calc(-50% - 3px));
          }

        }
      }

      .clear-button {
        align-items: center;
        color: black;
        cursor: pointer;
        display: flex;
        height: 60px;
        justify-content: center;
        right: 0px;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        z-index: 5;
        overflow: hidden;
      }

      .clear-button::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 200%;
        height: 200%;
        background-color: rgba(0, 0, 0, 0.1);
        transform: translate(-50%, -50%) scale(0);
        transition: transform 0.5s ease-out;
        border-radius: 50%;
      }

      .clear-button:active::before {
        transform: translate(-50%, -50%) scale(1);
      }

      .clear-button:hover,
      .clear-button:focus,
      .clear-button.touch-active {
        background-color: rgba(0, 0, 0, 0.1);
        height: 30px;
      }

      .search-to-chip-button {
        align-items: center;
        color: black;
        cursor: pointer;
        display: flex;
        height: 40px;
        justify-content: center;
        right: 40px; /* Position between clear and edge */
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        z-index: 5;
        opacity: 0.6;
        transition: opacity 0.2s ease;
      }

      .search-to-chip-button:hover {
        opacity: 1;
        background-color: rgba(0, 0, 0, 0.1);
      }

      svg {
        height: 18px;
        width: 18px;
      }
    }

    .results {
      .results-count {
        font-size: 1rem;
      }

      .results-actions {
        .dropdown-item {
          &.active,
          &:active {
            color: #1e2125;
            background-color: #e9ecef;
          }
        }

        .dropdown-toggle {
          position: relative;

          &::after {
            display: none;
          }

          > i {
            margin-right: 6px;
          }

          .order-arrow {
            position: absolute;
            right: 7px;
            top: 49%;
            transform: translateY(-49%);
          }
        }

        button {
          svg {
            height: 14px;
            width: 14px;
          }

          border: none;

          &.results-actions-button {
            &:nth-child(1) {
              background-color: #E71D36; /* Red */
              color: white;
            }

            &:nth-child(2) {
              background-color: #FF9F1C; /* Orange */
              color: black;
            }

            &:nth-child(3) {
              background-color: #FFD700; /* Yellow */
              color: black;
            }

            &:nth-child(4) {
              background-color: #24d776; /* Green */
              color: black;
            }

            &:nth-child(5) {
              background-color: #1D8BF1; /* Blue */
              color: black;
            }

            &:nth-child(6) {
              background-color: #5A189A; /* Indigo */
              color: white;
            }

            &:nth-child(7) {
              background-color: #cd7fe8; /* Violet */
              color: white;
            }

            &:nth-child(8) {
              background-color: #00FFFF; /* Cyan */
              color: white;
            }
          }
        }

        .filtered-count-display {
          .average-label {
            font-size: 0.5rem;
            position: absolute;
            bottom: 4px;
            left: 50%;
            transform: translateX(-50%);
          }

          .average-value {
            position: relative;
            top: -4px;
          }
        }

        .quick-link-types {
          row-gap: 6px;

          span {
            cursor: pointer;
            font-size: 0.75rem;
          }

          hr {
            margin: 14px 0 10px;
          }

          .tags-quicklinks {
            position: relative;

            p {
              background: #212529;
              cursor: pointer;
              font-size: 0.75rem;
              padding: 0 10px 0 7px;
              position: absolute;
              right: 0;
              top: -22px;

              &[aria-expanded="true"] {
                .bi-caret-right-fill::before {
                  transform: rotate(90deg);
                }
              }

              .bi-caret-right-fill::before {
                transition: transform .5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
              }
            }
          }

          .quick-links-list-wrapper {
            border: 1px solid #c0c2c3;
            max-height: 150px;
            overflow-y: scroll;
            position: relative;

            .quick-links-list-sort {
              position: sticky;
              top: 4px;
              left: 100%;
              border: 1px solid #c0c2c3;
              border-bottom-left-radius: 2px;
              padding: 2px 4px;
              background: white;
              font-size: 0.65rem;
              margin: 4px 8px;
            }

            .quick-link-list {
              column-count: 2;
              column-gap: 0;
              list-style: none;
              margin-top: -20px;

              li {
                .badge {
                  align-items: center;
                  cursor: pointer;
                  display: flex;
                  text-align: start;
                  white-space: break-spaces;

                  span {
                    font-size: 0.5rem;
                  }
                }
              }
            }
          }
        }
      }

      ul {
        list-style: none;
        width: 100%;
        padding: 0;
        margin: 0;

        &.grid-layout {
          display: grid;
          grid-gap: 0;

          li {
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);

            &.highlight {
              border: 2px solid #54b448;
              transform: scale(1.2);
              z-index: 1;
            }


            img {
              width: 100%;
              height: auto;
              object-fit: cover;
            }
          }

          &.count-is-1 {
            grid-template-columns: repeat(4, 1fr);

            li {
              grid-column: span 4;
              grid-row: span 2;

              @media screen and (min-width: 832px) {
                grid-column: 2 / span 2;
                grid-row: span 2;
              }
            }
          }

          &.count-is-2 {
            grid-template-columns: repeat(4, 1fr);

            li {
              grid-column: span 2;
              grid-row: span 2;
            }
          }

          &.count-is-3 {
            grid-template-columns: repeat(4, 1fr);

            @media screen and (min-width: 832px) {
              grid-template-columns: repeat(3, 1fr);
            }

            li {
              &:first-child {
                grid-column: span 4;
                grid-row: span 2;
              }

              &:nth-child(n+1) {
                grid-column-end: span 2;
              }

              @media screen and (min-width: 832px) {
                /* Override the first-child settings for larger screens */
                &:first-child {
                  grid-column: span 1; /* Corrected to span only 1 column */
                }
                /* Ensure each li takes up 1/3 of the width */
                &:nth-child(n+1) {
                  grid-column-end: span 1;
                }
              }
            }
          }

          &.count-is-4 {
            grid-template-columns: repeat(12, 1fr);

            li {
              &:first-child {
                grid-column: span 12;
                grid-row: span 12;
              }

              &:nth-child(2),
              &:nth-child(3),
              &:nth-child(4) {
                grid-column: span 4;
                grid-row: span 4;
              }

              @media screen and (min-width: 832px) {
                &:first-child,
                &:nth-child(2),
                &:nth-child(3),
                &:nth-child(4) {
                  grid-column: span 3;
                  grid-row: span 4;
                }
              }
            }
          }

          &.count-more-than-4-remainder-0 {
            grid-template-columns: repeat(12, 1fr);

            li {
              &:first-child {
                grid-column: span 12;
                grid-row: span 12;
              }

              &:nth-child(2),
              &:nth-child(3),
              &:nth-child(4) {
                grid-column: span 4;
                grid-row: span 4;
              }

              &:nth-child(n+5) {
                grid-column: span 3;
              }

              @media screen and (min-width: 832px) {
                &:first-child,
                &:nth-child(2),
                &:nth-child(3),
                &:nth-child(4),
                &:nth-child(n+5) {
                  grid-column: span 3;
                  grid-row: span 4;
                }
              }
            }
          }

          &.count-more-than-4-remainder-1 {
            grid-template-columns: repeat(4, 1fr);

            li {
              &:first-child {
                grid-column: span 2;
                grid-row: span 2;
              }

              &:nth-child(n+2) {
                grid-column: span 1;
                grid-row: span 1;
              }
            }
          }

          &.count-more-than-4-remainder-2 {
            grid-template-columns: repeat(4, 1fr);

            li {
              &:first-child {
                grid-column: span 2;
                grid-row: span  2;
              }

              &:nth-child(2) {
                grid-column: span 2;
                grid-row: span 2;
              }

              &:nth-child(n+2) {
                grid-column-end: span 1;
              }
            }
          }

          &.count-more-than-4-remainder-3 {
            grid-template-columns: repeat(4, 1fr);

            @media screen and (min-width: 832px) {
              grid-template-columns: repeat(12, 1fr);
            }

            li {
              &:first-child {
                grid-column: span 4;
                grid-row: span 4;
              }

              &:nth-child(2),
              &:nth-child(3) {
                grid-column: span 2;
                grid-row: span 2;
              }

              &:nth-child(n+4) {
                grid-column: span 1;
                grid-row: span 2;
              }

              @media screen and (min-width: 832px) {
                &:first-child,
                &:nth-child(2),
                &:nth-child(3) {
                  grid-column: span 4;
                  grid-row: span 2;
                }

                &:nth-child(n+4) {
                  grid-column: span 3;
                  grid-row: span 2;
                }
              }
            }
          }

          .cinemaroll-modal-content {
            max-height: 97vh !important;
          }
        }
      }
    }

    .unrated-movies-grid {
      border-top: 1px solid white;
      padding: 16px 0 50px;
      position: relative;

      h3 {
        font-size: 1rem;
        left: 50%;
        padding: 0 16px;
        position: absolute;
        top: 0;
        transform: translate(-50%, -50%);
        white-space: nowrap;
      }
    }

    .loading-screen {
      height: 75vh;
    }

    .btn {
      .spinner-border {
        height: 18px;
        width: 18px;
      }
    }

    .new-rating {
      a {
        cursor: pointer;
      }
    }

    .settings-panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.3);
      z-index: 2000;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
    }
    .settings-panel {
      width: 320px;
      max-width: 90vw;
      background: var(--bs-light, #fff);
      box-shadow: 0 2px 16px rgba(0,0,0,0.15);
      border-radius: 8px;
      margin: 2rem 2rem 0 0;
      animation: slideInRight 0.2s;
    }
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  }

  .bg-dark {
    .home {
      color: white;

      ul {
        .media-result {
          border-color: white;
        }
      }
    }
  }

  .settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 320px;
  height: 100vh;
  background: var(--bs-light, #fff);
  box-shadow: -2px 0 8px rgba(0,0,0,0.15);
  z-index: 2000;
  padding: 1.5rem 1.25rem 1.25rem 1.25rem;
  transition: transform 0.3s cubic-bezier(.4,0,.2,1);
}
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s cubic-bezier(.4,0,.2,1);
}
.slide-enter, .slide-leave-to {
  transform: translateX(100%);
}

.role-section {
  border-top: 1px solid white;
  padding: 16px 0 0;
  position: relative;

  h6 {
    font-size: 0.75rem;
    right: 12px;
    padding: 0 12px;
    position: absolute;
    top: -2px;
    transform: translateY(-50%);
    white-space: nowrap;
  }
}
</style>

<style scoped>
.settings-panel-inline {
  background: var(--bs-light, #fff);
  border: 1px solid var(--bs-border-color, #dee2e6);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  max-width: 600px;
  margin: 0 auto 1.5rem auto;
  color: var(--bs-body-color, #212529);
}
.settings-panel-inline.dark {
  background: #23272b !important;
  border-color: #343a40 !important;
  color: #f8f9fa !important;
}
.settings-panel-inline.dark .form-check-label,
.settings-panel-inline.dark h5,
.settings-panel-inline.dark .settings-panel-header,
.settings-panel-inline.dark .settings-panel-body {
  color: #f8f9fa !important;
}
.settings-panel-inline.dark .form-check-input:checked {
  background-color: #0d6efd;
  border-color: #0d6efd;
}
.settings-panel-inline.dark .form-range {
  background-color: #343a40;
}
.settings-panel-inline .form-range {
  accent-color: #0d6efd;
}

/* Chip Close Button Styles */
.badge .btn-close {
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.badge .btn-close:hover {
  opacity: 1;
}

.badge .btn-close:focus {
  outline: none;
  box-shadow: none;
}

/* Filter Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1050;
}

.modal-content {
  background: #212529;
  color: white;
  border-radius: 8px;
  max-width: 90%;
  width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  padding: 0.5rem 1rem 0 1rem;
  border-bottom: none;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  position: relative;
}

.modal-header h5 {
  margin: 0;
  flex-grow: 1;
}

.modal-body {
  padding: 1rem;
}


/* Movie Info Modal Specific Styles */
.movie-info-modal {
  max-width: 90%;
  width: 500px;
}

.movie-info-content {
  display: flex;
  gap: 1rem;
  flex-direction: column;
}

@media (min-width: 576px) {
  .movie-info-content {
    flex-direction: row;
  }
}

.movie-poster-section {
  flex-shrink: 0;
  text-align: center;
}

.movie-poster {
  max-width: 150px;
  width: 100%;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.movie-details-section {
  flex: 1;
}

.movie-title {
  margin-bottom: 0.75rem;
  color: #f8f9fa;
  font-weight: 600;
}

.movie-year,
.movie-genres,
.movie-overview,
.movie-rating {
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.movie-overview {
  margin-bottom: 0.75rem;
}

.filter-section {
  margin-bottom: 1rem;
}

/* Active Filter Chips */
.active-filters-section {
  max-width: 600px;
}

.active-filters-section .badge {
  font-size: 0.75rem;
  padding: 0.375rem 0.5rem;
  margin-right: 0.25rem;
  margin-bottom: 0.25rem;
}

.active-filters-section .btn-close {
  width: 0.75rem;
  height: 0.75rem;
  margin-left: 0.25rem;
}

/* Chip Animation Transitions */
.chip-fade-enter-active,
.chip-fade-leave-active {
  transition: all 0.3s ease;
}

.chip-fade-enter-from {
  opacity: 0;
  transform: scale(0.8) translateY(-10px);
}

.chip-fade-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(-10px);
}

.chip-fade-move {
  transition: transform 0.3s ease;
}

.chip-transition {
  transition: all 0.2s ease;
}

/* Unrated Movie Posters */
.unrated-movie-card {
  cursor: pointer;
}

.unrated-movie-poster {
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.unrated-movie-poster:hover {
  opacity: 0.8;
}
</style>
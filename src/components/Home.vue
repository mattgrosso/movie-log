<template>
  <div class="home p-3 pt-4 mx-auto">

    <div v-if="$store.state.dbLoaded" class="search-bar mx-auto">
      <div class="input-group mb-1 col-12 md-col-6">
        <input
          class="form-control"
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
      <!-- Typo-tolerant "Did you mean...?" fallback from the user's own rated
           data. As many ranked suggestions as fit on one line (see
           didYouMeanFitCount/updateDidYouMeanFitCount) - a full row of chips
           between the search bar and the new-rating-suggestion UI was too
           prominent given how much more often a search is a genuinely new
           (unrated) movie than a typo, but a single link under-used the
           space once it was cut down to that. The CSS ellipsis is the real
           guarantee against overflow; the fit-count just decides how many
           terms to attempt. -->
      <p v-if="didYouMeanLineSuggestions.length" class="did-you-mean-inline mb-1">Did you mean?: <template v-for="(suggestion, index) in didYouMeanLineSuggestions" :key="`${suggestion.typeLabel}-${suggestion.value}`"><a href="#" class="did-you-mean-link" @click.prevent="applyDidYouMeanSuggestion(suggestion)">{{ suggestion.value }}</a><span v-if="index < didYouMeanLineSuggestions.length - 1">, </span></template></p>
    </div>

    <!-- Movies rated offline that still need to be matched to a real TMDB
         movie (see AddRating.js/ReconcilePlaceholder.vue). Only actionable
         once online, since reconciliation needs a TMDB search. -->
    <div v-if="pendingReconciliations.length && $store.state.isOnline" class="pending-reconciliation-banner mx-auto my-2">
      <router-link :to="`/reconcile/${firstPendingReconciliationDbKey}`">
        {{ pendingReconciliations.length }} movie<span v-if="pendingReconciliations.length > 1">s</span> rated offline need{{ pendingReconciliations.length > 1 ? '' : 's' }} a match — Review
      </router-link>
    </div>

    <!-- Active Filter Chips - only show when filters are active -->
    <div v-if="activeFiltersMinusTemps.length || activeQuickLinkList !== 'title'" class="active-filters-section mx-auto my-2">
      <div class="d-flex flex-wrap align-items-center">
        <!-- Quick Link Filter Chip -->
        <transition name="chip-fade" mode="out-in">
          <span v-if="activeQuickLinkList !== 'title'" class="badge text-bg-primary me-2 my-1 d-inline-flex align-items-center chip-transition" style="padding: 0.25rem 0.4rem; font-weight: normal; font-size: 0.75rem; line-height: 1.2;">
            {{ getQuickLinkDisplayName(activeQuickLinkList) }}
            <button class="btn-close btn-close-white ms-1" @click="clearQuickLink" style="font-size: 0.5rem; line-height: 1;"></button>
          </span>
        </transition>

        <!-- Special case for an active year chip: instead of a plain
             badge, a horizontally-scrolling strip of every year present
             in the library, so you can swipe/tap your way between years
             instead of re-typing each one — feature request: "instead of
             showing all the chips across the bottom, I want some sort of
             UI that takes up the same amount of space... goes
             horizontally all the way across and lets me quickly travel
             between years." Works alongside OTHER filters too (e.g. year
             + genre) — follow-up: "I do want it to also be able to work
             with other filters... additional filter chips that just
             exist below the new year selector." flex-basis 100% (via
             .year-scroller) forces it onto its own full-width row in
             this flex-wrap container; since it comes BEFORE the other-
             filter badges below in DOM order, and it always consumes the
             whole row width, those badges naturally wrap onto the line
             right after it — no extra positioning needed for "below the
             year selector," that's just how flex-wrap lays out a
             full-width item followed by normal ones. -->
        <div v-if="hasActiveYearChip" ref="yearScroller" class="year-scroller">
          <button
            v-for="year in availableYearsAscending"
            :key="year"
            type="button"
            class="btn btn-sm year-scroller-pill"
            :class="year === activeYearChipValue ? 'btn-primary selected' : 'btn-outline-secondary'"
            @click="selectYear(year)"
          >{{ year }}</button>
        </div>

        <!-- Additional Filter Chips — every active chip EXCEPT a year one
             (which renders as the scroller above instead). When no year
             chip is active, otherActiveFilters is just
             activeFiltersMinusTemps unfiltered, so this behaves exactly
             as the plain chip row always has. -->
        <transition-group name="chip-fade" tag="div" class="d-inline-flex flex-wrap align-items-center">
          <span v-for="filter in otherActiveFilters" :key="filter.id" class="badge text-bg-secondary me-2 my-1 d-inline-flex align-items-center chip-transition" style="padding: 0.25rem 0.4rem; font-weight: normal; font-size: 0.75rem; line-height: 1.2;">
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
        <button v-if="activeFiltersMinusTemps.length === 1" class="btn btn-link text-light p-0 my-1 d-inline-flex align-items-center" style="font-size: 0.9rem; text-decoration: none; opacity: 0.7;" @click="goToWikipediaForChip" title="Wikipedia Info">
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

    <!-- Brand new (0-rated) user: a short welcome, then suggestions shown
         immediately - see shouldShowStartSuggestions for why no tap is
         required here specifically. -->
    <div v-if="$store.state.dbLoaded && isBrandNewUser && !dismissedWelcomeSuggestions && !value && !resultsAreFiltered" class="welcome-new-user text-center mt-3 mb-1">
      <p class="welcome-new-user-text">Welcome to Cinema Roll! This app is built entirely around movies you rate yourself.</p>
      <!-- The wrong-account case: the read SUCCEEDED but this account's
           library is genuinely empty — which is exactly what an established
           user sees if they signed in with a different Google account or a
           typo'd email. Naming the signed-in account is the diagnostic. -->
      <p v-if="$store.state.userEmail" class="welcome-account-note">
        You're signed in as <strong>{{ $store.state.userEmail }}</strong>.
        Already have rated movies? They live under the account you first
        used — sign in with that one to see them.
      </p>
    </div>

    <!-- Suggestions button below search bar if user has rated 1-9 movies -->
    <div v-if="$store.state.dbLoaded && !showSuggestionsOnly && userRatedMovieCount > 0 && userRatedMovieCount < 10 && !value && !resultsAreFiltered" class="text-center mt-2 mb-1">
      <button class="btn btn-success" @click="showSuggestionsOnly = true">{{ suggestionsButtonLabel }}</button>
    </div>
    <NoResults
      v-if="shouldShowStartSuggestions"
      :value="searchValue || effectiveSearchTerm"
      :suggestionsMode="true"
      @cancel-suggestions="handleCancelSuggestions"
      style="margin-bottom: 2rem;"
    />
    <div v-else>
      <div v-if="showResultsList" class="results">
        <div v-if="paginatedSortedResults.length" class="results-exist">
          <div class="results-actions col-12 md-col-6 d-flex justify-content-between flex-wrap my-2">
            <div class="btn-group col-12" role="group" aria-label="Button group">
              <!-- Settings (gear) button replaces shorts toggle -->
              <button class="results-actions-button btn btn-secondary" @click="toggleSettingsPanel" title="Settings" aria-label="Open settings">
                <i class="bi bi-gear"></i>
              </button>
              <button class="results-actions-button btn btn-info" type="button" @click="goToGames" title="Games" aria-label="Go to games">
                <i class="bi" :class="gamesButtonIcon"/>
              </button>
              <button class="results-actions-button filtered-count-display btn btn-secondary" @click="toggleCountViewsAverage" title="Toggle count / average / views" aria-label="Toggle between result count, average rating, and view count">
                <span v-if="showAverage">
                  <span class="average-label">(avg)</span>
                  <span class="average-value">{{averageRating(displayedResults)}}</span>
                </span>
                <span v-else-if="showViewCount">
                  <span class="average-label">(views)</span>
                  <span class="average-value">{{viewsCount(displayedResults)}}</span>
                </span>
                <span v-else-if="activeQuickLinkList === 'bestPicture'">{{bestPicturesWithRatings.length}}/{{unifiedFilteredResults.length}}</span>
                <span v-else>{{displayedResults.length}}</span>
              </button>
              <button class="results-actions-button btn btn-info" type="button" @click="goToInsights" title="Insights" aria-label="Go to insights">
                <i class="bi bi-lightbulb"/>
              </button>
              <button class="results-actions-button btn btn-warning btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#quick-links-accordion" aria-expanded="false" aria-controls="quick-links-accordion" @click="toggleQuickLinksAccordion" title="Quick filters" aria-label="Toggle quick filters">
                <i class="bi bi-lightning-charge"/>
              </button>
              <!-- Shuffle lives inside the quick-links panel now (feedback:
                   the extra watchlist button broke the rainbow); watchlist
                   takes shuffle's old slot and color. -->
              <button class="results-actions-button btn btn-info btn-sm" @click="$router.push('/watchlist')" title="Watchlist" aria-label="Go to watchlist">
                <i class="bi bi-binoculars"/>
              </button>
              <button class="results-actions-button btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Sort results" aria-label="Sort results">
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
                    class="badge mx-1 text-bg-secondary"
                    @click="findRandomSearchValue"
                  >
                    <i class="bi bi-shuffle"></i> Surprise me
                  </span>
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
          <!-- Stickiness Inline Content -->
          <StickinessInline
            :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"
            :showStickinessModal="showStickinessModal"
            @stickiness-updated="onStickinessUpdated"
          />
          <TweakInline
            :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"
            :showTweakModal="showTweakModal"
            @tweak-updated="onTweakUpdated"
          />
          <!-- Banner-only on Home now: tapping the "year is ready" notice
               navigates to the /awards page (the overlay modal is retired —
               feedback: it "always feels a little bit janky"). -->
          <!-- No :selectedYear here, deliberately. selectedYear is the
               explicit-intent override (Resume/Edit buttons) and the picker
               returns it unconditionally — passing the persisted daily year
               through it kept the banner naming a year all day AFTER it was
               completed, sending Matt to a finished year with no new-movies
               list. The picker reads dailyAwardsYear from settings itself and
               applies stickiness WITH the completion check. -->
          <PersonalAwardsModal
            v-if="showAwardsModal"
            :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"
            :personalAwardName="personalAwardName"
            :awardNameWithThe="getAwardNameWithThe()"
            :awardNameSingular="getAwardNameSingular()"
            :autoOpen="awardsPromptState === 'forced'"
            :navigateOnOpen="true"
          />
          <!-- Inline Settings Panel accordion, right after action buttons and before results list -->
          <div v-if="showSettingsPanel" :class="['settings-panel-inline', 'card', 'card-body', darkOrLight['text-bg-dark'] ? 'dark' : '']">
            <div class="settings-panel-header d-flex justify-content-between align-items-center mb-2">
              <h5 class="mb-0">Settings</h5>
            </div>
            <hr class="mt-0 mb-3">
            <div class="settings-panel-body">
              <!-- Grouped into consistent SettingsSection cards (feedback:
                   the pane had grown patchwork). Ordered by everyday
                   relevance; rarely-used groups collapse by default. -->
              <SettingsSection title="Library">
                <div class="form-check form-switch mb-3">
                                <input class="form-check-input" type="checkbox" id="shortsToggle" :checked="showShorts" @change="updateShowShorts">
                                <label class="form-check-label" for="shortsToggle">Include short films</label>
                              </div>
                <div class="mb-3">
                  <button type="button" class="btn btn-warning w-100" @click="$router.push('/library-poster')">
                    <i class="bi bi-image"></i> Make a poster of your library
                  </button>
                </div>
                <div class="mb-3">
                                <label class="form-label d-block">Offline access</label>
                                <small class="form-text text-white d-block mb-2">
                                  Downloads every poster/backdrop in your library so they're viewable without a connection. Only needs to be run again after rating a batch of new movies.
                                </small>
                                <button
                                  class="btn btn-outline-info btn-sm"
                                  @click="downloadForOffline"
                                  :disabled="offlineDownload.status === 'running'"
                                >
                                  <span v-if="offlineDownload.status === 'running'">
                                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                                    Downloading {{ offlineDownload.completed }}/{{ offlineDownload.total }}...
                                  </span>
                                  <span v-else>
                                    <i class="bi bi-cloud-download"></i> Download all posters for offline
                                  </span>
                                </button>
                                <div v-if="offlineDownload.status === 'done'" class="text-success mt-2">
                                  <small><i class="bi bi-check-circle"></i> {{ offlineDownload.total }} images cached{{ offlineDownload.failed ? ` (${offlineDownload.failed} failed — check your connection and try again)` : '' }}.</small>
                                </div>
                              </div>
              </SettingsSection>

              <RatingCurveSettings/>

              <SettingsSection title="Awards">
                <div class="mb-3">
                                <label for="personalAwardName" class="form-label">Personal Award Name:</label>
                                <input
                                  type="text"
                                  class="form-control"
                                  id="personalAwardName"
                                  v-model="personalAwardName"
                                  placeholder="e.g., The Oscars, The Groskers, The Smithies"
                                  maxlength="50"
                                  @change="savePersonalAwardName"
                                >
                                <small class="form-text text-white">Use plural form like "The Oscars"</small>
                              </div>
                <div class="mb-3">
                                <label for="awardsYearThreshold" class="form-label">Movies needed before a year gets awards:</label>
                                <input
                                  type="number"
                                  class="form-control"
                                  id="awardsYearThreshold"
                                  v-model.number="awardsYearThresholdInput"
                                  min="1"
                                  max="100"
                                  step="1"
                                  @change="saveAwardsYearThreshold"
                                >
                                <small class="form-text text-white">Years with fewer rated movies stay out of the awards flow.</small>
                              </div>
              </SettingsSection>

              <SettingsSection title="Prompts">
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
                <template v-if="isMatt">
                  <ThreeStateToggle
                                    id="stickinessPromptState"
                                    label="Stickiness Prompts"
                                    :value="stickinessPromptState"
                                    @input="saveStickinessPromptState"
                                  />
                                  <ThreeStateToggle
                                    id="tieBreakPromptState"
                                    label="Tie-break Prompts"
                                    :value="tieBreakPromptState"
                                    @input="saveTieBreakPromptState"
                                  />
                                  <ThreeStateToggle
                                    id="awardsPromptState"
                                    label="Personal Awards Prompts"
                                    :value="awardsPromptState"
                                    @input="saveAwardsPromptState"
                                  />
                </template>
              </SettingsSection>

              <SettingsSection title="Letterboxd">
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
                                  <button v-if="letterboxdUsername" class="btn btn-outline-info" @click="scrapeLetterboxd" :disabled="scrapingTest.loading" title="Refresh Letterboxd Data">
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
              </SettingsSection>

              <SettingsSection title="Data maintenance" collapsible :startOpen="false">
                <div class="mb-3">
                                <label class="form-label d-block">Box office data</label>
                                <small class="form-text text-white d-block mb-2">
                                  Fetches budget/box office numbers for movies rated before that data started being saved automatically. Safe to run again anytime — it only fetches whatever's still missing.
                                </small>
                                <button
                                  class="btn btn-outline-info btn-sm"
                                  @click="backfillBoxOfficeData"
                                  :disabled="boxOfficeBackfill.status === 'running'"
                                >
                                  <span v-if="boxOfficeBackfill.status === 'running'">
                                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                                    Fetching {{ boxOfficeBackfill.completed }}/{{ boxOfficeBackfill.total }}...
                                  </span>
                                  <span v-else>
                                    <i class="bi bi-cash-coin"></i> Fill in box office data for all movies
                                  </span>
                                </button>
                                <div v-if="boxOfficeBackfill.status === 'done'" class="text-success mt-2">
                                  <small v-if="boxOfficeBackfill.total"><i class="bi bi-check-circle"></i> {{ boxOfficeBackfill.total }} movie{{ boxOfficeBackfill.total === 1 ? '' : 's' }} updated{{ boxOfficeBackfill.failed ? ` (${boxOfficeBackfill.failed} failed — check your connection and try again)` : '' }}.</small>
                                  <small v-else><i class="bi bi-check-circle"></i> Everything's already filled in.</small>
                                </div>
                              </div>
                <div class="mt-4">
                                <label class="form-label d-block">Production countries</label>
                                <small class="form-text text-white d-block mb-2">
                                  Fetches which countries produced each movie, and the languages spoken in it. Safe to run again anytime.
                                </small>
                                <button
                                  class="btn btn-outline-info btn-sm"
                                  @click="backfillProductionCountriesData"
                                  :disabled="countriesBackfill.status === 'running'"
                                >
                                  <span v-if="countriesBackfill.status === 'running'">
                                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                                    Fetching {{ countriesBackfill.completed }}/{{ countriesBackfill.total }}...
                                  </span>
                                  <span v-else>
                                    <i class="bi bi-globe-americas"></i> Fill in production countries
                                  </span>
                                </button>
                                <div v-if="countriesBackfill.status === 'done'" class="text-success mt-2">
                                  <small v-if="countriesBackfill.total"><i class="bi bi-check-circle"></i> {{ countriesBackfill.total }} movie{{ countriesBackfill.total === 1 ? '' : 's' }} updated{{ countriesBackfill.failed ? ` (${countriesBackfill.failed} failed — check your connection and try again)` : '' }}.</small>
                                  <small v-else><i class="bi bi-check-circle"></i> Everything's already filled in.</small>
                                </div>
                              </div>
                <div class="mt-4">
                                <label class="form-label d-block">Slim down stored data</label>
                                <small class="form-text text-white d-block mb-2">
                                  Removes crew the app never shows (stunts, hair, makeup and so on) plus a few fields that get recalculated anyway. Cuts what has to download each time you open the app by roughly 40%. Nothing you can see in the app changes. Safe to run again anytime.
                                </small>
                                <button
                                  class="btn btn-outline-info btn-sm"
                                  @click="trimLibraryData"
                                  :disabled="libraryTrim.status === 'running'"
                                >
                                  <span v-if="libraryTrim.status === 'running'">
                                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                                    Slimming {{ libraryTrim.completed }}/{{ libraryTrim.total }}...
                                  </span>
                                  <span v-else>
                                    <i class="bi bi-file-zip"></i> Slim down stored data
                                  </span>
                                </button>
                                <div v-if="libraryTrim.status === 'done'" class="text-success mt-2">
                                  <small v-if="libraryTrim.total"><i class="bi bi-check-circle"></i> {{ libraryTrim.total }} movie{{ libraryTrim.total === 1 ? '' : 's' }} slimmed{{ libraryTrim.failed ? ` (${libraryTrim.failed} failed — check your connection and try again)` : '' }}.</small>
                                  <small v-else><i class="bi bi-check-circle"></i> Already as small as it goes.</small>
                                </div>

                                <button
                                  class="btn btn-outline-light btn-sm w-100 mt-2"
                                  @click="backfillSyncStamps"
                                  :disabled="syncStampBackfill.status === 'running'"
                                >
                                  <span v-if="syncStampBackfill.status === 'running'">
                                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                                    Timestamping {{ syncStampBackfill.completed }}/{{ syncStampBackfill.total }}...
                                  </span>
                                  <span v-else>
                                    <i class="bi bi-clock-history"></i> Add change timestamps
                                  </span>
                                </button>
                                <div v-if="syncStampBackfill.status === 'done'" class="text-success mt-2">
                                  <small v-if="syncStampBackfill.total"><i class="bi bi-check-circle"></i> {{ syncStampBackfill.total }} movie{{ syncStampBackfill.total === 1 ? '' : 's' }} timestamped{{ syncStampBackfill.failed ? ` (${syncStampBackfill.failed} failed — check your connection and try again)` : '' }}.</small>
                                  <small v-else><i class="bi bi-check-circle"></i> Every movie already has one.</small>
                                </div>
                              </div>
              </SettingsSection>

              <SettingsSection title="Account">
                <p v-if="$store.state.userEmail" class="signed-in-as small mb-2">
                                  Signed in as {{ $store.state.userEmail }}
                                </p>
                                <button
                                  class="btn btn-outline-light btn-sm w-100"
                                  @click="signOut"
                                >
                                  <i class="bi bi-box-arrow-right"></i> Sign out
                                </button>
              </SettingsSection>

              <SettingsSection title="Developer" collapsible :startOpen="false">
                <div class="form-check form-switch mb-3">
                                <input class="form-check-input" type="checkbox" id="errorLogsToggle" :checked="showErrorLogs" @change="updateShowErrorLogs">
                                <label class="form-check-label" for="errorLogsToggle">Show error logs</label>
                              </div>
                              <div v-if="showErrorLogs" class="mb-3">
                                <button @click="testErrorLogging" class="btn btn-sm btn-outline-secondary">
                                  <i class="bi bi-bug"></i> Test Error Logging
                                </button>
                              </div>

                              <!-- Inline Error Log Viewer -->
                              <div v-if="showErrorLogs" class="error-logs-section mt-3 p-3 border rounded">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                  <h6 class="mb-0">
                                    <i class="bi bi-bug me-2"></i>Error Logs ({{ errorLogs.length }})
                                  </h6>
                                  <div>
                                    <button @click="copyErrorLogs" class="btn btn-sm btn-outline-primary me-2" :disabled="errorLogs.length === 0">
                                      <i class="bi bi-clipboard"></i> Copy
                                    </button>
                                    <button @click="clearErrorLogs" class="btn btn-sm btn-outline-danger" :disabled="errorLogs.length === 0">
                                      <i class="bi bi-trash"></i> Clear
                                    </button>
                                  </div>
                                </div>

                                <div v-if="errorLogs.length === 0" class="text-center text-muted py-3">
                                  <i class="bi bi-check-circle"></i> No logs to display
                                </div>

                                <div v-else class="error-logs-list" style="max-height: 300px; overflow-y: auto;">
                                  <div
                                    v-for="log in errorLogs.slice(0, 20)"
                                    :key="log.id"
                                    :class="['log-entry', 'p-2', 'mb-2', 'rounded', `log-${log.level}`]"
                                    style="font-size: 0.8rem; border-left: 3px solid;"
                                  >
                                    <div class="d-flex justify-content-between align-items-start mb-1">
                                      <span :class="['badge', `bg-${log.level === 'error' ? 'danger' : log.level === 'warn' ? 'warning' : log.level === 'info' ? 'info' : 'secondary'}`]">
                                        {{ log.level.toUpperCase() }}
                                      </span>
                                      <small class="text-muted">{{ formatLogTime(log.timestamp) }}</small>
                                    </div>
                                    <div class="log-message">{{ log.message }}</div>
                                    <div v-if="log.context && Object.keys(log.context).length > 0" class="mt-1">
                                      <small class="text-muted">Context: {{ JSON.stringify(log.context) }}</small>
                                    </div>
                                  </div>
                                  <div v-if="errorLogs.length > 20" class="text-center text-muted mt-2">
                                    <small>Showing first 20 of {{ errorLogs.length }} logs</small>
                                  </div>
                                </div>

                                <div v-if="copySuccess" class="alert alert-success mt-2 py-2">
                                  <i class="bi bi-check-circle"></i> Copied to clipboard!
                                </div>
                              </div>
              </SettingsSection>
            </div>
          </div>
          <!-- Results list follows the settings panel -->
          <!-- Group order panel: reorder the grouped result hierarchy for the day -->
          <div v-if="showGroupOrderPanel && groupedByAllCategories" ref="groupOrderPanel" class="group-order-panel card card-body mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="mb-0 text-light">Group order</h6>
              <button class="btn btn-sm btn-outline-light" @click="toggleGroupOrderPanel">Done</button>
            </div>
            <ul class="list-unstyled mb-0">
              <li
                v-for="(group, index) in reorderableGroups"
                :key="group.category"
                class="group-order-row d-flex justify-content-between align-items-center py-1"
              >
                <span class="text-light">{{ group.categoryDisplay }} <span class="text-muted">({{ group.count }})</span></span>
                <span class="group-order-controls">
                  <button
                    class="btn btn-sm btn-secondary me-1"
                    :disabled="index === 0"
                    @click="moveGroupUp(group.category)"
                    aria-label="Move group up"
                  >
                    <i class="bi bi-arrow-up"/>
                  </button>
                  <button
                    class="btn btn-sm btn-secondary"
                    :disabled="index === reorderableGroups.length - 1"
                    @click="moveGroupDown(group.category)"
                    aria-label="Move group down"
                  >
                    <i class="bi bi-arrow-down"/>
                  </button>
                </span>
              </li>
            </ul>
          </div>
          <!-- Multi-category grouped results -->
          <div v-if="groupedByAllCategories" class="pb-3">
            <div v-for="group in groupedByAllCategories" :key="group.category" class="my-4 role-section">
              <h6
                class="bg-dark text-white text-end mb-2 group-header"
                role="button"
                title="Reorder result groups"
                aria-label="Reorder result groups"
                @click="openGroupOrderPanel"
              >
                {{ group.categoryDisplay }}
                <i class="bi bi-arrow-down-up group-header-icon"></i>
              </h6>
              <ul class="grid-layout" :class="getGridClassesForGroup(group.movies.length)">
                <DBGridLayoutSearchResult
                  v-for="(result, index) in group.movies"
                  :key="result.movie.id"
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
              :key="result.movie.id"
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
          <!-- Infinite-scroll sentinel: the observer auto-loads the next batch as
               this nears the viewport. The button is a tap fallback if auto-load
               doesn't fire (e.g. observer unsupported, or a very tall viewport). -->
          <div v-if="canLoadMore" ref="loadMoreSentinel" class="load-more-sentinel d-flex justify-content-center mb-5">
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
              :value="searchValue || effectiveSearchTerm"
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
          <div v-else-if="$store.state.isOnline" class="button-wrapper d-flex justify-content-end mb-5">
            <button class="btn btn-primary" @click="searchTMDB" id="new-rating-button">Search TMDB for {{titleCase(effectiveSearchTerm)}}</button>
          </div>
          <div v-else class="button-wrapper d-flex justify-content-end mb-5">
            <button class="btn btn-primary" @click="rateOffline" id="rate-offline-button">Rate "{{titleCase(effectiveSearchTerm)}}" from memory</button>
          </div>
        </div>
        <div v-else class="no-results-but-search-type">
          <p class="text-center">No movies found for your search.</p>
          <button class="btn btn-link col-12" @click="toggleQuickLinksList(null)">Clear quick filters?</button>
        </div>
      </div>
      <div v-else-if="$store.state.dbLoaded">
        <!-- The "Did you mean...?" link itself now lives right under the
             search bar (see top of template) so it doesn't sit between the
             search bar and this new-rating-suggestion UI. -->
        <NoResults
          :class="{'no-results-buffer': !activeFiltersMinusTemps.length}"
          :value="searchValue || effectiveSearchTerm"
          @startNewSearch="startNewSearch"
        />
      </div>
      <div v-else class="loading-screen d-flex justify-content-center align-items-center my-5">
        <div class="spinner-border text-light" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
      <InsetBrowserModal :show="showInsetBrowserModal" :url="insetBrowserUrl" @close="showInsetBrowserModal = false" />
    </div>
    <!-- Unrated movies section -->
    <div v-if="displayableUnratedMovies.length && !unratedMoviesError && paginatedSortedResults.length" class="unrated-movies-grid">
      <h3 class="bg-dark">
        <span v-if="unratedMoviesSearchType === 'person'">More from {{ effectiveSearchTerm }}:</span>
        <span v-else-if="unratedMoviesSearchType === 'year'">More from {{ effectiveSearchTerm }}:</span>
        <span v-else-if="unratedMoviesSearchType === 'yearRange'">More from this time period:</span>
        <span v-else-if="unratedMoviesSearchType === 'genre'">More {{ effectiveSearchTerm.toLowerCase() }} movies:</span>
        <span v-else-if="unratedMoviesSearchType === 'company'">More from {{ effectiveSearchTerm }}:</span>
        <span v-else-if="unratedMoviesSearchType === 'search'">Movies matching "{{ effectiveSearchTerm }}":</span>
        <span v-else>More from {{ effectiveSearchTerm }}:</span>
      </h3>
      <div class="d-flex flex-wrap">
        <div v-for="movie in unratedMovies" :key="movie.id" class="unrated-movie-card col-3" @click="showMovieInfo(movie)">
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
            <div class="mt-3">
              <button class="btn btn-primary" @click="rateMovieFromModal">
                Rate Movie
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { scrollWindowTo } from '../utils/scrollWindowTo.js';
import minBy from 'lodash/minBy';
import debounce from 'lodash/debounce';
import cloneDeep from 'lodash/cloneDeep';
import Fuse from 'fuse.js';
import DBGridLayoutSearchResult from './DBGridLayoutSearchResult.vue';
import TweakInline from "./TweakInline.vue";
import StickinessInline from "./StickinessInline.vue";
import PersonalAwardsModal from "./PersonalAwardsModal.vue";
import RatingCurveSettings from "./RatingCurveSettings.vue";
import SettingsSection from "./SettingsSection.vue";
import NoResults from "./NoResults.vue";
import InsetBrowserModal from './InsetBrowserModal.vue';
import ThreeStateToggle from './ThreeStateToggle.vue';
import { getRating } from "../assets/javascript/GetRating.js";
import { awardsYearThreshold } from "../assets/javascript/personalAwards.js";
import ErrorLogService from '../services/ErrorLogService.js';
import { computeFlatKeywords } from '../utils/keywords.js';
import {
  buildSearchFields as buildSearchFieldsUtil,
  applyFilter as applyFilterUtil,
  getListOfYearsFromRange as getListOfYearsFromRangeUtil,
  getSortValue as getSortValueUtil,
  sortResultsFast as sortResultsFastUtil,
  sortResults as sortResultsUtil,
  countDidYouMeanSuggestionsThatFit
} from '../assets/javascript/searchFiltering.js';
import {
  awardNameWithThe,
  awardNameWithoutThe,
  awardNameSingular
} from '../assets/javascript/personalAwards.js';
import { findTiedGroup } from '../assets/javascript/tieBreakTournament.js';
import { GAME_ICONS, lastPlayedGamePath } from '../mixins/gameData.js';
import { collectImageUrls, warmImageCache } from '../assets/javascript/offlinePosterCache.js';
import { backfillBoxOffice, collectMoviesNeedingBoxOffice } from '../assets/javascript/backfillBoxOffice.js';
import { backfillProductionCountries, collectMoviesNeedingCountries } from '../assets/javascript/backfillProductionCountries.js';
import { trimStoredEntries, collectEntriesNeedingTrim, entryForStorage } from '../assets/javascript/storedEntry.js';
import { collectEntriesNeedingStamp, stampBackfillUpdates } from '../assets/javascript/syncStamp.js';
import { makePlaceholderId } from '../utils/placeholderId.js';
import {
  countDirectors as countDirectorsUtil,
  countCastCrew as countCastCrewUtil,
  countGenres as countGenresUtil,
  countKeywords as countKeywordsUtil,
  countStudios as countStudiosUtil
} from '../assets/javascript/entityCounts.js';

// Default priority order for the grouped search view. The order decides which
// group claims a movie that matches multiple categories. Users can reorder this
// for the day via the group-order panel; it reverts to this default next day.
const DEFAULT_GROUP_ORDER = [
  'title',
  'director',
  'cast',
  'producer',
  'company',
  'keyword-genre',
  'writer',
  'music',
  'editor',
  'cinematographer',
  'crew',
  'other'
];

// Display labels for groups in the reorder panel. Used for groups that are not
// currently rendered (and so have no live categoryDisplay to read).
const GROUP_DISPLAY_NAMES = {
  title: 'Title Matches',
  director: 'Director',
  cast: 'Cast',
  producer: 'Producer',
  company: 'Production Companies',
  'keyword-genre': 'Keywords & Genres',
  writer: 'Writer',
  music: 'Music',
  editor: 'Editor',
  cinematographer: 'Cinematographer',
  crew: 'Crew',
  other: 'Other'
};

export default {
  components: {
    DBGridLayoutSearchResult,
    InsetBrowserModal,
    TweakInline,
    StickinessInline,
    PersonalAwardsModal,
    RatingCurveSettings,
    SettingsSection,
    NoResults,
    ThreeStateToggle,
  },
  data () {
    return {
      activeFilters: [], // New multi-filter system
      activeQuickLinkList: "title",
      cachedCastMembers: new Set(), // Cache for fast cast member lookups
      debouncedSetSearchValue: debounce(function (value) {
        this.searchValue = value;
      }, 300),
      // How many ranked "Did you mean?" suggestions currently fit on one line
      // next to the label, given the search input's actual width - see
      // updateDidYouMeanFitCount. Starts conservative; recalculated once the
      // input is actually mounted/measurable.
      didYouMeanFitCount: 1,
      debouncedUpdateDidYouMeanFitCount: debounce(function () {
        this.updateDidYouMeanFitCount();
      }, 200),
      filterTypes: ['general', 'person', 'year', 'yearRange', 'genre', 'company', 'keyword', 'tag'],
      hasAutoRandomChip: false, // Track if current chip was added by auto random search

      inputValue: "", // Visual input value (can be different from internal value)
      insetBrowserUrl: "",
      forceModalReevaluation: 0, // Dummy value to force modal computed properties to recalculate
      modalReevalInterval: null, // Timer for automatic modal re-evaluation
      letterboxdOverrides: {},
      letterboxdUserData: null,
      loadMoreObserver: null, // IntersectionObserver for infinite-scroll result loading
      newOverrideTitle: '',
      newOverrideYear: null,
      noResults: false, // Show no results message for TMDB search
      numberOfResultsToShow: 25,
      offlineDownload: { status: 'idle', completed: 0, total: 0, failed: 0 },
      boxOfficeBackfill: { status: 'idle', completed: 0, total: 0, failed: 0 },
      countriesBackfill: { status: 'idle', completed: 0, total: 0, failed: 0 },
      libraryTrim: { status: 'idle', completed: 0, total: 0, failed: 0 },
      syncStampBackfill: { status: 'idle', completed: 0, total: 0, failed: 0 },
      quickLinksSortType: "count",
      scrapingTest: {
        loading: false,
        result: null,
        success: false,
        error: null
      },
      searchValue: '',
      selectedMovieInfo: null, // Movie data for the info modal
      showAddFilterModal: false,
      showAverage: false,
      showGroupOrderPanel: false,
      showInsetBrowserModal: false,
      showMovieInfoModal: false, // Show/hide movie info modal
      showOverridePanel: false,
      showSettingsPanel: false, // controls settings panel visibility
      errorLogs: [], // error log entries
      copySuccess: false, // copy to clipboard success indicator
      errorLogRefreshInterval: null, // interval for refreshing error logs
      showSuggestionsOnly: false,
      dismissedWelcomeSuggestions: false, // a 0-rated user can cancel out of the auto-shown welcome suggestions
      showViewCount: false,
      sortOrder: "bestOrNewestOnTop",
      sortValue: null,
      unratedMovies: [],
      unratedMoviesDebounceTimeout: null,
      unratedMoviesError: null,
      unratedMoviesQuery: '',
      unratedMoviesSearchType: null, // 'person', 'year', 'yearRange', 'genre', 'general'
      value: "",
    }
  },
  watch: {
    // Publishes a small summary of what's actually on screen to the store,
    // purely so in-app bug reports can include it (see bugReports.js). Added
    // after an "the entire list of movies is empty" report that couldn't be
    // diagnosed: the snapshot only had the PERSISTED navigation fields,
    // which mounted() clears on restore, so it showed an empty search and
    // no chips no matter what was really filtering the list. Nothing reads
    // this for behaviour.
    liveDebugState: {
      immediate: true,
      handler (value) {
        this.$store.commit('setHomePageLiveState', value);
      }
    },
    allEntriesWithFlatKeywordsAdded (newVal, oldval) {
      if (!oldval.length && newVal.length) {
        this.buildCastMembersCache();
        this.resolveBanner(); // data just loaded → set the initial banner
      }
    },
    canLoadMore () {
      // (Re)wire the infinite-scroll observer whenever the sentinel appears or
      // disappears — its element is recreated each time this flips true.
      this.$nextTick(() => this.setupLoadMoreObserver());
    },
    didYouMeanSuggestions () {
      // Candidate terms changed (new search value) - re-measure since
      // different terms have different lengths, so how many fit will vary.
      this.$nextTick(() => this.updateDidYouMeanFitCount());
    },
    effectiveSearchFilter (newVal, oldVal) {
      // Fetch unrated movies for any non-empty search term (from input or chips)
      if (newVal && (!oldVal || newVal.value !== oldVal.value)) {
        this.debouncedFetchUnratedMoviesBySearchFilter(newVal);
      } else if (!newVal) {
        this.unratedMovies = [];
        this.unratedMoviesError = null;
      }
    },
    // Covers both "the year-scroller just appeared" (null -> a year, e.g.
    // typing a year into the search bar, or state restored on mount) and
    // "a different year was tapped while it was already showing" — in
    // both cases the newly-active pill should be scrolled into view.
    activeYearChipValue (newYear) {
      if (newYear != null) {
        this.$nextTick(() => this.centerYearScrollerPill());
      }
    },
  },
  mounted () {
    // Capture navigation intent at the start - needed for various logic below
    const navigationIntent = this.$store.state.homePageNavigationIntent;

    // Check if we have any state to restore
    const hasStateToRestore = this.$store.state.homePageScrollPosition > 0 ||
                             this.$store.state.homePageSearchChips.length > 0 ||
                             this.$store.state.homePageSearchValue ||
                             this.$store.state.homePageNumberOfResults > 25 ||
                             this.$store.state.homePageSortOrder ||
                             this.$store.state.homePageSortValue;

    if (hasStateToRestore) {
      // Restore search state
      if (this.$store.state.homePageSearchChips.length > 0) {
        this.activeFilters = [...this.$store.state.homePageSearchChips];
      }
      if (this.$store.state.homePageSearchValue) {
        this.inputValue = this.$store.state.homePageSearchValue;
      }
      if (this.$store.state.homePageNumberOfResults > 25) {
        this.numberOfResultsToShow = this.$store.state.homePageNumberOfResults;
      }

      // Restore sort values based on navigation intent
      if (navigationIntent === 'close') {
        // Only restore sort values for 'close' navigation, not 'search'
        if (this.$store.state.homePageSortValue) {
          this.sortValue = this.$store.state.homePageSortValue;
        }
        if (this.$store.state.homePageSortOrder) {
          this.sortOrder = this.$store.state.homePageSortOrder;
        }
      }

      // Captured NOW, not read inside the $nextTick below. This restore has
      // never actually worked: the callback used to read
      // this.$store.state.homePageScrollPosition, but the "clear stored
      // state" block a few lines down sets that to 0 SYNCHRONOUSLY - i.e.
      // always before the deferred callback runs - so the `> 0` guard was
      // false every single time and the page never moved. (A second,
      // independent bug was hiding behind it: the restore used
      // `documentElement.scrollTop = x`, which this app's
      // `scroll-behavior: smooth` silently swallows - see
      // utils/scrollWindowTo.js.)
      const scrollPositionToRestore = this.$store.state.homePageScrollPosition;

      // Restore scroll position after DOM updates and result rendering
      this.$nextTick(() => {
        // Use captured navigation intent
        if (navigationIntent === 'search') {
          // For search navigation, always scroll to top
          scrollWindowTo(0);
        } else if (navigationIntent === 'close' || navigationIntent === null) {
          // For close navigation or normal restoration, restore saved position
          if (scrollPositionToRestore > 0) {
            scrollWindowTo(scrollPositionToRestore);
          }
        }
      });

      // Clear stored state after restoring (unless it's a new search from MovieDetail)
      const isNewSearch = this.$store.state.homePageSearchValue && this.$store.state.homePageSearchChips.length === 0;
      if (!isNewSearch) {
        this.$store.commit('setHomePageScrollPosition', 0);
        this.$store.commit('setHomePageSearchChips', []);
        this.$store.commit('setHomePageSearchValue', '');
        this.$store.commit('setHomePageNavigationIntent', null); // Clear navigation intent
        this.$store.commit('setHomePageSortOrder', null); // Clear sort order
        this.$store.commit('setHomePageSortValue', null); // Clear sort value
        // Don't reset numberOfResults - preserve the expanded results
        // this.$store.commit('setHomePageNumberOfResults', 25);
      } else if (isNewSearch) {
        // Handle new search from MovieDetail - convert search value to chip immediately
        this.convertSearchToChip();
        // If the clicked value carried a group type, promote that group to the
        // top of the hierarchy for the day (clicks win over manual ordering).
        this.applyPromoteGroup();
        // Clear the stored state after conversion
        this.$store.commit('setHomePageScrollPosition', 0);
        this.$store.commit('setHomePageSearchChips', []);
        this.$store.commit('setHomePageSearchValue', '');
        this.$store.commit('setHomePageNavigationIntent', null); // Clear navigation intent
        this.$store.commit('setHomePageSortOrder', null); // Clear sort order
        this.$store.commit('setHomePageSortValue', null); // Clear sort value
      }
    } else {
      // Normal behavior - scroll to top instantly
      scrollWindowTo(0);
      // Clear navigation intent and sort order
      this.$store.commit('setHomePageNavigationIntent', null);
      this.$store.commit('setHomePageSortOrder', null);
      this.$store.commit('setHomePageSortValue', null);
    }

    if (this.$route.query.search) {
      this.inputValue = decodeURIComponent(this.$route.query.search);
    }

    // Handle new search from MovieDetail page
    if (this.$store.state.homePageSearchValue && this.$store.state.homePageSearchChips.length === 0) {
      // Clear the search state from store after processing
      this.$store.commit('setHomePageSearchValue', '');
    }

    // Only initialize sort value if we're not restoring state from a 'close' navigation
    if (navigationIntent !== 'close' || !hasStateToRestore) {
      if (this.DBSortValue) {
        this.setSortValue(this.DBSortValue)
      } else {
        this.setSortValue("rating")
      }
    }

    if (this.$route.query.movieDbKey) {
      // Only override sort if this isn't a 'close' navigation with restored state
      if (navigationIntent !== 'close' || !hasStateToRestore) {
        this.$store.commit("setDBSortValue", "watched");
        this.setSortValue("watched");
        this.sortOrder = "bestOrNewestOnTop";
      }
    }

    // Note: showShorts, showErrorLogs, and enableRandomSearch are now computed properties

    // Initialize letterboxdOverrides from store
    if (this.$store.state.settings.letterboxdOverrides) {
      this.letterboxdOverrides = this.$store.state.settings.letterboxdOverrides;
    }

    // Initialize error logs
    this.refreshErrorLogs();
    if (this.showErrorLogs) {
      this.startErrorLogRefresh();
    }

    // Pick the header banner based on how we arrived (context-aware). Runs after
    // any incoming search/chip has been applied above so 'fromResults' can sample
    // the visible results. If data isn't loaded yet this no-ops and the
    // allEntriesWithFlatKeywordsAdded watcher resolves it once the library lands.
    this.resolveBanner();

    // Set up automatic modal re-evaluation every 30 minutes
    // This keeps time-based modals (tie breaks, awards) responsive without manual refresh
    this.modalReevalInterval = setInterval(() => {
      this.forceModalReevaluation++;
    }, 1800000); // 30 minutes (1800 seconds)

    // Wire infinite-scroll in case results are already present at mount (e.g.
    // restored navigation state). The canLoadMore watcher covers the later
    // case where the library loads in after mount.
    this.$nextTick(() => this.setupLoadMoreObserver());

    // "Did you mean?" fit-count depends on the search input's actual
    // rendered width, so it needs a real DOM measurement (not just reactive
    // state) once mounted, and again on resize (e.g. rotating a phone).
    this.$nextTick(() => this.updateDidYouMeanFitCount());
    window.addEventListener('resize', this.debouncedUpdateDidYouMeanFitCount);
  },
  beforeUnmount () {
    window.removeEventListener('resize', this.debouncedUpdateDidYouMeanFitCount);

    // Clean up error log refresh interval
    this.stopErrorLogRefresh();

    // Clean up modal re-evaluation interval
    if (this.modalReevalInterval) {
      clearInterval(this.modalReevalInterval);
      this.modalReevalInterval = null;
    }

    // Clean up infinite-scroll observer
    if (this.loadMoreObserver) {
      this.loadMoreObserver.disconnect();
      this.loadMoreObserver = null;
    }
  },

  // Combined beforeRouteLeave method
  beforeRouteLeave (to, from, next) {
    // Save state when navigating to movie detail page, or to a game (per bug
    // report — popping over to Wordle and back should preserve whatever
    // search was active, the same way returning from a movie's detail page
    // already does; mounted()'s restore logic below is origin-agnostic, so
    // widening the save side here is the only piece that was missing).
    if (to.name === 'MovieDetail' || (to.path && to.path.startsWith('/games'))) {
      this.$store.commit('setHomePageScrollPosition', window.pageYOffset);
      this.$store.commit('setHomePageSearchChips', [...this.activeFilters]);
      this.$store.commit('setHomePageSearchValue', this.inputValue);
      this.$store.commit('setHomePageNumberOfResults', this.numberOfResultsToShow);
      this.$store.commit('setHomePageSortValue', this.sortValue);
      this.$store.commit('setHomePageSortOrder', this.sortOrder);
    } else {
      // Reset sorting for the NEXT Home visit — store commits only, never
      // the live component state. Bug report ("the whole bar seems to
      // shift a little bit to the right... the icon for the sort order is
      // disappearing"): this used to call setSortValue(null) on the
      // still-visible screen, which unmounted the sort icon's v-if for one
      // frame before navigation and visibly reflowed the rainbow bar. The
      // component is about to unmount; only the store needs resetting.
      this.$store.commit('setHomePageSortValue', null);
      this.$store.commit('setHomePageSortOrder', null);
      this.$store.commit('setDBSortValue', null);
    }
    next();
  },
  computed: {
    // Diagnostic only - see the liveDebugState watcher above.
    liveDebugState () {
      return {
        quickLink: this.activeQuickLinkList,
        typedSearch: this.inputValue || '',
        chips: this.activeFilters.map((filter) => `${filter.type}:${filter.value}`),
        resultsRendered: this.paginatedSortedResults.length,
        resultsMatched: this.sortedResults.length,
        libraryEntries: this.allEntriesWithFlatKeywordsAdded.length,
        numberToShow: this.numberOfResultsToShow,
        grouped: Boolean(this.groupedByAllCategories),
        sort: `${this.sortValue}/${this.sortOrder}`
      };
    },
    pendingReconciliations () {
      return this.$store.state.pendingReconciliations || [];
    },
    firstPendingReconciliationDbKey () {
      const entry = this.pendingReconciliations[0];
      return entry ? entry.dbEntry.path.split('movieLog/')[1] : '';
    },
    // The Games entry-point button shows the specific game's own icon (via
    // GAME_ICONS) whenever goToGames() would jump straight back into it, or
    // the generic controller icon whenever it would land on the hub
    // instead — same LAST_PLAYED_KEY lookup goToGames() itself does. A
    // plain computed (not reactive to localStorage) is fine here: the only
    // way LAST_PLAYED_KEY changes is by visiting a game and coming back,
    // which necessarily remounts Home.vue anyway.
    gamesButtonIcon () {
      const lastPlayed = lastPlayedGamePath(this.$router);
      return (lastPlayed && GAME_ICONS[lastPlayed]) || 'bi-dice-5';
    },
    tieBreakTweak () {
      const value = this.$store.state.settings?.tieBreakTweak;
      return typeof value === 'number' ? value : 1;
    },
    personalAwardName () {
      const value = this.$store.state.settings?.personalAwardName;
      return (typeof value === 'string' && value.length > 0) ? value : 'Oscar';
    },
    awardsYearThresholdInput () {
      return awardsYearThreshold(this.$store.state.settings);
    },
    showShorts () {
      const value = this.$store.state.settings?.includeShorts;
      return typeof value === 'boolean' ? value : false;
    },
    showErrorLogs () {
      const value = this.$store.state.settings?.showErrorLogs;
      return typeof value === 'boolean' ? value : false;
    },
    letterboxdConnected: {
      get () {
        const value = this.$store.state.settings?.letterboxdConnected;
        return typeof value === 'boolean' ? value : false;
      },
      set (value) {
        // Writable so `this.letterboxdConnected = true` (auto-connect) takes effect;
        // saveLetterboxdConnection() persists it to Firebase.
        this.$store.commit('setSettings', { ...(this.$store.state.settings || {}), letterboxdConnected: value });
      }
    },
    letterboxdUsername: {
      get () {
        const value = this.$store.state.settings?.letterboxdUsername;
        return typeof value === 'string' ? value : '';
      },
      set (value) {
        // Was getter-only, so v-model on the settings input couldn't write back —
        // a NEW user's typed username was dropped and saved as '' on blur. The
        // setter stores it in local settings; @blur saveLetterboxdUsername persists.
        this.$store.commit('setSettings', { ...(this.$store.state.settings || {}), letterboxdUsername: value });
      }
    },
    stickinessPromptState () {
      const value = this.$store.state.settings?.stickinessPromptState;
      return (typeof value === 'string' && ['disabled', 'normal', 'forced'].includes(value)) ? value : 'normal';
    },
    tieBreakPromptState () {
      const value = this.$store.state.settings?.tieBreakPromptState;
      return (typeof value === 'string' && ['disabled', 'normal', 'forced'].includes(value)) ? value : 'normal';
    },
    awardsPromptState () {
      const value = this.$store.state.settings?.awardsPromptState;
      return (typeof value === 'string' && ['disabled', 'normal', 'forced'].includes(value)) ? value : 'normal';
    },
    dailyAwardsYear () {
      return this.$store.state.settings?.dailyAwardsYear;
    },

    activeFiltersMinusTemps () {
      // Return only non-temporary filters
      return this.activeFilters.filter((filter) => !filter.temp);
    },
    // Drives the year-scroller special case (see the chip row template) —
    // true whenever ANY active chip is a plain 'year' type (not
    // 'yearRange'/decades). Follow-up: "I do want it to also be able to
    // work with other filters" — combining a year with e.g. a genre chip
    // still shows the scroller, with the genre chip rendered as a normal
    // badge below it (see otherActiveFilters).
    hasActiveYearChip () {
      return this.activeFiltersMinusTemps.some((filter) => filter.type === 'year');
    },
    activeYearChipValue () {
      const yearChip = this.activeFiltersMinusTemps.find((filter) => filter.type === 'year');
      if (!yearChip) return null;
      const parsed = parseInt(yearChip.value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    },
    // Everything the chip row still shows as a plain badge — every active
    // chip EXCEPT a 'year' one, which the scroller above represents
    // instead. Equals activeFiltersMinusTemps unchanged whenever no year
    // chip is active, so the plain chip row's existing behavior is
    // preserved exactly in that case.
    otherActiveFilters () {
      return this.activeFiltersMinusTemps.filter((filter) => filter.type !== 'year');
    },
    allActiveFilters () {
      const filters = [];

      // Add input text as a general search filter if it exists AND no chips are active at all
      // (avoid double filtering when any chips exist, temp or permanent)
      if (this.searchValue && this.searchValue.trim() && this.activeFilters.length === 0) {
        filters.push({
          id: '__input__',
          type: 'general',
          value: this.searchValue.trim(),
          display: this.searchValue.trim(),
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
    allCastCrew () {
      return Object.keys(this.countCastCrew).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countCastCrew[keyword]
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
      };
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
    allEntriesWithFlatKeywordsAdded () {
      return this.$store.getters.allMediaAsArray.map((result) => {
        // Use the shared keyword util so Home matches the detail page exactly,
        // including manually-added (customKeywords) and removed (removedKeywords)
        // keywords. An inline version here previously omitted those, so e.g. a
        // user-added "Star Wars" keyword was invisible to grouping/filtering.
        const movie = {
          ...result.movie,
          flatKeywords: computeFlatKeywords(result.movie)
        };
        // Precompute lowercased search fields ONCE here (memoized with this
        // computed) so applyFilter doesn't re-lowercase every movie per keystroke.
        return {
          ...result,
          movie,
          _search: this.buildSearchFields(movie)
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
    allKeywords () {
      return Object.keys(this.countedKeywords).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countedKeywords[keyword]
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
    allStudios () {
      return Object.keys(this.countStudios).map((keyword) => {
        return {
          name: this.titleCase(keyword),
          count: this.countStudios[keyword]
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
    availableYears () {
      const years = this.allEntriesWithFlatKeywordsAdded
        .map(movie => new Date(movie.movie.release_date).getFullYear())
        .filter(year => !isNaN(year));
      return [...new Set(years)].sort((a, b) => b - a);
    },
    // Bug report: "I want the years to go ascending to the right, not
    // descending... the next year should be to the right of the current
    // year, not the other way around." Reversed here rather than flipping
    // availableYears itself, because that same list also fills the "Add
    // Filter" Year <select>, where newest-first is the right default for
    // picking a recent year. Still one source of truth for WHICH years
    // exist - only the display order differs.
    availableYearsAscending () {
      return [...this.availableYears].reverse();
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
        return result.movie.id;
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
            movie,
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
    bestPicturesWithRatings () {
      return this.bestPictures.filter((result) => !result.falseEntry);
    },
    countCastCrew () {
      return countCastCrewUtil(this.allEntriesWithFlatKeywordsAdded, this.showShorts);
    },
    countDirectors () {
      return countDirectorsUtil(this.allEntriesWithFlatKeywordsAdded, this.showShorts);
    },
    countedGenres () {
      return countGenresUtil(this.allEntriesWithFlatKeywordsAdded, this.showShorts);
    },
    countedKeywords () {
      return countKeywordsUtil(this.allEntriesWithFlatKeywordsAdded, this.showShorts);
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
    countStudios () {
      return countStudiosUtil(this.allEntriesWithFlatKeywordsAdded, this.showShorts);
    },
    darkOrLight () {
      const inDarkMode = document.querySelector("body").classList.contains('bg-dark');

      return { 'text-bg-dark': inDarkMode, 'text-bg-light': !inDarkMode };
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
    DBSortValue () {
      return this.$store.state.DBSortValue;
    },
    displayableUnratedMovies () {
      const filtered = this.unratedMovies.filter(movie => movie.id && movie.poster_path);
      return filtered;
    },
    effectiveSearchFilter () {
      const typePriority = this.filterTypes;

      for (const type of typePriority) {
        const chipOfType = this.allActiveFilters.find(filter => filter.type === type);
        if (chipOfType) {
          return chipOfType;
        }
      }

      return null;
    },
    effectiveSearchTerm () {
      if (this.effectiveSearchFilter) {
        return this.effectiveSearchFilter.value;
      } else {
        return '';
      }
    },
    searchableTerms () {
      // The fuzzy-match index: every distinct, typed term drawn from the user's
      // OWN rated library. Reuses the count maps that are already computed for
      // the counts/filtering features, so building this is cheap. Each entry
      // carries the `expectedType` string that createFilterByType() understands
      // (NOT the internal applyFilter type), so a tapped suggestion builds the
      // correct chip. Titles have no expectedType and commit as a general chip,
      // matching how a typed title behaves today.
      const terms = [];
      const pushKeys = (countMap, expectedType, typeLabel) => {
        Object.keys(countMap || {}).forEach((value) => {
          if (value) {
            terms.push({ value, expectedType, typeLabel });
          }
        });
      };

      pushKeys(this.countDirectors, 'director', 'director');
      pushKeys(this.countCastCrew, 'cast/crew', 'cast/crew');
      pushKeys(this.countedKeywords, 'keyword', 'keyword');
      pushKeys(this.countedGenres, 'genre', 'genre');
      pushKeys(this.countStudios, 'studios', 'company');

      // Titles: distinct, committed as general (expectedType null).
      const seenTitles = new Set();
      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const title = result.movie.title;
        if (title && !seenTitles.has(title)) {
          seenTitles.add(title);
          terms.push({ value: title, expectedType: null, typeLabel: 'title' });
        }
      });

      return terms;
    },
    fuzzyIndex () {
      // Build the Fuse index ONCE per library change, not per keystroke. Vue
      // memoizes this computed, so it only rebuilds when searchableTerms changes
      // (i.e. when the rated library changes), turning a ~40ms-per-keystroke cost
      // into a one-time cost. didYouMeanSuggestions reuses this instance.
      if (this.searchableTerms.length === 0) {
        return null;
      }
      return new Fuse(this.searchableTerms, {
        keys: ['value'],
        threshold: 0.4, // Fuse default; loose enough for typos, tight enough to avoid noise
        ignoreLocation: true,
        minMatchCharLength: 3
      });
    },
    didYouMeanSuggestions () {
      // Typo-tolerant "Did you mean...?" fallback. Deliberately gated so the
      // fuzzy work NEVER runs on the common (has-results) path: it only fires
      // when the user has typed a non-trivial term that produced zero local
      // results. This keeps search fast and leaves the exact-match behavior of
      // groupedByAllCategories / unifiedFilteredResults completely unchanged.
      // Only ever suggest from the RAW typed input — never from effectiveSearchTerm
      // (a chip's value). The suggestions are typo-correction for what the user is
      // typing; firing them off a structured chip (e.g. a `year` chip "2010" that
      // legitimately matches no rated movies) showed nonsensical name/title
      // suggestions in place of the normal zero-results UI.
      const term = (this.searchValue || '').trim();

      if (term.length < 3) {
        return [];
      }
      // Only suggest when there are no local results to show. (showResultsList
      // is false here, which is the same branch that renders the "Search TMDB"
      // button — suggestions sit above it, never replacing it.)
      if (this.paginatedSortedResults.length > 0 || this.activeQuickLinkList !== 'title') {
        return [];
      }
      const fuse = this.fuzzyIndex;
      if (!fuse) {
        return [];
      }

      const results = fuse.search(term);
      const suggestions = [];
      const seen = new Set();

      for (const { item } of results) {
        // Skip a "suggestion" identical to what was typed (case-insensitive).
        if (item.value.toLowerCase() === term.toLowerCase()) {
          continue;
        }
        const dedupeKey = `${item.expectedType || 'title'}:${item.value.toLowerCase()}`;
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);
        suggestions.push(item);
        if (suggestions.length >= 5) {
          break;
        }
      }

      return suggestions;
    },
    // As many of the ranked suggestions (best first) as fit on one line next
    // to the "Did you mean?:" label, per didYouMeanFitCount - see
    // updateDidYouMeanFitCount for how that's kept in sync with the actual
    // rendered width. didYouMeanSuggestions itself stays a full ranked list
    // of up to 5 since the blur-guard and tests rely on its full shape.
    didYouMeanLineSuggestions () {
      return this.didYouMeanSuggestions.slice(0, this.didYouMeanFitCount);
    },
    groupOrder () {
      // Returns the active group hierarchy. Uses the user's daily override from
      // settings if it was saved today (local calendar day); otherwise reverts
      // to the default. Always returns every known group key so the full
      // hierarchy is preserved even when only some groups are reordered.
      const override = this.$store.state.settings.groupOrderOverride;

      if (override && Array.isArray(override.order) && override.date === new Date().toDateString()) {
        // Start from the saved order, then append any default keys it is missing
        // (e.g. a group type added after the override was saved) so nothing is
        // stranded out of the hierarchy.
        const saved = override.order.filter(key => DEFAULT_GROUP_ORDER.includes(key));
        const missing = DEFAULT_GROUP_ORDER.filter(key => !saved.includes(key));
        return [...saved, ...missing];
      }

      return [...DEFAULT_GROUP_ORDER];
    },
    groupedByAllCategories () {
      // Use debounced search for typing performance, but fall back to effectiveSearchTerm for chips
      let searchTerm;
      if (this.searchValue) {
        // User is typing - use debounced value for performance
        searchTerm = this.searchValue;
      } else if (this.activeFilters.length > 0) {
        // User has chips active - use effectiveSearchTerm
        searchTerm = this.effectiveSearchTerm;
      } else {
        return null;
      }

      if (!searchTerm || !searchTerm.toLowerCase) return null;
      const normalizedSearchTerm = searchTerm.toLowerCase();

      // Only show grouped results when we have a simple search term
      // Skip if we have multiple chips or quick links active
      if (this.activeFilters.filter(f => !f.temp).length > 1 || this.activeQuickLinkList !== 'title') {
        return null;
      }

      // Skip if the search term is too short or too generic
      if (normalizedSearchTerm.length < 3) {
        return null;
      }

      // Skip for very common/generic terms that will match too many movies
      const genericTerms = ['war', 'love', 'man', 'the', 'and', 'new', 'black', 'red', 'big', 'american', 'last', 'first'];
      if (genericTerms.includes(normalizedSearchTerm)) {
        return null;
      }

      // Check if this is a year search - if so, bypass grouping and use normal results
      if (this.detectYearTypes(searchTerm)) {
        return null; // Let normal filtering handle years
      }

      // Performance optimization: Skip expensive computation if we have no results to group
      if (!this.allEntriesWithFlatKeywordsAdded || this.allEntriesWithFlatKeywordsAdded.length === 0) {
        return null;
      }

      const allResults = this.allEntriesWithFlatKeywordsAdded;

      // Step 1: Compute candidate matches for each fixed-type group. Done in a
      // SINGLE pass over the library instead of one full filter() pass per group
      // (previously ~7 passes). The candidate SETS are identical to before — a
      // movie is still a candidate in every group whose filter it matches — so
      // the later priority-claiming behavior is unchanged. We only collapse the
      // iteration so applyFilter is evaluated per movie in one loop.
      const groupConfigs = [
        { key: 'title', displayName: 'Title Matches', filter: { type: 'title', value: searchTerm } },
        { key: 'director', displayName: 'Director', filter: { type: 'director', value: searchTerm } },
        { key: 'cast', displayName: 'Cast', filter: { type: 'cast', value: searchTerm } },
        { key: 'producer', displayName: 'Producer', filter: { type: 'producer', value: searchTerm } },
        { key: 'company', displayName: 'Production Companies', filter: { type: 'company', value: searchTerm } }
      ];

      const candidatesByKey = {};
      groupConfigs.forEach(config => {
        candidatesByKey[config.key] = { displayName: config.displayName, movies: [] };
      });
      candidatesByKey['keyword-genre'] = { displayName: 'Keywords & Genres', movies: [] };

      // Inlined matcher (perf): instead of 7 dispatched applyFilter calls per
      // movie (each re-reading/re-deriving the same data), read each movie's
      // precomputed _search ONCE and evaluate all group conditions against it.
      // Every condition below mirrors the corresponding applyFilter case EXACTLY,
      // so candidate sets are identical — GroupOrdering.test.js guards this.
      // genre/company stay case-sensitive against the raw searchTerm (matching
      // applyFilter's `genre`/`company` cases); everything else uses lowercased.
      const term = searchTerm.toLowerCase();
      const titleBucket = candidatesByKey.title.movies;
      const directorBucket = candidatesByKey.director.movies;
      const castBucket = candidatesByKey.cast.movies;
      const producerBucket = candidatesByKey.producer.movies;
      const companyBucket = candidatesByKey.company.movies;
      const keywordGenreBucket = candidatesByKey['keyword-genre'].movies;

      allResults.forEach(media => {
        const s = media._search || this.buildSearchFields(media.movie);

        if (s.title.includes(term)) titleBucket.push(media);
        if (s.crew.some(p => p.job === 'Director' && p.name.includes(term))) directorBucket.push(media);
        if (s.cast.some(n => n.includes(term))) castBucket.push(media);
        if (s.crew.some(p => p.jobLower.includes('producer') && p.name.includes(term))) producerBucket.push(media);

        const companies = media.movie.production_companies;
        if (companies && companies.some(c => c.name === searchTerm)) companyBucket.push(media);

        // Keywords and Genres are merged into a single "Keywords & Genres" group.
        const genres = media.movie.genres;
        if (s.keywords.some(k => k === term) ||
            (genres && genres.some(g => g.name === searchTerm))) {
          keywordGenreBucket.push(media);
        }
      });

      // Step 2: Walk groupOrder and claim movies in priority order. A movie claimed
      // by an earlier group will not appear in a later one.
      const categories = [];
      const usedMovieIds = new Set();

      this.groupOrder.forEach(key => {
        const candidate = candidatesByKey[key];
        if (!candidate) return; // role-detected keys (writer/music/etc.) handled below

        const matches = candidate.movies.filter(media => !usedMovieIds.has(media.movie.id));
        if (matches.length > 0) {
          const sortedMatches = this.sortResultsFast(matches);
          categories.push({
            category: key,
            categoryDisplay: candidate.displayName,
            movies: sortedMatches
          });
          sortedMatches.forEach(movie => usedMovieIds.add(movie.movie.id));
        }
      });

      // Add catchall section with intelligent role detection for remaining movies
      const uncategorizedMovies = allResults.filter(media =>
        !usedMovieIds.has(media.movie.id) &&
        this.applyFilter(media, { type: 'general', value: searchTerm })
      );

      if (uncategorizedMovies.length > 0) {
        // Try to intelligently categorize the uncategorized movies by person role
        const adHocCategories = {};
        const trulyUncategorized = [];

        uncategorizedMovies.forEach(media => {
          const movie = media.movie;
          let foundRole = false;

          // Helper function for full-word matching
          const hasFullWordMatch = (personName, searchTerm) => {
            if (!personName) return false;
            const personWords = personName.toLowerCase().split(' ');
            const searchWords = searchTerm.toLowerCase().split(' ');
            return searchWords.some(searchWord =>
              personWords.some(personWord => personWord === searchWord)
            );
          };

          // Check if person appears in cast
          if (movie.cast) {
            const castMatch = movie.cast.find(person =>
              hasFullWordMatch(person.name, searchTerm)
            );
            if (castMatch) {
              if (!adHocCategories.cast) adHocCategories.cast = [];
              adHocCategories.cast.push(media);
              foundRole = true;
            }
          }

          // Check if person appears in crew (only if not already found in cast)
          if (!foundRole && movie.crew) {
            const crewMatch = movie.crew.find(person =>
              hasFullWordMatch(person.name, searchTerm)
            );
            if (crewMatch) {
              let roleCategory = 'Crew';

              // Categorize specific crew roles
              if (crewMatch.job === 'Director') {
                roleCategory = 'Director';
              } else if (crewMatch.job && crewMatch.job.toLowerCase().includes('producer')) {
                roleCategory = 'Producer';
              } else if (crewMatch.job && ['Writer', 'Screenplay', 'Story', 'Novel'].includes(crewMatch.job)) {
                roleCategory = 'Writer';
              } else if (crewMatch.job && (crewMatch.job.toLowerCase().includes('composer') ||
                        crewMatch.job.toLowerCase().includes('music') ||
                        crewMatch.job.toLowerCase().includes('score'))) {
                roleCategory = 'Music';
              } else if (crewMatch.job && crewMatch.job.toLowerCase().includes('editor')) {
                roleCategory = 'Editor';
              } else if (crewMatch.job && (crewMatch.job.toLowerCase().includes('photo') ||
                                        crewMatch.job.toLowerCase().includes('cinematographer') ||
                                        crewMatch.job.toLowerCase().includes('director of photography'))) {
                roleCategory = 'Cinematographer';
              }

              if (!adHocCategories[roleCategory]) adHocCategories[roleCategory] = [];
              adHocCategories[roleCategory].push(media);
              foundRole = true;
            }
          }

          // If no specific role found, add to truly uncategorized
          if (!foundRole) {
            trulyUncategorized.push(media);
          }
        });

        // Add ad-hoc categories to the results, but avoid duplicating existing categories
        Object.keys(adHocCategories).forEach(roleCategory => {
          const movies = adHocCategories[roleCategory];
          const categoryKey = roleCategory.toLowerCase();

          // Check if this category already exists
          const existingCategory = categories.find(cat => cat.category === categoryKey);

          if (movies.length > 0) {
            if (existingCategory) {
              // Merge movies into existing category
              existingCategory.movies.push(...movies);
              // Re-sort the combined movies
              existingCategory.movies = this.sortResultsFast(existingCategory.movies);
            } else {
              // Create new category
              const sortedMovies = this.sortResultsFast(movies);
              categories.push({
                category: categoryKey,
                categoryDisplay: roleCategory.charAt(0).toUpperCase() + roleCategory.slice(1),
                movies: sortedMovies
              });
            }
          }
        });

        // Add truly uncategorized movies as "Other" if any remain
        if (trulyUncategorized.length > 0) {
          const sortedUncategorized = this.sortResultsFast(trulyUncategorized);
          categories.push({
            category: 'other',
            categoryDisplay: 'Other',
            movies: sortedUncategorized
          });
        }
      }

      if (categories.length === 0) {
        return null;
      }

      // Order all categories (including role-detected ones) by the user's
      // chosen hierarchy. Any key not present in groupOrder sorts to the end.
      const orderIndex = (key) => {
        const idx = this.groupOrder.indexOf(key);
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
      };
      categories.sort((a, b) => orderIndex(a.category) - orderIndex(b.category));

      return categories;
    },
    reorderableGroups () {
      // The list shown in the reorder panel. It must include every group that
      // COULD be visible under some ordering — not just the ones that survived
      // claiming under the current order — otherwise a group that another group
      // emptied would vanish from the panel and you couldn't move it back up.
      const grouped = this.groupedByAllCategories;
      if (!grouped) {
        return [];
      }

      // Counts for the groups that are actually rendered right now.
      const currentCountByKey = {};
      grouped.forEach(group => {
        currentCountByKey[group.category] = group.movies.length;
      });

      // Fixed-type groups (title/director/cast/producer/company/keyword-genre)
      // have order-independent candidate sets, so any with candidates could be
      // shown if prioritized. We surface all of them; role-detected groups
      // (writer/music/etc./other) are leftover-derived and naturally reappear
      // when movies free up, so we include those only while currently present.
      const searchTerm = this.searchValue || this.effectiveSearchTerm;
      const fixedCandidateKeys = new Set();
      if (searchTerm) {
        const allResults = this.allEntriesWithFlatKeywordsAdded;
        const fixedFilters = [
          { key: 'title', filter: { type: 'title', value: searchTerm } },
          { key: 'director', filter: { type: 'director', value: searchTerm } },
          { key: 'cast', filter: { type: 'cast', value: searchTerm } },
          { key: 'producer', filter: { type: 'producer', value: searchTerm } },
          { key: 'company', filter: { type: 'company', value: searchTerm } }
        ];
        fixedFilters.forEach(({ key, filter }) => {
          if (allResults.some(media => this.applyFilter(media, filter))) {
            fixedCandidateKeys.add(key);
          }
        });
        const hasKeywordOrGenre = allResults.some(media =>
          this.applyFilter(media, { type: 'keyword', value: searchTerm }) ||
          this.applyFilter(media, { type: 'genre', value: searchTerm })
        );
        if (hasKeywordOrGenre) {
          fixedCandidateKeys.add('keyword-genre');
        }
      }

      // Union: every currently-rendered group + every fixed group with candidates.
      const keys = new Set([...Object.keys(currentCountByKey), ...fixedCandidateKeys]);

      const displayName = (key) => {
        const present = grouped.find(g => g.category === key);
        if (present) return present.categoryDisplay;
        return GROUP_DISPLAY_NAMES[key] || (key.charAt(0).toUpperCase() + key.slice(1));
      };

      return [...keys]
        .sort((a, b) => this.groupOrder.indexOf(a) - this.groupOrder.indexOf(b))
        .map(key => ({
          category: key,
          categoryDisplay: displayName(key),
          count: currentCountByKey[key] || 0
        }));
    },
    isMatt () {
      return this.$store.state.databaseTopKey === "mattgrosso-gmail-com" || !this.$store.state.databaseTopKey;
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
    matchingTags () {
      return this.allEntriesWithFlatKeywordsAdded.filter((result) => {
        return result.ratings.map((rating) => rating.tags || []).flat().map((tag) => tag.title).includes(this.activeQuickLinkList);
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
        const movie = result.movie;

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
    paginatedSortedResults () {
      return this.sortedResults.slice(0, this.numberOfResultsToShow);
    },
    canLoadMore () {
      return !this.groupedByAllCategories && this.sortedResults.length > this.numberOfResultsToShow;
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
    resultsAreFiltered () {
      return this.activeFilters.length > 0 || this.activeQuickLinkList !== 'title';
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
    // Stickiness inline computed properties
    firstStickinessResult () {
      return this.resultsThatNeedStickiness[0];
    },
    allMoviesRanked () {
      const movies = [...this.$store.getters.allMoviesAsArray];
      return movies.sort(this.sortByRating);
    },
    ratingWithoutStickiness () {
      if (!this.firstStickinessResult) return null;
      const tempResult = cloneDeep(this.firstStickinessResult);
      tempResult.ratings[this.mostRecentRatingIndex].stickiness = null;
      return getRating(this.firstStickinessResult).calculatedTotal;
    },
    ratingWithStickiness () {
      if (!this.stickinessRating && this.stickinessRating !== 0 && this.stickinessRating !== "0") {
        return null;
      }
      if (!this.firstStickinessResult) return null;
      const tempResult = cloneDeep(this.firstStickinessResult);
      tempResult.ratings[this.mostRecentRatingIndex].stickiness = parseFloat(this.stickinessRating);
      return getRating(tempResult).calculatedTotal;
    },
    rankWithoutStickiness () {
      if (!this.firstStickinessResult) return null;
      return this.allMoviesRanked.findIndex((movie) => movie.dbKey === this.firstStickinessResult.dbKey) + 1;
    },
    rankWithStickiness () {
      if (!this.firstStickinessResult || !this.stickinessRating) return null;
      const tempResult = cloneDeep(this.firstStickinessResult);
      tempResult.ratings[this.mostRecentRatingIndex].stickiness = parseFloat(this.stickinessRating);
      const movies = [...this.$store.getters.allMoviesAsArray];
      const movieIndex = movies.findIndex((movie) => movie.dbKey === this.firstStickinessResult.dbKey);
      movies[movieIndex] = tempResult;
      const sortedMovies = movies.sort(this.sortByRating);
      return sortedMovies.findIndex((movie) => movie.dbKey === tempResult.dbKey) + 1;
    },
    mostRecentRatingIndex () {
      if (!this.firstStickinessResult) return 0;
      let mostRecentRating = this.firstStickinessResult.ratings[0];
      let mostRecentRatingIndex = 0;
      this.firstStickinessResult.ratings.forEach((rating, index) => {
        const ratingDate = rating.date ? new Date(rating.date).getTime() : 0;
        const mostRecentRatingDate = mostRecentRating.date ? new Date(mostRecentRating.date).getTime() : 0;
        if (!mostRecentRating.date) {
          mostRecentRating = rating;
          mostRecentRatingIndex = index;
        } else if (ratingDate && ratingDate > mostRecentRatingDate) {
          mostRecentRating = rating;
          mostRecentRatingIndex = index;
        }
      })
      return mostRecentRatingIndex;
    },
    showSixMonthMessage () {
      if (!this.firstStickinessResult) return false;
      return this.mostRecentRating(this.firstStickinessResult).userAddedStickiness;
    },
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    showResultsList () {
      return Boolean(this.paginatedSortedResults.length) || this.activeQuickLinkList !== "title";
    },
    // Determine which modal should be active (eliminates circular dependencies)
    activeModalType () {
      // Check forced states first (highest priority)
      if (this.stickinessPromptState === 'forced') {
        return 'stickiness';
      }
      if (this.tieBreakPromptState === 'forced') {
        return 'tieBreak';
      }
      if (this.awardsPromptState === 'forced') {
        return 'awards';
      }

      // Check disabled states
      const stickinessDisabled = this.stickinessPromptState === 'disabled';
      const tieBreakDisabled = this.tieBreakPromptState === 'disabled';
      const awardsDisabled = this.awardsPromptState === 'disabled';

      // Check if stickiness should show (highest priority in normal mode)
      const shouldShowStickiness = !stickinessDisabled &&
        Boolean(this.allEntriesWithFlatKeywordsAdded.length && this.resultsThatNeedStickiness.length);

      // Check if tie break should show (second priority)
      const shouldShowTieBreak = !tieBreakDisabled && this.shouldShowTieBreakModal;

      // Check if awards should show (lowest priority)
      const shouldShowAwards = !awardsDisabled && this.shouldShowAwardsModal;

      // Return the highest priority modal that should be shown
      if (shouldShowStickiness) return 'stickiness';
      if (shouldShowTieBreak) return 'tieBreak';
      if (shouldShowAwards) return 'awards';

      return null;
    },

    showStickinessModal () {
      return this.activeModalType === 'stickiness';
    },
    showTweakModal () {
      return this.activeModalType === 'tieBreak';
    },

    shouldShowTieBreakModal () {
      // Include forceModalReevaluation to make this computed re-evaluate on the periodic modal re-check
      // eslint-disable-next-line no-unused-vars
      const _ = this.forceModalReevaluation;

      // A tournament record existing at all (whether mid-tournament or just
      // completed and awaiting acknowledgment — see tieBreakTournament.js)
      // always has something to show next; it's only cleared once the user
      // taps "Done" on the results screen. Only fall back to a fresh tie
      // scan when there's no record, so a movie rated mid-tournament that
      // happens to also tie never gets swept into it (TweakInline.vue owns
      // actually starting a new one).
      const hasTiedResults = Boolean(this.$store.state.settings?.tieBreakTournament) ||
        findTiedGroup(this.sortedByRating, (movie) => getRating(movie).calculatedTotal).length >= 2;

      if (!hasTiedResults) {
        return false;
      }

      const lastTweak = this.$store.state.settings.lastTweak || Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const maxDailyTieBreaks = this.$store.state.settings.tieBreakTweak || 1;
      const dueForTieBreak = Date.now() - lastTweak > (oneDay / maxDailyTieBreaks);

      return dueForTieBreak;
    },
    showAwardsModal () {
      return this.activeModalType === 'awards';
    },

    shouldShowAwardsModal () {
      // Include forceModalReevaluation to make this computed re-evaluate on the periodic modal re-check
      // eslint-disable-next-line no-unused-vars
      const _ = this.forceModalReevaluation;

      // Don't show until database is loaded to prevent flash
      if (!this.$store.state.dbLoaded) {
        console.log('❌ Database not loaded yet');
        return false;
      }

      // Check if a specific year is manually requested (e.g., from Resume Awards button)
      const settings = this.$store.state.settings;
      if (!settings) {
        return false; // Settings not loaded yet
      }

      const today = new Date().toDateString();
      const dailyAwardsYear = settings.dailyAwardsYear;
      const dailyAwardsYearDate = settings.dailyAwardsYearDate;

      // If a specific year is requested for today, bypass the daily limit
      if (dailyAwardsYear && dailyAwardsYearDate === today) {
        return true;
      }

      const lastAwardDate = settings.lastAwardCompletionDate;

      // If lastAwardDate is undefined, we need to determine if this is because:
      // 1. Settings haven't loaded yet (return false to prevent flash)
      // 2. User has never completed awards (continue with normal logic)
      if (lastAwardDate === undefined) {
        // Check if there are any existing personal awards - if so, settings are loaded
        const hasExistingAwards = settings.personalAwards && Object.keys(settings.personalAwards).length > 0;

        if (!hasExistingAwards) {
          // No existing awards data suggests settings might not be fully loaded yet
          // or this is truly a new user. To be safe, check if other expected settings exist
          const hasOtherSettings = Object.prototype.hasOwnProperty.call(settings, 'includeShorts') ||
                                    Object.prototype.hasOwnProperty.call(settings, 'normalizationTweak') ||
                                    Object.prototype.hasOwnProperty.call(settings, 'letterboxdUsername') ||
                                    Object.prototype.hasOwnProperty.call(settings, 'personalAwardName');

          if (!hasOtherSettings) {
            return false; // Settings likely not loaded yet
          }
        }
        // If we get here, settings are loaded but user just hasn't done awards before
      } else if (lastAwardDate === today) {
        return false; // Already did awards today
      }

      // Check if there are any years with 10+ rated movies that don't have completed awards
      const yearCounts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach(entry => {
        // Exclude shorts (<40min) from awards consideration
        if (entry.movie.runtime && entry.movie.runtime <= 40) {
          return;
        }

        const year = new Date(entry.movie.release_date).getFullYear();
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      });

      const eligibleYears = Object.keys(yearCounts)
        .filter(year => yearCounts[year] >= 10)
        .map(year => parseInt(year));

      // Check if any eligible years need awards (either new or have new movies)
      const hasEligibleYears = eligibleYears.some(year => {
        const existingAwards = this.$store.state.settings.personalAwards?.[year];
        if (!existingAwards) return true; // New year needs awards

        // CRITICAL FIX: If awards exist but were NOT explicitly completed via "Complete Awards" button,
        // the year should still be eligible (this covers partial progress)
        if (!existingAwards.completed) {
          return true;
        }

        // If explicitly completed, check if there are new movies since last awards update
        if (!existingAwards.lastUpdated) return true;

        const newMovies = this.allEntriesWithFlatKeywordsAdded.filter(entry => {
          const entryYear = new Date(entry.movie.release_date).getFullYear();
          if (entryYear !== year) return false;

          const movieDate = new Date(entry.ratings[0]?.date || entry.movie.release_date);
          return movieDate.getTime() > existingAwards.lastUpdated;
        });

        return newMovies.length > 0;
      });

      return hasEligibleYears;
    },
    sortedByRating () {
      const allMediaSortedByRating = this.$store.getters.allMediaSortedByRating;

      if (this.sortOrder === 'bestOrNewestOnTop') {
        return allMediaSortedByRating;
      } else {
        return allMediaSortedByRating.slice().reverse();
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
    sortedResults () {
      return this.sortResultsFast(this.unifiedFilteredResults);
    },
    suggestionsButtonLabel () {
      return this.userRatedMovieCount === 0
        ? 'Suggest some movies to rate'
        : 'Suggest more movies to rate';
    },
    tags () {
      if (this.$store.state?.settings?.tags?.['viewing-tags']) {
        return Object.values(this.$store.state.settings.tags['viewing-tags']).map(tag => tag.title);
      } else {
        return [];
      }
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
    topDirectors () {
      return Object.entries(this.allCounts.directors || {})
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    },
    topGenres () {
      return Object.entries(this.allCounts.genres || {})
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    },
    displayedResults () {
      // The cards actually on screen. When the grouped view is active the grid
      // renders groupedByAllCategories (which layers in title/cast matches on
      // top of the keyword chip), so the badge/avg/views should reflect those
      // unique movies. Otherwise fall back to the filtered set.
      if (this.groupedByAllCategories) {
        const seen = new Set();
        const unique = [];
        this.groupedByAllCategories.forEach(group => {
          group.movies.forEach(result => {
            if (!seen.has(result.movie.id)) {
              seen.add(result.movie.id);
              unique.push(result);
            }
          });
        });
        return unique;
      }
      return this.unifiedFilteredResults;
    },
    unifiedFilteredResults () {
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
          // ALL filters must match (AND logic)
          return this.allActiveFilters.every(filter => {
            return this.applyFilter(result, filter);
          });
        });
      }

      // Step 3: Exclude shorts if showShorts is false
      if (!this.showShorts) {
        results = results.filter(result => {
          // Consider as short if runtime <= 40 min
          return !(result.movie.runtime && result.movie.runtime <= 40);
        });
      }

      return results;
    },
    userRatedMovieCount () {
      // Count the number of movies the user has rated (not TV shows)
      return this.allEntriesWithFlatKeywordsAdded.length;
    },
    isBrandNewUser () {
      // dbLoaded is load-bearing, not belt-and-braces: until the library
      // arrives userRatedMovieCount is 0, which is indistinguishable from a
      // genuinely new account. Without this an established user sees a flash
      // of the "want help getting started?" onboarding on every fresh load.
      // (The window widened when initializeDB started awaiting authReady.)
      // A denied read is NOT a new user — LibraryAccessBanner owns that
      // case, and welcoming someone whose library exists but can't be read
      // would send exactly the wrong message.
      return this.$store.state.dbLoaded && !this.$store.state.dbReadDenied && this.userRatedMovieCount === 0;
    },
    // A genuinely 0-rated user has nothing else to look at, so the "rate
    // something to get started" suggestions show immediately - no reason to
    // make them tap a button first, unlike the 1-9 range below (where they've
    // already started and a standing button would be more nag than help).
    shouldShowStartSuggestions () {
      if (this.userRatedMovieCount >= 10) {
        return false;
      }
      return this.showSuggestionsOnly || (this.isBrandNewUser && !this.dismissedWelcomeSuggestions);
    },
    userTags () {
      return this.tags.slice(0, 20); // Limit to 20 most recent tags
    },
  },
  methods: {

    // Event handlers for form changes (replaces watchers)
    onStickinessUpdated () {
      // Force reactivity update for stickiness-related computed properties
      this.$forceUpdate();
    },
    onTweakUpdated () {
      // Force reactivity update for tweak-related computed properties
      this.$forceUpdate();
    },
    updateShowShorts (event) {
      const newVal = event.target.checked;
      ErrorLogService.debug('updateShowShorts handler fired', { newVal, component: 'Home' });
      this.$store.dispatch('writeDurably', { path: 'settings/includeShorts', value: newVal });
    },
    updateShowErrorLogs (event) {
      const newVal = event.target.checked;
      ErrorLogService.debug('updateShowErrorLogs handler fired', { newVal, component: 'Home' });
      this.$store.dispatch('setDBValue', { path: 'settings/showErrorLogs', value: newVal });
      if (newVal) {
        this.refreshErrorLogs();
        // Start auto-refresh when logs are visible
        this.startErrorLogRefresh();
      } else {
        this.stopErrorLogRefresh();
      }
    },

    buildCastMembersCache () {
      // Clear any existing cache
      this.cachedCastMembers = new Set();

      // Process each movie entry once
      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const cast = result.movie?.cast || [];

        // Add each cast member's name to the Set
        cast.forEach(person => {
          if (person.name) {
            this.cachedCastMembers.add(person.name.toLowerCase());
          }

          const lastName = person.name ? person.name.split(' ').slice(-1)[0].toLowerCase() : '';
          if (lastName) {
            this.cachedCastMembers.add(lastName);
          }
        });
      });
    },
    // Search/filter/sort logic lives in ../assets/javascript/searchFiltering.js
    // (pure, unit-tested in isolation). These thin wrappers feed it component state.
    buildSearchFields (movie) {
      return buildSearchFieldsUtil(movie);
    },
    applyFilter (result, filter) {
      return applyFilterUtil(result, filter);
    },
    getListOfYearsFromRange (yearRange) {
      return getListOfYearsFromRangeUtil(yearRange);
    },
    toggleSettingsPanel () {
      this.showSettingsPanel = !this.showSettingsPanel;
    },
    handleCancelSuggestions () {
      // Covers both paths that can land here: a 1-9-rated user tapping the
      // "Suggest more movies" button closed again, and a brand new (0-rated)
      // user dismissing the auto-shown welcome suggestions to search directly
      // instead (falls through to the plain "Search for a movie..." prompt).
      this.showSuggestionsOnly = false;
      this.dismissedWelcomeSuggestions = true;
    },
    toggleGroupOrderPanel () {
      this.showGroupOrderPanel = !this.showGroupOrderPanel;
    },
    // Entry point for reordering groups is now each group's own header
    // (the dedicated button was removed to make room for the Games button
    // in the results-actions bar) — always opens (rather than toggling) and
    // scrolls the panel into view, since the tapped header is very likely
    // scrolled well below it.
    openGroupOrderPanel () {
      this.showGroupOrderPanel = true;
      this.$nextTick(() => {
        this.$refs.groupOrderPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    moveGroupUp (categoryKey) {
      this.swapGroupWithNeighbor(categoryKey, -1);
    },
    moveGroupDown (categoryKey) {
      this.swapGroupWithNeighbor(categoryKey, 1);
    },
    swapGroupWithNeighbor (categoryKey, direction) {
      // The panel shows every group that could be visible under some ordering
      // (reorderableGroups), so moving swaps within that list and absent master
      // keys keep their slots. direction: -1 = up, 1 = down.
      const presentKeys = this.reorderableGroups.map(group => group.category);
      const presentIndex = presentKeys.indexOf(categoryKey);
      const neighborIndex = presentIndex + direction;
      if (presentIndex === -1 || neighborIndex < 0 || neighborIndex >= presentKeys.length) {
        return; // already at an edge of the visible list
      }
      const neighborKey = presentKeys[neighborIndex];

      const newOrder = [...this.groupOrder];
      const from = newOrder.indexOf(categoryKey);
      const to = newOrder.indexOf(neighborKey);
      if (from === -1 || to === -1) {
        return;
      }
      newOrder.splice(from, 1);
      newOrder.splice(to, 0, categoryKey);

      this.persistGroupOrder(newOrder);
    },
    resolveBanner () {
      // Pick the header banner from how the user arrived (store.bannerRequest, set
      // by MovieDetail / RateMovie / search links). Runs on each home arrival and
      // once when the library first loads. Context picks ignore the rating floor;
      // the no-context fresh pick keeps the >6 floor and only fires when no banner
      // is set yet, so contextless returns to home don't re-randomize.
      const entries = this.allEntriesWithFlatKeywordsAdded;
      if (!entries || !entries.length) return; // data not ready; watcher retries

      const req = this.$store.state.bannerRequest;
      this.$store.commit('setBannerRequest', null); // consume

      let media = null;
      if (req && req.type === 'movie' && req.movieId != null) {
        media = entries.find(e => e.movie && e.movie.id === req.movieId) || null;
      } else if (req && req.type === 'fromResults') {
        const pool = this.displayedResults;
        if (pool && pool.length) {
          media = pool[Math.floor(Math.random() * pool.length)];
        }
      }

      if (!media) {
        // No resolvable context: keep the current banner if we have one (don't
        // swap on a plain return home); otherwise pick a fresh movie rated > 6.
        if (this.$store.state.bannerUrl) return;
        const overSix = entries.filter(e => this.mostRecentRating(e).calculatedTotal > 6);
        const pool = overSix.length ? overSix : entries;
        if (pool.length) {
          media = pool[Math.floor(Math.random() * pool.length)];
        }
      }

      if (media && media.movie) {
        // customBackdropPath is stored at the entry level (sibling of movie),
        // matching MovieDetail.selectBackdrop + getBackdropPath. Reading it from
        // media.movie left the home banner on the default after a custom pick.
        const backdrop = media.customBackdropPath || media.movie.backdrop_path;
        const url = backdrop
          ? `https://image.tmdb.org/t/p/w500${backdrop}`
          : 'https://www.solidbackgrounds.com/images/1920x1080/1920x1080-black-solid-color-background.jpg';
        this.$store.commit('setBannerUrl', url);
      }
    },
    applyPromoteGroup () {
      const promoteKey = this.$store.state.homePagePromoteGroup;
      this.$store.commit('setHomePagePromoteGroup', null); // consume it
      if (!promoteKey || !DEFAULT_GROUP_ORDER.includes(promoteKey)) {
        return;
      }
      // Move the promoted key to the front of the current order and persist it
      // as today's override.
      const newOrder = [promoteKey, ...this.groupOrder.filter(key => key !== promoteKey)];
      this.persistGroupOrder(newOrder);
    },
    persistGroupOrder (order) {
      // Save as a daily override in settings. Reverts to default automatically
      // tomorrow because groupOrder ignores overrides whose date isn't today.
      const override = { order, date: new Date().toDateString() };

      // Update local store state optimistically so the grouped view re-evaluates
      // immediately, rather than waiting for the Firebase write to echo back.
      this.$store.commit('setSettings', {
        ...this.$store.state.settings,
        groupOrderOverride: override
      });

      this.$store.dispatch('setDBValue', {
        path: 'settings/groupOrderOverride',
        value: override
      });
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
        this.clearAllFilters();
        this.updateSearchValue(randomValue, false, randomList);
        this.sortOrder = "bestOrNewestOnTop";
      } else {
        const allValues = Object.keys(counts || {}).filter(key => counts[key] > 0);
        if (allValues.length > 0) {
          const randomIndex = Math.floor(Math.random() * allValues.length);
          const fallbackValue = allValues[randomIndex];
          this.clearAllFilters();
          this.updateSearchValue(fallbackValue, true, randomList);
          this.sortOrder = "bestOrNewestOnTop";
        } else {
          this.clearInput();
        }
      }
    },
    async wikiLinkFor (searchValue) {
      let wiki;
      try {
        wiki = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrnamespace=0&gsrlimit=5&gsrsearch=%27${searchValue}%27`);
      } catch {
        return ''; // offline/blocked: the chip just doesn't open (2026-08-15 audit)
      }
      if (!wiki || !wiki.data || !wiki.data.query || !wiki.data.query.pages) {
        return '';
      }
      const pages = wiki.data.query.pages;
      const pagesArray = Object.keys(pages).map((page) => pages[page]);
      const bestMatch = minBy(pagesArray, (page) => page.index);

      return `https://en.m.wikipedia.org/w/index.php?curid=${bestMatch.pageid}`;
    },
    async goToWikipediaForChip () {
      if (this.activeFilters.length === 1) {
        const chip = this.activeFilters[0];
        this.insetBrowserUrl = await this.wikiLinkFor(chip.value);
        this.showInsetBrowserModal = true;
      }
    },
    showMovieInfo (movie) {
      this.selectedMovieInfo = movie;
      this.showMovieInfoModal = true;
      document.body.classList.add('no-scroll');
    },
    closeMovieInfoModal () {
      this.showMovieInfoModal = false;
      this.selectedMovieInfo = null;
      document.body.classList.remove('no-scroll');
    },
    rateMovieFromModal () {
      if (this.selectedMovieInfo) {
        this.$store.commit('setMovieToRate', this.selectedMovieInfo);
        // Remove the modal's scroll-lock before navigating away — otherwise
        // body.no-scroll leaks onto every subsequent screen (see router afterEach).
        this.closeMovieInfoModal();
        this.$router.push('/rate-movie');
        // Scroll to top when navigating to rate movie page
        this.$nextTick(() => {
          scrollWindowTo(0);
        });
      }
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
        ErrorLogService.error('Failed to fetch Letterboxd data', {
          username,
          error: error.message,
          stack: error.stack
        });
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
    updateSearchValue (value, isAutoRandom = false, expectedType = null) {
      // If we have a value, clear existing filters first then add the new search
      if (value && value.trim()) {
        this.replaceAllFiltersWithSearch(value, isAutoRandom, expectedType);
      } else {
        this.clearInput();
      }

      window.scroll({
        top: 0,
        left: 0,
        behavior: 'instant'
      });
    },
    replaceAllFiltersWithSearch (value, isAutoRandom = false, expectedType = null) {
      // Blur the search input first to prevent layout shifts
      if (this.$refs.searchInput) {
        this.$refs.searchInput.blur();
      }

      if (!value || !value.trim()) return;

      const trimmedTerm = value.trim();

      // If we know the expected type (from random search), use it directly
      let searchType;
      if (expectedType) {
        searchType = this.createFilterByType(expectedType, trimmedTerm);
      } else {
        // Otherwise detect what type of filter this should be
        searchType = this.detectFilterType(trimmedTerm);
      }

      // Create the new filter
      const newFilter = {
        id: `${searchType.type}-${Date.now()}`,
        type: searchType.type,
        value: searchType.value,
        display: searchType.display,
        temp: isAutoRandom // Mark as temporary if it's from auto-random
      };

      // Replace all filters with this single new one in one operation
      this.activeFilters = [newFilter];
      this.activeQuickLinkList = 'title';
      this.inputValue = '';
      this.hasAutoRandomChip = isAutoRandom;
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
        // Add tag as a chip instead of using activeQuickLinkList for multi-tag support
        this.activeFilters.push({
          id: `tag-${Date.now()}`,
          type: 'tag',
          value,
          display: `${value}`
        });
        this.sortOrder = "bestOrNewestOnTop";
      } else {
        this.activeQuickLinkList = value;

        this.$refs.QuickLinksAccordion?.classList.add("show");
      }
    },
    toggleAnnualBestFilter () {
      this.clearInput();

      if (this.activeQuickLinkList === "annual") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "annual";
        this.$store.commit("setDBSortValue", "release");
      }
    },
    toggleBestPicturesFilter () {
      this.clearInput();

      if (this.activeQuickLinkList === "bestPicture") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "bestPicture";
        this.$store.commit("setDBSortValue", "release");
      }
    },
    toggleThisYearFilter () {
      this.clearInput();

      if (this.activeQuickLinkList === "thisYear") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "thisYear";
        this.$store.commit("setDBSortValue", "rating");
      }
    },
    toggleLastYearFilter () {
      this.clearInput();

      if (this.activeQuickLinkList === "lastYear") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "lastYear";
        this.$store.commit("setDBSortValue", "rating");
      }
    },
    toggleThisMonthFilter () {
      this.clearInput();

      if (this.activeQuickLinkList === "thisMonth") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "thisMonth";
        this.$store.commit("setDBSortValue", "rating");
      }
    },
    toggleLastMonthFilter () {
      this.clearInput();

      if (this.activeQuickLinkList === "lastMonth") {
        this.activeQuickLinkList = "title";
      } else {
        this.activeQuickLinkList = "lastMonth";
        this.$store.commit("setDBSortValue", "rating");
      }
    },
    async toggleNotOnLetterboxdFilter () {
      this.clearInput();

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
      // Save sort order to store for potential restoration
      this.$store.commit('setHomePageSortOrder', this.sortOrder);
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
      // Save sort state to store for potential restoration
      this.$store.commit('setHomePageSortValue', this.sortValue);
      this.$store.commit('setHomePageSortOrder', this.sortOrder);
    },
    getSortValue (item, key) {
      return getSortValueUtil(item, key, this.mostRecentRating);
    },
    sortResultsFast (array) {
      return sortResultsFastUtil(array, {
        sortValue: this.sortValue,
        sortOrder: this.sortOrder,
        getRating: this.mostRecentRating
      });
    },
    sortResults (a, b) {
      return sortResultsUtil(a, b, {
        sortValue: this.sortValue,
        sortOrder: this.sortOrder,
        getRating: this.mostRecentRating
      });
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
      if (!this.effectiveSearchTerm) {
        return;
      }
      let resp;
      try {
        resp = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US&query=${this.effectiveSearchTerm}`);
      } catch {
        return; // network failure mid-flight: no unhandled rejection (2026-08-15 audit)
      }
      if (resp.data.results.length) {
        this.newEntrySearch(resp.data.results);

        window.scroll({
          top: 0,
          left: 0,
          behavior: 'instant'
        });
      } else {
        this.showNoResultsMessage();
      }
    },
    newEntrySearch (results) {
      this.$store.commit('setNewEntrySearchResults', results)

      this.$router.push(`/pick-media/${this.effectiveSearchTerm}`);
    },
    // Offline counterpart to searchTMDB - bypasses TMDB search entirely with
    // a placeholder movieToRate. See AddRating.js/placeholderId.js for how
    // the save is queued and later reconciled against a real TMDB match.
    rateOffline () {
      if (!this.effectiveSearchTerm) {
        return;
      }
      const media = {
        id: makePlaceholderId(),
        title: this.effectiveSearchTerm,
        release_date: null,
        poster_path: null,
        backdrop_path: null
      };
      this.$store.commit('setMovieToRate', media);
      this.$router.push('/rate-movie');
    },
    showNoResultsMessage () {
      // No auto-revert timer - it used to silently dismiss this message and
      // flip the UI back after 30s, which read as stressful/unpredictable.
      // It now only clears via startNewSearch (explicit "Try Another Search"
      // tap) or a fresh keystroke (see onInput) invalidating the stale term.
      this.noResults = true;
    },
    startNewSearch () {
      // Clear current search state
      this.noResults = false;
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
    loadMoreResults () {
      // Add movies in increments of 48 for stable grid layout. (Persistence of
      // numberOfResultsToShow happens in beforeRouteLeave on navigation away.)
      this.numberOfResultsToShow = this.numberOfResultsToShow + 48;
    },
    addMoreResults () {
      // Manual tap on the fallback button: load the next batch and nudge the
      // page down so the new rows come into view.
      this.loadMoreResults();

      this.$nextTick(() => {
        window.scrollBy({
          top: 500,
          behavior: 'smooth'
        })
      });
    },
    setupLoadMoreObserver () {
      // Tear down any prior observer before (re)wiring — the sentinel is v-if'd,
      // so its element is recreated whenever canLoadMore flips false→true.
      if (this.loadMoreObserver) {
        this.loadMoreObserver.disconnect();
        this.loadMoreObserver = null;
      }

      if (!this.canLoadMore || typeof IntersectionObserver === 'undefined') {
        return;
      }

      const sentinel = this.$refs.loadMoreSentinel;
      if (!sentinel) {
        return;
      }

      // rootMargin pre-triggers the load ~600px before the sentinel is on-screen,
      // so the next batch is rendering before the user reaches the end. A batch of
      // 48 posters is far taller than 600px, so each scroll fires exactly once and
      // the sentinel naturally re-arms when it scrolls back into the zone.
      this.loadMoreObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.loadMoreResults();
        }
      }, { rootMargin: '600px 0px', threshold: 0 });

      this.loadMoreObserver.observe(sentinel);
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
      this.convertSearchToChip();
      event.target.classList.remove('font-size-increased');
      event.target.style.fontSize = '12px';
    },
    goToInsights () {
      this.$router.push('/insights');
    },
    // Jumps back into whichever individual game was last played (see
    // gameData.js's LAST_PLAYED_KEY, set on every game route's mount) rather
    // than always landing on the hub — per bug report, popping in and out of
    // a game (e.g. Wordle) to check something on the search screen shouldn't
    // mean re-picking the game from the hub every time.
    goToGames () {
      // Falls back to the hub when nothing is stored OR when the stored game
      // no longer exists — see lastPlayedGamePath for the dead-button bug
      // that second case caused.
      this.$router.push(lastPlayedGamePath(this.$router) || '/games');
    },
    saveTieBreakTweak () {
      this.$store.dispatch('writeDurably', { path: 'settings/tieBreakTweak', value: this.tieBreakTweak });
    },
    savePersonalAwardName () {
      this.$store.dispatch('writeDurably', { path: 'settings/personalAwardName', value: this.personalAwardName });
    },
    saveAwardsYearThreshold (event) {
      const raw = Number(event?.target?.value);
      const value = Number.isFinite(raw) ? Math.min(100, Math.max(1, Math.floor(raw))) : 10;
      this.$store.dispatch('writeDurably', { path: 'settings/awardsYearThreshold', value });
    },
    // Grammar helper methods for award names — delegate to the shared
    // pure functions (assets/javascript/personalAwards.js) so MovieDetail.vue
    // can reuse the exact same logic instead of a hardcoded "My Awards" label.
    getAwardNameWithThe () {
      return awardNameWithThe(this.personalAwardName);
    },
    getAwardNameWithoutThe () {
      return awardNameWithoutThe(this.personalAwardName);
    },
    getAwardNameSingular () {
      return awardNameSingular(this.personalAwardName);
    },
    saveLetterboxdConnection () {
      this.$store.dispatch('writeDurably', { path: 'settings/letterboxdConnected', value: this.letterboxdConnected });
    },
    saveLetterboxdUsername () {
      this.$store.dispatch('writeDurably', { path: 'settings/letterboxdUsername', value: this.letterboxdUsername });
      // Auto-enable integration when username is provided
      if (this.letterboxdUsername && !this.letterboxdConnected) {
        this.letterboxdConnected = true;
        this.saveLetterboxdConnection();
      }
    },
    async downloadForOffline () {
      if (this.offlineDownload.status === 'running') {
        return;
      }

      const urls = collectImageUrls(this.$store.state.movieLog);
      this.offlineDownload = { status: 'running', completed: 0, total: urls.length, failed: 0 };

      const result = await warmImageCache(urls, {
        onProgress: (progress) => {
          this.offlineDownload = { ...this.offlineDownload, ...progress };
        }
      });

      this.offlineDownload = { status: 'done', ...result };
    },
    async signOut () {
      await this.$store.dispatch('logout');
    },
    // Shared write path for every metadata backfill (box office, production
    // countries, locations). `fieldsFor(item)` returns the movie fields that
    // item contributes, e.g. { budget, revenue }.
    //
    // Batched, not one write per movie (bug report, Jul 2026: a per-item
    // design froze/crashed the tab on a real library - see tmdbBackfill.js's
    // own comment for the full story). Each batch becomes ONE combined local
    // commit (setMovieLogEntries) and ONE combined remote multi-path update,
    // instead of N of each.
    async writeMovieFieldBatch (batch, fieldsFor) {
      const entries = [];
      const updates = {};

      batch.forEach((item) => {
        // Read fresh from state (not a captured closure) so this reflects
        // whatever else might be true of the entry right now.
        const existingEntry = this.$store.state.movieLog[item.dbKey];
        if (!existingEntry) return;

        const fields = fieldsFor(item);
        entries.push({ key: item.dbKey, value: { ...existingEntry, movie: { ...existingEntry.movie, ...fields } } });
        // Individual leaf-path keys (not the whole `movie` object) so this
        // can never clobber sibling fields like cast/crew/genres with a
        // possibly-stale local snapshot.
        Object.entries(fields).forEach(([field, value]) => {
          updates[`movieLog/${item.dbKey}/movie/${field}`] = value;
        });
      });

      if (entries.length) {
        this.$store.commit('setMovieLogEntries', entries);
      }
      if (Object.keys(updates).length) {
        // No durable-queue treatment needed here (unlike a user-authored
        // rating) - this is re-fetchable metadata, not irreplaceable data,
        // and the whole operation is naturally safe to just re-run if a
        // batch write fails.
        await this.$store.dispatch('updateDatabaseEntriesNow', updates);
      }
    },
    async backfillBoxOfficeData () {
      if (this.boxOfficeBackfill.status === 'running') {
        return;
      }

      const candidateCount = collectMoviesNeedingBoxOffice(this.$store.state.movieLog).length;
      this.boxOfficeBackfill = { status: 'running', completed: 0, total: candidateCount, failed: 0 };

      const result = await backfillBoxOffice(
        this.$store.state.movieLog,
        (batch) => this.writeMovieFieldBatch(batch, (item) => item.boxOffice),
        {
          onProgress: (progress) => {
            this.boxOfficeBackfill = { ...this.boxOfficeBackfill, ...progress };
          }
        }
      );

      this.boxOfficeBackfill = { status: 'done', ...result };
    },
    async trimLibraryData () {
      if (this.libraryTrim.status === 'running') {
        return;
      }

      const candidateCount = collectEntriesNeedingTrim(this.$store.state.movieLog).length;
      this.libraryTrim = { status: 'running', completed: 0, total: candidateCount, failed: 0 };

      const result = await trimStoredEntries(this.$store.state.movieLog, async (batch) => {
        const entries = [];
        let updates = {};

        batch.forEach(({ dbKey, updates: entryUpdates }) => {
          const existingEntry = this.$store.state.movieLog[dbKey];
          if (!existingEntry) return;
          // Keep local state in step with what's being written, so the grid
          // doesn't briefly disagree with the database.
          entries.push({ key: dbKey, value: entryForStorage(existingEntry) });
          updates = { ...updates, ...entryUpdates };
        });

        if (entries.length) {
          this.$store.commit('setMovieLogEntries', entries);
        }
        if (Object.keys(updates).length) {
          // A multi-path update, where a null value DELETES that path. Writing
          // whole entries instead is what put the junk there originally.
          await this.$store.dispatch('updateDatabaseEntriesNow', updates);
        }
      }, {
        onProgress: (progress) => {
          this.libraryTrim = { ...this.libraryTrim, ...progress };
        }
      });

      this.libraryTrim = { status: 'done', ...result };
    },
    // One-time catch-up so entries rated before change tracking existed also
    // carry an updatedAt. Strictly optional — an unstamped entry is simply
    // never returned by a future delta query, which is correct as long as the
    // local snapshot already holds it — but making the library uniform removes
    // a whole category of "why is this movie invisible to sync" reasoning.
    async backfillSyncStamps () {
      if (this.syncStampBackfill.status === 'running') {
        return;
      }

      const candidates = collectEntriesNeedingStamp(this.$store.state.movieLog);
      this.syncStampBackfill = { status: 'running', completed: 0, total: candidates.length, failed: 0 };

      const batchSize = 100;
      let completed = 0;
      let failed = 0;

      for (let index = 0; index < candidates.length; index += batchSize) {
        const batch = candidates.slice(index, index + batchSize);
        try {
          // The server assigns the actual timestamps — see stampBackfillUpdates.
          await this.$store.dispatch('updateDatabaseEntriesNow', stampBackfillUpdates(batch));
        } catch {
          failed += batch.length;
        }
        completed += batch.length;
        this.syncStampBackfill = { ...this.syncStampBackfill, completed, failed };
      }

      // Local state is deliberately left alone: the real timestamps arrive via
      // the onValue listener, and committing the placeholder here would put a
      // value in state that was never actually stored.
      this.syncStampBackfill = { status: 'done', total: candidates.length, completed, failed };
    },
    async backfillProductionCountriesData () {
      if (this.countriesBackfill.status === 'running') {
        return;
      }

      const candidateCount = collectMoviesNeedingCountries(this.$store.state.movieLog).length;
      this.countriesBackfill = { status: 'running', completed: 0, total: candidateCount, failed: 0 };

      const result = await backfillProductionCountries(
        this.$store.state.movieLog,
        (batch) => this.writeMovieFieldBatch(batch, (item) => item.countries),
        {
          onProgress: (progress) => {
            this.countriesBackfill = { ...this.countriesBackfill, ...progress };
          }
        }
      );

      this.countriesBackfill = { status: 'done', ...result };
    },
    saveStickinessPromptState (value) {
      this.stickinessPromptState = value;
      this.$store.dispatch('setDBValue', { path: 'settings/stickinessPromptState', value });
    },
    saveTieBreakPromptState (value) {
      this.tieBreakPromptState = value;
      this.$store.dispatch('setDBValue', { path: 'settings/tieBreakPromptState', value });
    },
    saveAwardsPromptState (value) {
      this.awardsPromptState = value;
      this.$store.dispatch('setDBValue', { path: 'settings/awardsPromptState', value });
    },
    // Test function for Letterboxd URL generation (call from browser console)
    // Test function for Letterboxd scraping (UI button)
    async scrapeLetterboxd () {
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
      } catch (error) {
        this.scrapingTest.error = error.message || 'Scraping failed';
        this.scrapingTest.success = false;
        this.scrapingTest.loading = false;
        ErrorLogService.error('Letterboxd scraping test failed', {
          username,
          error: error.message,
          stack: error.stack
        });
      }
    },
    addLetterboxdOverride () {
      if (!this.newOverrideTitle || !this.newOverrideYear) return;

      // Create a unique key for this override (title + year)
      const overrideKey = `${this.newOverrideTitle.toLowerCase().replace(/[^a-z0-9]/g, '')}_${this.newOverrideYear}`;

      // Add to local state
      this.letterboxdOverrides[overrideKey] = {
        title: this.newOverrideTitle,
        year: this.newOverrideYear,
        addedAt: new Date().toISOString()
      };

      // Durable leaf write: whole-map setDBValue writes could be silently
      // swallowed by the same-path debounce on a quick add-then-remove, and
      // were lost entirely offline (2026-08-15 offline audit).
      this.$store.dispatch('writeDurably', {
        path: `settings/letterboxdOverrides/${overrideKey}`,
        value: this.letterboxdOverrides[overrideKey]
      });

      // Clear the form
      this.newOverrideTitle = '';
      this.newOverrideYear = null;
    },
    removeLetterboxdOverride (overrideKey) {
      // Remove from local state
      delete this.letterboxdOverrides[overrideKey];

      this.$store.dispatch('writeDurably', {
        path: `settings/letterboxdOverrides/${overrideKey}`,
        value: null
      });
    },
    // New multi-filter system methods
    getQuickLinkDisplayName (quickLinkKey) {
      const displayNames = {
        annual: 'Annual Best',
        bestPicture: 'Best Picture',
        thisYear: 'This Year',
        lastYear: 'Last Year',
        thisMonth: 'This Month',
        lastMonth: 'Last Month',
        notOnLetterboxd: 'Not on Letterboxd'
      };
      return displayNames[quickLinkKey] || quickLinkKey;
    },
    clearQuickLink () {
      this.activeQuickLinkList = 'title';
    },
    removeFilter (filterId) {
      // Blur the search input first to prevent layout shifts from interfering with the click
      if (this.$refs.searchInput) {
        this.$refs.searchInput.blur();
      }

      this.activeFilters = this.activeFilters.filter(f => f.id !== filterId);

      if (this.activeFilters.length === 0) {
        // No filters remain, clear search values
        this.inputValue = '';
      }
    },
    addDirectorFilter (event) {
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
    addYearFilter (event) {
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
    // year-scroller tap handler — drops any existing year chip(s) (incl. a
    // stray temp one) and appends a fresh one, but LEAVES every other
    // active chip alone, so tapping around the scroller doesn't clear a
    // combined filter like year + genre.
    selectYear (year) {
      const yearChip = {
        id: `year-${Date.now()}`,
        type: 'year',
        value: year.toString(),
        display: year.toString()
      };
      this.activeFilters = [...this.activeFilters.filter((filter) => filter.type !== 'year'), yearChip];
      this.hasAutoRandomChip = false;
    },
    // Keeps the currently-selected year pill scrolled into view — both when
    // the scroller first appears and again each time a different year is
    // tapped, so the current selection never drifts out of sight as you
    // "travel between years." scrollIntoView is guarded (jsdom/older
    // browsers may not implement it) rather than assumed present.
    centerYearScrollerPill () {
      const activePill = this.$refs.yearScroller?.querySelector('.year-scroller-pill.selected');
      if (activePill && typeof activePill.scrollIntoView === 'function') {
        activePill.scrollIntoView({ inline: 'center', block: 'nearest' });
      }
    },
    addGenreFilter (event) {
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
    addTagFilter (event) {
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
    setSearchValue (value) {
      this.debouncedSetSearchValue(value);
    },
    onInput (event) {
      const newVal = event.target.value;

      // A new keystroke invalidates any "no results for X" message about
      // whatever the OLD term was - without this, since the auto-revert
      // timer was removed, that alert could otherwise get stuck showing a
      // stale term until the user explicitly hit "Try Another Search".
      this.noResults = false;

      this.overwriteCurrentlyTypingSearchFilter(newVal);
      this.inputValue = newVal;
      this.setSearchValue(newVal);
    },
    overwriteCurrentlyTypingSearchFilter (value) {
      // Find any existing temp filter and remove it
      this.activeFilters = this.activeFilters.filter(filter => !filter.temp);

      if (value.trim()) {
        // Detect filter type while typing for consistent results
        const searchType = this.detectFilterType(value.trim());
        const tempFilter = {
          id: `temp-${Date.now()}`,
          type: searchType.type,
          value: searchType.value,
          display: searchType.display,
          temp: true // Mark as temporary
        };

        this.activeFilters.push(tempFilter);
      }
    },
    clearInput () {
      this.inputValue = '';
      this.setSearchValue('');

      // Clear and blur the input
      const inputElement = this.$refs.searchInput;
      if (inputElement) {
        inputElement.blur();
      } // Small delay to show the fade effect
    },
    convertSearchToChip () {
      // Find any existing temp filter and remove it
      this.activeFilters = this.activeFilters.filter(filter => !filter.temp);

      const currentSearch = this.inputValue;
      if (!currentSearch || !currentSearch.trim()) {
        return;
      }
      const searchTerm = currentSearch.trim();

      // The fuzzy "Did you mean?" blur-guard applies ONLY to free-text (general)
      // terms — a probable typo we don't want to auto-chip into a dead general
      // chip (the user should tap a suggestion instead). A STRUCTURED filter
      // (year, genre, director, company, keyword, ...) is an intended filter and
      // must always be committed.
      //
      // Without this type check, typing a year like "2010" — which shows results
      // via a temp `year` chip while focused — lost them on blur: removing the
      // temp chip above fell back to a `general` match (which does NOT match by
      // release year), found nothing, surfaced suggestions, and bailed before
      // ever creating the year chip.
      const detected = this.detectFilterType(searchTerm);
      if (detected.type === 'general' && this.didYouMeanSuggestions.length > 0) {
        return;
      }

      // Add the chip immediately and clear the input
      this.addSearchFilter(searchTerm);
    },
    addSearchFilter (searchTerm, isAutoRandom = false, expectedType = null) {
      if (!searchTerm || !searchTerm.trim()) return;

      const trimmedTerm = searchTerm.trim();

      // If we know the expected type (from random search), use it directly
      let searchType;
      if (expectedType) {
        searchType = this.createFilterByType(expectedType, trimmedTerm);
      } else {
        // Otherwise detect what type of filter this should be
        searchType = this.detectFilterType(trimmedTerm);
      }

      // Check if this exact filter already exists
      const existingFilter = this.activeFilters.find(filter =>
        filter.type === searchType.type && filter.value === searchType.value
      );

      if (existingFilter) {
        return;
      }

      // Add the appropriate filter chip
      this.activeFilters.push({
        id: `${searchType.type}-${Date.now()}`,
        type: searchType.type,
        value: searchType.value,
        display: searchType.display
      });

      this.clearInput();

      // Track if this chip was added by automatic random search
      this.hasAutoRandomChip = isAutoRandom;
    },
    applyDidYouMeanSuggestion (suggestion) {
      // Commit a tapped fuzzy suggestion as a real chip. We pass the known
      // expectedType so addSearchFilter -> createFilterByType builds the exact
      // chip with no re-guessing. Titles have a null expectedType and commit
      // through detectFilterType (i.e. as a general chip), matching a typed title.
      this.addSearchFilter(suggestion.value, false, suggestion.expectedType);
    },
    // Decides how many ranked "Did you mean?" suggestions to attempt to show
    // on one line, given the search input's actual current width. The DOM
    // measurement lives here; the pure fit-counting math is
    // countDidYouMeanSuggestionsThatFit (searchFiltering.js) so it's directly
    // unit-testable without mounting the component.
    updateDidYouMeanFitCount () {
      const input = this.$refs.searchInput;
      const maxWidth = input ? input.offsetWidth : 0;
      this.didYouMeanFitCount = countDidYouMeanSuggestionsThatFit(this.didYouMeanSuggestions, maxWidth);
    },
    clearAllFilters () {
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
    },
    debouncedFetchUnratedMoviesBySearchFilter (searchFilter) {
      clearTimeout(this.unratedMoviesDebounceTimeout);
      this.unratedMoviesDebounceTimeout = setTimeout(() => {
        this.fetchUnratedMoviesBySearchFilter(searchFilter);
      }, 800);
    },
    detectYearTypes (searchValue) {
      // Year patterns
      if (/^\d{4}$/.test(searchValue)) {
        const year = parseInt(searchValue);
        if (year >= 1900 && year <= new Date().getFullYear() + 5) {
          return { type: 'year', value: year.toString(), display: year.toString() };
        }
      }

      // 2-digit year (e.g., "95" → 1995)
      if (/^\d{2}$/.test(searchValue)) {
        const shortYear = parseInt(searchValue);
        const currentYear = new Date().getFullYear();
        const currentCentury = Math.floor(currentYear / 100) * 100;
        const fullYear = shortYear <= (currentYear % 100) + 10 ? currentCentury + shortYear : currentCentury - 100 + shortYear;
        return { type: 'year', value: fullYear.toString(), display: fullYear.toString() };
      }

      // Year range (e.g., "1990-1995")
      const rangeMatch = searchValue.match(/^(\d{4})-(\d{4})$/);
      if (rangeMatch) {
        const startYear = parseInt(rangeMatch[1]);
        const endYear = parseInt(rangeMatch[2]);
        if (startYear >= 1900 && endYear <= new Date().getFullYear() + 5 && startYear <= endYear) {
          return { type: 'yearRange', value: { startYear, endYear }, display: `${startYear}-${endYear}` };
        }
      }

      // Decade patterns (e.g., "90s", "1990s")
      const decadeMatch = searchValue.match(/^(\d{2,4})s$/i);
      if (decadeMatch) {
        let decade = parseInt(decadeMatch[1]);
        if (decade < 100) {
          // Convert 2-digit to 4-digit (e.g., "90" → "1990")
          const currentYear = new Date().getFullYear();
          const currentCentury = Math.floor(currentYear / 100) * 100;
          decade = decade <= (currentYear % 100) + 10 ? currentCentury + decade : currentCentury - 100 + decade;
        }
        decade = Math.floor(decade / 10) * 10; // Round down to decade
        return { type: 'yearRange', value: { startYear: decade, endYear: decade + 9 }, display: `${decade}s` };
      }

      // If no year types matched, return null
      return null;
    },
    detectDirectorTypes (searchValue, lowerValue) {
      // Check for exact director match
      const allDirectors = this.allDirectors || [];
      const exactDirectorMatch = allDirectors.find(director =>
        director.name && director.name.toLowerCase() === lowerValue
      );
      if (exactDirectorMatch) {
        return { type: 'person', value: exactDirectorMatch.name, display: `${exactDirectorMatch.name}` };
      }

      // For partial matches, don't classify as person type - let it fall through to general search
      // This ensures the search value works the same in chips as it does in the input

      // If no director types matched, return null
      return null;
    },
    detectGenreTypes (searchValue, lowerValue) {
      // Check for exact genre match
      const allGenres = this.allGenres || [];
      const exactGenreMatch = allGenres.find(genre =>
        genre.name && genre.name.toLowerCase() === lowerValue
      );
      if (exactGenreMatch) {
        // Find the genre ID for TMDB API
        const commonGenres = {
          action: 28,
          adventure: 12,
          animation: 16,
          comedy: 35,
          crime: 80,
          documentary: 99,
          drama: 18,
          family: 10751,
          fantasy: 14,
          history: 36,
          horror: 27,
          music: 10402,
          mystery: 9648,
          romance: 10749,
          'sci-fi': 878,
          'science fiction': 878,
          thriller: 53,
          war: 10752,
          western: 37
        };
        const genreId = commonGenres[exactGenreMatch.name.toLowerCase()] || 18; // Default to drama
        return { type: 'genre', genreId, value: exactGenreMatch.name, display: `${exactGenreMatch.name}` };
      }

      // If no genre types matched, return null
      return null;
    },
    detectKeywordTypes (searchValue, lowerValue) {
      // Check for exact keyword match
      const allKeywords = Object.keys(this.countedKeywords || {});
      const exactKeywordMatch = allKeywords.find(keyword =>
        keyword && keyword.toLowerCase() === lowerValue
      );
      if (exactKeywordMatch) {
        return { type: 'keyword', value: exactKeywordMatch, display: `${exactKeywordMatch}` };
      }

      // If no keyword types matched, return null
      return null;
    },
    detectCastTypes (searchValue, lowerValue) {
      // Check for exact cast match
      if (!this.cachedCastMembers || !this.cachedCastMembers.size) {
        console.warn('Rebuilding Cast Cache');
        this.buildCastMembersCache();
      }
      const hasCastMatch = this.cachedCastMembers.has(lowerValue);

      if (hasCastMatch) {
        return { type: 'person', value: searchValue, display: `${searchValue}` };
      }

      // If no cast types matched, return null
      return null;
    },
    detectProductionCompanyTypes (searchValue, lowerValue) {
      // Check for exact company match
      const allStudios = this.allStudios || [];
      const exactStudioMatch = allStudios.find(studio =>
        studio.name && studio.name.toLowerCase() === lowerValue
      );
      if (exactStudioMatch) {
        return { type: 'company', value: exactStudioMatch.name, display: `${exactStudioMatch.name}` };
      }

      // For partial matches, don't classify as company type - let it fall through to general search
      // This ensures the search value works the same in chips as it does in the input

      // If no company types matched, return null
      return null;
    },
    createFilterByType (expectedType, value) {
      const trimmed = value.trim();

      switch (expectedType) {
        case "keyword":
          return { type: 'keyword', value: trimmed, display: trimmed };
        case "genre":
          return { type: 'genre', value: trimmed, display: trimmed };
        case "year":
          return { type: 'year', value: trimmed, display: trimmed };
        case "director":
          return { type: 'person', value: trimmed, display: trimmed };
        case "cast/crew":
          return { type: 'person', value: trimmed, display: trimmed };
        case "studios":
          return { type: 'company', value: trimmed, display: trimmed };
        default:
          // Fall back to detection if unknown type
          return this.detectFilterType(trimmed);
      }
    },
    detectFilterType (value) {
      const trimmed = value.trim();
      const lowerValue = trimmed.toLowerCase();

      // Check for years
      if (this.detectYearTypes(trimmed)) {
        return this.detectYearTypes(trimmed);
      }

      // Check for directors
      if (this.detectDirectorTypes(trimmed, lowerValue)) {
        return this.detectDirectorTypes(trimmed, lowerValue);
      }

      // Check for genres
      if (this.detectGenreTypes(trimmed, lowerValue)) {
        return this.detectGenreTypes(trimmed, lowerValue);
      }

      // Check for cast members
      if (this.detectCastTypes(trimmed, lowerValue)) {
        return this.detectCastTypes(trimmed, lowerValue);
      }

      // Check for production companies
      if (this.detectProductionCompanyTypes(trimmed, lowerValue)) {
        return this.detectProductionCompanyTypes(trimmed, lowerValue);
      }

      // Check for keywords
      if (this.detectKeywordTypes(trimmed, lowerValue)) {
        return this.detectKeywordTypes(trimmed, lowerValue);
      }

      // For everything else, use general search
      return { type: 'general', value: trimmed, display: `${trimmed}` };
    },
    async fetchUnratedMoviesByYear (year) {
      // Fetch multiple pages to get more variety
      const allResults = [];

      for (let page = 1; page <= 3; page++) { // Get first 3 pages (60 movies)
        const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
          params: {
            api_key: process.env.VUE_APP_TMDB_API_KEY,
            language: 'en-US',
            primary_release_year: year,
            sort_by: 'popularity.desc',
            page,
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
    async fetchUnratedMoviesByYearRange (yearRange) {
      const allResults = [];

      for (let page = 1; page <= 2; page++) { // Get first 2 pages (40 movies) for ranges
        const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
          params: {
            api_key: process.env.VUE_APP_TMDB_API_KEY,
            language: 'en-US',
            'primary_release_date.gte': `${yearRange.startYear}-01-01`,
            'primary_release_date.lte': `${yearRange.endYear}-12-31`,
            sort_by: 'popularity.desc',
            page,
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
    async fetchUnratedMoviesByGenre (genreId) {
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
            page,
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
    async fetchUnratedMoviesByPerson (personName) {
      try {
        // First, search for the person (director)
        const personResp = await axios.get('https://api.themoviedb.org/3/search/person', {
          params: {
            api_key: process.env.VUE_APP_TMDB_API_KEY,
            language: 'en-US',
            query: personName,
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

        const cast = creditsResp.data.cast || [];
        const crew = creditsResp.data.crew || [];

        // Combine and dedupe by movie ID
        const seenIds = new Set();
        const combinedResults = [...cast, ...crew].filter(movie => {
          if (seenIds.has(movie.id)) {
            return false;
          }
          seenIds.add(movie.id);
          return true;
        });

        const castAndCrew = combinedResults.sort((a, b) => {
          // Sort by popularity first, then by release date
          if (b.popularity !== a.popularity) {
            return b.popularity - a.popularity;
          }
          return new Date(b.release_date || 0) - new Date(a.release_date || 0);
        });

        return castAndCrew;
      } catch (error) {
        console.error('Error fetching movies by director:', error);
        ErrorLogService.error('Failed to fetch movies by director', {
          director: personName,
          error: error.message,
          stack: error.stack
        });
        return [];
      }
    },
    async fetchUnratedMoviesByKeyword (keyword) {
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
    async fetchUnratedMoviesByCompany (companyName) {
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
              page,
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
        ErrorLogService.error('Failed to fetch movies by company', {
          company: companyName,
          error: error.message,
          stack: error.stack
        });
        return [];
      }
    },
    async fetchUnratedMoviesBySearchFilter (searchFilter) {
      // Offline: skip the whole discover fan-out (up to ~7 TMDB requests per
      // debounced filter change) instead of letting every one fail
      // individually (2026-08-15 offline audit). The suggestions section
      // simply doesn't render, same as having no matches.
      if (!this.$store.state.isOnline) {
        this.unratedMovies = [];
        return;
      }
      this.unratedMoviesError = null;
      this.unratedMovies = [];

      try {
        this.unratedMoviesSearchType = searchFilter.type;
        let relevantList = [];

        if (searchFilter.type === 'year') {
          // Fetch movies from specific year
          relevantList = await this.fetchUnratedMoviesByYear(searchFilter.value);
        } else if (searchFilter.type === 'yearRange') {
          // Fetch movies from year range
          relevantList = await this.fetchUnratedMoviesByYearRange(searchFilter.value);
        } else if (searchFilter.type === 'genre') {
          // Fetch movies from specific genre
          relevantList = await this.fetchUnratedMoviesByGenre(searchFilter.genreId);
        } else if (searchFilter.type === 'company') {
          // Fetch movies from specific production company
          relevantList = await this.fetchUnratedMoviesByCompany(searchFilter.value);
        } else if (searchFilter.type === 'person') {
          // Fetch movies from specific person (actor/director)
          relevantList = await this.fetchUnratedMoviesByPerson(searchFilter.value);
        } else if (searchFilter.type === 'keyword') {
          // Fetch movies from specific keyword
          relevantList = await this.fetchUnratedMoviesByKeyword(searchFilter.value);
          this.unratedMoviesSearchType = 'keyword';
        } else if (searchFilter.type === 'general') {
          // Try keyword/general search first
          relevantList = await this.fetchUnratedMoviesByKeyword(searchFilter.value);
        } else {
          // This shouldn't happen with our current logic, but keep as fallback
          relevantList = [];
        }

        // Filter out already rated movies and remove duplicates
        const ratedIds = new Set(this.allEntriesWithFlatKeywordsAdded.map(r => r.movie.id));
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
            let cutoffPercentage = 0.4; // Default to 60% for general searches
            if (this.unratedMoviesSearchType === 'year' || this.unratedMoviesSearchType === 'yearRange') {
              cutoffPercentage = 0.2; // Keep movies in top 80% for year searches
            } else if (this.unratedMoviesSearchType === 'genre') {
              cutoffPercentage = 0.3; // Keep movies in top 70% for genre searches
            }

            const cutoff = min + (max - min) * cutoffPercentage;
            let filtered = unrated.filter(m => m.popularity >= cutoff);

            // Show more movies for different search types
            const targetCount = 12;

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
        ErrorLogService.error('Failed to fetch unrated movies', {
          searchFilter,
          error: err.message,
          stack: err.stack
        });
        this.unratedMoviesError = 'Error fetching from TMDB.';
      }
    },
    // Test function for error logging (for development)
    testErrorLogging () {
      ErrorLogService.info('Test info message', { timestamp: Date.now() });
      ErrorLogService.warn('Test warning message', { component: 'Home' });
      ErrorLogService.error('Test error message', { testData: 'sample error' });
      ErrorLogService.debug('Test debug message', { debugInfo: 'detailed information' });
    },
    // Error log management methods
    refreshErrorLogs () {
      this.errorLogs = ErrorLogService.getLogs();
    },
    clearErrorLogs () {
      ErrorLogService.clearLogs();
      this.refreshErrorLogs();
    },
    async copyErrorLogs () {
      try {
        const logText = ErrorLogService.getLogsAsText();
        await navigator.clipboard.writeText(logText);
        this.showCopySuccess();
      } catch (error) {
        // Fallback for older browsers
        this.fallbackCopyToClipboard(ErrorLogService.getLogsAsText());
      }
    },
    fallbackCopyToClipboard (text) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        this.showCopySuccess();
      } catch (error) {
        console.error('Failed to copy logs:', error);
        ErrorLogService.error('Failed to copy logs to clipboard', { error: error.message });
      } finally {
        document.body.removeChild(textArea);
      }
    },
    showCopySuccess () {
      this.copySuccess = true;
      setTimeout(() => {
        this.copySuccess = false;
      }, 2000);
    },
    formatLogTime (timestamp) {
      return new Date(timestamp).toLocaleTimeString();
    },
    startErrorLogRefresh () {
      if (this.errorLogRefreshInterval) return; // Already running
      this.errorLogRefreshInterval = setInterval(() => {
        this.refreshErrorLogs();
      }, 1000); // Refresh every second
    },
    stopErrorLogRefresh () {
      if (this.errorLogRefreshInterval) {
        clearInterval(this.errorLogRefreshInterval);
        this.errorLogRefreshInterval = null;
      }
    },

    // Stickiness inline methods
    topStructure (result) {
      if (this.currentLogIsTVLog) {
        return result.tvShow;
      } else {
        return result.movie;
      }
    },
    sortByRating (a, b) {
      const aRating = getRating(a)?.calculatedTotal;
      const bRating = getRating(b)?.calculatedTotal;

      if (aRating < bRating) {
        return 1;
      }
      if (aRating > bRating) {
        return -1;
      }

      return 0;
    },
  },
}
</script>

<style lang="scss">
  .home {
    width: 100%;
    max-width: 832px;
    min-height: calc(100vh - 140px);

    .search-bar {
      width: 100%;
      max-width: 416px;

      input#search {
        border-bottom-right-radius: .375rem;
        border-top-right-radius: .375rem;

        &.font-size-increased {
          margin: -6px 0 0;
        }
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

    .no-results-buffer {
      // This is here to deal with the jump in position when the input is deblurred and a chip is automatically added
      margin-top: 29px;
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

  .group-header {
    cursor: pointer;

    &:active {
      opacity: 0.7;
    }

    .group-header-icon {
      font-size: 0.7rem;
      margin-left: 4px;
      opacity: 0.6;
    }
  }
}

/* Group order panel */
.group-order-panel {
  background: #2b3035;
  border: 1px solid #444;

  .group-order-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);

    &:last-child {
      border-bottom: none;
    }
  }

  // Always-visible controls (no hover) for mobile-first use.
  .group-order-controls .btn:disabled {
    opacity: 0.35;
  }
}

/* Error logs styling */
.error-logs-section {
  background: rgba(0, 0, 0, 0.05);
  border-color: #444 !important;
  color: #ffffff !important;
}

.settings-panel-inline.dark .error-logs-section {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff !important;
}

.error-logs-section h6,
.error-logs-section .text-muted,
.error-logs-section small {
  color: #ffffff !important;
}

.log-entry {
  color: #ffffff !important;
}

.log-entry.log-error {
  border-left-color: #dc3545 !important;
  background: rgba(220, 53, 69, 0.1);
  color: #ffffff !important;
}

.log-entry.log-warn {
  border-left-color: #ffc107 !important;
  background: rgba(255, 193, 7, 0.1);
  color: #ffffff !important;
}

.log-entry.log-info {
  border-left-color: #0dcaf0 !important;
  background: rgba(13, 202, 240, 0.1);
  color: #ffffff !important;
}

.log-entry.log-debug {
  border-left-color: #6c757d !important;
  background: rgba(108, 117, 125, 0.1);
  color: #ffffff !important;
}

.log-message {
  word-break: break-word;
  line-height: 1.3;
  color: #ffffff !important;
}

.log-entry .text-muted {
  color: #cccccc !important;
}

.error-logs-section .text-center {
  color: #ffffff !important;
}
</style>

<style scoped>
.welcome-new-user-text {
  color: #ccc;
  font-size: 0.9rem;
  margin: 0 auto;
  max-width: 26rem;
  padding: 0 1rem;
}
.welcome-account-note {
  color: #ccc;
  font-size: 0.78rem;
  margin: 0.5rem auto 0;
  max-width: 26rem;
  padding: 0 1rem;
}
.did-you-mean-inline {
  font-size: 0.75rem;
  margin-top: 0.35rem;
  /* Hard guarantee against wrapping/overflow regardless of how close
     updateDidYouMeanFitCount's character-count estimate gets - worst case
     is an ellipsis mid-last-term, never a wrapped or overflowing line. */
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.did-you-mean-link {
  color: #adb5bd;
  text-decoration: underline;
}
.did-you-mean-link:active {
  /* Mobile-first: no-hover affordance, visible press feedback */
  opacity: 0.7;
}
.pending-reconciliation-banner {
  background-color: #332701;
  border: 1px solid #ffc107;
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  text-align: center;
  max-width: 500px;

  a {
    color: #ffe69c;
    font-weight: 600;
    text-decoration: underline;
  }
}
.pending-reconciliation-banner a:active {
  opacity: 0.7;
}
.signed-in-as {
  color: #ccc; /* .text-muted is illegible on the dark panel (house rule) */
}

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

/* Year-scroller special case (see hasActiveYearChip). flex-basis 100%
   forces it onto its own full-width row within the chip row's flex-wrap
   container ("goes horizontally all the way across"); min-width: 0 is the
   standard flexbox fix that lets it actually shrink to that row width
   instead of growing to fit all its pills (without it, overflow-x: auto
   would have nothing to ever actually overflow). */
.year-scroller {
  display: flex;
  flex: 1 1 100%;
  min-width: 0;
  gap: 0.4rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0.15rem 0.1rem;
}

.year-scroller-pill {
  flex-shrink: 0;
  white-space: nowrap;
}

/* Mobile-first: no reliable :hover device, so press feedback is an :active
   opacity dip only — same convention as .did-you-mean-link/.group-header
   elsewhere in this file. */
.year-scroller-pill:active {
  opacity: 0.7;
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
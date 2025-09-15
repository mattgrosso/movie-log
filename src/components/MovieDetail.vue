<template>
  <div class="movie-detail-page">
    <!-- Header with backdrop and title -->
    <div class="movie-header">
      <div class="close-button" :class="{'loading': isLoading}" @click="goBack">
        <div v-if="isLoading" class="spinner-border spinner-border-sm text-light" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <i v-else class="bi bi-x-lg"></i>
      </div>
      <img v-if="movie && movie.backdrop_path" 
           :src="`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`" 
           :alt="`${movie.title} backdrop`"
           class="backdrop-image">
      <div class="header-overlay">
        <h1 v-if="movie">{{ movie.title }}</h1>
      </div>
    </div>

    <!-- Movie details content -->
    <div class="movie-content" v-if="movie">
      <div class="container">
        <div class="rating-runtime-and-date">
          <div class="line-one">
            <h3>
              <a class="link" @click.stop="searchFor(`${getYear(result)}`)">{{getYear(result)}}</a>
            </h3>
            <ToggleableRating :rating="ratingForMedia(result)" :normalizedRating="normalizedRatingForMedia(result)"/>
          </div>
          <div class="line-two">
            <h3>{{prettifyRuntime(result)}}</h3>
          </div>
        </div>

        <div class="details-actions d-flex align-items-center mb-4">
          <div v-if="$store.state.settings.letterboxdConnected"
               @click="logOnLetterboxd"
               :title="isMovieLoggedOnLetterboxd() ? 'View movie on Letterboxd' : 'Log on Letterboxd'"
               :class="['letterboxd-status-button', { 'logged': isMovieLoggedOnLetterboxd(), 'not-logged': !isMovieLoggedOnLetterboxd() }]">
            <img :src="isMovieLoggedOnLetterboxd() ? 'https://a.ltrbxd.com/logos/letterboxd-decal-dots-pos-rgb-500px.png' : 'https://a.ltrbxd.com/logos/letterboxd-decal-dots-pos-mono-500px.png'"
                 alt="Letterboxd" 
                 class="letterboxd-icon">
          </div>
          <button class="btn btn-sm btn-success me-2" @click="rateMedia(topStructure(result))">Add New Rating</button>
          <button class="btn btn-sm btn-info me-2" @click="goToWikipedia()">Wikipedia</button>
        </div>

        <!-- Previous ratings if any -->
        <div v-if="getAllRatings(previousEntry)" class="previous-ratings mb-3">
          <h4>Ratings</h4>
          <div class="accordion mt-2">
            <div class="accordion-item" v-for="(rating, index) in getAllRatings(previousEntry)" :key="index">
              <h2 class="accordion-header" :id="`heading-${index}`">
                <button class="accordion-button col-12 d-flex" type="button" data-bs-toggle="collapse" :data-bs-target="`#collapse-${index}`" aria-expanded="false" :aria-controls="`collapse-${index}`">
                  <span class="medium-and-date col-9">
                    <span>{{rating.medium}}</span>
                    <span v-if="rating.medium && rating.date">&nbsp;on&nbsp;</span>
                    <span v-else-if="rating.date">On&nbsp;</span>
                    <span>{{formattedDate(rating.date)}}</span>
                  </span>
                  <p class="col-3 m-0 text-center border-start">{{rating.calculatedTotal}}</p>
                </button>
              </h2>
              <div :id="`collapse-${index}`" class="accordion-collapse collapse" :aria-labelledby="`heading-${index}`">
                <div class="accordion-body">
                  <table class="table mb-0 table-striped-columns">
                    <thead>
                      <tr>
                        <th><span>dir</span></th>
                        <th><span>img</span></th>
                        <th><span>stry</span></th>
                        <th><span>perf</span></th>
                        <th><span>sndtk</span></th>
                        <th><span>stick</span></th>
                        <th><span>love</span></th>
                        <th><span>ovral</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="table-secondary">
                        <td>{{rating.direction}}</td>
                        <td>{{rating.imagery}}</td>
                        <td>{{rating.story}}</td>
                        <td>{{rating.performance}}</td>
                        <td>{{rating.soundtrack}}</td>
                        <td>{{rating.stickiness && rating.stickiness !== 0 ? rating.stickiness : 1}}</td>
                        <td>{{rating.love}}</td>
                        <td>{{rating.overall}}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div class="d-flex justify-content-end mt-2">
                    <div :id="`delete-button-${result.dbKey}-${index}`" class="delete-button btn btn-sm btn-warning" @click="showConfimDeleteButton(result.dbKey, index)">Delete Rating</div>
                    <div :id="`confirm-delete-button-${result.dbKey}-${index}`" class="confirm-delete-button d-none col-12 d-flex justify-content-between align-items-center">
                      <p class="m-0">Are you sure?</p>
                      <div>
                        <div class="btn btn-sm btn-info me-1" @click="showDeleteButton(result.dbKey, index)">Nevermind</div>
                        <div class="btn btn-sm btn-danger" @click="deleteRating(previousEntry, index)">Yes, Delete</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Directors -->
        <div class="directors mb-3">
          <h4>
            Director<span v-if="multipleEntries(getCrewMember('Director', true))">s</span>
          </h4>
          <p class="long-list">
            <a v-for="(name, index) in getCrewMember('Director', 'strict')" :key="index" class="link" @click.stop="searchFor(name)">
              {{name}}<span v-if="countDirector(name)" class="small-count-bubble">&nbsp;({{ countDirector(name) }})</span><span v-if="index !== getCrewMember('Director', 'strict').length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <!-- Genres -->
        <div class="genres mb-3">
          <h4>Genre<span v-if="multipleEntries(turnArrayIntoList(topStructure(result).genres, 'name'))">s</span></h4>
          <p class="long-list">
            <a
              v-for="(genre, index) in topStructure(result).genres"
              :key="index"
              class="link me-2"
              @click.stop="searchFor(genre.name)"
            >
              {{genre.name}}<span v-if="countGenre(genre.name)" class="small-count-bubble">&nbsp;({{ countGenre(genre.name) }})</span>
            </a>
          </p>
        </div>

        <!-- Awards -->
        <div class="awards mb-3">
          <div class="academy-awards">
            <h4 v-if="academyAwardWins.length">Academy Award Wins</h4>
            <div v-if="academyAwardWins.length" class="winners">
              <a v-for="award in academyAwardWins" :key="award.id" class="link col-12" @click="goToWikipedia(award.ceremony)">
                {{award.category}}
                <span v-if="award.isActing" >({{parseNamesToList(award.names)}})</span>
              </a>
            </div>
            <h4 v-if="academyAwardNominations.length">Academy Award Nominations</h4>
            <div v-if="academyAwardNominations.length" class="nominees">
              <a v-for="award in academyAwardNominations" :key="award.id" class="link col-12" @click="goToWikipedia(award.ceremony)">
                {{award.category}}
                <span v-if="award.isActing" >({{parseNamesToList(award.names)}})</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Cast -->
        <div v-if="topStructure(result).cast && topStructure(result).cast.length" class="cast mb-3">
          <h4>Cast</h4>
          <p class="long-list">
            <a v-for="(castMember, index) in topStructure(result).cast" :key="index" class="link" @click.stop="searchFor(castMember.name)">
              {{castMember.name}}<span v-if="countCastCrew(castMember.name)" class="small-count-bubble">&nbsp;({{ countCastCrew(castMember.name) }})</span><span v-if="index !== topStructure(result).cast.length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <!-- Keywords -->
        <div v-if="topStructure(result).flatKeywords && topStructure(result).flatKeywords.length" class="keywords mb-3">
          <h4>Keyword<span v-if="multipleEntries(topStructure(result).flatKeywords)">s</span></h4>
          <p class="long-list">
            <a v-for="(keyword, index) in sortedFlatKeywords" :key="index" class="link" @click.stop="searchFor(keyword)">
              {{keyword}}<span class="small-count-bubble">&nbsp;({{ keywordCounts[keyword] }})</span><span v-if="index !== topStructure(result).flatKeywords.length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <!-- Writers -->
        <div v-if="getCrewMember('Writer', false)" class="writers mb-3">
          <h4>Writer<span v-if="multipleEntries(getCrewMember('Writer', false))">s</span></h4>
          <p class="long-list">
            <a v-for="(name, index) in getCrewMember('Writer', false)" :key="index" class="link" @click.stop="searchFor(name)">
              {{name}}<span v-if="countCastCrew(name)" class="small-count-bubble">&nbsp;({{ countCastCrew(name) }})</span><span v-if="index !== getCrewMember('Writer', false).length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <!-- Composers -->
        <div v-if="getCrewMember('Composer')" class="composers mb-3">
          <h4>Composer<span v-if="multipleEntries(getCrewMember('Composer'))">s</span></h4>
          <p class="long-list">
            <a v-for="(name, index) in getCrewMember('Composer')" :key="index" class="link" @click.stop="searchFor(name)">
              {{name}}<span v-if="countCastCrew(name)" class="small-count-bubble">&nbsp;({{ countCastCrew(name) }})</span><span v-if="index !== getCrewMember('Composer').length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <!-- Editors -->
        <div v-if="getCrewMember('Editor').length" class="editors mb-3">
          <h4>Editor<span v-if="multipleEntries(getCrewMember('Editor'))">s</span></h4>
          <p class="long-list">
            <a v-for="(name, index) in getCrewMember('Editor')" :key="index" class="link" @click.stop="searchFor(name)">
              {{name}}<span v-if="countCastCrew(name)" class="small-count-bubble">&nbsp;({{ countCastCrew(name) }})</span><span v-if="index !== getCrewMember('Editor').length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <!-- Cinematographers -->
        <div v-if="getCrewMember('Photo').length" class="cinematographers mb-3">
          <h4>Cinematographer<span v-if="multipleEntries(getCrewMember('Photo'))">s</span></h4>
          <p class="long-list">
            <a v-for="(name, index) in getCrewMember('Photo')" :key="index" class="link" @click.stop="searchFor(name)">
              {{name}}<span v-if="countCastCrew(name)" class="small-count-bubble">&nbsp;({{ countCastCrew(name) }})</span><span v-if="index !== getCrewMember('Photo').length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <!-- Production Companies -->
        <div v-if="topStructure(result).production_companies && topStructure(result).production_companies.length" class="production-companies mb-3">
          <h4>Production <span v-if="multipleEntries(turnArrayIntoList(topStructure(result).production_companies, 'name'))">Companies</span><span v-else>Company</span></h4>
          <p class="long-list">
            <a v-for="(productionCompany, index) in topStructure(result).production_companies" :key="index" class="link" @click.stop="searchFor(productionCompany.name)">
              {{productionCompany.name}}<span v-if="countStudios(productionCompany.name)" class="small-count-bubble">&nbsp;({{ countStudios(productionCompany.name) }})</span><span v-if="index !== topStructure(result).production_companies.length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <!-- Producers -->
        <div v-if="getCrewMember('Producer').length" class="producers mb-3">
          <h4>Producer<span v-if="multipleEntries(getCrewMember('Producer'))">s</span></h4>
          <p class="long-list">
            <a v-for="(name, index) in getCrewMember('Producer')" :key="index" class="link" @click.stop="searchFor(name)">
              {{name}}<span v-if="countCastCrew(name)" class="small-count-bubble">&nbsp;({{ countCastCrew(name) }})</span><span v-if="index !== getCrewMember('Producer').length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-else class="loading-container">
      <div class="spinner-border text-light" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import ordinal from "ordinal-js";
import minBy from 'lodash/minBy';
import ToggleableRating from './ToggleableRating.vue';
import { getRating, getAllRatings } from "../assets/javascript/GetRating.js";
import ErrorLogService from "../services/ErrorLogService.js";

export default {
  name: 'MovieDetail',
  components: {
    ToggleableRating
  },
  data() {
    return {
      movie: null,
      result: null, // Will be constructed from movie data
      previousEntry: null,
      awardsData: null,
      getAllRatings: getAllRatings,
      isLoading: false
    };
  },
  created() {
    // Hide main header for this page
    this.$store.commit('setShowHeader', false);
    
    // Scroll to top when entering movie detail page
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Get movie data from route parameter - don't await to render immediately
    const tmdbId = this.$route.params.tmdbId;
    this.loadMovieData(tmdbId);
  },
  
  beforeUnmount() {
    // Show header again when leaving this page
    this.$store.commit('setShowHeader', true);
  },
  computed: {
    academyAwardWins() {
      if (!Array.isArray(this.awardsData)) {
        return [];
      }

      const categoryOrder = [
        "Best Picture",
        "Best Director",
        "Best Actor",
        "Best Actress",
        "Best Supporting Actor",
        "Best Supporting Actress",
        "Best Original Screenplay",
        "Best Adapted Screenplay",
        "Best Animated Feature Film",
        "Best Cinematography",
        "Best Costume Design",
        "Best Documentary Feature",
        "Best Documentary Short Subject",
        "Best Film Editing",
        "Best Makeup and Hairstyling",
        "Best Original Score",
        "Best Original Song",
        "Best Production Design",
        "Best Sound Editing",
        "Best Sound Mixing",
        "Best Visual Effects",
        "Best Animated Short Film",
        "Best Live Action Short Film",
        "Best Foreign Language Film",
        "Best International Feature Film"
      ];

      return this.awardsData
        .filter((award) => award.isWinner)
        .sort((a, b) => {
          const indexA = categoryOrder.map(c => c.toLowerCase()).indexOf(a.category.toLowerCase());
          const indexB = categoryOrder.map(c => c.toLowerCase()).indexOf(b.category.toLowerCase());

          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
    },
    academyAwardNominations() {
      if (!Array.isArray(this.awardsData)) {
        return [];
      }

      const categoryOrder = [
        "Best Picture",
        "Best Director",
        "Best Actor",
        "Best Actress",
        "Best Supporting Actor",
        "Best Supporting Actress",
        "Best Original Screenplay",
        "Best Adapted Screenplay",
        "Best Animated Feature Film",
        "Best Cinematography",
        "Best Costume Design",
        "Best Documentary Feature",
        "Best Documentary Short Subject",
        "Best Film Editing",
        "Best Makeup and Hairstyling",
        "Best Original Score",
        "Best Original Song",
        "Best Production Design",
        "Best Sound Editing",
        "Best Sound Mixing",
        "Best Visual Effects",
        "Best Animated Short Film",
        "Best Live Action Short Film",
        "Best Foreign Language Film",
        "Best International Feature Film"
      ];

      return this.awardsData
        .filter((award) => !award.isWinner)
        .sort((a, b) => {
          const indexA = categoryOrder.map(c => c.toLowerCase()).indexOf(a.category.toLowerCase());
          const indexB = categoryOrder.map(c => c.toLowerCase()).indexOf(b.category.toLowerCase());

          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
    },
    sortedFlatKeywords() {
      if (!this.topStructure(this.result)?.flatKeywords) return [];
      return [...this.topStructure(this.result).flatKeywords].sort((a, b) => {
        const countA = this.keywordCounts[a] || 0;
        const countB = this.keywordCounts[b] || 0;
        return countB - countA;
      });
    },
    keywordCounts() {
      const counts = {};
      this.topStructure(this.result)?.flatKeywords?.forEach(keyword => {
        // Count logic would go here - simplified for now
        counts[keyword] = 1;
      });
      return counts;
    }
  },
  methods: {
    async loadMovieData(tmdbId) {
      try {
        // Wait for database to be loaded if it isn't already
        if (!this.$store.state.dbLoaded) {
          // Wait for database to load
          await new Promise((resolve) => {
            const unwatch = this.$watch(
              () => this.$store.state.dbLoaded,
              (newVal) => {
                if (newVal) {
                  unwatch();
                  resolve();
                }
              }
            );
          });
        }

        // Check if movie exists in user's database
        const allResults = this.$store.getters.allMediaAsArray || [];
        const existingMovie = allResults.find(r => r.movie?.id?.toString() === tmdbId);
        
        if (existingMovie) {
          this.movie = existingMovie.movie;
          this.result = existingMovie;
          this.previousEntry = existingMovie;
        } else {
          // If not in database, we might need to fetch from TMDB
          // For now, redirect back to home if movie not found
          this.$router.push('/');
          return;
        }

        // Load awards data if available
        if (!this.awardsData) {
          await this.getAwardsData();
        }
      } catch (error) {
        console.error('Error loading movie data:', error);
        this.$router.push('/');
      }
    },

    goBack() {
      // Show loading state immediately
      this.isLoading = true;
      
      // Small delay to ensure loading state renders before navigation
      setTimeout(() => {
        // Use router to go back to previous page (which should be home)
        this.$router.go(-1);
      }, 50);
    },

    searchFor(query) {
      // Save the search query in store and navigate back to home
      this.$store.commit('setHomePageSearchValue', query);
      this.$store.commit('setHomePageSearchChips', []); // Clear existing chips
      this.$store.commit('setHomePageScrollPosition', 0); // Scroll to top for new search
      this.$router.push('/');
    },

    rateMedia(movie) {
      this.$store.commit('setMovieToRate', this.result);
      this.$router.push('/rate-movie');
    },

    // Copy over all the helper methods from DBGridLayoutSearchResult
    getYear(media) {
      const date = media?.movie?.release_date;
      return date ? new Date(date).getFullYear() : 'Unknown';
    },

    prettifyRuntime(result) {
      const runtime = result?.movie?.runtime;
      if (!runtime) return 'Runtime unknown';
      
      const hours = Math.floor(runtime / 60);
      const minutes = runtime % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes}m`;
      }
    },

    multipleEntries(array) {
      return Array.isArray(array) && array.length > 1;
    },

    turnArrayIntoList(array, key) {
      if (!Array.isArray(array)) return [];
      return key ? array.map(item => item[key]) : array;
    },

    getCrewMember(job, strict = false) {
      if (!this.topStructure(this.result)?.crew) return [];
      const crew = this.topStructure(this.result).crew.filter(member => {
        if (strict === 'strict') {
          return member.job === job;
        }
        return member.job?.includes(job);
      });
      return crew.map(member => member.name);
    },

    ratingForMedia(result) {
      return this.mostRecentRating(result).calculatedTotal;
    },

    normalizedRatingForMedia(result) {
      return this.mostRecentRating(result).normalizedRating;
    },

    mostRecentRating(media) {
      return getRating(media);
    },

    formattedDate(date) {
      if (!date) return '';
      return new Date(date).toLocaleDateString();
    },

    async getAwardsData() {
      try {
        const response = await axios.get(`https://web-production-b8145.up.railway.app/awards/tmdb/${this.movie.id}`);
        this.awardsData = response.data.map((item) => {
          return {
            ...item,
            isActing: ['TRUE', '1', true].includes(item.isActing),
            isWinner: ['TRUE', '1', true].includes(item.isWinner)
          }
        });
      } catch (error) {
        console.error('Failed to get awards data:', error);
        ErrorLogService.error('Failed to get awards data:', error);
      }
    },

    // Counting methods - these would need the full store data
    countDirector(name) {
      // Implementation to count director appearances
      return 0;
    },

    countGenre(name) {
      // Implementation to count genre appearances  
      return 0;
    },

    countCastCrew(name) {
      // Implementation to count cast/crew appearances
      return 0;
    },

    countStudios(name) {
      // Implementation to count studio appearances
      return 0;
    },

    parseNamesToList(names) {
      return Array.isArray(names) ? names.join(', ') : names;
    },

    // Letterboxd integration methods
    isMovieLoggedOnLetterboxd() {
      return false; // Implementation needed
    },

    logOnLetterboxd() {
      // Implementation needed
    },

    goToWikipedia(query) {
      const searchTerm = query || this.topStructure(this.result)?.title;
      window.open(`https://en.wikipedia.org/wiki/${encodeURIComponent(searchTerm)}`, '_blank');
    },

    topStructure(result) {
      return result?.movie;
    },

    // Rating deletion methods
    showConfimDeleteButton(dbKey, index) {
      // Implementation needed
    },

    showDeleteButton(dbKey, index) {
      // Implementation needed  
    },

    deleteRating(entry, index) {
      // Implementation needed
    }
  }
};
</script>

<style lang="scss" scoped>
.movie-detail-page {
  min-height: 100vh;
  background: #000;
  color: #fff;
}

.movie-header {
  position: relative;
  height: 200px;
  overflow: hidden;
  
  .backdrop-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .close-button {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 10;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s;
    
    &:hover {
      background: rgba(0, 0, 0, 0.9);
    }
    
    &.loading {
      pointer-events: none;
    }
    
    i {
      font-size: 1.2rem;
    }
    
    .spinner-border-sm {
      width: 20px;
      height: 20px;
    }
  }
  
  .header-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    
    h1 {
      position: absolute;
      font-size: 2rem;
      margin: 0;
      bottom: 0;
      color: white;
      background-color: rgba(0, 0, 0, 0.5);
      padding: 6px 12px;
      right: 0;
    }
  }
}

.movie-content {
  padding: 1rem;
  
  a {
    color: white;
    cursor: pointer;
  }
  
  h4 {
    font-size: 0.75rem;
    margin-bottom: 2px;
    color: #fff;
  }
  
  p {
    font-size: 1rem;
    margin-bottom: 1rem;
  }
  
  .rating-runtime-and-date {
    margin-bottom: 1rem;
    
    .line-one {
      display: flex;
      justify-content: space-between;
      
      h3 {
        margin: 0;
      }
    }
  }
  
  .details-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1rem;
  }
  
  .awards {
    .winners,
    .nominees {
      margin-bottom: 1rem;
      display: flex;
      flex-wrap: wrap;
      padding: 6px;
    }
  }
  
  .long-list {
    max-height: 150px;
    overflow-y: auto;
    padding: 6px;
    box-shadow: inset 0 0 5px -2px rgb(0 0 0 / 50%);
    
    a {
      white-space: nowrap;
      
      span {
        display: inline-block;
        text-decoration: none;
      }
    }
  }
  
  .previous-ratings {
    .accordion-button {
      background-color: white;
      color: black;
      padding: 8px 12px;
      
      &:focus {
        box-shadow: none;
      }
      
      &::after {
        display: none;
      }
    }
    
    .accordion-body {
      padding: 6px;
      
      table {
        table-layout: fixed;
        width: 100%;
        
        th {
          span {
            display: inline-block;
            font-size: 0.6rem;
            transform: rotate(60deg);
          }
        }
        
        td {
          font-size: 0.6rem;
        }
      }
    }
  }
  
  .small-count-bubble {
    bottom: 3px;
    font-size: 0.5rem;
    position: relative;
  }
  
  .letterboxd-status-button {
    width: 32px;
    height: 32px;
    margin-right: 8px;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, border-color 0.2s;
    border: 0;

    &.logged {
      border-color: #28a745;
    }

    &.not-logged {
      border-color: #6c757d;
    }
  }

  .letterboxd-icon {
    width: 24px;
    height: 24px;
    background: none !important;
  }
  
  .letterboxd-actions {
    .letterboxd-status {
      .badge {
        font-size: 0.75rem;
        padding: 0.5rem 0.75rem;
        
        i {
          margin-right: 0.25rem;
        }
      }
      
      .bg-success {
        background-color: #00e054 !important; // Letterboxd green
      }
    }
    
    .letterboxd-buttons {
      .btn {
        font-size: 0.7rem;
        padding: 0.375rem 0.5rem;
        
        i {
          margin-right: 0.25rem;
          font-size: 0.8rem;
        }
      }
      
      .btn-outline-success {
        border-color: #00e054;
        color: #00e054;
        
        &:hover {
          background-color: #00e054;
          border-color: #00e054;
        }
      }
    }
  }
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
}
</style>
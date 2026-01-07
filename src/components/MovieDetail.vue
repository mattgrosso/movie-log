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
      <img v-if="movie && getBackdropPath()"
           :src="`https://image.tmdb.org/t/p/w1280${getBackdropPath()}`"
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
        <div v-if="getAllRatings(previousEntry)" class="ratings-and-comparison-wrapper mb-3">
          <div class="ratings-section">
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

          <!-- Last Higher Rated Movie Poster -->
          <div v-if="lastHigherRatedMovie" class="comparison-poster-section">
            <h4>Best since</h4>
            <div class="poster-with-overlay" @click="navigateToMovie(lastHigherRatedMovie.movie.id)">
              <img
                :src="`https://image.tmdb.org/t/p/w342${getPosterPath(lastHigherRatedMovie)}`"
                :alt="lastHigherRatedMovie.movie.title"
                class="comparison-poster">
            </div>
            <div class="time-below-poster">({{ formatTimeDifference(lastHigherRatedMovie.movie.release_date, movie.release_date) }} prior)</div>
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

        <!-- Tags -->
        <div v-if="movieTags && movieTags.length" class="tags mb-3">
          <h4>Tag<span v-if="multipleEntries(movieTags)">s</span></h4>
          <p class="long-list">
            <a v-for="(tag, index) in sortedTags" :key="index" class="link" @click.stop="searchForTag(tag)">
              {{tag}}<span class="small-count-bubble">&nbsp;({{ tagCounts[tag] }})</span><span v-if="index !== movieTags.length - 1">&nbsp;&nbsp;</span>
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

        <!-- Choose Alternate Poster & Backdrop Section -->
        <div class="alternate-media-section mt-4 mb-4">
          <div class="text-center mb-3 d-flex justify-content-center gap-2">
            <button class="btn btn-sm btn-secondary" @click="togglePosterOptions">
              {{ showPosterOptions ? 'Hide' : 'Choose' }} Alternate Poster
            </button>
            <button class="btn btn-sm btn-secondary" @click="toggleBackdropOptions">
              {{ showBackdropOptions ? 'Hide' : 'Choose' }} Alternate Backdrop
            </button>
          </div>

          <!-- Poster Options Grid -->
          <div v-if="showPosterOptions">
            <div v-if="loadingPosters" class="text-center">
              <div class="spinner-border text-light" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
            <div v-else-if="posterOptions.length === 0" class="text-center text-light">
              <p>No alternate posters available for this movie.</p>
            </div>
            <div v-else class="poster-options-grid">
              <div v-for="(poster, index) in posterOptions" :key="index"
                   class="poster-option"
                   :class="{ 'selected': isSelectedPoster(poster.file_path) }"
                   @click="selectPoster(poster.file_path)">
                <img :src="`https://image.tmdb.org/t/p/w342${poster.file_path}`"
                     :alt="`Poster option ${index + 1}`">
              </div>
            </div>
          </div>

          <!-- Backdrop Options Grid -->
          <div v-if="showBackdropOptions">
            <div v-if="loadingBackdrops" class="text-center">
              <div class="spinner-border text-light" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
            <div v-else-if="backdropOptions.length === 0" class="text-center text-light">
              <p>No alternate backdrops available for this movie.</p>
            </div>
            <div v-else class="backdrop-options-grid">
              <div v-for="(backdrop, index) in backdropOptions" :key="index"
                   class="backdrop-option"
                   :class="{ 'selected': isSelectedBackdrop(backdrop.file_path) }"
                   @click="selectBackdrop(backdrop.file_path)">
                <img :src="`https://image.tmdb.org/t/p/w780${backdrop.file_path}`"
                     :alt="`Backdrop option ${index + 1}`">
              </div>
            </div>
          </div>
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
import ToggleableRating from './ToggleableRating.vue';
import { getRating, getAllRatings } from "../assets/javascript/GetRating.js";
import ErrorLogService from "../services/ErrorLogService.js";
import LetterboxdUrlService from '../services/LetterboxdUrlService.js';
import uniq from 'lodash/uniq';

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
      letterboxdData: null,
      getAllRatings: getAllRatings,
      isLoading: false,
      showPosterOptions: false,
      loadingPosters: false,
      posterOptions: [],
      showBackdropOptions: false,
      loadingBackdrops: false,
      backdropOptions: []
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
  watch: {
    '$route.params.tmdbId': {
      handler(newId) {
        if (newId) {
          // Scroll to top
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          // Reload movie data for new movie
          this.loadMovieData(newId);
        }
      }
    }
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

      // Count how many times each keyword appears across all movies in the database
      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const flatKeywords = result.movie.flatKeywords || [];
        flatKeywords.forEach((keyword) => {
          if (counts[keyword]) {
            counts[keyword]++;
          } else if (keyword) {
            counts[keyword] = 1;
          }
        });
      });

      return counts;
    },
    movieTags() {
      // Get all tags from all ratings for this movie
      if (!this.result || !this.result.ratings) return [];

      const allTags = this.result.ratings
        .flatMap(rating => rating.tags || [])
        .map(tag => tag.title)
        .filter(Boolean);

      // Return unique tags
      return [...new Set(allTags)];
    },
    sortedTags() {
      if (!this.movieTags || !this.movieTags.length) return [];
      return [...this.movieTags].sort((a, b) => {
        const countA = this.tagCounts[a] || 0;
        const countB = this.tagCounts[b] || 0;
        return countB - countA;
      });
    },
    tagCounts() {
      const counts = {};

      // Count how many times each tag appears across all movies in the database
      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        if (!result.ratings) return;

        const tags = result.ratings
          .flatMap(rating => rating.tags || [])
          .map(tag => tag.title)
          .filter(Boolean);

        tags.forEach((tag) => {
          if (counts[tag]) {
            counts[tag]++;
          } else {
            counts[tag] = 1;
          }
        });
      });

      return counts;
    },

    // Count computed properties for proper tracking
    allEntriesWithFlatKeywordsAdded() {
      return this.$store.getters.allMediaAsArray.map((result) => {
        const flatTMDBKeywords = result.movie.keywords ? result.movie.keywords.map((keyword) => keyword.name) : [];
        const flatChatGPTKeywords = result.movie.chatGPTKeywords || [];
        const flatKeywords = uniq([...flatTMDBKeywords, ...flatChatGPTKeywords]);
        return {
          ...result,
          movie: {
            ...result.movie,
            flatKeywords: flatKeywords || []
          }
        }
      });
    },

    countsDirectors() {
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

    countsCastCrew() {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const castData = result.movie.cast;
        const crewData = result.movie.crew;
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

    countsGenres() {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const genres = result.movie.genres;
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

    countsStudios() {
      const counts = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        const productionCompanies = result.movie.production_companies?.map(company => company.name) || [];

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

    lastHigherRatedMovie() {
      // Get the current movie's release date and rating
      const currentReleaseDate = this.movie?.release_date;
      const currentRating = this.ratingForMedia(this.result);

      if (!currentReleaseDate || !currentRating) {
        return null;
      }

      const currentDate = new Date(currentReleaseDate);

      // Get all movies released before this one
      const earlierMovies = this.allEntriesWithFlatKeywordsAdded
        .filter((result) => {
          const releaseDate = result.movie?.release_date;
          if (!releaseDate) return false;

          const movieDate = new Date(releaseDate);
          return movieDate < currentDate;
        })
        .filter((result) => {
          // Only include movies with a rating higher than current movie
          const rating = this.ratingForMedia(result);
          return rating > currentRating;
        })
        .sort((a, b) => {
          // Sort by release date descending (most recent first)
          const dateA = new Date(a.movie.release_date);
          const dateB = new Date(b.movie.release_date);
          return dateB - dateA;
        });

      // Return the most recent movie (first in the sorted array) that has a higher rating
      return earlierMovies.length > 0 ? earlierMovies[0] : null;
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

        // Load Letterboxd data if available
        await this.checkLetterboxdData();
      } catch (error) {
        console.error('Error loading movie data:', error);
        this.$router.push('/');
      }
    },

    goBack() {
      // Show loading state immediately
      this.isLoading = true;

      // Set navigation intent to preserve scroll position
      this.$store.commit('setHomePageNavigationIntent', 'close');

      // Navigate directly to home instead of using browser back
      // This prevents issues when navigating between movie detail pages
      this.$router.push('/');
    },

    searchFor(query) {
      // Set navigation intent to scroll to top
      this.$store.commit('setHomePageNavigationIntent', 'search');

      // Save the search query in store and navigate back to home
      this.$store.commit('setHomePageSearchValue', query);
      this.$store.commit('setHomePageSearchChips', []); // Clear existing chips
      this.$store.commit('setHomePageScrollPosition', 0); // Scroll to top for new search
      this.$router.push('/');
    },

    searchForTag(tag) {
      // Set navigation intent to scroll to top
      this.$store.commit('setHomePageNavigationIntent', 'search');

      // Create a tag chip and navigate back to home
      const tagChip = {
        id: `tag-${Date.now()}`,
        type: 'tag',
        value: tag,
        display: `Tag: ${tag}`
      };
      this.$store.commit('setHomePageSearchValue', ''); // Clear search input
      this.$store.commit('setHomePageSearchChips', [tagChip]); // Set tag chip
      this.$store.commit('setHomePageScrollPosition', 0); // Scroll to top for new search
      this.$router.push('/');
    },

    rateMedia(movie) {
      this.$store.commit('setMovieToRate', movie);
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


    parseNamesToList(names) {
      try {
        if (!names) return '';

        // If it's a string, return as-is
        if (typeof names === 'string') {
          return names;
        }

        // If it's an array
        if (Array.isArray(names)) {
          if (names.length === 0) return '';

          // Check if array contains objects with name property
          if (names[0] && typeof names[0] === 'object' && names[0].name) {
            return names.map((name) => name.name).join(', ');
          }

          // Array of strings
          return names.join(', ');
        }

        // Fallback for other types
        return String(names);
      } catch (error) {
        console.error('Failed to parse names:', error);
        return '';
      }
    },

    // Letterboxd integration methods
    isMovieLoggedOnLetterboxd() {
      // First check manual overrides
      const movie = this.topStructure(this.result);
      const overrides = this.$store.state.settings.letterboxdOverrides || {};

      // Create override key to match what we use in Settings
      const overrideKey = `${movie.title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${this.getYear(this.result)}`;

      if (overrides[overrideKey]) {
        return true; // Manual override says this movie is logged
      }

      // Fall back to automatic detection
      return this.letterboxdData && this.letterboxdData.length > 0;
    },

    logOnLetterboxd() {
      const movie = this.topStructure(this.result);

      // Check if movie is already logged on Letterboxd
      if (this.isMovieLoggedOnLetterboxd() && this.letterboxdData && this.letterboxdData.length > 0) {
        // Movie is logged - open the movie's Letterboxd page where user can see their diary entries
        const urls = LetterboxdUrlService.generateUrls(movie.title, this.getYear(this.result));

        if (urls && urls.webUrl) {
          // Open the movie's page on Letterboxd - use location.href to avoid white screen on return
          window.location.href = urls.webUrl;
        } else {
          // Fallback: open user's diary page
          const username = this.$store.state.settings.letterboxdUsername;
          if (username) {
            const diaryUrl = `https://letterboxd.com/${username}/films/diary/`;
            window.location.href = diaryUrl;
          }
        }
      } else {
        // Movie not logged - use the log action to open rating/review interface
        const success = LetterboxdUrlService.logMovie(movie.title, this.getYear(this.result));

        if (!success) {
          console.error('Failed to open movie on Letterboxd for logging:', movie.title);
          ErrorLogService.error('Failed to open movie on Letterboxd for logging:', movie.title);
        }
      }
    },

    async checkLetterboxdData() {
      if (!this.$store.state.settings.letterboxdConnected) {
        return;
      }

      try {
        const movie = this.topStructure(this.result);
        const username = this.$store.state.settings.letterboxdUsername;

        if (!username) {
          console.log('No Letterboxd username provided');
          return;
        }

        // Use the scraping service to get user's film data
        const LetterboxdScrapingService = (await import('../services/LetterboxdScrapingService.js')).default;
        const userData = await LetterboxdScrapingService.getUserData(username);

        // Filter to just this movie's entries
        if (userData && userData.films) {
          const movieEntries = userData.films.filter(film => {
            const normalizedFilmTitle = LetterboxdScrapingService.normalizeMovieTitle(film.title);
            const normalizedSearchTitle = LetterboxdScrapingService.normalizeMovieTitle(movie.title);
            return normalizedFilmTitle === normalizedSearchTitle;
          });

          this.letterboxdData = movieEntries;
        }

      } catch (error) {
        console.error('Failed to get Letterboxd data:', error);
        ErrorLogService.error('Failed to get Letterboxd data:', error);
        this.letterboxdData = null;
      }
    },

    goToWikipedia(query) {
      const searchTerm = query || this.topStructure(this.result)?.title;
      window.open(`https://en.wikipedia.org/wiki/${encodeURIComponent(searchTerm)}`, '_blank');
    },

    topStructure(result) {
      return result?.movie;
    },

    getBackdropPath() {
      // Check if user has selected a custom backdrop
      return this.result?.customBackdropPath || this.movie?.backdrop_path;
    },

    // Rating deletion methods
    showConfimDeleteButton(dbKey, index) {
      const deleteButton = document.getElementById(`delete-button-${dbKey}-${index}`);
      const confirmDeleteButton = document.getElementById(`confirm-delete-button-${dbKey}-${index}`);

      deleteButton.classList.add('d-none');
      confirmDeleteButton.classList.remove('d-none');
    },

    showDeleteButton(dbKey, index) {
      const deleteButton = document.getElementById(`delete-button-${dbKey}-${index}`);
      const confirmDeleteButton = document.getElementById(`confirm-delete-button-${dbKey}-${index}`);

      deleteButton.classList.remove('d-none');
      confirmDeleteButton.classList.add('d-none');
    },

    deleteRating(entry, index) {
      let scratch = { ...entry };
      scratch.ratings.splice(index, 1);

      if (!scratch.ratings.length) {
        scratch = null;
      }

      const dbEntry = {
        path: `movieLog/${entry.dbKey}`,
        value: scratch
      }

      this.$store.dispatch('setDBValue', dbEntry);
      document.querySelectorAll('.confirm-delete-button').forEach((button) => button.classList.add('d-none'));
      document.querySelectorAll('.delete-button').forEach((button) => button.classList.remove('d-none'));

      // Update local data to reflect the deletion
      if (scratch === null) {
        // Movie was completely removed, navigate back to home
        this.$router.push('/');
      } else {
        // Update local previousEntry data
        this.previousEntry = scratch;
      }
    },

    // Count methods using computed properties
    countDirector(name) {
      return this.countsDirectors[name] || 0;
    },

    countCastCrew(name) {
      return this.countsCastCrew[name] || 0;
    },

    countGenre(genre) {
      return this.countsGenres[genre] || 0;
    },

    countStudios(studio) {
      return this.countsStudios[studio] || 0;
    },

    formatTimeDifference(earlierDate, laterDate) {
      const earlier = new Date(earlierDate);
      const later = new Date(laterDate);
      const diffMs = later - earlier;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Less than 7 days: show in days
      if (diffDays < 7) {
        return diffDays === 1 ? '1 day' : `${diffDays} days`;
      }

      // Less than 60 days: show in weeks
      if (diffDays < 60) {
        const weeks = Math.round(diffDays / 7);
        return weeks === 1 ? '1 week' : `${weeks} weeks`;
      }

      // Less than 730 days (2 years): show in months
      if (diffDays < 730) {
        const months = Math.round(diffDays / 30);
        return months === 1 ? '1 month' : `${months} months`;
      }

      // Otherwise: show in years
      const years = Math.round(diffDays / 365);
      return years === 1 ? '1 year' : `${years} years`;
    },

    getPosterPath(result) {
      return result?.customPosterPath || result?.movie?.poster_path;
    },

    navigateToMovie(tmdbId) {
      // Navigate to the new movie detail page
      this.$router.push(`/movie/${tmdbId}`);
    },

    // Poster selection methods
    async togglePosterOptions() {
      this.showPosterOptions = !this.showPosterOptions;

      // If showing posters, hide backdrops
      if (this.showPosterOptions) {
        this.showBackdropOptions = false;

        if (this.posterOptions.length === 0) {
          await this.loadPosterOptions();
        }

        // Scroll to bring the poster options into view
        this.$nextTick(() => {
          const posterSection = document.querySelector('.poster-options-grid');
          if (posterSection) {
            const rect = posterSection.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetPosition = rect.top + scrollTop - 100;

            window.scrollTo({
              top: targetPosition,
              behavior: 'smooth'
            });
          }
        });
      }
    },

    async loadPosterOptions() {
      this.loadingPosters = true;

      try {
        const tmdbId = this.movie?.id;
        const apiKey = process.env.VUE_APP_TMDB_API_KEY;
        const imagesUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/images?api_key=${apiKey}`;

        const response = await axios.get(imagesUrl);
        const posters = response.data.posters || [];

        // Detect user's language preference
        const userLanguage = this.getUserLanguage();

        // Filter posters by language - prioritize user's language, then null (no text), then others
        const languageFilteredPosters = posters.filter(poster =>
          poster.iso_3166_1 === userLanguage || poster.iso_3166_1 === null || poster.iso_3166_1 === 'null'
        );

        // Use filtered list if we have enough, otherwise fall back to all posters
        const postersToSort = languageFilteredPosters.length >= 6 ? languageFilteredPosters : posters;

        // Sort by vote_count (descending) and take top 6
        this.posterOptions = postersToSort
          .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
          .slice(0, 6);

      } catch (error) {
        console.error('Error fetching poster options:', error);
        ErrorLogService.error('Error fetching poster options:', error);
      } finally {
        this.loadingPosters = false;
      }
    },

    getUserLanguage() {
      // Get user's language from browser
      const browserLang = navigator.language || navigator.userLanguage;
      // Extract country code (e.g., "en-US" -> "US", "en-GB" -> "GB")
      const countryCode = browserLang.includes('-') ? browserLang.split('-')[1].toUpperCase() : 'US';
      return countryCode;
    },

    isSelectedPoster(posterPath) {
      const customPoster = this.result?.customPosterPath;
      return customPoster === posterPath || (!customPoster && posterPath === this.movie?.poster_path);
    },

    async selectPoster(posterPath) {
      try {
        // Update the movie entry in the database with the custom poster path
        const dbEntry = {
          path: `movieLog/${this.result.dbKey}`,
          value: {
            ...this.result,
            customPosterPath: posterPath
          }
        };

        await this.$store.dispatch('setDBValue', dbEntry);

        // Update local data
        this.result.customPosterPath = posterPath;
        if (this.previousEntry) {
          this.previousEntry.customPosterPath = posterPath;
        }

      } catch (error) {
        console.error('Error saving custom poster:', error);
        ErrorLogService.error('Error saving custom poster:', error);
      }
    },

    // Backdrop selection methods
    async toggleBackdropOptions() {
      this.showBackdropOptions = !this.showBackdropOptions;

      // If showing backdrops, hide posters
      if (this.showBackdropOptions) {
        this.showPosterOptions = false;

        if (this.backdropOptions.length === 0) {
          await this.loadBackdropOptions();
        }

        // Scroll to bring the backdrop options into view
        this.$nextTick(() => {
          const backdropSection = document.querySelector('.backdrop-options-grid');
          if (backdropSection) {
            const rect = backdropSection.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetPosition = rect.top + scrollTop - 100;

            window.scrollTo({
              top: targetPosition,
              behavior: 'smooth'
            });
          }
        });
      }
    },

    async loadBackdropOptions() {
      this.loadingBackdrops = true;

      try {
        const tmdbId = this.movie?.id;
        const apiKey = process.env.VUE_APP_TMDB_API_KEY;
        const imagesUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/images?api_key=${apiKey}`;

        const response = await axios.get(imagesUrl);
        const backdrops = response.data.backdrops || [];

        // Detect user's language preference
        const userLanguage = this.getUserLanguage();

        // Filter backdrops by language - prioritize user's language, then null (no text), then others
        const languageFilteredBackdrops = backdrops.filter(backdrop =>
          backdrop.iso_3166_1 === userLanguage || backdrop.iso_3166_1 === null || backdrop.iso_3166_1 === 'null'
        );

        // Use filtered list if we have enough, otherwise fall back to all backdrops
        const backdropsToSort = languageFilteredBackdrops.length >= 6 ? languageFilteredBackdrops : backdrops;

        // Sort by vote_count (descending) and take top 6
        this.backdropOptions = backdropsToSort
          .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
          .slice(0, 6);

      } catch (error) {
        console.error('Error fetching backdrop options:', error);
        ErrorLogService.error('Error fetching backdrop options:', error);
      } finally {
        this.loadingBackdrops = false;
      }
    },

    isSelectedBackdrop(backdropPath) {
      const customBackdrop = this.result?.customBackdropPath;
      return customBackdrop === backdropPath || (!customBackdrop && backdropPath === this.movie?.backdrop_path);
    },

    async selectBackdrop(backdropPath) {
      try {
        // Update the movie entry in the database with the custom backdrop path
        const dbEntry = {
          path: `movieLog/${this.result.dbKey}`,
          value: {
            ...this.result,
            customBackdropPath: backdropPath
          }
        };

        await this.$store.dispatch('setDBValue', dbEntry);

        // Update local data
        this.result.customBackdropPath = backdropPath;
        if (this.previousEntry) {
          this.previousEntry.customBackdropPath = backdropPath;
        }

        // Update the movie data to immediately reflect the change
        if (this.movie) {
          this.movie.backdrop_path = backdropPath;
        }

      } catch (error) {
        console.error('Error saving custom backdrop:', error);
        ErrorLogService.error('Error saving custom backdrop:', error);
      }
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
  margin: 0 auto;
  max-width: 650px;
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
  
  .ratings-and-comparison-wrapper {
    display: flex;
    gap: 1rem;
    align-items: flex-start;

    .ratings-section {
      flex: 1;
      min-width: 0; // Allow flex item to shrink below content size
    }

    .comparison-poster-section {
      flex-shrink: 0;
      width: 65px;

      h4 {
        margin-bottom: 0.35rem;
        font-size: 0.6rem;
      }

      .poster-with-overlay {
        cursor: pointer;
        border-radius: 3px;
        overflow: hidden;
        transition: transform 0.2s;
        margin-bottom: 0.25rem;

        &:hover {
          transform: scale(1.02);
        }

        .comparison-poster {
          width: 100%;
          display: block;
          aspect-ratio: 2/3;
          object-fit: cover;
        }
      }

      .time-below-poster {
        font-size: 0.5rem;
        color: #fff;
        text-align: right;
        line-height: 1.2;
      }
    }
  }

  .previous-ratings,
  .ratings-section {
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

// Alternate Media Section (Posters & Backdrops)
.alternate-media-section {
  .poster-options-grid,
  .backdrop-options-grid {
    gap: 0.5rem;
    padding: 0 0.5rem;
    min-height: 400px; // Fixed height to prevent jumping
  }

  .poster-options-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }

  .backdrop-options-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}

.poster-option,
.backdrop-option {
  position: relative;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 4px;
  overflow: hidden;
  transition: all 0.2s;

  &:hover {
    border-color: #666;
  }

  &.selected {
    border-color: #6c757d;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.poster-option {
  aspect-ratio: 2/3;
}

.backdrop-option {
  aspect-ratio: 16/9;
}
</style>
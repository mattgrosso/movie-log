<template>
  <li
    class="grid-layout-media-result"
    :class="{'not-rated': result.falseEntry}"
    :id="sanitizeId(result.dbKey)"
    @click="showDetails(`Info-${this.topStructure(result).id}`)"
  >
    <img
      class="poster"
      v-lazy="{
        src: `https://image.tmdb.org/t/p/w500${topStructure(result).poster_path}`,
        loading: placeholderImage
      }"
    >
    <div class="details">
      <span v-if="activeQuickLinkList === 'bestPicture'">
        {{topStructure(result).academyAwardsYear}}
      </span>
      <span v-else-if="sortValue === 'watched'">
        {{smallFormattedDate(mostRecentRating(result).date)}}
      </span>
      <span v-else-if="sortValue === 'release'">
        {{smallFormattedDate(topStructure(result).release_date)}}
      </span>
      <span v-else-if="sortValue === 'views'">
        {{result.ratings.length}} view<span v-if="result.ratings.length > 1" >s</span>
      </span>
      <span v-else class="rank">
        {{getOrdinal(overAllRank)}}
      </span>
      <span v-if="!result.falseEntry" class="rating">
        {{parseFloat(ratingForMedia(result)).toFixed(2)}}
      </span>
    </div>
  </li>
  <Modal class="details-modal" :show="showDetailsModal" @close="showDetailsModal = false">
    <template v-slot:header>
      <h2>{{topStructure(result).title}}</h2>
      <img :src="`https://image.tmdb.org/t/p/w500${topStructure(result).backdrop_path}`" alt="Movie backdrop">
    </template>
    <template v-slot:body>
      <div class="details-modal-body col-12">

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

        <div class="details-actions d-flex align-items-center">
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
                    <div :id="`delete-button-${previousEntry.dbKey}-${index}`" class="delete-button btn btn-sm btn-warning" @click="showConfimDeleteButton(previousEntry.dbKey, index)">Delete Rating</div>
                    <div :id="`confirm-delete-button-${previousEntry.dbKey}-${index}`" class="confirm-delete-button d-none col-12 d-flex justify-content-between align-items-center">
                      <p class="m-0">Are you sure?</p>
                      <div>
                        <div class="btn btn-sm btn-info me-1" @click="showDeleteButton(previousEntry.dbKey, index)">Nevermind</div>
                        <div class="btn btn-sm btn-danger" @click="deleteRating(previousEntry, index)">Yes, Delete</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


        <div class="directors">
          <h4>
            Director<span v-if="multipleEntries(getCrewMember('Director', true))">s</span>
          </h4>
          <p class="long-list">
            <a v-for="(name, index) in getCrewMember('Director', 'strict')" :key="index" class="link" @click.stop="searchFor(name)">
              {{name}}<span v-if="countDirector(name)" class="small-count-bubble">&nbsp;({{ countDirector(name) }})</span><span v-if="index !== getCrewMember('Director', 'strict').length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <div class="genres">
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

        <div class="awards">
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

        <div v-if="topStructure(result).cast && topStructure(result).cast.length" class="cast">
          <h4>Cast</h4>
          <p class="long-list">
            <a v-for="(castMember, index) in topStructure(result).cast" :key="index" class="link" @click.stop="searchFor(castMember.name)">
              {{castMember.name}}<span v-if="countCastCrew(castMember.name)" class="small-count-bubble">&nbsp;({{ countCastCrew(castMember.name) }})</span><span v-if="index !== topStructure(result).cast.length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <div v-if="topStructure(result).flatKeywords && topStructure(result).flatKeywords.length" class="keywords">
          <h4>Keyword<span v-if="multipleEntries(topStructure(result).flatKeywords)">s</span></h4>
          <p class="long-list">
            <a v-for="(keyword, index) in sortedFlatKeywords" :key="index" class="link" @click.stop="searchFor(keyword)">

              {{keyword}}<span class="small-count-bubble">&nbsp;({{ keywordCounts[keyword] }})</span><span v-if="index !== topStructure(result).flatKeywords.length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <div v-if="getCrewMember('Writer', false)" class="writers">
          <h4>Writer<span v-if="multipleEntries(getCrewMember('Writer', false))">s</span></h4>
          <p class="long-list">
            <a v-for="(name, index) in getCrewMember('Writer', false)" :key="index" class="link" @click.stop="searchFor(name)">
              {{name}}<span v-if="countCastCrew(name)" class="small-count-bubble">&nbsp;({{ countCastCrew(name) }})</span><span v-if="index !== getCrewMember('Writer', false).length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <div v-if="getCrewMember('Composer')" class="composers">
          <h4>Composer<span v-if="multipleEntries(getCrewMember('Composer'))">s</span></h4>
          <p class="long-list">
            <a v-for="(name, index) in getCrewMember('Composer')" :key="index" class="link" @click.stop="searchFor(name)">
              {{name}}<span v-if="countCastCrew(name)" class="small-count-bubble">&nbsp;({{ countCastCrew(name) }})</span><span v-if="index !== getCrewMember('Composer').length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <div v-if="getCrewMember('Editor').length" class="editors">
          <h4>Editor<span v-if="multipleEntries(getCrewMember('Editor'))">s</span></h4>
          <p class="long-list">
            <a v-for="(name, index) in getCrewMember('Editor')" :key="index" class="link" @click.stop="searchFor(name)">
              {{name}}<span v-if="countCastCrew(name)" class="small-count-bubble">&nbsp;({{ countCastCrew(name) }})</span><span v-if="index !== getCrewMember('Editor').length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <div v-if="getCrewMember('Photo').length" class="cinematographers">
          <h4>Cinematographer<span v-if="multipleEntries(getCrewMember('Photo'))">s</span></h4>
          <p class="long-list">
            <a v-for="(name, index) in getCrewMember('Photo')" :key="index" class="link" @click.stop="searchFor(name)">
              {{name}}<span v-if="countCastCrew(name)" class="small-count-bubble">&nbsp;({{ countCastCrew(name) }})</span><span v-if="index !== getCrewMember('Photo').length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <div v-if="topStructure(result).production_companies && topStructure(result).production_companies.length" class="production-companies">
          <h4>Production <span v-if="multipleEntries(turnArrayIntoList(topStructure(result).production_companies, 'name'))">Companies</span><span v-else>Company</span></h4>
          <p class="long-list">
            <a v-for="(productionCompany, index) in topStructure(result).production_companies" :key="index" class="link" @click.stop="searchFor(productionCompany.name)">
              {{productionCompany.name}}<span v-if="countStudios(productionCompany.name)" class="small-count-bubble">&nbsp;({{ countStudios(productionCompany.name) }})</span><span v-if="index !== topStructure(result).production_companies.length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>

        <div v-if="getCrewMember('Producer').length" class="producers">
          <h4>Producer<span v-if="multipleEntries(getCrewMember('Producer'))">s</span></h4>
          <p class="long-list">
            <a v-for="(name, index) in getCrewMember('Producer')" :key="index" class="link" @click.stop="searchFor(name)">
              {{name}}<span v-if="countCastCrew(name)" class="small-count-bubble">&nbsp;({{ countCastCrew(name) }})</span><span v-if="index !== getCrewMember('Producer').length - 1">&nbsp;&nbsp;</span>
            </a>
          </p>
        </div>
      </div>
    </template>
  </Modal>
  <InsetBrowserModal :show="showInsetBrowserModal" :url="insetBrowserUrl" @close="showInsetBrowserModal = false" />
</template>

<script>
import axios from 'axios';
import ordinal from "ordinal-js";
import minBy from 'lodash/minBy';
import Modal from './Modal.vue';
import InsetBrowserModal from './InsetBrowserModal.vue';
import ToggleableRating from './ToggleableRating.vue';
import { getRating, getAllRatings } from "../assets/javascript/GetRating.js";
import placeholderImage from '../assets/images/sheen.jpg';
import LetterboxdUrlService from '../services/LetterboxdUrlService.js';

export default {
  props: {
    result: {
      type: Object,
      required: true
    },
    keywordCounts: {
      type: Object,
      required: false
    },
    allCounts: {
      type: Array,
      required: false
    },
    index: {
      type: Number,
      required: true
    },
    resultsAreFiltered: {
      type: Boolean,
      required: false,
      default: false
    },
    sortValue: {
      type: String,
      required: false,
      default: ""
    },
    activeQuickLinkList: {
      type: String,
      required: false,
      default: ""
    }
  },
  data () {
    return {
      getAllRatings: getAllRatings,
      showDetailsModal: false,
      showInsetBrowserModal: false,
      insetBrowserUrl: "",
      awardsData: null,
      letterboxdData: null,
      placeholderImage
    }
  },
  components: {
    Modal,
    InsetBrowserModal,
    ToggleableRating
  },
  watch: {
    async showDetailsModal (val) {
      if (val && !this.awardsData) {
        this.awardsData = this.getAwardsData();
      }
      if (val && this.$store.state.settings.letterboxdConnected && this.$store.state.settings.letterboxdUsername) {
        this.checkLetterboxdData();
      }
    }
  },
  computed: {
    overAllRank () {
      return this.$store.getters.allMediaSortedByRating.findIndex((media) => {
        return media.dbKey === this.result.dbKey;
      }) + 1;
    },
    previousEntry () {
      return this.$store.getters.allMediaAsArray.find((entry) => {
        return entry.dbKey === this.result.dbKey;
      })
    },
    academyAwardWins () {
      if (!Array.isArray(this.awardsData)) {
        return [];
      }

      const categoryOrder = [
        "Best Picture",
        "Best Director",
        "Best Actress",
        "Best Actor",
        "Best Supporting Actor",
        "Best Supporting Actress",
        "Best Screenplay",
        "Best Adapted Screenplay",
        "Best Original Screenplay",
        "Best Foreign Language Film",
        "Best Documentary",
        "Best Animated Feature",
        "Best Cinematography",
        "Best Original Score",
        "Best Adapted Score",
        "Best Original Song",
        "Best Editing",
        "Best Animated Short",
        "Best Documentary Short",
        "Best Live Action Short",
        "Best Visual Effects",
        "Best Assistant Director",
        "Best Costume Design",
        "Best Dance Direction",
        "Best Makeup",
        "Best Production Design",
        "Best Sound Editing",
        "Best Sound Mixing",
        "Best Sound",
        "Best Title Writing"
      ];

      return this.awardsData
        .filter((award) => award.isWinner)
        .sort((a, b) => {
          const indexA = categoryOrder.map(c => c.toLowerCase()).indexOf(a.category.toLowerCase());
          const indexB = categoryOrder.map(c => c.toLowerCase()).indexOf(b.category.toLowerCase());

          if (indexA === -1) {
            return 1;
          }

          if (indexB === -1) {
            return -1;
          }

          return indexA - indexB;
        });
    },
    academyAwardNominations () {
      if (!Array.isArray(this.awardsData)) {
        return [];
      }

      const categoryOrder = [
        "Best Picture",
        "Best Director",
        "Best Actress",
        "Best Actor",
        "Best Supporting Actor",
        "Best Supporting Actress",
        "Best Screenplay",
        "Best Adapted Screenplay",
        "Best Original Screenplay",
        "Best Foreign Language Film",
        "Best Documentary",
        "Best Animated Feature",
        "Best Cinematography",
        "Best Original Score",
        "Best Adapted Score",
        "Best Original Song",
        "Best Editing",
        "Best Animated Short",
        "Best Documentary Short",
        "Best Live Action Short",
        "Best Visual Effects",
        "Best Assistant Director",
        "Best Costume Design",
        "Best Dance Direction",
        "Best Makeup",
        "Best Production Design",
        "Best Sound Editing",
        "Best Sound Mixing",
        "Best Sound",
        "Best Title Writing"
      ];

      return this.awardsData
        .filter((award) => !award.isWinner)
        .sort((a, b) => {
          const indexA = categoryOrder.map(c => c.toLowerCase()).indexOf(a.category.toLowerCase());
          const indexB = categoryOrder.map(c => c.toLowerCase()).indexOf(b.category.toLowerCase());

          if (indexA === -1) {
            return 1;
          }

          if (indexB === -1) {
            return -1;
          }

          return indexA - indexB;
        });
    },
    sortedFlatKeywords () {
      return this.topStructure(this.result).flatKeywords.sort((a, b) => {
        return this.keywordCounts[b] - this.keywordCounts[a];
      });
    }
  },
  methods: {
    async getAwardsData () {
      try {
        const response = await axios.get(`https://pacific-journey-63469-f4b691e852c6.herokuapp.com/awards/tmdb/${this.topStructure(this.result).id}`);
        this.awardsData = response.data.map((item) => {
          return {
            ...item,
            isActing: ['TRUE', '1', true].includes(item.isActing),
            isWinner: ['TRUE', '1', true].includes(item.isWinner)
          }
        });
      } catch (error) {
        console.error('Failed to get awards data:', error);
      }
    },
    async checkLetterboxdData () {
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
        this.letterboxdData = null;
      }
    },
    parseNamesToList (names) {
      try {
        if (names.length > 1) {
          return names.map((name) => name.name).join(", ");
        } else {
          return names[0].name;
        }
      } catch (error) {
        console.error('Failed to parse names:', error);
        return null;
      }
    },
    sanitizeId (id) {
      id = id || crypto.randomUUID();

      return `movie-${id.replace(/[^a-z0-9\-_:.]/gi, '_')}`;
    },
    updateSearchValue (value) {
      this.$emit('updateSearchValue', value);
    },
    topStructure (result) {
      return result.movie;
    },
    showDetails () {
      if (this.result.falseEntry) {
        this.goToWikipedia(this.result.movie.title);
        return;
      }

      this.showDetailsModal = true;
    },
    async goToWikipedia (searchValue) {
      let value;

      if (searchValue) {
        value = searchValue;
      } else {
        value = this.result.movie.title;
      }

      this.insetBrowserUrl = await this.wikiLinkFor(value);
      this.showInsetBrowserModal = true;
    },
    async wikiLinkFor (title) {
      const wiki = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrnamespace=0&gsrlimit=5&gsrsearch=%27${title}%27`);
      const pages = wiki.data.query.pages;
      const pagesArray = Object.keys(pages).map((page) => pages[page]);
      const bestMatch = minBy(pagesArray, (page) => page.index);

      return `https://en.m.wikipedia.org/w/index.php?curid=${bestMatch.pageid}`;
    },
    searchFor (term) {
      this.updateSearchValue(term);

      window.scroll({
        top: top,
        behavior: 'smooth'
      });

      this.showDetailsModal = false;
    },
    getYear (media) {
      const date = media.movie.release_date;
      return new Date(date).getFullYear();
    },
    prettifyRuntime (result) {
      const minutes = result.movie.runtime;
      return minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : "";
    },
    turnArrayIntoList (array, key) {
      if (!array) {
        return ""
      }

      let arr = [...array];

      if (arr[0][key] && !key) {
        return "";
      }

      if (key && arr[0][key]) {
        arr = arr.map((el) => el[key]);
      }

      if (arr.length > 1) {
        return arr.join(", ");
      } else {
        return arr[0];
      }
    },
    multipleEntries (entry) {
      return entry && entry.length > 1;
    },
    getCrewMember (title, strict) {
      if (!this.topStructure(this.result).crew) {
        return "";
      }

      const crew = this.topStructure(this.result).crew;

      let matches;
      if (strict) {
        matches = crew.filter((member) => member.job === title);
      } else {
        let titles;
        switch (title) {
          case "Writer":
            titles = ["Writer", "Story", "Screenplay", "Author", "Script"];
            break;
          case "Composer":
            titles = ["Composer", "Music", "Score", "Soundtrack"];
            break;
          case "Photo":
            titles = ["Photo", "Cinematographer", "Director of Photography", "Camera Operator"];
            break;
          default:
            titles = [title];
        }
        matches = crew.filter((member) => titles.some(t => member.job.includes(t)));
      }

      const names = matches.map((match) => match.name);

      return names.length ? names : "";
    },
    ratingForMedia (result) {
      return this.mostRecentRating(result).calculatedTotal;
    },
    normalizedRatingForMedia (result) {
      return this.mostRecentRating(result).normalizedRating;
    },
    mostRecentRating (media) {
      return getRating(media);
    },
    getOrdinal (number) {
      return ordinal.toOrdinal(number);
    },
    rateMedia (media) {
      this.$store.commit('setMovieToRate', media);
      window.scroll({ top: top, behavior: 'smooth' });
      this.showDetailsModal = false;
      this.$router.push('/rate-movie');
    },
    formattedDate (date) {
      return new Date(date).toLocaleDateString();
    },
    smallFormattedDate (date, endDate) {
      const inputDate = new Date(date);

      if (endDate) {
        const inputEndDate = new Date(endDate);
        if (inputDate.getFullYear() === inputEndDate.getFullYear()) {
          return `${inputDate.getFullYear()}`;
        } else {
          return `${inputDate.getFullYear()} - ${inputEndDate.getFullYear()}`;
        }
      }

      const now = new Date();
      const diffInDays = Math.floor((now - inputDate) / (1000 * 60 * 60 * 24));

      if (diffInDays <= 6) {
        return inputDate.toLocaleDateString('en-US', { weekday: 'long' });
      } else {
        if (now.getFullYear() === inputDate.getFullYear()) {
          return inputDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
          return inputDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }
    },
    showConfimDeleteButton (previousEntry, index) {
      const deleteButton = document.getElementById(`delete-button-${previousEntry}-${index}`);
      const confirmDeleteButton = document.getElementById(`confirm-delete-button-${previousEntry}-${index}`);

      deleteButton.classList.add('d-none');
      confirmDeleteButton.classList.remove('d-none');
    },
    showDeleteButton (previousEntry, index) {
      const deleteButton = document.getElementById(`delete-button-${previousEntry}-${index}`);
      const confirmDeleteButton = document.getElementById(`confirm-delete-button-${previousEntry}-${index}`);

      deleteButton.classList.remove('d-none');
      confirmDeleteButton.classList.add('d-none');
    },
    deleteRating (previousEntry, index) {
      let scratch = { ...previousEntry };
      scratch.ratings.splice(index, 1);

      if (!scratch.ratings.length) {
        scratch = null;
      }

      const dbEntry = {
        path: `movieLog/${previousEntry.dbKey}`,
        value: scratch
      }

      this.$store.dispatch('setDBValue', dbEntry);
      document.querySelectorAll('.confirm-delete-button').forEach((button) => button.classList.add('d-none'));
      document.querySelectorAll('.delete-button').forEach((button) => button.classList.remove('d-none'));
    },
    countDirector (name) {
      return this.allCounts.directors[name] || 0;
    },
    countCastCrew (name) {
      return this.allCounts.castCrew[name] || 0;
    },
    countGenre (genre) {
      return this.allCounts.genres[genre] || 0;
    },
    countStudios (studio) {
      return this.allCounts.studios[studio] || 0;
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
        }
      }
    },
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
    }
  }
};
</script>

<style lang="scss">
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

  .grid-layout-media-result {
    cursor: pointer;
    position: relative;

    &.not-rated {
      filter: sepia(1);
    }

    .details {
      position: absolute;
      width: 100%;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      color: white;
      font-size: 0.5rem;
      height: 12px;
      display: flex;
      justify-content: space-between;
      padding: 0.5rem;
      align-items: center;
    }
  }

  .details-modal {
    a {
      color: white;
      cursor: pointer;
    }

    .cinemaroll-modal-content {
      .cinemaroll-modal-header {
        h2 {
          position: absolute;
          font-size: 2rem;
          margin: 0;
          bottom: 0;
          color: white;
          background-color: rgba(0, 0, 0, 0.5);
          padding: 6px 12px;
          right: 0;
        }

        img {
          width: 100%;
          height: 200px;
          object-fit: cover;
        }
      }
    }

    .cinemaroll-modal-body {
      .details-modal-body {
        h4 {
          font-size: 0.75rem;
          margin-bottom: 2px;
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
      }
    }

    .small-count-bubble {
      bottom: 3px;
      font-size: 0.5rem;
      position: relative;
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
        
        .btn-success {
          background-color: #00e054;
          border-color: #00e054;
        }
      }
    }
  }
</style>
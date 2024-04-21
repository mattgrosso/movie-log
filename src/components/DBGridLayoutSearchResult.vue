<template>
  <li
    class="grid-layout-media-result"
    @click="showDetails(`Info-${this.topStructure(result).id}`)"
  >
    <img
      class="poster"
      v-lazy="`https://image.tmdb.org/t/p/original${topStructure(result).poster_path}`"
    >
    <div class="details">
      <span class="rank">
        {{getOrdinal(overAllRank)}}
      </span>
      <span class="rating">
        {{parseFloat(mostRecentRating(result).calculatedTotal).toFixed(2)}}
      </span>
    </div>
  </li>
  <insetBrowserModal :show="showInsetBrowserModal" :url="insetBrowserUrl" @close="showInsetBrowserModal = false" />
  <Modal class="details-modal" :show="showDetailsModal" @close="showDetailsModal = false">
    <template v-slot:header>
      <h2>{{topStructure(result).title}}</h2>
      <img :src="`https://image.tmdb.org/t/p/original${topStructure(result).backdrop_path}`" alt="Movie backdrop">
    </template>
    <template v-slot:body>
      <div class="details-modal-body">
        <div class="runtime-and-date">
          <h3>{{prettifyRuntime(result)}}</h3>
          <h3>{{getYear(result)}}</h3>
        </div>
        <div v-if="getAllRatings(previousEntry)" class="previous-ratings mb-3">
          <h4>Previous Ratings</h4>
          <div class="accordion">
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
                      <th><span>dir</span></th>
                      <th><span>img</span></th>
                      <th><span>stry</span></th>
                      <th><span>perf</span></th>
                      <th><span>sndtk</span></th>
                      <th><span>stick</span></th>
                      <th><span>imp</span></th>
                      <th><span>love</span></th>
                      <th><span>ovral</span></th>
                    </thead>
                    <tbody>
                      <tr class="table-secondary">
                        <td>{{rating.direction}}</td>
                        <td>{{rating.imagery}}</td>
                        <td>{{rating.story}}</td>
                        <td>{{rating.performance}}</td>
                        <td>{{rating.soundtrack}}</td>
                        <td>{{rating.stickiness}}</td>
                        <td>{{rating.impression}}</td>
                        <td>{{rating.love}}</td>
                        <td>{{rating.overall}}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
        <h4>Director<span v-if="multipleEntries(getCrewMember('Director', true))">s</span></h4>
        <p>{{getCrewMember("Director", true)}}</p>

        <h4>Genre<span v-if="multipleEntries(turnArrayIntoList(topStructure(result).genres, 'name'))">s</span></h4>
        <p>{{turnArrayIntoList(topStructure(result).genres, "name")}}</p>

        <h4>Writer<span v-if="multipleEntries(getCrewMember('Writer', false))">s</span></h4>
        <p>{{getCrewMember("Writer", false)}}</p>

        <h4>Composer<span v-if="multipleEntries(getCrewMember('Composer'))">s</span></h4>
        <p>{{getCrewMember("Composer")}}</p>

        <h4>Editor<span v-if="multipleEntries(getCrewMember('Editor', 'strict'))">s</span></h4>
        <p>{{getCrewMember("Editor", "strict")}}</p>

        <h4>Cinematographer<span v-if="multipleEntries(getCrewMember('Photo'))">s</span></h4>
        <p>{{getCrewMember("Photo")}}</p>

        <h4>Cast</h4>
        <p class="long-list">{{turnArrayIntoList(topStructure(result).cast, "name")}}</p>

        <h4>Production <span v-if="multipleEntries(turnArrayIntoList(topStructure(result).production_companies, 'name'))">Companies</span><span v-else>Company</span></h4>
        <p>{{turnArrayIntoList(topStructure(result).production_companies, "name")}}</p>

        <h4>Producer<span v-if="multipleEntries(getCrewMember('Producer'))">s</span></h4>
        <p class="long-list">{{getCrewMember("Producer")}}</p>
      </div>
    </template>
  </Modal>
</template>

<script>
import axios from 'axios';
import ordinal from "ordinal-js";
import minBy from 'lodash/minBy';
import EpisodeRatingsChart from './EpisodeRatingsChart.vue';
import Modal from './Modal.vue';
import insetBrowserModal from './insetBrowserModal.vue';
import { getRating, getAllRatings } from "../assets/javascript/GetRating.js";

export default {
  props: {
    result: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    },
    resultsAreFiltered: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data () {
    return {
      openEpisodes: [],
      getAllRatings: getAllRatings,
      showModal: false,
      showInsetBrowserModal: false,
      insetBrowserUrl: ""
    }
  },
  components: {
    EpisodeRatingsChart,
    Modal,
    insetBrowserModal
  },
  computed: {
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    overAllRank () {
      return this.$store.getters.allMediaSortedByRating.findIndex((media) => {
        return this.topStructure(media).id === this.topStructure(this.result).id;
      }) + 1;
    },
    previousEntry () {
      return this.$store.getters.allMoviesAsArray.find((entry) => {
        return entry.movie.id === this.topStructure(this.result).id;
      })
    },
  },
  methods: {
    updateSearchValue (searchType, value) {
      this.$emit('updateSearchValue', { searchType: searchType, value });
    },
    topStructure (result) {
      if (this.currentLogIsTVLog) {
        return result.tvShow;
      } else {
        return result.movie;
      }
    },
    showDetails () {
      this.showDetailsModal = true;
    },
    async goToWikipedia (result) {
      let title;
      if (this.currentLogIsTVLog) {
        title = result.tvShow.name;
      } else {
        title = result.movie.title;
      }

      this.insetBrowserUrl = await this.wikiLinkFor(title);
      this.showInsetBrowserModal = true;
    },
    async wikiLinkFor (title) {
      const wiki = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrnamespace=0&gsrlimit=5&gsrsearch=%27${title}%27`);
      const pages = wiki.data.query.pages;
      const pagesArray = Object.keys(pages).map((page) => pages[page]);
      const bestMatch = minBy(pagesArray, (page) => page.index);

      return `https://en.m.wikipedia.org/w/index.php?curid=${bestMatch.pageid}`;
    },
    searchFor (searchType, term) {
      this.updateSearchValue(searchType, term);

      window.scroll({
        top: top,
        behavior: 'smooth'
      })
    },
    getYear (media) {
      let date;
      if (this.currentLogIsTVLog) {
        date = media.tvShow.first_air_date;
      } else {
        date = media.movie.release_date;
      }

      return new Date(date).getFullYear();
    },
    tvNetwork (result) {
      const networkName = result.tvShow.networks ? result.tvShow.networks[0].name : false;

      if (networkName) {
        return networkName;
      } else {
        return "";
      }
    },
    prettifyRuntime (result) {
      let minutes;
      if (this.currentLogIsTVLog && result.tvShow.episode_run_time) {
        minutes = result.tvShow.episode_run_time[0];
      } else if (this.currentLogIsTVLog) {
        minutes = 0;
      } else {
        minutes = result.movie.runtime;
      }
      return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
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
      return entry.split(", ").length > 1;
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
        matches = crew.filter((member) => member.job.includes(title));
      }

      const names = matches.map((match) => match.name);

      if (!names.length) {
        return "";
      } else if (names.length > 1) {
        return names.join(", ");
      } else {
        return names[0];
      }
    },
    mostRecentRating (media) {
      if (this.currentLogIsTVLog) {
        return media.ratings.tvShow;
      } else {
        return getRating(media);
      }
    },
    getOrdinal (number) {
      return ordinal.toOrdinal(number);
    },
    rateMedia (media) {
      if (this.currentLogIsTVLog) {
        this.$store.commit('setTVShowToRate', media);
        window.scroll({ top: top, behavior: 'smooth' });
        this.$router.push('/rate-tv-show');
      } else {
        this.$store.commit('setMovieToRate', media);
        window.scroll({ top: top, behavior: 'smooth' });
        this.$router.push('/rate-movie');
      }
    },
    formattedDate (date) {
      return new Date(date).toLocaleDateString();
    }
  }
};
</script>

<style lang="scss">
  .grid-layout-media-result {
    cursor: pointer;
    position: relative;

    &:hover {
      transform: scale(1.1);
      z-index: 1;
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
    .modal-content {
      .modal-header {
        h2 {
          position: absolute;
          font-size: 1.6rem;
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

    .modal-body {
      .details-modal-body {
        h4 {
          font-size: 0.75rem;
          margin-bottom: 2px;
        }

        p {
          font-size: 1rem;
          margin-bottom: 1rem;
        }
        
        .runtime-and-date {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .long-list {
          max-height: 150px;
          overflow-y: auto;
          padding: 6px;
          box-shadow: inset 0 0 5px -2px rgb(0 0 0 / 50%);
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
  }
</style>
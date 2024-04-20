<template>
  <li
    class="grid-layout-media-result"
    @click="showInfo(`Info-${this.topStructure(result).id}`)"
  >
    <div class="rank">
      <span>
        {{index + 1}}
      </span>
    </div>
    <img
      class="poster"
      v-lazy="`https://image.tmdb.org/t/p/original${topStructure(result).poster_path}`"
    >
  </li>
  <insetBrowserModal :show="showModal" :url="insetBrowserUrl" @close="showModal = false" />
</template>

<script>
import axios from 'axios';
import ordinal from "ordinal-js";
import minBy from 'lodash/minBy';
import EpisodeRatingsChart from './EpisodeRatingsChart.vue';
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
      insetBrowserUrl: ""
    }
  },
  components: {
    EpisodeRatingsChart,
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
    }
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
    showInfo (id) {
      const x = document.getElementById(id);

      if (!x) {
        return;
      }

      if (x.classList.contains("hidden")) {
        x.classList.remove("hidden");
        x.classList.add("shown");
        this.openEpisodes.push(id);
      } else {
        x.classList.add("hidden");
        x.classList.remove("shown");
        this.openEpisodes = this.openEpisodes.filter((episode) => episode !== id);
      }
    },
    async goToWikipedia (result) {
      let title;
      if (this.currentLogIsTVLog) {
        title = result.tvShow.name;
      } else {
        title = result.movie.title;
      }

      this.insetBrowserUrl = await this.wikiLinkFor(title);
      this.showModal = true;
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
    getCrewMember (crew, title, strict) {
      if (!crew) {
        return "";
      }

      let matches;
      if (strict) {
        matches = crew.filter((crew) => crew.job === title);
      } else {
        matches = crew.filter((crew) => crew.job.includes(title));
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
    position: relative;

    .rank {
      align-items: center;
      background-color: rgba(0, 0, 0, 0.5);
      color: white;
      display: flex;
      font-size: 0.5rem;
      font-weight: bold;
      height: 25px;
      justify-content: center;
      left: -25px;
      padding: 0.5rem;
      position: absolute;
      top: -8px;
      transform: rotate(-45deg);
      width: 60px;

      span {
        bottom: 0;
        display: block;
        left: 50%;
        position: absolute;
        transform: translateX(-50%);
      }
    }
  }
</style>
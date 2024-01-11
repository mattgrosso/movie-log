<template>
  <li
    class="media-result py-3 px-1 my-3 d-flex flex-wrap align-items-center shadow-lg"
    @click="showInfo(`Info-${this.topStructure(result).id}`)"
  >
    <label class="number col-1 text-center">
      {{index + 1}}
    </label>
    <div class="poster col-2">
      <img
        class="col-12"
        @click.stop="goToWikipedia(result)"
        v-lazy="`https://image.tmdb.org/t/p/original${topStructure(result).poster_path}`"
      >
    </div>
    <div class="details px-4 col-7">
      <p class="title mb-1">
        <span v-if="currentLogIsTVLog" class="fs-4">
          {{result.tvShow.name}}
        </span>
        <span v-else class="fs-4">
          {{result.movie.title}}
        </span>
        <a class="link mx-2" @click.stop="searchFor('year', `${getYear(result)}`)">({{getYear(result)}})</a>
      </p>
      <p class="etc m-0 d-flex flex-wrap">
        <span v-if="currentLogIsTVLog" class="col-12">{{tvNetwork(result)}}</span>
        <span v-else class="col-12">{{prettifyRuntime(result)}}</span>
        <span class="col-12">{{turnArrayIntoList(topStructure(result).genres, "name")}}</span>
        <span class="col-12">
          <a v-if="currentLogIsTVLog && result.tvShow.created_by" class="link" @click.stop="searchFor('cast/crew', `\'${result.tvShow.created_by[0].name}\'`)">{{result.tvShow.created_by[0].name}}</a>
          <a v-if="!currentLogIsTVLog" class="link" @click.stop="searchFor('director', `\'${getCrewMember(result.movie.crew, 'Director', 'strict')}\'`)">{{getCrewMember(result.movie.crew, 'Director', 'strict')}}</a>
        </span>
      </p>
    </div>
    <div class="rating col-2 d-flex justify-content-center flex-wrap">
      <p class="col-12 m-0 fs-3 text-center">{{parseFloat(mostRecentRating(result).rating).toFixed(2)}}</p>
    </div>
    <div v-if="currentLogIsTVLog" @click.stop="rateTVShow(result.tvShow)" class="rerate-button">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-square-fill shadow-sm" viewBox="0 0 16 16">
        <path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2zm6.5 4.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3a.5.5 0 0 1 1 0z"/>
      </svg>
    </div>

    <div :id="`Info-${topStructure(result).id}`" class="full-info ps-3 hidden">
      <hr class="my-4">
      <h3 class="mt-3 mb-2 fs-5">Full Rating</h3>
      <p class="rating-categories m-3">
        <span>Direction: {{mostRecentRating(result).direction}},&nbsp;</span>
        <span>Imagery: {{mostRecentRating(result).imagery}},&nbsp;</span>
        <span>Story: {{mostRecentRating(result).story}},&nbsp;</span>
        <span>Performance: {{mostRecentRating(result).performance}},&nbsp;</span>
        <span>Soundtrack: {{mostRecentRating(result).soundtrack}},&nbsp;</span>
        <span>Impression: {{mostRecentRating(result).impression}},&nbsp;</span>
        <span>Love: {{mostRecentRating(result).love}},&nbsp;</span>
        <span>Overall: {{mostRecentRating(result).overall}}</span>
      </p>

      <hr>

      <h3 class="mt-3 mb-2 fs-5">Production Companies</h3>
      <p class="m-3">{{turnArrayIntoList(topStructure(result).production_companies, "name")}}</p>

      <hr>

      <h3 class="mt-3 mb-2 fs-5">Producer(s)</h3>
      <p class="m-3">{{getCrewMember(topStructure(result).crew, "Producer")}}</p>

      <hr>

      <h3 class="mt-3 mb-2 fs-5">Writer(s)</h3>
      <p class="m-3" v-if='getCrewMember(topStructure(result).crew, "Writer")'>{{getCrewMember(topStructure(result).crew, "Writer")}} (Writer)</p>
      <p class="m-3" v-if='getCrewMember(topStructure(result).crew, "Screenplay")'>{{getCrewMember(topStructure(result).crew, "Screenplay")}} (Screenplay)</p>
      <p class="m-3" v-if='getCrewMember(topStructure(result).crew, "Story")'>{{getCrewMember(topStructure(result).crew, "Story")}} (Story)</p>
      <p class="m-3" v-if='getCrewMember(topStructure(result).crew, "Novel")'>{{getCrewMember(topStructure(result).crew, "Novel")}} (Novel)</p>

      <hr>

      <h3 class="mt-3 mb-2 fs-5">Actors</h3>
      <div class="actors">
        <p class="m-3">{{turnArrayIntoList(topStructure(result).cast, "name")}}</p>
      </div>

      <hr>

      <h3 class="mt-3 mb-2 fs-5">Composer(s)</h3>
      <p class="m-3">{{getCrewMember(topStructure(result).crew, "Composer")}}</p>

      <hr>

      <h3 class="mt-3 mb-2 fs-5">Editor(s)</h3>
      <p class="m-3">{{getCrewMember(topStructure(result).crew, "Editor", "strict")}}</p>

      <hr>

      <h3 class="mt-3 mb-2 fs-5">Cinematographer(s)</h3>
      <p class="m-3">{{getCrewMember(topStructure(result).crew, "Photo")}}</p>

      <hr v-if='turnArrayIntoList(topStructure(result).tags, "title")'>

      <h3 class="mt-3 mb-2 fs-5" v-if='turnArrayIntoList(topStructure(result).tags, "title")'>Tags</h3>
      <p class="m-3" v-if='turnArrayIntoList(topStructure(result).tags, "title")'>{{turnArrayIntoList(topStructure(result).tags, "title")}}</p>

      <hr v-if="turnArrayIntoList(result.awards?.oscarWins).length || turnArrayIntoList(result.awards?.oscarNoms).length">

      <h3 class="mt-3 mb-2 fs-5" v-if="turnArrayIntoList(result.awards?.oscarWins).length || turnArrayIntoList(result.awards?.oscarNoms).length">Academy Awards</h3>
      <div class="awards m-3">
        <p v-if="turnArrayIntoList(result.awards?.oscarWins).length">Won: {{turnArrayIntoList(result.awards?.oscarWins)}}</p>
        <p v-if="turnArrayIntoList(result.awards?.oscarNoms).length">Nominated: {{turnArrayIntoList(result.awards?.oscarNoms)}}</p>
      </div>

      <hr>

      <h3 v-if="currentLogIsTVLog" class="mt-3 mb-2 fs-5">Ratings Chart</h3>
      <EpisodeRatingsChart v-if="currentLogIsTVLog && openEpisodes.includes(`Info-${this.topStructure(result).id}`)" :tvShow="result"/>

      <hr>

      <h3 class="mt-3 mb-2 fs-5">Viewings</h3>
      <p class="m-3" v-for="(rating, index) in result.ratings" :key="index">
        {{rating.medium}}
        <span v-if="rating.medium && rating.date">on</span>
        <span v-else-if="rating.date">On</span>
        {{formattedDate(rating.date)}}
        <span class="ratings-tags" v-if="rating.tags">{{ turnArrayIntoList(rating.tags, "title") }}</span>
      </p>
    </div>
  </li>
</template>

<script>
import axios from 'axios';
import ordinal from "ordinal-js";
import minBy from 'lodash/minBy';
import EpisodeRatingsChart from './EpisodeRatingsChart.vue';

export default {
  props: {
    result: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    }
  },
  data () {
    return {
      openEpisodes: []
    }
  },
  components: {
    EpisodeRatingsChart
  },
  computed: {
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    }
  },
  methods: {
    updateSearchValue (searchType, value) {
      this.$emit('updateSearchValue', {searchType: searchType, value});
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

      window.open(await this.wikiLinkFor(title));
    },
    async wikiLinkFor (title) {
      const wiki = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrnamespace=0&gsrlimit=5&gsrsearch=%27${title}%27`);
      const pages = wiki.data.query.pages;
      const pagesArray = Object.keys(pages).map((page) => pages[page]);
      const bestMatch = minBy(pagesArray, (page) => page.index);

      return `https://en.wikipedia.org/w/index.php?curid=${bestMatch.pageid}`;
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
        let mostRecentRating = media.ratings[0];

        media.ratings.forEach((rating) => {
          const ratingDate = rating.date ? new Date(rating.date).getTime() : 0;
          const mostRecentRatingDate = mostRecentRating.date ? new Date(mostRecentRating.date).getTime() : 0;

          if (!mostRecentRating.date) {
            mostRecentRating = rating;
          } else if (ratingDate && ratingDate > mostRecentRatingDate) {
            mostRecentRating = rating;
          }
        })

        return mostRecentRating;
      }
    },
    getOrdinal (number) {
      return ordinal.toOrdinal(number);
    },
    rateTVShow (tvShow) {
      this.$store.commit('setTVShowToRate', tvShow);

      window.scroll({
        top: top,
        behavior: 'smooth'
      })

      this.$router.push('/rate-tv-show');
    },
    formattedDate (date) {
      return new Date(date).toLocaleDateString();
    }
  }
};
</script>

<style lang="scss">
  .media-result {
    border: 1px solid black;
    cursor: pointer;
    overflow: hidden;
    position: relative;

    .details {
      .etc {
        font-size: 0.75rem;

        span {
          margin-right: 0.5rem;
        }
      }
    }

    .rating {
      .rank {
        font-size: 0.65rem;
      }
    }

    .rerate-button {
      align-items: center;
      display: flex;
      height: 30px;
      justify-content: center;
      padding: 6px;
      position: absolute;
      right: 0;
      top: 0;
      width: 30px;

      svg {
        width: 18px;
        height: 18px;

        path {
          fill: #316cf4;
        }
      }
    }

    .full-info {
      overflow: hidden;

      &.hidden {
        max-height: 0;
        transition: max-height 0.5s ease-in-out;
      }

      &.shown {
        max-height: 6000px;
        transition: max-height 0.5s ease-in-out;
      }

      .rating-categories {
        display: flex;
        flex-wrap: wrap;

        span {
          white-space: nowrap;
        }
      }

      .ratings-tags {
        color: #a7a7a7;
        font-size: 0.75rem;
        padding-left: 3px;
      }

      .actors {
        p {
          max-height: 100px;
          overflow-y: scroll;
        }
      }
    }
  }
</style>
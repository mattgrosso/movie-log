<template>
  <div class="insights col-12">
    <div class="col-12">
      <div class="details py-3">
        <p class="fs-5 my-2 text-center">
          You've rated {{allEntriesWithFlatKeywordsAdded.length}} {{movieOrTVShowDisplay}}s.
        </p>
        <p class="m-0 d-flex justify-content-center align-items-center">
          They have an average rating of {{averageRating(allEntriesWithFlatKeywordsAdded)}}
        </p>
      </div>
      <Charts
        v-if="!this.currentLogIsTVLog"
        :results="allEntriesWithFlatKeywordsAdded"
        :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"
        :allCounts="allCounts"
        @updateSearchValue="updateSearchValue"
      />
      <!-- <Settings/>
      <BulkTagEditor
        v-if="isMatt"
        :allEntriesWithFlatKeywordsAdded="allEntriesWithFlatKeywordsAdded"
      /> -->
    </div>
  </div>
</template>

<script>
import Charts from "./Charts.vue";
import { getRating } from "../assets/javascript/GetRating.js";
import uniq from 'lodash/uniq';

export default {
  name: "Insights",
  components: {
    Charts,
  },
  computed: {
    currentLogIsTVLog () {
      return this.$store.state.currentLog === "tvLog";
    },
    allEntriesWithFlatKeywordsAdded () {
      return this.$store.getters.allMediaAsArray.map((result) => {
        if (this.currentLogIsTVLog) {
          return {
            ...result,
            tvShow: {
              ...this.topStructure(result),
              flatKeywords: this.topStructure(result).keywords ? this.topStructure(result).keywords.map((keyword) => keyword.name) : []
            }
          }
        } else {
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
        }
      });
    },
    movieOrTVShowDisplay () {
      if (this.currentLogIsTVLog) {
        return "TV show";
      } else {
        return "movie";
      }
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
        if (this.topStructure(result).flatKeywords) {
          this.topStructure(result).flatKeywords.forEach((keyword) => {
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
        if (this.topStructure(result).genres) {
          this.topStructure(result).genres.forEach((genre) => {
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
        let director;
        if (this.currentLogIsTVLog) {
          director = result.tvShow.created_by?.[0].name;
        } else {
          director = result.movie.crew?.find((person) => person.job === "Director").name;
        }

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
        const cast = this.topStructure(result).cast?.filter((person, index) => index < 10).map(person => person.name) || [];
        const crew = this.topStructure(result).crew?.filter((person, index) => index < 10).map(person => person.name) || [];
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

      if (this.currentLogIsTVLog) {
        return counts;
      }

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
    allDirectors () {
      if (this.currentLogIsTVLog) {
        return [];
      }

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
    allMediums () {
      const mediums = {};

      this.allEntriesWithFlatKeywordsAdded.forEach((result) => {
        if (!this.currentLogIsTVLog) {
          result.ratings.forEach((rating) => {
            if (!rating.medium) {
              return;
            } else if (mediums[rating.medium]) {
              mediums[rating.medium]++;
            } else {
              mediums[rating.medium] = 1;
            }
          })
        }
      })

      return Object.keys(mediums).map((medium) => {
        return {
          name: this.titleCase(medium),
          count: mediums[medium]
        }
      });
    },
  },
  methods: {
    topStructure (result) {
      if (this.currentLogIsTVLog) {
        return result.tvShow;
      } else {
        return result.movie;
      }
    },
    mostRecentRating (media) {
      return getRating(media);
    },
    averageRating (results) {
      const ratedMovies = results.filter((result) => this.mostRecentRating(result).calculatedTotal);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
      const total = ratings.reduce((a, b) => a + b, 0);
      return (total / ratings.length).toFixed(2);
    },
    updateSearchValue (value) {
      console.log("Update search value:", value);
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
    titleCase (input) {
      const string = input.toString();
      return string.replace(
        /\w\S*/g,
        function (txt) {
          return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
      );
    }
  },
};
</script>

<style lang="scss">
  .insights {
    color: white;
  }
</style>
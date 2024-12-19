<template>
  <div class="outliers">
    <div class="outlier-threshold d-flex flex-wrap align-items-center col-12">
      <input type="range" class="form-range col-10" style="width: 100%" id="outlier-slider" min="0.5" max="5" step="0.25" v-model="threshold">
      <label for="outlier-slider" class="form-label col-2 d-flex justify-content-start align-items-center mb-2 col-12">Standard Deviation Threshold: {{ threshold }}</label>
    </div>
    <ul class="list-group list-group-flush">
      <li v-for="outlier in allOutliersArray" :key="outlier.name" class="list-group-item d-flex justify-content-between align-items-center outlier-item" @click="updateSearchValue(outlier.name)">
        <span>
          <span v-if="outlier.type !== 'Crewmember'">{{ outlier.type }}&nbsp;</span>
          <span v-if="outlier.type === 'Keyword'">"</span>{{ outlier.name }}<span v-if="outlier.type === 'Keyword'">"</span>
        </span>
        <span v-if="outlier.average.toFixed(2) > 6" class="badge bg-success rounded-pill">{{ outlier.average.toFixed(2) }}</span>
        <span v-if="outlier.average.toFixed(2) <= 6" class="badge bg-danger rounded-pill">{{ outlier.average.toFixed(2) }}</span>
      </li>
    </ul>
  </div>
</template>

<script>
import { getRating } from "../assets/javascript/GetRating.js";

export default {
  name: "Outliers",
  props: {
    resultsWithRatings: {
      type: Array,
      required: true
    },
    allCounts: {
      type: Object,
      required: true
    },
  },
  data () {
    return {
      threshold: 2,
    }
  },
  computed: {
    allOutliersArray () {
      const allOutliers = [
        ...this.outlierDirectors,
        ...this.outlierCastCrew,
        ...this.outlierGenres,
        ...this.outlierKeywords,
        ...this.outlierStudios,
        ...this.outlierYears,
      ];

      const uniqueOutliers = [];
      const namesSet = new Set();

      allOutliers.forEach(outlier => {
        if (!namesSet.has(outlier.name)) {
          namesSet.add(outlier.name);
          uniqueOutliers.push(outlier);
        }
      });

      // Sort the uniqueOutliers array by the "average" values in descending order
      uniqueOutliers.sort((a, b) => b.average - a.average);

      return uniqueOutliers;
    },
    directorsAverages () {
      const directorsWithAverages = [];
      const minimumNumberOfFilms = 3;

      Object.entries(this.allCounts.directors).forEach(([director, count]) => {
        if (count >= minimumNumberOfFilms) {
          const filmography = this.resultsWithRatings.filter((result) => {
            return result.movie.crew?.find((person) => person.job === "Director" && person.name === director);
          });

          const ratings = filmography.map((result) => getRating(result).calculatedTotal);
          const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;

          directorsWithAverages.push({
            name: director,
            type: "Director",
            average: average,
            count: ratings.length,
          });
        }
      });

      return directorsWithAverages.sort((a, b) => b.average - a.average);
    },
    outlierDirectors () {
      const averages = this.directorsAverages.map(director => director.average);
    
      if (averages.length === 0) {
        return [];
      }
    
      const mean = averages.reduce((a, b) => a + b, 0) / averages.length;
      const stdDev = Math.sqrt(averages.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / averages.length);
    
      // Define a threshold for outliers (e.g., 2 standard deviations from the mean)
      const threshold = this.threshold * stdDev;
    
      // Filter for the directors that are considered outliers
      const outliers = this.directorsAverages.filter(director => Math.abs(director.average - mean) > threshold);
    
      return outliers.sort((a, b) => b.average - a.average);
    },
    castCrewAverages () {
      const castCrewWithAverages = [];
      const minimumNumberOfFilms = 3;

      Object.entries(this.allCounts.castCrew).forEach(([person, count]) => {
        if (count >= minimumNumberOfFilms) {
          const filmography = this.resultsWithRatings.filter((result) => {
            return result.movie.crew?.some((personObj) => personObj.name === person);
          });

          const ratings = filmography.map((result) => getRating(result).calculatedTotal);
          const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;

          castCrewWithAverages.push({
            name: person,
            type: "Crewmember",
            average: average,
            count: ratings.length,
          });
        }
      });

      return castCrewWithAverages.sort((a, b) => b.average - a.average);
    },
    outlierCastCrew () {
      const averages = this.castCrewAverages.map(person => person.average);
      const mean = averages.reduce((a, b) => a + b, 0) / averages.length;
      const stdDev = Math.sqrt(averages.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / averages.length);

      // Define a threshold for outliers (e.g., 2 standard deviations from the mean)
      const threshold = this.threshold * stdDev;

      // Filter for the cast/crew that are considered outliers
      const outliers = this.castCrewAverages.filter(person => Math.abs(person.average - mean) > threshold);

      return outliers.sort((a, b) => b.average - a.average);
    },
    genresAverages () {
      const genresWithAverages = [];
      const minimumNumberOfFilms = 5;

      Object.entries(this.allCounts.genres).forEach(([genre, count]) => {
        if (count >= minimumNumberOfFilms) {
          const filmography = this.resultsWithRatings.filter((result) => {
            return result.movie.genres?.some((genreObj) => genreObj.name === genre);
          });

          const ratings = filmography.map((result) => getRating(result).calculatedTotal);
          const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;

          genresWithAverages.push({
            name: genre,
            type: "Genre",
            average: average,
            count: ratings.length,
          });
        }
      });

      return genresWithAverages.sort((a, b) => b.average - a.average);
    },
    outlierGenres () {
      const averages = this.genresAverages.map(genre => genre.average);
      const mean = averages.reduce((a, b) => a + b, 0) / averages.length;
      const stdDev = Math.sqrt(averages.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / averages.length);

      // Define a threshold for outliers (e.g., 2 standard deviations from the mean)
      const threshold = this.threshold * stdDev;

      // Filter for the genres that are considered outliers
      const outliers = this.genresAverages.filter(genre => Math.abs(genre.average - mean) > threshold);

      return outliers.sort((a, b) => b.average - a.average);
    },
    keywordAverages () {
      const keywordsWithAverages = [];
      const minimumNumberOfFilms = 5;

      Object.entries(this.allCounts.keywords).forEach(([keyword, count]) => {
        if (count >= minimumNumberOfFilms) {
          const filmography = this.resultsWithRatings.filter((result) => {
            return result.movie.flatKeywords?.includes(keyword);
          });

          const ratings = filmography.map((result) => getRating(result).calculatedTotal);
          const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;

          keywordsWithAverages.push({
            name: keyword,
            type: "Keyword",
            average: average,
            count: ratings.length,
          });
        }
      });

      return keywordsWithAverages.sort((a, b) => b.average - a.average);
    },
    outlierKeywords () {
      const averages = this.keywordAverages.map(keyword => keyword.average);
      const mean = averages.reduce((a, b) => a + b, 0) / averages.length;
      const stdDev = Math.sqrt(averages.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / averages.length);

      // Define a threshold for outliers (e.g., 2 standard deviations from the mean)
      const threshold = this.threshold * stdDev;

      // Filter for the keywords that are considered outliers
      const outliers = this.keywordAverages.filter(keyword => Math.abs(keyword.average - mean) > threshold);

      return outliers.sort((a, b) => b.average - a.average);
    },
    studioAverages () {
      const studiosWithAverages = [];
      const minimumNumberOfFilms = 5;

      Object.entries(this.allCounts.studios).forEach(([studio, count]) => {
        if (count >= minimumNumberOfFilms) {
          const filmography = this.resultsWithRatings.filter((result) => {
            return result.movie.production_companies?.some((studioObj) => studioObj.name === studio);
          });

          const ratings = filmography.map((result) => getRating(result).calculatedTotal);
          const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;

          studiosWithAverages.push({
            name: studio,
            type: "Studio",
            average: average,
            count: ratings.length,
          });
        }
      });

      return studiosWithAverages;
    },
    outlierStudios () {
      const averages = this.studioAverages.map(studio => studio.average);
      const mean = averages.reduce((a, b) => a + b, 0) / averages.length;
      const stdDev = Math.sqrt(averages.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / averages.length);

      // Define a threshold for outliers (e.g., 2 standard deviations from the mean)
      const threshold = this.threshold * stdDev;

      // Filter for the studios that are considered outliers
      const outliers = this.studioAverages.filter(studio => Math.abs(studio.average - mean) > threshold);

      return outliers.sort((a, b) => b.average - a.average);
    },
    yearsAverages () {
      const yearsWithAverages = [];
      const minimumNumberOfFilms = 3;

      Object.entries(this.allCounts.years).forEach(([year, count]) => {
        if (count >= minimumNumberOfFilms) {
          const filmography = this.resultsWithRatings.filter((result) => {
            return parseInt(this.getYear(result)) === parseInt(year);
          });

          const ratings = filmography.map((result) => getRating(result).calculatedTotal);
          const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;

          yearsWithAverages.push({
            name: year,
            type: "Year",
            average: average,
            count: ratings.length,
          });
        }
      });

      return yearsWithAverages.sort((a, b) => b.average - a.average);
    },
    outlierYears () {
      const averages = this.yearsAverages.map(year => year.average);
      const mean = averages.reduce((a, b) => a + b, 0) / averages.length;
      const stdDev = Math.sqrt(averages.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / averages.length);

      // Define a threshold for outliers (e.g., 2 standard deviations from the mean)
      const threshold = this.threshold * stdDev;

      // Filter for the years that are considered outliers
      const outliers = this.yearsAverages.filter(year => Math.abs(year.average - mean) > threshold);

      return outliers.sort((a, b) => b.average - a.average);
    },
  },
  methods: {
    getYear (media) {
      return new Date(media.movie.release_date).getFullYear();
    },
    updateSearchValue (value) {
      this.$emit('updateSearchValue', value);
    },
  },
};
</script>

<style lang="scss">
.outliers {
  .list-group-item {
    cursor: pointer;
    transition: background-color 0.2s ease-in-out;
    background-color: #343a40; /* Dark background color */
    color: #fff; /* White text color */
  }

  .list-group-item:hover {
    background-color: #495057; /* Slightly lighter dark background on hover */
  }

  .list-group-item:active {
    background-color: #6c757d; /* Even lighter dark background on active */
  }

  .badge {
    background-color: #007bff; /* Primary color for badge */
  }
}
</style>
<template>
  <div class="import-csv">
    <button v-show="!showFileUploader && !parsing" class="btn btn-warning" @click="showFileUpload">Upload Ratings from CSV</button>
    <div v-show="showFileUploader && !parsing" class="input-group">
      <p class="fs-4 my-0">Choose your file from your computer.</p>
      <p class="fs-6 my-0">Be aware, once you choose the file it will begin the upload process.</p>
      <input id="csvUpload" type="file" class="form-control mt-2" @change="convertCsv">
    </div>
    <div v-show="parsing" class="spinner-border text-white" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
  </div>
</template>

<script>
import Papa from 'papaparse';

export default {
  data() {
    return {
      csv: null,
      parsedCsv: null,
      showFileUploader: false,
      parsing: false
    }
  },
  computed: {
    ratingsForUpload () {
      if (!this.parsedCsv) {
        return [];
      }

      return this.parsedCsv.map((movie) => {
        this.parseTags(movie.tag);

        if (!movie.viewings) {
          return [{
            title: movie.title,
            year: movie.year,
            id: movie["tmdb id"],
            tags: this.parseTags(movie.tag),
            direction: movie.direction,
            imagery: movie.imagery,
            story: movie.story,
            performance: movie.performance,
            soundtrack: movie.soundtrack,
            impression: movie.impression,
            love: movie.love,
            overall: movie.overall,
            rating: movie.rating
          }];
        }

        // First we grab each viewing.
        const ratings = movie.viewings.split("| ");

        const medium = ratings[0];
        const date = ratings[1]?.split(";")[0];

        // For each viewing, create a new rating
        // The ratings all share the same values but the dates and mediums might be different
        return ratings.map((rating) => {
          return {
            title: movie.title,
            year: movie.year,
            id: movie["tmdb id"],
            medium: medium,
            date: date,
            tags: this.parseTags(movie.tag),
            direction: movie.direction,
            imagery: movie.imagery,
            story: movie.story,
            performance: movie.performance,
            soundtrack: movie.soundtrack,
            impression: movie.impression,
            love: movie.love,
            overall: movie.overall,
            rating: movie.rating
          }
        })
      })
    }
  },
  methods: {
    showFileUpload () {
      this.showFileUploader = true;
    },
    convertCsv (event) {
      this.parsing = true;

      const config = {
        dynamicTyping: true,
        header: true,
        transformHeader: this.transformHeader,
        complete: this.parsingComplete,
        error: this.uploadErrored
      }

      Papa.parse(event.target.files[0], config);
    },
    transformHeader (header) {
      let transformedHeader = header.toLowerCase();

      return transformedHeader;
    },
    parsingComplete (result) {
      this.parsedCsv = result.data;
      
      this.$emit("uploadRatings", this.ratingsForUpload);
    },
    uploadErrored (error) {
      console.log("Error in parsing");
      console.error(error);
    },
    parseTags (string) {
      if (!string) {
        return [];
      }

      return string.split(" | ").map((tag) => {
        return {title: tag};
      })
    }
  },
}
</script>

<style lang="scss">
  .import-csv {
    .spinner-border {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 auto;
    }
  }
</style>
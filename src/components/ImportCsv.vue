<template>
  <div class="import-csv">
    <button v-show="!showFileUploader && !parsing" class="btn btn-warning" @click="showFileUpload">Upload Ratings from CSV</button>
    <div v-show="showFileUploader && !parsing" class="input-group">
      <p class="fs-4 my-0">Choose your file from your computer.</p>
      <p class="fs-6 my-0">Be aware, once you choose the file it will begin the upload process.</p>
      <input id="csvUpload" type="file" class="form-control mt-2" @change="convertCsv">
    </div>
    <div v-show="parsing" class="progress">
      <div :style="{width: `${roundPercentage}%`}" class="progress-bar" role="progressbar" aria-label="Basic example" :aria-valuenow="roundPercentage" aria-valuemin="0" aria-valuemax="100">
        {{ roundPercentage }}%
      </div>
    </div>
  </div>
</template>

<script>
import Papa from 'papaparse';

export default {
  props: {
    uploadPercentage: {
      type: Number,
      required: false,
      default: 0
    }
  },
  data () {
    return {
      csv: null,
      parsedCsv: null,
      parsing: false,
      showFileUploader: false
    }
  },
  computed: {
    roundPercentage () {
      return (this.uploadPercentage * 100).toFixed(0);
    },
    ratingsForUpload () {
      if (!this.parsedCsv) {
        return [];
      }

      return this.parsedCsv.map((movie) => {
        if (!movie.viewings) {
          return [{
            direction: movie.direction,
            id: movie["tmdb id"],
            imagery: movie.imagery,
            impression: movie.impression,
            love: movie.love,
            overall: movie.overall,
            performance: movie.performance,
            rating: movie.rating,
            soundtrack: movie.soundtrack,
            story: movie.story,
            tags: this.parseTags(movie.tag),
            ownership: this.parseOwnership(movie.ownership),
            title: movie.title,
            year: movie.year
          }];
        }

        // First we grab each viewing.
        const viewingStrings = movie.viewings.split("; ");

        // For each rating we split it into date and medium
        const viewings = viewingStrings.map((viewing) => {
          if (!viewing) {
            return null;
          }

          const split = viewing.split("| ");

          return {
            medium: split[0],
            date: split[1].split(";")[0]
          }
        })

        // For each viewing, create a new rating
        // The ratings all share the same values but the dates and mediums might be different
        return viewings.map((rating) => {
          return {
            date: rating ? rating.date : null,
            direction: movie.direction,
            id: movie["tmdb id"],
            imagery: movie.imagery,
            impression: movie.impression,
            love: movie.love,
            medium: rating ? rating.medium : null,
            overall: movie.overall,
            performance: movie.performance,
            rating: movie.rating,
            soundtrack: movie.soundtrack,
            story: movie.story,
            tags: this.parseTags(movie.tag),
            ownership: this.parseOwnership(movie.ownership),
            title: movie.title,
            year: movie.year
          };
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
      const transformedHeader = header.toLowerCase();

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
        return { title: tag.split(" |")[0] };
      })
    },
    parseOwnership (string) {
      if (!string) {
        return [];
      }

      return string.split(", ").filter((string) => string);
    }
  },
}
</script>

<style lang="scss">
  .import-csv {
    .progress {
      height: 36px;

      .progress-bar {
        font-size: 1rem;
      }
    }
  }
</style>
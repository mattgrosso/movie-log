<template>
  <div v-if="keywordsForCloud.length > 1" class="keywords">
    <div class="keywords-header d-flex align-items-center justify-content-center py-2">
      <div class="keyword-threshold d-flex align-items-center col-12">
        <label for="customRange1" class="form-label col-2 d-flex justify-content-end align-items-center px-2 my-0">{{ threseholdRange }}%</label>
        <input type="range" class="form-range col-10" style="width: 83.33333333%" id="customRange1" min="0" :max="maxKeywordPercentage" v-model="threseholdRange">
      </div>
    </div>
    <vueWordCloud
      class="word-cloud"
      :words="keywordsForCloud"
      :color="wordCLoudColors"
      :rotation="wordCloudRotation"
      spacing="1"
      font-size-ratio="4"
      font-family="Roboto Condensed"
      @click="handleKeywordClick"
    />
  </div>
</template>

<script>
import randomColor from 'randomcolor';
import VueWordCloud from 'vuewordcloud';

export default {
  props: {
    results: {
      type: Array,
      required: true
    },
    countedKeywords: {
      type: Object,
      required: false,
      default: () => {}
    }
  },
  components: {
    VueWordCloud
  },
  data () {
    return {
      threseholdRange: 3
    }
  },
  computed: {
    keywordsForCloud () {
      const percentofMedia = Math.round(this.results.length * (this.threseholdRange / 100));

      const keywords = Object.keys(this.countedKeywords).map((keyword) => {
        return [keyword, this.countedKeywords[keyword]];
      }).filter((keyword) => keyword[1] > percentofMedia).sort((a, b) => b[1] - a[1]);

      return keywords;
    },
    maxKeywordPercentage () {
      const keywords = Object.keys(this.countedKeywords).map((keyword) => {
        return [keyword, this.countedKeywords[keyword]];
      }).sort((a, b) => b[1] - a[1]);

      return Math.floor((keywords[1][1] / this.results.length) * 100);
    }
  },
  methods: {
    handleKeywordClick (event) {
      this.searchFor(event.target.innerText);
    },
    searchFor (term) {
      this.updateSearchValue(term);

      window.scroll({
        top: top,
        behavior: 'smooth'
      })
    },
    updateSearchValue (value) {
      this.$emit('updateSearchValue', value);
    },
    wordCLoudColors (word) {
      const brightness = document.querySelector("body").classList.contains("bg-light") ? "dark" : "light";

      return [
        randomColor({ luminosity: brightness }),
        randomColor({ luminosity: brightness }),
        randomColor({ luminosity: brightness }),
        randomColor({ luminosity: brightness })
      ];
    },
    wordCloudRotation (word) {
      const index = Math.round(Math.random());
      return [0, 3 / 4][index];
    }
  },
};
</script>

<style lang="scss">
.keywords {
  .word-cloud {
    height: 250px !important;
    pointer-events: none;
    width: 100% !important;

    transition {
      div {
        cursor: pointer;
        pointer-events: all;
      }
    }
  }

  .badge {
    cursor: pointer;
  }
}
</style>
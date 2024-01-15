<template>
  <div v-if="keywordsForCloud.length > 1" class="keywords">
    <div class="keywords-header d-flex align-items-center justify-content-center py-2">
      <button
        class="keyword-style-toggle btn btn-sm btn-light"
        type="button"
        @click="showKeywordCloud = !showKeywordCloud"
      >
        <span v-if="showKeywordCloud">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-columns-gap" viewBox="0 0 16 16">
            <path d="M6 1v3H1V1zM1 0a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1zm14 12v3h-5v-3zm-5-1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zM6 8v7H1V8zM1 7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm14-6v7h-5V1zm-5-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1z"/>
          </svg>
        </span>
        <span v-else>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud" viewBox="0 0 16 16">
            <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383m.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
          </svg>
        </span>
      </button>
      <div class="keyword-threshold d-flex align-items-center col-10">
        <label for="customRange1" class="form-label col-2 d-flex justify-content-end align-items-center px-2 my-0">{{ threseholdRange }}%</label>
        <input type="range" class="form-range col-10" style="width: 83.33333333%" id="customRange1" min="0" :max="maxKeywordPercentage" v-model="threseholdRange">
      </div>
    </div>
    <vueWordCloud
      v-if="showKeywordCloud"
      class="word-cloud"
      :words="keywordsForCloud"
      :color="wordCLoudColors"
      :rotation="wordCloudRotation"
      spacing="1"
      font-size-ratio="4"
      font-family="Roboto Condensed"
      @click="handleKeywordClick"
    />
    <div v-else class="d-flex flex-wrap">
      <div v-for="(keyword, index) in keywordsForCloud" :key="index">
        <span class="badge mx-1 text-bg-secondary">
          <span @click="handleKeywordClick">{{ keyword[0] }}</span>
          <span>&nbsp;({{ Math.floor((keyword[1] / this.results.length) * 100) }}%)</span>
        </span>
      </div>
    </div>
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
      showKeywordCloud: true,
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
      this.searchFor('keyword', event.target.innerText);
    },
    searchFor (searchType, term) {
      this.updateSearchValue(searchType, term);

      window.scroll({
        top: top,
        behavior: 'smooth'
      })
    },
    updateSearchValue (searchType, value) {
      const searchObject = {
        searchType: searchType,
        value: value
      }
      this.$emit('updateSearchValue', searchObject);
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
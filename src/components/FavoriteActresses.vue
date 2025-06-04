<template>
  <div class="favorite-actresses">
    <ul>
      <li v-for="entry in topTenList" :key="entry.name" class="favorite-list-item col-3" @click="updateSearchValue(entry.name)">
        <div class="portrait-wrapper" v-if="entry.details && entry.details.profile_path">
          <img
            :src="`https://image.tmdb.org/t/p/w92${entry.details.profile_path}`"
            :alt="entry.name"
            class="portrait"
          />
        </div>
        <div class="portrait-wrapper" v-else>
          <div class="portrait placeholder"></div>
        </div>
        <span class="name">{{ entry.name }}</span>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  props: {
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    }
  },
  data () {
    return {
      count: 0, // Counter for debugging
      topTenList: [],
      minEntries: 3, // Minimum number of entries for an actor to be included
      confidenceNumber: 2, // This is the confidence number used in Bayesian average calculations
      billingExponent: 4 // Exponent for billing weight calculation
    }
  },
  async mounted () {
    this.waitForDataAndBuildList();
  },
  methods: {
    async waitForDataAndBuildList() {
      // Wait until allEntriesWithFlatKeywordsAdded is populated, then build the list
      if (Array.isArray(this.allEntriesWithFlatKeywordsAdded) && this.allEntriesWithFlatKeywordsAdded.length > 0) {
        await this.buildTopTwelveList();
      } else {
        setTimeout(this.waitForDataAndBuildList, 100);
      }
    },
    updateSearchValue (value) {
      this.$emit('updateSearchValue', value);
    },
    averageRating(results, weights = null) {
      // If weights are provided, use weighted average
      const ratedMovies = results.filter((result, idx) => this.mostRecentRating(result).calculatedTotal && (!weights || weights[idx] > 0));
      if (ratedMovies.length === 0) return 0;
      if (weights) {
        let weightedSum = 0;
        let totalWeight = 0;
        ratedMovies.forEach((result, idx) => {
          const rating = parseFloat(this.mostRecentRating(result).calculatedTotal);
          const weight = weights[idx];
          weightedSum += rating * weight;
          totalWeight += weight;
        });
        return (weightedSum / totalWeight).toFixed(2);
      } else {
        const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
        const total = ratings.reduce((a, b) => a + b, 0);
        return (total / ratings.length).toFixed(2);
      }
    },
    bayesianAverage(list, weights = null) {
      // Weighted Bayesian average
      const n = weights ? weights.reduce((a, b) => a + b, 0) : list.length;
      const c = this.confidenceNumber;
      const avg = parseFloat(this.averageRating(list, weights));
      const globalAvg = parseFloat(this.averageRating(this.allEntriesWithFlatKeywordsAdded));
      return (n / (n + c)) * avg + (c / (n + c)) * globalAvg;
    },
    compareTwoLists(listOne, listTwo) {
      if (!listOne || !listTwo) {
        return [];
      }
      const numberOfMoviesInFirstList = listOne.length;
      const confidenceNumber = this.confidenceNumber;
      const averageRatingForFirstList = this.averageRating(listOne);
      const averageRatingForAllMovies = this.averageRating(this.allEntriesWithFlatKeywordsAdded);
      const firstListBayesianAverage  = (numberOfMoviesInFirstList  / (numberOfMoviesInFirstList  + confidenceNumber) * averageRatingForFirstList  + (confidenceNumber / (numberOfMoviesInFirstList  + confidenceNumber) * averageRatingForAllMovies));
      const numberOfMoviesInSecondList = listTwo.length;
      const averageRatingForSecondList = this.averageRating(listTwo);
      const secondListBayesianAverage = (numberOfMoviesInSecondList / (numberOfMoviesInSecondList + confidenceNumber) * averageRatingForSecondList + (confidenceNumber / (numberOfMoviesInSecondList + confidenceNumber) * averageRatingForAllMovies));
      return {
        firstListBayesianAverage: firstListBayesianAverage,
        secondListBayesianAverage: secondListBayesianAverage
      };
    },
    isListOneBetterThanListTwo(listOne, listTwo) {
      if (!listOne || !listTwo) {
        return false;
      }
      const comparison = this.compareTwoLists(listOne, listTwo);
      return comparison.firstListBayesianAverage > comparison.secondListBayesianAverage;
    },
    isListTwoBetterThanListOne(listOne, listTwo) {
      if (!listOne || !listTwo) {
        return false;
      }
      const comparison = this.compareTwoLists(listOne, listTwo);
      return comparison.secondListBayesianAverage > comparison.firstListBayesianAverage;
    },
    mostRecentRating(result) {
      // Helper to get most recent rating for a result
      if (result.ratings && result.ratings.length) {
        return result.ratings[result.ratings.length - 1];
      }
      return {};
    },
    async getDetailsForCastMember(actorName) {
      const query = encodeURIComponent(actorName);
      const url = `https://api.themoviedb.org/3/search/person?api_key=${process.env.VUE_APP_TMDB_API_KEY}&query=${query}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch from TMDB');
        }
        const data = await response.json();
        // Return the first matching person or null if none found
        return data.results && data.results.length > 0 ? data.results[0] : null;
      } catch (error) {
        console.error('Error fetching TMDB person:', error);
        return null;
      }
    },
    async buildTopTwelveList() {
      const allEntries = this.allEntriesWithFlatKeywordsAdded;
      const valueToMovies = {};
      allEntries.forEach(entry => {
        const movie = entry.movie;
        const value = movie.cast;
        if (!value) return;
        if (Array.isArray(value)) {
          value.forEach((val, idx) => {
            const name = val.name || val;
            if (!valueToMovies[name]) valueToMovies[name] = [];
            valueToMovies[name].push({ entry, billing: idx });
          });
        } else {
          const name = value.name || value;
          if (!valueToMovies[name]) valueToMovies[name] = [];
          valueToMovies[name].push({ entry, billing: 0 });
        }
      });
      const listObjs = Object.entries(valueToMovies)
        .filter(([, appearances]) => appearances.length >= this.minEntries)
        .map(([name, appearances]) => {
          // Sort appearances by movie title, then billing for deterministic order
          const sortedAppearances = appearances.slice().sort((a, b) => {
            const titleA = a.entry.movie.title || '';
            const titleB = b.entry.movie.title || '';
            if (titleA < titleB) return -1;
            if (titleA > titleB) return 1;
            return a.billing - b.billing;
          });
          const entries = sortedAppearances.map(a => a.entry);
          const weights = sortedAppearances.map(a => 1 / Math.pow(a.billing + 1, this.billingExponent));
          return {
            name,
            entries,
            weights,
            bayesian: this.bayesianAverage(entries, weights),
            count: entries.length
          };
        });
      listObjs.sort((a, b) => b.bayesian - a.bayesian);
      const topTenActresses = [];
      for (let i = 0; i < listObjs.length; i++) {
        if (topTenActresses.length >= 12) break;
        const entry = listObjs[i];
        const details = await this.getDetailsForCastMember(entry.name);
        if (!details || typeof details.gender !== 'number') continue;
        if (details.gender === 1 && topTenActresses.length < 12) {
          topTenActresses.push({ ...entry, details });
        }
      }
      this.topTenList = topTenActresses;
    }
  }
};
</script>

<style lang="scss">
.favorite-actresses {
  color: #fff;
  display: flex;
  justify-content: center;
  width: 100%;

  ul {
    display: flex;
    flex-wrap: wrap;
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;

    .favorite-list-item {
      align-items: center;
      cursor: pointer;
      display: flex;
      min-height: 36px;
      position: relative;
  
      .portrait-wrapper {
        align-items: center;
        display: flex;
        justify-content: center;
        padding: 4px;
        width: 100%;
  
        .portrait {
          background: #eee;
          border-radius: 6px;
          height: auto;
          object-fit: cover;
          width: 100%;
        }
  
        .placeholder {
          background: #444;
          height: auto;
          width: 48px;
        }
      }
  
      .name {
        background: #00000069;
        border-bottom-left-radius: 6px;
        border-bottom-right-radius: 6px;
        bottom: 4px;
        color: #fff;
        font-size: 0.45rem;
        left: 4px;
        padding: 2px 4px;
        position: absolute;
        right: 4px;
      }
    }
  }

}
</style>
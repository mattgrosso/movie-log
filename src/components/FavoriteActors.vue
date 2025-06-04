<template>
  <div class="favorites-list">
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
      topTenList: [],
      minEntries: 3, // Minimum number of entries for an actor to be included
      confidenceNumber: 2, // Confidence number for Bayesian average calculation
      billingExponent: 4 // Exponent for billing weight calculation
    }
  },
  async mounted () {
    await this.buildTopTwelveList();
  },
  methods: {
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

      // Filter by minimum entries and build list objects
      const listObjs = Object.entries(valueToMovies)
        .filter(([, appearances]) => appearances.length >= this.minEntries)
        .map(([name, appearances]) => {
          const entries = appearances.map(a => a.entry);
          // Extreme weight for higher billing: 1/(billing+1)^this.billingExponent
          const weights = appearances.map(a => 1 / Math.pow(a.billing + 1, this.billingExponent));
          return {
            name,
            entries,
            weights,
            bayesian: this.bayesianAverage(entries, weights),
            count: entries.length
          };
        });

      // Sort using bayesian average
      listObjs.sort((a, b) => b.bayesian - a.bayesian);

      const topTenActors = [];
      for (let i = 0; i < listObjs.length; i++) {
        if (topTenActors.length >= 12) break;
        const entry = listObjs[i];
        const details = await this.getDetailsForCastMember(entry.name);
        if (!details || typeof details.gender !== 'number') continue;
        if (details.gender === 2 && topTenActors.length < 12) {
          topTenActors.push({ ...entry, details });
        }
      }
      this.topTenList = topTenActors;
    }
  }
};
</script>

<style lang="scss">
.favorites-list {
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
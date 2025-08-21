<template>
  <div class="favorites-list">
    <ul>
      <li v-for="entry in topTenList" :key="entry.name" class="favorite-list-item col-3">
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
import ErrorLogService from '../services/ErrorLogService.js';

export default {
  props: {
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    },
    category: {
      type: String,
      required: true
    }
  },
  data () {
    return {
      topTenList: [],
      confidenceNumber: 3
    }
  },
  async mounted () {
    await this.buildTopTwelveList();
  },
  methods: {
    averageRating(results) {
      const ratedMovies = results.filter((result) => this.mostRecentRating(result).calculatedTotal);
      const ratings = ratedMovies.map((result) => parseFloat(this.mostRecentRating(result).calculatedTotal));
      const total = ratings.reduce((a, b) => a + b, 0);
      return (total / ratings.length).toFixed(2);
    },
    bayesianAverage(list) {
      // Bayesian average for a list
      const n = list.length;
      const c = this.confidenceNumber;
      const avg = parseFloat(this.averageRating(list));
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
        ErrorLogService.error('Error fetching TMDB person:', error);
        return null;
      }
    },
    async buildTopTwelveList() {
      const minEntries = 3;
      let category = this.category;
      if (this.category === 'actor' || this.category === 'actress') {
        category = 'cast';
      }

      const allEntries = this.allEntriesWithFlatKeywordsAdded;

      // Gather all unique values for the category
      const valueToMovies = {};

      allEntries.forEach(entry => {
        const movie = entry.movie;
        const value = movie[category];

        if (!value) return;

        // Handle array (e.g., cast, genres) or string
        if (Array.isArray(value)) {
          value.forEach(val => {
            const name = val.name || val; // handle objects or strings
            if (!valueToMovies[name]) valueToMovies[name] = [];
            valueToMovies[name].push(entry);
          });
        } else {
          const name = value.name || value;
          if (!valueToMovies[name]) valueToMovies[name] = [];
          valueToMovies[name].push(entry);
        }
      });

      // Filter by minimum entries and build list objects
      const listObjs = Object.entries(valueToMovies)
        .filter(([, entries]) => entries.length >= minEntries)
        .map(([name, entries]) => ({
          name,
          entries,
          bayesian: this.bayesianAverage(entries),
          count: entries.length
        }));

      // Sort using bayesian average
      listObjs.sort((a, b) => b.bayesian - a.bayesian);

      // Build top ten actors and actresses arrays
      const topTenActors = [];
      const topTenActresses = [];

      if (this.category === 'actor' || this.category === 'actress') {
        for (let i = 0; i < listObjs.length; i++) {
          if (topTenActors.length >= 12 && topTenActresses.length >= 12) break;
          const entry = listObjs[i];
          const details = await this.getDetailsForCastMember(entry.name);
          if (!details || typeof details.gender !== 'number') continue;
          if (details.gender === 1 && topTenActresses.length < 12) {
            topTenActresses.push({ ...entry, details });
          } else if (details.gender === 2 && topTenActors.length < 12) {
            topTenActors.push({ ...entry, details });
          }
        }
      }

      if (this.category === 'actor') {
        this.topTenList = topTenActors;
      } else if (this.category === 'actress') {
        this.topTenList = topTenActresses;
      } else {
        this.topTenList = listObjs.slice(0, 12);
      }
    }
  }
};
</script>

<style lang="scss">
.favorites-list {
  display: flex;
  justify-content: center;
  color: #fff;
  width: 100%;

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
    display: flex;
    flex-wrap: wrap;

    .favorite-list-item {
      display: flex;
      align-items: center;
      min-height: 36px;
      position: relative;
  
      .portrait-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 4px;
  
        .portrait {
          width: 100%;
          height: auto;
          object-fit: cover;
          background: #eee;
          border-radius: 6px;
        }
  
        .placeholder {
          background: #444;
          width: 48px;
          height: auto;
        }
      }
  
      .name {
        font-size: 0.45rem;
        color: #fff;
        position: absolute;
        background: #00000069;
        padding: 2px 4px;
        bottom: 4px;
        left: 4px;
        right: 4px;
        border-bottom-right-radius: 6px;
        border-bottom-left-radius: 6px;
      }
    }
  }

}
</style>
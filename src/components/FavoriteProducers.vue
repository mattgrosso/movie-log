<template>
  <div class="favorite-producers">
    <ul>
      <li v-for="entry in topTenList" :key="entry.name" class="favorite-list-item col-3" @click="openProducerModal(entry)">
        <div class="portrait-wrapper" v-if="entry.details && entry.details.profile_path">
          <img
            :src="`https://image.tmdb.org/t/p/w92${entry.details.profile_path}`"
            :alt="entry.name"
            class="portrait"
          />
        </div>
        <div class="portrait-wrapper" v-else>
          <img
            src="../assets/images/Image_not_available.png"
            :alt="entry.name"
            class="portrait"
          />
        </div>
        <span class="name">{{ entry.name }}</span>
      </li>
    </ul>
    <div v-if="showModal && selectedProducer" class="producer-modal-overlay">
      <div class="producer-modal">
        <button class="close-btn" @click="closeProducerModal">&times;</button>
        <h2>{{ selectedProducer.name }}</h2>
        <div class="portrait-wrapper" v-if="selectedProducer.details && selectedProducer.details.profile_path">
          <img
            :src="`https://image.tmdb.org/t/p/w185${selectedProducer.details.profile_path}`"
            :alt="selectedProducer.name"
            class="portrait"
            style="margin-bottom: 1rem; width: 120px; height: auto; display: block; margin-left: auto; margin-right: auto;"
          />
        </div>
        <div class="portrait-wrapper" v-else>
          <img
            src="../assets/images/Image_not_available.png"
            :alt="selectedProducer.name"
            class="portrait"
            style="margin-bottom: 1rem; width: 120px; height: auto; display: block; margin-left: auto; margin-right: auto;"
          />
        </div>
        <div class="modal-section">
          <h3>Rated Films</h3>
          <ul class="films-list">
            <li v-for="film in selectedProducer.entries" :key="film.movie.id">
              <strong>{{ film.movie.title }}</strong>
              <span v-if="!isNaN(parseFloat(getRating(film).calculatedTotal))"> - Rated: {{ parseFloat(getRating(film).calculatedTotal).toFixed(2) }}</span>
              <span v-else> - Not rated</span>
            </li>
          </ul>
        </div>
        <button class="search-btn" @click="searchForProducer">Search for this producer</button>
      </div>
    </div>
  </div>
</template>

<script>
import { getRating } from "../assets/javascript/GetRating.js";
import ErrorLogService from '../services/ErrorLogService.js';

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
      minEntries: 5,
      // minEntries: Minimum number of movies you must have seen from a producer for them to be considered.
      //   Increase: Only producers you've seen more movies from will appear (list is more exclusive).
      //   Decrease: producers with fewer movies seen can appear (list is more inclusive).
      confidenceNumber: 2,
      // confidenceNumber: Controls how much the global average rating influences the Bayesian average.
      //   Increase: Scores are pulled more toward the global average (less sensitive to outliers, more conservative).
      //   Decrease: Scores reflect your ratings more strongly (more sensitive to high/low averages for producers with few movies).
      countWeight: 5,
      // countWeight: Controls how much the number of movies seen from a producer boosts their score.
      //   Increase: producers you've seen more often are favored, even if their average is lower.
      //   Decrease: Number of movies seen matters less; average rating dominates.
      knownForWeight: 0.2,
      // knownForWeight: Controls the bonus for rating a producer's 'known_for' movies highly.
      //   Increase: producers whose most famous movies you rate highly get a bigger boost.
      //   Decrease: 'Known_for' bonus has less effect; overall average matters more.
      manualBoosts: {
        // Example: 'Charlie Kaufman': 1.2, 'Aaron Sorkin': 0.8
      },
      // manualBoosts: Lets you manually adjust a producer's score (by name).
      //   >1: Boosts the producer's score (e.g. 1.2 = 20% higher).
      //   <1: Reduces the producer's score (e.g. 0.8 = 20% lower).
      showModal: false,
      selectedProducer: null,
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
        ErrorLogService.error('Error fetching TMDB person:', error);
        return null;
      }
    },
    async buildTopTwelveList() {
      const allEntries = this.allEntriesWithFlatKeywordsAdded;
      const valueToMovies = {};
      // List of job titles considered as 'producer'
      const producerJobs = [
        'Producer',
        'Executive Producer',
        'Co-Producer',
        'Associate Producer',
      ];

      allEntries.forEach(entry => {
        const movie = entry.movie;
        const crew = movie.crew;
        if (!crew || !Array.isArray(crew)) return;
        crew.forEach((person) => {
          if (producerJobs.includes(person.job) && person.name) {
            if (!valueToMovies[person.name]) valueToMovies[person.name] = [];
            valueToMovies[person.name].push({ entry, billing: 0 });
          }
        });
      });

      // Filter by minimum entries and build list objects
      const listObjs = await Promise.all(Object.entries(valueToMovies)
        .filter(([, appearances]) => appearances.length >= this.minEntries)
        .map(async ([name, appearances]) => {
          const sortedAppearances = appearances.slice().sort((a, b) => {
            const titleA = a.entry.movie.title || '';
            const titleB = b.entry.movie.title || '';
            if (titleA < titleB) return -1;
            if (titleA > titleB) return 1;
            return a.billing - b.billing;
          });
          const entries = sortedAppearances.map(a => a.entry);
          const weights = sortedAppearances.map(a => 1); // All weights 1 for producers
          const bayesian = this.bayesianAverage(entries, weights);
          const count = entries.length;
          // Fetch TMDB details for known_for, popularity, etc.
          const details = await this.getDetailsForCastMember(name);
          // Known_for bonus: average rating of known_for movies you have rated
          let knownForBonus = 0;
          if (details && Array.isArray(details.known_for) && details.known_for.length) {
            // Find your ratings for these movies
            const knownForIds = details.known_for.map(m => m.id);
            const ratedKnownFor = entries.filter(e => knownForIds.includes(e.movie.id));
            if (ratedKnownFor.length) {
              const ratings = ratedKnownFor.map(e => parseFloat(this.mostRecentRating(e).calculatedTotal)).filter(r => !isNaN(r));
              if (ratings.length) {
                const avgKnownFor = ratings.reduce((a, b) => a + b, 0) / ratings.length;
                knownForBonus = avgKnownFor * this.knownForWeight;
              } else {
                knownForBonus = 0;
              }
            } else {
              knownForBonus = 0;
            }
          }
          // Manual boost
          const manualBoost = this.manualBoosts[name] || 1;
          // Final score: bayesian * (1 + countWeight * Math.log(count)) * manualBoost + knownForBonus
          let finalScore = bayesian * (1 + this.countWeight * Math.log(count)) * manualBoost + knownForBonus;
          if (isNaN(finalScore)) finalScore = 0;
          return {
            name,
            entries,
            weights,
            bayesian,
            count,
            details,
            finalScore,
            knownForBonus,
          };
        })
      );

      // Sort using finalScore
      listObjs.sort((a, b) => b.finalScore - a.finalScore);

      this.topTenList = listObjs.slice(0, 12);
    },
    openProducerModal(entry) {
      this.selectedProducer = entry;
      this.showModal = true;
      document.body.classList.add('no-scroll');
    },
    closeProducerModal() {
      this.showModal = false;
      this.selectedProducer = null;
      document.body.classList.remove('no-scroll');
    },
    getProducerBreakdown(entry) {
      if (!entry) return null;
      const breakdown = [];
      breakdown.push({ label: 'Final Score', value: entry.finalScore?.toFixed(2) });
      breakdown.push({ label: 'Bayesian Average', value: entry.bayesian?.toFixed(2) });
      breakdown.push({ label: 'Film Count', value: entry.count });
      breakdown.push({ label: 'Known For Bonus', value: entry.knownForBonus?.toFixed(2) });
      return breakdown;
    },
    getRating,
    searchForProducer() {
      const name = this.selectedProducer?.name;
      this.closeProducerModal();
      if (name) this.updateSearchValue(name);
    },
  }
};
</script>

<style lang="scss">
.favorite-producers {
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
        font-size: 0.5rem;
        left: 4px;
        padding: 2px 4px;
        position: absolute;
        right: 4px;
      }
    }
  }

  .producer-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;

    .producer-modal {
      background: #222;
      color: #fff;
      border-radius: 10px;
      padding: 2rem;
      min-width: 320px;
      max-width: 90vw;
      box-shadow: 0 2px 16px #000a;
      position: relative;

      .close-btn {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        background: none;
        border: none;
        color: #fff;
        font-size: 2rem;
        cursor: pointer;
      }

      .modal-section {
        margin-bottom: 1.5rem;
      }

      .search-btn {
        background: #1976d2;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 0.5rem 1.5rem;
        font-size: 1rem;
        cursor: pointer;
        margin-top: 1rem;
      }

      .breakdown-list {
        padding-left: 0;
        list-style: none;
        margin-bottom: 1rem;

        li {
          display: block;
          margin-bottom: 0.25rem;
          word-break: break-word;
          width: 100%;
        }
      }

      .films-list {
        padding-left: 0;
        list-style: none;
        max-height: 250px;
        overflow-y: auto;
        margin-bottom: 1rem;
        position: relative;

        &::after {
          content: "";
          display: block;
          position: sticky;
          left: 0;
          right: 0;
          bottom: 0;
          height: 32px;
          pointer-events: none;
          background: linear-gradient(to bottom, rgba(34,34,34,0), rgba(34,34,34,0.95) 90%);
          z-index: 2;
        }

        li {
          display: block;
          margin-bottom: 0.25rem;
          word-break: break-word;
        }
      }
    }
  }
}

body.no-scroll {
  overflow: hidden !important;
}
</style>
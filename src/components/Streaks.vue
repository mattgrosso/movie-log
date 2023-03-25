<template>
  <div class="streaks p-2 mb-4 border">
    <div class="slider position-relative">
      <label for="streak-threshold-input" class="form-label">Minimum score for streaks: {{streakThreshold}}</label>
      <input type="range" class="form-range" min="0" max="10" step="0.5" id="streak-threshold-input" v-model="streakThreshold">
    </div>
    <div v-if="longestStreakByDays" class="longest-streak-days chart mt-2 mb-3 border border-2 rounded-1 shadow-sm p-3">
      <h5 class="mb-4">Consecutive days of {{streakThreshold}}+ ratings</h5>
      <p>{{longestStreakByDays.startDate.toLocaleDateString()}} - {{longestStreakByDays.endDate.toLocaleDateString()}}</p>
      <p>That's {{longestStreakByDays.duration}} days.</p>
      <p>Every movie from "{{longestStreakByDays.titles[0]}}" through "{{longestStreakByDays.titles[longestStreakByDays.titles.length - 1]}}".</p>
      <p>And then "{{longestStreakByDays.streakBreaker}}" came along and blew it.</p>
    </div>
    <div v-if="longestStreakByMovies" class="longest-streak-movies chart my-3 border border-2 rounded-1 shadow-sm p-3">
      <h5 class="mb-4">Consecutive movies at {{streakThreshold}} or more</h5>
      <p>{{longestStreakByMovies.titles.length}} movies in a row.</p>
      <p>From {{longestStreakByMovies.startDate.toLocaleDateString()}} to {{longestStreakByMovies.endDate.toLocaleDateString()}}</p>
      <p>
        <span v-for="(movie, index) in longestStreakByMovies.titles" :key="index">
          <span v-if="index === longestStreakByMovies.titles.length - 1">and </span>"{{movie}}"<span v-if="index !== longestStreakByMovies.titles.length - 1">, </span>
        </span>
      </p>
      <p>And then "{{longestStreakByMovies.streakBreaker}}" came along and ruined everything.</p>
    </div>
  </div>
</template>

<script>
import maxBy from 'lodash/maxBy';
import sortBy from 'lodash/sortBy';

export default {
  props: {
    resultsWithRatings: {
      type: Array,
      required: true
    },
    mostRecentRating: {
      type: Function,
      required: true
    }
  },
  data () {
    return {
      streakThreshold: 8
    }
  },
  computed: {
    streaks () {
      const ratingsAndReleases = [...this.resultsWithRatings].map((result) => {
        return {
          title: result.movie.title,
          releaseDate: new Date(result.movie.release_date),
          rating: this.mostRecentRating(result).rating
        }
      });

      const sortedByDate = sortBy(ratingsAndReleases, (result) => result.releaseDate);

      const streaks = [];
      let scratch = {};

      sortedByDate.forEach((movie) => {
        if (!scratch.titles) {
          scratch.titles = [movie.title];
          scratch.startDate = movie.releaseDate;
        } else if (movie.rating > this.streakThreshold) {
          scratch.titles.push(movie.title);
          scratch.endDate = movie.releaseDate;
        } else if (scratch.endDate) {
          scratch.streakBreaker = movie.title;
          scratch.endDate = movie.releaseDate;
          scratch.duration = this.daysBetweenDates(scratch.startDate, scratch.endDate) - 1;
          streaks.push({ ...scratch });
          scratch = {};
        } else {
          scratch = {};
        }
      });

      return streaks;
    },
    longestStreakByDays () {
      return maxBy(this.streaks, (streak) => streak.duration);
    },
    longestStreakByMovies () {
      return maxBy(this.streaks, (streak) => streak.titles.length);
    }
  },
  methods: {
    daysBetweenDates (dateA, dateB) {
      const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
      const firstDate = dateA;
      const secondDate = dateB;

      return Math.round(Math.abs((firstDate - secondDate) / oneDay));
    }
  },
}
</script>

<style>

</style>
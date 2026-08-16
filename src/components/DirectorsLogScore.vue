<template>
  <div class="directors-log-score">
    <p class="dls-caption">
      Brian's method, untouched: your composite scores only, best work weighted
      heaviest, small filmographies pulled toward your library average. No
      levers — compare it against your tuned list above.
    </p>
    <ul>
      <li v-for="director in topTwelve" :key="director.name" class="favorite-list-item col-3" @click="$emit('updateSearchValue', director.name)">
        <div class="portrait-wrapper">
          <img
            v-if="portraits[director.name]"
            :src="`https://image.tmdb.org/t/p/w92${portraits[director.name]}`"
            :alt="director.name"
            class="portrait"
          />
          <img
            v-else
            src="../assets/images/Image_not_available.png"
            :alt="director.name"
            class="portrait"
          />
        </div>
        <span class="name">{{ director.name }}</span>
        <span class="dls-score">{{ director.score.toFixed(2) }} · {{ director.count }} film{{ director.count === 1 ? '' : 's' }}</span>
      </li>
    </ul>
  </div>
</template>

<script>
// Directors, Brian's way (Matt, 2026-08-15): the pure Log Score ranking
// rendered directly below the tuned Favorite Directors list so the two
// methods can be compared on the same screen. All math is in
// logScoreRankings.js; this only renders and fetches portraits.
import { getRating } from '../assets/javascript/GetRating.js';
import { rankDirectorsByLogScore } from '../assets/javascript/logScoreRankings.js';
import { logScoreSettings } from '../assets/javascript/logScore.js';

export default {
  name: 'DirectorsLogScore',
  props: {
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    }
  },
  emits: ['updateSearchValue'],
  data () {
    return {
      portraits: {}
    };
  },
  computed: {
    topTwelve () {
      const weights = logScoreSettings(this.$store?.state?.settings);
      return rankDirectorsByLogScore(this.allEntriesWithFlatKeywordsAdded, getRating, weights).slice(0, 12);
    }
  },
  watch: {
    topTwelve: {
      immediate: true,
      handler (list) {
        list.forEach((director) => this.fetchPortrait(director.name));
      }
    }
  },
  methods: {
    async fetchPortrait (name) {
      if (Object.prototype.hasOwnProperty.call(this.portraits, name)) return;
      this.portraits[name] = null;
      try {
        const query = encodeURIComponent(name);
        const response = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${process.env.VUE_APP_TMDB_API_KEY}&query=${query}`);
        if (!response.ok) return;
        const data = await response.json();
        this.portraits[name] = data.results?.[0]?.profile_path || null;
      } catch {
        // Portrait stays the placeholder — the ranking itself is local.
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.directors-log-score {
  align-items: center;
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;

  .dls-caption {
    color: #ccc;
    font-size: 0.75rem;
    margin: 0 0 0.5rem;
    width: 100%;
  }

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
      flex-direction: column;
      min-height: 36px;
      position: relative;

      &:active {
        opacity: 0.7;
      }

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
      }

      .name {
        font-size: 0.8rem;
        text-align: center;
      }

      .dls-score {
        color: #ffc107;
        font-size: 0.7rem;
        text-align: center;
      }
    }
  }
}
</style>

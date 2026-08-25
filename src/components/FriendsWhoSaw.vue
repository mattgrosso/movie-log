<template>
  <div v-if="friends.length" class="friends-who-saw mb-3">
    <span v-for="friend in friends" :key="friend.key" class="friend-pill">
      <span class="friend-name">{{ friend.name }}</span>
      <span class="friend-score">{{ formatScore(friend.score) }}</span>
    </span>
  </div>
</template>

<script>
// "I just need little pills that show the name and rating for any friends who
// have seen and rated the movie" (2026-08-25). No heading, no counts, no
// commentary on who hasn't seen it — the pills are the whole feature.
import { formatScore } from '../assets/javascript/formatScore.js';
import { friendsWhoRated } from '../assets/javascript/friendViewings.js';

export default {
  name: 'FriendsWhoSaw',
  props: {
    tmdbId: {
      type: [Number, String],
      default: null
    }
  },
  computed: {
    friends () {
      return friendsWhoRated(this.$store.getters.filmClubFriends, this.tmdbId);
    }
  },
  methods: {
    formatScore
  }
};
</script>

<style lang="scss">
  .friends-who-saw {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;

    .friend-pill {
      align-items: baseline;
      background: #2e2e2e;
      border-radius: 999px;
      display: inline-flex;
      font-size: 0.8rem;
      gap: 0.4rem;
      padding: 0.2rem 0.6rem;
    }

    .friend-score {
      /* Tabular so a column of pills doesn't jitter, and #ccc rather than
         Bootstrap's .text-muted, which fails contrast on this app's dark
         panels (see .claude/rules/vue-ui.md). */
      color: #ccc;
      font-variant-numeric: tabular-nums;
    }
  }
</style>

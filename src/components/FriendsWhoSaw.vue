<template>
  <div v-if="friends.length" class="friends-who-saw mb-3">
    <span v-for="friend in friends" :key="friend.key" class="friend-pill">
      <span class="friend-name">{{ friend.name }}</span>
      <span v-if="friend.stars !== null" class="friend-stars" :aria-label="`${friend.stars} out of 5`">
        <i v-for="i in fullStars(friend)" :key="`f${i}`" class="bi bi-star-fill"/>
        <i v-if="hasHalfStar(friend)" class="bi bi-star-half"/>
      </span>
      <!-- No stars published yet: their app assigns those, and an older
           profile simply doesn't carry them. The composite is worth less as a
           comparison but it's what we have, and it beats a blank pill. -->
      <span v-else class="friend-score">{{ formatScore(friend.score) }}</span>
    </span>
  </div>
</template>

<script>
// "I just need little pills that show the name and rating for any friends who
// have seen and rated the movie" (2026-08-25), then: "let's use the normalized
// ratings... It would be best if we could show star ratings for these."
//
// Stars, not the composite, because the composite isn't comparable between
// people: `r` is each person's own weighted total, while stars present the
// NORMALIZED rating — library-relative and curve-adjusted — which is what
// makes one friend's 4 stars mean the same as another's. Only the source can
// assign them (see starRating.js), so they travel in the profile rather than
// being worked out here.
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
    },
    // Club membership, as one string cheap to watch. Both halves arrive
    // async — native keys from the edges listener, external ids from
    // settings — and the screens that fetch profiles all do it on MOUNT, so
    // a cold start could pass every one of those mounts before membership
    // landed and leave the pills blank for the whole session (report
    // -P0EQt6w7iKdJziMXHTi: three Movie Log friends had rated the movie and
    // none showed). The pills therefore ensure their own data.
    clubRoster () {
      const native = this.$store.getters.socialFriendKeys || [];
      const external = Object.keys(this.$store.state?.settings?.externalFriends || {});
      return [...native, ...external].join('|');
    }
  },
  watch: {
    clubRoster: {
      // Immediate doubles as the mounted hook; ensureClubData only fetches
      // what's missing, so re-fires are cheap no-ops once profiles are in.
      immediate: true,
      handler () {
        this.$store.dispatch('ensureClubData');
      }
    }
  },
  methods: {
    formatScore,
    fullStars (friend) {
      return Math.floor(friend.stars);
    },
    hasHalfStar (friend) {
      return friend.stars % 1 !== 0;
    }
  }
};
</script>

<style lang="scss">
  .friends-who-saw {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;

    .friend-pill {
      align-items: center;
      background: #2e2e2e;
      border-radius: 999px;
      display: inline-flex;
      font-size: 0.8rem;
      gap: 0.4rem;
      padding: 0.2rem 0.6rem;
    }

    .friend-stars {
      color: #f8d62b;
      display: inline-flex;
      font-size: 0.7rem;
      gap: 0.05rem;
      white-space: nowrap;
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

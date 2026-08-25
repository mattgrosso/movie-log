<template>
  <div v-if="hasClub" class="friends-who-saw mb-3">
    <h4>Film Club</h4>

    <ul v-if="seen.length" class="seen-list">
      <li v-for="friend in seen" :key="friend.key" class="seen-row">
        <span class="friend-name">{{ friend.name }}</span>
        <span class="friend-meta">
          <span v-if="friend.medium" class="friend-medium">{{ friend.medium }}</span>
          <span class="friend-score">{{ formatScore(friend.score) }}</span>
        </span>
      </li>
    </ul>

    <p v-if="averageLine" class="club-average m-0">{{ averageLine }}</p>

    <p v-if="!seen.length" class="none-seen m-0">Nobody in your club has rated this.</p>

    <!-- Both of these are named, and named differently, on purpose. Listing
         only the people who HAVEN'T seen it would let the eye read everyone
         missing from that line as having seen it — including people the app
         has no business speaking for. -->
    <p v-if="notSeen.length" class="club-note m-0">
      <span class="club-note-label">Not seen by</span> {{ nameList(notSeen) }}
    </p>
    <p v-if="unknown.length" class="club-note m-0">
      <span class="club-note-label">No ratings shared by</span> {{ nameList(unknown) }}
    </p>
  </div>
</template>

<script>
// "It would be cool if I could see which of my friends had seen a movie on its
// detail page" (bug report, 2026-08-25).
//
// A lookup, not a fetch: friend profiles publish a `ratings` map keyed by TMDB
// id and Home loads them on mount, so by the time this renders the answer is
// already in memory. The split into seen / not seen / cannot say lives in
// friendViewings.js, which explains why the third group has to exist.
import { formatScore } from '../assets/javascript/formatScore.js';
import { friendViewingsFor, clubAverage } from '../assets/javascript/friendViewings.js';

export default {
  name: 'FriendsWhoSaw',
  props: {
    tmdbId: {
      type: [Number, String],
      default: null
    },
    // Your own score for this film, for the comparison line. Null when you
    // haven't rated it — which happens on any detail page reached by search.
    yourScore: {
      type: Number,
      default: null
    }
  },
  computed: {
    club () {
      return friendViewingsFor(this.$store.getters.filmClubFriends, this.tmdbId);
    },
    seen () {
      return this.club.seen;
    },
    notSeen () {
      return this.club.notSeen;
    },
    unknown () {
      return this.club.unknown;
    },
    // No club, no section — the same treatment every optional block on this
    // page gets, rather than a heading over an empty space.
    //
    // The tmdbId guard is not belt-and-braces: MovieDetail loads its movie
    // asynchronously and `movie` is null on the first render, at which point
    // every friend is unanswerable and the section would flash "No ratings
    // shared by" the entire club before settling. Nothing is the honest thing
    // to show while the question itself hasn't arrived.
    hasClub () {
      if (this.tmdbId == null || this.tmdbId === '') return false;
      return this.seen.length + this.notSeen.length + this.unknown.length > 0;
    },
    // Only worth drawing once it's an average of more than one person;
    // below that it just repeats the row above it.
    averageLine () {
      if (this.seen.length < 2) return null;
      const average = clubAverage(this.seen);
      if (average == null) return null;
      const club = `Club average ${formatScore(average)}`;
      return Number.isFinite(this.yourScore)
        ? `${club} · you ${formatScore(this.yourScore)}`
        : club;
    }
  },
  methods: {
    formatScore,
    nameList (friends) {
      return friends.map((friend) => friend.name).join(', ');
    }
  }
};
</script>

<style lang="scss">
  .friends-who-saw {
    .seen-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .seen-row {
      align-items: baseline;
      border-bottom: 1px solid #2e2e2e;
      display: flex;
      justify-content: space-between;
      padding: 0.35rem 0;

      &:last-child {
        border-bottom: none;
      }
    }

    .friend-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .friend-meta {
      align-items: baseline;
      display: flex;
      flex-shrink: 0;
      gap: 0.5rem;
      padding-left: 0.5rem;
    }

    /* #ccc, not Bootstrap's .text-muted — that's ~2.3:1 on this app's dark
       panels and fails outright (see .claude/rules/vue-ui.md). */
    .friend-medium {
      color: #ccc;
      font-size: 0.7rem;
    }

    .friend-score {
      font-variant-numeric: tabular-nums;
    }

    .club-average,
    .club-note,
    .none-seen {
      color: #ccc;
      font-size: 0.75rem;
      margin-top: 0.4rem !important;
    }

    .club-note-label {
      opacity: 0.75;
    }
  }
</style>

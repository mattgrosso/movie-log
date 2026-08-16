<template>
  <div class="film-club-screen">
    <BackLink label="Home" @click="$router.push('/')"/>
    <h1 class="cs-title">Film Club</h1>
    <p class="cs-subtitle">Friends on Cinema Roll — what they're watching and where your tastes meet.</p>

    <div v-if="!socialSettings.enabled" class="cs-section">
      <p class="cs-empty">Sharing is off. Turn on "Share on Cinema Roll" in Settings to join the club — nothing is shared until you do.</p>
    </div>

    <template v-else>
      <!-- Requests inbox -->
      <section v-if="requestRows.length" class="cs-section">
        <h2 class="cs-section-title">Friend requests</h2>
        <div v-for="request in requestRows" :key="request.key" class="cs-row">
          <span class="cs-row-name">{{ request.name }}</span>
          <span class="cs-row-actions">
            <button type="button" class="btn btn-warning btn-sm" @click="accept(request.key)">Accept</button>
            <button type="button" class="btn btn-outline-secondary btn-sm" @click="decline(request.key)">Decline</button>
          </span>
        </div>
      </section>

      <!-- The combined club summary -->
      <section v-if="summary" class="cs-section">
        <h2 class="cs-section-title">Around the club</h2>
        <template v-if="summary.feed.length">
          <h3 class="cs-subhead">Recently watched</h3>
          <div class="cs-poster-row">
            <div v-for="item in summary.feed" :key="`${item.friendKey}-${item.id}-${item.at}`" class="cs-poster-card" @click="goToMovie(item.id)">
              <img v-if="item.p" :src="poster(item.p)" :alt="item.t" class="cs-poster">
              <div v-else class="cs-poster cs-poster-blank">{{ item.t }}</div>
              <span class="cs-poster-note">{{ item.friendName }} · {{ item.r != null ? item.r.toFixed(1) : '—' }}</span>
            </div>
          </div>
        </template>
        <template v-if="summary.clubFavorites.length">
          <h3 class="cs-subhead">Club favorites</h3>
          <p class="cs-caption">Rated by two or more of you, best average first.</p>
          <div v-for="movie in summary.clubFavorites" :key="`fav-${movie.id}`" class="cs-consensus-row" @click="goToTitle(movie)">
            <img v-if="movie.p" :src="poster(movie.p)" :alt="movie.t" class="cs-thumb">
            <div class="cs-consensus-info">
              <span class="cs-row-name">{{ movie.t }}</span>
              <span class="cs-scores">
                <span v-for="score in movie.scores" :key="score.who" class="cs-score-chip">{{ score.who }} {{ score.r.toFixed(1) }}</span>
              </span>
            </div>
            <span class="cs-average">{{ movie.average.toFixed(2) }}</span>
          </div>
        </template>
        <template v-if="summary.biggestDivides.length">
          <h3 class="cs-subhead">Most divisive</h3>
          <p class="cs-caption">The widest spreads between anyone in the club.</p>
          <div v-for="movie in summary.biggestDivides" :key="`div-${movie.id}`" class="cs-consensus-row" @click="goToTitle(movie)">
            <img v-if="movie.p" :src="poster(movie.p)" :alt="movie.t" class="cs-thumb">
            <div class="cs-consensus-info">
              <span class="cs-row-name">{{ movie.t }}</span>
              <span class="cs-scores">
                <span v-for="score in movie.scores" :key="score.who" class="cs-score-chip">{{ score.who }} {{ score.r.toFixed(1) }}</span>
              </span>
            </div>
            <span class="cs-average cs-spread">±{{ movie.spread.toFixed(1) }}</span>
          </div>
        </template>
      </section>

      <!-- Friends -->
      <section class="cs-section">
        <h2 class="cs-section-title">Friends</h2>
        <p v-if="!friendRows.length" class="cs-empty">No friends yet — find people below and send a request.</p>
        <div v-for="friend in friendRows" :key="friend.key" class="cs-row cs-row-tappable" @click="$router.push(`/film-club/${friend.key}`)">
          <span class="cs-row-name">{{ friend.name }}</span>
          <span class="cs-row-detail">
            <span v-if="friend.error" class="cs-row-error">feed unreachable</span>
            <template v-else>{{ friend.titles != null ? `${friend.titles} titles` : 'no profile yet' }}</template>
            <i class="bi bi-chevron-right"></i>
          </span>
        </div>
      </section>

      <!-- Pending sent -->
      <section v-if="pendingRows.length" class="cs-section">
        <h2 class="cs-section-title">Requests sent</h2>
        <div v-for="pending in pendingRows" :key="pending.key" class="cs-row">
          <span class="cs-row-name">{{ pending.name }}</span>
          <button type="button" class="btn btn-outline-secondary btn-sm" @click="cancel(pending.key)">Cancel</button>
        </div>
      </section>

      <!-- Friends on other apps -->
      <section class="cs-section">
        <h2 class="cs-section-title">Friends on other apps</h2>
        <p class="cs-caption">
          Someone using a different movie app (like Movie Log) can join your club by sharing a feed link. They'll appear
          alongside everyone else — same comparisons, same picks.
        </p>
        <!-- Requests from people on other apps -->
        <div v-for="request in inboxRequests" :key="request.id" class="cs-row">
          <span class="cs-row-name">{{ request.name }} <span class="cs-row-app">on {{ request.app }}</span></span>
          <span class="cs-row-actions">
            <button type="button" class="btn btn-warning btn-sm" @click="acceptRequest(request)">Accept</button>
            <button type="button" class="btn btn-outline-secondary btn-sm" @click="dismissRequest(request.id)">Dismiss</button>
          </span>
        </div>

        <!-- Browse people on other apps and add them directly. -->
        <div class="cs-discovery">
          <input v-model="directorySearch" type="text" class="form-control cs-input" placeholder="Search people on other apps">
          <p v-if="directoryLoading" class="cs-caption">Looking…</p>
          <p v-else-if="!visibleDirectory.length" class="cs-caption">
            {{ directorySearch ? 'Nobody by that name.' : 'Nobody discoverable right now.' }}
          </p>
          <div v-for="person in visibleDirectory" :key="`${person.app}-${person.handle}`" class="cs-row">
            <span class="cs-row-name">
              {{ person.name }}
              <span class="cs-row-app">@{{ person.handle }} · {{ person.app }}</span>
            </span>
            <button type="button" class="btn btn-warning btn-sm" :disabled="requesting === person.handle" @click="requestFriend(person)">
              {{ requesting === person.handle ? 'Asking…' : 'Add friend' }}
            </button>
          </div>
          <p v-if="externalError" class="cs-external-error">{{ externalError }}</p>
          <p v-if="externalNote" class="cs-caption">{{ externalNote }}</p>
        </div>

        <div class="cs-share-own">
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="crossAppToggle" :checked="crossAppDiscovery" @change="toggleDiscovery">
            <label class="form-check-label" for="crossAppToggle">Let people on other apps find me</label>
          </div>
          <p class="cs-caption">
            Publishes your display name and a request inbox to a public list, so friends on other apps can add you
            without swapping links. Your ratings stay private until you accept someone.
          </p>
        </div>
      </section>

      <!-- Directory -->
      <section class="cs-section">
        <h2 class="cs-section-title">Find people</h2>
        <p v-if="!directoryRows.length" class="cs-empty">Nobody else has turned on sharing yet.</p>
        <div v-for="person in directoryRows" :key="person.key" class="cs-row">
          <span class="cs-row-name">{{ person.name }}</span>
          <button type="button" class="btn btn-warning btn-sm" @click="add(person.key)">Add friend</button>
        </div>
      </section>
    </template>
  </div>
</template>

<script>
// The Film Club hub (/film-club): requests inbox, the combined all-friends
// summary, the friends list (each row opens the per-friend comparison),
// and the directory for sending requests. All set math is pure in
// src/assets/javascript/social.js; this screen only renders and dispatches.
import BackLink from './games/BackLink.vue';
import { getRating } from '../assets/javascript/GetRating.js';
import { filmClubSummary } from '../assets/javascript/social.js';
import { filterDirectory } from '../assets/javascript/interchange.js';

export default {
  name: 'FilmClubScreen',
  components: { BackLink },
  computed: {
    socialSettings () {
      return this.$store.getters.socialSettings;
    },
    crossAppDiscovery () {
      return this.$store.getters.crossAppDiscoveryEnabled;
    },
    directoryLoading () {
      return this.$store.state.federatedDirectoryLoading;
    },
    visibleDirectory () {
      const friends = this.$store.getters.filmClubFriends || [];
      const known = Object.values(this.$store.state.settings?.externalFriends || {}).map((f) => f?.feedUrl);
      const asked = Object.keys(this.$store.state.settings?.clubRequestsSent || {});
      return filterDirectory(this.$store.state.federatedDirectory, {
        search: this.directorySearch,
        excludeHandles: asked,
        excludeInboxUrls: known.filter(Boolean)
      }).slice(0, 25);
    },
    inboxRequests () {
      return this.$store.getters.clubInboxRequests || [];
    },
    clubFeedUrl () {
      const account = this.$store.state.databaseTopKey;
      const secret = this.$store.state.settings?.clubFeedKey;
      if (!account || !secret) return '';
      return `https://movie-log-8c4d5-default-rtdb.firebaseio.com/clubFeed/${account}/${secret}.json`;
    },
    me () {
      return this.$store.getters.socialUserKey;
    },
    directory () {
      return this.$store.state.socialDirectory || {};
    },
    friendKeys () {
      return this.$store.getters.socialFriendKeys;
    },
    profiles () {
      return this.$store.state.socialFriendProfiles || {};
    },
    requestRows () {
      return Object.entries(this.$store.state.socialRequests || {})
        // A request from someone I've already befriended is stale noise.
        .filter(([key]) => !this.friendKeys.includes(key))
        .map(([key, request]) => ({ key, name: request?.name || this.nameFor(key) }));
    },
    friendRows () {
      return (this.$store.getters.filmClubFriends || []).map((friend) => ({
        key: friend.key,
        name: friend.name,
        titles: friend.profile?.counts?.titles ?? null,
        external: friend.external,
        source: friend.source,
        error: friend.error
      }));
    },
    pendingRows () {
      return this.$store.getters.socialPendingSentKeys.map((key) => ({ key, name: this.nameFor(key) }));
    },
    directoryRows () {
      const excluded = new Set([this.me, ...this.friendKeys, ...this.$store.getters.socialPendingSentKeys]);
      return Object.entries(this.directory)
        .filter(([key]) => !excluded.has(key))
        .map(([key, row]) => ({ key, name: row?.name || key }));
    },
    summary () {
      return filmClubSummary(
        this.$store.getters.allMoviesAsArray || [],
        getRating,
        this.$store.getters.filmClubProfiles || {}
      );
    }
  },
  watch: {
    // Edges arrive async from the listener; refetch profiles whenever the
    // mutual set changes (a new acceptance, a removal).
    friendKeys: {
      immediate: true,
      handler (keys) {
        if (keys.length) this.$store.dispatch('fetchFriendProfiles');
      }
    }
  },
  created () {
    this.$store.dispatch('attachSocialListeners');
    this.$store.dispatch('fetchSocialDirectory');
    this.$store.dispatch('syncExternalFriends');
    this.$store.dispatch('watchClubInbox');
    this.$store.dispatch('fetchFederatedDirectory');
    // Opening the club clears the rainbow chip's new-updates badge.
    this.$store.commit('markFilmClubSeen');
  },
  methods: {
    async requestFriend (person) {
      this.externalError = '';
      this.externalNote = '';
      this.requesting = person.handle;
      try {
        const result = await this.$store.dispatch('requestFriendFromDirectory', person);
        if (!result?.ok) {
          this.externalError = result?.error || 'Could not send that request.';
          return;
        }
        this.externalNote = `Asked ${person.name}. They'll see it in ${person.app}.`;
      } finally {
        this.requesting = null;
      }
    },
    async toggleDiscovery (event) {
      await this.$store.dispatch('setCrossAppDiscovery', event.target.checked);
      this.$store.dispatch('watchClubInbox');
    },
    async acceptRequest (request) {
      await this.$store.dispatch('acceptClubRequest', request);
    },
    dismissRequest (id) {
      this.$store.dispatch('dismissClubRequest', id);
    },
    nameFor (key) {
      return this.directory[key]?.name || key;
    },
    accept (key) {
      this.$store.dispatch('acceptFriendRequest', key);
    },
    decline (key) {
      this.$store.dispatch('declineFriendRequest', key);
    },
    cancel (key) {
      this.$store.dispatch('cancelFriendRequest', key);
    },
    add (key) {
      this.$store.dispatch('sendFriendRequest', key);
    },
    poster (path) {
      return `https://image.tmdb.org/t/p/w185${path}`;
    },
    goToMovie (tmdbId) {
      if (tmdbId == null) return;
      this.$router.push(`/movie/${tmdbId}`);
    },
    goToTitle (movie) {
      this.goToMovie(movie.id);
    }
  }
};
</script>

<style lang="scss" scoped>
.film-club-screen {
  color: #eee;
  min-width: 0;
  padding: 0.75rem 1rem 2rem;
  width: 100%;
}

.cs-title { margin: 0.25rem 0 0; }
.cs-subtitle { color: #ccc; font-size: 0.85rem; margin: 0.25rem 0 1rem; }

.cs-section {
  background: #161616;
  border: 1px solid #2e2e2e;
  border-radius: 10px;
  margin-bottom: 0.75rem;
  padding: 0.75rem 1rem;
}

.cs-section-title { font-size: 1.05rem; margin: 0 0 0.5rem; }
.cs-subhead { color: #ffc107; font-size: 0.8rem; letter-spacing: 0.4px; margin: 0.75rem 0 0.25rem; text-transform: uppercase; }
.cs-caption { color: #ccc; font-size: 0.75rem; margin: 0 0 0.5rem; }
.cs-empty { color: #ccc; font-size: 0.85rem; margin: 0; }

.cs-add-external,
.cs-share-own {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.cs-share-own { border-top: 1px solid #2e2e2e; margin-top: 0.75rem; padding-top: 0.75rem; }

.cs-input {
  background: #161616;
  border: 1px solid #2e2e2e;
  color: white;
  font-size: 0.8rem;

  &::placeholder { color: #888; }
}

.cs-external-error { color: #e88; font-size: 0.75rem; margin: 0; }
.cs-row-app { color: #ccc; font-size: 0.75rem; font-weight: 400; }
.cs-discovery { display: flex; flex-direction: column; gap: 0.3rem; }

.cs-row {
  align-items: center;
  border-top: 1px solid #2e2e2e;
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  padding: 0.55rem 0;

  &:first-of-type { border-top: none; }
}

.cs-row-tappable:active { background: #222; }

.cs-row-name { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
.cs-row-detail { color: #ccc; font-size: 0.8rem; white-space: nowrap; }
.cs-row-error { color: #e88; }
.cs-row-actions { display: flex; gap: 0.4rem; }

.cs-poster-row {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.cs-poster-card {
  flex: 0 0 auto;
  width: 74px;
}

.cs-poster {
  border-radius: 6px;
  display: block;
  height: 111px;
  object-fit: cover;
  width: 74px;
}

.cs-poster-blank {
  align-items: center;
  background: #222;
  color: #ccc;
  display: flex;
  font-size: 0.6rem;
  justify-content: center;
  overflow: hidden;
  padding: 0.25rem;
  text-align: center;
}

.cs-poster-note {
  color: #ccc;
  display: block;
  font-size: 0.65rem;
  margin-top: 0.2rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cs-consensus-row {
  align-items: flex-start;
  border-top: 1px solid #2e2e2e;
  display: flex;
  gap: 0.6rem;
  padding: 0.55rem 0;

  &:active { background: #222; }
}

.cs-thumb {
  border-radius: 4px;
  flex: 0 0 auto;
  height: 69px;
  object-fit: cover;
  width: 46px;
}

.cs-consensus-info { display: flex; flex: 1 1 auto; flex-direction: column; gap: 0.25rem; min-width: 0; }

.cs-scores { display: flex; flex-wrap: wrap; gap: 0.3rem; }

.cs-score-chip {
  background: #222;
  border-radius: 6px;
  color: #ccc;
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
}

.cs-average { color: #ffc107; font-weight: 700; }
.cs-spread { color: #e88; }
</style>

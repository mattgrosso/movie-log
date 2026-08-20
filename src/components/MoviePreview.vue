<template>
  <!-- Teleported for the same reason WhereToWatch and SendToHat's picker are:
       these open from a poster inside a horizontal scroller, and a sheet
       parented there is clipped by it and drags its layout sideways. -->
  <Teleport to="body">
    <div v-if="movie" class="mp-backdrop" @click.self="$emit('close')">
      <div class="mp-sheet">
        <div class="mp-head">
          <p class="mp-title">{{ movie.title }}</p>
          <button type="button" class="mp-close" aria-label="Close" @click="$emit('close')">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="mp-top">
          <img
            v-if="poster"
            :src="poster"
            :alt="movie.title"
            class="mp-poster"
          >
          <div v-else class="mp-poster mp-poster-blank">{{ movie.title }}</div>

          <div class="mp-facts">
            <p v-if="factLine" class="mp-fact-line">{{ factLine }}</p>
            <p v-if="genres" class="mp-genres">{{ genres }}</p>
            <p v-if="score" class="mp-score">{{ score }} on TMDB</p>
          </div>
        </div>

        <p v-if="loading" class="mp-status">
          <span class="spinner-border spinner-border-sm" role="status"></span>
          Looking&hellip;
        </p>
        <p v-else-if="overview" class="mp-overview">{{ overview }}</p>
        <p v-else-if="error" class="mp-status">Couldn't load anything more about this one.</p>
        <p v-else class="mp-status">No summary available.</p>

        <!-- The availability the "where to watch" sheet shows, inline rather
             than behind a second tap — the point of the sheet is to decide
             whether to bother with the film, and "can I actually watch it"
             is half of that. Same normalizer, same region. -->
        <div v-if="providerGroups.length" class="mp-providers">
          <div v-for="group in providerGroups" :key="group.key" class="mp-provider-group">
            <p class="mp-provider-label">{{ group.label }}</p>
            <div class="mp-provider-logos">
              <template v-for="provider in group.providers" :key="provider.id">
                <img
                  v-if="provider.logo"
                  :src="provider.logo"
                  :alt="provider.name"
                  :title="provider.name"
                  class="mp-logo"
                  loading="lazy"
                >
                <span v-else class="mp-logo mp-logo-blank" :title="provider.name">
                  {{ provider.name ? provider.name.slice(0, 1) : '?' }}
                </span>
              </template>
            </div>
          </div>
          <!-- TMDB sources this from JustWatch and requires the credit
               wherever it is displayed. -->
          <p class="mp-credit">Availability from JustWatch, via TMDB</p>
        </div>

        <!-- Rating is still one tap away — it was what the poster used to do
             directly, so it stays the primary action rather than becoming
             something you have to go and find. -->
        <div class="mp-actions">
          <button type="button" class="mp-rate" @click="$emit('rate', movie.source || movie)">
            I've seen it — rate it
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
// Bug report, 2026-08-20: "If a movie is presented in a watchlist or in film
// club and it's one that I have not yet rated then I think we of course have
// the add to hat button on the top right corner and that looks good, but I
// think that just clicking the poster should pull up some kind of a summary
// of the movie so that I can investigate further. If perhaps I'm interested
// in it."
//
// Tapping an unrated poster used to drop straight into the rating flow, which
// only makes sense if you have already seen the film — and these rows are
// suggestions of films you HAVEN'T. So the tap opens this instead, and rating
// becomes the deliberate second step it should always have been.
//
// Everything here is fetched by TMDB id rather than threaded through from the
// row, deliberately: the sources feeding these rows carry wildly different
// shapes (discover results, credits, a friend's published profile with
// single-letter keys), and only the id is common to all of them.
import axios from 'axios';
import { normalizeWatchProviders, PROVIDER_REGION } from '../assets/javascript/watchProviders';
import backgroundScrollLock from '../mixins/backgroundScrollLock.js';

// Details and availability both change on the order of days, and a row of
// suggestions invites tapping several posters in a row (and often the same
// one twice). Cached for the life of the page, per movie — module scope, so
// it survives this component being unmounted with its screen.
const cache = new Map();

export default {
  name: 'MoviePreview',
  mixins: [backgroundScrollLock],
  props: {
    // { id, title, poster_path?, source? } — TMDB movie id. Null closes the
    // sheet. `source` is handed back on rate, so the screen gets the same
    // object its row was built from rather than this trimmed one.
    movie: { type: Object, default: null }
  },
  emits: ['close', 'rate'],
  data () {
    return {
      loading: false,
      error: false,
      details: null,
      providerGroups: []
    };
  },
  computed: {
    poster () {
      const path = this.details?.poster_path || this.movie?.poster_path;
      return path ? `https://image.tmdb.org/t/p/w342${path}` : null;
    },
    overview () {
      return this.details?.overview || null;
    },
    // Year and runtime, whichever of them we actually have.
    factLine () {
      const released = this.details?.release_date || this.movie?.release_date;
      const year = released ? new Date(released).getFullYear() : null;
      const runtime = this.details?.runtime;
      return [
        Number.isFinite(year) ? year : null,
        runtime ? `${runtime} min` : null
      ].filter(Boolean).join(' · ') || null;
    },
    genres () {
      return (this.details?.genres || []).map((genre) => genre.name).join(', ') || null;
    },
    // TMDB's 0 means "nobody has voted", not "everybody hated it" — same
    // treatment box office already gets on MovieDetail.
    score () {
      const average = this.details?.vote_average ?? this.movie?.vote_average;
      return Number.isFinite(average) && average > 0 ? average.toFixed(1) : null;
    }
  },
  watch: {
    movie: {
      immediate: true,
      handler (movie) {
        this.lockBackgroundScroll(Boolean(movie));
        if (!movie) return;
        this.load(movie);
      }
    }
  },
  methods: {
    async load (movie) {
      this.details = null;
      this.providerGroups = [];
      this.error = false;

      if (movie.id == null) {
        this.error = true;
        return;
      }

      if (cache.has(movie.id)) {
        this.apply(movie.id, cache.get(movie.id));
        return;
      }

      this.loading = true;

      const apiKey = process.env.VUE_APP_TMDB_API_KEY;
      // One failing half must not blank the other: a film with no availability
      // still deserves its summary, and vice versa.
      const [details, providers] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${apiKey}`)
          .then((response) => response.data, () => null),
        axios.get(`https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${apiKey}`)
          .then((response) => normalizeWatchProviders(response.data, PROVIDER_REGION), () => null)
      ]);

      const loaded = { details, groups: providers?.groups || [] };
      // A completely failed lookup is NOT cached: the next tap should retry.
      if (details) cache.set(movie.id, loaded);

      this.apply(movie.id, loaded);
    },
    apply (id, loaded) {
      // The sheet may have been closed, or moved to another poster, while
      // that was in flight — only paint if it is still this movie's turn.
      if (this.movie?.id !== id) return;
      this.details = loaded.details;
      this.providerGroups = loaded.groups;
      this.error = !loaded.details;
      this.loading = false;
    }
  }
};
</script>

<!-- Unscoped: the sheet is teleported to <body>, outside this component's
     scoped-style tree, exactly as WhereToWatch's is. -->
<style lang="scss">
.mp-backdrop {
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.6);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 1060;
}

.mp-sheet {
  background: #161616;
  border: 1px solid #2e2e2e;
  border-radius: 14px 14px 0 0;
  max-height: 80vh;
  max-width: 520px;
  overflow-y: auto;
  padding: 0.9rem 1rem calc(1rem + env(safe-area-inset-bottom));
  width: 100%;
}

.mp-head {
  align-items: flex-start;
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  margin-bottom: 0.7rem;
}

.mp-title {
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.25;
  margin: 0;
}

.mp-close {
  background: none;
  border: none;
  color: #b9b9b9;
  flex: 0 0 auto;
  /* House minimum tap target. */
  height: 40px;
  margin: -0.4rem -0.5rem 0 0;
  width: 40px;
}

/* Mobile-first: press feedback only, never a hover state that sticks. */
.mp-close:active {
  color: #fff;
}

.mp-top {
  display: flex;
  gap: 0.8rem;
  margin-bottom: 0.7rem;
}

.mp-poster {
  border-radius: 6px;
  flex: 0 0 auto;
  height: 156px;
  object-fit: cover;
  width: 104px;
}

.mp-poster-blank {
  align-items: center;
  background: #2b2b2b;
  color: #ccc;
  display: flex;
  font-size: 0.7rem;
  justify-content: center;
  line-height: 1.2;
  padding: 0.3rem;
  text-align: center;
}

.mp-facts {
  min-width: 0;
}

/* #b9b9b9 on #161616 is ~8:1; #ccc on the same is ~10:1. */
.mp-fact-line,
.mp-genres {
  color: #b9b9b9;
  font-size: 0.78rem;
  line-height: 1.35;
  margin: 0 0 0.3rem;
}

.mp-score {
  color: #ccc;
  font-size: 0.78rem;
  margin: 0;
}

.mp-overview {
  color: #e4e4e4;
  font-size: 0.85rem;
  line-height: 1.45;
  margin: 0 0 0.8rem;
}

.mp-status {
  align-items: center;
  color: #b9b9b9;
  display: flex;
  font-size: 0.8rem;
  gap: 0.5rem;
  margin: 0 0 0.8rem;
}

.mp-provider-group {
  margin-bottom: 0.6rem;
}

.mp-provider-label {
  color: #b9b9b9;
  font-size: 0.7rem;
  margin: 0 0 0.3rem;
  text-transform: uppercase;
}

.mp-provider-logos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.mp-logo {
  border-radius: 6px;
  height: 34px;
  object-fit: cover;
  width: 34px;
}

.mp-logo-blank {
  align-items: center;
  background: #2b2b2b;
  color: #ccc;
  display: flex;
  font-size: 0.9rem;
  justify-content: center;
}

.mp-credit {
  color: #8a8a8a;
  font-size: 0.65rem;
  margin: 0 0 0.6rem;
}

.mp-actions {
  margin-top: 0.4rem;
}

.mp-rate {
  background: #ffc107;
  border: none;
  border-radius: 8px;
  color: #1a1a1a;
  font-size: 0.85rem;
  font-weight: 600;
  min-height: 44px;
  width: 100%;
}

.mp-rate:active {
  background: #e0a800;
}
</style>

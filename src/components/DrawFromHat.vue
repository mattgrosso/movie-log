<template>
  <section v-if="hats.length" class="draw-from-hat">
    <h2 class="section-title">Your hats</h2>
    <p class="section-caption">
      A real draw — the movie leaves the hat and lands in its history, exactly as it would in Movie Hat.
    </p>

    <div class="hat-cards">
      <div v-for="hat in cards" :key="hat.title" class="hat-card">
        <!-- Rebuilt as a vertical block (2026-08-17). It used to be a flex ROW
             of poster + body, and the history strip was appended as a third
             flex child, so it was squeezed into a narrow column beside the
             text — "the layout on the hat displays where you're showing the
             history is all busted". A row can't hold a full-width strip; this
             stacks instead. -->
        <div class="hat-head">
          <span class="hat-name">{{ hat.title }}</span>
          <span class="hat-waiting">
            <template v-if="hat.error">couldn't load</template>
            <template v-else-if="hat.waiting == null">&hellip;</template>
            <template v-else>{{ hat.waiting }} waiting</template>
          </span>
        </div>

        <div class="hat-last">
          <img
            v-if="lastPoster(hat)"
            :src="lastPoster(hat)"
            :alt="hat.lastDrawn.title"
            class="hat-last-poster"
            loading="lazy"
          >
          <div v-else class="hat-last-poster hat-last-poster-blank">
            <i class="bi bi-question-lg"></i>
          </div>

          <div class="hat-last-text">
            <template v-if="hat.lastDrawn">
              <span class="hat-last-label">Last drew</span>
              <span class="hat-last-title">{{ hat.lastDrawn.title }}</span>
              <span v-if="drawnAgo(hat)" class="hat-last-when">{{ drawnAgo(hat) }}</span>
            </template>
            <span v-else-if="!hat.error" class="hat-last-label">Nothing drawn yet.</span>
          </div>

          <button type="button" class="hat-draw" :disabled="drawing" @click="draw(hat)">
            <span v-if="drawing === hat.title" class="spinner-border spinner-border-sm" role="status"></span>
            <span v-else>Draw</span>
          </button>
        </div>

        <!-- Full width, which is the whole reason the card had to stop being
             a row. Everything this hat has ever given up, newest first. -->
        <div v-if="hat.history && hat.history.length > 1" class="hat-history">
          <p class="hat-history-title">Everything it's drawn · {{ hat.history.length }}</p>
          <div class="hat-history-row">
            <div
              v-for="(drawnMovie, index) in hat.history"
              :key="`${hat.title}-${drawnMovie.id}-${index}`"
              class="hat-history-card"
            >
              <img
                v-if="drawnMovie.poster_path"
                :src="historyPoster(drawnMovie)"
                :alt="drawnMovie.title"
                :title="drawnMovie.title"
                class="hat-history-poster"
                loading="lazy"
              >
              <div v-else class="hat-history-poster hat-history-blank">{{ drawnMovie.title }}</div>
              <span class="hat-history-when">{{ drawnAt(drawnMovie) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="drawn" class="drawn">
      <img
        v-if="drawn.movie.poster_path"
        :src="`https://image.tmdb.org/t/p/w342${drawn.movie.poster_path}`"
        :alt="drawn.movie.title"
        class="drawn-poster"
        @click="openMovie"
      >
      <div class="drawn-info">
        <p class="drawn-title">{{ drawn.movie.title }}</p>
        <p v-if="drawn.movie.addedBy" class="drawn-meta">Added by {{ drawn.movie.addedBy }}</p>
        <p v-if="drawn.movie.note" class="drawn-note">{{ drawn.movie.note }}</p>
        <p class="drawn-meta">{{ drawn.remaining }} left in {{ drawn.hat }}</p>
        <button type="button" class="drawn-link" @click="openMovie">Look it up</button>
      </div>
    </div>

    <p v-if="message" class="draw-message" :class="{ 'draw-message-error': messageIsError }">{{ message }}</p>
  </section>
</template>

<script>
// Your hats, on the watchlist — Matt, 2026-08-16: "The draw from hat buttons
// do not need to be all the way at the top. Let's add a section lower down
// that shows each hat with the most recently drawn movie, the total number
// of movies in the hat, and a button to draw."
//
// A draw is destructive on purpose: the movie moves from the hat into its
// history. That is what makes it a hat rather than a shuffle button, so this
// does exactly what Movie Hat's own draw does, through the shared module.
//
// It deliberately does NOT lead into rating: "that's dumb. I'll have to watch
// the movie first." The only follow-on offered is looking the film up.
import ErrorLogService from '../services/ErrorLogService.js';
import { timeAgo } from '../assets/javascript/timeAgo.js';

export default {
  name: 'DrawFromHat',
  data () {
    return {
      drawing: null,
      drawn: null,
      message: null,
      messageIsError: false
    };
  },
  computed: {
    hats () {
      return this.$store.getters.linkedMovieHats || [];
    },
    // The linked hats always render; their counts and last draw fill in when
    // the lookups land, so the section doesn't pop into existence late.
    cards () {
      const summaries = this.$store.state.movieHatSummaries || [];
      return this.hats.map((hat) => summaries.find((summary) => summary.title === hat.title) || { ...hat, waiting: null });
    }
  },
  watch: {
    // Settings arrive after mount, so loading these in mounted() fetched an
    // empty list once and never tried again — the cards sat on "…" forever.
    hats: {
      immediate: true,
      handler (hats) {
        if (hats.length) this.$store.dispatch('loadMovieHatSummaries');
      }
    }
  },
  methods: {
    lastPoster (hat) {
      return hat.lastDrawn?.poster_path
        ? `https://image.tmdb.org/t/p/w185${hat.lastDrawn.poster_path}`
        : null;
    },
    drawnAgo (hat) {
      return timeAgo(hat.lastDrawn?.dateDrawn);
    },
    historyPoster (drawnMovie) {
      return `https://image.tmdb.org/t/p/w185${drawnMovie.poster_path}`;
    },
    drawnAt (drawnMovie) {
      return timeAgo(drawnMovie?.dateDrawn) || '—';
    },
    async draw (hat) {
      this.drawing = hat.title;
      this.message = null;
      this.messageIsError = false;

      try {
        const result = await this.$store.dispatch('drawFromMovieHat', { title: hat.title, dbKey: hat.dbKey });

        if (!result.movie) {
          this.drawn = null;
          this.message = `${hat.title} is empty. Which is sad.`;
          return;
        }
        this.drawn = result;
        // The card's count and last-drawn are now stale by definition.
        this.$store.dispatch('loadMovieHatSummaries');
      } catch (error) {
        ErrorLogService.error('Drawing from a movie hat failed', error);
        this.message = `Couldn't reach ${hat.title}.`;
        this.messageIsError = true;
      } finally {
        this.drawing = null;
      }
    },
    openMovie () {
      if (this.drawn?.movie?.id != null) {
        this.$router.push(`/movie/${this.drawn.movie.id}`);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.draw-from-hat {
  background: #161616;
  border: 1px solid #2e2e2e;
  border-radius: 10px;
  margin-bottom: 0.75rem;
  padding: 0.75rem 1rem;
}

.section-title { font-size: 1.05rem; margin: 0 0 0.35rem; }

.section-caption {
  /* #b9b9b9 on #161616, ~8:1. */
  color: #b9b9b9;
  font-size: 0.75rem;
  line-height: 1.35;
  margin: 0 0 0.7rem;
}

.hat-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* A vertical block. It was a flex row, which had no place to put a full-width
   history strip — appended there it became a squeezed third column. */
.hat-card {
  background: #1f1f1f;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  padding: 0.6rem 0.7rem;
}

.hat-head {
  align-items: baseline;
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
}

.hat-name { color: #fff; font-size: 0.95rem; font-weight: 700; min-width: 0; }
.hat-waiting { color: #b9b9b9; font-size: 0.72rem; white-space: nowrap; }

.hat-last {
  align-items: center;
  display: flex;
  gap: 0.6rem;
  margin-top: 0.5rem;
}

.hat-last-poster {
  border-radius: 4px;
  flex: 0 0 auto;
  height: 66px;
  object-fit: cover;
  width: 44px;
}

.hat-last-poster-blank {
  align-items: center;
  background: #2b2b2b;
  color: #7a7a7a;
  display: flex;
  justify-content: center;
}

.hat-last-text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.hat-last-label { color: #9a9a9a; font-size: 0.62rem; letter-spacing: 0.06em; text-transform: uppercase; }
.hat-last-title { color: #eee; font-size: 0.85rem; font-weight: 600; line-height: 1.25; }
.hat-last-when { color: #b9b9b9; font-size: 0.7rem; }

.hat-draw {
  background: #33383d;
  border: 1px solid #555c63;
  border-radius: 8px;
  color: #eee;
  flex: 0 0 auto;
  font-size: 0.78rem;
  font-weight: 600;
  /* 40px minimum touch target. */
  min-height: 40px;
  padding: 0.3rem 1.1rem;
}

/* Mobile-first: press feedback is :active only, never :hover. */
.hat-draw:active { background: #23272b; }
.hat-draw:disabled { opacity: 0.6; }

.drawn {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.drawn-poster {
  border-radius: 4px;
  flex: 0 0 auto;
  width: 96px;
}

.drawn-info {
  min-width: 0;
}

.drawn-title {
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  margin: 0 0 0.2rem;
}

.drawn-meta {
  color: #b9b9b9;
  font-size: 0.75rem;
  margin: 0 0 0.2rem;
}

.drawn-note {
  color: #eee;
  font-size: 0.8rem;
  font-style: italic;
  margin: 0 0 0.3rem;
}

.drawn-link {
  background: none;
  border: 1px solid #6f6f6f;
  border-radius: 999px;
  color: #ccc;
  font-size: 0.75rem;
  min-height: 40px;
  padding: 0.3rem 0.7rem;
}

.drawn-link:active {
  opacity: 0.7;
}

.draw-message {
  color: #b9b9b9;
  font-size: 0.78rem;
  margin: 0.5rem 0 0;
}

.draw-message-error {
  color: #ff9f9f;
}
/* Full width inside the stacked card. */
.hat-history {
  border-top: 1px solid #2e2e2e;
  margin-top: 0.6rem;
  padding-top: 0.5rem;
}

.hat-history-title {
  color: #9a9a9a;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  margin: 0 0 0.35rem;
  text-transform: uppercase;
}

.hat-history-row {
  align-items: flex-start;
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.3rem;
  -webkit-overflow-scrolling: touch;
}

.hat-history-card { flex: 0 0 48px; width: 48px; }

.hat-history-poster {
  border-radius: 4px;
  display: block;
  height: 72px;
  object-fit: cover;
  width: 48px;
}

.hat-history-blank {
  align-items: center;
  background: #2b2b2b;
  color: #ccc;
  display: flex;
  font-size: 0.5rem;
  justify-content: center;
  padding: 0.2rem;
  text-align: center;
}

.hat-history-when { color: #9a9a9a; display: block; font-size: 0.56rem; line-height: 1.2; }
</style>

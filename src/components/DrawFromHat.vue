<template>
  <section v-if="hats.length" class="draw-from-hat">
    <h2 class="section-title">Draw from a hat</h2>
    <p class="section-caption">
      A real draw — the movie leaves the hat and lands in its history, exactly as it would in Movie Hat.
    </p>

    <div class="draw-buttons">
      <button
        v-for="hat in hats"
        :key="hat.title"
        type="button"
        class="draw-button"
        :disabled="drawing"
        @click="draw(hat)"
      >
        <span v-if="drawing === hat.title" class="spinner-border spinner-border-sm" role="status"></span>
        <span v-else>{{ hat.title }}</span>
      </button>
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
// Drawing from a Movie Hat without leaving Cinema Roll — Matt, 2026-08-16:
// "I could go in cinema roll and draw a movie, and I would, you know, it
// would just work, and it would pull up from the hat and all of the rules
// and everything else that I have."
//
// A draw is destructive on purpose: the movie moves from the hat into its
// history. That is what makes it a hat rather than a shuffle button, so this
// does exactly what Movie Hat's own draw does, through the shared module.
//
// It deliberately does NOT lead into rating the movie: "that's dumb. I'll
// have to watch the movie first." The only follow-on offered is looking the
// film up.
import ErrorLogService from '../services/ErrorLogService.js';

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
    }
  },
  methods: {
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
  margin: 0 0 0.6rem;
}

.draw-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.draw-button {
  background: #33383d;
  border: 1px solid #555c63;
  border-radius: 8px;
  color: #eee;
  font-size: 0.8rem;
  font-weight: 600;
  min-height: 40px;
  padding: 0.35rem 0.8rem;
}

/* Mobile-first: press feedback is :active only, never :hover. */
.draw-button:active {
  background: #23272b;
}

.draw-button:disabled {
  opacity: 0.6;
}

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
</style>

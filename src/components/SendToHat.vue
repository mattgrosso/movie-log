<template>
  <div v-if="hats.length" class="send-to-hat">
    <button type="button" class="hat-button" :disabled="sending" @click="open = !open">
      <span v-if="sending" class="spinner-border spinner-border-sm" role="status"></span>
      <i v-else class="bi bi-magic"></i>
      <span>{{ buttonLabel }}</span>
    </button>

    <!-- One hat: no picker needed. More than one: choose. -->
    <div v-if="open && !sending" class="hat-picker">
      <button
        v-for="hat in hats"
        :key="hat.title"
        type="button"
        class="hat-choice"
        @click="send(hat)"
      >{{ hat.title }}</button>
    </div>

    <p v-if="result" class="hat-result" :class="{ 'hat-result-error': result.error }">{{ result.message }}</p>
  </div>
</template>

<script>
// "Send to hat" for one movie or a whole list — Matt, 2026-08-16: "fill a
// hat from a list is kind of the same as send to a hat. It just iterates
// through the list."
//
// Cinema Roll does NOT track what's in a hat: "we don't really need to keep
// track of that. We should just be... if you try to add something to a hat,
// it should just notify you back that it's already in there." So the hat is
// read at the moment of sending and the result is reported back, rather than
// mirrored in Cinema Roll's own state.
import ErrorLogService from '../services/ErrorLogService.js';

export default {
  name: 'SendToHat',
  props: {
    // A Cinema Roll library entry, a TMDB movie, or a list of either.
    movies: { type: [Array, Object], required: true },
    label: { type: String, default: null }
  },
  data () {
    return {
      open: false,
      sending: false,
      result: null,
      resultTimer: null
    };
  },
  computed: {
    hats () {
      // Guarded: a screen mounted without this getter (older tests, a
      // partial store) must not take the whole section down with it.
      return this.$store.getters.linkedMovieHats || [];
    },
    list () {
      return Array.isArray(this.movies) ? this.movies : [this.movies];
    },
    buttonLabel () {
      if (this.label) return this.label;
      return this.list.length > 1 ? `Add ${this.list.length} to a hat` : 'Add to hat';
    }
  },
  beforeUnmount () {
    if (this.resultTimer) clearTimeout(this.resultTimer);
  },
  methods: {
    async send (hat) {
      this.open = false;
      this.sending = true;
      this.result = null;

      try {
        const { added, skipped } = await this.$store.dispatch('addToMovieHat', {
          title: hat.title,
          dbKey: hat.dbKey,
          entries: this.list
        });
        this.report({ message: this.summarize(added, skipped, hat.title) });
      } catch (error) {
        ErrorLogService.error('Adding to a movie hat failed', error);
        this.report({ message: `Couldn't reach ${hat.title}.`, error: true });
      } finally {
        this.sending = false;
      }
    },
    // Says what actually happened, including the already-in-there case.
    summarize (added, skipped, hatTitle) {
      const movies = (count) => `${count} ${count === 1 ? 'movie' : 'movies'}`;

      if (!added.length && skipped.length) {
        return skipped.length === 1
          ? `${skipped[0].title} is already in ${hatTitle}.`
          : `All ${movies(skipped.length)} were already in ${hatTitle}.`;
      }
      if (added.length && skipped.length) {
        return `Added ${movies(added.length)} to ${hatTitle}; ${skipped.length} already there.`;
      }
      if (added.length === 1) {
        return `${added[0].title} is in ${hatTitle}.`;
      }
      return added.length
        ? `Added ${movies(added.length)} to ${hatTitle}.`
        : `Nothing to add to ${hatTitle}.`;
    },
    report (result) {
      this.result = result;
      if (this.resultTimer) clearTimeout(this.resultTimer);
      this.resultTimer = setTimeout(() => { this.result = null; }, 6000);
    }
  }
};
</script>

<style lang="scss" scoped>
.send-to-hat {
  position: relative;
}

.hat-button {
  align-items: center;
  background: #33383d;
  border: 1px solid #555c63;
  border-radius: 8px;
  color: #eee;
  display: flex;
  font-size: 0.78rem;
  gap: 0.4rem;
  /* House minimum for a tap target. */
  min-height: 40px;
  padding: 0.3rem 0.7rem;
}

/* Mobile-first: press feedback is :active only. */
.hat-button:active {
  background: #23272b;
}

.hat-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.4rem;
}

.hat-choice {
  background: none;
  border: 1px solid #6f6f6f;
  border-radius: 999px;
  /* #ccc on this background is ~9:1; Bootstrap's muted grey would not be. */
  color: #ccc;
  font-size: 0.75rem;
  min-height: 40px;
  padding: 0.3rem 0.7rem;
}

.hat-choice:active {
  opacity: 0.7;
}

.hat-result {
  color: #b9b9b9;
  font-size: 0.75rem;
  line-height: 1.3;
  margin: 0.4rem 0 0;
}

.hat-result-error {
  color: #ff9f9f;
}
</style>

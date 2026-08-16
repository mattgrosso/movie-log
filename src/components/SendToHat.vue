<template>
  <div v-if="hats.length" class="send-to-hat" :class="`send-to-hat-${variant}`">
    <!-- On a poster the control is an icon in the corner; under a list it is
         a labelled button. Same behaviour either way. -->
    <button
      type="button"
      :class="variant === 'icon' ? 'hat-icon-button' : 'hat-button'"
      :disabled="sending"
      :title="buttonLabel"
      :aria-label="buttonLabel"
      @click.stop="activate"
    >
      <span v-if="sending" class="spinner-border spinner-border-sm" role="status"></span>
      <template v-else>
        <i class="bi bi-magic"></i>
        <span v-if="variant !== 'icon'">{{ buttonLabel }}</span>
      </template>
    </button>

    <!-- One hat: no picker needed. More than one: choose. -->
    <div v-if="open && !sending" class="hat-picker" @click.stop>
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
    label: { type: String, default: null },
    variant: { type: String, default: 'button' }
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
    // One linked hat means there is nothing to choose — go straight in.
    activate () {
      if (this.hats.length === 1) {
        this.send(this.hats[0]);
        return;
      }
      this.open = !this.open;
    },
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

/* Sitting on a poster: dark enough to read against any artwork, small
   enough not to be the point, and still a 40px target. */
.hat-icon-button {
  align-items: center;
  background: none;
  border: none;
  color: #fff;
  display: flex;
  /* 40px of tappable area, 26px of visible disc — the poster is the point. */
  height: 40px;
  justify-content: center;
  padding: 0;
  width: 40px;
}

.hat-icon-button i {
  align-items: center;
  background: rgba(0, 0, 0, 0.66);
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 999px;
  display: flex;
  font-size: 0.72rem;
  height: 26px;
  justify-content: center;
  width: 26px;
}

.hat-icon-button:active i {
  background: rgba(0, 0, 0, 0.9);
}

/* The picker has to escape the poster it is anchored to. */
.send-to-hat-icon .hat-picker {
  background: #1b1b1b;
  border: 1px solid #4a4a4a;
  border-radius: 8px;
  flex-direction: column;
  left: 0;
  min-width: 140px;
  padding: 0.3rem;
  position: absolute;
  top: 44px;
  z-index: 20;
}

.send-to-hat-icon .hat-result {
  background: rgba(0, 0, 0, 0.85);
  border-radius: 6px;
  left: 0;
  padding: 0.3rem 0.4rem;
  position: absolute;
  top: 44px;
  width: 150px;
  z-index: 20;
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

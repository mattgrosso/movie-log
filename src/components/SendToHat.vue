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
        <!-- A top hat with a plus, rather than Bootstrap's magic wand: "I'd
             much rather be hat related... maybe like a top hat with a little
             plus symbol" (2026-08-17). Drawn here because bootstrap-icons has
             no hat at all. -->
        <svg class="hat-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M8 3.2h8v10.2H8z" class="hat-crown"/>
          <rect x="3.2" y="13.2" width="17.6" height="2.4" rx="1.2" class="hat-brim"/>
          <path d="M12 17.4v5M9.5 19.9h5" class="hat-plus"/>
        </svg>
        <span v-if="variant !== 'icon'">{{ buttonLabel }}</span>
      </template>
    </button>

    <!-- One hat: no picker needed. More than one: choose.
         Teleported to <body> as a sheet rather than dropped in place. The
         icon variant sits on a poster inside a horizontal `overflow-x: auto`
         row, so an absolutely-positioned dropdown was clipped by the scroller
         and dragged its layout sideways — "it is stuck inside of that
         scrolling container so it just kind of breaks the scroll layout...
         maybe there must be another way to show all my hats without making it
         feel cramped and inaccessible" (2026-08-17). A sheet escapes every
         overflow and clipping context there will ever be, and gives each hat
         a full-width row instead of a cramped chip. -->
    <Teleport to="body">
      <div v-if="open && !sending" class="hat-sheet-backdrop" @click.stop="open = false">
        <div class="hat-sheet" @click.stop>
          <p class="hat-sheet-title">Add to which hat?</p>
          <button
            v-for="hat in hats"
            :key="hat.title"
            type="button"
            class="hat-sheet-choice"
            @click="send(hat)"
          >
            <span>{{ hat.title }}</span>
            <i class="bi bi-chevron-right"></i>
          </button>
          <button type="button" class="hat-sheet-cancel" @click="open = false">Cancel</button>
        </div>
      </div>
    </Teleport>

    <!-- Same clipping problem, same answer. -->
    <Teleport to="body">
      <p v-if="result" class="hat-toast" :class="{ 'hat-toast-error': result.error }">{{ result.message }}</p>
    </Teleport>
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
    variant: { type: String, default: 'button' },
    // Plain-language provenance written onto the hat movie, so a draw can
    // say where it came from ("Worth a rewatch", "Natalie watched this").
    // Movie Hat renders it on the drawn-movie screen.
    note: { type: String, default: null }
  },
  emits: ['added'],
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
          entries: this.list,
          note: this.note
        });
        this.report({ message: this.summarize(added, skipped, hat.title) });
        // Lists use this to take a movie off themselves: "when I add a movie
        // to a hat from my watchlist, it should be removed from the watchlist
        // because I have essentially decided OK, I will watch that"
        // (2026-08-17). Only what was genuinely added — a skip means it was
        // already in the hat and the list already knew about it.
        if (added.length) this.$emit('added', added, this.list);
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
        // "is in X" read as a status rather than as something that just
        // happened, and sat too close to "is already in X" (2026-08-17).
        return `${added[0].title} was added to ${hatTitle}.`;
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

.hat-icon-button .hat-glyph {
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

.hat-icon-button:active .hat-glyph {
  background: rgba(0, 0, 0, 0.9);
}

/* The sheet is teleported to <body>, so it is styled unscoped. */
.hat-glyph { height: 15px; width: 15px; }
.hat-glyph .hat-crown { fill: currentColor; }
.hat-glyph .hat-brim { fill: currentColor; }
.hat-glyph .hat-plus { stroke: currentColor; stroke-width: 2; stroke-linecap: round; fill: none; }

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

<!-- Unscoped: the sheet is teleported to <body>, outside this component's
     scope attribute. -->
<style lang="scss">
.hat-sheet-backdrop {
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.6);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 2000;
}

.hat-sheet {
  background: #161616;
  border: 1px solid #2e2e2e;
  border-radius: 14px 14px 0 0;
  max-height: 70vh;
  max-width: 520px;
  overflow-y: auto;
  padding: 0.9rem 1rem calc(1rem + env(safe-area-inset-bottom));
  width: 100%;
}

.hat-sheet-title {
  color: #b9b9b9;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  margin: 0 0 0.6rem;
  text-transform: uppercase;
}

.hat-sheet-choice {
  align-items: center;
  background: #101010;
  border: 1px solid #2e2e2e;
  border-radius: 8px;
  color: #eee;
  display: flex;
  justify-content: space-between;
  /* 40px minimum touch target. */
  min-height: 48px;
  margin-bottom: 0.4rem;
  padding: 0.6rem 0.85rem;
  text-align: left;
  width: 100%;
}

.hat-sheet-choice:active { background: #1d1d1d; }

.hat-sheet-cancel {
  background: none;
  border: none;
  color: #b9b9b9;
  min-height: 44px;
  width: 100%;
}

.hat-toast {
  background: #1b1b1b;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  bottom: calc(1rem + env(safe-area-inset-bottom));
  color: #eee;
  font-size: 0.8rem;
  left: 50%;
  margin: 0;
  max-width: 90vw;
  padding: 0.55rem 0.9rem;
  position: fixed;
  transform: translateX(-50%);
  z-index: 2001;
}

.hat-toast-error { border-color: #a5474a; color: #ffb3b3; }
</style>

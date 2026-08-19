<template>
  <div class="watchlist-row-wrapper">
    <div class="watchlist-row">
      <div
        v-for="item in items"
        :key="item.key"
        class="watchlist-card"
        role="button"
        :aria-label="item.title"
        @click="$emit('select', item.source)"
      >
        <img
          v-if="item.poster"
          :src="item.poster"
          :alt="item.title"
          class="watchlist-poster"
          loading="lazy"
        >
        <!-- No artwork is the ONE case where the title has to carry it. -->
        <div v-else class="watchlist-poster watchlist-poster-blank">{{ item.title }}</div>

        <!-- Hat button alone, pinned top-right, matching every other poster
             in the app (bug report: "It should always be in the top right
             corner no matter where that is in the app"). It used to share
             this strip with the punt X under justify-content: space-between,
             which meant the hat sat LEFT when the X was present and RIGHT
             when it wasn't — "it's awkward that the X button is sometimes on
             the right and sometimes on the left and sometimes it's a hat
             button sometimes it's an X button". -->
        <div class="watchlist-card-actions">
          <SendToHat variant="icon" :movies="item.source" :note="hatNote" @added="onAdded"/>
        </div>

        <!-- Kept because a poster can't tell you your own score or how long
             it's been. The TITLE is what the poster already says.

             The punt X now lives here rather than over the artwork: "let's
             move that down lower make it very small, but make it part of the
             text below the poster where we have like a rating and a year".
             Visibly tiny, but the tap target keeps the house 40px minimum —
             the same split the buttons over the poster already used. -->
        <span v-if="item.meta || puntable" class="watchlist-meta">
          <span v-if="item.meta" class="watchlist-meta-text">{{ item.meta }}</span>
          <button
            v-if="puntable"
            type="button"
            class="punt-btn"
            title="Not yet — back in a couple of months"
            aria-label="Not yet — back in a couple of months"
            @click.stop="$emit('punt', item.source)"
          >
            <i class="bi bi-x"></i>
          </button>
        </span>
      </div>
    </div>

    <!-- Quiet, and after the list: the per-poster buttons are the everyday
         action, this is the bulk one. -->
    <div v-if="items.length" class="watchlist-row-bulk">
      <SendToHat :movies="items.map((item) => item.source)" :note="hatNote" @added="onAdded"/>
    </div>
  </div>
</template>

<script>
// One presentation for every list on the watchlist (Matt, 2026-08-16):
//
//   "All over this page you've ignored my rule that posters are better than
//    text. You've got a bunch of movie posters with the titles written out
//    right below them."
//
//   "I like the idea of the 'get X year to 10' sections but they are too
//    large. They should be sideways scrolling lists."
//
//   "Every poster on a watchlist should have a button to easily add it to a
//    hat. But don't make the buttons ugly."
//
//   "The 'add all' buttons should be less prominent (maybe at the bottom of
//    the list)."
//
// So: one sideways-scrolling row of posters, no titles under them, a small
// hat button on each poster, and the bulk action demoted to below the row.
// Note this is NOT MediaResultGrid — that one is still right where it is
// used, choosing between similar search results, where the title is the
// only thing telling two candidates apart.
import SendToHat from './SendToHat.vue';

export default {
  name: 'WatchlistRow',
  components: { SendToHat },
  props: {
    // [{ key, title, poster, meta, source }] — `source` is handed back on
    // select and passed to the hat.
    items: { type: Array, required: true },
    puntable: { type: Boolean, default: false },
    // Plain-language provenance for the hat: "use plain language to label why
    // that movie went into the hat" (2026-08-17). Every list on this screen
    // supplies its own, so a draw can say it came from the rewatch pile or
    // from a director you love.
    hatNote: { type: String, default: null }
  },
  emits: ['select', 'punt', 'hatted'],
  methods: {
    // Hand back the ORIGINAL sources, not the hat payloads: the screen punts
    // by dbKey where it has one, and toHatMovie has already thrown that away.
    onAdded (added, sources) {
      const addedIds = new Set(added.map((movie) => movie.id));
      this.$emit('hatted', (sources || []).filter((source) => {
        const id = source?.movie?.id ?? source?.id;
        return addedIds.has(id);
      }));
    }
  }
};
</script>

<style lang="scss" scoped>
.watchlist-row {
  display: flex;
  gap: 0.5rem;
  /* Sideways rather than a wall: a section is one row tall however many
     movies are in it. */
  overflow-x: auto;
  padding-bottom: 0.25rem;
  -webkit-overflow-scrolling: touch;
}

.watchlist-card {
  flex: 0 0 auto;
  position: relative;
  width: 104px;
}

.watchlist-poster {
  border-radius: 4px;
  display: block;
  /* Fixed height with the poster's own aspect ratio, so every image in the
     row lines up top AND bottom regardless of what TMDB returns. */
  height: 156px;
  object-fit: cover;
  width: 104px;
}

.watchlist-poster-blank {
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

/* Top-right, the same corner as every other hat button in the app. */
.watchlist-card-actions {
  display: flex;
  gap: 0.25rem;
  position: absolute;
  right: 4px;
  top: 4px;
}

/* In the meta line now, not over the artwork. Same "small to look at, big to
   tap" split the poster buttons use: a 40px target (the house minimum — see
   .claude/rules/vue-ui.md) around a glyph small enough to read as part of the
   caption. Negative margins keep the oversized target from padding the row
   out; it overhangs the card's own gutter, not the poster above, so it can't
   swallow a tap meant for the artwork. */
.punt-btn {
  align-items: center;
  background: none;
  border: none;
  color: #8a8a8a;
  display: flex;
  flex: 0 0 auto;
  height: 40px;
  justify-content: center;
  margin: -12px -10px -12px 0;
  padding: 0;
  width: 40px;
}

.punt-btn i {
  font-size: 0.8rem;
  line-height: 1;
}

/* Mobile-first: press feedback only, never a hover state that sticks. */
.punt-btn:active {
  color: #fff;
}

.watchlist-meta {
  align-items: flex-start;
  /* #b9b9b9 on the page background is ~8:1. */
  color: #b9b9b9;
  display: flex;
  font-size: 0.68rem;
  gap: 0.2rem;
  justify-content: space-between;
  line-height: 1.25;
  margin-top: 0.25rem;
}

/* Never clamped — a long meta line just wraps and the card gets taller
   (Matt's poster-row rule). min-width: 0 so it can actually wrap instead of
   forcing the flex row wider than the card. */
.watchlist-meta-text {
  min-width: 0;
}

.watchlist-row-bulk {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.4rem;
  /* Demoted: the per-poster buttons are the everyday action. */
  opacity: 0.75;
}
</style>

<template>
  <div class="library-poster-screen">
    <BackLink label="Home" @click="$router.push('/')"/>
    <h1 class="poster-title">Library Poster</h1>
    <p class="poster-subtitle">Turn your library into one big printable poster of all your little posters.</p>

    <div class="poster-options">
      <button
        v-for="option in modes"
        :key="option.mode"
        type="button"
        class="poster-mode"
        :class="{ selected: mode === option.mode }"
        :disabled="generating"
        @click="mode = option.mode"
      >
        {{ option.label }}
      </button>
    </div>
    <p class="poster-count-line">{{ selectedEntries.length }} movie{{ selectedEntries.length === 1 ? '' : 's' }} · {{ layoutLabel }}</p>

    <button
      type="button"
      class="btn-game btn-game-primary generate-btn"
      :disabled="generating || !selectedEntries.length"
      @click="generate"
    >
      {{ generating ? `Building… ${progress}/${selectedEntries.length}` : 'Make my poster' }}
    </button>

    <p v-if="error" class="poster-error">{{ error }}</p>

    <div v-if="resultUrl" class="poster-result">
      <!-- The rendered artifact. On iOS the reliable "save this" path is the
           share sheet (button below) or long-pressing the image itself. -->
      <img :src="resultUrl" alt="Your library poster" class="poster-image">
      <div class="poster-actions">
        <button v-if="canShare" type="button" class="btn-game btn-game-primary" @click="share">Save / Share</button>
        <p class="poster-hint">{{ canShare ? 'Or long-press the image to save it.' : 'Long-press (or right-click) the image to save it.' }}</p>
      </div>
    </div>
  </div>
</template>

<script>
// Bug-report request: "produce some kind of actual like printable artifact
// something like when you reach 100 movies you can make a poster of all
// your little posters." Selection and grid math are pure
// (posterArtifact.js); this component draws the canvas and hands the PNG to
// the share sheet. Poster tiles load with crossOrigin so the canvas stays
// exportable — TMDB sends CORS headers (the same reliance Poster Zoom's
// pixel sampling already has).
import BackLink from './games/BackLink.vue';
import { getRating } from '../assets/javascript/GetRating.js';
import { pickPosterEntries, gridLayout, tilePosition, posterCaption } from '../assets/javascript/posterArtifact.js';

const TILE_SOURCE_SIZE = 'w185';
const LOAD_CONCURRENCY = 12;

export default {
  name: 'LibraryPoster',
  components: { BackLink },
  data () {
    return {
      mode: 'top',
      generating: false,
      progress: 0,
      resultUrl: null,
      error: null
    };
  },
  computed: {
    library () {
      return this.$store.getters.allMoviesAsArray || [];
    },
    modes () {
      return [
        { mode: 'top', label: 'My top 100' },
        { mode: 'year', label: 'This year' },
        { mode: 'all', label: 'Everything' }
      ];
    },
    selectedEntries () {
      return pickPosterEntries(this.library, this.mode, getRating);
    },
    layout () {
      return gridLayout(this.selectedEntries.length);
    },
    layoutLabel () {
      return this.layout ? `${this.layout.cols} × ${this.layout.rows} grid` : 'nothing to show yet';
    },
    canShare () {
      return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    }
  },
  beforeUnmount () {
    if (this.resultUrl) URL.revokeObjectURL(this.resultUrl);
  },
  methods: {
    loadTile (path) {
      return new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        // A dead poster URL becomes a dark tile rather than a failed poster.
        image.onerror = () => resolve(null);
        image.src = `https://image.tmdb.org/t/p/${TILE_SOURCE_SIZE}${path}`;
      });
    },
    async generate () {
      const entries = this.selectedEntries;
      const layout = this.layout;
      if (!entries.length || !layout || this.generating) return;

      this.generating = true;
      this.progress = 0;
      this.error = null;
      if (this.resultUrl) {
        URL.revokeObjectURL(this.resultUrl);
        this.resultUrl = null;
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = layout.width;
        canvas.height = layout.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('canvas unavailable');

        context.fillStyle = '#141414';
        context.fillRect(0, 0, layout.width, layout.height);

        // Small worker pool — the service worker's CacheFirst rule for TMDB
        // images makes most of these instant after first view.
        let nextIndex = 0;
        const drawOne = async () => {
          while (nextIndex < entries.length) {
            const index = nextIndex++;
            const entry = entries[index];
            const tile = await this.loadTile(entry.movie.poster_path);
            const { x, y } = tilePosition(index, layout);
            if (tile) {
              context.drawImage(tile, x, y, layout.tileW, layout.tileH);
            } else {
              context.fillStyle = '#2a2a2a';
              context.fillRect(x, y, layout.tileW, layout.tileH);
            }
            this.progress += 1;
          }
        };
        await Promise.all(Array.from({ length: Math.min(LOAD_CONCURRENCY, entries.length) }, drawOne));

        context.fillStyle = '#ffc107';
        context.font = `${Math.max(24, Math.round(layout.width / 40))}px Georgia, serif`;
        context.textAlign = 'center';
        context.fillText(posterCaption(this.mode, entries.length), layout.width / 2, layout.height - layout.footer / 2);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('could not export the poster');
        this.resultBlob = blob;
        this.resultUrl = URL.createObjectURL(blob);
      } catch (error) {
        console.error('Poster generation failed:', error);
        this.error = "Couldn't build the poster — try again, or try a smaller selection.";
      } finally {
        this.generating = false;
      }
    },
    async share () {
      if (!this.resultBlob) return;
      try {
        const file = new File([this.resultBlob], 'cinema-roll-poster.png', { type: 'image/png' });
        if (navigator.canShare && !navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'Cinema Roll poster' });
          return;
        }
        await navigator.share({ files: [file], title: 'Cinema Roll poster' });
      } catch (error) {
        // Dismissing the share sheet rejects — nothing to surface.
        if (error?.name !== 'AbortError') console.error('Share failed:', error);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import '@/assets/scss/game-buttons';

.library-poster-screen {
  color: #eee;
  padding: 2.5rem 1rem 2rem;
  text-align: center;
}

.poster-title {
  margin: 0.5rem 0 0;
}

.poster-subtitle {
  color: #adb5bd;
  font-size: 0.85rem;
  margin: 0.25rem auto 1.25rem;
  max-width: 26rem;
}

.poster-options {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.poster-mode {
  background: rgba(255, 255, 255, 0.04);
  border: 1.5px solid #333;
  border-radius: 999px;
  color: #eee;
  font-size: 0.85rem;
  padding: 0.4rem 0.9rem;
}

.poster-mode.selected {
  border-color: #ffc107;
  color: #ffc107;
}

/* Mobile-first: press state, no hover. */
.poster-mode:active:not(:disabled) {
  opacity: 0.7;
}

.poster-count-line {
  color: #adb5bd;
  font-size: 0.8rem;
  margin: 0.5rem 0 1rem;
}

.generate-btn {
  margin: 0 auto;
  max-width: 320px;
  width: 100%;
}

.poster-error {
  color: #ff6a6a;
  font-size: 0.85rem;
  margin-top: 0.75rem;
}

.poster-result {
  margin-top: 1.25rem;
}

.poster-image {
  border: 1px solid #333;
  border-radius: 0.35rem;
  max-width: 100%;
}

.poster-actions {
  margin-top: 0.75rem;
}

.poster-hint {
  color: #adb5bd;
  font-size: 0.75rem;
  margin-top: 0.5rem;
}
</style>

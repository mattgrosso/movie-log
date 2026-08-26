<template>
  <div class="person-modal-overlay" @click.self="$emit('close')">
    <div class="person-modal" role="dialog" :aria-label="person.name">
      <button class="close-btn" @click="$emit('close')" aria-label="Close">&times;</button>

      <header class="person-head">
        <!-- Two tags rather than one with a computed src: the fallback is a
             bundled asset, and only the template compiler resolves that path
             (a require() in script is a webpack-only trick that breaks the
             moment the component is mounted outside webpack). -->
        <img
          v-if="portraitUrl"
          :src="portraitUrl"
          :alt="person.name"
          class="person-portrait"
        />
        <img
          v-else
          src="../assets/images/Image_not_available.png"
          :alt="person.name"
          class="person-portrait"
        />
        <div class="person-titles">
          <h2>{{ person.name }}</h2>
          <p class="person-role">
            {{ roleLabel }}<template v-if="rankLabel"> · {{ rankLabel }}</template>
          </p>
          <p v-if="lifeLine" class="person-life">{{ lifeLine }}</p>
        </div>
      </header>

      <!-- Their numbers, in your library — not TMDB's. -->
      <div class="person-stats">
        <div class="person-stat">
          <span class="person-stat-value">{{ films.length }}</span>
          <span class="person-stat-label">{{ films.length === 1 ? 'film' : 'films' }}</span>
        </div>
        <div class="person-stat">
          <span class="person-stat-value">{{ averageLabel }}</span>
          <span class="person-stat-label">your average</span>
        </div>
        <div v-if="versusLibrary" class="person-stat">
          <span class="person-stat-value">{{ versusLibrary }}</span>
          <span class="person-stat-label">vs your library</span>
        </div>
      </div>

      <!-- Biography. TMDB's search endpoint doesn't carry one, so this is a
           lazy /person/{id} lookup made only when a modal actually opens. -->
      <section v-if="bioLoading" class="person-bio person-bio-loading">Looking them up…</section>
      <section v-else-if="biography" class="person-bio">
        <p :class="{ clamped: !bioExpanded }">{{ biography }}</p>
        <button v-if="bioIsLong" class="bio-toggle" @click="bioExpanded = !bioExpanded">
          {{ bioExpanded ? 'Less' : 'More' }}
        </button>
      </section>

      <section class="person-films">
        <h3>Their films, best first</h3>
        <div class="person-poster-row">
          <button
            v-for="film in films"
            :key="film.dbKey || film.movie.id"
            type="button"
            class="person-poster-card"
            @click="$emit('select-film', film)"
          >
            <img
              v-if="film.movie.poster_path"
              :src="`https://image.tmdb.org/t/p/w185${film.movie.poster_path}`"
              :alt="film.movie.title"
            />
            <span v-else class="person-poster-fallback">{{ film.movie.title }}</span>
            <span class="person-film-title">{{ film.movie.title }}</span>
            <span class="person-film-score">{{ scoreFor(film) }}</span>
          </button>
        </div>
      </section>

      <button class="search-btn" @click="$emit('search')">Search the library for them</button>
    </div>
  </div>
</template>

<script>
// One modal for all eight Favorite sections. Each of them used to carry its
// own near-identical copy, which is how they drifted apart — inline styles on
// the portrait in some, none in others, and the credits list never sorted.
// Bug report 2026-08-25: "it opens up this modal that I made a long time ago.
// That really doesn't look nice... do a better job of de-duping the list of
// credits and making sure they [line up] and just generally rework this whole
// modal." Plus, from the design pass: "even better if you can get bio info
// from somewhere."
import { getRating } from '../assets/javascript/GetRating.js';
import { formatScore } from '../assets/javascript/formatScore.js';
import ErrorLogService from '../services/ErrorLogService.js';

// Long enough that the clamp is doing real work; short enough that most
// people's whole biography fits without a tap.
const LONG_BIO_CHARS = 320;

// name -> details, shared across every section for the life of the page. The
// same person shows up in more than one list (a writer-director), and a
// second lookup for a biography that never changes is pure waste.
const bioCache = new Map();

export default {
  name: 'PersonModal',
  props: {
    // { name, entries, count, finalScore, details } — the shape every
    // Favorite section's rescore() already produces.
    person: { type: Object, required: true },
    // "Composer", "Actor" — what this list is a list of.
    roleLabel: { type: String, default: '' },
    // Where they sit in this list, and how long it is.
    rank: { type: Number, default: null },
    rankOf: { type: Number, default: null },
    // The library-wide average, so "vs your library" means something. Passed
    // in rather than recomputed: the sections already have it.
    libraryAverage: { type: Number, default: null }
  },
  emits: ['close', 'search', 'select-film'],
  data () {
    return {
      biography: '',
      birthday: null,
      deathday: null,
      placeOfBirth: '',
      bioLoading: false,
      bioExpanded: false
    };
  },
  computed: {
    portraitUrl () {
      const path = this.person?.details?.profile_path;
      return path ? `https://image.tmdb.org/t/p/w185${path}` : '';
    },
    rankLabel () {
      if (!this.rank) return '';
      return this.rankOf ? `#${this.rank} of ${this.rankOf}` : `#${this.rank}`;
    },
    // Best first — the old list was alphabetical, which buries the reason
    // this person is on the list at all.
    films () {
      return [...(this.person?.entries || [])].sort((a, b) => {
        const scoreA = parseFloat(getRating(a)?.calculatedTotal);
        const scoreB = parseFloat(getRating(b)?.calculatedTotal);
        if (Number.isNaN(scoreA)) return 1;
        if (Number.isNaN(scoreB)) return -1;
        return scoreB - scoreA;
      });
    },
    scoredFilms () {
      return this.films
        .map((film) => parseFloat(getRating(film)?.calculatedTotal))
        .filter((score) => !Number.isNaN(score));
    },
    average () {
      if (!this.scoredFilms.length) return null;
      return this.scoredFilms.reduce((sum, score) => sum + score, 0) / this.scoredFilms.length;
    },
    averageLabel () {
      return formatScore(this.average);
    },
    // The comparison that makes the average readable. Signed, because "0.42
    // above" and "0.42 below" are opposite facts about a person.
    versusLibrary () {
      if (this.average == null || !Number.isFinite(this.libraryAverage)) return '';
      const delta = this.average - this.libraryAverage;
      const sign = delta >= 0 ? '+' : '−';
      return `${sign}${formatScore(Math.abs(delta))}`;
    },
    lifeLine () {
      const parts = [];
      if (this.birthday) {
        parts.push(this.deathday
          ? `${this.year(this.birthday)}–${this.year(this.deathday)}`
          : `b. ${this.year(this.birthday)}`);
      }
      if (this.placeOfBirth) parts.push(this.placeOfBirth);
      return parts.join(' · ');
    },
    bioIsLong () {
      return this.biography.length > LONG_BIO_CHARS;
    }
  },
  mounted () {
    document.body.classList.add('no-scroll');
    this.loadBiography();
  },
  beforeUnmount () {
    document.body.classList.remove('no-scroll');
  },
  methods: {
    year (date) {
      const parsed = new Date(date);
      return Number.isNaN(parsed.getTime()) ? '' : parsed.getUTCFullYear();
    },
    scoreFor (film) {
      return formatScore(parseFloat(getRating(film)?.calculatedTotal));
    },
    // A failed lookup is silent on screen: the biography is a nicety, and the
    // films are the reason the modal exists. Never blocks the rest rendering.
    async loadBiography () {
      const id = this.person?.details?.id;
      const name = this.person?.name;
      if (!id || !name) return;

      if (bioCache.has(name)) {
        this.applyDetails(bioCache.get(name));
        return;
      }

      this.bioLoading = true;
      try {
        const url = `https://api.themoviedb.org/3/person/${id}?api_key=${process.env.VUE_APP_TMDB_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`TMDB person ${id} returned ${response.status}`);
        const details = await response.json();
        bioCache.set(name, details);
        this.applyDetails(details);
      } catch (error) {
        // Cache the miss too, so a rate-limited lookup isn't retried on every
        // open of the same person.
        bioCache.set(name, null);
        ErrorLogService.error('Error fetching TMDB biography:', error);
      } finally {
        this.bioLoading = false;
      }
    },
    applyDetails (details) {
      if (!details) return;
      this.biography = (details.biography || '').trim();
      this.birthday = details.birthday || null;
      this.deathday = details.deathday || null;
      this.placeOfBirth = details.place_of_birth || '';
    }
  }
};
</script>

<style lang="scss">
.person-modal-overlay {
  align-items: center;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  height: 100vh;
  justify-content: center;
  left: 0;
  position: fixed;
  top: 0;
  width: 100vw;
  z-index: 1000;
}

.person-modal {
  background: #161616;
  border: 1px solid #2e2e2e;
  border-radius: 12px;
  color: #fff;
  max-height: 88vh;
  max-width: min(92vw, 520px);
  overflow-y: auto;
  padding: 1.5rem;
  position: relative;
  width: 100%;

  .close-btn {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 1.75rem;
    line-height: 1;
    // 40px minimum tap target, per the house rule.
    height: 40px;
    width: 40px;
    position: absolute;
    right: 0.4rem;
    top: 0.4rem;

    &:active {
      opacity: 0.6;
    }
  }

  // Portrait and text aligned to a shared top edge, the same rule the poster
  // rows follow — the old modal centred a floating portrait with inline
  // styles and the text drifted around it.
  .person-head {
    align-items: flex-start;
    display: flex;
    gap: 1rem;
    margin-bottom: 1.1rem;
    padding-right: 2.5rem;

    .person-portrait {
      border-radius: 8px;
      flex: 0 0 auto;
      height: 108px;
      object-fit: cover;
      width: 72px;
    }

    .person-titles {
      min-width: 0;

      h2 {
        font-size: 1.35rem;
        line-height: 1.2;
        margin: 0 0 0.3rem;
      }

      .person-role {
        color: #ccc;
        font-size: 0.85rem;
        margin: 0;
      }

      .person-life {
        color: #999;
        font-size: 0.8rem;
        margin: 0.2rem 0 0;
      }
    }
  }

  .person-stats {
    background: #1e1e1e;
    border-radius: 8px;
    display: flex;
    margin-bottom: 1.1rem;
    padding: 0.7rem 0.5rem;

    .person-stat {
      align-items: center;
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.15rem;
      // Divider between figures rather than around them.
      & + .person-stat {
        border-left: 1px solid #2e2e2e;
      }

      .person-stat-value {
        font-size: 1.15rem;
        font-weight: 600;
      }

      .person-stat-label {
        color: #999;
        font-size: 0.68rem;
        letter-spacing: 0.03em;
        text-align: center;
        text-transform: uppercase;
      }
    }
  }

  .person-bio {
    color: #ccc;
    font-size: 0.85rem;
    line-height: 1.5;
    margin-bottom: 1.2rem;

    p {
      margin: 0;

      &.clamped {
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 4;
        display: -webkit-box;
        overflow: hidden;
      }
    }

    .bio-toggle {
      background: none;
      border: none;
      color: #6ea8fe;
      cursor: pointer;
      font-size: 0.8rem;
      margin-top: 0.3rem;
      padding: 0.35rem 0;
    }
  }

  .person-bio-loading {
    color: #999;
    font-style: italic;
  }

  .person-films {
    h3 {
      color: #ccc;
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      margin-bottom: 0.6rem;
      text-transform: uppercase;
    }
  }

  // Fixed image height + flex-start, so every poster's top AND bottom edge
  // lines up and only the titles below them grow. Titles are never clamped —
  // the cards just get taller (house rule, 2026-08-15).
  .person-poster-row {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    overflow-x: auto;
    padding-bottom: 0.4rem;

    .person-poster-card {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      display: flex;
      flex: 0 0 84px;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0;
      text-align: left;
      width: 84px;

      &:active {
        opacity: 0.7;
      }

      img,
      .person-poster-fallback {
        border-radius: 6px;
        height: 126px;
        object-fit: cover;
        width: 84px;
      }

      .person-poster-fallback {
        align-items: center;
        background: #2a2a2a;
        color: #ccc;
        display: flex;
        font-size: 0.6rem;
        justify-content: center;
        padding: 0.3rem;
        text-align: center;
      }

      .person-film-title {
        font-size: 0.72rem;
        line-height: 1.25;
      }

      .person-film-score {
        color: #999;
        font-family: 'Courier New', monospace;
        font-size: 0.7rem;
      }
    }
  }

  .search-btn {
    background: #1976d2;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    font-size: 0.9rem;
    margin-top: 1.2rem;
    padding: 0.7rem 1.2rem;
    width: 100%;

    &:active {
      background: #145ea8;
    }
  }
}
</style>

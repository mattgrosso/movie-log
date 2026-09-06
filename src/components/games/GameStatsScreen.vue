<template>
  <div class="game-stats-screen" :class="{ settled }" @click="settle">
    <BackLink/>
    <h1 class="ds-title">Game Stats</h1>
    <p class="ds-subtitle">Every round you've played, interrogated.</p>

    <div v-if="!overall" class="no-stats">
      <p>No rounds recorded yet — finish a round of any game and it'll show up here.</p>
    </div>

    <template v-else>
      <!-- The Scoreboard: every game at once. Numbers count up on arrival
           (drama on reveals), the streak tile runs hot. -->
      <section class="ds-section scoreboard staged" :style="stage(0)">
        <h2 class="ds-section-title">The Scoreboard</h2>
        <p class="ds-section-caption">Everything you've played, across {{ overall.gamesPlayed }} game{{ overall.gamesPlayed === 1 ? '' : 's' }}.</p>
        <div class="ds-strip">
          <div class="ds-strip-item">
            <span class="ds-strip-value">{{ shown.rounds }}</span>
            <span class="ds-strip-label">round{{ overall.rounds === 1 ? '' : 's' }}</span>
          </div>
          <div class="ds-strip-item">
            <span class="ds-strip-value">{{ shown.sessions }}</span>
            <span class="ds-strip-label">session{{ overall.sessions === 1 ? '' : 's' }}</span>
          </div>
          <div class="ds-strip-item">
            <span class="ds-strip-value">{{ shown.daysPlayed }}</span>
            <span class="ds-strip-label">day{{ overall.daysPlayed === 1 ? '' : 's' }} played</span>
          </div>
          <div v-if="overall.streak >= 2" class="ds-strip-item hot">
            <span class="ds-strip-value">{{ shown.streak }}</span>
            <span class="ds-strip-label">day streak</span>
          </div>
        </div>
        <ul class="callouts">
          <li v-if="overall.streak >= 2" class="callout hot">
            <i class="bi bi-fire"></i>
            <span>On a hot streak — {{ overall.streak }} days in a row with a round played.</span>
          </li>
          <li v-if="overall.favourite" class="callout">
            <i :class="['bi', iconFor(overall.favourite.key)]"></i>
            <span>Favourite game: <strong>{{ overall.favourite.name }}</strong>, {{ overall.favourite.sessions }} session{{ overall.favourite.sessions === 1 ? '' : 's' }}.</span>
          </li>
          <li v-if="overall.wonToday" class="callout">
            <i class="bi bi-check-circle-fill won"></i>
            <span>Won today: <strong>{{ overall.wonToday }}</strong> of {{ totalGames }} games.</span>
          </li>
          <li v-if="overall.busiest && overall.busiest.rounds >= 3" class="callout">
            <i class="bi bi-lightning-charge-fill"></i>
            <span>Biggest day: <strong>{{ overall.busiest.rounds }} rounds</strong> on {{ overall.busiest.label }}.</span>
          </li>
          <li v-if="overall.first" class="callout">
            <i class="bi bi-calendar-event"></i>
            <span>Playing since {{ day(overall.first) }}<template v-if="overall.latest"> · last round {{ ago(overall.latest) }}</template>.</span>
          </li>
        </ul>
      </section>

      <!-- One card per game, most-played first. Each carries its own banner
           art (the hub's tiles), a headline sentence, the numbers, a form
           strip, habits, and — where a game records which movie it was —
           the posters that got away and the ones you nailed. -->
      <section
        v-for="(game, index) in gamesWithData"
        :key="game.key"
        class="ds-section game-card staged"
        :style="stage(index + 1)"
      >
        <div class="game-banner">
          <img :src="game.banner" :alt="game.name" class="game-banner-image" loading="lazy">
        </div>
        <div class="game-head">
          <i :class="['bi', game.icon]"></i>
          <span class="game-name">{{ game.name }}</span>
          <span class="game-meta">
            {{ game.plays }} session{{ game.plays === 1 ? '' : 's' }}<template v-if="game.rounds"> · {{ game.rounds }} round{{ game.rounds === 1 ? '' : 's' }}</template>
          </span>
        </div>

        <p v-if="game.headline" class="game-headline">{{ game.headline }}</p>
        <p v-else class="game-pending">Rounds finished from here on will be recorded.</p>

        <div v-if="game.record || game.stats.length || game.streaks" class="ds-strip">
          <div v-if="game.record" class="ds-strip-item record">
            <span class="ds-strip-value">{{ game.record.label }}</span>
            <span class="ds-strip-label">personal best<template v-if="game.record.at"> · {{ day(game.record.at) }}</template></span>
          </div>
          <div v-for="line in game.stats" :key="line.label" class="ds-strip-item">
            <span class="ds-strip-value">{{ line.value }}</span>
            <span class="ds-strip-label">{{ line.label }}</span>
          </div>
          <div v-if="game.streaks && game.streaks.best" class="ds-strip-item">
            <span class="ds-strip-value">{{ game.streaks.best }}</span>
            <span class="ds-strip-label">best win streak</span>
          </div>
          <div v-if="game.streaks && game.streaks.currentIsWins && game.streaks.current >= 2" class="ds-strip-item hot">
            <span class="ds-strip-value">{{ game.streaks.current }}</span>
            <span class="ds-strip-label">wins running</span>
          </div>
        </div>

        <div v-if="game.series.length >= 2" class="form">
          <h3 class="pantheon-label">Form <span class="pantheon-count">oldest to newest · taller is better</span></h3>
          <div class="form-bars" :aria-label="`${game.series.length} rounds`">
            <span
              v-for="(bar, position) in game.series"
              :key="`${game.key}-bar-${position}`"
              class="form-bar"
              :class="{ best: bar.best, lost: !bar.won }"
              :style="{ height: `${Math.max(bar.height * 100, bar.won ? 8 : 4)}%` }"
              :title="barTitle(bar)"
            ></span>
          </div>
          <p v-if="game.trend" class="ds-section-caption form-caption" :class="`trend-${game.trend.verdict}`">{{ game.trendText }}</p>
        </div>

        <p v-if="game.habitsText" class="habits">
          <i class="bi bi-clock"></i>
          <span>{{ game.habitsText }}</span>
        </p>

        <template v-if="game.movies.stumped.length">
          <h3 class="pantheon-label">The ones that got away</h3>
          <div class="ds-poster-row">
            <div
              v-for="item in game.movies.stumped"
              :key="`${game.key}-s-${item.entry.dbKey}`"
              class="ds-poster-card"
              role="button"
              :aria-label="item.entry.movie.title"
              @click="goToMovie(item.entry)"
            >
              <img v-if="item.entry.movie.poster_path" :src="poster(item.entry)" :alt="item.entry.movie.title" class="ds-poster">
              <div v-else class="ds-poster ds-poster-blank">{{ item.entry.movie.title }}</div>
              <span class="ds-poster-note">beat you {{ item.count === 1 ? 'once' : `${item.count} times` }}</span>
            </div>
          </div>
        </template>

        <template v-if="game.movies.nailed.length">
          <h3 class="pantheon-label">Nailed it</h3>
          <div class="ds-poster-row">
            <div
              v-for="item in game.movies.nailed"
              :key="`${game.key}-n-${item.entry.dbKey}-${item.at}`"
              class="ds-poster-card"
              role="button"
              :aria-label="item.entry.movie.title"
              @click="goToMovie(item.entry)"
            >
              <img v-if="item.entry.movie.poster_path" :src="poster(item.entry)" :alt="item.entry.movie.title" class="ds-poster">
              <div v-else class="ds-poster ds-poster-blank">{{ item.entry.movie.title }}</div>
              <span class="ds-poster-note gold">{{ item.label }}</span>
            </div>
          </div>
        </template>

        <!-- Newest first, capped — the original "history" strip. -->
        <div v-if="game.recentRounds.length" class="recent-rounds">
          <span
            v-for="(round, position) in game.recentRounds"
            :key="`${game.key}-${position}`"
            class="round-chip"
          >{{ round }}</span>
        </div>
      </section>
    </template>
  </div>
</template>

<script>
// Game Stats (/games/stats). First built for "let's add a history for each
// game with some good statistics on how they've gone"; rebuilt 2026-09-06
// for "more fun stats... more in-depth numbers of the different games and
// make the whole page just look more fun" — now a sibling of Deep Stats,
// using its section/strip/poster-row language. All computation is pure in
// gameStats.js / gameHistory.js; this screen only renders.
//
// Deliberately does NOT use the gameData mixin — its created() counts a
// play session for any /games/* route, and looking at stats is not playing.
import BackLink from './BackLink.vue';
import { GAME_ICONS, GAME_NAMES } from '../../mixins/gameData.js';
import { summarizeGame, formatRound } from '../../assets/javascript/games/gameHistory.js';
import {
  overallStats, personalRecord, recentTrend, trendSentence, formSeries, winStreaks, habits, movieFacts, headline, formatDay, toRecords
} from '../../assets/javascript/games/gameStats.js';
import { timeAgo } from '../../assets/javascript/timeAgo.js';

// The hub's tile art, one per game — the card wears the game's own colours.
import higherLowerBanner from '../../assets/images/games/higher-lower-banner.jpg';
import reelWordleBanner from '../../assets/images/games/reel-wordle-banner.jpg';
import connectionsBanner from '../../assets/images/games/connections-banner.jpg';
import sixDegreesBanner from '../../assets/images/games/six-degrees-banner.jpg';
import timelineBanner from '../../assets/images/games/timeline-banner.jpg';
import clueBudgetBanner from '../../assets/images/games/clue-budget-banner.jpg';
import tagBanner from '../../assets/images/games/tag-banner.jpg';
import triviaBanner from '../../assets/images/games/trivia-banner.jpg';
import stampBanner from '../../assets/images/games/stamp-banner.jpg';
import posterZoomBanner from '../../assets/images/games/poster-zoom-banner.jpg';
import cineplexityBanner from '../../assets/images/games/cineplexity-banner.svg';

const BANNERS = {
  'higher-lower': higherLowerBanner,
  wordle: reelWordleBanner,
  connections: connectionsBanner,
  'six-degrees': sixDegreesBanner,
  timeline: timelineBanner,
  'clue-budget': clueBudgetBanner,
  tagline: tagBanner,
  trivia: triviaBanner,
  stamp: stampBanner,
  'poster-zoom': posterZoomBanner,
  cineplexity: cineplexityBanner
};

const RECENT_ROUNDS_SHOWN = 8;
// The scoreboard's count-up. Long enough to be a moment, short enough that
// nobody waits for it; a tap anywhere lands everything instantly.
export const COUNT_UP_MS = 900;
// Cards arrive one after another; this is the gap.
export const STAGE_STEP_MS = 110;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export default {
  name: 'GameStatsScreen',
  components: { BackLink },
  data () {
    return {
      // Set by a tap (or reduced motion): no stagger, no count-up.
      settled: false,
      shown: { rounds: 0, sessions: 0, daysPlayed: 0, streak: 0 },
      countUpFrame: null
    };
  },
  computed: {
    games () {
      return this.$store.state.settings?.games || {};
    },
    names () {
      const names = {};
      Object.entries(GAME_NAMES).forEach(([path, name]) => { names[path.slice('/games/'.length)] = name; });
      return names;
    },
    totalGames () {
      return Object.keys(GAME_NAMES).length;
    },
    overall () {
      return overallStats(this.games, this.names);
    },
    gamesWithData () {
      const plays = this.games.plays || {};
      const history = this.games.history || {};

      return Object.entries(GAME_NAMES)
        .map(([path, name]) => {
          const key = path.slice('/games/'.length);
          const records = toRecords(history[key]);
          const trend = recentTrend(key, records);
          const record = personalRecord(key, records);
          return {
            key,
            name,
            icon: GAME_ICONS[path],
            banner: BANNERS[key],
            plays: plays[key] || 0,
            rounds: records.length,
            headline: headline(key, records),
            record,
            // The personal-best tile already says it; drop the summary's
            // own "Best ..." line rather than show the same number twice.
            stats: summarizeGame(key, records).filter((line) => !(record && /^(Best|Fastest)/.test(line.label))),
            streaks: winStreaks(key, records),
            series: formSeries(key, records),
            trend,
            trendText: trendSentence(key, trend),
            habitsText: this.habitsSentence(habits(records)),
            movies: movieFacts(key, records, this.resolveMovie),
            recentRounds: [...records]
              .slice(-RECENT_ROUNDS_SHOWN)
              .reverse()
              .map((record) => formatRound(key, record))
          };
        })
        .filter((game) => game.plays > 0 || game.rounds > 0)
        // Most-played first, matching the hub's own ordering logic.
        .sort((a, b) => b.plays - a.plays);
    }
  },
  watch: {
    overall: {
      immediate: true,
      handler (overall) {
        this.startCountUp(overall);
      }
    }
  },
  beforeUnmount () {
    this.cancelCountUp();
  },
  methods: {
    iconFor (key) {
      return GAME_ICONS[`/games/${key}`] || 'bi-controller';
    },
    stage (index) {
      return { '--stage': index };
    },
    day (timestamp) {
      return formatDay(timestamp);
    },
    ago (timestamp) {
      return timeAgo(timestamp);
    },
    barTitle (bar) {
      const when = bar.at ? formatDay(bar.at) : '';
      if (!bar.won) return when ? `lost · ${when}` : 'lost';
      return when ? `${bar.value} · ${when}` : String(bar.value);
    },
    habitsSentence (habit) {
      if (!habit) return null;
      const parts = [];
      if (habit.weekday && habit.slot) parts.push(`Mostly ${habit.weekday} ${habit.slot}.`);
      else if (habit.weekday) parts.push(`Mostly ${habit.weekday}s.`);
      else if (habit.slot) parts.push(`Mostly ${habit.slot}.`);
      const span = [`First played ${formatDay(habit.first)}`];
      const latest = timeAgo(habit.latest);
      if (latest && habit.latest !== habit.first) span.push(`last ${latest}`);
      if (habit.daysPlayed > 1) span.push(`${habit.daysPlayed} days`);
      parts.push(`${span.join(' · ')}.`);
      return parts.join(' ');
    },
    // A round's stored movie key back to a library entry — null once the
    // movie has left the library, and the fact is dropped with it.
    resolveMovie (dbKey) {
      const entry = this.$store.state.movieLog?.[dbKey];
      return entry?.movie ? { ...entry, dbKey } : null;
    },
    poster (entry) {
      return `https://image.tmdb.org/t/p/w342${entry.movie.poster_path}`;
    },
    goToMovie (entry) {
      if (entry?.movie?.id == null) return;
      this.$router.push(`/movie/${entry.movie.id}`);
    },
    prefersReducedMotion () {
      try {
        return typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        return true;
      }
    },
    // The four scoreboard numbers rise from zero over COUNT_UP_MS. Reduced
    // motion (or an environment without matchMedia — jsdom) lands them
    // immediately; so does a tap.
    startCountUp (overall) {
      this.cancelCountUp();
      if (!overall) return;
      const target = { rounds: overall.rounds, sessions: overall.sessions, daysPlayed: overall.daysPlayed, streak: overall.streak };
      if (this.settled || this.prefersReducedMotion() || typeof window.requestAnimationFrame !== 'function') {
        this.shown = target;
        return;
      }
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / COUNT_UP_MS);
        const eased = easeOut(progress);
        this.shown = {
          rounds: Math.round(target.rounds * eased),
          sessions: Math.round(target.sessions * eased),
          daysPlayed: Math.round(target.daysPlayed * eased),
          streak: Math.round(target.streak * eased)
        };
        this.countUpFrame = progress < 1 ? window.requestAnimationFrame(tick) : null;
      };
      this.countUpFrame = window.requestAnimationFrame(tick);
    },
    cancelCountUp () {
      if (this.countUpFrame != null && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(this.countUpFrame);
      }
      this.countUpFrame = null;
    },
    // Skip the theatre: everything lands now.
    settle () {
      if (this.settled) return;
      this.settled = true;
      this.startCountUp(this.overall);
    }
  }
};
</script>

<style lang="scss" scoped>
.game-stats-screen {
  color: #eee;
  /* Safety margin against BackLink overlap — same as every game screen. */
  padding: 2.5rem 1rem 2rem;
}

.ds-title { margin: 0.25rem 0 0; }
.ds-subtitle { color: #ccc; font-size: 0.85rem; margin: 0.25rem 0 1rem; }

.no-stats {
  color: #ccc;
  margin-top: 2rem;
  text-align: center;
}

/* Deep Stats' section and strip, verbatim, so the two screens read as one
   family. */
.ds-section {
  background: #161616;
  border: 1px solid #2e2e2e;
  border-radius: 10px;
  margin-bottom: 1rem;
  overflow: hidden;
  padding: 0.9rem 1rem;
}

.ds-section-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.25rem; }
.ds-section-caption { color: #ccc; font-size: 0.78rem; margin: 0 0 0.75rem; }

.ds-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.ds-strip-item {
  background: #101010;
  border: 1px solid #2e2e2e;
  border-radius: 10px;
  display: flex;
  flex: 1 1 100px;
  flex-direction: column;
  min-width: 0;
  padding: 0.5rem 0.75rem;
}

.ds-strip-value { color: #ffc107; font-size: 1.15rem; font-weight: 700; }
.ds-strip-label { color: #ccc; font-size: 0.7rem; letter-spacing: 0.4px; text-transform: uppercase; }

/* A streak that's alive right now. */
.ds-strip-item.hot { border-color: #6b3b00; }
.ds-strip-item.hot .ds-strip-value { color: #ff9f1c; }

/* The personal best: a full-width tile, so the biggest fact sits alone. */
.ds-strip-item.record { flex-basis: 100%; }
.ds-strip-item.record .ds-strip-value { font-size: 1.4rem; }

.callouts { list-style: none; margin: 0; padding: 0; }

.callout {
  align-items: baseline;
  color: #ddd;
  display: flex;
  font-size: 0.82rem;
  gap: 0.5rem;
  line-height: 1.35;
  padding: 0.2rem 0;

  i { color: #ffc107; flex: 0 0 auto; }
  i.won { color: #4caf50; }
  strong { color: #fff; }
}

.callout.hot i { color: #ff9f1c; }

/* Per-game cards. The banner bleeds to the card's edges. */
.game-card { padding-top: 0; }

.game-banner {
  height: 64px;
  margin: 0 -1rem 0.6rem;
  overflow: hidden;
}

.game-banner-image {
  display: block;
  height: 100%;
  object-fit: cover;
  object-position: center;
  width: 100%;
}

.game-head {
  align-items: center;
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.35rem;

  i { color: #ffc107; }
}

.game-name { font-size: 1.05rem; font-weight: 700; }

.game-meta {
  color: #ccc;
  flex: 0 0 auto;
  font-size: 0.72rem;
  margin-left: auto;
  text-align: right;
}

.game-headline {
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.35;
  margin: 0 0 0.7rem;
}

.game-pending {
  color: #ccc;
  font-size: 0.78rem;
  margin: 0 0 0.5rem;
}

.pantheon-label { color: #eee; font-size: 0.85rem; font-weight: 700; margin: 0.4rem 0 0.4rem; }
.pantheon-count { color: #999; font-size: 0.72rem; font-weight: 400; margin-left: 0.35rem; }

/* Form strip: one bar per round, tallest = best. */
.form { margin-bottom: 0.6rem; }

.form-bars {
  align-items: flex-end;
  background: #101010;
  border: 1px solid #2e2e2e;
  border-radius: 8px;
  display: flex;
  gap: 2px;
  height: 56px;
  padding: 4px 6px;
}

.form-bar {
  background: #8a7a3a;
  border-radius: 2px 2px 0 0;
  display: block;
  flex: 1 1 0;
  min-width: 2px;
}

.form-bar.best { background: #ffc107; }
.form-bar.lost { background: #3a3a3a; }

.form-caption { margin: 0.4rem 0 0; }
.form-caption.trend-up { color: #7bd88f; }
.form-caption.trend-down { color: #e0a06a; }

.habits {
  align-items: baseline;
  color: #ccc;
  display: flex;
  font-size: 0.78rem;
  gap: 0.5rem;
  margin: 0 0 0.6rem;

  i { color: #ffc107; }
}

.ds-poster-row {
  align-items: flex-start;
  display: flex;
  gap: 0.6rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;
}

.ds-poster-card { cursor: pointer; flex: 0 0 92px; width: 92px; }
.ds-poster-card:active { opacity: 0.7; }
.ds-poster { border-radius: 6px; display: block; height: 138px; object-fit: cover; width: 92px; }
.ds-poster-note { color: #ccc; display: block; font-size: 0.7rem; line-height: 1.25; margin-top: 0.25rem; }
.ds-poster-note.gold { color: #ffc107; }

.ds-poster-blank {
  align-items: center;
  background: #2b2b2b;
  color: #ccc;
  display: flex;
  font-size: 0.68rem;
  justify-content: center;
  padding: 0.3rem;
  text-align: center;
}

.recent-rounds {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.4rem;
}

.round-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #333;
  border-radius: 999px;
  color: #ccc;
  font-size: 0.7rem;
  padding: 0.15rem 0.55rem;
}

/* Drama: cards rise in one after another, the personal best pops once
   its card has landed. A tap settles everything; reduced motion skips it. */
@keyframes stats-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}

@keyframes record-pop {
  0% { transform: scale(1); }
  40% { transform: scale(1.08); }
  100% { transform: scale(1); }
}

.staged {
  animation: stats-rise 0.45s ease both;
  animation-delay: calc(var(--stage, 0) * 110ms);
}

.staged .record .ds-strip-value {
  animation: record-pop 0.5s ease both;
  animation-delay: calc(var(--stage, 0) * 110ms + 350ms);
  display: inline-block;
  transform-origin: left center;
}

.settled .staged,
.settled .staged .record .ds-strip-value {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .staged,
  .staged .record .ds-strip-value {
    animation: none;
  }
}
</style>

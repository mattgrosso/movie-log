import otherAwardsWinners from '../data/otherAwardsWinners.json';

// Static dataset of major-ceremony wins/nominations (Golden Globes, BAFTA,
// Cannes, Venice — see CLAUDE.md's "Other Ceremonies" section for how it was
// built and its known limitations). Each entry is { ceremony, category,
// year, title, isWinner }. There's no TMDB id in the source data (it was
// scraped from Wikipedia list pages, not TMDB), so matching against the
// user's library happens by normalized title + release year instead — see
// findOtherAwardsForMovie below.
//
// Index by normalized title once at module load, not per-movie-page-visit.
const normalizeTitle = (title) => {
  return (title || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const INDEX = new Map();
otherAwardsWinners.forEach((entry) => {
  const key = normalizeTitle(entry.title);
  if (!INDEX.has(key)) {
    INDEX.set(key, []);
  }
  INDEX.get(key).push(entry);
});

// Ceremony year conventions don't always line up 1:1 with a film's TMDB
// release year (international rollouts, year-of-eligibility vs year-of-
// ceremony labeling quirks across sources) — allow a 1-year slop either way.
const YEAR_TOLERANCE = 1;

export function findOtherAwardsForMovie (movie) {
  const empty = { wins: [], nominations: [] };
  if (!movie || !movie.title) return empty;

  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const candidates = INDEX.get(normalizeTitle(movie.title)) || [];
  const matches = releaseYear
    ? candidates.filter((entry) => Math.abs(entry.year - releaseYear) <= YEAR_TOLERANCE)
    : candidates;

  const wins = [];
  const nominations = [];

  matches.forEach((entry, index) => {
    const record = {
      id: `${entry.ceremony}-${entry.category}-${entry.year}-${index}`,
      ceremony: entry.ceremony,
      category: entry.category,
      year: entry.year,
      wikipediaQuery: entry.ceremony,
    };
    if (entry.isWinner) {
      wins.push(record);
    } else {
      nominations.push(record);
    }
  });

  return { wins, nominations };
}

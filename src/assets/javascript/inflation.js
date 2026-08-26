// Money from one year, expressed in another year's dollars.
//
// Requested 2026-08-26: "I would also like to have a way to show boxoffice
// numbers adjusted for inflation." Jurassic Park took $920M in 1993 and
// Barbie took $1.45B in 2023 — those are not the same distance apart as the
// raw numbers suggest, and a library spanning eighty years makes every
// unadjusted money comparison quietly wrong.
//
// A BUNDLED TABLE, not an API. This is an offline-capable PWA, and a figure
// that silently becomes "—" on a plane is worse than one computed from a
// hundred-odd numbers that only change once a year. Same call
// `otherAwardsWinners.json` already makes.
//
// One thing worth knowing about the four money sorts: **return on budget is
// already inflation-neutral**. A film's budget and its box office are in the
// same year's dollars, so the ratio between them doesn't move when you
// re-express both. Adjusting it would be a no-op, and this module
// deliberately offers no way to.

import cpiData from '../data/cpi.json';

export const CPI = cpiData.series;

// The year every adjusted figure is expressed in — the latest full year in
// the table. When a newer annual average is added, this follows it.
export const BASE_YEAR = cpiData.baseYear;

const EARLIEST_YEAR = Math.min(...Object.keys(CPI).map(Number));

/**
 * The release year a money figure belongs to, from a TMDB release date.
 * Returns null rather than guessing — an unadjustable figure must be able to
 * say so.
 */
export const releaseYear = (releaseDate) => {
  if (!releaseDate) return null;
  const parsed = new Date(releaseDate);
  if (Number.isNaN(parsed.getTime())) return null;
  // getUTCFullYear, not getFullYear: TMDB dates are bare "YYYY-MM-DD", which
  // parse as UTC midnight and slip to the previous year west of Greenwich.
  const year = parsed.getUTCFullYear();
  return Number.isFinite(year) ? year : null;
};

/**
 * `amount` in `fromYear` dollars -> the same purchasing power in BASE_YEAR.
 *
 * Returns null when it cannot be done honestly: no amount, no year, or a year
 * the table doesn't cover. A year LATER than the table's last (a film
 * released this year, against a table that ends last year) is treated as
 * already-current rather than refused — the drift is one year of inflation,
 * and refusing would blank the newest films, which are the ones most likely
 * to be looked at.
 */
export const adjustForInflation = (amount, fromYear) => {
  const value = typeof amount === 'number' ? amount : parseFloat(amount);
  if (!Number.isFinite(value)) return null;

  const year = Number(fromYear);
  if (!Number.isFinite(year) || year < EARLIEST_YEAR) return null;

  if (year >= BASE_YEAR) return value;

  const from = CPI[String(year)];
  const to = CPI[String(BASE_YEAR)];
  if (!from || !to) return null;

  return value * (to / from);
};

/**
 * The same, taking a whole movie — the shape every caller actually has.
 * `field` is 'budget' or 'revenue'.
 */
export const adjustedMovieMoney = (movie, field) => {
  const raw = movie?.[field] || 0;
  // TMDB's 0 means "we don't know", the same as everywhere else in the app.
  if (!(raw > 0)) return null;
  return adjustForInflation(raw, releaseYear(movie?.release_date));
};

// Money, short enough for the caption bar under a poster.
//
// That bar is 8px type in a 12px-tall strip, so "$300,000,000" is not an
// option — it has to read at a glance the way a headline does. Requested
// 2026-08-26: "Budget should be able to show the budget (300M, 250K, etc).
// Box office should do the same... Profit should show the difference between
// the budget and the box office. And return should show a percentage."
//
// TMDB's `revenue` is WORLDWIDE gross, which is the number Matt wants
// (verified against his own library: Avatar $2,924M and Titanic $2,264M are
// the global figures; the domestic ones are $785M and $674M). TMDB doesn't
// publish a domestic split at all, so there is nothing to choose between.

const UNITS = [
  { limit: 1e9, suffix: 'B' },
  { limit: 1e6, suffix: 'M' },
  { limit: 1e3, suffix: 'K' }
];

/**
 * 300000000 -> "$300M", 250000 -> "$250K", 1200000000 -> "$1.2B".
 *
 * One decimal only below ten of a unit, where the difference between $1.2B
 * and $1.9B is the whole story; above that the decimal is noise in a caption.
 * A trailing ".0" is always dropped.
 */
export const formatMoneyShort = (value, fallback = '') => {
  const numeric = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(numeric)) return fallback;

  const magnitude = Math.abs(numeric);
  const sign = numeric < 0 ? '-' : '';
  if (magnitude < 1000) return `${sign}$${Math.round(magnitude)}`;

  const unit = UNITS.find((candidate) => magnitude >= candidate.limit);
  const scaled = magnitude / unit.limit;
  const shown = scaled < 10
    ? parseFloat(scaled.toFixed(1))
    : Math.round(scaled);

  return `${sign}$${shown}${unit.suffix}`;
};

/**
 * Profit: box office minus budget, with the sign carried out front, because
 * "$240M" and "lost $240M" are opposite facts and the caption has no room to
 * say which. A true minus sign (−), not a hyphen — it lines up with digits.
 */
export const formatProfit = (budget, revenue, fallback = '') => {
  const cost = typeof budget === 'number' ? budget : parseFloat(budget);
  const take = typeof revenue === 'number' ? revenue : parseFloat(revenue);
  if (!Number.isFinite(cost) || !Number.isFinite(take)) return fallback;

  const profit = take - cost;
  const magnitude = formatMoneyShort(Math.abs(profit), fallback);
  if (!magnitude) return fallback;
  if (profit === 0) return magnitude;
  return `${profit > 0 ? '+' : '−'}${magnitude}`;
};

/**
 * What came back, as a percentage of what went in: 450% means it made four
 * and a half times its budget. 100% is break-even, and anything under it lost
 * money — which is the reading that makes this different from profit.
 *
 * A zero budget has no answer (and would be Infinity), so it takes the
 * fallback rather than printing a number nobody can act on.
 */
export const formatReturn = (budget, revenue, fallback = '') => {
  const cost = typeof budget === 'number' ? budget : parseFloat(budget);
  const take = typeof revenue === 'number' ? revenue : parseFloat(revenue);
  if (!Number.isFinite(cost) || !Number.isFinite(take) || cost <= 0) return fallback;

  const pct = (take / cost) * 100;
  // Below ten percent the integer would round several very different flops to
  // the same "0%".
  const shown = pct < 10 ? parseFloat(pct.toFixed(1)) : Math.round(pct);
  return `${shown}%`;
};

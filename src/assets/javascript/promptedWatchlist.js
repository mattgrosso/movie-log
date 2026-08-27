// The "give it a prompt, get a watchlist" feature's pure half.
//
// Bug report (2026-08-27): "It'll be cool if I could have a prompt somewhere on
// the watchlist page where I could give it a prompt and it would give me back a
// watchlist tailored to that prompt."
//
// Everything here is a pure function over the library so it can be tested
// without Firebase, TMDB or the network. The component does the fetching.

import { genreNameFor } from './tmdbGenres.js';

/**
 * A short, human-readable sketch of what somebody likes.
 *
 * WHY THIS EXISTS AT ALL, rather than sending the library: there are 1,386
 * rated movies in this app. A list of every title is roughly 14,000 tokens on
 * every call, paid again each time you rephrase the same request - more than
 * the rest of the AI endpoint's traffic combined. This is a few hundred
 * characters and says the useful part.
 *
 * It is also deliberately WEAK evidence. The prompt is what the person asked
 * for; this is only for breaking ties, and the system prompt says so. Someone
 * who mostly rates thrillers should still get comedies when they ask for
 * comedies.
 */
export function tasteSummary (entries, getRatingFn) {
  const rated = (entries || [])
    .map((entry) => ({ entry, score: getRatingFn(entry)?.calculatedTotal }))
    .filter(({ score }) => Number.isFinite(score));

  if (rated.length < 5) return '';

  const mean = rated.reduce((sum, r) => sum + r.score, 0) / rated.length;

  // Genre affinity: how much better than usual this person rates a genre,
  // damped by how many times they've actually rated one. Without the damping
  // a single 10/10 documentary reads as a lifelong passion.
  const perGenre = new Map();
  rated.forEach(({ entry, score }) => {
    (entry?.movie?.genres || []).forEach((genre) => {
      // Stored entries usually carry TMDB's own {id, name}; the id lookup is
      // the fallback for older rows that only kept the id.
      const name = genre?.name || genreNameFor(genre?.id);
      if (!name) return;
      const g = perGenre.get(name) || { sum: 0, count: 0 };
      g.sum += score;
      g.count += 1;
      perGenre.set(name, g);
    });
  });

  const genreScores = [...perGenre.entries()]
    .filter(([, g]) => g.count >= 3)
    .map(([name, g]) => ({
      name,
      lift: ((g.sum / g.count) - mean) * Math.min(1, Math.log2(g.count + 1) / 4)
    }))
    .sort((a, b) => b.lift - a.lift);

  const decade = new Map();
  rated.forEach(({ entry, score }) => {
    const year = Number(String(entry?.movie?.release_date || '').slice(0, 4));
    if (!year) return;
    const d = Math.floor(year / 10) * 10;
    const cell = decade.get(d) || { sum: 0, count: 0 };
    cell.sum += score;
    cell.count += 1;
    decade.set(d, cell);
  });

  const decades = [...decade.entries()]
    .filter(([, d]) => d.count >= 5)
    .map(([d, cell]) => ({ d, avg: cell.sum / cell.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 2)
    .map(({ d }) => `${d}s`);

  const parts = [];
  const likes = genreScores.slice(0, 3).filter((g) => g.lift > 0).map((g) => g.name);
  const cool = genreScores.slice(-2).filter((g) => g.lift < 0).map((g) => g.name);

  if (likes.length) parts.push(`rates ${likes.join(', ')} above their average`);
  if (cool.length) parts.push(`cooler on ${cool.join(' and ')}`);
  if (decades.length) parts.push(`favours the ${decades.join(' and ')}`);
  parts.push(`${rated.length} films rated, averaging ${mean.toFixed(1)}`);

  return parts.join('; ');
}

/**
 * Matches what the model suggested against a TMDB search result.
 *
 * The model is asked for a year precisely so this can be strict about it: two
 * films share a title far more often than two films share a title AND a year,
 * and picking the wrong one puts a film the person has already rated back on
 * their watchlist. A year within one is allowed, because release years differ
 * between festival and general release often enough to matter.
 */
export function pickTmdbMatch (suggestion, results) {
  const wanted = String(suggestion?.title || '').trim().toLowerCase();
  if (!wanted || !Array.isArray(results) || !results.length) return null;

  const yearOf = (r) => Number(String(r?.release_date || '').slice(0, 4)) || null;
  const titleMatches = (r) => String(r?.title || '').trim().toLowerCase() === wanted;

  if (suggestion.year) {
    const exact = results.find((r) => titleMatches(r) && yearOf(r) === suggestion.year);
    if (exact) return exact;
    const close = results.find((r) => titleMatches(r) && Math.abs((yearOf(r) || 0) - suggestion.year) <= 1);
    if (close) return close;
  }

  const sameTitle = results.find(titleMatches);
  if (sameTitle) return sameTitle;

  // Nothing matched by name. TMDB's first result for a misspelling is usually
  // right, but "usually" is not good enough to silently put a different film
  // on somebody's list under a name they didn't ask for.
  return null;
}

/**
 * Turns suggestions plus their TMDB matches into rows, dropping anything
 * already rated and anything that didn't resolve.
 *
 * Filtering here rather than in the prompt is the cheap way round: asking the
 * model to avoid 1,386 titles means sending it 1,386 titles, and it would
 * still get it wrong. Checking an id against a Set is free and exact.
 */
export function buildPromptedList (suggestions, matches, ratedTmdbIdSet) {
  const seen = new Set();
  return (suggestions || []).reduce((rows, suggestion, i) => {
    const match = matches[i];
    if (!match || !match.id) return rows;
    if (ratedTmdbIdSet?.has?.(match.id)) return rows;
    if (seen.has(match.id)) return rows;
    seen.add(match.id);
    rows.push({ ...match, note: suggestion.why || null });
    return rows;
  }, []);
}

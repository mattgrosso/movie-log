// Decade Championship — who dominated each decade of your library.
//
// Bug report 2026-09-02 (Matt): "put in a decade by decade championship so
// like for actor actress Director, maybe we have who dominated each decade...
// choose the decade across the top like we do with years and then see the
// winners in a bunch of categories... I guess log score will be the way to
// do it although it's a little tricky because a lot of people won't have
// very many movies in their list per decade."
//
// Log Score is the right tool for exactly that worry. "Dominated" means
// depth AND quality, and the Bayesian pull toward the library average is
// what stops one lucky film from crowning anyone: a director with two films
// from the 1950s sits close to your average no matter how good they were,
// while four strong films can escape it. On top of that, nobody qualifies
// on a single film (`minFilms`), because one film is a data point, not a
// decade.
//
// Pure and store-free, like deepStats.js. Films are bucketed by RELEASE
// decade (this is about the decade the work belongs to, not when you saw
// it), scored on `calculatedTotal`, and every person is deduped to one
// credit per film before scoring (personCredits.js). The library-wide
// average is the Bayesian anchor throughout, the same as every other group
// score in the app.
//
// A podium of three per category, and only the categories that feel like a
// championship — Producer, Studio and Genre were built and cut the same day
// ("it feels like there's too much content here... we could probably lose
// producer and studio. Let's lose genre"). The podium was cut to one in the
// same round and then asked back an hour later ("now that I'm missing them, I
// actually do like that you gave me the top three").
//
// Cast is returned as one gender-agnostic ranked list ("performers"). The
// stored cast carries no gender, so splitting it into Actor and Actress
// takes a TMDB lookup per name — that's the screen's job, and it degrades
// to a single Performers podium when the lookups can't happen.

import { globalAverage, LOG_SCORE_DEFAULTS } from './logScore.js';
import { personLogScore } from './logScoreRankings.js';
import { dedupeAppearancesByFilm } from './personCredits.js';

// The same job lists the Favorite sections use, so a decade's Writer is
// judged on the same credits as the all-time Favorite Writers list.
export const DECADE_CREW_CATEGORIES = [
  { key: 'director', label: 'Director', jobs: ['Director'] },
  { key: 'writer', label: 'Writer', jobs: ['Screenplay', 'Writer', 'Story', 'Additional Writing', 'Novel'] },
  { key: 'cinematographer', label: 'Cinematographer', jobs: ['Director of Photography', 'Cinematographer'] },
  { key: 'composer', label: 'Composer', jobs: ['Original Music Composer', 'Orchestrator'] },
  { key: 'editor', label: 'Editor', jobs: ['Editor'] }
];

// Beyond this billing position W/(W+billing) adds almost nothing to
// confidence, and it bounds the work — same cap as FavoriteActors.
const BILLING_CAP = 20;

export const DECADE_DEFAULTS = Object.freeze({
  minFilms: 2, // one film is a data point, not a decade
  podium: 3
});

export function decadeLabel (decade) {
  return `${decade}s`;
}

/** The release decade of an entry (1994 → 1990), or null when undated. */
export function releaseDecade (entry) {
  const year = new Date(entry?.movie?.release_date ?? NaN).getFullYear();
  return Number.isFinite(year) ? Math.floor(year / 10) * 10 : null;
}

function ratedFilms (entries, getRatingFn) {
  return (entries || [])
    .map((entry) => {
      const rating = getRatingFn(entry)?.calculatedTotal;
      const decade = releaseDecade(entry);
      if (!Number.isFinite(rating) || decade === null) return null;
      return { entry, rating, decade };
    })
    .filter(Boolean);
}

/**
 * Every decade with at least one rated film, newest first — the order the
 * year strips elsewhere in the app use.
 * @returns {[{ decade, label, count }]}
 */
export function decadesAvailable (entries, getRatingFn) {
  const counts = new Map();
  ratedFilms(entries, getRatingFn).forEach(({ decade }) => {
    counts.set(decade, (counts.get(decade) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([decade, count]) => ({ decade, label: decadeLabel(decade), count }))
    .sort((a, b) => b.decade - a.decade);
}

/** The decade with the most rated films — the best-evidenced default. */
export function defaultDecade (decades) {
  if (!decades?.length) return null;
  return [...decades].sort((a, b) => (b.count - a.count) || (b.decade - a.decade))[0].decade;
}

// A stable order for equal scores: more films, then the name. Without the
// name tiebreak two people on identical scores would swap places between
// renders depending on gather order.
function rankOrder (a, b) {
  return (b.score - a.score) || (b.count - a.count) || a.name.localeCompare(b.name);
}

function bestOf (films) {
  return [...films].sort((a, b) => b.rating - a.rating)[0]?.entry || null;
}

// { name -> [{ entry, rating, billing }] } → ranked people. `cast` routes
// billing into personLogScore's confidence; crew uses the plain log score.
function rankPeople (byName, getRatingFn, globalAvg, weights, { minFilms, cast }) {
  // Explicit numbers, never `undefined`: personLogScore's destructuring
  // default turns an undefined billingWeight into "no billing" — which
  // silently scored a decade's cast as crew when no weights were passed.
  const { rankWeight, bayesianWeight, billingWeight } = { ...LOG_SCORE_DEFAULTS, ...(weights || {}) };
  return [...byName.entries()]
    .map(([name, appearances]) => {
      const deduped = dedupeAppearancesByFilm(appearances);
      if (deduped.length < minFilms) return null;
      const person = {
        entries: deduped.map((a) => a.entry),
        billings: cast ? deduped.map((a) => a.billing) : undefined
      };
      const score = personLogScore(person, getRatingFn, globalAvg, {
        rankWeight,
        bayesianWeight,
        billingWeight: cast ? billingWeight : null
      });
      if (score === null) return null;
      return {
        name,
        entries: person.entries,
        billings: person.billings,
        count: deduped.length,
        score,
        best: bestOf(deduped.map((a) => ({ entry: a.entry, rating: getRatingFn(a.entry)?.calculatedTotal ?? 0 })))
      };
    })
    .filter(Boolean)
    .sort(rankOrder);
}


/**
 * One decade's championship.
 *
 * @returns {{
 *   decade, label, filmCount, globalAvg,
 *   films: [{ entry, rating }],            // the decade's best, best first
 *   crew: [{ key, label, ranked: [...] }],  // DECADE_CREW_CATEGORIES order
 *   performers: [...]                       // cast, gender-agnostic, ranked
 * }}
 * Every `ranked` entry is `{ name, entries, count, score, best }` (cast adds
 * `billings`), sorted best first and NOT trimmed to the podium: the screen
 * trims, and the cast list has to be walked past the podium to fill Actor
 * and Actress.
 */
export function decadeChampionship (entries, getRatingFn, weights, decade, options = {}) {
  const { minFilms, podium } = { ...DECADE_DEFAULTS, ...options };
  const globalAvg = globalAverage(entries, getRatingFn);
  const films = ratedFilms(entries, getRatingFn).filter((film) => film.decade === decade);

  const crewByCategory = new Map(DECADE_CREW_CATEGORIES.map((category) => [category.key, new Map()]));
  const castByName = new Map();
  const push = (map, name, value) => {
    if (!name) return;
    const list = map.get(name) || [];
    list.push(value);
    map.set(name, list);
  };

  films.forEach(({ entry, rating }) => {
    const movie = entry.movie || {};
    (movie.crew || []).forEach((person) => {
      if (!person?.name || !person.job) return;
      DECADE_CREW_CATEGORIES.forEach((category) => {
        if (category.jobs.includes(person.job)) push(crewByCategory.get(category.key), person.name, { entry, rating, billing: 0 });
      });
    });
    (movie.cast || []).slice(0, BILLING_CAP).forEach((person, billing) => {
      push(castByName, person?.name, { entry, rating, billing });
    });
  });

  return {
    decade,
    label: decadeLabel(decade),
    filmCount: films.length,
    globalAvg,
    films: [...films].sort((a, b) => b.rating - a.rating).slice(0, podium).map(({ entry, rating }) => ({ entry, rating })),
    crew: DECADE_CREW_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      ranked: rankPeople(crewByCategory.get(category.key), getRatingFn, globalAvg, weights, { minFilms, cast: false })
    })),
    performers: rankPeople(castByName, getRatingFn, globalAvg, weights, { minFilms, cast: true })
  };
}

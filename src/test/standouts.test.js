import { describe, it, expect } from 'vitest';
import { standouts } from '@/assets/javascript/deepStats.js';

// Matt, 2026-08-16: "it'd be cool to find outliers around, like, things that
// have unusually high log scores. Not just genres, but keywords and directors
// and all that stuff... that would be an interesting pantheon to find."

// Null-safe, like the real GetRating: an entry with no ratings is a thing
// that exists (offline placeholders, mid-write states).
const getRating = (entry) => entry?.ratings?.[0] || {};

function film (id, rating, movie = {}) {
  return {
    dbKey: `k${id}`,
    ratings: [{ calculatedTotal: rating }],
    movie: { id, title: `Film ${id}`, release_date: '1999-06-15', ...movie }
  };
}

/** A body of ordinary films, so there's a real average to stand out from. */
function baseline (count = 40, rating = 5) {
  return Array.from({ length: count }, (unused, i) => film(1000 + i, rating, { genres: [{ name: 'Drama' }] }));
}

describe('standouts', () => {
  it('ranks a small beloved corner above a big mediocre one', () => {
    const entries = [
      ...baseline(),
      ...Array.from({ length: 8 }, (unused, i) => film(i, 9.5, { genres: [{ name: 'Noir' }] }))
    ];

    const ranked = standouts(entries, getRating, {});
    const noir = ranked.findIndex((s) => s.value === 'Noir');
    const drama = ranked.findIndex((s) => s.value === 'Drama');

    expect(noir).toBeGreaterThanOrEqual(0);
    expect(noir).toBeLessThan(drama);
  });

  // The bug this replaced: ranking by log score put Drama, Comedy and "the
  // 1990s" on top of Matt's real library — the biggest categories, which is
  // just a restatement of the library's shape.
  //
  // The mechanism is Log Score's rank weighting: your biggest genre also
  // holds your very best films, so its top-heavy weighted average scores high
  // even though the genre as a whole is thoroughly average. Ranking by that
  // measures "does this category contain great films", which every large
  // category does. A standout has to be unusual, not merely large.
  it('does not let a large, average category outrank a genuinely better one', () => {
    const entries = [
      // 300 films spread right across the scale: dead average as a group, but
      // it contains the library's best films, which is what rank weighting
      // rewards. Log Score: 7.99. Actual lift: -0.06.
      ...Array.from({ length: 300 }, (unused, i) => film(1000 + i, 1 + (i % 10), { genres: [{ name: 'Drama' }] })),
      // Nine films, consistently good, none at the very top. Log Score: 6.65.
      // Actual lift: +1.09.
      ...Array.from({ length: 9 }, (unused, i) => film(i, 7.5, { genres: [{ name: 'Noir' }] }))
    ];

    const ranked = standouts(entries, getRating, {});
    const noir = ranked.find((s) => s.value === 'Noir');
    const drama = ranked.find((s) => s.value === 'Drama');

    // The shape that made the old ranking wrong: Drama wins on log score...
    expect(drama.score).toBeGreaterThan(noir.score);
    // ...and must still lose, because it isn't a standout.
    expect(ranked[0].value).toBe('Noir');
    expect(noir.lift).toBeGreaterThan(drama.lift);
  });

  // The point of ranging over every facet at once.
  it('finds standouts in keywords, directors, actors and studios, not just genres', () => {
    const marked = { name: 'heist' };
    const entries = [
      ...baseline(),
      ...Array.from({ length: 6 }, (unused, i) => film(i, 9.6, {
        keywords: [marked],
        crew: [{ name: 'Ace Director', job: 'Director' }],
        cast: [{ name: 'Lead Actor' }],
        production_companies: [{ name: 'Small Studio' }]
      }))
    ];

    const facets = standouts(entries, getRating, {});
    const byValue = Object.fromEntries(facets.map((s) => [s.value, s.facet]));

    expect(byValue.heist).toBe('keyword');
    expect(byValue['Ace Director']).toBe('director');
    expect(byValue['Lead Actor']).toBe('actor');
    expect(byValue['Small Studio']).toBe('studio');
  });

  // Crew is ordered by department, so a composer sits well past index ten —
  // matching on position instead of job is the classic bug here.
  it('identifies crew by job rather than position in the list', () => {
    const crew = [
      ...Array.from({ length: 12 }, (unused, i) => ({ name: `Grip ${i}`, job: 'Grip' })),
      { name: 'Late Composer', job: 'Original Music Composer' }
    ];
    const entries = [
      ...baseline(),
      ...Array.from({ length: 6 }, (unused, i) => film(i, 9.4, { crew }))
    ];

    const composer = standouts(entries, getRating, {}).find((s) => s.value === 'Late Composer');

    expect(composer).toBeTruthy();
    expect(composer.facet).toBe('composer');
  });

  it('ignores anything with too few films to mean anything', () => {
    const entries = [...baseline(), film(1, 10, { genres: [{ name: 'Fluke' }] })];

    expect(standouts(entries, getRating, {}).some((s) => s.value === 'Fluke')).toBe(false);
  });

  it('reports the lift against your own average, in both directions', () => {
    const entries = [
      ...baseline(40, 5),
      ...Array.from({ length: 6 }, (unused, i) => film(i, 9, { genres: [{ name: 'Noir' }] })),
      ...Array.from({ length: 6 }, (unused, i) => film(100 + i, 2, { genres: [{ name: 'Slog' }] }))
    ];

    const ranked = standouts(entries, getRating, {});
    expect(ranked.find((s) => s.value === 'Noir').lift).toBeGreaterThan(0);
    expect(ranked.find((s) => s.value === 'Slog').lift).toBeLessThan(0);
  });

  // Ranked purely by lift, TMDB keywords took sixteen of twenty-four slots on
  // the real library and no director, actor or studio ever appeared.
  it('caps each facet type so keywords cannot crowd out everything else', () => {
    const entries = [...baseline(60, 5)];
    // Twenty keywords, each on its own five loved films.
    for (let k = 0; k < 20; k++) {
      for (let i = 0; i < 5; i++) {
        entries.push(film(k * 100 + i, 9.5, { keywords: [{ name: `kw${k}` }] }));
      }
    }
    // One director, just as loved, but only one of them.
    entries.push(...Array.from({ length: 5 }, (unused, i) => film(9000 + i, 9.5, {
      crew: [{ name: 'Ace Director', job: 'Director' }]
    })));

    const ranked = standouts(entries, getRating, {});

    expect(ranked.filter((s) => s.facet === 'keyword').length).toBeLessThanOrEqual(3);
    expect(ranked.some((s) => s.value === 'Ace Director')).toBe(true);
  });

  it('carries a handful of examples per standout, best first', () => {
    const entries = [
      ...baseline(),
      ...Array.from({ length: 10 }, (unused, i) => film(i, 6 + i * 0.3, { genres: [{ name: 'Noir' }] }))
    ];

    const noir = standouts(entries, getRating, {}).find((s) => s.value === 'Noir');

    expect(noir.top.length).toBeLessThanOrEqual(6);
    expect(noir.top[0].ratings[0].calculatedTotal)
      .toBeGreaterThan(noir.top[noir.top.length - 1].ratings[0].calculatedTotal);
  });

  it('buckets by decade from the release date', () => {
    const entries = [
      ...baseline(),
      ...Array.from({ length: 6 }, (unused, i) => film(i, 9.2, { release_date: '1974-06-15' }))
    ];

    const decade = standouts(entries, getRating, {}).find((s) => s.facet === 'decade' && s.value === '1970s');
    expect(decade).toBeTruthy();
  });

  it('is null-safe and survives entries with nothing on them', () => {
    expect(standouts(null, getRating, {})).toEqual([]);
    expect(standouts([], getRating, {})).toEqual([]);
    expect(standouts([{ movie: {} }, {}], getRating, {})).toEqual([]);
  });
});

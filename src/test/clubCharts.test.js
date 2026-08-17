import { describe, it, expect } from 'vitest';
import {
  memberColors,
  buildOverlaps,
  tasteMap,
  overlapBars,
  agreementByDecade,
  agreementByGenre,
  generosityCurves,
  contrarians,
  blindSpots,
  syncMoments,
  clubActivity,
  criterionRadar
} from '@/assets/javascript/clubCharts.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 7, 17, 12).getTime();

// Mirrors GetRating: the most recent rating, normalized.
const getRating = (entry) => entry?.ratings?.[entry.ratings.length - 1] || {};

function mine (id, score, { genres = ['Drama'], year = 2001, at = NOW - 30 * DAY, criteria = {} } = {}) {
  return {
    dbKey: `k${id}`,
    ratings: [{ calculatedTotal: score, date: at, ...criteria }],
    movie: {
      id,
      title: `Film ${id}`,
      poster_path: `/${id}.jpg`,
      // Mid-month: `new Date('YYYY-01-01')` parses as UTC and shifts a year.
      release_date: `${year}-06-15`,
      genres: genres.map((name) => ({ name }))
    }
  };
}

function profile (name, ratings, extra = {}) {
  return { name, counts: { titles: Object.keys(ratings).length }, ratings, ...extra };
}

describe('memberColors', () => {
  it('gives every member a colour, stable regardless of input order', () => {
    const a = memberColors(['brian', 'natalie', 'me']);
    const b = memberColors(['me', 'brian', 'natalie']);

    expect(a).toEqual(b);
    expect(new Set(Object.values(a)).size).toBe(3);
  });

  it('wraps rather than running out on a large club', () => {
    const keys = Array.from({ length: 12 }, (unused, i) => `friend${i}`);
    const colors = memberColors(keys);

    expect(Object.keys(colors)).toHaveLength(12);
    Object.values(colors).forEach((color) => expect(color).toMatch(/^#[0-9a-f]{6}$/i));
  });

  it('is safe with nothing to colour', () => {
    expect(memberColors(null)).toEqual({});
  });
});

describe('buildOverlaps', () => {
  const myEntries = [mine(1, 9), mine(2, 4), mine(3, 7)];
  const profiles = { brian: profile('Brian', { 1: { r: 8 }, 2: { r: 6 }, 9: { r: 10, t: 'Theirs Only' } }) };

  it('joins only the films you have both rated', () => {
    const { overlaps } = buildOverlaps(myEntries, getRating, profiles);

    expect(overlaps[0].shared.map((film) => film.id)).toEqual([1, 2]);
    expect(overlaps[0].theirTotal).toBe(3);
  });

  it('carries your own genre and decade onto the shared film', () => {
    const entries = [mine(1, 9, { genres: ['Noir', 'Crime'], year: 1974 })];
    const { overlaps } = buildOverlaps(entries, getRating, { brian: profile('Brian', { 1: { r: 8 } }) });

    expect(overlaps[0].shared[0].genres).toEqual(['Noir', 'Crime']);
    expect(overlaps[0].shared[0].decade).toBe(1970);
  });

  it('is null-safe on every argument', () => {
    expect(buildOverlaps(null, getRating, null).overlaps).toEqual([]);
    expect(buildOverlaps([], getRating, { brian: null }).overlaps).toEqual([]);
  });
});

describe('tasteMap', () => {
  it('places a friend by their average against yours on the same films', () => {
    const myEntries = [mine(1, 10), mine(2, 6)];
    const { overlaps } = buildOverlaps(myEntries, getRating, {
      brian: profile('Brian', { 1: { r: 8 }, 2: { r: 4 } })
    });

    const [point] = tasteMap(overlaps);
    expect(point.mine).toBe(8);
    expect(point.theirs).toBe(6);
    expect(point.shared).toBe(2);
    // Consistently two points below you.
    expect(point.lean).toBe(-2);
    expect(point.alignment).toBe(8);
  });

  it('leaves out a friend you share nothing with', () => {
    const { overlaps } = buildOverlaps([mine(1, 9)], getRating, {
      brian: profile('Brian', { 99: { r: 8 } })
    });

    expect(tasteMap(overlaps)).toEqual([]);
  });
});

describe('overlapBars', () => {
  it('splits shared, theirs-only and yours-only', () => {
    const myEntries = [mine(1, 9), mine(2, 4), mine(3, 7)];
    const { overlaps } = buildOverlaps(myEntries, getRating, {
      brian: profile('Brian', { 1: { r: 8 }, 9: { r: 7 }, 8: { r: 6 } })
    });

    const [bar] = overlapBars(overlaps, myEntries.length);
    expect(bar.shared).toBe(1);
    expect(bar.onlyThem).toBe(2);
    expect(bar.onlyYou).toBe(2);
    expect(bar.coverage).toBe(33);
  });
});

describe('agreement slices', () => {
  const myEntries = [
    mine(1, 9, { year: 1974, genres: ['Crime'] }),
    mine(2, 8, { year: 1975, genres: ['Crime'] }),
    mine(3, 7, { year: 1978, genres: ['Crime'] }),
    mine(4, 2, { year: 2021, genres: ['Horror'] }),
    mine(5, 3, { year: 2022, genres: ['Horror'] }),
    mine(6, 4, { year: 2023, genres: ['Horror'] })
  ];
  const profiles = {
    brian: profile('Brian', {
      // Dead-on through the seventies, miles apart on the new stuff.
      1: { r: 9 }, 2: { r: 8 }, 3: { r: 7 },
      4: { r: 8 }, 5: { r: 9 }, 6: { r: 9 }
    })
  };

  it('finds the decades you agree on and the ones you do not', () => {
    const { overlaps } = buildOverlaps(myEntries, getRating, profiles);
    const byDecade = agreementByDecade(overlaps);

    const seventies = byDecade.find((row) => row.label === '1970s');
    const twenties = byDecade.find((row) => row.label === '2020s');

    expect(seventies.friends[0].alignment).toBe(10);
    expect(twenties.friends[0].alignment).toBeLessThan(5);
  });

  it('cuts the same overlap by genre', () => {
    const { overlaps } = buildOverlaps(myEntries, getRating, profiles);
    const byGenre = agreementByGenre(overlaps);

    expect(byGenre.find((row) => row.label === 'Crime').friends[0].alignment).toBe(10);
    expect(byGenre.find((row) => row.label === 'Horror').friends[0].alignment).toBeLessThan(5);
  });

  // One film in common says nothing about a decade.
  it('ignores a slice with too few films to mean anything', () => {
    const thin = [mine(1, 9, { year: 1961 })];
    const { overlaps } = buildOverlaps(thin, getRating, { brian: profile('Brian', { 1: { r: 3 } }) });

    expect(agreementByDecade(overlaps)).toEqual([]);
  });
});

describe('generosityCurves', () => {
  it('puts you first and buckets everyone by whole score', () => {
    const myEntries = [mine(1, 7.4), mine(2, 6.8), mine(3, 2.1)];
    const curves = generosityCurves(myEntries, getRating, {
      brian: profile('Brian', { 1: { r: 9 }, 2: { r: 9 }, 3: { r: 8.5 } })
    });

    expect(curves[0].name).toBe('You');
    expect(curves[0].buckets[7]).toBe(2);
    expect(curves[0].buckets[2]).toBe(1);
    expect(curves[1].name).toBe('Brian');
    expect(curves[1].buckets[9]).toBe(3);
    expect(curves[1].average).toBeGreaterThan(curves[0].average);
  });

  // This is a fact about a person, not about a relationship, so it uses each
  // member's whole published library rather than the overlap.
  it('uses a friend\'s whole library, not just what you share', () => {
    const curves = generosityCurves([mine(1, 5)], getRating, {
      brian: profile('Brian', { 1: { r: 9 }, 50: { r: 9 }, 51: { r: 9 } })
    });

    expect(curves.find((c) => c.name === 'Brian').total).toBe(3);
  });

  it('leaves out a member with nothing rated', () => {
    const curves = generosityCurves([mine(1, 5)], getRating, { ghost: profile('Ghost', {}) });

    expect(curves.map((c) => c.name)).toEqual(['You']);
  });
});

describe('contrarians', () => {
  const myEntries = [mine(1, 9), mine(2, 5)];
  const profiles = {
    brian: profile('Brian', { 1: { r: 9 }, 2: { r: 5 } }),
    // Natalie is the odd one out on both.
    natalie: profile('Natalie', { 1: { r: 2 }, 2: { r: 10 } })
  };

  it('names whoever sits furthest from the group, film by film', () => {
    const { board, moments } = contrarians(myEntries, getRating, profiles);

    expect(board[0].name).toBe('Natalie');
    expect(board[0].rate).toBe(100);
    expect(moments[0].who).toBe('Natalie');
  });

  // With two people both are equally far from the midpoint, so there is no
  // outlier to name.
  it('needs three ratings on a film before anyone can be the outlier', () => {
    const { board, moments } = contrarians(myEntries, getRating, {
      brian: profile('Brian', { 1: { r: 1 } })
    });

    expect(board).toEqual([]);
    expect(moments).toEqual([]);
  });
});

describe('blindSpots', () => {
  it('finds what the club has seen and you have not', () => {
    const myEntries = [mine(1, 9)];
    const spots = blindSpots(myEntries, getRating, {
      brian: profile('Brian', { 1: { r: 8 }, 7: { r: 9, t: 'Everyone But You', p: '/7.jpg' } }),
      natalie: profile('Natalie', { 7: { r: 8 } })
    });

    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({ id: 7, title: 'Everyone But You', friends: 2, average: 8.5 });
  });

  it('ignores a film only one friend has seen, by default', () => {
    const spots = blindSpots([], getRating, { brian: profile('Brian', { 7: { r: 9 } }) });

    expect(spots).toEqual([]);
  });
});

describe('syncMoments', () => {
  it('finds films you both happened to watch within days of each other', () => {
    const myEntries = [
      mine(1, 8, { at: NOW - 10 * DAY }),
      mine(2, 8, { at: NOW - 200 * DAY })
    ];
    const { overlaps } = buildOverlaps(myEntries, getRating, {
      brian: profile('Brian', {
        1: { r: 7, at: NOW - 12 * DAY },   // two days apart
        2: { r: 7, at: NOW - 5 * DAY }     // months apart
      })
    });

    const moments = syncMoments(overlaps);
    expect(moments).toHaveLength(1);
    expect(moments[0]).toMatchObject({ id: 1, apart: 2, name: 'Brian' });
  });

  it('needs a timestamp on both sides', () => {
    const { overlaps } = buildOverlaps([mine(1, 8, { at: null })], getRating, {
      brian: profile('Brian', { 1: { r: 7, at: NOW } })
    });

    expect(syncMoments(overlaps)).toEqual([]);
  });
});

describe('clubActivity', () => {
  it('counts viewings per month per member across the window', () => {
    const myEntries = [mine(1, 8, { at: NOW - 5 * DAY }), mine(2, 8, { at: NOW - 40 * DAY })];
    const activity = clubActivity(myEntries, getRating, {
      brian: profile('Brian', { 9: { r: 8, at: NOW - 5 * DAY } })
    }, { months: 12, now: NOW });

    expect(activity.months).toHaveLength(12);
    expect(activity.series.map((row) => row.name)).toEqual(['You', 'Brian']);
    expect(activity.series[0].counts.reduce((a, b) => a + b, 0)).toBe(2);
    expect(activity.peak).toBeGreaterThan(0);
  });

  it('drops a member who has done nothing in the window', () => {
    const activity = clubActivity([], getRating, {
      brian: profile('Brian', { 9: { r: 8, at: NOW - 900 * DAY } })
    }, { months: 12, now: NOW });

    expect(activity.series).toEqual([]);
  });
});

describe('criterionRadar', () => {
  const AXES = ['love', 'overall'];

  it('averages both breakdowns across the shared films', () => {
    const myEntries = [
      mine(1, 8, { criteria: { love: 5, overall: 8 } }),
      mine(2, 6, { criteria: { love: 3, overall: 6 } })
    ];
    const { overlaps } = buildOverlaps(myEntries, getRating, {
      brian: profile('Brian', { 1: { r: 8, c: [4, 9] }, 2: { r: 6, c: [2, 7] } })
    });

    const [row] = criterionRadar(overlaps, AXES);
    expect(row.films).toBe(2);
    expect(row.axes[0]).toMatchObject({ label: 'love', mine: 4, theirs: 3 });
    expect(row.axes[1]).toMatchObject({ label: 'overall', mine: 7, theirs: 8 });
  });

  // An empty radar is worse than no radar.
  it('is null when nobody shared a breakdown', () => {
    const { overlaps } = buildOverlaps([mine(1, 8, { criteria: { love: 5 } })], getRating, {
      brian: profile('Brian', { 1: { r: 8 } })
    });

    expect(criterionRadar(overlaps, AXES)).toBe(null);
  });

  it('is null when there are no axes to plot', () => {
    expect(criterionRadar([], [])).toBe(null);
  });
});

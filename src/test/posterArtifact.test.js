import { describe, it, expect } from 'vitest';
import { pickPosterEntries, gridLayout, tilePosition, posterCaption, entryMatchesHighlight, assignMosaicCells, collectHighlightOptions, suggestHighlights } from '@/assets/javascript/posterArtifact.js';

const NOW = new Date('2026-08-15T12:00:00');

function entry (id, { rating = 7, watched = '2024-06-15T12:00:00', poster = `/p${id}.jpg` } = {}) {
  return {
    dbKey: `key-${id}`,
    movie: { id, title: `Movie ${id}`, poster_path: poster },
    ratings: [{ calculatedTotal: rating, date: watched }]
  };
}
const ratingOf = (e) => ({ calculatedTotal: e.ratings[0].calculatedTotal });

describe('pickPosterEntries', () => {
  it("'top' takes the best-rated up to the cap, best first", () => {
    const entries = Array.from({ length: 120 }, (_, i) => entry(i, { rating: i / 12 }));
    const picked = pickPosterEntries(entries, 'top', ratingOf, NOW);

    expect(picked).toHaveLength(100);
    expect(picked[0].movie.id).toBe(119); // highest rating first
  });

  it("'all' orders chronologically by first watch — a viewing autobiography", () => {
    const entries = [
      entry(1, { watched: '2023-05-10T12:00:00' }),
      entry(2, { watched: '2020-02-02T12:00:00' }),
      entry(3, { watched: '2025-01-01T12:00:00' })
    ];
    expect(pickPosterEntries(entries, 'all', ratingOf, NOW).map((e) => e.movie.id)).toEqual([2, 1, 3]);
  });

  it("'year' keeps only this calendar year's watches", () => {
    const entries = [
      entry(1, { watched: '2026-02-01T12:00:00' }),
      entry(2, { watched: '2025-12-31T12:00:00' })
    ];
    expect(pickPosterEntries(entries, 'year', ratingOf, NOW).map((e) => e.movie.id)).toEqual([1]);
  });

  it('movies without posters never make the artifact', () => {
    const entries = [entry(1), entry(2, { poster: null })];
    expect(pickPosterEntries(entries, 'all', ratingOf, NOW)).toHaveLength(1);
  });
});

describe('gridLayout + tilePosition', () => {
  it('fits every tile and lands near a 2:3 poster shape', () => {
    const layout = gridLayout(100);

    expect(layout.cols * layout.rows).toBeGreaterThanOrEqual(100);
    const aspect = layout.width / layout.height;
    expect(aspect).toBeGreaterThan(0.5);
    expect(aspect).toBeLessThan(0.9);
  });

  it('positions tiles inside the margins, row-major', () => {
    const layout = gridLayout(10);
    const first = tilePosition(0, layout);
    const second = tilePosition(1, layout);
    const nextRow = tilePosition(layout.cols, layout);

    expect(first).toEqual({ x: layout.margin, y: layout.margin });
    expect(second.x).toBe(layout.margin + layout.tileW + layout.gap);
    expect(nextRow.y).toBe(layout.margin + layout.tileH + layout.gap);
  });

  it('handles tiny and empty libraries', () => {
    expect(gridLayout(0)).toBeNull();
    const one = gridLayout(1);
    expect(one.cols).toBe(1);
  });
});

describe('posterCaption', () => {
  it('captions each mode', () => {
    expect(posterCaption('top', 100)).toBe('My top 100 · Cinema Roll');
    expect(posterCaption('year', 44, NOW)).toBe('2026 in movies · 44 watched · Cinema Roll');
    expect(posterCaption('all', 1372)).toBe('1372 movies and counting · Cinema Roll');
  });
});

describe('entryMatchesHighlight', () => {
  const entry = {
    movie: {
      title: 'Alien',
      genres: [{ name: 'Horror' }, { name: 'Science Fiction' }],
      cast: [{ name: 'Sigourney Weaver' }],
      crew: [{ name: 'Ridley Scott', job: 'Director' }],
      flatKeywords: ['space', 'xenomorph']
    }
  }

  it('matches genres, people, and keywords case-insensitively', () => {
    expect(entryMatchesHighlight(entry, 'horror')).toBe(true)
    expect(entryMatchesHighlight(entry, 'weaver')).toBe(true)
    expect(entryMatchesHighlight(entry, 'ridley')).toBe(true)
    expect(entryMatchesHighlight(entry, 'xeno')).toBe(true)
    expect(entryMatchesHighlight(entry, 'romance')).toBe(false)
  })

  it('does NOT match by title (that would just be search) and passes everything when empty', () => {
    expect(entryMatchesHighlight(entry, 'alien')).toBe(false)
    expect(entryMatchesHighlight(entry, '')).toBe(true)
  })
})

describe('assignMosaicCells (quadrant signatures)', () => {
  // Signatures are 2x2 quadrant colors: 12 numbers [r,g,b, r,g,b, ...].
  const flat = (r, g, b) => [r, g, b, r, g, b, r, g, b, r, g, b]
  const red = flat(255, 0, 0)
  const blue = flat(0, 0, 255)
  const darkRed = flat(200, 10, 10)
  // dark on top, light on bottom — structure a flat average can't see
  const topDark = [10, 10, 10, 10, 10, 10, 240, 240, 240, 240, 240, 240]
  const bottomDark = [240, 240, 240, 240, 240, 240, 10, 10, 10, 10, 10, 10]

  const rng0 = () => 0 // deterministic: always the single best candidate

  it('assigns each cell its nearest-signature tile', () => {
    expect(assignMosaicCells([red, blue, darkRed], [blue, red], { maxUse: 5, rng: rng0 })).toEqual([1, 0, 1])
  })

  it('never places a poster directly beside itself (the slab-of-repeats bug)', () => {
    // A 4x3 flat region: every cell identical. With plenty of equal tiles,
    // no horizontally or vertically adjacent cells may share a poster.
    const cells = Array.from({ length: 12 }, () => flat(100, 100, 100))
    const tiles = Array.from({ length: 8 }, () => flat(100, 100, 100))
    const cols = 4
    const assigned = assignMosaicCells(cells, tiles, { maxUse: 12, cols, rng: rng0 })

    assigned.forEach((tile, i) => {
      const col = i % cols
      if (col > 0) expect(tile).not.toBe(assigned[i - 1])
      if (i >= cols) expect(tile).not.toBe(assigned[i - cols])
    })
  })

  it('quadrants let structure win where averages tie', () => {
    // Both tiles average to the same gray; only quadrants tell them apart.
    const assigned = assignMosaicCells([topDark, bottomDark], [bottomDark, topDark], { maxUse: 5, rng: () => 0 })
    expect(assigned).toEqual([1, 0])
  })

  it('spreads usage under a tight cap, and falls back to reuse when exhausted', () => {
    const spread = assignMosaicCells([red, red, red], [red, darkRed], { maxUse: 1, rng: () => 0 })
    expect(new Set(spread).size).toBeGreaterThan(1)
    expect(assignMosaicCells([red, red, red, red], [red], { maxUse: 1, rng: () => 0 })).toEqual([0, 0, 0, 0])
  })
})

describe('highlight typeahead', () => {
  const entries = [
    { movie: { genres: [{ name: 'Comedy' }], cast: [{ name: 'Tom Hanks' }], crew: [{ name: 'Nora Ephron' }], flatKeywords: ['new york'] } },
    { movie: { genres: [{ name: 'Comedy' }], cast: [{ name: 'Tom Cruise' }], crew: [], flatKeywords: [] } }
  ]

  it('collects each distinct data point once, tagged by kind', () => {
    const options = collectHighlightOptions(entries)
    const labels = options.map((o) => o.label)
    expect(labels).toContain('Comedy')
    expect(labels).toContain('Tom Hanks')
    expect(labels).toContain('Nora Ephron')
    expect(labels).toContain('new york')
    expect(labels.filter((l) => l === 'Comedy')).toHaveLength(1)
    expect(options.find((o) => o.label === 'Tom Hanks').kind).toBe('cast')
  })

  it('suggests prefix matches before substring matches, from 2 characters', () => {
    const options = collectHighlightOptions(entries)
    expect(suggestHighlights(options, 't')).toEqual([])
    const toms = suggestHighlights(options, 'tom')
    expect(toms.map((o) => o.label)).toEqual(['Tom Hanks', 'Tom Cruise'])
    const rk = suggestHighlights(options, 'york')
    expect(rk.map((o) => o.label)).toEqual(['new york'])
  })
})

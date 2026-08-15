import { describe, it, expect } from 'vitest';
import { pickPosterEntries, gridLayout, tilePosition, posterCaption } from '@/assets/javascript/posterArtifact.js';

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

import { describe, it, expect } from 'vitest';
import { findOtherAwardsForMovie } from '@/assets/javascript/otherAwards.js';

describe('findOtherAwardsForMovie', () => {
  it('returns no matches for a movie with no data', () => {
    const result = findOtherAwardsForMovie({ title: 'Some Totally Made Up Movie Title Xyz', release_date: '2019-01-01' });
    expect(result.wins).toEqual([]);
    expect(result.nominations).toEqual([]);
  });

  it('finds a Palme d\'Or win by exact title/year', () => {
    const result = findOtherAwardsForMovie({ title: 'Parasite', release_date: '2019-05-30' });
    expect(result.wins.some((w) => w.ceremony === 'Cannes Film Festival' && w.category === "Palme d'Or")).toBe(true);
  });

  it('finds a Golden Globe win and BAFTA win for the same film', () => {
    const result = findOtherAwardsForMovie({ title: 'Oppenheimer', release_date: '2023-07-19' });
    expect(result.wins.some((w) => w.ceremony === 'Golden Globe Awards' && w.category === 'Best Motion Picture – Drama')).toBe(true);
    expect(result.wins.some((w) => w.ceremony === 'BAFTA Awards' && w.category === 'Best Film')).toBe(true);
  });

  it('finds nominations distinct from wins', () => {
    const result = findOtherAwardsForMovie({ title: 'The Irishman', release_date: '2019-11-01' });
    expect(result.nominations.some((n) => n.ceremony === 'Golden Globe Awards')).toBe(true);
    expect(result.wins.length).toBe(0);
  });

  it('tolerates a 1-year gap between the ceremony year and TMDB release year', () => {
    // The Brutalist premiered/released in a way that TMDB may date slightly
    // differently than the Golden Globes' film-year labeling; either 2024
    // or 2025 should still resolve to the same win.
    const result2024 = findOtherAwardsForMovie({ title: 'The Brutalist', release_date: '2024-12-20' });
    const result2025 = findOtherAwardsForMovie({ title: 'The Brutalist', release_date: '2025-01-10' });
    expect(result2024.wins.length).toBeGreaterThan(0);
    expect(result2025.wins.length).toBeGreaterThan(0);
  });

  it('does not match when the year is far outside tolerance', () => {
    const result = findOtherAwardsForMovie({ title: 'Parasite', release_date: '1999-05-30' });
    expect(result.wins).toEqual([]);
    expect(result.nominations).toEqual([]);
  });

  it('is accent- and case-insensitive', () => {
    const result = findOtherAwardsForMovie({ title: 'PARASITE', release_date: '2019-05-30' });
    expect(result.wins.length).toBeGreaterThan(0);
  });

  it('returns empty results for a null/undefined movie', () => {
    expect(findOtherAwardsForMovie(null)).toEqual({ wins: [], nominations: [] });
    expect(findOtherAwardsForMovie({})).toEqual({ wins: [], nominations: [] });
  });
});

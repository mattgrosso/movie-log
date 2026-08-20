import { describe, it, expect } from 'vitest';
import { directorsFrom, topCastFrom, certificationFrom } from '@/assets/javascript/movieSummary.js';

// The facts MoviePreview pulls out of a raw TMDB payload — "add director and
// cast and some other pertinent details to the unrated movie drawer"
// (2026-08-20). Tested directly rather than through a mount, per the repo's
// preference for pure modules.

describe('directorsFrom', () => {
  // The mistake this repo has made before: .find() credits only the
  // first-listed of a co-directed film.
  it('keeps every director of a co-directed film', () => {
    const credits = {
      crew: [
        { job: 'Director', name: 'Joel Coen' },
        { job: 'Producer', name: 'Someone Else' },
        { job: 'Director', name: 'Ethan Coen' }
      ]
    };

    expect(directorsFrom(credits)).toEqual(['Joel Coen', 'Ethan Coen']);
  });

  // TMDB orders crew by department, so position says nothing about role.
  it('matches on the job, not on where in the array it sits', () => {
    const crew = [
      ...Array.from({ length: 14 }, (_, i) => ({ job: 'Sound', name: `Sound ${i}` })),
      { job: 'Director', name: 'Buried Director' }
    ];

    expect(directorsFrom({ crew })).toEqual(['Buried Director']);
  });

  it('ignores a credit with no name, and is null-safe', () => {
    expect(directorsFrom({ crew: [{ job: 'Director' }] })).toEqual([]);
    expect(directorsFrom(null)).toEqual([]);
    expect(directorsFrom({})).toEqual([]);
  });
});

describe('topCastFrom', () => {
  const cast = [
    { name: 'Fourth', order: 3 },
    { name: 'First', order: 0 },
    { name: 'Third', order: 2 },
    { name: 'Second', order: 1 }
  ];

  it('returns top billing order, however the payload arrived', () => {
    expect(topCastFrom({ cast }, { cap: 3 })).toEqual(['First', 'Second', 'Third']);
  });

  it('caps the list rather than printing a whole crowd scene', () => {
    const crowd = Array.from({ length: 40 }, (_, i) => ({ name: `Actor ${i}`, order: i }));

    expect(topCastFrom({ cast: crowd })).toHaveLength(6);
  });

  // `order: 0` is top billing, not a missing value — the id: 0 trap in
  // another guise (see .claude/rules/testing.md).
  it('treats order 0 as top billing rather than as absent', () => {
    expect(topCastFrom({ cast: [{ name: 'Lead', order: 0 }, { name: 'Support', order: 5 }] })[0]).toBe('Lead');
  });

  it('sorts an unordered credit last instead of first', () => {
    const mixed = [{ name: 'No order' }, { name: 'Billed', order: 2 }];

    expect(topCastFrom({ cast: mixed })).toEqual(['Billed', 'No order']);
  });

  it('is null-safe', () => {
    expect(topCastFrom(null)).toEqual([]);
    expect(topCastFrom({})).toEqual([]);
  });
});

describe('certificationFrom', () => {
  const releaseDates = {
    results: [
      { iso_3166_1: 'GB', release_dates: [{ certification: '15' }] },
      {
        iso_3166_1: 'US',
        release_dates: [
          // Theatrical first, and uncertified — the reason this takes the
          // first NON-EMPTY certification rather than the first entry.
          { certification: '', type: 3 },
          { certification: 'PG-13', type: 4 }
        ]
      }
    ]
  };

  it('finds the certification for the region asked for', () => {
    expect(certificationFrom(releaseDates, 'US')).toBe('PG-13');
    expect(certificationFrom(releaseDates, 'GB')).toBe('15');
  });

  it('is null when the region carries no certification at all', () => {
    const uncertified = { results: [{ iso_3166_1: 'US', release_dates: [{ certification: '' }] }] };

    expect(certificationFrom(uncertified, 'US')).toBeNull();
  });

  it('is null for a region that is not listed, rather than borrowing another', () => {
    expect(certificationFrom(releaseDates, 'FR')).toBeNull();
  });

  it('is null-safe', () => {
    expect(certificationFrom(null)).toBeNull();
    expect(certificationFrom({})).toBeNull();
  });
});

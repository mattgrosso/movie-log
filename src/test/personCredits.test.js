import { describe, it, expect } from 'vitest';
import { dedupeAppearancesByFilm } from '../assets/javascript/personCredits.js';

// Bug report 2026-08-25: "do a better job of de-duping the list of credits."
// It reads as a display complaint and isn't one — a doubled credit inflates
// the person's film count past `minEntries` and feeds the same rating into
// personLogScore twice, moving where they rank.

const appearance = (id, billing = 0, title = `Film ${id}`) => ({
  entry: { movie: { id, title }, dbKey: `key-${id}` },
  billing
});

describe('dedupeAppearancesByFilm', () => {
  // The real case: Michael Crichton is credited on Jurassic Park as both
  // "Novel" and "Screenplay", so the writers section counted the film twice.
  it('counts one film once, however many credits the person holds on it', () => {
    const deduped = dedupeAppearancesByFilm([
      appearance(329, 0, 'Jurassic Park'),
      appearance(329, 0, 'Jurassic Park'),
      appearance(12, 0, 'Coco')
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((a) => a.entry.movie.title)).toEqual(['Jurassic Park', 'Coco']);
  });

  // Billing feeds confidence in personLogScore, so keeping the wrong one
  // would quietly demote a lead to whatever their second credit was.
  it('keeps the best billing when a role is credited twice', () => {
    const deduped = dedupeAppearancesByFilm([
      appearance(1, 11),
      appearance(1, 2),
      appearance(1, 7)
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].billing).toBe(2);
  });

  it('leaves an already-clean list exactly as it was', () => {
    const input = [appearance(1, 0), appearance(2, 3), appearance(3, 1)];
    expect(dedupeAppearancesByFilm(input)).toEqual(input);
  });

  it('does not mutate the array it was given', () => {
    const input = [appearance(1, 5), appearance(1, 1)];
    const snapshot = input.map((a) => a.billing);
    dedupeAppearancesByFilm(input);
    expect(input.map((a) => a.billing)).toEqual(snapshot);
  });

  // Losing a credit is worse than keeping a possible duplicate, and two
  // unidentifiable films can't be shown to be the same one anyway.
  it('keeps appearances it cannot identify rather than collapsing them', () => {
    const nameless = { entry: { movie: {} }, billing: 0 };
    const deduped = dedupeAppearancesByFilm([nameless, { entry: { movie: {} }, billing: 0 }]);
    expect(deduped).toHaveLength(2);
  });

  it('falls back to the database key when a film has no TMDB id', () => {
    const offline = (dbKey, billing) => ({ entry: { movie: {}, dbKey }, billing });
    expect(dedupeAppearancesByFilm([offline('a', 4), offline('a', 1), offline('b', 0)])).toHaveLength(2);
  });

  it('treats a missing billing as the worst one rather than the best', () => {
    const deduped = dedupeAppearancesByFilm([
      { entry: { movie: { id: 1 } } },
      appearance(1, 3)
    ]);
    expect(deduped[0].billing).toBe(3);
  });

  it('is safe on nothing at all', () => {
    expect(dedupeAppearancesByFilm(null)).toEqual([]);
    expect(dedupeAppearancesByFilm([])).toEqual([]);
  });

  // id 0 is falsy and would be dropped by a truthiness check.
  it('does not lose a film whose id is 0', () => {
    expect(dedupeAppearancesByFilm([appearance(0, 0)])).toHaveLength(1);
  });
});
